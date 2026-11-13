/**
 * Envoi des codes de vérification par SMS.
 *
 * - « africastalking » : Africa's Talking (couvre la plupart des opérateurs d'Afrique de l'Ouest et du Centre).
 * - « console » : le code est seulement écrit dans les logs du serveur. Pour le développement, jamais en production.
 *
 * ⚠️ L'appel à Africa's Talking a été écrit sans accès à leur documentation depuis l'environnement de
 * développement (site bloqué) : vérifie-le avec leur bac à sable (sandbox) avant la mise en production.
 */
import type { ClientHttp } from './cinetpay.ts';

export type EnvoyeurSms = { envoyer: (numero: string, message: string) => Promise<void> };

export class ErreurSms extends Error {}

export type ConfigAfricasTalking = {
  utilisateur: string;
  cleApi: string;
  /** Nom d'expéditeur validé chez Africa's Talking (facultatif) */
  expediteur?: string;
  /** true : bac à sable (aucun vrai SMS) */
  sandbox?: boolean;
};

export function smsAfricasTalking(config: ConfigAfricasTalking, http: ClientHttp = fetch): EnvoyeurSms {
  const url = config.sandbox ? 'https://api.sandbox.africastalking.com/version1/messaging' : 'https://api.africastalking.com/version1/messaging';
  return {
    async envoyer(numero, message) {
      const corps = new URLSearchParams({ username: config.utilisateur, to: numero, message });
      if (config.expediteur) corps.set('from', config.expediteur);
      const reponse = await http(url, {
        method: 'POST',
        headers: { apiKey: config.cleApi, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: corps.toString(),
      });
      const donnees = (await reponse.json().catch(() => ({}))) as {
        SMSMessageData?: { Recipients?: { status?: string; statusCode?: number }[] };
      };
      const destinataire = donnees.SMSMessageData?.Recipients?.[0];
      if (!reponse.ok || !destinataire || (destinataire.status !== 'Success' && destinataire.statusCode !== 101)) {
        throw new ErreurSms(`SMS non envoyé (${reponse.status}, ${destinataire?.status ?? 'réponse inattendue'})`);
      }
    },
  };
}

export function smsConsole(): EnvoyeurSms {
  return {
    async envoyer(numero, message) {
      console.log(`[SMS de développement] à ${numero} : ${message}`);
    },
  };
}

/**
 * Met un numéro au format international (+229…).
 * Accepte « +229 01 97 12 34 56 », « 00229… », ou un numéro local avec l'indicatif choisi dans l'app.
 * Le 0 de tête est conservé : au Bénin et en Côte d'Ivoire, il fait partie du numéro.
 */
export function normaliserNumero(saisie: string, indicatif?: string): string | null {
  const brut = saisie.trim();
  let chiffres = brut.replace(/[^\d]/g, '');
  if (brut.startsWith('+')) {
    // déjà international
  } else if (chiffres.startsWith('00')) {
    chiffres = chiffres.slice(2);
  } else if (indicatif && /^\d{1,4}$/.test(indicatif)) {
    chiffres = indicatif + chiffres;
  } else {
    return null;
  }
  return chiffres.length >= 9 && chiffres.length <= 15 ? `+${chiffres}` : null;
}
