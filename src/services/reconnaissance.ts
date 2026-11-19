/**
 * Reconnaissance d'un repas à partir d'une photo (et d'un indice texte facultatif).
 *
 * Trois modes, dans cet ordre :
 * - Serveur : si EXPO_PUBLIC_API_URL est défini, la photo (réduite à 1568 px) est envoyée à
 *   POST {API}/scan. Le serveur (dossier server/) vérifie le quota du compte, interroge le modèle
 *   de vision et ne répond qu'avec des aliments de la base. La clé du modèle reste sur le serveur.
 * - Direct : si l'app embarque une clé (EXPO_PUBLIC_RODIUMAI_API_KEY), elle interroge le modèle
 *   elle-même, sans serveur ni compte. C'est le mode de l'APK autonome (voir visionDirecte.ts).
 * - Démo : sans l'un ni l'autre, on s'appuie sur l'indice texte, sinon on propose un plat d'exemple.
 */
import { alimentExiste, trouverAliment } from '../lib/aliments.ts';
import { reconnaitreDepuisTexte } from '../lib/reconnaissanceTexte.ts';
import { appelApi, ErreurApi, serveurConfigure, type EtatCompteServeur } from './api';
import { analyserPhoto, ErreurVision, visionDirecte } from './visionDirecte';
import type { ResultatScan } from '../lib/vision.ts';
import { nommerRepas, type Confiance, type LigneRepas } from '../lib/plats.ts';

export { reconnaitreDepuisTexte };

export type ResultatReconnaissance = {
  nom: string;
  lignes: LigneRepas[];
  /** false si on n'a rien pu reconnaître : l'utilisateur doit vérifier */
  reconnu: boolean;
  mode: 'serveur' | 'direct' | 'demo';
  /** Identifiant du scan côté serveur, pour remonter les corrections */
  scanId?: string;
  /** La photo ne montre pas de nourriture */
  pasUnRepas?: boolean;
  /** Aliments vus mais absents de la base */
  inconnus?: { description: string; grammes: number }[];
  remarque?: string;
  /** État du compte après ce scan (scans restants, Premium), renvoyé par le serveur */
  compte?: EtatCompteServeur;
};

export class ErreurReconnaissance extends Error {}

/** Problème passager (réseau coupé ou lent, serveur occupé) : on pourra réessayer plus tard. */
export class ErreurReseau extends ErreurReconnaissance {}

/** Il manque la clé de reconnaissance (mode sans serveur) : l'utilisateur doit la coller. */
export class ErreurCleVision extends ErreurReconnaissance {}

/** Plus de scans aujourd'hui (le serveur fait foi) */
export class ErreurQuota extends ErreurReconnaissance {
  readonly compte?: EtatCompteServeur;
  constructor(message: string, compte?: EtatCompteServeur) {
    super(message);
    this.compte = compte;
  }
}

export const modeReconnaissance: 'serveur' | 'direct' | 'demo' = serveurConfigure ? 'serveur' : visionDirecte ? 'direct' : 'demo';

/** true quand une vraie analyse de photo est possible (serveur ou modèle embarqué). */
export const reconnaissanceActive = modeReconnaissance !== 'demo';

export async function reconnaitreRepas(params: { photoBase64?: string; indice?: string; cle?: string }): Promise<ResultatReconnaissance> {
  if (serveurConfigure && params.photoBase64) return reconnaitreSurServeur(params.photoBase64, params.indice ?? '', params.cle);
  if (visionDirecte && params.photoBase64) return reconnaitreSurAppareil(params.photoBase64, params.indice ?? '', params.cle);
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
  compte?: EtatCompteServeur;
};

/** Statuts qui valent la peine de réessayer plus tard */
const PASSAGERS = new Set([0, 408, 429, 500, 502, 503, 504]);

async function reconnaitreSurServeur(image: string, indice: string, cle?: string): Promise<ResultatReconnaissance> {
  let donnees: Partial<ReponseServeur>;
  try {
    // La clé identifie la photo : si on la renvoie après une coupure, le serveur rend le même
    // résultat sans nouvelle analyse ni nouveau décompte.
    donnees = (await appelApi('/scan', { methode: 'POST', corps: { cle, image, typeImage: 'image/jpeg', indice }, delaiMs: 45_000 })) as Partial<ReponseServeur>;
  } catch (e) {
    if (e instanceof ErreurApi && e.code === 'quota') {
      const { premium, scansRestants, limite } = e.donnees as Partial<EtatCompteServeur>;
      const { telephone } = e.donnees as Partial<EtatCompteServeur>;
      throw new ErreurQuota(e.message, limite !== undefined ? { premium: premium ?? null, scansRestants: scansRestants ?? 0, limite, telephone: telephone ?? null } : undefined);
    }
    if (e instanceof ErreurApi && PASSAGERS.has(e.statut)) throw new ErreurReseau(e.message);
    throw new ErreurReconnaissance(e instanceof ErreurApi ? e.message : 'Analyse impossible. Réessaie.');
  }

  // Le serveur peut être plus récent que l'app : versResultat écarte ce qu'elle ne connaît pas.
  return { ...versResultat({ ...donnees, lignes: donnees.lignes ?? [], nom: donnees.nom ?? '', estUnRepas: donnees.estUnRepas !== false, inconnus: donnees.inconnus ?? [], remarque: donnees.remarque ?? '' }, 'serveur', donnees.scanId), compte: donnees.compte };
}

/** Analyse faite par l'app elle-même : pas de compte, pas de quota, pas de serveur. */
async function reconnaitreSurAppareil(image: string, indice: string, cle?: string): Promise<ResultatReconnaissance> {
  let scan: ResultatScan;
  try {
    scan = await analyserPhoto({ image, indice, cle });
  } catch (e) {
    if (e instanceof ErreurVision && e.passager) throw new ErreurReseau(e.message);
    if (e instanceof ErreurVision && e.cleManquante) throw new ErreurCleVision(e.message);
    throw new ErreurReconnaissance(e instanceof Error ? e.message : 'Analyse impossible. Réessaie.');
  }
  return versResultat(scan, 'direct');
}

/** Même mise en forme pour les deux modes : on ne garde que des aliments que l'app connaît. */
function versResultat(scan: Pick<ResultatScan, 'estUnRepas' | 'nom' | 'lignes' | 'inconnus' | 'remarque'>, mode: 'serveur' | 'direct', scanId?: string): ResultatReconnaissance {
  const lignes: LigneRepas[] = (scan.lignes ?? [])
    .filter((l) => alimentExiste(l.alimentId) && l.grammes > 0)
    .map((l) => ({ alimentId: l.alimentId, grammes: l.grammes, confiance: l.confiance as Confiance, alternatives: (l.alternatives ?? []).filter(alimentExiste) }));
  const base = { mode, scanId, inconnus: scan.inconnus ?? [], remarque: scan.remarque ?? '' };
  if (scan.estUnRepas === false) return { ...base, nom: 'Pas de repas reconnu', lignes: [], reconnu: false, pasUnRepas: true };
  if (lignes.length === 0) return { ...base, nom: scan.nom || 'Plat à préciser', lignes: [], reconnu: false };
  return { ...base, nom: scan.nom || nommerRepas(lignes.map((l) => trouverAliment(l.alimentId).nom)), lignes, reconnu: true };
}

/** Remonte au serveur ce que l'utilisateur a corrigé : c'est ce qui permet d'améliorer la reconnaissance. */
export function envoyerCorrection(scanId: string, proposees: LigneRepas[], finales: LigneRepas[]) {
  if (!serveurConfigure) return;
  const resume = (ls: LigneRepas[]) => ls.map((l) => ({ alimentId: l.alimentId, grammes: Math.round(l.grammes) }));
  const a = resume(proposees);
  const b = resume(finales);
  if (JSON.stringify(a) === JSON.stringify(b)) return;
  appelApi('/corrections', { methode: 'POST', corps: { scanId, proposees: a, finales: b } }).catch(() => {});
}
