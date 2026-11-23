/**
 * Lien WhatsApp à partir du contact renseigné à la construction de l'app (EXPO_PUBLIC_CONTACT).
 * Si ce contact est un numéro de téléphone, renvoie un lien wa.me avec un message prêt à envoyer ;
 * si c'est une adresse e-mail (ou rien), renvoie null.
 */
export function lienWhatsApp(contact: string, message: string): string | null {
  const c = contact.trim();
  if (!/^\+?[\d\s().-]{8,22}$/.test(c)) return null;
  const chiffres = c.replace(/\D/g, '');
  if (chiffres.length < 8 || chiffres.length > 15) return null;
  return `https://wa.me/${chiffres}?text=${encodeURIComponent(message)}`;
}
