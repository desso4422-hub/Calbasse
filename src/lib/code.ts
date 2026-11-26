/**
 * Code d'activation du forfait : CAL-XXXX-XXXX-XXXX.
 *
 * Le code arrive souvent par WhatsApp : il peut être collé avec des espaces, des retours à la ligne, en minuscules,
 * sans tirets, ou avec le préfixe « CAL » déjà écrit. On remet tout en forme avant de l'envoyer au serveur,
 * qui, lui, n'accepte que la forme exacte.
 */

/** Met la saisie en forme au fur et à mesure de la frappe : « cal58b84b507894 » → « CAL-58B8-4B50-7894 ». */
export function formaterCode(saisie: string): string {
  const brut = saisie.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!brut) return '';
  if ('CAL'.startsWith(brut)) return brut;                       // début de frappe : C, CA, CAL
  const corps = (brut.startsWith('CAL') ? brut.slice(3) : brut).slice(0, 12);
  return ['CAL', ...(corps.match(/.{1,4}/g) ?? [])].join('-');
}

/** true si le code est complet et peut être envoyé au serveur. */
export function codeComplet(code: string): boolean {
  return /^CAL-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(formaterCode(code));
}
