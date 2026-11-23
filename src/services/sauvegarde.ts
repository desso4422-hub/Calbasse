/**
 * Compte avec e-mail et sauvegarde en ligne du profil et des repas.
 *
 * Ce module garde, sur le téléphone, de quoi savoir où on en est avec le serveur (adresse e-mail du compte, dernière
 * révision connue, signature de ce qui a été envoyé) et fait les échanges avec la fonction « api » (/sauvegarde).
 * La décision de quand synchroniser est dans state/sauvegarde.ts ; la logique de fusion dans lib/sauvegarde.ts.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { decider, empreinteDonnees, extraire, fusionner, lireDonnees, type Donnees } from '../lib/sauvegarde.ts';
import { appelApi, ErreurApi, lireCompte, serveurConfigure, type EtatCompteServeur } from './api';
import { confirmerConnexion, confirmerLiaison, demanderCodeConnexion, demanderLiaison, oublierSession } from './supabase';

export { demanderCodeConnexion, demanderLiaison };

const CLE_META = 'calbasse.compte.v1';

export type MetaCompte = {
  email: string;
  /** Dernière révision de la sauvegarde connue de ce téléphone */
  revision: number;
  /** Signature de ce qui a été envoyé en dernier (tout le contenu, puis le profil seul) */
  empreinte: string;
  empreinteProfil: string;
  /** Date de la dernière synchronisation réussie (ISO) */
  derniere: string | null;
  /** 'reconnexion' : le serveur ne reconnaît plus ce compte sur ce téléphone */
  statut: 'ok' | 'reconnexion';
};

let meta: MetaCompte | null = null;
let chargee = false;
const ecouteurs = new Set<(m: MetaCompte | null) => void>();

export async function lireMeta(): Promise<MetaCompte | null> {
  if (!chargee) {
    try {
      const brut = await AsyncStorage.getItem(CLE_META);
      const m = brut ? (JSON.parse(brut) as MetaCompte) : null;
      meta = m && typeof m.email === 'string' && typeof m.revision === 'number' ? m : null;
    } catch {
      meta = null;
    }
    chargee = true;
  }
  return meta;
}

async function poserMeta(m: MetaCompte | null): Promise<void> {
  meta = m;
  chargee = true;
  if (m) await AsyncStorage.setItem(CLE_META, JSON.stringify(m)).catch(() => {});
  else await AsyncStorage.removeItem(CLE_META).catch(() => {});
  ecouteurs.forEach((f) => f(m));
}

export function ecouterMeta(f: (m: MetaCompte | null) => void): () => void {
  ecouteurs.add(f);
  return () => ecouteurs.delete(f);
}

/** À appeler quand le compte en ligne est supprimé : plus rien à synchroniser. */
export const oublierMeta = () => poserMeta(null);

type ReponseSauvegarde = { revision: number; donnees: unknown; misAJour: string | null };
const lireServeur = async () => (await appelApi('/sauvegarde')) as unknown as ReponseSauvegarde;

/** Ce que fait un envoi : succès (révision nouvelle) ou conflit (un autre téléphone est passé avant). */
async function envoyer(donnees: Donnees, base: number): Promise<{ ok: true; revision: number } | { ok: false }> {
  try {
    const r = await appelApi('/sauvegarde', { methode: 'PUT', corps: { donnees, base }, delaiMs: 60_000 });
    return { ok: true, revision: r.revision as number };
  } catch (e) {
    if (e instanceof ErreurApi && e.statut === 409) return { ok: false };
    throw e;
  }
}

export type EtatLocal = { profil: Donnees['profil']; repas: Donnees['repas'] };
export type Sortie = { donnees: Donnees | null; cree?: boolean };

/**
 * Synchronise ce téléphone avec la sauvegarde en ligne. Renvoie les données à appliquer localement si la fusion en a
 * produit de nouvelles (un autre téléphone a ajouté des repas), sinon null.
 */
export async function synchroniser(local: EtatLocal): Promise<Donnees | null> {
  const m = await lireMeta();
  if (!m || !serveurConfigure) return null;
  let courant: Donnees = extraire(local);
  let aAppliquer: Donnees | null = null;
  try {
    for (let essai = 0; essai < 3; essai++) {
      const serveur = await lireServeur();
      const empLocal = empreinteDonnees(courant);
      const decision = decider({ revisionServeur: serveur.revision, revisionConnue: m.revision, localChange: empLocal !== m.empreinte });
      if (decision === 'rien') {
        await poserMeta({ ...m, statut: 'ok', derniere: new Date().toISOString() });
        return aAppliquer;
      }
      const base = serveur.revision;
      if (decision === 'fusionner') {
        const distant = lireDonnees(serveur.donnees);
        if (distant) {
          // Le profil d'un autre téléphone gagne seulement si celui-ci n'a pas touché au sien depuis la dernière fois
          const profilInchange = empreinteDonnees({ v: 1, profil: courant.profil, repas: [] }) === m.empreinteProfil;
          courant = fusionner(courant, distant, profilInchange);
          aAppliquer = courant;
        }
      }
      const r = await envoyer(courant, base);
      if (r.ok) {
        const emp = empreinteDonnees(courant);
        const profil = empreinteDonnees({ v: 1, profil: courant.profil, repas: [] });
        Object.assign(m, { revision: r.revision, empreinte: emp, empreinteProfil: profil, derniere: new Date().toISOString(), statut: 'ok' });
        await poserMeta({ ...m });
        return aAppliquer;
      }
      // Conflit : un autre téléphone vient d'écrire. Au tour suivant on relit, on fusionne et on renvoie.
    }
  } catch (e) {
    if (e instanceof ErreurApi && e.statut === 403 && e.code === 'sans_email') {
      await poserMeta({ ...m, statut: 'reconnexion' });
    }
    // Hors ligne ou panne : on réessaiera au prochain changement
  }
  return aAppliquer;
}

async function apresConnexion(email: string, local: EtatLocal, restaurer: boolean): Promise<{ donnees: Donnees | null; compte: EtatCompteServeur | null; sauvegardeTrouvee: boolean }> {
  await poserMeta({ email, revision: 0, empreinte: '', empreinteProfil: '', derniere: null, statut: 'ok' });
  let courant: Donnees = extraire(local);
  let trouvee = false;
  let aAppliquer: Donnees | null = null;
  const serveur = await lireServeur().catch(() => null);
  if (serveur) {
    const distant = restaurer ? lireDonnees(serveur.donnees) : null;
    if (distant) {
      trouvee = true;
      courant = fusionner(courant, distant, true);
      aAppliquer = courant;
    }
    // Révision connue = celle du serveur : le prochain envoi (fait par synchroniser) repart de là
    const m = (await lireMeta())!;
    await poserMeta({ ...m, revision: serveur.revision, empreinte: distant ? empreinteDonnees(distant) : '', empreinteProfil: distant ? empreinteDonnees({ v: 1, profil: distant.profil, repas: [] }) : '' });
  }
  const modifie = await synchroniser({ profil: courant.profil, repas: courant.repas });
  const compte = await lireCompte().catch(() => null);
  return { donnees: modifie ?? aAppliquer, compte, sauvegardeTrouvee: trouvee };
}

/** Rattache l'e-mail confirmé au compte de ce téléphone, puis sauvegarde tout. */
export async function lierEmail(email: string, code: string, local: EtatLocal) {
  await confirmerLiaison(email, code);
  return apresConnexion(email.trim(), local, false);
}

/**
 * Se connecter à un compte existant sur ce téléphone et en récupérer les données (profil, repas, forfait).
 * Le compte anonyme créé au premier lancement reste inutilisé côté serveur : il ne contient rien.
 */
export async function seConnecter(email: string, code: string, local: EtatLocal) {
  await confirmerConnexion(email, code);
  return apresConnexion(email.trim(), local, true);
}

/** Envoie une dernière sauvegarde puis oublie ce compte sur ce téléphone (téléphone prêté, vendu…). */
export async function seDeconnecter(local: EtatLocal): Promise<boolean> {
  const m = await lireMeta();
  if (m) {
    await synchroniser(local);
    const apres = await lireMeta();
    const emp = empreinteDonnees(extraire(local));
    // On ne coupe pas si les données de ce téléphone n'ont pas pu partir : elles seraient perdues
    if (apres && apres.empreinte !== emp && apres.statut === 'ok') return false;
  }
  await poserMeta(null);
  await oublierSession();
  return true;
}
