/**
 * Évalue la reconnaissance sur un jeu de photos étiquetées.
 *
 *   RODIUMAI_API_KEY=... npm run evaluer
 *   REFLEXION=low npm run evaluer                          # comparer un réglage
 *   RODIUMAI_MODELE=google/gemini-2.5-flash npm run evaluer  # comparer un modèle
 *
 * Attend eval/photos/*.jpg|png|webp et eval/etiquettes.json (voir eval/LISEZ-MOI.md).
 * ⚠️ Chaque photo est un appel payant à l'API.
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { idsAliments } from '../src/catalogue.ts';
import { fournisseurDepuisEnv, optionsDepuisEnv } from '../src/config.ts';
import { analyserRepas, type ResultatScan, type TypeImage } from '../src/reconnaissance.ts';
import { noter, resumer, type Etiquette, type NoteScan } from './score.ts';

const dossier = path.dirname(new URL(import.meta.url).pathname);
const options = optionsDepuisEnv();
const reglage = options.reflexion ?? 'defaut';
const types: Record<string, TypeImage> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

const fichierEtiquettes = path.join(dossier, 'etiquettes.json');
if (!existsSync(fichierEtiquettes)) {
  console.error('Il manque eval/etiquettes.json : voir eval/LISEZ-MOI.md');
  process.exit(1);
}
const etiquettes = JSON.parse(await readFile(fichierEtiquettes, 'utf8')) as Record<string, Etiquette>;

// Une étiquette avec un identifiant inconnu fausserait la note : on s'arrête tout de suite.
const connus = new Set(idsAliments);
for (const [photo, e] of Object.entries(etiquettes)) {
  const faux = e.aliments.filter((id) => !connus.has(id));
  if (faux.length) {
    console.error(`${photo} : identifiants inconnus ${faux.join(', ')}`);
    process.exit(1);
  }
}

const client =
  fournisseurDepuisEnv() ??
  (console.error('Aucune clé : définis RODIUMAI_API_KEY (RodiumAI) ou GEMINI_API_KEY (Gemini).'), process.exit(1));
const lignes: { photo: string; note: NoteScan; scan?: ResultatScan; erreur?: string; dureeMs: number }[] = [];
const photos = Object.keys(etiquettes);
console.log(`${photos.length} photos · ${options.modele} · réflexion ${reglage}\n`);

// 3 analyses en parallèle : assez rapide, sans saturer la limite de débit.
let suivant = 0;
async function travailleur() {
  while (suivant < photos.length) {
    const photo = photos[suivant++];
    const e = etiquettes[photo];
    const debut = Date.now();
    try {
      const image = (await readFile(path.join(dossier, 'photos', photo))).toString('base64');
      const { resultat } = await analyserRepas(client, image, types[path.extname(photo).toLowerCase()] ?? 'image/jpeg', e.indice ?? '', options);
      const note = noter(resultat, e);
      lignes.push({ photo, note, scan: resultat, dureeMs: Date.now() - debut });
      console.log(`${note.exact ? '✓' : '✗'} ${photo}${note.manques.length ? `  manque : ${note.manques.join(', ')}` : ''}${note.enTrop.length ? `  en trop : ${note.enTrop.join(', ')}` : ''}`);
    } catch (err) {
      const note = noter({ estUnRepas: false, nom: '', confiance: 'basse', lignes: [], inconnus: [], remarque: '' }, e);
      lignes.push({ photo, note, erreur: String(err), dureeMs: Date.now() - debut });
      console.log(`! ${photo}  erreur : ${err}`);
    }
  }
}
await Promise.all([travailleur(), travailleur(), travailleur()]);

const bilan = resumer(lignes.map((l) => l.note));
const pct = (x: number) => `${Math.round(x * 100)} %`;
const durees = lignes.map((l) => l.dureeMs).sort((a, b) => a - b);
console.log(`
Assiettes entièrement justes : ${pct(bilan.assiettesExactes)}
Précision (aliments proposés qui sont justes) : ${pct(bilan.precision)}
Rappel (aliments présents qui sont trouvés) : ${pct(bilan.rappel)}
Rappel en comptant les alternatives proposées : ${pct(bilan.rappelAvecAlternatives)}
Rappel en acceptant les variantes proches (poulet frit/braisé, bœuf/chèvre…) : ${pct(bilan.rappelProche)}
Écart médian sur les grammes pesés : ${bilan.ecartGrammesMedian === null ? '—' : pct(bilan.ecartGrammesMedian)}
Durée médiane d'une analyse : ${(durees[Math.floor(durees.length / 2)] / 1000).toFixed(1)} s
Confusions les plus fréquentes :`);
for (const [c, n] of Object.entries(bilan.confusions).sort((a, b) => b[1] - a[1]).slice(0, 10)) console.log(`  ${n} × ${c}`);

await mkdir(path.join(dossier, 'resultats'), { recursive: true });
const sortie = path.join(dossier, 'resultats', `${new Date().toISOString().replace(/[:.]/g, '-')}-${options.modele.replace(/[^\w.-]+/g, "_")}-${reglage}.json`);
await writeFile(sortie, JSON.stringify({ options, bilan, lignes }, null, 2));
console.log(`\nDétail : ${path.relative(process.cwd(), sortie)}`);
