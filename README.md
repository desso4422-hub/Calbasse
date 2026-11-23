# Calbasse

Compter simple, manger local, sans culpabilité.
Calbasse photographie ton assiette (attiéké, pâte rouge, riz au gras, sauce graine…), estime calories et protéines, et t'aide à atteindre ton objectif du jour.

Application mobile **Expo / React Native** (iOS, Android, web), construite à partir des maquettes de `design/maquettes/`.

> ⚠️ **Valeurs d'illustration.** Toutes les calories, protéines et grammes de `src/lib/aliments.ts` sont des exemples cohérents avec les maquettes. Avant tout test utilisateur, il faut les remplacer par une base sourcée (FAO/INFOODS, table ouest-africaine WAFCT) validée par un nutritionniste.

## Lancer l'app

```bash
npm install
```

```bash
npx expo start
```

Scanne le QR code avec **Expo Go** sur ton téléphone (ou appuie sur `w` pour la version web).

Vérifications :

```bash
npm run typecheck
```

```bash
npm test
```

## Version MVP : tout autour du scan

Cette version est centrée sur la fonction principale : **scanner son plat**. Par défaut, le mode coach, le paiement Premium et le numéro de téléphone sont masqués (leur code est conservé dans le projet). Le quota de scans gratuits se règle sur le serveur (`SCANS_GRATUITS`, par exemple 10 pour les testeurs) ; quand il est épuisé, l'app le dit simplement et propose de choisir le plat dans la liste.

Pour tout réafficher : `EXPO_PUBLIC_MVP=0` dans `.env.local` (voir `src/config.ts`).

### Le scan sur le terrain (réseau lent ou coupé)

- **Photo légère** : 1280 px, JPEG compressé (~120-200 Ko).
- **Attente expliquée** : « Envoi de la photo… », « On regarde ton assiette… », puis « Le réseau est lent, on continue… » avec un bouton **Continuer sans attendre**.
- **Nouvel essai automatique** si la connexion coupe pendant l'envoi.
- **Aucune photo perdue** : si le réseau ne suit pas, ou si l'utilisateur ne veut pas attendre, la photo est gardée sur le téléphone et le repas apparaît dans Aujourd'hui (« En attente de réseau »). Il est analysé automatiquement dès que la connexion revient, puis passe à « Prêt à vérifier ». Ça marche aussi si l'app est fermée entre-temps.
- **Jamais compté deux fois** : chaque photo porte une clé unique. Si elle est renvoyée (coupure pendant la réponse, file d'attente), le serveur rend le même résultat sans refaire l'analyse ni décompter un scan.

## En production : Supabase

Pour de vrais utilisateurs, l'app parle à **Supabase** (dossier `supabase/`), jamais directement au modèle :

| Élément | Où | Rôle |
| --- | --- | --- |
| `supabase/migrations/` | base de données | scans, corrections, signalements ; quota par personne, plafond global, anti-rafale, un scan en échec ne coûte rien |
| `supabase/functions/api/` | fonction serveur | `/scan`, `/compte`, `/corrections`, `/signalements`, suppression du compte ; **la clé RodiumAI n'existe que là** |
| `supabase/functions/_shared/` | copie | consignes et catalogue d'aliments, copiés depuis `src/lib/` (`npm run sync:supabase`) |
| `src/services/supabase.ts` | app | compte anonyme + renouvellement du jeton |

Tests, sans aucun compte :

```bash
npm test                       # app + mentions légales + garde-fou de diffusion
npm run test:supabase          # logique de la fonction serveur (22 tests)
scripts/tester-base.sh         # base de données sur un PostgreSQL local (quotas, verrouillage)
RODIUMAI_API_KEY=… node --experimental-strip-types supabase/tests/faux-supabase.ts   # faux Supabase pour essayer l'app
```

Mise en ligne pas à pas : `docs/MISE-EN-LIGNE.md`. Le texte de confidentialité : `docs/confidentialite.md`.
Les variables d'une version diffusée (`EXPO_PUBLIC_SUPABASE_URL`, `…_ANON_KEY`, `EXPO_PUBLIC_CONTACT`) sont dans `eas.json` ;
`npm run verifier:production` refuse de construire si l'une manque. Le serveur Node de `server/` reste utilisable en local.

## Application Android (APK) sans serveur, pour développer

Calbasse peut aussi tourner **sans serveur** : l'app interroge elle-même le modèle de vision
(RodiumAI). C'est le mode de l'APK autonome, construit avec `EXPO_PUBLIC_VISION_DIRECTE=1`.

- Les consignes, le catalogue d'aliments et la vérification de la réponse sont les mêmes que
  côté serveur : tout vient de `src/lib/vision.ts`, partagé par l'app et `server/`.
- **La clé n'est pas dans l'APK** : au premier scan, l'app demande la clé RodiumAI, la vérifie
  (appel gratuit à `/v1/models`) et la range dans le coffre du téléphone (Keystore). L'APK peut
  donc être partagé sans livrer la clé ; chacun met la sienne (Profil → Clé de reconnaissance).
- Pas de compte ni de quota : le crédit RodiumAI fait la limite.
- `EXPO_PUBLIC_RODIUMAI_API_KEY` permet quand même de poser une clé à la construction, pour un
  APK strictement personnel. Elle est alors extractible de l'APK : à éviter pour une diffusion.

Construction (nécessite le SDK Android) :

```bash
npx expo prebuild --platform android
EXPO_PUBLIC_VISION_DIRECTE=1 ./android/gradlew -p android :app:assembleRelease \
  -PreactNativeArchitectures=armeabi-v7a,arm64-v8a
```

L'APK sort dans `android/app/build/outputs/apk/release/` (≈ 57 Mo ; sans l'option
`reactNativeArchitectures`, il embarque aussi les versions d'émulateur et pèse le double).
Il faut un JDK 17 et, pour le code natif, le NDK attendu par la version d'AGP.

## Installer Calbasse sur un téléphone (PWA)

Calbasse s'utilise comme une **PWA** : une page web qui s'installe sur l'écran d'accueil comme une app (Android et iPhone), sans Play Store. Appareil photo, galerie et ouverture hors ligne fonctionnent.

Hébergement : **[Netlify](https://netlify.com)** (offre gratuite, connexion avec GitHub). La page et le serveur sont au même endroit, le serveur répond sous `/api`, et la clé RodiumAI reste côté serveur.

1. Sur netlify.com : **Add new site → Import an existing project**, choisir GitHub puis le dépôt `calbasse` et la branche de travail.
2. Dans **Environment variables**, ajouter `RODIUMAI_API_KEY` (ta clé RodiumAI) et, pour les testeurs, `SCANS_GRATUITS=10`.
3. **Deploy**. Netlify lit `netlify.toml` : il publie `dist` et met le serveur dans une fonction appelée sous `/api`.
4. Sur le téléphone, ouvrir l'adresse donnée par Netlify, puis : **Android (Chrome)** menu ⋮ → « Installer l'application » ; **iPhone (Safari)** bouton Partager → « Sur l'écran d'accueil ».

Pour vérifier la construction en local : `npm run build:netlify` (résultat dans `dist` et `netlify/fonctions`). Sur l'offre gratuite, les comptes et compteurs de scans vivent dans `/tmp` et repartent parfois à zéro ; une analyse doit tenir dans les 10 secondes allouées à une fonction (elle en prend 2 à 4).

Le déploiement sur Vercel reste possible : `vercel.json` et `npm run build:vercel` (résultat dans `.vercel/output`).

## Écrans

| Maquette | Fichier |
| --- | --- |
| 1 · Objectif (+ profil et repères) | `src/app/onboarding.tsx` |
| 2 · Aujourd'hui | `src/app/(onglets)/index.tsx` |
| 3 · Scanner | `src/app/scanner.tsx` |
| 4 · Résultat | `src/app/resultat.tsx` |
| 5 · Détail et sources | `src/app/detail.tsx` |
| 6 · Bilan de la semaine | `src/app/(onglets)/bilan.tsx` |
| 7 · Plats locaux | `src/app/(onglets)/plats.tsx` (+ `src/app/choisir.tsx`) |
| 8 · Premium | `src/app/premium.tsx` |
| 9 · Coach : clients | `src/app/coach/index.tsx` |
| 10 · Coach : corriger un repas | `src/app/coach/[id].tsx` |
| Profil (non maquetté) | `src/app/(onglets)/profil.tsx` |

## Organisation du code

```
src/
  app/            écrans (Expo Router)
  components/     T (texte), ui (boutons, segments, cartes), Graphiques (anneau, assiette, logo), Icone
  lib/            logique pure, testée : aliments, plats composés, nutrition, bilan, coach
  services/       api (compte, jeton), reconnaissance, photo (réduction), paiement (CinetPay), téléphone (SMS)
  state/          store (données gardées sur le téléphone), brouillon (repas en cours)
  theme.ts        palette et polices des Fondations
design/           maquettes d'origine et logo
server/           serveur : reconnaissance (Gemini), comptes, quota, téléphone (SMS), paiement CinetPay, banc d'évaluation
```

Règles de calcul (`src/lib/nutrition.ts`) :

- **Portion** : Petite ×0,7, Moyenne ×1, Grande ×1,35, appliquée au riz, aux pâtes et aux sauces, pas aux pièces (cuisse, poisson, œuf).
- **Huile** : la base compte la quantité habituelle ; « Peu » retire 80 kcal (9 g de lipides), « Beaucoup » ajoute 150 kcal (17 g).
- **Fourchette** affichée : −7 % / +8 % autour de l'estimation.
- **Objectifs** : Mifflin-St Jeor × activité ; masse +350 kcal et 2 g de protéines/kg, perte −450 kcal et 1,8 g/kg, forme 1,4 g/kg.

## Reconnaissance des plats

Le serveur de reconnaissance est dans `server/` (voir `server/README.md`). Il utilise la vision de Gemini (via RodiumAI, payable depuis l'Afrique), contrainte à la base d'aliments de l'app : près de 75 aliments et 25 plats d'Afrique de l'Ouest et du Centre, chacun avec ses noms locaux et une description visuelle qui distingue les plats faciles à confondre.

Dans l'app :

- la photo est réduite à 1568 px puis envoyée à `POST {EXPO_PUBLIC_API_URL}/scan` ;
- chaque aliment arrive avec une confiance : vert si le modèle est sûr, **orange s'il doute**. Un toucher sur un aliment orange propose les alternatives du modèle, « Autre aliment » ou « Retirer » ;
- un aliment vu mais absent de la base apparaît en pointillés (« oignons et tomates crus ») et se choisit dans la liste ;
- une photo sans nourriture ne décompte pas de scan ;
- le quota de scans est compté par le serveur (compte anonyme créé au premier lancement, jeton dans le stockage sécurisé du téléphone) ;
- le numéro de téléphone, vérifié par SMS, permet de retrouver son compte et Premium sur un nouveau téléphone (Profil → « Protéger mon compte », ou « J'ai déjà un compte Premium » au premier écran) ;
- quand l'utilisateur corrige, la correction remonte au serveur (`POST /corrections`) pour améliorer la base.

Sans `EXPO_PUBLIC_API_URL`, l'app reste en **mode démo** : elle s'appuie sur l'indice texte saisi au scanner (« garba », « riz, sauce graine, poulet ») et, sans indice, propose un plat d'exemple.

Pour mesurer la précision sur de vraies photos : `server/eval/LISEZ-MOI.md`.

## Ce qui est encore en mode démo

### Paiement Premium (CinetPay)

Avec un serveur, « Payer » ouvre la page CinetPay (Mobile Money ou carte). Premium s'active quand le serveur a vérifié le paiement auprès de CinetPay (voir `server/README.md`, y compris les points à vérifier avant d'encaisser). Sans serveur, « Payer » active l'abonnement localement (étiquette « Mode démo : aucun paiement réel »).

### Mode coach

Les clients sont des données d'exemple (`src/lib/coach.ts`). Il faudra des comptes et un serveur pour relier coach et clients. Le message vocal est affiché « bientôt ».

### Données

Tout est stocké sur le téléphone (AsyncStorage). Dans Profil : « Charger des repas d'exemple » remplit deux semaines pour essayer le Bilan, et « Effacer mes données » remet l'app à zéro.

## Gratuit et Premium

- Gratuit : 2 scans photo par jour, bilan de la semaine en cours. Choisir un plat dans la liste ne consomme pas de scan.
- Premium (2 000 FCFA/mois ou 20 000 FCFA/an, sans renouvellement automatique) : 30 scans par jour et l'historique des semaines passées.

## Prochaines étapes

Pour le MVP (scan) :

1. Mesurer la reconnaissance sur davantage de vraies photos (`server/eval/`), puis ajuster les descriptions des aliments les plus confondus.
2. Déployer le serveur (HTTPS) et distribuer l'app aux testeurs (APK Android via EAS).
3. Remplacer la base d'aliments par des valeurs sourcées, validées par un nutritionniste.

Après le MVP :

1. Choisir le modèle Gemini et le niveau de réflexion selon la précision mesurée et le coût par scan.
2. Rallumer le paiement (vérifier CinetPay avec sa documentation et de vrais petits paiements) et le numéro de téléphone (Africa's Talking).
3. Sauvegarde des repas sur le serveur (historique retrouvé avec le compte), puis mode coach relié.
