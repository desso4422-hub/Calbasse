# Montage des publicités

Transforme les 8 rushs sortis de Flow (4 UGC × 2 parties) en une vidéo finie : 9:16, 1080×1920,
sous-titres, zooms, motion design, volume homogène.

Une config par créative :

| Config | Vidéo produite |
| --- | --- |
| `config-perte-de-poids.json` | `calbasse-perte-de-poids-v3.mp4` |
| `config-prise-de-masse.json` | `calbasse-prise-de-masse-v1.mp4` |

Les vidéos ne sont pas versionnées (trop lourdes). Versionnés : les `.srt`, sous-titres importables dans CapCut.

## Refaire le montage

1. Remplace un rush : mets le nouveau fichier dans `rushs/` sous le même nom (`ugc1-partie1.mp4`, …).
2. Si les mots dits ont changé, corrige le `texte` du clip dans `config-perte-de-poids.json`.
3. Lance :

```bash
python3 assembler.py config-prise-de-masse.json      # ou config-perte-de-poids.json
```

Pour essayer vite un passage, ajoute `--extrait 20,32` (seules ces secondes sont dessinées).
Il faut `ffmpeg` et les paquets Python `numpy`, `Pillow` et `opencv-python-headless`.

## Les modules

| Fichier | Rôle |
| --- | --- |
| `assembler.py` | Chef d'orchestre : lit la config, calcule les temps, écrit les sous-titres, lance le son et l'image |
| `parole.py` | La voix : pauses, cadence en syllabes par seconde, minutage de chaque mot, carte de temps |
| `rendu.py` | L'image : relecture à la bonne vitesse, zooms, transitions |
| `animations.py` | Motion design : barre de progression, badge, pastilles, carte de scan, viseur, bouton WhatsApp |
| `son.py` | La piste sonore : étirement, volume, « whoosh » aux changements d'avatar |

## Comment la vitesse est uniformisée

Chaque clip est découpé en tranches de voix et de pauses. On mesure sa **cadence** (syllabes par seconde
de voix, pauses exclues) et on calcule la vitesse qui le ramène à la cadence cible
(`cadence_syllabes_par_s`, 6,1 par défaut), dans une fourchette de 0,95× à 1,35×. Les pauses sont
accélérées 3 fois. Résultat : tous les clips parlent au même rythme, et la vidéo est plus courte.

La même carte de temps sert à la voix, à l'image et aux sous-titres, donc tout reste synchrone.

## Les animations, dans la config

Chaque clip peut avoir une liste `animations`, déclenchées par un mot du texte :

```json
{"type": "pastille", "mot": "riz", "texte": "Le riz ?", "icone": "?", "style": "terre", "duree": 1.8}
{"type": "carte_scan", "mot": "photographies", "plat": "Attiéké, poisson braisé", "kcal": 615, "prot": 35, "gluc": 84, "lip": 14, "fin": "clip"}
{"type": "viseur_portion", "mot": "photographie", "mot_portion": "portion", "mot_bascule": "réduis", "mot_fin": "semaines"}
{"type": "viseur", "mot": "photographie", "mot_fin": "j'ai"}
{"type": "whatsapp", "mot": "WhatsApp", "fin": "video"}
```

- `mot` : début de l'animation ; `mot_fin`, `duree` ou `fin` (`clip` ou `video`) : sa fin.
- Une pastille reste affichée au moins 1,2 s, et rien ne déborde sur l'avatar suivant.
- La carte de scan reprend l'écran de résultat de l'app. **Ses chiffres sont ceux de la base de
  l'app, qui sont encore des valeurs d'illustration** : à remplacer par des valeurs validées.
- Un mot précédé de `~` dans le texte est dit mais pas affiché (un mot que l'IA ajoute et qu'on ne
  sait pas écrire) : il compte pour le calage, donc les sous-titres suivants ne se décalent pas.
  Le point d'une phrase se met sur le mot visible qui précède (`protéines. ~serre Je…`).
- `vitesse_min`, `vitesse_max`, `cadence_syllabes_par_s` règlent l'uniformisation. Des avatars qui
  parlent très vite demandent de laisser descendre `vitesse_min` (0,85) pour rester à la même cadence.
- `badge` (au niveau de la config) fait apparaître le logo Calbasse à partir d'un mot.
- `zoom_force` (dans un clip) impose un zoom pendant un passage : c'est ce qui cache les faux
  sous-titres que l'IA incruste parfois en bas de l'image.

## Vérifier les rushs avant de monter

- La voix court souvent jusqu'à la dernière image : un mot peut être coupé net. Dans ce cas, `fin` coupe
  juste avant le mot tronqué (ou avant la phrase si le mot est mal prononcé).
- Chercher les faux sous-titres en bas de l'image.
- Écouter le nom de la marque, qui n'est pas toujours bien prononcé.
