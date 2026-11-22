"""
Tout ce qui concerne la voix : pauses, cadence, minutage des mots, et la carte de temps qui permet
de raccourcir les pauses et d'uniformiser la vitesse de parole d'un clip à l'autre.

Idée centrale : un clip est découpé en tranches « voix » et « pause ». Les tranches de voix sont
lues à une vitesse unique par clip (calculée pour que tous les clips parlent à la même cadence),
les pauses sont accélérées. La même carte sert au son, à l'image et aux sous-titres : tout reste
synchrone.
"""
import re
import subprocess
import wave

import numpy as np

FPS = 24
PAUSE_MIN = 0.12      # en dessous, c'est le souffle normal entre deux mots : on n'y touche pas
MARGE = 0.04          # on garde 40 ms de silence de chaque côté d'une pause comprimée
SEUIL_DB = 22         # une voix est « présente » jusqu'à 22 dB sous son niveau habituel


def sh(cmd, **kw):
    return subprocess.run(cmd, check=True, capture_output=True, text=True, **kw)


def duree_media(f):
    return float(sh(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(f)]).stdout)


def audio_mono(src, dest):
    sh(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-ac", "1", "-ar", "16000", str(dest)])
    with wave.open(str(dest)) as w:
        sr = w.getframerate()
        x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    return sr, x


def loudness(f):
    out = sh(["ffmpeg", "-v", "info", "-i", str(f), "-af", "ebur128", "-f", "null", "-"]).stderr
    return float(re.findall(r"I:\s+(-?[\d.]+) LUFS", out)[-1])


# ——— Syllabes ———

VOYELLES = "aeiouyàâäéèêëîïôöùûüœ"


def syllabes(mot):
    m = re.sub(r"[^a-zàâäéèêëîïôöùûüœç']", "", mot.lower())
    n = len(re.findall(f"[{VOYELLES}]+", m))
    if n > 1 and re.search(rf"[^{VOYELLES}'](e|es|ent)$", m):
        n -= 1
    return max(1, n)


# ——— Énergie, pauses ———

def enveloppe_db(x, sr, hop=0.01, win=0.03):
    n, p = int(sr * win), int(sr * hop)
    cs = np.concatenate([[0.0], np.cumsum(x.astype(np.float64) ** 2)])
    idx = np.arange(0, len(x) - n, p)
    e = (cs[idx + n] - cs[idx]) / n
    return 10 * np.log10(e + 1e-12), hop


def analyser_voix(x, sr, debut, fin):
    """Découpe [debut, fin] en tranches ('voix'|'pause', a, b) et renvoie aussi la durée de voix réelle."""
    db, h = enveloppe_db(x, sr)
    seuil = max(np.percentile(db, 95) - SEUIL_DB, -50)
    a0, b0 = int(round(debut / h)), int(round(fin / h))
    v = db[a0:b0] > seuil
    pauses, debut_p = [], None
    for i, e in enumerate(v):
        if not e and debut_p is None:
            debut_p = i
        elif e and debut_p is not None:
            if (i - debut_p) * h >= PAUSE_MIN:
                pauses.append((debut + debut_p * h, debut + i * h))
            debut_p = None
    if debut_p is not None and (len(v) - debut_p) * h >= PAUSE_MIN:
        pauses.append((debut + debut_p * h, fin))
    tranches, curseur = [], debut
    for a, b in pauses:
        ia, ib = a + MARGE, b - MARGE
        if ib - ia >= 0.04 and ia > curseur:
            tranches += [("voix", curseur, ia), ("pause", ia, ib)]
            curseur = ib
    tranches.append(("voix", curseur, fin))
    return tranches, float(v.sum() * h)


# ——— Carte de temps ———

def carte_temps(tranches, vitesse, vitesse_pause=3.0, pause_min_sortie=0.05):
    """Tranches avec leur position à la sortie. La durée totale tombe pile sur un nombre d'images."""
    durees = [((b - a) / vitesse) if t == "voix" else max(pause_min_sortie, (b - a) / vitesse_pause) for t, a, b in tranches]
    total = sum(durees)
    n = max(1, round(total * FPS))
    k = (n / FPS) / total
    carte, o = [], 0.0
    for (t, a, b), d in zip(tranches, durees):
        d *= k
        carte.append(dict(type=t, a=a, b=b, oa=o, ob=o + d))
        o += d
    return carte, n


def src_vers_sortie(t, carte):
    if t <= carte[0]["a"]:
        return carte[0]["oa"]
    for s in carte:
        if t <= s["b"]:
            return s["oa"] + (t - s["a"]) / max(1e-9, s["b"] - s["a"]) * (s["ob"] - s["oa"])
    return carte[-1]["ob"]


def sortie_vers_src(t, carte):
    if t <= 0:
        return carte[0]["a"]
    for s in carte:
        if t <= s["ob"]:
            return s["a"] + (t - s["oa"]) / max(1e-9, s["ob"] - s["oa"]) * (s["b"] - s["a"])
    return carte[-1]["b"]


# ——— Minutage des mots (dans le temps du fichier source) ———

def minutage_mots(mots, x, sr, debut, fin):
    """Début de chaque mot (et fin du dernier) : le temps de voix est partagé selon les syllabes,
    puis chaque frontière est recalée sur le creux d'énergie le plus proche (±120 ms)."""
    db, h = enveloppe_db(x, sr)
    seuil = max(np.percentile(db, 95) - 28, -55)
    i0, i1 = int(debut / h), int(fin / h)
    cumul = np.concatenate([[0], np.cumsum((db[i0:i1] > seuil).astype(float))]) * h
    total = cumul[-1] or (fin - debut)
    poids = [syllabes(m) for m in mots]
    fractions = np.cumsum([0] + poids) / sum(poids)
    t = [debut + float(np.interp(f * total, cumul, np.arange(len(cumul)) * h)) for f in fractions]
    lisse = np.convolve(db, np.ones(5) / 5, mode="same")
    for k in range(1, len(t) - 1):
        a, b = max(int((t[k] - 0.12) / h), i0 + 1), min(int((t[k] + 0.12) / h), i1 - 1)
        if b > a:
            t[k] = (a + int(np.argmin(lisse[a:b]))) * h
    t[0], t[-1] = debut, fin
    for k in range(1, len(t)):
        t[k] = max(t[k], t[k - 1] + 0.08)
    return t


def normaliser_mot(m):
    return re.sub(r"[^a-zàâäéèêëîïôöùûüœç0-9]", "", m.lower())
