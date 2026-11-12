# Serveur de reconnaissance Calbasse

Reçoit la photo d'une assiette, demande au modèle de vision Gemini (Google) d'identifier chaque aliment **parmi ceux de la base de l'app** (`src/lib/aliments.ts`), et renvoie les aliments, les grammes estimés, une confiance et des alternatives. Les calories sont calculées par l'app, jamais par le modèle.

## Lancer

```bash
cd server
npm install
```

```bash
GEMINI_API_KEY=... npm start
```

Crée la clé sur [Google AI Studio](https://aistudio.google.com/apikey). Puis, dans l'app, mets `EXPO_PUBLIC_API_URL=http://<adresse-de-ta-machine>:8787` dans `.env.local` et relance `npx expo start`. Sur un téléphone, utilise l'adresse IP locale de ton ordinateur, pas `localhost`.

Réglages : voir `.env.example`. Node 22.6 ou plus récent (le serveur s'exécute directement en TypeScript).

```bash
npm test
```

```bash
npm run typecheck
```

## Comment la précision est obtenue

1. **Réponse contrainte** : Gemini doit répondre en JSON selon un schéma qui n'autorise que les identifiants de la base (ou « inconnu »), et le serveur revalide la réponse. Pas d'aliment inventé, pas de calories inventées.
2. **Une description visuelle par aliment** (« Aspect »), qui nomme les confusions fréquentes : attiéké / couscous / gari, akassa / pâte blanche / ablo, igname pilée / foufou / placali, sauce graine / sauce tomate / sauce arachide… Près de 75 aliments et 25 plats d'Afrique de l'Ouest et du Centre, avec leurs noms locaux (amiwo, garba, thiéboudienne, waakye, ndolè, eru, egusi, kenkey, tô…).
3. **L'indice de l'utilisateur** (« garba bien pimenté ») est transmis comme information forte.
4. **Confiance et alternatives** : quand le modèle doute, l'aliment s'affiche en orange dans l'app et ses alternatives sont proposées en un geste. Un aliment hors base est montré comme « non reconnu », avec ce que le modèle a vu.
5. **Corrections remontées** : chaque remplacement fait dans l'app est enregistré dans `donnees/corrections.jsonl`. C'est la liste des erreurs réelles à corriger dans la base.
6. **Évaluation mesurée** : `npm run evaluer` note la reconnaissance sur tes photos étiquetées (voir `eval/LISEZ-MOI.md`). C'est le seul moyen de savoir où on en est vraiment.

Autres choix : les consignes et le catalogue (≈ 7 000 tokens) sont envoyés en premier et toujours identiques, ce qui permet au cache implicite de Gemini de les facturer moins cher ; l'app réduit la photo à 1568 px avant l'envoi.

## Modèle et coût

Par défaut : `gemini-3.8-flash` (le modèle Flash courant d'après le SDK `@google/genai` 3.2.0). Deux réglages, dans `.env` :

- `GEMINI_MODELE` : par exemple `gemini-flash-lite-latest`, encore moins cher, si la précision tient ;
- `GEMINI_REFLEXION` : `minimal`, `low`, `medium` ou `high`. Moins de réflexion = moins cher et plus rapide.

Vérifie les modèles disponibles et leurs prix sur [la page des modèles](https://ai.google.dev/gemini-api/docs/models) et [la page des tarifs](https://ai.google.dev/gemini-api/docs/pricing) : je n'ai pas pu les consulter en écrivant ce serveur. Chaque scan enregistre dans `donnees/scans.jsonl` le nombre de tokens consommés (`usage` : entrée, entrée en cache, sortie, réflexion) : multiplie par les prix de la page des tarifs pour connaître le coût réel par scan, et compare-le aux 2 000 FCFA/mois de Premium et à la limite de 30 scans par jour.

Change de modèle ou de niveau de réflexion seulement après avoir comparé la précision sur tes photos avec `npm run evaluer`.

## Déployer

N'importe quel hébergeur Node (Render, Railway, Fly.io, un VPS…) : `npm install` puis `npm start`, avec `GEMINI_API_KEY` en variable secrète. Mets le serveur derrière HTTPS. Les photos de repas sont des données personnelles : avec l'offre gratuite de l'API Gemini, Google peut utiliser les requêtes pour améliorer ses produits ; vérifie les conditions de Google et passe sur un compte payant avant d'accueillir de vrais utilisateurs. La limite par adresse IP est en mémoire : avec plusieurs instances, déplace-la vers le proxy ou une base partagée. Il n'y a pas encore de comptes : n'importe qui connaissant l'adresse peut appeler `/scan`. Il faudra authentifier les appels (compte utilisateur, ou au minimum App Check / Play Integrity) avant d'ouvrir l'app au public.
