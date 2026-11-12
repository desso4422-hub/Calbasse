/**
 * Paiement de l'abonnement Premium (Mobile Money ou carte, via CinetPay).
 *
 * Le paiement doit passer par TON serveur : c'est lui qui détient la clé API CinetPay,
 * crée la transaction (POST https://api-checkout.cinetpay.com/v2/payment), reçoit la
 * notification de paiement, puis active l'abonnement. L'app se contente d'ouvrir le lien
 * de paiement renvoyé par le serveur.
 *
 * Sans EXPO_PUBLIC_PAIEMENT_API_URL, on est en mode démo : l'abonnement s'active localement.
 */
import * as Linking from 'expo-linking';
import { ajouterJours, cleJour } from '../lib/nutrition.ts';
import type { Abonnement } from '../state/store';

export const tarifs = {
  mensuel: { prix: 2000, jours: 30 },
  annuel: { prix: 20000, jours: 365 },
} as const;

const URL_PAIEMENT = process.env.EXPO_PUBLIC_PAIEMENT_API_URL;

export const modePaiement: 'serveur' | 'demo' = URL_PAIEMENT ? 'serveur' : 'demo';

export type IssuePaiement = { statut: 'active'; abonnement: Abonnement } | { statut: 'enAttente' };

export async function demarrerPaiement(plan: Abonnement['plan']): Promise<IssuePaiement> {
  if (!URL_PAIEMENT) {
    await new Promise((r) => setTimeout(r, 700));
    return { statut: 'active', abonnement: { plan, jusquau: cleJour(ajouterJours(new Date(), tarifs[plan].jours)) } };
  }
  const reponse = await fetch(URL_PAIEMENT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan, montant: tarifs[plan].prix, devise: 'XOF', retour: Linking.createURL('/premium') }),
  });
  if (!reponse.ok) throw new Error(`Paiement indisponible (${reponse.status})`);
  const { urlPaiement } = (await reponse.json()) as { urlPaiement: string };
  await Linking.openURL(urlPaiement);
  // L'abonnement sera confirmé par le serveur après la notification CinetPay.
  return { statut: 'enAttente' };
}
