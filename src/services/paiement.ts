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
import { appelApi, ErreurApi, serveurConfigure, type EtatCompteServeur } from './api';

export const tarifs = {
  mensuel: { prix: 2000, jours: 30 },
  annuel: { prix: 20000, jours: 365 },
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
