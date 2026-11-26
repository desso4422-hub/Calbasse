/**
 * Paiement de l'abonnement Premium (Mobile Money ou carte, via CinetPay).
 *
 * Avec un serveur (EXPO_PUBLIC_API_URL) : le serveur crée la transaction CinetPay (il est seul à
 * détenir la clé), l'app ouvre la page de paiement, puis demande le statut au serveur, qui le
 * vérifie auprès de CinetPay avant d'activer Premium.
 *
 * Sans serveur, on est en mode démo : l'abonnement s'active localement, sans paiement réel.
 */
import * as WebBrowser from 'expo-web-browser';
import { ajouterJours, cleJour } from '../lib/nutrition.ts';
import type { Abonnement } from '../state/store';
import { formaterCode } from '../lib/code.ts';
import { appelApi, ErreurApi, serveurConfigure, type EtatCompteServeur } from './api';

export const tarifs = {
  mensuel: { prix: 1500, jours: 30 },
  annuel: { prix: 12000, jours: 365 },
} as const;

export const modePaiement: 'serveur' | 'demo' = serveurConfigure ? 'serveur' : 'demo';

export class ErreurPaiement extends Error {}

export type IssuePaiement =
  | { statut: 'active'; abonnement: Abonnement }
  /** Page de paiement ouverte : il faut ensuite suivre la transaction avec suivrePaiement() */
  | { statut: 'enAttente'; transactionId: string };

export async function demarrerPaiement(plan: Abonnement['plan']): Promise<IssuePaiement> {
  if (!serveurConfigure) {
    await new Promise((r) => setTimeout(r, 700));
    return { statut: 'active', abonnement: { plan, jusquau: cleJour(ajouterJours(new Date(), tarifs[plan].jours)) } };
  }
  let transactionId: string;
  let urlPaiement: string;
  try {
    const r = await appelApi('/paiements', { methode: 'POST', corps: { plan } });
    transactionId = r.transactionId as string;
    urlPaiement = r.urlPaiement as string;
  } catch (e) {
    throw new ErreurPaiement(e instanceof ErreurApi ? e.message : 'Le paiement n’a pas pu démarrer.');
  }
  // Page CinetPay dans un navigateur intégré : l'utilisateur y choisit Mobile Money ou carte.
  await WebBrowser.openBrowserAsync(urlPaiement).catch(() => {});
  return { statut: 'enAttente', transactionId };
}

export type SuiviPaiement = { statut: 'en_attente' | 'accepte' | 'refuse'; compte?: EtatCompteServeur };

/** Demande au serveur où en est la transaction (le serveur revérifie auprès de CinetPay). */
export async function suivrePaiement(transactionId: string): Promise<SuiviPaiement> {
  const r = await appelApi(`/paiements/${transactionId}`);
  return { statut: (r.statut as SuiviPaiement['statut']) ?? 'en_attente', compte: r.compte as EtatCompteServeur | undefined };
}

export type Offre = {
  /** Le paiement en ligne (CinetPay) est configuré côté serveur */
  paiement: boolean;
  tarifs: { mensuel: { prix: number; jours: number }; annuel: { prix: number; jours: number } };
  scansGratuits: number;
  scansPremium: number;
};

/** Prix et limites tels que le serveur les applique : une seule source de vérité. Null si on ne peut pas les lire. */
export async function chargerOffre(): Promise<Offre | null> {
  if (!serveurConfigure) return null;
  try {
    const r = (await appelApi('/sante')) as { paiement?: boolean; tarifs?: Record<string, { montant: number; jours: number }>; scansGratuits?: number; scansPremium?: number };
    if (!r.tarifs?.mensuel || !r.tarifs?.annuel) return null;
    return {
      paiement: !!r.paiement,
      tarifs: {
        mensuel: { prix: r.tarifs.mensuel.montant, jours: r.tarifs.mensuel.jours },
        annuel: { prix: r.tarifs.annuel.montant, jours: r.tarifs.annuel.jours },
      },
      scansGratuits: r.scansGratuits ?? 1,
      scansPremium: r.scansPremium ?? 10,
    };
  } catch {
    return null;
  }
}

/** Active le forfait avec un code d'activation reçu après un paiement Mobile Money. */
export async function utiliserCode(code: string): Promise<EtatCompteServeur> {
  try {
    const r = await appelApi('/codes', { methode: 'POST', corps: { code: formaterCode(code) } });
    return r.compte as EtatCompteServeur;
  } catch (e) {
    throw new ErreurPaiement(e instanceof ErreurApi ? e.message : 'Le code n’a pas pu être vérifié. Vérifie ta connexion et réessaie.');
  }
}
