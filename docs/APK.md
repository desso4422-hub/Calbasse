# Fabriquer et diffuser l'APK de Calbasse

## La clé de signature : à ne JAMAIS perdre

Chaque APK est signé avec un fichier `calbasse-release.keystore` (et son mot de passe). Android n'accepte une mise à jour que si elle est signée avec **la même clé** que la version déjà installée. Si tu perds ce fichier, tes utilisateurs devront désinstaller Calbasse (et perdront leurs données locales) pour installer la suite.

- Garde 3 copies : ton téléphone, ton e-mail, un cloud (Drive). Garde le mot de passe à part.
- Ne le mets jamais dans GitHub (déjà interdit par `.gitignore`).

## Construire

```bash
CALBASSE_KEYSTORE=/chemin/calbasse-release.keystore CALBASSE_KEYSTORE_MDP='…' scripts/construire-apk.sh
```

Le script lit les réglages dans `eas.json` (profil `testeurs`), refuse de continuer s'il en manque (`npm run verifier:production`), puis produit dans `apk/` :

- `calbasse-<version>-arm64.apk` : tous les téléphones récents (≈ 40 Mo) ;
- `calbasse-<version>-arm32.apk` : les vieux téléphones (≈ 30 Mo).

Pour une nouvelle version : augmente `version` et `android.versionCode` dans `app.json` (versionCode +1 à chaque diffusion), puis relance.

## Diffuser

Supabase → **Storage → New bucket** : nom `apk`, coche **Public**. Envoie les deux fichiers : chacun a un lien public à partager sur WhatsApp. (La limite gratuite est de 50 Mo par fichier : les deux APK la respectent.)

## Installer (message à envoyer aux testeurs)

1. Ouvre le lien sur ton téléphone Android et télécharge le fichier.
2. Ouvre-le. Android demande d'autoriser l'installation depuis ce navigateur : accepte.
3. Si « Google Play Protect » avertit que l'app n'est pas connue : « Installer quand même ».

## Mises à jour

Pour l'instant, une mise à jour = un nouvel APK à installer par-dessus (les données restent). Les mises à jour automatiques sans réinstaller demandent un compte Expo (EAS Update) : à brancher plus tard.
