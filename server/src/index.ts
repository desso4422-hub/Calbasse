/**
 * Serveur Calbasse : reconnaissance des plats.
 *
 *   ANTHROPIC_API_KEY=... npm start
 *
 * Routes :
 *   GET  /sante        → état du serveur
 *   POST /scan         → { image: base64 JPEG/PNG/WebP, typeImage?, indice? } → aliments reconnus
 *   POST /corrections  → { scanId, proposees, finales } → enregistré pour améliorer la reconnaissance
 */
import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { Journal } from './journal.ts';
import { analyserRepas, RefusModele, ReponseIllisible, type OptionsAnalyse, type TypeImage } from './reconnaissance.ts';

const PORT = Number(process.env.PORT ?? 8787);
const options: OptionsAnalyse = {
  modele: process.env.CALBASSE_MODELE ?? 'claude-opus-5-5',
  effort: (process.env.CALBASSE_EFFORT as OptionsAnalyse['effort']) ?? 'medium',
};
const SCANS_PAR_HEURE = Number(process.env.SCANS_PAR_HEURE ?? 60);
const TAILLE_MAX = 10 * 1024 * 1024; // 10 Mo de JSON (une photo de 1568 px en JPEG fait ~300 Ko)
const TYPES: TypeImage[] = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const client = new Anthropic();
const journal = new Journal(process.env.DATA_DIR ?? './donnees', process.env.GARDER_PHOTOS === '1');

// Limite simple par adresse IP (en mémoire). Derrière un proxy, mets-la plutôt au niveau du proxy.
const compteurs = new Map<string, { debut: number; n: number }>();
function autorise(ip: string): boolean {
  const maintenant = Date.now();
  const c = compteurs.get(ip);
  if (!c || maintenant - c.debut > 3_600_000) {
    compteurs.set(ip, { debut: maintenant, n: 1 });
    return true;
  }
  c.n += 1;
  return c.n <= SCANS_PAR_HEURE;
}

function repondre(res: ServerResponse, statut: number, corps: object) {
  res.writeHead(statut, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(corps));
}

async function lireJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const morceaux: Buffer[] = [];
  let taille = 0;
  for await (const m of req) {
    taille += (m as Buffer).length;
    if (taille > TAILLE_MAX) throw new Error('trop gros');
    morceaux.push(m as Buffer);
  }
  return JSON.parse(Buffer.concat(morceaux).toString('utf8'));
}

async function scan(req: IncomingMessage, res: ServerResponse) {
  const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim() ?? req.socket.remoteAddress ?? '?';
  if (!autorise(ip)) return repondre(res, 429, { erreur: 'Trop de scans, réessaie dans un moment.' });

  let corps: Record<string, unknown>;
  try {
    corps = await lireJson(req);
  } catch {
    return repondre(res, 400, { erreur: 'Requête illisible ou photo trop lourde.' });
  }
  const image = typeof corps.image === 'string' ? corps.image.replace(/^data:[^,]+,/, '') : '';
  const typeImage = (TYPES.includes(corps.typeImage as TypeImage) ? corps.typeImage : 'image/jpeg') as TypeImage;
  const indice = typeof corps.indice === 'string' ? corps.indice : '';
  if (!image) return repondre(res, 400, { erreur: 'Photo manquante.' });

  const scanId = randomUUID();
  const debut = Date.now();
  try {
    const { resultat, brut, usage } = await analyserRepas(client, image, typeImage, indice, options);
    await journal.scan(scanId, { indice, modele: options.modele, effort: options.effort, dureeMs: Date.now() - debut, brut, usage }, image).catch(() => {});
    return repondre(res, 200, { scanId, ...resultat });
  } catch (e) {
    await journal.scan(scanId, { indice, erreur: String(e) }).catch(() => {});
    if (e instanceof RefusModele) return repondre(res, 422, { erreur: "Cette photo n'a pas pu être analysée." });
    if (e instanceof ReponseIllisible) return repondre(res, 502, { erreur: 'Analyse incomplète, réessaie.' });
    if (e instanceof Anthropic.RateLimitError) return repondre(res, 503, { erreur: 'Service très demandé, réessaie dans un instant.' });
    if (e instanceof Anthropic.APIError) {
      console.error(`Erreur API ${e.status}:`, e.message);
      return repondre(res, 502, { erreur: 'Analyse indisponible pour le moment.' });
    }
    console.error(e);
    return repondre(res, 500, { erreur: 'Erreur interne.' });
  }
}

async function corrections(req: IncomingMessage, res: ServerResponse) {
  try {
    const corps = await lireJson(req);
    if (typeof corps.scanId !== 'string') return repondre(res, 400, { erreur: 'scanId manquant.' });
    await journal.correction({ scanId: corps.scanId, proposees: corps.proposees, finales: corps.finales });
    return repondre(res, 200, { ok: true });
  } catch {
    return repondre(res, 400, { erreur: 'Requête illisible.' });
  }
}

const serveur = createServer((req, res) => {
  const url = req.url?.split('?')[0];
  if (req.method === 'OPTIONS') return repondre(res, 204, {});
  if (req.method === 'GET' && url === '/sante') return repondre(res, 200, { ok: true, modele: options.modele, effort: options.effort });
  if (req.method === 'POST' && url === '/scan') return void scan(req, res);
  if (req.method === 'POST' && url === '/corrections') return void corrections(req, res);
  repondre(res, 404, { erreur: 'Route inconnue.' });
});

serveur.listen(PORT, () => console.log(`Calbasse : serveur prêt sur le port ${PORT} (${options.modele}, effort ${options.effort})`));
