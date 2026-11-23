/**
 * Fonctions activées dans cette version de l'app.
 *
 * MVP : tout tourne autour du scan de plat. Le mode coach et le numéro de téléphone sont masqués (leur code
 * est conservé). Le forfait payant (1 scan gratuit par jour, 10 avec le forfait) s'allume avec
 * EXPO_PUBLIC_PREMIUM=1. Pour tout rallumer : EXPO_PUBLIC_MVP=0.
 */
const mvp = process.env.EXPO_PUBLIC_MVP !== '0';

/** Forfait payant visible : toujours dans une version diffusée (EXPO_PUBLIC_PREMIUM=1), pour essai sinon avec EXPO_PUBLIC_MVP=0. */
const premium = process.env.EXPO_PUBLIC_PREMIUM === '1';

/** Outils de développement (repas d'exemple, étiquettes techniques) : EXPO_PUBLIC_DEMO=1, jamais en production. */
const demo = process.env.EXPO_PUBLIC_DEMO === '1';

export const fonctions = {
  demo,
  coach: !mvp,
  premium: !mvp || premium,
  telephone: !mvp,
} as const;
