#!/usr/bin/env node
/**
 * Garde-fou avant de construire une version à diffuser : refuse une app mal configurée
 * (serveur Supabase absent, adresse de contact manquante, outils de démonstration allumés,
 * clé RodiumAI embarquée dans l'APK).
 *
 *   npm run verifier:production                 vérifie l'environnement actuel
 *   Sur EAS, lancé automatiquement avant les builds « testeurs » et « production » (eas-build-pre-install).
 *
 * Volontairement en JavaScript simple : il doit tourner sur les machines de EAS, quelle que soit leur version de Node.
 */
const env = process.env;
const profil = env.EAS_BUILD_PROFILE;
// Sur EAS, seules les versions destinées aux utilisateurs sont contrôlées
if (profil && !['testeurs', 'production'].includes(profil)) process.exit(0);

const probleme = [];
const absent = (v) => !v || /A_REMPLIR|REMPLACER|À COMPLÉTER/i.test(v);

if (absent(env.EXPO_PUBLIC_SUPABASE_URL) || !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(env.EXPO_PUBLIC_SUPABASE_URL))
  probleme.push("EXPO_PUBLIC_SUPABASE_URL doit être l'adresse du projet, par exemple https://abcdefgh.supabase.co");
if (absent(env.EXPO_PUBLIC_SUPABASE_ANON_KEY) || env.EXPO_PUBLIC_SUPABASE_ANON_KEY.length < 20)
  probleme.push("EXPO_PUBLIC_SUPABASE_ANON_KEY doit être la clé publique du projet (« anon » ou « publishable »)");
if (absent(env.EXPO_PUBLIC_CONTACT))
  probleme.push("EXPO_PUBLIC_CONTACT doit être ton e-mail ou ton numéro WhatsApp : il apparaît dans la politique de confidentialité");
if (env.EXPO_PUBLIC_DEMO === '1') probleme.push('EXPO_PUBLIC_DEMO=1 allume les outils de démonstration : à retirer');
if (env.EXPO_PUBLIC_VISION_DIRECTE === '1' || env.EXPO_PUBLIC_RODIUMAI_API_KEY)
  probleme.push("La reconnaissance intégrée (ou une clé RodiumAI) ne doit pas être dans l'app : la clé reste sur le serveur");
if (env.EXPO_PUBLIC_API_URL) probleme.push('EXPO_PUBLIC_API_URL ne doit pas être défini : l\'app parle à Supabase');

if (probleme.length) {
  console.error('\n⛔ Version non diffusable :\n' + probleme.map((p) => `  - ${p}`).join('\n') + '\n');
  process.exit(1);
}
console.log('✓ Configuration de diffusion correcte.');
