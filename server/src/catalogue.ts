/**
 * Le catalogue envoyé au modèle de vision, construit à partir de la base de l'app
 * (src/lib/aliments.ts et src/lib/plats.ts) : une seule source de vérité.
 *
 * Le texte produit est stable (même ordre, pas de date) pour profiter du cache de prompt.
 */
import { aliments, categories } from '../../src/lib/aliments.ts';
import { platsComposes } from '../../src/lib/plats.ts';

export const idsAliments = aliments.map((a) => a.id) as [string, ...string[]];

function nomCategorie(id: string): string {
  return categories.find((c) => c.id === id)?.nom ?? id;
}

export function texteCatalogue(): string {
  const parCategorie = new Map<string, string[]>();
  for (const a of aliments) {
    const lignes = parCategorie.get(a.categorie) ?? [];
    lignes.push(
      `- ${a.id} — ${a.nom}` +
        (a.synonymes.length ? ` (aussi : ${a.synonymes.join(', ')})` : '') +
        `\n  Aspect : ${a.description}` +
        `\n  Mesure habituelle : ${a.unite} ≈ ${a.uniteG} g${a.uniteNote ? ` ${a.uniteNote}` : ''}`,
    );
    parCategorie.set(a.categorie, lignes);
  }
  const sections = [...parCategorie.entries()].map(([cat, lignes]) => `### ${nomCategorie(cat)}\n${lignes.join('\n')}`);

  const plats = platsComposes
    .map((p) => `- ${p.nom} : ${p.lignes.map((l) => `${l.alimentId} ${l.grammes} g`).join(' + ')}`)
    .join('\n');

  return `## Aliments connus (choisis uniquement parmi ces identifiants)\n\n${sections.join('\n\n')}\n\n## Plats courants et grammages d'une portion moyenne\n\n${plats}`;
}
