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
import { creerGestionnaire, type Depots, type Reservation } from '../functions/api/core.ts';
import { creerVision, type Vision } from '../functions/api/rodium.ts';

const PORT = Number(process.env.PORT ?? 54321);
const LIMITE = Number(process.env.SCANS_PAR_JOUR ?? 5);

type Scan = { id: string; user: string; cle: string; jour: string; statut: 'en_cours' | 'ok' | 'hors_sujet' | 'echec'; resultat?: Record<string, unknown>; cree: number };
const utilisateurs = new Set<string>();
const jetons = new Map<string, string>();     // jeton d'accès → utilisateur
const refresh = new Map<string, string>();    // jeton de renouvellement → utilisateur
const scans: Scan[] = [];
const corrections: { user: string; scanId: string; proposees: unknown; finales: unknown }[] = [];
const signalements: { user: string; alimentId: string }[] = [];

const jourLagos = () => new Date(Date.now() + 3600_000).toISOString().slice(0, 10);
const compte = (s: Scan) => s.statut === 'ok' || (s.statut === 'en_cours' && Date.now() - s.cree < 180_000);

const depots: Depots = {
  async utilisateur(jeton) {
    const id = jetons.get(jeton);
    return id && utilisateurs.has(id) ? { id } : null;
  },
  async reserverScan(id, cle, limite, budget, parMinute): Promise<Reservation> {
    const jour = jourLagos();
    const existant = scans.find((s) => s.user === id && s.cle === cle);
    const autres = scans.filter((s) => s.user === id && s.jour === jour && s.cle !== cle && compte(s)).length;
    if (existant && (existant.statut === 'ok' || existant.statut === 'hors_sujet')) {
      return { statut: 'deja', scan_id: existant.id, resultat: existant.resultat, limite, restants: Math.max(0, limite - autres - (existant.statut === 'ok' ? 1 : 0)) };
    }
    if (existant && existant.statut === 'en_cours' && Date.now() - existant.cree < 180_000) return { statut: 'en_cours', scan_id: existant.id, limite, restants: limite - autres - 1 };
    if (autres >= limite) return { statut: 'quota', limite, restants: 0 };
    if (scans.filter((s) => s.user === id && s.cle !== cle && Date.now() - s.cree < 60_000).length >= parMinute) return { statut: 'trop_vite', limite, restants: limite - autres };
    if (scans.filter((s) => s.jour === jour && compte(s)).length >= budget) return { statut: 'budget', limite, restants: limite - autres };
    const s: Scan = existant ?? { id: crypto.randomUUID(), user: id, cle, jour, statut: 'en_cours', cree: Date.now() };
    Object.assign(s, { jour, statut: 'en_cours', cree: Date.now() });
    if (!existant) scans.push(s);
    return { statut: 'nouveau', scan_id: s.id, limite, restants: limite - autres - 1 };
  },
  async terminerScan(scanId, p) {
    const s = scans.find((x) => x.id === scanId)!;
    Object.assign(s, { statut: p.compte ? 'ok' : 'hors_sujet', resultat: p.resultat as Record<string, unknown> });
  },
  async echouerScan(scanId) {
    scans.find((x) => x.id === scanId)!.statut = 'echec';
  },
  async etatCompte(id, limite) {
    return { limite, restants: Math.max(0, limite - scans.filter((s) => s.user === id && s.jour === jourLagos() && compte(s)).length) };
  },
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
const api = creerGestionnaire({ depots, vision, config: { modele: 'faux', limite: LIMITE, budget: 300, parMinute: 6 } });

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS' };
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
  if (url.pathname.startsWith('/functions/v1/api')) {
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
    const r = await api(new Request(url, { method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method ?? 'GET') ? undefined : donnees }));
    res.writeHead(r.status, Object.fromEntries(r.headers));
    return res.end(Buffer.from(await r.arrayBuffer()));
  }
  if (url.pathname === '/__etat') return ecrire(200, { utilisateurs: utilisateurs.size, scans: scans.length, corrections, signalements });
  return ecrire(404, { erreur: 'inconnu' });
}).listen(PORT, '127.0.0.1', () => console.log(`Faux Supabase prêt sur http://127.0.0.1:${PORT} (${cleApi ? 'vraie reconnaissance' : 'résultat de démonstration'}, ${LIMITE} scans/jour)`));
