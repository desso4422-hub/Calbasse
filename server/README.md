# Serveur de reconnaissance Calbasse

Reçoit la photo d'une assiette, demande au modèle de vision Claude d'identifier chaque aliment **parmi ceux de la base de l'app** (`src/lib/aliments.ts`), et renvoie les aliments, les grammes estimés, une confiance et des alternatives. Les calories sont calculées par l'app, jamais par le modèle.

## Lancer

```bash
cd server
npm install
```

```bash
ANTHROPIC_API_KEY=sk-ant-... npm start
```

Puis, dans l'app, mets `EXPO_PUBLIC_API_URL=http://<adresse-de-ta-machine>:8787` dans `.env.local` et relance `npx expo start`. Sur un téléphone, utilise l'adresse IP locale de ton ordinateur, pas `localhost`.

Réglages : voir `.env.example`. Node 22.6 ou plus récent (le serveur s'exécute directement en TypeScript).

```bash
npm test
```

```bash
npm run typecheck
```

## Comment la précision est obtenue

1. **Réponse contrainte** : grâce aux *structured outputs*, le modèle ne peut répondre qu'avec un identifiant de la base (ou « inconnu »). Pas d'aliment inventé, pas de calories inventées.
2. **Une description visuelle par aliment** (« Aspect »), qui nomme les confusions fréquentes : attiéké / couscous / gari, akassa / pâte blanche / ablo, igname pilée / foufou / placali, sauce graine / sauce tomate / sauce arachide… Près de 75 aliments et 25 plats d'Afrique de l'Ouest et du Centre, avec leurs noms locaux (amiwo, garba, thiéboudienne, waakye, ndolè, eru, egusi, kenkey, tô…).
3. **L'indice de l'utilisateur** (« garba bien pimenté ») est transmis comme information forte.
4. **Confiance et alternatives** : quand le modèle doute, l'aliment s'affiche en orange dans l'app et ses alternatives sont proposées en un geste. Un aliment hors base est montré comme « non reconnu », avec ce que le modèle a vu.
5. **Corrections remontées** : chaque remplacement fait dans l'app est enregistré dans `donnees/corrections.jsonl`. C'est la liste des erreurs réelles à corriger dans la base.
6. **Évaluation mesurée** : `npm run evaluer` note la reconnaissance sur tes photos étiquetées (voir `eval/LISEZ-MOI.md`). C'est le seul moyen de savoir où on en est vraiment.

Autres choix : le catalogue (≈ 7 000 tokens) est mis en cache entre les requêtes ; si le modèle décline une image, l'API la relance sur un modèle de repli (`fallbacks: "default"`) ; l'app réduit la photo à 1568 px avant l'envoi.

## Coût : à surveiller de près

Chaque scan est un appel payant au modèle (`claude-opus-5-5` par défaut : 4 $ par million de tokens en entrée, 20 $ en sortie, lecture du cache à 0,20 $). Ordre de grandeur, **à vérifier** avec les vrais chiffres que le serveur enregistre (champ `usage` de `donnees/scans.jsonl`) : quelques centimes de dollar par scan, soit environ 20 à 45 FCFA.

Rapporté aux prix de l'app :

- un utilisateur Premium à 2 000 FCFA/mois qui scanne 3 repas par jour (≈ 90 scans) coûte grosso modo 2 000 à 4 000 FCFA ;
- la limite actuelle de 30 scans par jour permet jusqu'à 900 scans par mois.

Avant le lancement, il faut donc mesurer (avec `npm run evaluer`) si un modèle moins cher garde une précision suffisante (`CALBASSE_MODELE=claude-sonnet-5-5` ou `claude-haiku-5-5`, effort `low`), et revoir la limite de scans ou le prix.

## Déployer

N'importe quel hébergeur Node (Render, Railway, Fly.io, un VPS…) : `npm install` puis `npm start`, avec `ANTHROPIC_API_KEY` en variable secrète. Mets le serveur derrière HTTPS. La limite par adresse IP est en mémoire : avec plusieurs instances, déplace-la vers le proxy ou une base partagée. Il n'y a pas encore de comptes : n'importe qui connaissant l'adresse peut appeler `/scan`. Il faudra authentifier les appels (compte utilisateur, ou au minimum App Check / Play Integrity) avant d'ouvrir l'app au public.
