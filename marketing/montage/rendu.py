"""
Rendu de l'image : relit les rushs à la vitesse voulue, applique les zooms rythmés et les
transitions, puis dessine les animations par-dessus. Fournit les images une à une.
"""
import math

import cv2
import numpy as np

import animations as A
from parole import FPS, sortie_vers_src

W, H = 1080, 1920
ECHELLE = W / 720            # les rushs sont en 720 × 1280
ANCRE = (W / 2, 100)         # le zoom se fait vers le haut du cadre : le visage reste, le bas sort
SEQUENCES = [[1.00, 1.20, 1.06, 1.22, 1.00], [1.14, 1.00, 1.20, 1.04, 1.18]]   # large ↔ serré, jamais deux cadrages voisins
DERIVE = 0.035               # lent mouvement d'avance pendant chaque plan


def plan_zoom(duree, coupures, depart):
    """Points (temps, niveau) : un nouveau cadrage à chaque coupure, en alternant large et serré."""
    seq = SEQUENCES[depart % 2]
    return [(0.0, seq[0])] + [(t, seq[(j + 1) % len(seq)]) for j, t in enumerate(coupures)]


def niveau(t, pts, duree, ease=0.14):
    j = max(i for i, (tt, _) in enumerate(pts) if tt <= t)
    t0, L = pts[j]
    fin = pts[j + 1][0] if j + 1 < len(pts) else duree
    derive = DERIVE * (t - t0) / max(0.2, fin - t0)
    if j == 0:
        return L + derive
    precedent = pts[j - 1][1] + DERIVE
    s = A.sortie_cubique((t - t0) / ease)
    return precedent + (L - precedent) * s + derive


def zoom_force(t, force):
    """Zoom imposé (pour sortir du cadre un faux texte de l'IA) : montée et descente en douceur."""
    de, a, niv, rampe = force["de"], force["a"], force["niveau"], 0.25
    return 1 + (niv - 1) * A.lisse((t - (de - rampe)) / rampe) * A.lisse(((a + rampe) - t) / rampe)


def charger(chemin, debut, fin):
    cap = cv2.VideoCapture(chemin)
    fps = cap.get(cv2.CAP_PROP_FPS)
    f0, f1 = int(debut * fps), int(math.ceil(fin * fps)) + 1
    cap.set(cv2.CAP_PROP_POS_FRAMES, f0)
    frames = []
    for _ in range(f0, f1 + 1):
        ok, im = cap.read()
        if not ok:
            break
        frames.append(im)
    cap.release()
    return f0, fps, frames


def agrandir(src, z):
    if z < 1.0005:
        return cv2.resize(src, (W, H), interpolation=cv2.INTER_CUBIC)
    ax, ay = ANCRE
    s = ECHELLE * z
    M = np.float32([[s, 0, (1 - z) * ax], [0, s, (1 - z) * ay]])
    return cv2.warpAffine(src, M, (W, H), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)


def rendre(clips, calques, extrait=None):
    """clips : liste de dict(src, debut, fin, carte, n, coupures, force, coupe_avant, coupe_apres).
    Génère les images BGR 1080×1920. extrait=(t0, t1) : seules ces secondes sont dessinées (les autres
    images sont noires, pour accélérer les essais)."""
    noir = np.zeros((H, W, 3), np.uint8)
    t_global = 0.0
    for ci, c in enumerate(clips):
        n = c["n"]
        dure = n / FPS
        pts = plan_zoom(dure, c["coupures"], c["depart_zoom"])
        a_dessiner = extrait is None or (t_global + dure >= extrait[0] and t_global <= extrait[1])
        if not a_dessiner:
            for _ in range(n):
                yield noir
            t_global += dure
            continue
        f0, fps, frames = charger(c["src"], c["debut"], c["fin"])
        for k in range(n):
            tg = t_global + k / FPS
            if extrait is not None and not (extrait[0] <= tg <= extrait[1]):
                yield noir
                continue
            t = k / FPS
            fi = min(len(frames) - 1, max(0, int(round(sortie_vers_src(t, c["carte"]) * fps)) - f0))
            z = niveau(t, pts, dure)
            if c.get("force"):
                z = max(z, zoom_force(t, c["force"]))
            if c["coupe_avant"] and k < 6:
                z *= 1 + 0.16 * (1 - A.sortie_cubique(k / 6))
            if c["coupe_apres"] and k >= n - 4:
                z *= 1 + 0.14 * A.entree_cubique((k - (n - 4)) / 4)
            img = agrandir(frames[fi], z)
            if c["coupe_avant"] and k < 4:
                a = 0.34 * (1 - k / 4)
                img = cv2.addWeighted(img, 1 - a, np.full_like(img, 255), a, 0)
            for cal in calques:
                if cal.actif(tg):
                    cal.dessiner(img, tg)
            yield img
        t_global += dure
        del frames
