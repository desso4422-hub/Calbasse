# Calbasse en PWA (site web installable)

Adresse : **https://calbasse.expo.app** — hébergée par Expo Hosting, sur le même compte que l'APK.

La PWA et l'APK partagent tout : le même code, le même serveur Supabase, les mêmes comptes et le même
forfait. Une personne peut scanner sur le site et retrouver ses données dans l'app, à condition d'avoir
sauvegardé son compte avec son e-mail.

## Publier une nouvelle version

```bash
EXPO_TOKEN=… scripts/deployer-pwa.sh --prod
```

Sans `--prod`, le script publie sur une adresse de test, utile pour vérifier avant de remplacer le site
public. Le script lit les réglages dans `eas.json` (profil `testeurs`) et refuse de publier s'il en manque.

## Ce qui rend le site installable

| Fichier | Rôle |
| --- | --- |
| `public/manifest.webmanifest` | nom, icônes, couleurs, affichage plein écran |
| `public/sw.js` | ouverture hors ligne ; ne met jamais en cache les appels au serveur |
| `public/index.html` | enregistre le service worker et les balises Apple |
| `public/icons/` | icônes 192, 512 et masquable, plus l'icône Apple |

## Installer (message pour les utilisateurs)

- **Android (Chrome)** : ouvre le lien, puis le menu à trois points, puis « Installer l'application ».
- **iPhone (Safari)** : ouvre le lien, puis le bouton Partager, puis « Sur l'écran d'accueil ».

Une fois installée, l'app a son icône et s'ouvre en plein écran, sans barre d'adresse.

## Ce que la PWA ne fait pas aussi bien que l'APK

- Sur iPhone, l'appareil photo s'ouvre par le sélecteur de fichiers, moins direct que dans l'APK.
- Les données locales d'un site peuvent être effacées par le navigateur s'il manque de place. Le compte
  avec e-mail protège de cette perte.
- Pas de notifications sur iPhone tant que l'app n'est pas installée sur l'écran d'accueil.

## Quand utiliser l'une ou l'autre

L'APK pour les testeurs et les clients qui paient : rien ne s'efface, et les mises à jour arrivent toutes
seules. La PWA pour faire essayer en un clic, depuis un lien WhatsApp, sans rien installer.
