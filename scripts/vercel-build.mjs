/**
 * Construction pour Vercel (Build Output API v3) : la PWA + le serveur sous /api.
 *
 *   npm run build:vercel
 *
 * Résultat dans .vercel/output :
 *   static/              la PWA (export web d'Expo)
 *   functions/api.func/  le serveur, regroupé en un seul fichier
 *   config.json          routes : /api/* → serveur, le reste → la PWA
 */
import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sortie = path.join(racine, '.vercel/output');
const lancer = (cmd, env = {}) => execSync(cmd, { cwd: racine, stdio: 'inherit', env: { ...process.env, CI: '1', ...env } });

rmSync(sortie, { recursive: true, force: true });

// 1. La PWA : le serveur est sur le même domaine, sous /api
lancer('npx expo export --platform web --output-dir dist', { EXPO_PUBLIC_API_URL: '/api' });
cpSync(path.join(racine, 'dist'), path.join(sortie, 'static'), { recursive: true });

// 2. Le serveur, en un seul fichier ESM
const fonction = path.join(sortie, 'functions/api.func');
mkdirSync(fonction, { recursive: true });
const { build } = await import(path.join(racine, 'server/node_modules/esbuild/lib/main.js'));
await build({
  entryPoints: [path.join(racine, 'server/src/vercel.ts')],
  outfile: path.join(fonction, 'index.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  external: ['node:*'],
  // Certaines dépendances utilisent require() : on le fournit dans le module ESM
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  logLevel: 'info',
});
writeFileSync(
  path.join(fonction, '.vc-config.json'),
  JSON.stringify({ runtime: 'nodejs22.x', handler: 'index.mjs', launcherType: 'Nodejs', shouldAddHelpers: false, maxDuration: 60 }, null, 2),
);
writeFileSync(path.join(fonction, 'package.json'), JSON.stringify({ type: 'module' }));

// 3. Les routes
writeFileSync(
  path.join(sortie, 'config.json'),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: '/sw.js', headers: { 'Cache-Control': 'no-cache', 'Service-Worker-Allowed': '/' }, continue: true },
        { src: '/_expo/static/(.*)', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' }, continue: true },
        { src: '/api(?:/.*)?', dest: '/api' },
        { handle: 'filesystem' },
        { src: '/(.*)', dest: '/index.html' },
      ],
    },
    null,
    2,
  ),
);
console.log('\nPrêt pour Vercel : .vercel/output');
