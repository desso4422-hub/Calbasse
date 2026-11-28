#!/usr/bin/env python3
"""
Monte une démonstration « plat → scan » à partir de trois éléments :

  1. une vidéo Google Flow où une main tient un téléphone à ÉCRAN VERT au-dessus du plat ;
  2. un enregistrement d'écran réel de Calbasse scannant ce plat ;
  3. la photo du plat, qui remplace l'aperçu de l'appareil photo (on ne montre pas le sol filmé).

Le vert est détouré image par image : l'écran suit donc la main sans réglage manuel.

  python3 incruster.py config.json
"""
import json, math, subprocess, sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ICI = Path(__file__).resolve().parent
POLICE = ICI.parent / "montage" / "police"
FPS = 24          # remplacé par la cadence réelle de la vidéo Flow
LARGEUR, HAUTEUR = 1080, 1920


def police(nom, taille):
    return ImageFont.truetype(str(POLICE / nom), taille)


# ——— 1. L'écran du téléphone, reconstruit ———

def coins_arrondis(taille, rayon):
    m = Image.new("L", taille, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, taille[0] - 1, taille[1] - 1], rayon, fill=255)
    return m


def image_dans_apercu(base, photo, rect, zoom=1.0, assombrir=1.0):
    """Colle la photo du plat dans le rectangle d'aperçu de l'écran appareil photo."""
    x1, y1, x2, y2 = rect
    w, h = x2 - x1, y2 - y1
    cote = int(min(photo.size) / zoom)
    cx, cy = photo.size[0] // 2, photo.size[1] // 2
    vignette = photo.crop((cx - cote // 2, cy - cote // 2, cx + cote // 2, cy + cote // 2)).resize((w, h), Image.LANCZOS)
    if assombrir < 1.0:
        vignette = Image.eval(vignette, lambda v: int(v * assombrir))
    img = base.copy()
    img.paste(vignette, (x1, y1), coins_arrondis((w, h), 46))
    return img


def ecran_envoi(img, rect, angle):
    """Le voile « Envoi de la photo… » : texte blanc et petit arc qui tourne."""
    x1, y1, x2, y2 = rect
    cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
    d = ImageDraw.Draw(img)
    f = police("PlusJakartaSans_600SemiBold.ttf", 46)
    t = "Envoi de la photo…"
    lt = d.textbbox((0, 0), t, font=f)
    d.text((cx - (lt[2] - lt[0]) // 2, cy + 10), t, font=f, fill=(255, 255, 255))
    r = 34
    d.arc([cx - r, cy - 90 - r, cx + r, cy - 90 + r], angle, angle + 250, fill=(255, 255, 255), width=7)
    return img


def construire_ecran(cfg, tmp):
    """Toutes les images de l'écran du téléphone, dans l'ordre."""
    photo = Image.open(cfg["photo"]).convert("RGB")
    cap = cv2.VideoCapture(cfg["enregistrement"])

    def image_a(t):
        cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
        ok, f = cap.read()
        if not ok:
            raise SystemExit(f"image introuvable à {t} s dans l'enregistrement")
        return Image.fromarray(cv2.cvtColor(f, cv2.COLOR_BGR2RGB))

    base_cam = image_a(cfg["t_camera"])
    rect = cfg["apercu"]
    images = []

    n = int(cfg["duree_cadrage"] * FPS)
    for i in range(n):                                   # 1. on cadre le plat
        images.append(image_dans_apercu(base_cam, photo, rect, zoom=1 + 0.07 * i / n))

    n = int(cfg["duree_envoi"] * FPS)
    for i in range(n):                                   # 2. envoi de la photo
        img = image_dans_apercu(base_cam, photo, rect, zoom=1.07, assombrir=0.42)
        images.append(ecran_envoi(img, rect, (i * 14) % 360))

    n = int(cfg["duree_resultat"] * FPS)
    for i in range(n):                                   # 3. le résultat, tel que l'app l'affiche
        images.append(image_a(cfg["t_resultat"] + i / FPS))

    cap.release()
    return images


# ——— 2. L'incrustation dans l'écran vert ———

def masque_vert(f):
    b, g, r = f[..., 0].astype(int), f[..., 1].astype(int), f[..., 2].astype(int)
    return ((g > 90) & (g > r * 1.45) & (g > b * 1.35)).astype(np.uint8)


def quadrilatere(m):
    cnts, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not cnts:
        return None
    c = max(cnts, key=cv2.contourArea)
    if cv2.contourArea(c) < 3000:
        return None
    pts = cv2.boxPoints(cv2.minAreaRect(c))
    s, d = pts.sum(1), np.diff(pts, axis=1).ravel()
    return np.array([pts[s.argmin()], pts[d.argmin()], pts[s.argmax()], pts[d.argmax()]], np.float32)


def lisser(quads, fenetre=5):
    """Moyenne glissante sur les coins : supprime le tremblement du détourage."""
    sortie = []
    for i, q in enumerate(quads):
        if q is None:
            sortie.append(None)
            continue
        voisins = [quads[j] for j in range(max(0, i - fenetre), min(len(quads), i + fenetre + 1)) if quads[j] is not None]
        sortie.append(np.mean(voisins, axis=0).astype(np.float32))
    return sortie


def incruster(cfg, ecrans, tmp):
    cap = cv2.VideoCapture(cfg["flow"])
    frames = []
    while True:
        ok, f = cap.read()
        if not ok:
            break
        frames.append(f)
    cap.release()
    fps_flow = FPS
    quads = [quadrilatere(masque_vert(f)) for f in frames]
    quads = lisser(quads)
    debut = next((i for i, q in enumerate(quads) if q is not None), None)
    print(f"  vert détecté de l'image {debut} à {len(frames) - 1} ({(len(frames) - debut) / fps_flow:.1f} s)")

    sorties = []
    for i, f in enumerate(frames):
        q = quads[i]
        if q is not None:
            k = min(len(ecrans) - 1, i - debut)
            e = cv2.cvtColor(np.array(ecrans[max(0, k)]), cv2.COLOR_RGB2BGR)
            h, w = e.shape[:2]
            src = np.array([[0, 0], [w, 0], [w, h], [0, h]], np.float32)
            M = cv2.getPerspectiveTransform(src, q)
            gauchi = cv2.warpPerspective(e, M, (f.shape[1], f.shape[0]))
            m = masque_vert(f)
            m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
            m = cv2.GaussianBlur(m.astype(np.float32), (5, 5), 0)[..., None]
            f = (gauchi * m + f * (1 - m)).astype(np.uint8)
        sorties.append(f)
    return sorties


def ecrire(frames, chemin, taille):
    tmp = Path(chemin).with_suffix(".images")
    tmp.mkdir(exist_ok=True)
    for i, f in enumerate(frames):
        cv2.imwrite(str(tmp / f"f{i:05d}.png"), cv2.resize(f, taille, interpolation=cv2.INTER_LANCZOS4))
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", str(FPS), "-i", str(tmp / "f%05d.png"),
                    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", chemin], check=True)
    for p in tmp.glob("*.png"):
        p.unlink()
    tmp.rmdir()


def texte_sur(img, texte, taille=64):
    """Texte blanc cerné de noir, en haut de l'image, comme dans les publicités d'app."""
    d = ImageDraw.Draw(img)
    f = police("PlusJakartaSans_800ExtraBold.ttf", taille)
    lignes, courante = [], ""
    for mot in texte.split():
        essai = (courante + " " + mot).strip()
        if d.textbbox((0, 0), essai, font=f)[2] > LARGEUR - 140 and courante:
            lignes.append(courante)
            courante = mot
        else:
            courante = essai
    lignes.append(courante)
    y = 250
    for ligne in lignes:
        b = d.textbbox((0, 0), ligne, font=f)
        x = (LARGEUR - (b[2] - b[0])) // 2
        d.text((x, y), ligne, font=f, fill=(255, 255, 255), stroke_width=6, stroke_fill=(0, 0, 0))
        y += int(taille * 1.25)
    return img


def queue(cfg):
    """Le plan final : l'écran de résultat en grand, avec un lent rapprochement."""
    cap = cv2.VideoCapture(cfg["enregistrement"])
    cap.set(cv2.CAP_PROP_POS_MSEC, cfg["t_final"] * 1000)
    ok, f = cap.read()
    cap.release()
    if not ok:
        raise SystemExit("image finale introuvable")
    src = Image.fromarray(cv2.cvtColor(f, cv2.COLOR_BGR2RGB)).crop((0, 90, 1080, 2290))
    images = []
    n = int(cfg["duree_finale"] * FPS)
    for i in range(n):
        # l'écran occupe le bas de l'image : la bande du haut reste libre pour le texte
        h = int(1560 * (1 + 0.04 * i / n))
        w = int(src.width * h / src.height)
        vign = src.resize((w, h), Image.LANCZOS)
        fond = Image.new("RGB", (LARGEUR, HAUTEUR), (36, 22, 7))
        fond.paste(vign, ((LARGEUR - w) // 2, HAUTEUR - h + 30))
        images.append(cv2.cvtColor(np.array(fond), cv2.COLOR_RGB2BGR))
    return images


def main(cfg_path):
    cfg = json.loads(Path(cfg_path).read_text())
    base = Path(cfg_path).parent
    for c in ("flow", "enregistrement", "photo"):
        cfg[c] = str((base / cfg[c]).resolve())
    global FPS
    cap = cv2.VideoCapture(cfg["flow"])
    FPS = round(cap.get(cv2.CAP_PROP_FPS)) or 24
    cap.release()
    print(f"Cadence : {FPS} images par seconde")
    print("Écran du téléphone…")
    ecrans = construire_ecran(cfg, base)
    print(f"  {len(ecrans)} images ({len(ecrans) / FPS:.1f} s)")
    print("Incrustation dans l'écran vert…")
    frames = incruster(cfg, ecrans, base)
    frames = [cv2.resize(f, (LARGEUR, HAUTEUR), interpolation=cv2.INTER_LANCZOS4) for f in frames]
    print("Plan final…")
    frames += queue(cfg)
    print("Textes…")
    for i, f in enumerate(frames):
        t = i / FPS
        for bloc in cfg.get("textes", []):
            if bloc["de"] <= t < bloc["a"]:
                img = Image.fromarray(cv2.cvtColor(f, cv2.COLOR_BGR2RGB))
                frames[i] = cv2.cvtColor(np.array(texte_sur(img, bloc["texte"])), cv2.COLOR_RGB2BGR)
    sortie = str((base / cfg["sortie"]).resolve())
    muet = sortie.replace(".mp4", "-muet.mp4")
    ecrire(frames, muet, (LARGEUR, HAUTEUR))
    # on reprend l'ambiance sonore de la vidéo Flow, en fondu à la fin
    duree = len(frames) / FPS
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", muet, "-i", cfg["flow"], "-filter_complex",
                    f"[1:a]apad,atrim=0:{duree},afade=t=out:st={duree - 1.2}:d=1.2[a]",
                    "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-shortest", sortie], check=False)
    Path(muet).unlink(missing_ok=True)
    print("OK :", sortie)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else str(ICI / "config.json"))
