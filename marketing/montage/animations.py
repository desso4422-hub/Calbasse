"""
Motion design : les éléments animés dessinés par-dessus la vidéo.

Chaque élément est un « calque » avec un temps de début et de fin (en secondes sur toute la vidéo) et
une méthode dessiner(image, t). Les éléments sont dessinés en double résolution puis réduits, pour
des bords nets. Les couleurs sont celles de la marque.
"""
import math
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

W, H = 1080, 1920
DOSSIER = Path(__file__).resolve().parent / "police"

TERRE = (176, 74, 28)
TERRE_F = (122, 52, 22)
TERRE_D = (248, 227, 212)
FEUILLE = (46, 107, 62)
FEUILLE_D = (226, 240, 226)
ENCRE = (43, 24, 16)
ENCRE2 = (107, 84, 68)
SABLE = (243, 230, 203)
SABLE_C = (233, 211, 186)
PECHE = (255, 201, 166)
BLANC = (255, 255, 255)
VERT_WA = (37, 211, 102)

_polices = {}


def police(style, taille):
    cle = (style, taille)
    if cle not in _polices:
        nom = {"xb": "PlusJakartaSans_800ExtraBold.ttf", "b": "PlusJakartaSans_700Bold.ttf", "sb": "PlusJakartaSans_600SemiBold.ttf"}[style]
        _polices[cle] = ImageFont.truetype(str(DOSSIER / nom), taille)
    return _polices[cle]


# ——— Courbes d'animation ———

def borne(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def sortie_cubique(s):
    s = borne(s)
    return 1 - (1 - s) ** 3


def entree_cubique(s):
    return borne(s) ** 3


def lisse(s):
    s = borne(s)
    return s * s * (3 - 2 * s)


def ressort(s):
    """0 → 1 avec un léger dépassement (effet « pop »)."""
    s = borne(s)
    return 1 - math.exp(-8 * s) * math.cos(9 * s)


def entree(t, t0, duree=0.4):
    """(échelle, opacité) d'un élément qui apparaît avec un pop."""
    s = (t - t0) / duree
    if s <= 0:
        return 0.0, 0.0
    return max(0.0, ressort(s)), borne(s * 5)


def sortie(t, t1, duree=0.25):
    """(échelle, opacité) d'un élément qui disparaît."""
    s = (t - (t1 - duree)) / duree
    if s <= 0:
        return 1.0, 1.0
    return 1 - 0.12 * lisse(s), 1 - lisse(s)


# ——— Dessin ———

def toile(w, h):
    img = Image.new("RGBA", (w * 2, h * 2), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)


def vers_premultiplie(img):
    a = np.asarray(img, dtype=np.float32)
    al = a[..., 3:4] / 255.0
    return np.concatenate([a[..., :3] * al, al * 255.0], axis=2)


def poser(image, sprite, cx, cy, echelle=1.0, opacite=1.0):
    """Pose un sprite (dessiné en double résolution) centré en (cx, cy) sur l'image BGR."""
    if opacite <= 0.003 or echelle <= 0.003:
        return
    p = sprite if isinstance(sprite, np.ndarray) else vers_premultiplie(sprite)
    f = 0.5 * echelle
    h0, w0 = p.shape[:2]
    p = cv2.resize(p, (max(1, int(w0 * f)), max(1, int(h0 * f))), interpolation=cv2.INTER_AREA if f < 1 else cv2.INTER_LINEAR)
    h, w = p.shape[:2]
    x0, y0 = int(round(cx - w / 2)), int(round(cy - h / 2))
    X0, Y0, X1, Y1 = max(0, x0), max(0, y0), min(W, x0 + w), min(H, y0 + h)
    if X1 <= X0 or Y1 <= Y0:
        return
    sub = p[Y0 - y0:Y1 - y0, X0 - x0:X1 - x0]
    a = sub[..., 3:4] / 255.0 * opacite
    bgr = sub[..., :3][..., ::-1] * opacite
    dst = image[Y0:Y1, X0:X1].astype(np.float32)
    image[Y0:Y1, X0:X1] = np.clip(dst * (1 - a) + bgr, 0, 255).astype(np.uint8)


def ombre(img, dy=14, flou=22, opacite=0.38):
    """Ombre portée sous un sprite RGBA (double résolution)."""
    alpha = np.asarray(img)[..., 3]
    dec = np.zeros_like(alpha)
    dec[dy:] = alpha[:-dy] if dy else alpha
    dec = cv2.GaussianBlur(dec, (0, 0), flou)
    s = np.zeros(img.size[::-1] + (4,), np.uint8)
    s[..., 3] = (dec * opacite).astype(np.uint8)
    base = Image.fromarray(s, "RGBA")
    base.alpha_composite(img)
    return base


def texte_centre(d, cx, cy, txt, fnt, fill):
    d.text((cx, cy), txt, font=fnt, fill=fill, anchor="mm")


# ——— Éléments ———

class Calque:
    def __init__(self, t0, t1):
        self.t0, self.t1 = t0, t1

    def actif(self, t):
        return self.t0 <= t <= self.t1 + 0.05

    def dessiner(self, image, t):
        raise NotImplementedError


class BarreProgression(Calque):
    """Une barre par avatar, comme les « stories » : on voit où on en est dans la vidéo."""

    def __init__(self, segments, t_fin):
        super().__init__(0, t_fin)
        self.segments = segments

    def dessiner(self, image, t):
        x0, x1, y = 70, 1010, 74
        total = sum(b - a for a, b in self.segments)
        ecart = 10
        largeur = (x1 - x0) - ecart * (len(self.segments) - 1)
        cx = x0
        sp, d = toile(W, 40)
        for a, b in self.segments:
            w = largeur * (b - a) / total
            d.rounded_rectangle((cx * 2, 6, (cx + w) * 2, 6 + 28), radius=14, fill=(255, 255, 255, 115))
            p = borne((t - a) / (b - a))
            if p > 0:
                d.rounded_rectangle((cx * 2, 6, (cx + w * p) * 2, 6 + 28), radius=14, fill=PECHE + (255,))
            cx += w + ecart
        poser(image, sp, W / 2, y)


class Badge(Calque):
    """Pastille de marque en haut à gauche : logo + nom."""

    def __init__(self, t0, t1):
        super().__init__(t0, t1)
        img, d = toile(330, 96)
        d.rounded_rectangle((0, 0, 330 * 2 - 1, 96 * 2 - 1), radius=96, fill=ENCRE + (200,))
        logo = Image.open(DOSSIER / "logo-rond.png").convert("RGBA").resize((130, 130), Image.LANCZOS)
        img.alpha_composite(logo, (16, 31))
        d.text((178, 96), "Calbasse", font=police("xb", 64), fill=BLANC, anchor="lm")
        self.sprite = vers_premultiplie(ombre(img, 8, 14, 0.3))

    def dessiner(self, image, t):
        e, o = entree(t, self.t0, 0.42)
        poser(image, self.sprite, 70 + 330 / 2, 150, e, o)


class Pastille(Calque):
    """Petit autocollant qui illustre ce qui vient d'être dit (« Le riz ? », « L'huile »…)."""

    STYLES = {
        "terre": (TERRE_D, TERRE_F, TERRE),
        "alerte": (TERRE, BLANC, TERRE_F),
        "ok": (FEUILLE_D, FEUILLE, FEUILLE),
        "nuit": (ENCRE, SABLE, PECHE),
    }

    def __init__(self, t0, t1, texte, cy=1480, style="terre", icone="?", cx=W / 2, inclinaison=0.0):
        super().__init__(t0, t1)
        self.cy, self.cx = cy, cx
        fond, encre, accent = self.STYLES[style]
        fnt = police("xb", 112)
        l = fnt.getlength(texte)
        w = int(l + 260)
        h = 200
        img, d = toile(w // 2 + 8, h // 2)
        d.rounded_rectangle((0, 0, w - 1, h - 1), radius=h // 2, fill=fond + (255,), outline=accent + (255,), width=8)
        d.ellipse((26, 26, 26 + 148, 26 + 148), fill=accent + (255,))
        gx, gy = 26 + 74, 26 + 74
        if icone == "check":
            d.line([(gx - 36, gy + 2), (gx - 10, gy + 30), (gx + 38, gy - 30)], fill=BLANC + (255,), width=18, joint="curve")
        else:
            d.text((gx, gy + 3), icone, font=police("xb", 100), fill=BLANC + (255,), anchor="mm")
        d.text((208, h // 2 + 3), texte, font=fnt, fill=encre + (255,), anchor="lm")
        if inclinaison:
            img = img.rotate(inclinaison, resample=Image.BICUBIC, expand=True)
        self.sprite = vers_premultiplie(ombre(img, 12, 18, 0.32))

    def dessiner(self, image, t):
        e, o = entree(t, self.t0, 0.38)
        e2, o2 = sortie(t, self.t1, 0.25)
        poser(image, self.sprite, self.cx, self.cy, e * e2, o * o2)


class CarteScan(Calque):
    """Reproduit l'écran de résultat de l'app : plat reconnu, calories qui montent, trois nutriments."""

    L, HAUT = 900, 430

    def __init__(self, t0, t1, plat, kcal, prot, gluc, lip, cy=1560):
        super().__init__(t0, t1)
        self.plat, self.kcal, self.macros, self.cy = plat, kcal, [("Protéines", prot), ("Glucides", gluc), ("Lipides", lip)], cy
        self._assiette = self._dessiner_assiette(190)

    @staticmethod
    def _dessiner_assiette(taille):
        img = Image.new("RGBA", (150, 150), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        d.ellipse((0, 0, 149, 149), fill=SABLE + (255,))
        d.ellipse((13, 13, 136, 136), fill=BLANC + (255,))
        d.ellipse((24, 50, 88, 112), fill=(240, 226, 176, 255))
        d.arc((28, 62, 70, 100), 200, 330, fill=(206, 180, 110, 255), width=3)
        d.ellipse((74, 30, 130, 64), fill=(140, 100, 70, 255))
        d.ellipse((84, 36, 112, 46), fill=(176, 138, 104, 255))
        return img.resize((taille, taille), Image.LANCZOS)

    def dessiner(self, image, t):
        u = t - self.t0
        e, o = entree(t, self.t0, 0.5)
        e2, o2 = sortie(t, self.t1, 0.3)
        sp, d = toile(self.L, self.HAUT)
        W2, H2 = self.L * 2, self.HAUT * 2
        d.rounded_rectangle((0, 0, W2 - 1, H2 - 1), radius=72, fill=ENCRE + (255,))
        # Le plat reconnu
        sp.alpha_composite(self._assiette, (54, 46))
        d.text((280, 98), self.plat, font=police("xb", 62), fill=SABLE + (255,), anchor="lm")
        d.ellipse((280, 150, 322, 192), fill=FEUILLE + (255,))
        d.line([(290, 172), (298, 181), (313, 162)], fill=BLANC + (255,), width=6, joint="curve")
        d.text((338, 172), "Plat reconnu", font=police("b", 42), fill=SABLE_C + (255,), anchor="lm")
        # Calories : le compteur monte
        n = int(round(self.kcal * sortie_cubique((u - 0.3) / 1.0)))
        d.text((60, 300), "Calories", font=police("b", 44), fill=SABLE_C + (255,), anchor="lm")
        nombre = f"{n}"
        fn = police("xb", 188)
        d.text((60, 430), nombre, font=fn, fill=PECHE + (255,), anchor="lm")
        d.text((60 + fn.getlength(f"{self.kcal}") + 26, 452), "kcal", font=police("b", 72), fill=PECHE + (255,), anchor="lm")
        # Séparateur, puis les trois nutriments qui apparaissent un à un
        d.line([(60, 560), (W2 - 60, 560)], fill=(74, 51, 34, 255), width=3)
        col = (W2 - 120) / 3
        for i, (nom, val) in enumerate(self.macros):
            s = borne((u - (0.75 + 0.2 * i)) / 0.35)
            if s <= 0:
                continue
            ye = (1 - sortie_cubique(s)) * 26
            x = 60 + col * i
            a = int(255 * borne(s * 3))
            d.text((x, 626 + ye), nom, font=police("b", 44), fill=SABLE_C + (a,), anchor="lm")
            d.text((x, 730 + ye), f"{val}", font=police("xb", 100), fill=SABLE + (a,), anchor="lm")
            d.text((x + police("xb", 100).getlength(f"{val}") + 12, 746 + ye), "g", font=police("b", 52), fill=SABLE_C + (a,), anchor="lm")
        # Balayage lumineux à l'apparition
        bal = borne((u - 0.08) / 0.55)
        if 0 < bal < 1:
            bande = Image.new("RGBA", sp.size, (0, 0, 0, 0))
            bx = int(-200 + (W2 + 400) * lisse(bal))
            ImageDraw.Draw(bande).polygon([(bx, 0), (bx + 150, 0), (bx + 60, H2), (bx - 90, H2)], fill=PECHE + (70,))
            masque = Image.new("L", sp.size, 0)
            ImageDraw.Draw(masque).rounded_rectangle((0, 0, W2 - 1, H2 - 1), radius=72, fill=255)
            bande.putalpha(Image.fromarray(np.minimum(np.asarray(bande)[..., 3], np.asarray(masque))))
            sp.alpha_composite(bande)
        sp = ombre(sp, 16, 26, 0.4)
        dy = (1 - sortie_cubique((t - self.t0) / 0.45)) * 160
        poser(image, sp, W / 2, self.cy + dy, e * e2, o * o2)


class ViseurPortion(Calque):
    """Viseur qui scanne le plat, puis le sélecteur de portion de l'app (Petite / Moyenne / Grande)."""

    def __init__(self, t0, t1, t_portion, t_bascule, cy=1560):
        super().__init__(t0, t1)
        self.t_portion, self.t_bascule, self.cy = t_portion, t_bascule, cy

    def _viseur(self, u):
        l, h = 860, 380
        sp, d = toile(l, h)
        gonfle = 6 * math.sin(u * 7)
        x0, y0, x1, y1 = 14 - gonfle, 14 - gonfle, l * 2 - 14 + gonfle, h * 2 - 14 + gonfle
        for (cx, cy, sx, sy) in [(x0, y0, 1, 1), (x1, y0, -1, 1), (x0, y1, 1, -1), (x1, y1, -1, -1)]:
            d.line([(cx + sx * 120, cy), (cx, cy), (cx, cy + sy * 120)], fill=BLANC + (255,), width=18, joint="curve")
            for px, py in [(cx + sx * 120, cy), (cx, cy + sy * 120)]:
                d.ellipse((px - 9, py - 9, px + 9, py + 9), fill=BLANC + (255,))
        # Ligne de balayage
        p = (u * 0.9) % 1.0
        p = 1 - abs(2 * p - 1)
        y = y0 + 20 + (y1 - y0 - 40) * lisse(p)
        d.rounded_rectangle((x0 + 30, y - 5, x1 - 30, y + 5), radius=5, fill=PECHE + (255,))
        glow = np.zeros((h * 2, l * 2, 4), np.uint8)
        ya, yb = max(0, int(y) - 40), min(h * 2, int(y) + 40)
        glow[ya:yb, int(x0 + 30):int(x1 - 30), :3] = PECHE
        glow[ya:yb, int(x0 + 30):int(x1 - 30), 3] = 55
        glow = cv2.GaussianBlur(glow, (0, 0), 18)
        g = Image.fromarray(glow, "RGBA")
        g.alpha_composite(sp)
        # Étiquette
        d2 = ImageDraw.Draw(g)
        d2.rounded_rectangle((l - 250, 0, l + 250, 112), radius=56, fill=ENCRE + (235,))
        d2.text((l, 56), "Analyse du plat…", font=police("xb", 58), fill=SABLE + (255,), anchor="mm")
        return g

    def _selecteur(self, u, t):
        l, h = 880, 150
        sp, d = toile(l, h)
        d.rounded_rectangle((0, 0, l * 2 - 1, h * 2 - 1), radius=h, fill=SABLE + (255,))
        d.rounded_rectangle((0, 0, l * 2 - 1, h * 2 - 1), radius=h, outline=SABLE_C + (255,), width=5)
        marge, lc = 14, (l * 2 - 28) / 3
        # Le pavé sélectionné glisse de « Moyenne » à « Petite »
        s = lisse((t - self.t_bascule) / 0.45)
        pos = 1 - s
        x = marge + lc * pos
        d.rounded_rectangle((x, marge, x + lc, h * 2 - marge), radius=h - marge, fill=ENCRE + (255,))
        for i, nom in enumerate(["Petite", "Moyenne", "Grande"]):
            proche = 1 - borne(abs(i - pos))
            fond = tuple(int(ENCRE2[k] + (BLANC[k] - ENCRE2[k]) * proche) for k in range(3))
            d.text((marge + lc * (i + 0.5), h), nom, font=police("xb", 66), fill=fond + (255,), anchor="mm")
        titre, d3 = toile(l, 60)
        d3.text((12, 30), "Portion", font=police("xb", 60), fill=BLANC + (255,), anchor="lm")
        out = Image.new("RGBA", (l * 2, (h + 60) * 2 + 40), (0, 0, 0, 0))
        out.alpha_composite(ombre(titre, 4, 8, 0.6).crop((0, 0, l * 2, 120)), (0, 0))
        out.alpha_composite(sp, (0, 130))
        return out

    def dessiner(self, image, t):
        if t < self.t_portion:
            e, o = entree(t, self.t0, 0.35)
            e2, o2 = sortie(t, self.t_portion, 0.18)
            poser(image, self._viseur(t - self.t0), W / 2, self.cy, e * e2, o * o2)
        else:
            e, o = entree(t, self.t_portion, 0.4)
            e2, o2 = sortie(t, self.t1, 0.3)
            poser(image, self._selecteur(t - self.t_portion, t), W / 2, self.cy, e * e2, o * o2)


class BoutonWhatsApp(Calque):
    """Bouton vert qui pulse, avec des chevrons qui indiquent le bouton d'action en bas."""

    def __init__(self, t0, t1, cy=1520, texte="Écris-nous sur WhatsApp"):
        super().__init__(t0, t1)
        self.cy = cy
        l, h = 900, 150
        img, d = toile(l, h)
        d.rounded_rectangle((0, 0, l * 2 - 1, h * 2 - 1), radius=h, fill=VERT_WA + (255,))
        d.rounded_rectangle((0, h, l * 2 - 1, h * 2 - 1), radius=h, fill=(30, 190, 92, 120))
        d.rounded_rectangle((0, 0, l * 2 - 1, h * 2 - 1), radius=h, outline=(255, 255, 255, 90), width=4)
        # Bulle de discussion
        bx, by = 120, h
        d.ellipse((bx - 70, by - 66, bx + 70, by + 62), fill=BLANC + (255,))
        d.polygon([(bx - 50, by + 40), (bx - 84, by + 84), (bx - 8, by + 56)], fill=BLANC + (255,))
        for k in (-34, 0, 34):
            d.ellipse((bx + k - 11, by - 14, bx + k + 11, by + 8), fill=VERT_WA + (255,))
        d.text((230, h + 4), texte, font=police("xb", 86), fill=BLANC + (255,), anchor="lm")
        self.sprite = vers_premultiplie(ombre(img, 16, 24, 0.4))
        c, dc = toile(160, 90)
        dc.line([(30, 20), (160, 70), (290, 20)], fill=BLANC + (255,), width=26, joint="curve")
        for x, y in [(30, 20), (290, 20)]:
            dc.ellipse((x - 13, y - 13, x + 13, y + 13), fill=BLANC + (255,))
        self.chevron = vers_premultiplie(ombre(c, 6, 10, 0.5))

    def dessiner(self, image, t):
        e, o = entree(t, self.t0, 0.5)
        e2, o2 = sortie(t, self.t1, 0.25)
        u = t - self.t0
        pouls = 1 + 0.035 * math.sin(u * 7.0) * borne(u / 0.8)
        poser(image, self.sprite, W / 2, self.cy, e * e2 * pouls, o * o2)
        # Chevrons qui coulent vers le bas, en décalé
        for k in range(2):
            ph = ((u * 1.15) - k * 0.22) % 1.0
            a = math.sin(ph * math.pi) * o * o2
            poser(image, self.chevron, W / 2, self.cy + 140 + k * 58 + ph * 18, 1.0, a)
