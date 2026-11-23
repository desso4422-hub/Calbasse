/**
 * Fonctions activées dans cette version de l'app.
 *
 * MVP : tout tourne autour du scan de plat. Le mode coach, le paiement Premium et le numéro de
 * téléphone sont masqués (leur code est conservé). Pour les rallumer : EXPO_PUBLIC_MVP=0.
 */
const mvp = process.env.EXPO_PUBLIC_MVP !== '0';

/** Outils de développement (repas d'exemple, étiquettes techniques) : EXPO_PUBLIC_DEMO=1, jamais en production. */
const demo = process.env.EXPO_PUBLIC_DEMO === '1';

export const fonctions = {
  demo,
  coach: !mvp,
  premium: !mvp,
  telephone: !mvp,
} as const;
