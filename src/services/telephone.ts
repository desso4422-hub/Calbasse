/**
 * Numéro de téléphone : protège le compte (et l'abonnement Premium) en cas de changement de téléphone.
 * Le serveur envoie un code par SMS ; une fois vérifié, le numéro est rattaché au compte, ou
 * l'ancien compte lié à ce numéro est récupéré sur cet appareil.
 */
import { appelApi, ErreurApi, remplacerJeton, type EtatCompteServeur } from './api';

export type Pays = { nom: string; indicatif: string; exemple: string };

/** Pays proposés (le plus courant en premier). Le 0 de tête fait partie du numéro au Bénin et en Côte d'Ivoire. */
export const pays: Pays[] = [
  { nom: 'Bénin', indicatif: '229', exemple: '01 97 12 34 56' },
  { nom: "Côte d'Ivoire", indicatif: '225', exemple: '07 07 12 34 56' },
  { nom: 'Togo', indicatif: '228', exemple: '90 12 34 56' },
  { nom: 'Sénégal', indicatif: '221', exemple: '77 123 45 67' },
  { nom: 'Burkina Faso', indicatif: '226', exemple: '70 12 34 56' },
  { nom: 'Mali', indicatif: '223', exemple: '76 12 34 56' },
  { nom: 'Niger', indicatif: '227', exemple: '90 12 34 56' },
  { nom: 'Cameroun', indicatif: '237', exemple: '6 71 23 45 67' },
  { nom: 'Guinée', indicatif: '224', exemple: '621 12 34 56' },
  { nom: 'Ghana', indicatif: '233', exemple: '24 123 4567' },
  { nom: 'Nigeria', indicatif: '234', exemple: '803 123 4567' },
];

export class ErreurTelephone extends Error {}

function message(e: unknown): string {
  return e instanceof ErreurApi ? e.message : 'Une erreur est survenue. Réessaie.';
}

export async function demanderCode(numero: string, indicatif: string): Promise<{ numeroMasque: string }> {
  try {
    const r = await appelApi('/telephone/code', { methode: 'POST', corps: { numero, indicatif } });
    return { numeroMasque: String(r.numero ?? numero) };
  } catch (e) {
    throw new ErreurTelephone(message(e));
  }
}

export async function verifierCode(numero: string, indicatif: string, code: string): Promise<{ recupere: boolean; compte: EtatCompteServeur }> {
  let r: Record<string, unknown>;
  try {
    r = await appelApi('/telephone/verifier', { methode: 'POST', corps: { numero, indicatif, code } });
  } catch (e) {
    throw new ErreurTelephone(message(e));
  }
  if (typeof r.jeton === 'string' && r.jeton) await remplacerJeton(r.jeton);
  const { premium, scansRestants, limite, telephone } = r as unknown as EtatCompteServeur;
  return { recupere: r.recupere === true, compte: { premium, scansRestants, limite, telephone } };
}
