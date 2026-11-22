#!/usr/bin/env python3
"""
Assemble une créative UGC à partir des rushs générés dans Flow (VEO) : 4 UGC × 2 parties.

  python3 assembler.py config.json

Ce que fait le script, dans l'ordre :
  1. coupe chaque rush au début et à la fin de la voix (bornes lues dans la config) ;
  2. (en amont) masque_par_zoom.py cache les faux sous-titres que l'IA incruste parfois dans l'image ;
  3. cale les sous-titres sur la voix : chaque mot reçoit sa part du temps de parole, en
     proportion de ses syllabes, puis est recalé sur la pause la plus proche ;
  4. égalise le volume de chaque morceau, puis normalise l'ensemble (-16 LUFS, norme des réseaux) ;
  5. exporte en 1080×1920 (9:16), H.264 + AAC, plus le fichier .srt pour retoucher dans CapCut.

Le script ne devine pas ce qui est dit : les textes affichés viennent de la config, écrits
d'après la transcription réelle du son (et non d'après le script prévu, car l'IA s'écarte parfois
d'un mot ou deux).
"""
import json, math, re, subprocess, sys, wave
from pathlib import Path

import numpy as np
from PIL import ImageFont

W, H = 1080, 1920
FPS = 24
COULEUR_TEXTE = "&H00FFFFFF"       # blanc (ASS : BGR)
COULEUR_MOT = "&H0078C8FF"         # mot prononcé : jaune chaud
COULEUR_CONTOUR = "&H00101828"     # brun très foncé de la marque
POLICE = "Plus Jakarta Sans ExtraBold"
TAILLE = 100                       # taille ASS : hauteur de ligne en pixels d'une vidéo 1080×1920
Y_SOUS_TITRES = 1250               # ~65 % de la hauteur : sous le visage, au-dessus de l'interface des réseaux
LARGEUR_MAX = 900                  # une ligne de sous-titres ne dépasse jamais cette largeur (marges de 90 px)
MAX_MOTS = 4


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


# ——— Syllabes et minutage des mots ———

VOYELLES = "aeiouyàâäéèêëîïôöùûüœ"


def syllabes(mot):
    m = re.sub(r"[^a-zàâäéèêëîïôöùûüœç']", "", mot.lower())
    n = len(re.findall(f"[{VOYELLES}]+", m))
    if n > 1 and re.search(rf"[^{VOYELLES}'](e|es|ent)$", m):
        n -= 1
    return max(1, n)


def minutage_mots(mots, x, sr, debut, fin):
    """Temps de début de chaque mot (et fin du dernier) dans [debut, fin], d'après l'énergie de la voix."""
    hop = 0.01
    n = int(sr * 0.03)
    pas = int(sr * hop)
    rms = np.array([math.sqrt(float(np.mean(x[i:i + n] ** 2)) + 1e-12) for i in range(0, len(x) - n, pas)])
    db = 20 * np.log10(rms + 1e-9)
    seuil = max(np.percentile(db, 95) - 28, -55)
    voix = (db > seuil).astype(float)
    i0, i1 = int(debut / hop), int(fin / hop)
    voix_seg = voix[i0:i1]
    cumul = np.concatenate([[0], np.cumsum(voix_seg)]) * hop
    total = cumul[-1] or (fin - debut)
    poids = [syllabes(m) for m in mots]
    s = sum(poids)
    bornes_frac = np.cumsum([0] + poids) / s
    t = [debut + float(np.interp(f * total, cumul, np.arange(len(cumul)) * hop)) for f in bornes_frac]
    # Recaler chaque frontière sur le creux d'énergie le plus proche (±120 ms)
    lisse = np.convolve(db, np.ones(5) / 5, mode="same")
    for k in range(1, len(t) - 1):
        a, b = int((t[k] - 0.12) / hop), int((t[k] + 0.12) / hop)
        a, b = max(a, i0 + 1), min(b, i1 - 1)
        if b > a:
            t[k] = (a + int(np.argmin(lisse[a:b]))) * hop
    t[0], t[-1] = debut, fin
    for k in range(1, len(t)):                      # ordre croissant, pas de mot de moins de 80 ms
        t[k] = max(t[k], t[k - 1] + 0.08)
    return t


# ——— Groupes de sous-titres ———

_police_mesure = {}


def largeur(texte, police_ttf):
    """Largeur en pixels d'une ligne telle que libass la dessine (taille ASS = hauteur de ligne)."""
    if police_ttf not in _police_mesure:
        ref = ImageFont.truetype(police_ttf, 100)
        asc, desc = ref.getmetrics()
        _police_mesure[police_ttf] = ImageFont.truetype(police_ttf, max(1, round(100 * TAILLE / (asc + desc))))
    return _police_mesure[police_ttf].getlength(texte)


def groupes(mots, police_ttf):
    """Groupes de 3-4 mots tenant sur une ligne ; on coupe de préférence après la ponctuation."""
    res, cur = [], []
    for m in mots:
        if cur and largeur(" ".join(cur + [m]), police_ttf) > LARGEUR_MAX:
            res.append(cur)
            cur = []
        cur.append(m)
        fin_phrase = re.search(r"[.?!…]$", m)
        virgule = re.search(r"[,;:]$", m)
        if len(cur) >= MAX_MOTS or fin_phrase or (virgule and len(cur) >= 3):
            res.append(cur)
            cur = []
    if cur:
        # un mot seul à la fin : on le rattache au groupe précédent s'il y a la place
        if res and len(cur) == 1 and len(res[-1]) < MAX_MOTS and largeur(" ".join(res[-1] + cur), police_ttf) <= LARGEUR_MAX:
            res[-1] += cur
        else:
            res.append(cur)
    return res


def t_ass(s):
    c = int(round(s * 100))
    return f"{c // 360000}:{(c // 6000) % 60:02d}:{(c // 100) % 60:02d}.{c % 100:02d}"


def t_srt(s):
    ms = int(round(s * 1000))
    return f"{ms // 3600000:02d}:{(ms // 60000) % 60:02d}:{(ms // 1000) % 60:02d},{ms % 1000:03d}"


def echapper(m):
    return m.replace("{", "(").replace("}", ")").replace("\\", "")


def main(cfg_path):
    cfg = json.loads(Path(cfg_path).read_text())
    base = Path(cfg_path).parent
    sortie = (base / cfg["sortie"]).resolve()
    tmp = Path(cfg.get("temp", "/tmp/montage_ugc")); tmp.mkdir(parents=True, exist_ok=True)

    police_ttf = str(next(Path(cfg["police_dossier"]).resolve().glob("*.ttf")))
    clips = cfg["clips"]
    infos = []
    t_global = 0.0
    evenements, lignes_srt = [], []
    for c in clips:
        src = (base / c["fichier"]).resolve()
        dur = duree_media(src)
        sr, x = audio_mono(src, tmp / (src.stem + ".wav"))
        # Coupes alignées sur les images (24 par seconde) : le son et l'image restent synchrones
        q = lambda s: round(s * FPS) / FPS
        debut, fin = q(c.get("debut", 0.0)), q(min(c.get("fin", dur), dur))
        mots = c["texte"].split(" ")   # espace ordinaire seulement : « toi ? » garde son espace insécable
        t_mots = minutage_mots(mots, x, sr, debut, fin)
        lufs = loudness(src)
        infos.append(dict(c, src=str(src), debut=debut, fin=fin, lufs=lufs))

        idx = 0
        for g in groupes(mots, police_ttf):
            tg = t_mots[idx: idx + len(g) + 1]
            for k, mot in enumerate(g):
                a = t_global + (tg[k] - debut)
                b = t_global + (tg[k + 1] - debut) if k + 1 < len(tg) else t_global + (fin - debut)
                if k == len(g) - 1:                       # le groupe reste affiché jusqu'au suivant
                    b = max(b, a + 0.12)
                texte = " ".join(
                    (f"{{\\c{COULEUR_MOT}}}{echapper(w)}{{\\c{COULEUR_TEXTE}}}" if j == k else echapper(w)) for j, w in enumerate(g)
                )
                evenements.append(f"Dialogue: 0,{t_ass(a)},{t_ass(b)},Legende,,0,0,0,,{{\\an5\\pos({W // 2},{Y_SOUS_TITRES})}}{texte}")
            a_g = t_global + (tg[0] - debut)
            b_g = t_global + ((tg[len(g)] if len(tg) > len(g) else fin) - debut)
            lignes_srt.append((a_g, b_g, " ".join(g)))
            idx += len(g)
        t_global += fin - debut

    ass = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Legende,{POLICE},{TAILLE},{COULEUR_TEXTE},{COULEUR_TEXTE},{COULEUR_CONTOUR},&H64000000,0,0,0,0,100,100,0,0,1,7,2,5,60,60,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
""" + "\n".join(evenements) + "\n"
    f_ass = tmp / "sous-titres.ass"
    f_ass.write_text(ass, encoding="utf-8")
    srt = "\n".join(f"{i}\n{t_srt(a)} --> {t_srt(b)}\n{t}\n" for i, (a, b, t) in enumerate(lignes_srt, 1))
    f_srt = sortie.with_suffix(".srt")
    f_srt.write_text(srt, encoding="utf-8")

    # Volume : chaque morceau ramené à la même cible, puis normalisation de l'ensemble
    cible = cfg.get("cible_morceau_lufs", -21.0)
    entrees, filtres, concat = [], [], ""
    for i, c in enumerate(infos):
        entrees += ["-i", c["src"]]
        v = f"[{i}:v]"
        filtres.append(
            f"{v}trim=start={c['debut']}:end={c['fin']},setpts=PTS-STARTPTS,fps={FPS},"
            f"scale={W}:{H}:flags=lanczos,setsar=1,format=yuv420p[v{i}]"
        )
        gain = cible - c["lufs"]
        filtres.append(
            f"[{i}:a]atrim=start={c['debut']}:end={c['fin']},asetpts=PTS-STARTPTS,volume={gain:.2f}dB,"
            f"afade=t=in:d=0.012,afade=t=out:st={c['fin'] - c['debut'] - 0.012:.3f}:d=0.012[a{i}]"
        )
        concat += f"[v{i}][a{i}]"
    filtres.append(f"{concat}concat=n={len(infos)}:v=1:a=1[vc][ac]")
    filtres.append(f"[vc]ass='{f_ass}':fontsdir='{Path(cfg['police_dossier']).resolve()}'[vf]")
    filtres.append("[ac]loudnorm=I=-16:TP=-1.5:LRA=9[af]")
    fg = ";".join(filtres)
    (tmp / "graphe.txt").write_text(fg)
    cmd = ["ffmpeg", "-v", "error", "-y", *entrees, "-filter_complex_script", str(tmp / "graphe.txt"),
           "-map", "[vf]", "-map", "[af]", "-c:v", "libx264", "-preset", "medium", "-crf", str(cfg.get("crf", 20)), "-pix_fmt", "yuv420p",
           "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(sortie)]
    sh(cmd)
    print(f"OK : {sortie}  ({t_global:.1f} s)")
    print(f"     {f_srt}")
    for i, c in enumerate(infos):
        print(f"  {i + 1}. {Path(c['src']).name[:30]:30s} {c['debut']:.2f}→{c['fin']:.2f} s  {c['lufs']:.1f} LUFS  {c['texte'][:50]}…")


if __name__ == "__main__":
    main(sys.argv[1])
