# Évaluer la reconnaissance

Aucun modèle ne reconnaît « parfaitement » toutes les assiettes du premier coup. Ce qui est possible, c'est de **mesurer** la précision sur de vraies photos, de voir où le modèle se trompe et de corriger : descriptions « Aspect » de la base, nouveaux aliments, réglages. Ce dossier sert à ça.

## 1. Rassembler les photos

Mets dans `eval/photos/` des photos **réelles** de repas, prises au téléphone comme le feront les utilisateurs : vue de dessus, lumière de cuisine ou de maquis, assiettes en plastique, plats emballés à emporter… Vise au moins 100 photos au départ, avec plusieurs fois chaque plat courant et les paires faciles à confondre (attiéké et couscous, akassa et pâte blanche, sauce graine et sauce tomate, etc.).

Le dossier `photos/` n'est pas versionné (voir `.gitignore`). Ne mets que des photos dont tu as le droit de te servir.

## 2. Étiqueter

`eval/etiquettes.json` (copie `etiquettes.exemple.json`) :

```json
{
  "garba-maquis-1.jpg": { "aliments": ["attieke", "thon-frit", "piment"] },
  "amiwo-poulet.jpg": { "aliments": ["pate-rouge", "poulet-frit"], "grammes": { "pate-rouge": 320, "poulet-frit": 150 } },
  "riz-sauce-graine.jpg": { "indice": "riz sauce graine", "aliments": ["riz-blanc", "sauce-graine", "poisson-fume"] }
}
```

- `aliments` : identifiants de `src/lib/aliments.ts` (le script refuse un identifiant inconnu).
- `grammes` (facultatif) : poids pesés avant de manger, pour mesurer l'estimation des portions.
- `indice` (facultatif) : ce qu'un utilisateur aurait tapé. Garde la majorité des photos **sans** indice : c'est le cas difficile.

## 3. Lancer

```bash
ANTHROPIC_API_KEY=... npm run evaluer
```

Le script affiche :

- **Assiettes entièrement justes** : la mesure la plus exigeante.
- **Précision / rappel** par aliment.
- **Rappel avec alternatives** : ce que l'utilisateur obtient en un geste dans l'app.
- **Écart médian sur les grammes**.
- **Confusions fréquentes** : par exemple `attieke → couscous-mil` veut dire qu'on a pris de l'attiéké pour du couscous. Corrige alors les descriptions « Aspect » des deux aliments, puis relance.

Chaque photo est un appel payant. Compare les réglages un par un (`CALBASSE_EFFORT=high`, un autre `CALBASSE_MODELE`) sur le même jeu de photos avant de changer la configuration du serveur.

## 4. Nourrir le jeu de photos avec l'usage réel

Le serveur enregistre chaque correction faite dans l'app (`donnees/corrections.jsonl`) : quel aliment a été proposé, lequel l'utilisateur a gardé. Avec `GARDER_PHOTOS=1`, il garde aussi la photo, **seulement si tes conditions d'utilisation le prévoient et que l'utilisateur a donné son accord**. Ces cas corrigés sont les meilleures photos à ajouter au jeu d'évaluation.
