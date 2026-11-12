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
  services/       reconnaissance (photo → aliments), paiement (CinetPay)
  state/          store (données gardées sur le téléphone), brouillon (repas en cours)
  theme.ts        palette et polices des Fondations
design/           maquettes d'origine et logo
```

Règles de calcul (`src/lib/nutrition.ts`) :

- **Portion** : Petite ×0,7, Moyenne ×1, Grande ×1,35, appliquée au riz, aux pâtes et aux sauces, pas aux pièces (cuisse, poisson, œuf).
- **Huile** : la base compte la quantité habituelle ; « Peu » retire 80 kcal (9 g de lipides), « Beaucoup » ajoute 150 kcal (17 g).
- **Fourchette** affichée : −7 % / +8 % autour de l'estimation.
- **Objectifs** : Mifflin-St Jeor × activité ; masse +350 kcal et 2 g de protéines/kg, perte −450 kcal et 1,8 g/kg, forme 1,4 g/kg.

## Ce qui est en mode démo

L'app fonctionne entièrement hors ligne. Deux briques ont besoin d'un serveur pour la vraie version : la clé du modèle de vision et la clé CinetPay ne doivent **jamais** être dans l'app.

### 1. Reconnaissance des plats

Sans serveur, la reconnaissance utilise l'indice texte saisi au scanner (« garba avec poisson », « riz, sauce graine, poulet ») et, sans indice, propose un plat d'exemple. L'écran Résultat affiche alors « Mode démo ».

Pour brancher un vrai modèle de vision, définis `EXPO_PUBLIC_SCAN_API_URL` (voir `.env.example`). L'app envoie :

```json
POST { "image": "<jpeg base64>", "indice": "texte facultatif", "alimentsConnus": ["attieke", "riz-au-gras", "..."] }
```

et attend :

```json
{ "nom": "Riz au gras, poulet frit", "lignes": [{ "alimentId": "riz-au-gras", "grammes": 300 }, { "alimentId": "poulet-frit", "grammes": 140 }] }
```

Le serveur demande au modèle de choisir uniquement parmi `alimentsConnus` et d'estimer les grammes pour une portion moyenne. Les calories sont ensuite calculées par l'app à partir de la base, pas par le modèle.

### 2. Paiement Premium (CinetPay)

Sans serveur, « Payer » active l'abonnement localement (étiquette « Mode démo : aucun paiement réel »). Pour le vrai paiement, définis `EXPO_PUBLIC_PAIEMENT_API_URL` : ton serveur crée la transaction CinetPay (Mobile Money ou carte, en XOF), renvoie `{ "urlPaiement": "..." }`, puis confirme l'abonnement à la réception de la notification CinetPay.

### 3. Mode coach

Les clients sont des données d'exemple (`src/lib/coach.ts`). Il faudra des comptes et un serveur pour relier coach et clients. Le message vocal est affiché « bientôt ».

### Données

Tout est stocké sur le téléphone (AsyncStorage). Dans Profil : « Charger des repas d'exemple » remplit deux semaines pour essayer le Bilan, et « Effacer mes données » remet l'app à zéro.

## Gratuit et Premium

- Gratuit : 2 scans photo par jour, bilan de la semaine en cours. Choisir un plat dans la liste ne consomme pas de scan.
- Premium (2 000 FCFA/mois ou 20 000 FCFA/an, sans renouvellement automatique) : 30 scans par jour et l'historique des semaines passées.

## Prochaines étapes

1. Remplacer la base d'aliments par des valeurs sourcées, validées par un nutritionniste.
2. Écrire le serveur de reconnaissance (photo → aliments de la base).
3. Brancher CinetPay côté serveur.
4. Comptes utilisateurs et synchronisation (nécessaires au mode coach).
5. Construire les apps avec EAS (`npx eas-cli@latest build`).
