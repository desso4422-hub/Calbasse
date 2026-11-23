#!/usr/bin/env node
/**
 * Copie dans la fonction Supabase le code qu'elle partage avec l'app (consignes, catalogue d'aliments,
 * validation) et avec le serveur Node (client CinetPay) : tous utilisent exactement les mêmes fichiers.
 *
 *   node scripts/sync-supabase.mjs             copie les fichiers partagés
 *   node scripts/sync-supabase.mjs --verifier  échoue si la copie a pris du retard (utilisé par les tests)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// [source, copie] : l'app et le serveur Node partagent leur code avec la fonction Supabase
export const COPIES = [
  ['src/lib/aliments.ts', 'supabase/functions/_shared/aliments.ts'],
  ['src/lib/plats.ts', 'supabase/functions/_shared/plats.ts'],
  ['src/lib/vision.ts', 'supabase/functions/_shared/vision.ts'],
  ['server/src/cinetpay.ts', 'supabase/functions/api/cinetpay.ts'],
];
const entete = (source) => `// FICHIER GÉNÉRÉ : ne pas modifier ici.\n// Source : ${source}. Pour le mettre à jour : npm run sync:supabase\n\n`;

let ecart = false;
for (const [source, copie] of COPIES) {
  const f = path.basename(copie);
  const voulu = entete(source) + readFileSync(path.join(racine, source), 'utf8');
  const cible = path.join(racine, copie);
  mkdirSync(path.dirname(cible), { recursive: true });
  if (process.argv.includes('--verifier')) {
    if (!existsSync(cible) || readFileSync(cible, 'utf8') !== voulu) {
      console.error(`${f} : la copie Supabase n'est pas à jour. Lance : npm run sync:supabase`);
      ecart = true;
    }
  } else {
    writeFileSync(cible, voulu);
    console.log(`copié : ${copie}`);
  }
}
process.exit(ecart ? 1 : 0);
