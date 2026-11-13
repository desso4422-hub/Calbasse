/**
 * Paiement Mobile Money et carte via CinetPay (API checkout v2).
 *
 * Principe de sécurité : on ne croit jamais la notification reçue. Elle sert seulement de signal ;
 * le serveur redemande toujours le statut à CinetPay (/payment/check) avec sa clé API, et vérifie
 * montant et devise avant d'activer Premium.
 *
 * ⚠️ Écrit d'après l'API v2 de CinetPay sans accès à sa documentation depuis l'environnement de
 * développement : vérifie les champs avec https://docs.cinetpay.com et teste en mode sandbox
 * avant la mise en production (voir README).
 */

export type ConfigCinetPay = {
  apiKey: string;
  siteId: string;
  /** https://api-checkout.cinetpay.com/v2 */
  urlApi: string;
  /** Adresse publique du serveur Calbasse, pour notify_url et return_url */
  urlPublique: string;
};

export type ClientHttp = typeof fetch;

export class ErreurCinetPay extends Error {}

export type DemandePaiement = {
  transactionId: string;
  montant: number;
  description: string;
  compteId: string;
};

export async function creerPaiementCinetPay(config: ConfigCinetPay, d: DemandePaiement, http: ClientHttp = fetch): Promise<string> {
  const reponse = await http(`${config.urlApi}/payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apikey: config.apiKey,
      site_id: config.siteId,
      transaction_id: d.transactionId,
      amount: d.montant, // doit être un multiple de 5
      currency: 'XOF',
      description: d.description,
      notify_url: `${config.urlPublique}/cinetpay/notification`,
      return_url: `${config.urlPublique}/cinetpay/retour`,
      channels: 'ALL', // Mobile Money, cartes, wallets
      lang: 'fr',
      metadata: d.compteId,
    }),
  });
  const donnees = (await reponse.json().catch(() => ({}))) as { code?: string; message?: string; description?: string; data?: { payment_url?: string } };
  if (donnees.code !== '201' || !donnees.data?.payment_url) {
    throw new ErreurCinetPay(`Création du paiement refusée : ${donnees.code ?? reponse.status} ${donnees.message ?? ''} ${donnees.description ?? ''}`.trim());
  }
  return donnees.data.payment_url;
}

export type StatutCinetPay = {
  accepte: boolean;
  /** Paiement définitivement échoué (refusé, annulé) */
  echoue: boolean;
  montant: number | null;
  devise: string | null;
  brut: unknown;
};

export async function verifierPaiementCinetPay(config: ConfigCinetPay, transactionId: string, http: ClientHttp = fetch): Promise<StatutCinetPay> {
  const reponse = await http(`${config.urlApi}/payment/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apikey: config.apiKey, site_id: config.siteId, transaction_id: transactionId }),
  });
  const donnees = (await reponse.json().catch(() => ({}))) as {
    code?: string;
    message?: string;
    data?: { status?: string; amount?: string | number; currency?: string };
  };
  const statut = donnees.data?.status;
  return {
    accepte: donnees.code === '00' && statut === 'ACCEPTED',
    echoue: statut === 'REFUSED' || statut === 'CANCELED',
    montant: donnees.data?.amount !== undefined ? Number(donnees.data.amount) : null,
    devise: donnees.data?.currency ?? null,
    brut: donnees,
  };
}
