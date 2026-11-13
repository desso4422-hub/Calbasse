/**
 * Routes du serveur Calbasse. Toutes les dépendances sont injectées (base, modèle, CinetPay),
 * ce qui permet de tester le serveur entier sans réseau.
 *
 *   GET  /sante                    état du serveur
 *   POST /comptes                  crée un compte anonyme → { jeton, premium, scansRestants, limite }
 *   GET  /compte              🔒   état du compte (Premium, scans restants)
 *   POST /scan                🔒   { cle?, image, typeImage?, indice? } → aliments reconnus (décompte 1 scan)
 *                                  cle : identifiant unique de la photo ; un renvoi avec la même clé
 *                                  rend le même résultat sans nouvelle analyse ni nouveau décompte
 *   POST /corrections         🔒   { scanId, proposees, finales }
 *   POST /telephone/code      🔒   { numero, indicatif? } → envoie un code par SMS
 *   POST /telephone/verifier  🔒   { numero, indicatif?, code } → rattache le numéro, ou récupère l'ancien compte
 *   POST /paiements           🔒   { plan } → { transactionId, urlPaiement } (CinetPay)
 *   GET  /paiements/:id       🔒   statut du paiement (revérifié auprès de CinetPay)
 *   POST /cinetpay/notification    appelée par CinetPay (notify_url)
 *   GET  /cinetpay/retour          page affichée après le paiement (return_url)
 *
 * 🔒 = en-tête « Authorization: Bearer <jeton> »
 */
import { randomInt, randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { masquerNumero, type Base, type Compte, type Plan } from './base.ts';
import { creerPaiementCinetPay, ErreurCinetPay, verifierPaiementCinetPay, type ClientHttp, type ConfigCinetPay } from './cinetpay.ts';
import type { Journal } from './journal.ts';
import { normaliserNumero, type EnvoyeurSms } from './sms.ts';
import { analyserRepas, ErreurFournisseur, RefusModele, ReponseIllisible, type Fournisseur, type OptionsAnalyse, type TypeImage } from './reconnaissance.ts';

export type Dependances = {
  base: Base;
  vision: Fournisseur;
  options: OptionsAnalyse;
  journal: Journal;
  /** null : paiement non configuré (les routes de paiement répondent 503) */
  cinetpay: ConfigCinetPay | null;
  /** null : SMS non configurés (les routes /telephone répondent 503) */
  sms: EnvoyeurSms | null;
  http?: ClientHttp;
  /** Limites anti-abus par adresse IP et par heure */
  requetesParHeure?: number;
  comptesParHeure?: number;
  /** true derrière un proxy de confiance (lit X-Forwarded-For) */
  derriereProxy?: boolean;
};

const TAILLE_MAX = 10 * 1024 * 1024; // une photo de 1568 px en JPEG fait ~300 Ko
const TYPES: TypeImage[] = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const PLANS: Plan[] = ['mensuel', 'annuel'];

class Limiteur {
  private readonly compteurs = new Map<string, { debut: number; n: number }>();
  private readonly max: number;
  constructor(max: number) {
    this.max = max;
  }
  autorise(cle: string): boolean {
    const maintenant = Date.now();
    const c = this.compteurs.get(cle);
    if (!c || maintenant - c.debut > 3_600_000) {
      this.compteurs.set(cle, { debut: maintenant, n: 1 });
      return true;
    }
    c.n += 1;
    return c.n <= this.max;
  }
}

function repondre(res: ServerResponse, statut: number, corps: object) {
  res.writeHead(statut, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(statut === 204 ? undefined : JSON.stringify(corps));
}

async function lireCorps(req: IncomingMessage): Promise<string> {
  const morceaux: Buffer[] = [];
  let taille = 0;
  for await (const m of req) {
    taille += (m as Buffer).length;
    if (taille > TAILLE_MAX) throw new Error('trop gros');
    morceaux.push(m as Buffer);
  }
  return Buffer.concat(morceaux).toString('utf8');
}

async function lireJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const texte = await lireCorps(req);
  const v = JSON.parse(texte || '{}');
  if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new Error('objet attendu');
  return v as Record<string, unknown>;
}

const PAGE_RETOUR = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Calbasse · Paiement</title>
<style>body{margin:0;font-family:system-ui,sans-serif;background:#FBF5EA;color:#2B1810;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;text-align:center}
a{display:inline-block;margin-top:20px;background:#B04A1C;color:#fff;text-decoration:none;font-weight:700;padding:16px 24px;border-radius:16px}</style></head>
<body><main><h1>Paiement terminé</h1><p>Retourne dans Calbasse : ton abonnement s'active dès que le paiement est confirmé.</p>
<a href="calbasse://premium">Revenir dans Calbasse</a></main></body></html>`;

export function creerApplication(d: Dependances): Server {
  const { base, journal, options } = d;
  const http = d.http ?? fetch;
  const limiteRequetes = new Limiteur(d.requetesParHeure ?? 120);
  const limiteComptes = new Limiteur(d.comptesParHeure ?? 10);
  /** Analyses en cours, par compte et clé de photo : un renvoi pendant l'analyse attend la même réponse */
  const scansEnCours = new Map<string, Promise<{ statut: number; corps: object }>>();

  const ip = (req: IncomingMessage) =>
    (d.derriereProxy ? (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim() : undefined) ?? req.socket.remoteAddress ?? '?';

  const authentifier = (req: IncomingMessage): Compte | null => {
    const entete = req.headers.authorization ?? '';
    const jeton = entete.startsWith('Bearer ') ? entete.slice(7).trim() : '';
    return jeton ? base.compteParJeton(jeton) : null;
  };

  /** Redemande le statut à CinetPay et applique le résultat. Renvoie le statut connu. */
  const confirmerPaiement = async (transactionId: string) => {
    const p = base.paiement(transactionId);
    if (!p || p.statut !== 'en_attente' || !d.cinetpay) return p?.statut ?? null;
    const s = await verifierPaiementCinetPay(d.cinetpay, transactionId, http);
    if (s.accepte) {
      if (s.devise === 'XOF' && s.montant !== null && s.montant >= p.montant) {
        base.validerPaiement(transactionId, { verification: s.brut });
        return 'accepte';
      }
      console.error(`Paiement ${transactionId} accepté mais montant ou devise inattendus`, s.brut);
      return 'en_attente';
    }
    if (s.echoue) {
      base.refuserPaiement(transactionId, { verification: s.brut });
      return 'refuse';
    }
    return 'en_attente';
  };

  const routes = async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const chemin = url.pathname;
    const methode = req.method ?? 'GET';

    if (methode === 'OPTIONS') return repondre(res, 204, {});
    if (methode === 'GET' && chemin === '/sante') return repondre(res, 200, { ok: true, vision: d.vision.nom, modele: options.modele, paiement: !!d.cinetpay });

    // Pages et notifications appelées par CinetPay (sans jeton)
    if (chemin === '/cinetpay/retour') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(PAGE_RETOUR);
    }
    if (chemin === '/cinetpay/notification') {
      if (methode !== 'POST') return repondre(res, 200, { ok: true }); // CinetPay teste l'adresse
      try {
        const texte = await lireCorps(req);
        const champs = (req.headers['content-type'] ?? '').includes('json') ? (JSON.parse(texte) as Record<string, string>) : Object.fromEntries(new URLSearchParams(texte));
        const transactionId = champs.cpm_trans_id;
        if (transactionId) await confirmerPaiement(String(transactionId));
      } catch (e) {
        console.error('Notification CinetPay non traitée :', e);
      }
      return repondre(res, 200, { ok: true });
    }

    if (!limiteRequetes.autorise(ip(req))) return repondre(res, 429, { erreur: 'Trop de requêtes, réessaie dans un moment.' });

    if (methode === 'POST' && chemin === '/comptes') {
      if (!limiteComptes.autorise(ip(req))) return repondre(res, 429, { erreur: 'Trop de comptes créés depuis ce réseau.' });
      const { compte, jeton } = base.creerCompte();
      return repondre(res, 201, { jeton, ...base.etatCompte(compte) });
    }

    const compte = authentifier(req);
    if (!compte) return repondre(res, 401, { erreur: 'Session expirée.', code: 'jeton' });

    if (methode === 'GET' && chemin === '/compte') return repondre(res, 200, base.etatCompte(compte));

    if (methode === 'POST' && chemin === '/scan') {
      let corps: Record<string, unknown>;
      try {
        corps = await lireJson(req);
      } catch {
        return repondre(res, 400, { erreur: 'Requête illisible ou photo trop lourde.' });
      }
      const cle = typeof corps.cle === 'string' && /^[\w-]{8,64}$/.test(corps.cle) ? corps.cle : null;
      if (cle) {
        // Même photo renvoyée (réseau coupé pendant la réponse) : même résultat, pas de nouveau décompte
        const deja = base.scanRendu(compte.id, cle);
        if (deja) return repondre(res, 200, { ...deja, compte: base.etatCompte(base.compte(compte.id)!) });
        const enCours = scansEnCours.get(`${compte.id}:${cle}`);
        if (enCours) {
          const r = await enCours;
          return repondre(res, r.statut, r.corps);
        }
      }
      if (base.scansRestants(compte) <= 0) {
        return repondre(res, 402, { erreur: 'Tu as utilisé tous tes scans du jour.', code: 'quota', ...base.etatCompte(compte) });
      }
      const image = typeof corps.image === 'string' ? corps.image.replace(/^data:[^,]+,/, '') : '';
      const typeImage = (TYPES.includes(corps.typeImage as TypeImage) ? corps.typeImage : 'image/jpeg') as TypeImage;
      const indice = typeof corps.indice === 'string' ? corps.indice : '';
      if (!image) return repondre(res, 400, { erreur: 'Photo manquante.' });

      const analyse = (async (): Promise<{ statut: number; corps: object }> => {
        const scanId = randomUUID();
        const debut = Date.now();
        try {
          const { resultat, brut, usage } = await analyserRepas(d.vision, image, typeImage, indice, options);
          // Une photo sans nourriture ne coûte pas de scan à l'utilisateur
          if (resultat.estUnRepas) base.compterScan(compte.id);
          await journal
            .scan(scanId, { compteId: compte.id, cle, indice, modele: options.modele, reflexion: options.reflexion ?? 'défaut', dureeMs: Date.now() - debut, brut, usage }, image)
            .catch(() => {});
          const reponse = { scanId, ...resultat };
          if (cle) base.memoriserScan(compte.id, cle, reponse);
          return { statut: 200, corps: { ...reponse, compte: base.etatCompte(base.compte(compte.id)!) } };
        } catch (e) {
          await journal.scan(scanId, { compteId: compte.id, cle, indice, erreur: String(e) }).catch(() => {});
          if (e instanceof RefusModele) return { statut: 422, corps: { erreur: "Cette photo n'a pas pu être analysée." } };
          if (e instanceof ReponseIllisible) return { statut: 502, corps: { erreur: 'Analyse incomplète, réessaie.' } };
          if (e instanceof ErreurFournisseur && (e.statut === 429 || e.statut === 503)) {
            return { statut: 503, corps: { erreur: 'Service très demandé, réessaie dans un instant.' } };
          }
          if (e instanceof ErreurFournisseur) {
            // 401 : clé invalide ; 402 : crédit épuisé chez le fournisseur → à surveiller de près
            console.error(`Erreur du service de vision (${d.vision.nom}) ${e.statut}:`, e.message);
            return { statut: 503, corps: { erreur: 'Analyse indisponible pour le moment.' } };
          }
          console.error(e);
          return { statut: 500, corps: { erreur: 'Erreur interne.' } };
        }
      })();
      if (cle) {
        scansEnCours.set(`${compte.id}:${cle}`, analyse);
        analyse.finally(() => scansEnCours.delete(`${compte.id}:${cle}`));
      }
      const r = await analyse;
      return repondre(res, r.statut, r.corps);
    }

    if (methode === 'POST' && chemin === '/corrections') {
      try {
        const corps = await lireJson(req);
        if (typeof corps.scanId !== 'string') return repondre(res, 400, { erreur: 'scanId manquant.' });
        await journal.correction({ compteId: compte.id, scanId: corps.scanId, proposees: corps.proposees, finales: corps.finales });
        return repondre(res, 200, { ok: true });
      } catch {
        return repondre(res, 400, { erreur: 'Requête illisible.' });
      }
    }

    if (methode === 'POST' && (chemin === '/telephone/code' || chemin === '/telephone/verifier')) {
      if (!d.sms) return repondre(res, 503, { erreur: "La vérification par SMS n'est pas encore disponible." });
      let corps: Record<string, unknown>;
      try {
        corps = await lireJson(req);
      } catch {
        return repondre(res, 400, { erreur: 'Requête illisible.' });
      }
      const numero = normaliserNumero(String(corps.numero ?? ''), typeof corps.indicatif === 'string' ? corps.indicatif : undefined);
      if (!numero) return repondre(res, 400, { erreur: 'Numéro de téléphone invalide.' });

      if (chemin === '/telephone/code') {
        const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
        if (!base.enregistrerCode(compte.id, numero, code)) {
          return repondre(res, 429, { erreur: 'Trop de codes demandés. Réessaie dans une heure.' });
        }
        try {
          await d.sms.envoyer(numero, `Calbasse : ton code est ${code}. Il expire dans 10 minutes. Ne le donne à personne.`);
        } catch (e) {
          console.error(e);
          return repondre(res, 502, { erreur: "Le SMS n'a pas pu être envoyé. Vérifie le numéro et réessaie." });
        }
        return repondre(res, 200, { ok: true, numero: masquerNumero(numero), expireDansMinutes: 10 });
      }

      const resultat = base.verifierCode(compte.id, numero, String(corps.code ?? '').replace(/\D/g, ''));
      if (resultat === 'trop_essais') return repondre(res, 429, { erreur: 'Trop d’essais. Demande un nouveau code.', code: 'trop_essais' });
      if (resultat === 'expire') return repondre(res, 400, { erreur: 'Ce code a expiré. Demande-en un nouveau.', code: 'expire' });
      if (resultat === 'invalide') return repondre(res, 400, { erreur: 'Code incorrect.', code: 'invalide' });
      const lien = base.lierTelephone(compte.id, numero);
      const final = base.compte(lien.compteId)!;
      return repondre(res, 200, { recupere: lien.nouveauJeton !== null, jeton: lien.nouveauJeton, ...base.etatCompte(final) });
    }

    if (methode === 'POST' && chemin === '/paiements') {
      if (!d.cinetpay) return repondre(res, 503, { erreur: "Le paiement n'est pas encore disponible." });
      let plan: Plan;
      try {
        const corps = await lireJson(req);
        plan = corps.plan as Plan;
        if (!PLANS.includes(plan)) throw new Error('plan');
      } catch {
        return repondre(res, 400, { erreur: 'Formule inconnue.' });
      }
      const p = base.creerPaiement(compte.id, plan);
      try {
        const urlPaiement = await creerPaiementCinetPay(
          d.cinetpay,
          { transactionId: p.transactionId, montant: p.montant, description: `Calbasse Premium ${plan}`, compteId: compte.id },
          http,
        );
        return repondre(res, 201, { transactionId: p.transactionId, urlPaiement });
      } catch (e) {
        base.refuserPaiement(p.transactionId, { erreur: String(e) });
        console.error(e instanceof ErreurCinetPay ? e.message : e);
        return repondre(res, 502, { erreur: 'Le paiement n’a pas pu démarrer. Réessaie dans un instant.' });
      }
    }

    const m = chemin.match(/^\/paiements\/([A-Z0-9]+)$/);
    if (methode === 'GET' && m) {
      const p = base.paiement(m[1]);
      if (!p || p.compteId !== compte.id) return repondre(res, 404, { erreur: 'Paiement introuvable.' });
      const statut = await confirmerPaiement(p.transactionId).catch(() => p.statut);
      return repondre(res, 200, { statut, compte: base.etatCompte(base.compte(compte.id)!) });
    }

    return repondre(res, 404, { erreur: 'Route inconnue.' });
  };

  return createServer((req, res) => {
    routes(req, res).catch((e) => {
      console.error(e);
      if (!res.headersSent) repondre(res, 500, { erreur: 'Erreur interne.' });
    });
  });
}
