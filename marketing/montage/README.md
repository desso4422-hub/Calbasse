# Montage des publicités

Transforme les 8 rushs sortis de Flow (4 UGC × 2 parties) en une vidéo finie : 9:16, 1080×1920,
sous-titres, volume homogène. Résultat : `calbasse-perte-de-poids-v2.mp4` (non versionné : trop lourd)
et `calbasse-perte-de-poids-v2.srt` (sous-titres, importables dans CapCut pour les retoucher).

## Refaire le montage après avoir remplacé un rush

1. Mets le nouveau fichier dans `rushs/` sous le même nom (`ugc1-partie1.mp4`, …).
2. Si les mots dits ont changé, corrige le champ `texte` du clip dans `config-perte-de-poids.json`.
3. Lance :

```bash
python3 assembler.py config-perte-de-poids.json
```

Il faut `ffmpeg`, et les paquets Python `numpy`, `Pillow` et `opencv-python-headless`.

## Ce que fait `assembler.py`

- **Coupe** chaque rush au début et à la fin de la voix (`debut`, `fin` dans la config).
- **Sous-titres** : les mots affichés sont ceux réellement dits, pas ceux du script prévu. Chaque
  mot reçoit sa part du temps de parole en proportion de ses syllabes, recalée sur la pause la plus
  proche. Groupes de 3-4 mots, mot prononcé en jaune, police Plus Jakarta Sans de la marque.
- **Volume** : chaque morceau est ramené au même niveau, puis l'ensemble est normalisé à −16 LUFS.
- **Export** H.264 + AAC, image à 24 par seconde.

## Ce que fait `masquer_par_zoom.py`

L'IA incruste parfois de faux sous-titres illisibles en bas de l'image. Un flou laisse une tache
et une retouche laisse des lettres fantômes sur un tissu à motifs ; le script fait plutôt un zoom
d'insistance (1,3×, en douceur) pendant le passage concerné, ce qui sort le bas du cadre.

```bash
python3 masquer_par_zoom.py rushs/ugc3-partie1.mp4 rushs/ugc3-partie1-propre.mp4 4.45 5.95 1.3
```

## Vérifier les rushs avant de monter

Regarder la fin de chaque clip : la voix court souvent jusqu'à la dernière image, et un mot
peut être coupé net. Dans ce cas, `fin` dans la config coupe juste avant le mot tronqué.
