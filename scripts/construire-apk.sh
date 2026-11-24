#!/usr/bin/env bash
# Construit l'APK de diffusion de Calbasse, signé avec la clé permanente.
#
#   CALBASSE_KEYSTORE=/chemin/calbasse-release.keystore CALBASSE_KEYSTORE_MDP=… scripts/construire-apk.sh
#
# Les réglages de l'app (adresse Supabase, clé publique, contact) viennent d'eas.json, profil « testeurs » ;
# une variable d'environnement de même nom les remplace. Résultat : apk/calbasse-<version>-<processeur>.apk
# (arm64 : téléphones récents ; arm32 : vieux téléphones). GRADLE_INIT_EXTRA : script Gradle facultatif en plus.
set -euo pipefail
cd "$(dirname "$0")/.."
: "${CALBASSE_KEYSTORE:?définis CALBASSE_KEYSTORE}" "${CALBASSE_KEYSTORE_MDP:?définis CALBASSE_KEYSTORE_MDP}"

# Réglages de l'app : eas.json (profil testeurs), sauf si déjà définis dans l'environnement
eval "$(node -e '
  const env = require("./eas.json").build.testeurs.env;
  for (const [k, v] of Object.entries(env)) if (!process.env[k]) console.log(`export ${k}=${JSON.stringify(v)}`);
')"
node scripts/verifier-production.mjs

[ -d android ] || npx expo prebuild --platform android --no-install
VERSION=$(node -p 'require("./app.json").expo.version')
CODE=$(node -p 'require("./app.json").expo.android.versionCode ?? 1')
sed -i "s/versionCode [0-9]*/versionCode $CODE/; s/versionName \"[^\"]*\"/versionName \"$VERSION\"/" android/app/build.gradle

mkdir -p apk
INIT=(--init-script "$PWD/scripts/signature-release.gradle")
[ -n "${GRADLE_INIT_EXTRA:-}" ] && INIT+=(--init-script "$GRADLE_INIT_EXTRA")
for cpu in arm64-v8a:arm64 armeabi-v7a:arm32; do
  archi=${cpu%%:*}; nom=${cpu##*:}
  ./android/gradlew -p android :app:assembleRelease -PreactNativeArchitectures="$archi" "${INIT[@]}" --console=plain -q
  cp android/app/build/outputs/apk/release/app-release.apk "apk/calbasse-$VERSION-$nom.apk"
  echo "→ apk/calbasse-$VERSION-$nom.apk ($(du -h "apk/calbasse-$VERSION-$nom.apk" | cut -f1))"
done
