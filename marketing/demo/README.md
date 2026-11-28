# Démonstration « plat → scan »

Une vidéo courte où une main tient un téléphone au-dessus d'un plat, et où l'écran du téléphone
montre Calbasse en train de scanner ce plat. Le modèle est la publicité de Cal AI.

Trois éléments entrent, une vidéo sort :

| Élément | D'où il vient |
| --- | --- |
| `flow-<plat>.mp4` | Google Flow : une main tient un téléphone à **écran vert** au-dessus du plat |
| `ecran-<plat>.mp4` | un enregistrement d'écran réel de Calbasse scannant ce plat |
| `plat-<plat>.jpg` | la photo du plat, celle qu'on a donnée à Flow et scannée dans l'app |

```bash
python3 incruster.py config.json
```

Le script détoure le vert image par image : l'écran suit la main tout seul, sans réglage manuel.
Il reconstruit aussi l'écran de l'appareil photo en y collant la photo du plat, ce qui évite de
montrer ce que la caméra filmait vraiment au moment de l'enregistrement.

## La vidéo Flow

Prompt dans `../ugc-demo-plat.md`. Ce qui compte : le téléphone **vertical**, présent tôt dans le
plan, immobile jusqu'à la fin, et un écran **vert vif uni** sans reflet ni interface. Importer une
photo déjà au format 9:16, sinon Veo invente ce qui manque autour (une deuxième assiette, par exemple).

## L'enregistrement d'écran

Dans l'app installée, pas dans le navigateur. Scanner **la même photo** que celle donnée à Flow.
Laisser le résultat affiché, puis faire défiler jusqu'à la carte des calories : c'est le plan final.

## La configuration

| Clé | Rôle |
| --- | --- |
| `apercu` | le rectangle de l'aperçu photo dans l'écran de l'app, en pixels de l'enregistrement |
| `t_camera` | un instant où l'écran appareil photo est affiché (sa photo sera remplacée) |
| `t_resultat` | l'instant où le résultat apparaît |
| `t_final`, `duree_finale` | l'image du plan final, carte des calories visible |
| `textes` | les phrases incrustées, avec leurs secondes de début et de fin |

Les vidéos et les photos ne sont pas versionnées : seuls le script, la configuration et ce texte le sont.
