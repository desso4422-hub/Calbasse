#!/usr/bin/env bash
# Publie Calbasse en PWA (site web installable) sur Expo Hosting.
#
#   EXPO_TOKEN=… scripts/deployer-pwa.sh            → adresse de test (preview)
#   EXPO_TOKEN=… scripts/deployer-pwa.sh --prod     → adresse définitive (https://calbasse.expo.app)
#
# Les réglages de l'app (adresse Supabase, clé publique, contact) viennent d'eas.json, profil
# « testeurs », comme pour l'APK : la PWA parle au même serveur Supabase.
set -euo pipefail
cd "$(dirname "$0")/.."
eval "$(node -e '
  const env = require("./eas.json").build.testeurs.env;
  for (const [k, v] of Object.entries(env)) if (!process.env[k]) console.log(`export ${k}=${JSON.stringify(v)}`);
')"
EAS_BUILD_PROFILE=testeurs node scripts/verifier-production.mjs

rm -rf dist
npx expo export --platform web
npx --yes eas-cli@latest deploy --non-interactive "$@"
