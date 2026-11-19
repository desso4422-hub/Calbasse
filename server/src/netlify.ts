/**
 * Fonction Netlify : le même serveur, servi sous /api à côté de la PWA.
 * Construite en un seul fichier par scripts/netlify-build.mjs.
 *
 * Netlify donne une requête web (Request) alors que le serveur parle le langage de node:http.
 * Plutôt que de traduire à la main, on fait écouter le serveur sur un port local de la fonction
 * et on lui passe la requête : même code, mêmes tests, aucun chemin en double.
 *
 * Sur l'offre gratuite, les données (comptes, scans du jour) vivent dans /tmp : elles
 * repartent à zéro quand Netlify recycle la fonction. Sans gêne pour des tests.
 */
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { serveurDepuisEnv } from './depuisEnv.ts';

const { serveur } = serveurDepuisEnv({ DATA_DIR: '/tmp/calbasse', DERRIERE_PROXY: '1', ...process.env });

/** Démarré une seule fois, au premier appel de la fonction. */
const portLocal = (async () => {
  serveur.listen(0, '127.0.0.1');
  await once(serveur, 'listening');
  return (serveur.address() as AddressInfo).port;
})();

/** /api/scan et /.netlify/functions/api/scan mènent tous deux à /scan. */
export function cheminInterne(url: string): string {
  const u = new URL(url);
  const chemin = u.pathname.replace(/^\/\.netlify\/functions\/api(?=\/|$)/, '').replace(/^\/api(?=\/|$)/, '');
  return `${chemin || '/'}${u.search}`;
}

export default async function gerer(requete: Request): Promise<Response> {
  const port = await portLocal;
  const corps = requete.method === 'GET' || requete.method === 'HEAD' ? undefined : await requete.arrayBuffer();
  return fetch(`http://127.0.0.1:${port}${cheminInterne(requete.url)}`, {
    method: requete.method,
    headers: requete.headers,
    body: corps,
  });
}
