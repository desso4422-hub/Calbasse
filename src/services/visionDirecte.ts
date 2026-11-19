/**
 * Reconnaissance sans serveur : le téléphone interroge RodiumAI directement.
 *
 * C'est le mode de l'APK autonome : rien à héberger, rien à payer en plus de la
 * consommation du modèle. La clé RodiumAI est collée une fois dans l'app et gardée dans le
 * coffre du téléphone ; l'APK lui-même ne la contient pas et peut donc être partagé.
 * (EXPO_PUBLIC_RODIUMAI_API_KEY permet quand même de la poser à la construction.)
 *
 * Les consignes, le catalogue et la vérification de la réponse sont ceux du serveur
 * (src/lib/vision.ts) : même qualité de reconnaissance, même refus d'inventer un aliment.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { corpsRodium, lireJson, normaliser, texteDemande, texteSysteme, validerReponse, type NiveauReflexion, type ResultatScan, type TypeImage } from '../lib/vision.ts';

export const MODELE_PAR_DEFAUT = 'google/gemini-3.1-flash-lite';

/** Clé posée à la construction de l'app (facultatif : sinon l'utilisateur la saisit une fois). */
const cleIntegree = (process.env.EXPO_PUBLIC_RODIUMAI_API_KEY ?? '').trim();
const urlApi = (process.env.EXPO_PUBLIC_RODIUMAI_URL ?? 'https://api.rodiumai.io/v1').trim().replace(/\/+$/, '');
const modele = (process.env.EXPO_PUBLIC_RODIUMAI_MODELE ?? '').trim() || MODELE_PAR_DEFAUT;
const reflexion = (process.env.EXPO_PUBLIC_RODIUMAI_REFLEXION ?? '').trim() as NiveauReflexion | '';

/** true si l'app analyse les photos elle-même, sans serveur (mode de l'APK autonome). */
export const visionDirecte = !!cleIntegree || process.env.EXPO_PUBLIC_VISION_DIRECTE === '1';

/**
 * La clé vit dans le coffre du téléphone (Keystore / Keychain), jamais dans le code :
 * l'APK peut être partagé sans la clé, et chacun colle la sienne une seule fois.
 */
const CLE_STOCKAGE = 'calbasse.cleVision';
const coffre = {
  lire: () => (Platform.OS === 'web' ? AsyncStorage.getItem(CLE_STOCKAGE) : SecureStore.getItemAsync(CLE_STOCKAGE)),
  ecrire: (v: string) => (Platform.OS === 'web' ? AsyncStorage.setItem(CLE_STOCKAGE, v) : SecureStore.setItemAsync(CLE_STOCKAGE, v)),
  effacer: () => (Platform.OS === 'web' ? AsyncStorage.removeItem(CLE_STOCKAGE) : SecureStore.deleteItemAsync(CLE_STOCKAGE)),
};
let cleMemoire: string | null = null;

/** La clé en service : celle saisie par l'utilisateur, sinon celle posée à la construction. */
export async function lireCle(): Promise<string> {
  if (cleMemoire === null) cleMemoire = (await coffre.lire().catch(() => null)) ?? '';
  return cleMemoire || cleIntegree;
}

export async function enregistrerCle(valeur: string): Promise<void> {
  const v = valeur.trim();
  cleMemoire = v;
  if (v) await coffre.ecrire(v);
  else await coffre.effacer();
}

/** Vérifie la clé sans analyser de photo (appel gratuit) et dit si le modèle est accessible. */
export async function verifierCle(valeur: string): Promise<{ ok: boolean; message: string }> {
  const v = valeur.trim();
  if (!v) return { ok: false, message: 'Colle ta clé RodiumAI.' };
  let reponse: Response;
  try {
    reponse = await fetch(`${urlApi}/models`, { headers: { Authorization: `Bearer ${v}` }, signal: AbortSignal.timeout(20_000) });
  } catch {
    return { ok: false, message: 'Pas de connexion : vérifie ton réseau et réessaie.' };
  }
  if (reponse.status === 401 || reponse.status === 403) return { ok: false, message: "Cette clé n'est pas acceptée par RodiumAI." };
  if (!reponse.ok) return { ok: false, message: `RodiumAI a répondu « erreur ${reponse.status} ». Réessaie dans un instant.` };
  const donnees = (await reponse.json().catch(() => ({}))) as { data?: { id?: string }[] };
  const modeles = (donnees.data ?? []).map((m) => m.id);
  if (modeles.length && !modeles.includes(modele)) {
    return { ok: false, message: `Cette clé n’a pas accès à ${modele}. Autorise ce modèle sur RodiumAI.` };
  }
  return { ok: true, message: 'Clé valide. Tu peux scanner.' };
}

export class ErreurVision extends Error {
  readonly passager: boolean;
  /** true : il manque la clé, l'utilisateur doit la coller dans Profil */
  readonly cleManquante: boolean;
  constructor(message: string, passager: boolean, cleManquante = false) {
    super(message);
    this.passager = passager;
    this.cleManquante = cleManquante;
  }
}

type ReponseChat = {
  choices?: { message?: { content?: string | null; refusal?: string | null }; finish_reason?: string }[];
  error?: { message?: string; code?: string } | string;
  error_code?: string;
  message?: string;
};

/** Statuts qui valent la peine de réessayer plus tard (le reste vient de la clé ou du crédit). */
const PASSAGERS = new Set([408, 409, 429, 500, 502, 503, 504]);

// La passerelle peut refuser le schéma JSON : on ne repaie pas cet échec à chaque scan.
let schemaAccepte = true;

// Même photo renvoyée (file d'attente, coupure) : on rend le résultat déjà obtenu.
const dejaVus = new Map<string, ResultatScan>();

async function appeler(cleApi: string, corps: object, delaiMs: number): Promise<{ statut: number; donnees: ReponseChat }> {
  const controle = new AbortController();
  const minuterie = setTimeout(() => controle.abort(), delaiMs);
  try {
    const reponse = await fetch(`${urlApi}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cleApi}` },
      body: JSON.stringify(corps),
      signal: controle.signal,
    });
    const donnees = (await reponse.json().catch(() => ({}))) as ReponseChat;
    return { statut: reponse.status, donnees };
  } catch {
    throw new ErreurVision(controle.signal.aborted ? 'Le réseau est trop lent.' : 'Pas de connexion.', true);
  } finally {
    clearTimeout(minuterie);
  }
}

export async function analyserPhoto(params: { image: string; typeImage?: TypeImage; indice?: string; cle?: string; delaiMs?: number }): Promise<ResultatScan> {
  const cleApi = await lireCle();
  if (!cleApi) throw new ErreurVision('Il manque ta clé de reconnaissance : va dans Profil pour la coller.', false, true);
  if (params.cle) {
    const connu = dejaVus.get(params.cle);
    if (connu) return connu;
  }
  const corps = (avecSchema: boolean) =>
    corpsRodium({
      systeme: texteSysteme(),
      texte: texteDemande(params.indice ?? ''),
      image: params.image,
      typeImage: params.typeImage ?? 'image/jpeg',
      modele,
      reflexion: reflexion || undefined,
      avecSchema,
    });

  const delaiMs = params.delaiMs ?? 45_000;
  let { statut, donnees } = await appeler(cleApi, corps(schemaAccepte), delaiMs);
  if (statut === 400 && schemaAccepte) {
    schemaAccepte = false;
    ({ statut, donnees } = await appeler(cleApi, corps(false), delaiMs));
  }
  if (statut < 200 || statut >= 300) {
    const err = typeof donnees.error === 'object' ? donnees.error : undefined;
    const message = err?.message ?? (typeof donnees.error === 'string' ? donnees.error : donnees.message) ?? `Erreur ${statut}`;
    if (statut === 401 || statut === 403) throw new ErreurVision("Ta clé de reconnaissance n'est plus acceptée : remplace-la dans Profil.", false, true);
    if (statut === 402) throw new ErreurVision('Le crédit de reconnaissance est épuisé.', false);
    throw new ErreurVision(PASSAGERS.has(statut) ? 'Service occupé. Réessaie dans un instant.' : message, PASSAGERS.has(statut));
  }

  const choix = donnees.choices?.[0];
  if (choix?.message?.refusal || choix?.finish_reason === 'content_filter') throw new ErreurVision("Cette photo n'a pas pu être analysée.", false);
  const texte = choix?.message?.content;
  if (!texte) throw new ErreurVision('Réponse vide. Réessaie.', true);
  const brut = validerReponse(lireJson(texte));
  if (!brut) throw new ErreurVision('Réponse inattendue. Réessaie.', true);

  const resultat = normaliser(brut);
  if (params.cle) {
    dejaVus.set(params.cle, resultat);
    // On ne garde que les dernières photos : la mémoire du téléphone est précieuse.
    if (dejaVus.size > 20) dejaVus.delete(dejaVus.keys().next().value as string);
  }
  return resultat;
}
