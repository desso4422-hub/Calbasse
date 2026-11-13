/**
 * Essai rapide de la reconnaissance sur une ou plusieurs photos, avec le vrai modèle Gemini.
 *
 *   npm run essai -- photo.jpg
 *   npm run essai -- photo1.jpg photo2.png --indice "garba"
 *
 * Affiche, pour chaque photo, les aliments reconnus, les calories calculées par la base de l'app,
 * la durée et les tokens consommés (pour estimer le coût par scan).
 * Clé : GEMINI_API_KEY, ou la clé ajoutée comme secret réseau de l'environnement
 * (le proxy l'injecte dans l'en-tête x-goog-api-key).
 */
import { GoogleGenAI } from '@google/genai';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { trouverAliment } from '../../src/lib/aliments.ts';
import { arrondirNutriments, totalRepas } from '../../src/lib/nutrition.ts';
import { optionsDepuisEnv } from '../src/config.ts';
import { analyserRepas, type TypeImage } from '../src/reconnaissance.ts';

const args = process.argv.slice(2);
const i = args.indexOf('--indice');
const indice = i >= 0 ? (args[i + 1] ?? '') : '';
const photos = args.filter((_, j) => i < 0 || (j !== i && j !== i + 1));
if (photos.length === 0) {
  console.error('Usage : npm run essai -- photo.jpg [autre.jpg] [--indice "ce qu’il y a dedans"]');
  process.exit(1);
}

const types: Record<string, TypeImage> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
const options = optionsDepuisEnv();
// Sans clé locale, une valeur factice : le proxy de l'environnement la remplace par la vraie
const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'cle-injectee-par-le-proxy' });

console.log(`Modèle : ${options.modele} · réflexion : ${options.reflexion ?? 'par défaut'}${indice ? ` · indice : « ${indice} »` : ''}\n`);

for (const photo of photos) {
  const debut = Date.now();
  try {
    const image = (await readFile(photo)).toString('base64');
    const { resultat, usage } = await analyserRepas(client, image, types[path.extname(photo).toLowerCase()] ?? 'image/jpeg', indice, options);
    const t = arrondirNutriments(totalRepas(resultat.lignes));
    console.log(`📷 ${path.basename(photo)} — ${((Date.now() - debut) / 1000).toFixed(1)} s`);
    if (!resultat.estUnRepas) {
      console.log(`   Pas de repas reconnu. ${resultat.remarque}\n`);
      continue;
    }
    console.log(`   ${resultat.nom} (confiance ${resultat.confiance}) : ${t.kcal} kcal, ${t.prot} g de protéines`);
    for (const l of resultat.lignes) {
      const alt = l.alternatives.length ? `  — ou : ${l.alternatives.map((a) => trouverAliment(a).nom).join(', ')}` : '';
      console.log(`   ${l.confiance === 'haute' ? '✓' : '?'} ${trouverAliment(l.alimentId).nom}, ${l.grammes} g (${l.confiance})${alt}`);
    }
    for (const inc of resultat.inconnus) console.log(`   ✗ non reconnu : ${inc.description}, ${inc.grammes} g`);
    if (resultat.remarque) console.log(`   Remarque : ${resultat.remarque}`);
    const u = usage as { promptTokenCount?: number; cachedContentTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number } | undefined;
    if (u) {
      console.log(
        `   Tokens : entrée ${u.promptTokenCount ?? '?'} (dont cache ${u.cachedContentTokenCount ?? 0}), sortie ${u.candidatesTokenCount ?? '?'}, réflexion ${u.thoughtsTokenCount ?? 0}`,
      );
    }
    console.log('');
  } catch (e) {
    console.log(`📷 ${path.basename(photo)} — erreur : ${e instanceof Error ? e.message : e}\n`);
  }
}
