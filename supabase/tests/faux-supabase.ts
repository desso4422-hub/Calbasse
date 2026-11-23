/**
 * Faux Supabase pour essayer l'app sans compte ni internet côté Supabase : il sert les mêmes adresses
 * (/auth/v1/signup, /auth/v1/token, /functions/v1/api/…) et fait tourner le VRAI code de la fonction « api »
 * (core.ts), avec une base en mémoire qui applique les mêmes règles que le SQL.
 *
 *   RODIUMAI_API_KEY=rd_sk_… node --experimental-strip-types supabase/tests/faux-supabase.ts
 *   puis construire l'app avec EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 EXPO_PUBLIC_SUPABASE_ANON_KEY=local
 *
 * Sans RODIUMAI_API_KEY, les scans renvoient un résultat de démonstration.
 */
import { createServer, type IncomingMessage } from 'node:http';
import { creerGestionnaire, type Depots, type Paiement, type Premium, type Reservation } from '../functions/api/core.ts';
import { creerVision, type Vision } from '../functions/api/rodium.ts';

const PORT = Number(process.env.PORT ?? 54321);
const GRATUITS = Number(process.env.SCANS_GRATUITS ?? 1);
const PREMIUM = Number(process.env.SCANS_PREMIUM ?? 10);

type Scan = { id: string; user: string; cle: string; jour: string; statut: 'en_cours' | 'ok' | 'hors_sujet' | 'echec'; resultat?: Record<string, unknown>; cree: number };
const utilisateurs = new Set<string>();
const jetons = new Map<string, string>();     // jeton d'accès → utilisateur
const refresh = new Map<string, string>();    // jeton de renouvellement → utilisateur
const scans: Scan[] = [];
const corrections: { user: string; scanId: string; proposees: unknown; finales: unknown }[] = [];
const signalements: { user: string; alimentId: string }[] = [];
const abonnements = new Map<string, { plan: 'mensuel' | 'annuel'; fin: number }>();
const codes = new Map<string, { plan: 'mensuel' | 'annuel'; jours: number; utilisePar?: string }>();
const paiements = new Map<string, Paiement>();
const emailDe = new Map<string, string>();         // utilisateur → e-mail confirmé
const liaisons = new Map<string, string>();        // e-mail en attente de confirmation → utilisateur
const sauvegardes = new Map<string, { revision: number; donnees: unknown; maj: string }>();
const CODE_EMAIL = '123456';                       // le « code reçu par e-mail » du faux Supabase
const essais = new Map<string, number>();

const forfait = (id: string): Premium => {
  const a = abonnements.get(id);
  return a && a.fin > Date.now() ? { plan: a.plan, jusquau: new Date(a.fin + 3600_000).toISOString().slice(0, 10) } : null;
};
const activer = (id: string, plan: 'mensuel' | 'annuel', jours: number) => {
  const a = abonnements.get(id);
  abonnements.set(id, { plan, fin: Math.max(Date.now(), a?.fin ?? 0) + jours * 86_400_000 });
};

const jourLagos = () => new Date(Date.now() + 3600_000).toISOString().slice(0, 10);
const compte = (s: Scan) => s.statut === 'ok' || (s.statut === 'en_cours' && Date.now() - s.cree < 180_000);

const depots: Depots = {
  async utilisateur(jeton) {
    const id = jetons.get(jeton);
    return id && utilisateurs.has(id) ? { id, email: emailDe.get(id) ?? null } : null;
  },
  async lireSauvegarde(id) {
    const s = sauvegardes.get(id);
    return s ? { revision: s.revision, donnees: s.donnees, maj_le: s.maj } : { revision: 0, donnees: null, maj_le: null };
  },
  async ecrireSauvegarde(id, donnees, base) {
    const rev = sauvegardes.get(id)?.revision ?? 0;
    if (rev !== base) return { statut: 'conflit', revision: rev };
    sauvegardes.set(id, { revision: rev + 1, donnees, maj: new Date().toISOString() });
    return { statut: 'ok', revision: rev + 1 };
  },
  async reserverScan(id, cle, gratuit, premium, budget, parMinute): Promise<Reservation> {
    const jour = jourLagos();
    const f = forfait(id);
    const limite = f ? premium : gratuit;
    const existant = scans.find((s) => s.user === id && s.cle === cle);
    const autres = scans.filter((s) => s.user === id && s.jour === jour && s.cle !== cle && compte(s)).length;
    if (existant && (existant.statut === 'ok' || existant.statut === 'hors_sujet')) {
      return { statut: 'deja', scan_id: existant.id, resultat: existant.resultat, premium: f, limite, restants: Math.max(0, limite - autres - (existant.statut === 'ok' ? 1 : 0)) };
    }
    if (existant && existant.statut === 'en_cours' && Date.now() - existant.cree < 180_000) return { statut: 'en_cours', scan_id: existant.id, premium: f, limite, restants: limite - autres - 1 };
    if (autres >= limite) return { statut: 'quota', premium: f, limite, restants: 0 };
    if (scans.filter((s) => s.user === id && s.cle !== cle && Date.now() - s.cree < 60_000).length >= parMinute) return { statut: 'trop_vite', premium: f, limite, restants: limite - autres };
    if (scans.filter((s) => s.jour === jour && compte(s)).length >= budget) return { statut: 'budget', premium: f, limite, restants: limite - autres };
    const s: Scan = existant ?? { id: crypto.randomUUID(), user: id, cle, jour, statut: 'en_cours', cree: Date.now() };
    Object.assign(s, { jour, statut: 'en_cours', cree: Date.now() });
    if (!existant) scans.push(s);
    return { statut: 'nouveau', scan_id: s.id, premium: f, limite, restants: limite - autres - 1 };
  },
  async terminerScan(scanId, p) {
    const s = scans.find((x) => x.id === scanId)!;
    Object.assign(s, { statut: p.compte ? 'ok' : 'hors_sujet', resultat: p.resultat as Record<string, unknown> });
  },
  async echouerScan(scanId) {
    scans.find((x) => x.id === scanId)!.statut = 'echec';
  },
  async etatCompte(id, gratuit, premium) {
    const f = forfait(id);
    const limite = f ? premium : gratuit;
    return { limite, premium: f, restants: Math.max(0, limite - scans.filter((s) => s.user === id && s.jour === jourLagos() && compte(s)).length) };
  },
  async utiliserCode(id, code) {
    const essaisRecents = essais.get(id) ?? 0;
    if (essaisRecents >= 5) return { statut: 'trop_essais' };
    const c = codes.get(code.trim().toUpperCase());
    if (!c) { essais.set(id, essaisRecents + 1); return { statut: 'invalide' }; }
    if (c.utilisePar) { essais.set(id, essaisRecents + 1); return { statut: 'deja_utilise' }; }
    c.utilisePar = id;
    activer(id, c.plan, c.jours);
    return { statut: 'ok' };
  },
  async creerPaiement(id, plan, montant) {
    const tid = 'CAL' + crypto.randomUUID().replace(/-/g, '').slice(0, 18).toUpperCase();
    paiements.set(tid, { id: tid, user_id: id, plan, montant, statut: 'en_attente' });
    return tid;
  },
  async lirePaiement(tid) { return paiements.get(tid) ?? null; },
  async validerPaiement(tid, jours) {
    const p = paiements.get(tid);
    if (p && p.statut === 'en_attente') { p.statut = 'accepte'; activer(p.user_id, p.plan, jours); }
  },
  async refuserPaiement(tid) { const p = paiements.get(tid); if (p && p.statut === 'en_attente') p.statut = 'refuse'; },
  async enregistrerCorrection(id, c) {
    if (!scans.some((s) => s.id === c.scanId && s.user === id)) return false;
    corrections.push({ user: id, ...c });
    return true;
  },
  async enregistrerSignalement(id, s) {
    signalements.push({ user: id, alimentId: s.alimentId });
  },
  async supprimerCompte(id) {
    utilisateurs.delete(id);
    emailDe.delete(id);
    sauvegardes.delete(id);
    for (let i = scans.length - 1; i >= 0; i--) if (scans[i].user === id) scans.splice(i, 1);
    console.log(`  → compte ${id.slice(0, 8)} supprimé avec ses données`);
  },
};

const cleApi = process.env.RODIUMAI_API_KEY;
const demo: Vision = async () => ({
  modele: 'demo',
  usage: {},
  resultat: {
    estUnRepas: true,
    nom: 'Attiéké, poisson braisé (démo)',
    confiance: 'haute',
    lignes: [
      { alimentId: 'attieke', grammes: 250, confiance: 'haute', alternatives: [] },
      { alimentId: 'poisson-braise', grammes: 150, confiance: 'moyenne', alternatives: ['poisson-frit'] },
    ],
    inconnus: [],
    remarque: '',
  },
});
const vision = cleApi ? creerVision({ cleApi, urlApi: 'https://api.rodiumai.io/v1', modele: 'google/gemini-3.1-flash-lite' }) : demo;
const api = creerGestionnaire({
  depots,
  vision,
  config: {
    modele: 'faux', gratuit: GRATUITS, premium: PREMIUM, budget: 300, parMinute: 6, cinetpay: null,
    tarifs: { mensuel: { montant: 1500, jours: 30 }, annuel: { montant: 12000, jours: 365 } },
  },
});

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS' };
async function corps(req: IncomingMessage): Promise<Buffer> {
  const morceaux: Buffer[] = [];
  for await (const m of req) morceaux.push(m as Buffer);
  return Buffer.concat(morceaux);
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);
  const donnees = await corps(req);
  const ecrire = (statut: number, objet: unknown) => {
    res.writeHead(statut, { 'Content-Type': 'application/json', ...CORS });
    res.end(JSON.stringify(objet));
  };
  if (req.method === 'OPTIONS') return ecrire(204, null);
  console.log(`${req.method} ${url.pathname}${url.search}`);

  if (url.pathname === '/auth/v1/signup' && req.method === 'POST') {
    const id = crypto.randomUUID();
    utilisateurs.add(id);
    const acces = `acces-${id}`, rafraichir = `refresh-${id}`;
    jetons.set(acces, id); refresh.set(rafraichir, id);
    return ecrire(200, { access_token: acces, refresh_token: rafraichir, expires_in: 3600, token_type: 'bearer', user: { id, is_anonymous: true } });
  }
  if (url.pathname === '/auth/v1/token' && req.method === 'POST') {
    const id = refresh.get(JSON.parse(donnees.toString() || '{}').refresh_token);
    if (!id) return ecrire(400, { error: 'invalid_grant' });
    const acces = `acces-${id}-${Date.now()}`;
    jetons.set(acces, id);
    return ecrire(200, { access_token: acces, refresh_token: `refresh-${id}`, expires_in: 3600 });
  }
  // Compte avec e-mail : même protocole que Supabase (code à 6 chiffres, toujours 123456 ici)
  const session = (id: string) => {
    const acces = `acces-${id}-${Date.now()}`, rafraichir = `refresh-${id}`;
    jetons.set(acces, id); refresh.set(rafraichir, id);
    return { access_token: acces, refresh_token: rafraichir, expires_in: 3600, token_type: 'bearer', user: { id, email: emailDe.get(id) } };
  };
  if (url.pathname === '/auth/v1/user' && req.method === 'PUT') {
    const id = jetons.get((req.headers.authorization ?? '').replace(/^Bearer /, ''));
    const email = String(JSON.parse(donnees.toString() || '{}').email ?? '').toLowerCase();
    if (!id) return ecrire(401, { code: 401, msg: 'invalid JWT' });
    if ([...emailDe.values()].includes(email)) return ecrire(422, { error_code: 'email_exists', msg: 'A user with this email address has already been registered' });
    liaisons.set(email, id);
    console.log(`  → e-mail à ${email} : code ${CODE_EMAIL}`);
    return ecrire(200, { id, new_email: email });
  }
  if (url.pathname === '/auth/v1/otp' && req.method === 'POST') {
    const email = String(JSON.parse(donnees.toString() || '{}').email ?? '').toLowerCase();
    if (![...emailDe.values()].includes(email)) return ecrire(422, { error_code: 'otp_disabled', msg: 'Signups not allowed for otp' });
    console.log(`  → e-mail à ${email} : code ${CODE_EMAIL}`);
    return ecrire(200, {});
  }
  if (url.pathname === '/auth/v1/verify' && req.method === 'POST') {
    const { type, email: brut, token } = JSON.parse(donnees.toString() || '{}');
    const email = String(brut ?? '').toLowerCase();
    if (token !== CODE_EMAIL) return ecrire(403, { error_code: 'otp_expired', msg: 'Token has expired or is invalid' });
    if (type === 'email_change' && liaisons.has(email)) {
      const id = liaisons.get(email)!;
      liaisons.delete(email);
      emailDe.set(id, email);
      return ecrire(200, session(id));
    }
    if (type === 'email') {
      const id = [...emailDe].find(([, e]) => e === email)?.[0];
      if (id) return ecrire(200, session(id));
    }
    return ecrire(403, { error_code: 'otp_expired', msg: 'Token has expired or is invalid' });
  }
  if (url.pathname.startsWith('/functions/v1/api')) {
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
    const r = await api(new Request(url, { method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method ?? 'GET') ? undefined : donnees }));
    console.log(`  → ${r.status}`);
    res.writeHead(r.status, Object.fromEntries(r.headers));
    return res.end(Buffer.from(await r.arrayBuffer()));
  }
  // Outil d'essai : joue le rôle de « select * from creer_codes('mensuel', 30, 1) » dans l'éditeur SQL de Supabase
  if (url.pathname === '/__creer-code') {
    const code = 'CAL-' + crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase().replace(/(.{4})(.{4})(.{4})/, '$1-$2-$3');
    codes.set(code, { plan: 'mensuel', jours: 30 });
    return ecrire(200, { code });
  }
  if (url.pathname === '/__etat') return ecrire(200, { utilisateurs: utilisateurs.size, scans: scans.length, corrections, signalements, abonnes: [...abonnements.keys()].length, sauvegardes: [...sauvegardes.values()].map((x) => x.donnees), emails: [...emailDe.values()] });
  return ecrire(404, { erreur: 'inconnu' });
}).listen(PORT, '127.0.0.1', () => console.log(`Faux Supabase prêt sur http://127.0.0.1:${PORT} (${cleApi ? 'vraie reconnaissance' : 'résultat de démonstration'}, ${GRATUITS} gratuit / ${PREMIUM} premium par jour)`));
