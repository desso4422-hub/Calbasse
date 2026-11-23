#!/usr/bin/env node
/**
 * Prépare les fichiers à coller dans Supabase quand on installe à la main (sans jeton d'accès) :
 *
 *   supabase/installation/N-<migration>.sql     un par migration, à coller dans Supabase → SQL Editor, dans l'ordre
 *   supabase/installation/N-fonction-api.ts     à coller dans Supabase → Edge Functions → fonction « api »
 *
 *   node scripts/preparer-installation.mjs             les (re)génère
 *   node scripts/preparer-installation.mjs --verifier  échoue s'ils ne sont pas à jour (utilisé par les tests)
 *
 * La fonction est regroupée en UN fichier : l'éditeur de Supabase n'en accepte qu'un, et c'est plus simple à coller.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sortie = path.join(racine, 'supabase/installation');
const esbuild = path.join(racine, 'server/node_modules/.bin/esbuild');

const dossierMigrations = path.join(racine, 'supabase/migrations');
const migrations = readdirSync(dossierMigrations).filter((f) => f.endsWith('.sql')).sort();
// Un fichier par migration, à coller dans l'ordre : on n'oblige jamais à rejouer ce qui est déjà installé.
const noms = ['base-de-donnees', 'sauvegarde-des-donnees', 'suite-3', 'suite-4', 'suite-5'];
const fichiers = {};
migrations.forEach((f, i) => {
  fichiers[`${i + 1}-${noms[i]}.sql`] =
    `-- Calbasse : ${noms[i].replace(/-/g, ' ')}. À coller en entier dans Supabase → SQL Editor → New query, puis Run.\n` +
    `-- Résultat attendu : « Success. No rows returned ».\n` +
    `-- FICHIER GÉNÉRÉ depuis supabase/migrations/${f} : ne pas modifier ici (npm run installation).\n\n` +
    readFileSync(path.join(dossierMigrations, f), 'utf8');
});
const numeroFonction = migrations.length + 1;

if (!existsSync(esbuild)) {
  console.error("esbuild est introuvable : lance « npm install --prefix server » d'abord.");
  process.exit(1);
}
const code = execFileSync(
  esbuild,
  [path.join(racine, 'supabase/functions/api/index.ts'), '--bundle', '--format=esm', '--platform=neutral', '--target=esnext', '--external:npm:*', '--legal-comments=none', '--log-level=error'],
  { encoding: 'utf8', maxBuffer: 20_000_000 },
);
const fonction =
  `// Calbasse : fonction « api ». À coller en entier dans Supabase → Edge Functions → fonction « api » (éditeur), puis Deploy.\n` +
  `// Penser à désactiver « Verify JWT » dans les réglages de la fonction (la fonction vérifie elle-même les connexions).\n` +
  `// FICHIER GÉNÉRÉ depuis supabase/functions/api/ : ne pas modifier ici (npm run installation).\n\n` +
  code;

fichiers[`${numeroFonction}-fonction-api.ts`] = fonction;
let ecart = false;
mkdirSync(sortie, { recursive: true });
for (const [nom, contenu] of Object.entries(fichiers)) {
  const cible = path.join(sortie, nom);
  if (process.argv.includes('--verifier')) {
    if (!existsSync(cible) || readFileSync(cible, 'utf8') !== contenu) {
      console.error(`${nom} n'est pas à jour. Lance : npm run installation`);
      ecart = true;
    }
  } else {
    writeFileSync(cible, contenu);
    console.log(`écrit : supabase/installation/${nom} (${Math.round(contenu.length / 1024)} Ko)`);
  }
}
process.exit(ecart ? 1 : 0);
