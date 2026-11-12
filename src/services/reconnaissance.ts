/**
 * Reconnaissance d'un repas à partir d'une photo (et d'un indice texte facultatif).
 *
 * - Serveur : si EXPO_PUBLIC_API_URL est défini, la photo (réduite à 1568 px) est envoyée à
 *   POST {API}/scan. Le serveur (dossier server/) interroge le modèle de vision et ne répond
 *   qu'avec des aliments de la base. La clé du modèle reste sur le serveur, jamais dans l'app.
 * - Démo : sans serveur, on s'appuie sur l'indice texte, sinon on propose un plat d'exemple.
 */
import { alimentExiste, aliments, normaliser, trouverAliment } from '../lib/aliments.ts';
import { chercherPlatParTexte, nommerRepas, trouverPlat, type Confiance, type LigneRepas } from '../lib/plats.ts';

export type ResultatReconnaissance = {
  nom: string;
  lignes: LigneRepas[];
  /** false si on n'a rien pu reconnaître : l'utilisateur doit vérifier */
  reconnu: boolean;
  mode: 'serveur' | 'demo';
  /** Identifiant du scan côté serveur, pour remonter les corrections */
  scanId?: string;
  /** La photo ne montre pas de nourriture */
  pasUnRepas?: boolean;
  /** Aliments vus mais absents de la base */
  inconnus?: { description: string; grammes: number }[];
  remarque?: string;
};

export class ErreurReconnaissance extends Error {}

const API = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '');

export const modeReconnaissance: 'serveur' | 'demo' = API ? 'serveur' : 'demo';

export async function reconnaitreRepas(params: { photoBase64?: string; indice?: string }): Promise<ResultatReconnaissance> {
  if (API && params.photoBase64) return reconnaitreSurServeur(API, params.photoBase64, params.indice ?? '');
  await new Promise((r) => setTimeout(r, 900));
  return reconnaitreDepuisTexte(params.indice ?? '');
}

type ReponseServeur = {
  scanId: string;
  estUnRepas: boolean;
  nom: string;
  lignes: { alimentId: string; grammes: number; confiance: Confiance; alternatives: string[] }[];
  inconnus: { description: string; grammes: number }[];
  remarque: string;
};

async function reconnaitreSurServeur(api: string, image: string, indice: string): Promise<ResultatReconnaissance> {
  const controle = new AbortController();
  const minuterie = setTimeout(() => controle.abort(), 60_000);
  let reponse: Response;
  try {
    reponse = await fetch(`${api}/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image, typeImage: 'image/jpeg', indice }),
      signal: controle.signal,
    });
  } catch {
    throw new ErreurReconnaissance('Pas de connexion au serveur. Vérifie ton réseau et réessaie.');
  } finally {
    clearTimeout(minuterie);
  }
  const donnees = (await reponse.json().catch(() => ({}))) as Partial<ReponseServeur> & { erreur?: string };
  if (!reponse.ok) throw new ErreurReconnaissance(donnees.erreur ?? `Analyse impossible (${reponse.status}).`);

  // On ne garde que des aliments que l'app connaît (le serveur peut être plus récent que l'app).
  const lignes: LigneRepas[] = (donnees.lignes ?? [])
    .filter((l) => alimentExiste(l.alimentId) && l.grammes > 0)
    .map((l) => ({ alimentId: l.alimentId, grammes: l.grammes, confiance: l.confiance, alternatives: (l.alternatives ?? []).filter(alimentExiste) }));
  const base = { mode: 'serveur' as const, scanId: donnees.scanId, inconnus: donnees.inconnus ?? [], remarque: donnees.remarque ?? '' };

  if (donnees.estUnRepas === false) return { ...base, nom: 'Pas de repas reconnu', lignes: [], reconnu: false, pasUnRepas: true };
  if (lignes.length === 0) return { ...base, nom: donnees.nom || 'Plat à préciser', lignes: [], reconnu: false };
  return { ...base, nom: donnees.nom || nommerRepas(lignes.map((l) => trouverAliment(l.alimentId).nom)), lignes, reconnu: true };
}

/** Remonte au serveur ce que l'utilisateur a corrigé : c'est ce qui permet d'améliorer la reconnaissance. */
export function envoyerCorrection(scanId: string, proposees: LigneRepas[], finales: LigneRepas[]) {
  if (!API) return;
  const resume = (ls: LigneRepas[]) => ls.map((l) => ({ alimentId: l.alimentId, grammes: Math.round(l.grammes) }));
  const a = resume(proposees);
  const b = resume(finales);
  if (JSON.stringify(a) === JSON.stringify(b)) return;
  fetch(`${API}/corrections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scanId, proposees: a, finales: b }),
  }).catch(() => {});
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
