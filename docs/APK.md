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
