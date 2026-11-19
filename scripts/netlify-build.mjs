/**
 * Construction pour Netlify : la PWA + le serveur sous /api.
 *
 *   npm run build:netlify
 *
 * Résultat :
 *   dist/                  la PWA (export web d'Expo), publiée par Netlify
 *   netlify/fonctions/     le serveur, regroupé en un seul fichier
 * Les redirections et les en-têtes sont dans netlify.toml.
 */
import { execSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lancer = (cmd, env = {}) => execSync(cmd, { cwd: racine, stdio: 'inherit', env: { ...process.env, CI: '1', ...env } });

// 1. La PWA : le serveur est sur le même domaine, sous /api
rmSync(path.join(racine, 'dist'), { recursive: true, force: true });
lancer('npx expo export --platform web --output-dir dist', { EXPO_PUBLIC_API_URL: '/api' });

// 2. Le serveur, en un seul fichier ESM
const fonctions = path.join(racine, 'netlify/fonctions');
rmSync(fonctions, { recursive: true, force: true });
mkdirSync(fonctions, { recursive: true });
const { build } = await import(path.join(racine, 'server/node_modules/esbuild/lib/main.js'));
await build({
  entryPoints: [path.join(racine, 'server/src/netlify.ts')],
  outfile: path.join(fonctions, 'api.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  external: ['node:*'],
  // Certaines dépendances utilisent require() : on le fournit dans le module ESM
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  logLevel: 'info',
});
console.log('\nPrêt pour Netlify : dist (site) + netlify/fonctions (serveur)');
