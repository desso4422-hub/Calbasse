# Fabriquer, diffuser et mettre à jour l'APK de Calbasse (Expo / EAS)

Projet Expo : https://expo.dev/accounts/desso4422s-team/projects/calbasse (canal de mises à jour : `testeurs`).

## Fabriquer un nouvel APK

Nécessaire seulement pour la première diffusion, ou quand on change du natif (nouvelle permission, nouveau module) ou la `version` de `app.json`.

```bash
npx eas-cli@latest build --platform android --profile testeurs
```

Les réglages de l'app (adresse Supabase, clé publique, contact) viennent d'`eas.json`. `EXPO_PUBLIC_CONTACT: "aucun"` = version de test sans contact public (refusée pour le profil `production` : il faut alors un vrai contact). Expo garde la clé de signature : ne la perds pas de vue en changeant de compte Expo.

Le lien de téléchargement apparaît sur la page de la construction (expo.dev, onglet Builds). Envoie-le sur WhatsApp.

## Mises à jour automatiques (sans réinstaller)

```bash
scripts/publier-maj.sh "ce qui change"
```

Les téléphones reçoivent la mise à jour à leur prochain lancement (parfois au 2e). Elle ne change que le code et les images, pour la même `version` de l'app. Toujours passer par ce script : il applique les mêmes réglages qu'à la construction ; une mise à jour publiée sans eux casserait l'app.

## Installer (message à envoyer aux testeurs)

1. Ouvre le lien sur ton téléphone Android et télécharge le fichier.
2. Ouvre-le. Android demande d'autoriser l'installation depuis ce navigateur : accepte.
3. Si « Google Play Protect » avertit que l'app n'est pas connue : « Installer quand même ».

## Variante sans Expo (construction sur un ordinateur)

`scripts/construire-apk.sh` construit un APK signé avec une clé à soi (`CALBASSE_KEYSTORE`, `CALBASSE_KEYSTORE_MDP`). Un APK signé ainsi ne peut pas recevoir les mises à jour d'un APK construit par Expo, et inversement.

## Poids de l'APK

L'APK est allégé par `expo-build-properties` (dans `app.json`) et par l'autolinking (dans `package.json`) :

- **2 processeurs au lieu de 4** (`buildArchs`) : `arm64-v8a` et `armeabi-v7a`. On enlève `x86`/`x86_64`, qui ne servent qu'aux émulateurs.
- **Lecture de codes-barres retirée** (`barcodeScannerEnabled: false` + `buildFromSource: ["expo-camera"]`) : Calbasse photographie des plats, il ne lit pas de QR codes. Retire ML Kit, soit environ 5 Mo par processeur.
- **Animations Reanimated retirées** (`autolinking.android.exclude`) : aucune ligne de l'app ne s'en sert ; la navigation passe par `react-native-screens`. Environ 3 Mo par processeur.
- **GIF et WebP désactivés** (`gifEnabled`, `webpEnabled`) : l'app n'affiche que des photos JPEG et des images PNG.
- **R8 et nettoyage des ressources** (`enableMinifyInReleaseBuilds`, `enableShrinkResourcesInReleaseBuilds`).
- **Bibliothèques compressées** (`useLegacyPackaging: true`) : APK plus léger à télécharger (l'installation est un peu plus longue).

Résultat : environ 21 Mo pour les deux processeurs réunis, contre 40 Mo pour un seul processeur auparavant.

Non retenu : `enableBundleCompression` gagnerait encore 1 à 2 Mo mais ralentirait le démarrage de l'app.

Après un changement de cette liste, vérifier le contenu de l'APK :

```bash
unzip -lv mon.apk | sort -k3 -rn | head -20
```
