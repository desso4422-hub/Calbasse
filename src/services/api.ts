/**
 * Accès au serveur Calbasse (EXPO_PUBLIC_API_URL).
 *
 * Au premier appel, l'app crée un compte anonyme et garde son jeton dans le stockage sécurisé
 * du téléphone (Keychain / Keystore). Le serveur s'en sert pour compter les scans et
 * rattacher l'abonnement Premium.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { adresseApiSupabase, cleSupabase, ErreurAuth, jetonSupabase, oublierSession, supabaseConfigure } from './supabase';

/**
 * Adresse du serveur. Si Supabase est configuré (EXPO_PUBLIC_SUPABASE_URL et _ANON_KEY), c'est sa fonction « api ».
 * Sinon EXPO_PUBLIC_API_URL. « auto » (développement) : le serveur tourne sur le même ordinateur que
 * `npx expo start`, sur le port 8787 ; l'app retrouve l'adresse de cet ordinateur toute seule.
 */
function adresseServeur(): string | undefined {
  if (adresseApiSupabase) return adresseApiSupabase;
  const brut = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (brut !== 'auto') return brut ? brut.replace(/\/+$/, '') : undefined;
  const hote = Constants.expoConfig?.hostUri?.split(':')[0] ?? (typeof window !== 'undefined' ? window.location?.hostname : undefined);
  return hote ? `http://${hote}:8787` : undefined;
}

export const API = adresseServeur();
export const serveurConfigure = !!API;

const CLE_JETON = 'calbasse.jeton';

/** État du compte tel que le serveur le renvoie */
export type EtatCompteServeur = {
  premium: { plan: 'mensuel' | 'annuel'; jusquau: string } | null;
  scansRestants: number;
  limite: number;
  /** Numéro vérifié, masqué (« +22901••••3456 »), ou null */
  telephone: string | null;
};

export class ErreurApi extends Error {
  readonly statut: number;
  readonly code?: string;
  readonly donnees: Record<string, unknown>;
  constructor(message: string, statut: number, donnees: Record<string, unknown>) {
    super(message);
    this.statut = statut;
    this.code = typeof donnees.code === 'string' ? donnees.code : undefined;
    this.donnees = donnees;
  }
}

// Le stockage sécurisé n'existe pas sur le web : on y garde le jeton dans AsyncStorage.
const stockage = {
  lire: () => (Platform.OS === 'web' ? AsyncStorage.getItem(CLE_JETON) : SecureStore.getItemAsync(CLE_JETON)),
  ecrire: (v: string) => (Platform.OS === 'web' ? AsyncStorage.setItem(CLE_JETON, v) : SecureStore.setItemAsync(CLE_JETON, v)),
  effacer: () => (Platform.OS === 'web' ? AsyncStorage.removeItem(CLE_JETON) : SecureStore.deleteItemAsync(CLE_JETON)),
};

let jetonEnCours: Promise<string> | null = null;

async function creerCompte(): Promise<string> {
  const donnees = await requete('/comptes', { methode: 'POST', corps: {} });
  const jeton = donnees.jeton as string;
  await stockage.ecrire(jeton);
  return jeton;
}

async function jeton(): Promise<string> {
  if (supabaseConfigure) {
    try {
      return await jetonSupabase();
    } catch (e) {
      if (e instanceof ErreurAuth) throw new ErreurApi(e.message, e.statut, {});
      throw e;
    }
  }
  // Un seul compte créé même si plusieurs appels partent en même temps
  jetonEnCours ??= (async () => (await stockage.lire()) ?? (await creerCompte()))().finally(() => {
    jetonEnCours = null;
  });
  return jetonEnCours;
}

async function requete(
  chemin: string,
  init: { methode?: string; corps?: unknown; jeton?: string; delaiMs?: number },
): Promise<Record<string, unknown>> {
  if (!API) throw new ErreurApi('Serveur non configuré.', 0, {});
  const controle = new AbortController();
  const minuterie = setTimeout(() => controle.abort(), init.delaiMs ?? 30_000);
  let reponse: Response;
  try {
    reponse = await fetch(API + chemin, {
      method: init.methode ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(init.jeton ? { Authorization: `Bearer ${init.jeton}` } : {}),
        ...(supabaseConfigure ? { apikey: cleSupabase } : {}),
      },
      body: init.corps === undefined ? undefined : JSON.stringify(init.corps),
      signal: controle.signal,
    });
  } catch {
    throw new ErreurApi(controle.signal.aborted ? 'Le réseau est trop lent.' : 'Pas de connexion au serveur.', 0, {});
  } finally {
    clearTimeout(minuterie);
  }
  const donnees = (await reponse.json().catch(() => ({}))) as Record<string, unknown>;
  if (!reponse.ok) throw new ErreurApi(typeof donnees.erreur === 'string' ? donnees.erreur : `Erreur ${reponse.status}`, reponse.status, donnees);
  return donnees;
}

/** Appel authentifié. Si le serveur ne reconnaît plus le jeton, l'app recrée un compte une fois. */
export async function appelApi(chemin: string, init: { methode?: string; corps?: unknown; delaiMs?: number } = {}): Promise<Record<string, unknown>> {
  try {
    return await requete(chemin, { ...init, jeton: await jeton() });
  } catch (e) {
    if (e instanceof ErreurApi && e.statut === 401) {
      await stockage.effacer();
      await oublierSession();
      return requete(chemin, { ...init, jeton: await jeton() });
    }
    throw e;
  }
}

export async function lireCompte(): Promise<EtatCompteServeur> {
  return (await appelApi('/compte')) as unknown as EtatCompteServeur;
}

/** Après une récupération de compte, l'appareil prend le jeton de l'ancien compte. */
export async function remplacerJeton(nouveau: string): Promise<void> {
  await stockage.ecrire(nouveau);
}

/** Supprime le compte en ligne et tout ce qui s'y rattache (scans, corrections, signalements). */
export async function supprimerCompteServeur(): Promise<void> {
  if (!serveurConfigure) return;
  await appelApi('/compte', { methode: 'DELETE' });
  await stockage.effacer().catch(() => {});
  await oublierSession();
}

/** « Un chiffre me semble faux » : remonte au nutritionniste. Sans réseau, on laisse tomber : le signalement local reste. */
export function envoyerSignalement(s: { jour: string; alimentId: string; repasNom: string }) {
  if (!serveurConfigure) return;
  appelApi('/signalements', { methode: 'POST', corps: s }).catch(() => {});
}
