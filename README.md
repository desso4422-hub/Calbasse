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
  services/       reconnaissance (photo → serveur), photo (réduction), paiement (CinetPay)
  state/          store (données gardées sur le téléphone), brouillon (repas en cours)
  theme.ts        palette et polices des Fondations
design/           maquettes d'origine et logo
server/           serveur de reconnaissance (vision Claude) et banc d'évaluation
```

Règles de calcul (`src/lib/nutrition.ts`) :

- **Portion** : Petite ×0,7, Moyenne ×1, Grande ×1,35, appliquée au riz, aux pâtes et aux sauces, pas aux pièces (cuisse, poisson, œuf).
- **Huile** : la base compte la quantité habituelle ; « Peu » retire 80 kcal (9 g de lipides), « Beaucoup » ajoute 150 kcal (17 g).
- **Fourchette** affichée : −7 % / +8 % autour de l'estimation.
- **Objectifs** : Mifflin-St Jeor × activité ; masse +350 kcal et 2 g de protéines/kg, perte −450 kcal et 1,8 g/kg, forme 1,4 g/kg.

## Reconnaissance des plats

Le serveur de reconnaissance est dans `server/` (voir `server/README.md`). Il utilise la vision de Claude, contrainte à la base d'aliments de l'app : près de 75 aliments et 25 plats d'Afrique de l'Ouest et du Centre, chacun avec ses noms locaux et une description visuelle qui distingue les plats faciles à confondre.

Dans l'app :

- la photo est réduite à 1568 px puis envoyée à `POST {EXPO_PUBLIC_API_URL}/scan` ;
- chaque aliment arrive avec une confiance : vert si le modèle est sûr, **orange s'il doute**. Un toucher sur un aliment orange propose les alternatives du modèle, « Autre aliment » ou « Retirer » ;
- un aliment vu mais absent de la base apparaît en pointillés (« oignons et tomates crus ») et se choisit dans la liste ;
- une photo sans nourriture ne décompte pas de scan ;
- quand l'utilisateur corrige, la correction remonte au serveur (`POST /corrections`) pour améliorer la base.

Sans `EXPO_PUBLIC_API_URL`, l'app reste en **mode démo** : elle s'appuie sur l'indice texte saisi au scanner (« garba », « riz, sauce graine, poulet ») et, sans indice, propose un plat d'exemple.

Pour mesurer la précision sur de vraies photos : `server/eval/LISEZ-MOI.md`.

## Ce qui est encore en mode démo

### Paiement Premium (CinetPay)

Sans serveur, « Payer » active l'abonnement localement (étiquette « Mode démo : aucun paiement réel »). Pour le vrai paiement, définis `EXPO_PUBLIC_PAIEMENT_API_URL` : ton serveur crée la transaction CinetPay (Mobile Money ou carte, en XOF), renvoie `{ "urlPaiement": "..." }`, puis confirme l'abonnement à la réception de la notification CinetPay.

### Mode coach

Les clients sont des données d'exemple (`src/lib/coach.ts`). Il faudra des comptes et un serveur pour relier coach et clients. Le message vocal est affiché « bientôt ».

### Données

Tout est stocké sur le téléphone (AsyncStorage). Dans Profil : « Charger des repas d'exemple » remplit deux semaines pour essayer le Bilan, et « Effacer mes données » remet l'app à zéro.

## Gratuit et Premium

- Gratuit : 2 scans photo par jour, bilan de la semaine en cours. Choisir un plat dans la liste ne consomme pas de scan.
- Premium (2 000 FCFA/mois ou 20 000 FCFA/an, sans renouvellement automatique) : 30 scans par jour et l'historique des semaines passées.

## Prochaines étapes

1. Remplacer la base d'aliments par des valeurs sourcées, validées par un nutritionniste.
2. Constituer un jeu de photos réelles étiquetées et mesurer la reconnaissance (`server/eval/`), puis choisir modèle et effort selon la précision et le coût.
3. Brancher CinetPay côté serveur.
4. Comptes utilisateurs et synchronisation (nécessaires au mode coach).
5. Construire les apps avec EAS (`npx eas-cli@latest build`).
