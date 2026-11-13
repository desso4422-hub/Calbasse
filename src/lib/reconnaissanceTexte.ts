/**
 * Reconnaissance à partir du seul texte (indice tapé au scanner) : sert au mode démo, sans serveur.
 * Fonctions pures, testées dans nutrition.test.ts.
 */
import { aliments, normaliser } from './aliments.ts';
import { chercherPlatParTexte, nommerRepas, trouverPlat, type LigneRepas } from './plats.ts';

export type ReconnaissanceTexte = { nom: string; lignes: LigneRepas[]; reconnu: boolean; mode: 'demo' };

export function reconnaitreDepuisTexte(indice: string): ReconnaissanceTexte {
  const plat = chercherPlatParTexte(indice);
  if (plat) return { nom: plat.nom, lignes: plat.lignes, reconnu: true, mode: 'demo' };

  // Sinon, on cherche des aliments isolés dans l'indice (« riz, sauce graine, poulet »)
  const texte = ` ${normaliser(indice)} `;
  const trouves = aliments
    .map((a) => {
      const termes = [a.nom, ...a.synonymes].map(normaliser).filter((s) => texte.includes(` ${s} `));
      const terme = termes.sort((x, y) => y.length - x.length)[0];
      return terme ? { aliment: a, terme } : null;
    })
    .filter((t): t is { aliment: (typeof aliments)[number]; terme: string } => t !== null);
  // « poulet » touche poulet frit et poulet braisé ; « riz » est contenu dans « riz au gras » :
  // on écarte un aliment dont le terme est déjà couvert par un terme plus précis ou identique.
  const uniques = trouves
    .filter((t, i) => !trouves.some((u, j) => j !== i && (u.terme.length > t.terme.length ? u.terme.includes(t.terme) : u.terme === t.terme && j < i)))
    .map((t) => t.aliment);
  if (uniques.length > 0) {
    const lignes = uniques.map((a) => ({ alimentId: a.id, grammes: a.uniteG }));
    return { nom: nommerRepas(uniques.map((a) => a.nom)), lignes, reconnu: true, mode: 'demo' };
  }
  // Mode démo sans indice : on montre un plat d'exemple (l'écran Résultat signale le mode démo)
  const exemple = trouverPlat('riz-gras-poulet')!;
  return { nom: exemple.nom, lignes: exemple.lignes, reconnu: true, mode: 'demo' };
}
