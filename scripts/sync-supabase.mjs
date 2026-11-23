#!/usr/bin/env node
/**
 * Copie le « cerveau » de la reconnaissance (consignes, catalogue d'aliments, validation) dans la
 * fonction Supabase : l'app et le serveur utilisent exactement les mêmes fichiers.
 *
 *   node scripts/sync-supabase.mjs             copie src/lib/{aliments,plats,vision}.ts
 *   node scripts/sync-supabase.mjs --verifier  échoue si la copie a pris du retard (utilisé par les tests)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FICHIERS = ['aliments.ts', 'plats.ts', 'vision.ts'];
const dest = path.join(racine, 'supabase/functions/_shared');
const entete = (f) => `// FICHIER GÉNÉRÉ : ne pas modifier ici.\n// Source : src/lib/${f}. Pour le mettre à jour : npm run sync:supabase\n\n`;

let ecart = false;
mkdirSync(dest, { recursive: true });
for (const f of FICHIERS) {
  const voulu = entete(f) + readFileSync(path.join(racine, 'src/lib', f), 'utf8');
  const cible = path.join(dest, f);
  if (process.argv.includes('--verifier')) {
    if (!existsSync(cible) || readFileSync(cible, 'utf8') !== voulu) {
      console.error(`${f} : la copie Supabase n'est pas à jour. Lance : npm run sync:supabase`);
      ecart = true;
    }
  } else {
    writeFileSync(cible, voulu);
    console.log(`copié : ${f}`);
  }
}
process.exit(ecart ? 1 : 0);
