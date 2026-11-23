/**
 * Routes de la fonction « api » de Calbasse, sans dépendance à Supabase ni à Deno : la base de données et
 * le modèle de vision sont injectés. Cela permet de tester toute la logique (quotas, erreurs, corrections)
 * sans réseau. Le branchement réel est dans index.ts.
 *
 *   GET    /sante                 état du service (sans connexion)
 *   GET    /compte           🔒   scans restants aujourd'hui
 *   POST   /scan             🔒   { cle?, image, typeImage?, indice? } → aliments reconnus
 *   POST   /corrections      🔒   { scanId, proposees, finales }
 *   POST   /signalements     🔒   { jour, alimentId, repasNom? }
 *   DELETE /compte           🔒   supprime le compte et toutes ses données
 *
 * 🔒 = en-tête « Authorization: Bearer <jeton de connexion anonyme Supabase> »
 *
 * Les réponses gardent la forme du serveur Node d'origine (server/src/app.ts) : l'app n'a pas à savoir
 * laquelle des deux elle interroge.
 */
import type { ResultatScan, TypeImage } from '../_shared/vision.ts';
import { ErreurVision, RefusModele, ReponseIllisible, type Vision } from './rodium.ts';

// ——— Ce que la fonction attend de la base de données ———

export type Reservation = {
  statut: 'nouveau' | 'deja' | 'en_cours' | 'quota' | 'trop_vite' | 'budget';
  scan_id?: string;
  resultat?: Record<string, unknown>;
  limite: number;
  restants: number;
};

export type Depots = {
  /** Le compte à qui appartient ce jeton, ou null s'il est invalide ou expiré */
  utilisateur(jeton: string): Promise<{ id: string } | null>;
  reserverScan(id: string, cle: string, limite: number, budget: number, parMinute: number): Promise<Reservation>;
  terminerScan(scanId: string, p: { resultat: unknown; modele: string; dureeMs: number; usage: unknown; compte: boolean }): Promise<void>;
  echouerScan(scanId: string, erreur: string): Promise<void>;
  etatCompte(id: string, limite: number): Promise<{ limite: number; restants: number }>;
  /** false si ce scan n'appartient pas à cet utilisateur */
  enregistrerCorrection(id: string, c: { scanId: string; proposees: unknown; finales: unknown }): Promise<boolean>;
  enregistrerSignalement(id: string, s: { jour: string; alimentId: string; repasNom: string | null }): Promise<void>;
  supprimerCompte(id: string): Promise<void>;
};

export type Config = {
  modele: string;
  /** Scans gratuits par jour et par personne */
  limite: number;
  /** Scans par jour pour tout le monde : plafond de dépense */
  budget: number;
  /** Scans par minute et par personne */
  parMinute: number;
};

const TYPES: TypeImage[] = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const TAILLE_MAX_IMAGE = 7_000_000;        // caractères base64 : une photo réduite à 1280 px en fait ~300 000
const TAILLE_MAX_CORPS = 9_000_000;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
};

function repondre(statut: number, corps: unknown): Response {
  return new Response(statut === 204 ? null : JSON.stringify(corps), {
    status: statut,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...CORS },
  });
}

const compteDe = (restants: number, limite: number) => ({ premium: null, scansRestants: restants, limite, telephone: null });

async function lireCorps(req: Request): Promise<Record<string, unknown> | null> {
  if (Number(req.headers.get('content-length') ?? 0) > TAILLE_MAX_CORPS) return null;
  try {
    const texte = await req.text();
    if (texte.length > TAILLE_MAX_CORPS) return null;
    const v = JSON.parse(texte);
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function creerGestionnaire(d: { depots: Depots; vision: Vision; config: Config }) {
  const { depots, vision, config } = d;

  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return repondre(204, null);
    // Le chemin vu par la fonction peut être /api/scan ou /functions/v1/api/scan
    const chemin = new URL(req.url).pathname.replace(/^\/(functions\/v1\/)?api(?=\/|$)/, '').replace(/\/+$/, '') || '/';
    const methode = req.method;

    if (methode === 'GET' && chemin === '/sante') return repondre(200, { ok: true, modele: config.modele });

    const jeton = /^Bearer\s+(.+)$/i.exec(req.headers.get('authorization') ?? '')?.[1];
    if (!jeton) return repondre(401, { erreur: 'Connexion requise.' });
    const utilisateur = await depots.utilisateur(jeton).catch(() => null);
    if (!utilisateur) return repondre(401, { erreur: 'Session expirée.' });

    try {
      if (methode === 'GET' && chemin === '/compte') {
        const e = await depots.etatCompte(utilisateur.id, config.limite);
        return repondre(200, compteDe(e.restants, e.limite));
      }

      if (methode === 'POST' && chemin === '/scan') return await scanner(utilisateur.id, req);

      if (methode === 'POST' && chemin === '/corrections') {
        const c = await lireCorps(req);
        if (!c || typeof c.scanId !== 'string' || !Array.isArray(c.proposees) || !Array.isArray(c.finales)) return repondre(400, { erreur: 'Requête illisible.' });
        if (JSON.stringify(c).length > 40_000) return repondre(413, { erreur: 'Correction trop volumineuse.' });
        const ok = await depots.enregistrerCorrection(utilisateur.id, { scanId: c.scanId, proposees: c.proposees, finales: c.finales });
        return ok ? repondre(200, { ok: true }) : repondre(404, { erreur: 'Scan introuvable.' });
      }

      if (methode === 'POST' && chemin === '/signalements') {
        const s = await lireCorps(req);
        if (!s || typeof s.alimentId !== 'string' || !/^[\w-]{1,80}$/.test(s.alimentId) || typeof s.jour !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s.jour)) {
          return repondre(400, { erreur: 'Requête illisible.' });
        }
        await depots.enregistrerSignalement(utilisateur.id, { jour: s.jour, alimentId: s.alimentId, repasNom: typeof s.repasNom === 'string' ? s.repasNom.slice(0, 200) : null });
        return repondre(200, { ok: true });
      }

      if (methode === 'DELETE' && chemin === '/compte') {
        await depots.supprimerCompte(utilisateur.id);
        return repondre(200, { ok: true });
      }

      return repondre(404, { erreur: 'Route inconnue.' });
    } catch (e) {
      console.error('Erreur interne :', e);
      return repondre(500, { erreur: 'Erreur interne.' });
    }
  };

  async function scanner(id: string, req: Request): Promise<Response> {
    const corps = await lireCorps(req);
    if (!corps) return repondre(400, { erreur: 'Requête illisible ou photo trop lourde.' });
    const image = typeof corps.image === 'string' ? corps.image.replace(/^data:[^,]+,/, '') : '';
    if (!image) return repondre(400, { erreur: 'Photo manquante.' });
    if (image.length > TAILLE_MAX_IMAGE) return repondre(413, { erreur: 'Photo trop lourde.' });
    const typeImage = (TYPES.includes(corps.typeImage as TypeImage) ? corps.typeImage : 'image/jpeg') as TypeImage;
    const indice = typeof corps.indice === 'string' ? corps.indice.slice(0, 300) : '';
    // La clé identifie la photo : renvoyée après une coupure, elle rend le même résultat sans nouveau décompte
    const cle = typeof corps.cle === 'string' && /^[\w-]{8,64}$/.test(corps.cle) ? corps.cle : crypto.randomUUID();

    const r = await depots.reserverScan(id, cle, config.limite, config.budget, config.parMinute);
    switch (r.statut) {
      case 'deja':
        return repondre(200, { ...r.resultat, compte: compteDe(r.restants, r.limite) });
      case 'en_cours':
        return repondre(503, { erreur: 'Analyse déjà en cours, réessaie dans un instant.', code: 'en_cours' });
      case 'quota':
        return repondre(402, { erreur: 'Tu as utilisé tous tes scans du jour.', code: 'quota', ...compteDe(0, r.limite) });
      case 'trop_vite':
        return repondre(429, { erreur: 'Doucement : réessaie dans une minute.', code: 'trop_vite' });
      case 'budget':
        return repondre(403, { erreur: "Calbasse est très sollicité aujourd'hui. Réessaie demain.", code: 'budget' });
    }

    const scanId = r.scan_id!;
    const debut = Date.now();
    let resultat: ResultatScan;
    let usage: unknown;
    let modele: string;
    try {
      ({ resultat, usage, modele } = await vision(image, typeImage, indice));
    } catch (e) {
      await depots.echouerScan(scanId, String(e)).catch(() => {});          // un échec ne coûte rien à l'utilisateur
      return erreurVision(e);
    }

    const reponse = { scanId, ...resultat };
    // Une photo qui ne montre pas de nourriture ne coûte pas de scan
    const restants = resultat.estUnRepas ? r.restants : Math.min(r.limite, r.restants + 1);
    await depots.terminerScan(scanId, { resultat: reponse, modele, dureeMs: Date.now() - debut, usage, compte: resultat.estUnRepas }).catch((e) => {
      console.error('Résultat non enregistré :', e);
    });
    return repondre(200, { ...reponse, compte: compteDe(restants, r.limite) });
  }
}

function erreurVision(e: unknown): Response {
  if (e instanceof RefusModele) return repondre(422, { erreur: "Cette photo n'a pas pu être analysée." });
  if (e instanceof ReponseIllisible) return repondre(502, { erreur: 'Analyse incomplète, réessaie.' });
  if (e instanceof ErreurVision && (e.statut === 429 || e.statut === 503 || e.code === 'reseau')) {
    return repondre(503, { erreur: 'Service très demandé, réessaie dans un instant.' });
  }
  if (e instanceof ErreurVision) {
    // 401 : clé invalide ; 402 : crédit épuisé chez le fournisseur. À surveiller de près dans les logs.
    console.error(`ALERTE service de vision ${e.statut} : ${e.message}`);
    return repondre(503, { erreur: 'Analyse indisponible pour le moment.' });
  }
  console.error(e);
  return repondre(500, { erreur: 'Erreur interne.' });
}
