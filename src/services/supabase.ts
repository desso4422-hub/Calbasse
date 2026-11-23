/**
 * Connexion anonyme à Supabase.
 *
 * Au premier appel, l'app crée un compte anonyme (aucune donnée personnelle demandée) et garde la session dans
 * le coffre du téléphone. Le jeton d'accès est renouvelé tout seul. La clé publique (EXPO_PUBLIC_SUPABASE_ANON_KEY)
 * n'ouvre rien à elle seule : les tables sont verrouillées, tout passe par la fonction « api ».
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { adresseApi, expireBientot, sessionDepuisReponse, sessionStockee, type Session } from '../lib/session.ts';

const URL_PROJET = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim().replace(/\/+$/, '');
const CLE_PUBLIQUE = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();

export const supabaseConfigure = !!URL_PROJET && !!CLE_PUBLIQUE;
export const adresseApiSupabase = supabaseConfigure ? adresseApi(URL_PROJET) : undefined;
export const cleSupabase = CLE_PUBLIQUE;

/** Problème de connexion : statut 0 = pas de réseau (passager), sinon réponse du service d'authentification. */
export class ErreurAuth extends Error {
  readonly statut: number;
  constructor(message: string, statut: number) {
    super(message);
    this.statut = statut;
  }
}

const CLE_SESSION = 'calbasse.session';
const coffre = {
  lire: () => (Platform.OS === 'web' ? AsyncStorage.getItem(CLE_SESSION) : SecureStore.getItemAsync(CLE_SESSION)),
  ecrire: (v: string) => (Platform.OS === 'web' ? AsyncStorage.setItem(CLE_SESSION, v) : SecureStore.setItemAsync(CLE_SESSION, v)),
  effacer: () => (Platform.OS === 'web' ? AsyncStorage.removeItem(CLE_SESSION) : SecureStore.deleteItemAsync(CLE_SESSION)),
};

let session: Session | null = null;
let enCours: Promise<string> | null = null;

async function appelAuth(chemin: string, corps: object): Promise<{ statut: number; donnees: unknown }> {
  const controle = new AbortController();
  const minuterie = setTimeout(() => controle.abort(), 20_000);
  try {
    const reponse = await fetch(`${URL_PROJET}/auth/v1${chemin}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: CLE_PUBLIQUE },
      body: JSON.stringify(corps),
      signal: controle.signal,
    });
    return { statut: reponse.status, donnees: await reponse.json().catch(() => null) };
  } catch {
    throw new ErreurAuth(controle.signal.aborted ? 'Le réseau est trop lent.' : 'Pas de connexion.', 0);
  } finally {
    clearTimeout(minuterie);
  }
}

async function creerSession(): Promise<Session> {
  const { statut, donnees } = await appelAuth('/signup', { data: {} });
  const s = statut >= 200 && statut < 300 ? sessionDepuisReponse(donnees, Date.now()) : null;
  if (s) return s;
  if (statut === 429) throw new ErreurAuth('Trop de demandes. Réessaie dans quelques minutes.', 429);
  // 422 « anonymous_provider_disabled » : les comptes anonymes ne sont pas activés dans Supabase
  throw new ErreurAuth('Création du compte impossible pour le moment.', statut >= 400 ? 503 : 502);
}

async function renouveler(s: Session): Promise<Session | null> {
  const { statut, donnees } = await appelAuth('/token?grant_type=refresh_token', { refresh_token: s.refresh });
  return statut >= 200 && statut < 300 ? sessionDepuisReponse(donnees, Date.now()) : null;
}

/** Un jeton valide, en créant ou en renouvelant la session si besoin. Un seul appel à la fois. */
export function jetonSupabase(): Promise<string> {
  enCours ??= (async () => {
    session ??= sessionStockee(await coffre.lire().catch(() => null));
    if (session && !expireBientot(session, Date.now())) return session.acces;
    if (session) {
      // Si le réseau manque, l'erreur remonte et la session est gardée : on réessaiera plus tard
      session = await renouveler(session);
    }
    session ??= await creerSession();
    await coffre.ecrire(JSON.stringify(session)).catch(() => {});
    return session.acces;
  })().finally(() => {
    enCours = null;
  });
  return enCours;
}

/** Oublie la session de ce téléphone (après la suppression du compte, ou si le serveur ne la reconnaît plus). */
export async function oublierSession(): Promise<void> {
  session = null;
  await coffre.effacer().catch(() => {});
}
