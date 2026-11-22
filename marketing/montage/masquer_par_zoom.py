#!/usr/bin/env python3
"""
Cache les faux sous-titres que l'IA incruste parfois en bas de l'image, par un zoom d'insistance
(« punch-in ») : pendant le passage concerné, l'image est agrandie en gardant le haut du cadre, ce qui
sort le bas — donc le faux texte — de l'écran. Le zoom monte et redescend en douceur.

  python3 masquer_par_zoom.py entree.mp4 sortie.mp4 debut fin niveau [rampe]

  debut, fin : secondes du clip pendant lesquelles le zoom est à son maximum (rampes en plus)
  niveau     : agrandissement, par exemple 1.3 (le texte doit commencer sous 1 / niveau de la hauteur)
  rampe      : durée de la montée et de la descente, 0.25 s par défaut

Pourquoi pas un flou ou une retouche : le motif chargé d'un tissu garde des traces (tache grise
ou lettres fantômes), alors qu'un cadrage plus serré ne laisse rien. L'audio est recopié tel quel.
"""
import os, subprocess, sys
import cv2
import numpy as np


def lisse(s):
    s = min(1.0, max(0.0, s))
    return s * s * (3 - 2 * s)


def main(entree, sortie, debut, fin, niveau, rampe=0.25):
    debut, fin, niveau, rampe = float(debut), float(fin), float(niveau), float(rampe)
    cap = cv2.VideoCapture(entree)
    fps = cap.get(cv2.CAP_PROP_FPS)
    W, H = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    tmp = sortie + ".sansson.mp4"
    ff = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(fps), "-i", "-",
         "-c:v", "libx264", "-crf", "12", "-preset", "slow", "-pix_fmt", "yuv420p", tmp],
        stdin=subprocess.PIPE)
    n, zoomes = 0, 0
    while True:
        ok, img = cap.read()
        if not ok:
            break
        t = n / fps
        z = 1 + (niveau - 1) * lisse((t - (debut - rampe)) / rampe) * lisse(((fin + rampe) - t) / rampe)
        if z > 1.0005:
            # Agrandissement de z autour du milieu du bord haut, interpolation de qualité
            M = np.float32([[z, 0, (1 - z) * W / 2], [0, z, 0]])
            img = cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REPLICATE)
            zoomes += 1
        ff.stdin.write(img.tobytes())
        n += 1
    ff.stdin.close(); ff.wait(); cap.release()
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", tmp, "-i", entree, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "copy", sortie], check=True)
    os.remove(tmp)
    print(f"{n} images lues, {zoomes} zoomées → {sortie}")


if __name__ == "__main__":
    main(*sys.argv[1:])
