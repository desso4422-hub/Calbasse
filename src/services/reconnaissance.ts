/**
 * Reconnaissance d'un repas à partir d'une photo (et d'un indice texte facultatif).
 *
 * Deux modes :
 * - Serveur : si EXPO_PUBLIC_SCAN_API_URL est défini, la photo est envoyée à ce point d'accès
 *   (qui appelle un modèle de vision et renvoie les aliments reconnus, voir README).
 *   La clé du modèle reste sur le serveur, jamais dans l'app.
 * - Démo : sans serveur, on s'appuie sur l'indice texte, sinon on propose un plat d'exemple.
 */
import { alimentExiste, aliments, normaliser, trouverAliment } from '../lib/aliments.ts';
import { chercherPlatParTexte, nommerRepas, trouverPlat, type LigneRepas } from '../lib/plats.ts';

export type ResultatReconnaissance = {
  nom: string;
  lignes: LigneRepas[];
  /** false si on n'a rien pu reconnaître : l'utilisateur doit vérifier */
  reconnu: boolean;
  mode: 'serveur' | 'demo';
};

const URL_SCAN = process.env.EXPO_PUBLIC_SCAN_API_URL;

export const modeReconnaissance: 'serveur' | 'demo' = URL_SCAN ? 'serveur' : 'demo';

export async function reconnaitreRepas(params: {
  photoBase64?: string;
  indice?: string;
}): Promise<ResultatReconnaissance> {
  if (URL_SCAN && params.photoBase64) {
    return reconnaitreSurServeur(URL_SCAN, params.photoBase64, params.indice);
  }
  await new Promise((r) => setTimeout(r, 900));
  return reconnaitreDepuisTexte(params.indice ?? '');
}

/** Format attendu du serveur : { nom?: string, lignes: { alimentId: string, grammes: number }[] } */
async function reconnaitreSurServeur(url: string, photoBase64: string, indice?: string): Promise<ResultatReconnaissance> {
  const reponse = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: photoBase64, indice: indice ?? '', alimentsConnus: aliments.map((a) => a.id) }),
  });
  if (!reponse.ok) throw new Error(`Le serveur de reconnaissance a répondu ${reponse.status}`);
  const donnees = (await reponse.json()) as { nom?: string; lignes?: LigneRepas[] };
  const lignes = (donnees.lignes ?? []).filter((l) => alimentExiste(l.alimentId) && l.grammes > 0);
  if (lignes.length === 0) return { nom: 'Plat non reconnu', lignes: [], reconnu: false, mode: 'serveur' };
  return {
    nom: donnees.nom || nommerRepas(lignes.map((l) => trouverAliment(l.alimentId).nom)),
    lignes,
    reconnu: true,
    mode: 'serveur',
  };
}

export function reconnaitreDepuisTexte(indice: string): ResultatReconnaissance {
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
