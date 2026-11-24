#!/usr/bin/env bash
# Publie une mise à jour automatique (sans réinstaller l'APK) pour les téléphones qui ont la même version de l'app.
#
#   EXPO_TOKEN=… scripts/publier-maj.sh "ce qui change" [canal]      (canal : testeurs par défaut)
#
# Les réglages de l'app (adresse Supabase, clé publique, contact) sont ceux d'eas.json pour ce canal : sans eux,
# la mise à jour casserait l'app. Elle ne peut changer que le code et les images : pour du natif (nouvelle permission,
# nouveau module) ou un changement de `version` dans app.json, il faut un nouvel APK.
set -euo pipefail
cd "$(dirname "$0")/.."
MESSAGE=${1:?dis ce qui change, entre guillemets}
CANAL=${2:-testeurs}
eval "$(CANAL=$CANAL node -e '
  const env = require("./eas.json").build[process.env.CANAL].env;
  for (const [k, v] of Object.entries(env)) if (!process.env[k]) console.log(`export ${k}=${JSON.stringify(v)}`);
')"
EAS_BUILD_PROFILE=$CANAL node scripts/verifier-production.mjs
npx --yes eas-cli@latest update --channel "$CANAL" --message "$MESSAGE" --non-interactive
