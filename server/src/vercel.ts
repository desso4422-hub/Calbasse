/**
 * Fonction Vercel : le même serveur, servi sous /api à côté de la PWA.
 * Construite en un seul fichier par scripts/vercel-build.mjs (Build Output API de Vercel).
 *
 * Sur l'offre gratuite, les données (comptes, scans du jour) vivent dans /tmp : elles
 * repartent à zéro quand Vercel recycle la fonction. Sans gêne pour des tests.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { serveurDepuisEnv } from './depuisEnv.ts';

const { serveur } = serveurDepuisEnv({ DATA_DIR: '/tmp/calbasse', DERRIERE_PROXY: '1', ...process.env });

export default function gerer(req: IncomingMessage, res: ServerResponse) {
  // /api/scan → /scan
  req.url = (req.url ?? '/').replace(/^\/api(?=\/|$)/, '') || '/';
  serveur.emit('request', req, res);
}
