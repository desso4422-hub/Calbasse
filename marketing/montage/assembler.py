#!/usr/bin/env python3
"""
Assemble une créative UGC à partir des rushs de Flow (VEO) : 4 UGC × 2 parties.

  python3 assembler.py config.json                    # vidéo complète
  python3 assembler.py config.json --extrait 22,32    # seulement ces secondes (pour essayer vite)

Ce que fait le montage :
  - coupe chaque rush là où la voix commence et finit ;
  - uniformise la vitesse de parole : tous les clips sont ramenés à la même cadence (syllabes par
    seconde de voix) et les pauses sont accélérées, donc la vidéo est plus courte et régulière ;
  - zooms rythmés à chaque phrase, transitions entre avatars, barre de progression ;
  - motion design lié à ce qui est dit (carte de scan, pastilles, viseur, bouton WhatsApp) ;
  - sous-titres calés sur la voix, volume égalisé (-16 LUFS), petits « whoosh » aux changements d'avatar ;
  - export 1080×1920 (9:16), plus le .srt pour retoucher dans CapCut.

Le script ne devine pas ce qui est dit : les textes viennent de la config, écrits d'après la
transcription réelle du son (l'IA s'écarte parfois d'un mot ou deux du script prévu).
"""
import json
import re
import subprocess
import sys
from pathlib import Path

from PIL import ImageFont

import animations as A
import parole as P
import rendu
import son

W, H = 1080, 1920
FPS = P.FPS
COULEUR_TEXTE = "&H00FFFFFF"       # blanc (ASS : BGR)
COULEUR_MOT = "&H0078C8FF"         # mot prononcé : jaune chaud
COULEUR_CONTOUR = "&H00101828"     # brun très foncé de la marque
POLICE = "Plus Jakarta Sans ExtraBold"
TAILLE = 100                       # taille ASS : hauteur de ligne en pixels d'une vidéo 1080×1920
Y_SOUS_TITRES = 1250               # ~65 % de la hauteur : sous le visage, au-dessus du bas de l'écran
LARGEUR_MAX = 900                  # une ligne de sous-titres ne dépasse jamais cette largeur
MAX_MOTS = 4


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


# ——— Animations liées aux mots ———

def temps_du_mot(mot, mots, t_mots, decalage):
    """Début (sur toute la vidéo) du premier mot qui correspond, sans tenir compte de la ponctuation."""
    cible = P.normaliser_mot(mot)
    for m, t in zip(mots, t_mots):
        if P.normaliser_mot(m) == cible:
            return decalage + t
    raise SystemExit(f"Mot « {mot} » introuvable dans : {' '.join(mots)}")


def construire_calque(a, mots, t_mots, decalage, fin_clip, fin_video):
    t0 = temps_du_mot(a["mot"], mots, t_mots, decalage)
    if "mot_fin" in a:
        t1 = temps_du_mot(a["mot_fin"], mots, t_mots, decalage)
    elif "duree" in a:
        t1 = t0 + a["duree"]
    else:
        t1 = fin_video + 1.0 if a.get("fin") == "video" else fin_clip   # jusqu'à la dernière image, sans fondu final
    typ = a["type"]
    if typ == "pastille":
        t1 = max(t1, t0 + 1.2)           # une pastille reste lisible au moins 1,2 s, même si la phrase file vite
    if a.get("fin") != "video":
        t1 = min(t1, fin_clip - 0.06)    # jamais d'élément qui déborde sur l'avatar suivant
    if typ == "pastille":
        return A.Pastille(t0, t1, a["texte"], cy=a.get("cy", 1480), style=a.get("style", "terre"), icone=a.get("icone", "?"), cx=a.get("cx", W / 2))
    if typ == "carte_scan":
        return A.CarteScan(t0, t1, a["plat"], a["kcal"], a["prot"], a["gluc"], a["lip"], cy=a.get("cy", 1560))
    if typ == "viseur_portion":
        return A.ViseurPortion(t0, t1, temps_du_mot(a["mot_portion"], mots, t_mots, decalage), temps_du_mot(a["mot_bascule"], mots, t_mots, decalage), cy=a.get("cy", 1560))
    if typ == "viseur":
        return A.ViseurPortion(t0, t1, None, None, cy=a.get("cy", 1560))
    if typ == "whatsapp":
        return A.BoutonWhatsApp(t0, t1, cy=a.get("cy", 1520))
    raise SystemExit(f"Type d'animation inconnu : {typ}")


def main(cfg_path, extrait=None):
    cfg = json.loads(Path(cfg_path).read_text())
    base = Path(cfg_path).parent
    sortie = (base / cfg["sortie"]).resolve()
    tmp = Path(cfg.get("temp", "/tmp/montage_ugc")); tmp.mkdir(parents=True, exist_ok=True)
    police_dossier = Path(cfg["police_dossier"]).resolve() if Path(cfg["police_dossier"]).is_absolute() else (base / cfg["police_dossier"]).resolve()
    police_ttf = str(police_dossier / "PlusJakartaSans_800ExtraBold.ttf")

    cible = cfg.get("cadence_syllabes_par_s", 6.1)
    vmin, vmax = cfg.get("vitesse_min", 0.95), cfg.get("vitesse_max", 1.35)
    v_pause = cfg.get("vitesse_pause", 3.0)
    cible_lufs = cfg.get("cible_morceau_lufs", -21.0)

    # ——— 1. Chaque clip : voix, vitesse, carte de temps, minutage des mots ———
    infos, decalage = [], 0.0
    for i, c in enumerate(cfg["clips"]):
        src = (base / c["fichier"]).resolve()
        sr, x = P.audio_mono(src, tmp / (src.stem + ".wav"))
        debut, fin = c.get("debut", 0.0), min(c.get("fin", P.duree_media(src)), P.duree_media(src))
        tranches, voix = P.analyser_voix(x, sr, debut, fin)
        tous = c["texte"].split(" ")      # espace ordinaire seulement : « toi ? » garde son espace insécable
        # Un mot préfixé de ~ est dit mais pas affiché (mot que l'IA ajoute et qu'on ne sait pas écrire) :
        # il compte pour le calage, ce qui évite de décaler les sous-titres qui suivent.
        mots = [m for m in tous if not m.startswith("~")]
        cadence = sum(P.syllabes(m.lstrip("~")) for m in tous) / voix
        vitesse = min(vmax, max(vmin, cible / cadence))
        carte, n = P.carte_temps(tranches, vitesse, v_pause)
        t_tous = P.minutage_mots([m.lstrip("~") for m in tous], x, sr, debut, fin)
        t_src = [t_tous[i] for i, m in enumerate(tous) if not m.startswith("~")] + [t_tous[-1]]
        t_mots = [P.src_vers_sortie(t, carte) for t in t_src]
        infos.append(dict(cfg=c, src=str(src), debut=debut, fin=fin, carte=carte, n=n, mots=mots, t_mots=t_mots, vitesse=vitesse, cadence=cadence,
                          decalage=decalage, lufs=P.loudness(src), ugc=c.get("ugc", i // 2 + 1)))
        decalage += n / FPS
    duree_totale = decalage

    # ——— 2. Coupures de zoom (une par phrase) et transitions ———
    for i, c in enumerate(infos):
        dure = c["n"] / FPS
        coupures, derniere = [], 0.0
        gs = groupes(c["mots"], police_ttf)
        idx = 0
        for gi, g in enumerate(gs):
            fin_g = c["t_mots"][idx + len(g)] if idx + len(g) < len(c["t_mots"]) else dure
            idx += len(g)
            fin_phrase = bool(re.search(r"[.?!…]$", g[-1]))
            virgule = bool(re.search(r"[,;:]$", g[-1]))
            suivant = c["t_mots"][idx] if idx < len(c["t_mots"]) else dure
            if (fin_phrase and fin_g - derniere >= 1.3 or virgule and fin_g - derniere >= 1.9) and dure - suivant >= 0.9 and gi < len(gs) - 1:
                coupures.append(suivant)
                derniere = suivant
        c["coupures"] = coupures
        c["depart_zoom"] = i
        c["coupe_avant"] = i > 0 and c["ugc"] != infos[i - 1]["ugc"]
        c["coupe_apres"] = i < len(infos) - 1 and c["ugc"] != infos[i + 1]["ugc"]
        f = c["cfg"].get("zoom_force")      # secondes du rush → secondes de la sortie
        c["force"] = None if not f else dict(de=P.src_vers_sortie(f["de"], c["carte"]), a=P.src_vers_sortie(f["a"], c["carte"]), niveau=f["niveau"])

    # ——— 3. Sous-titres (ASS pour la vidéo, SRT pour CapCut) ———
    evenements, lignes_srt = [], []
    for c in infos:
        idx = 0
        for g in groupes(c["mots"], police_ttf):
            tg = c["t_mots"][idx: idx + len(g) + 1]
            fin_g = c["decalage"] + (tg[len(g)] if len(tg) > len(g) else c["n"] / FPS)
            for k, mot in enumerate(g):
                a = c["decalage"] + tg[k]
                b = c["decalage"] + tg[k + 1] if k + 1 < len(tg) else c["decalage"] + c["n"] / FPS
                if k == len(g) - 1:
                    b = max(b, a + 0.12)
                texte = " ".join(
                    (f"{{\\c{COULEUR_MOT}\\fscx124\\fscy124\\t(0,110,\\fscx108\\fscy108)}}{echapper(w)}{{\\c{COULEUR_TEXTE}\\fscx100\\fscy100}}" if j == k else echapper(w))
                    for j, w in enumerate(g)
                )
                fondu = "\\fad(70,0)" if k == 0 else ""
                evenements.append(f"Dialogue: 0,{t_ass(a)},{t_ass(b)},Legende,,0,0,0,,{{\\an5\\pos({W // 2},{Y_SOUS_TITRES}){fondu}}}{texte}")
            lignes_srt.append((c["decalage"] + tg[0], fin_g, " ".join(g)))
            idx += len(g)
    f_ass = tmp / "sous-titres.ass"
    f_ass.write_text(f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Legende,{POLICE},{TAILLE},{COULEUR_TEXTE},{COULEUR_TEXTE},{COULEUR_CONTOUR},&H64000000,0,0,0,0,100,100,0,0,1,7,2,5,60,60,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
""" + "\n".join(evenements) + "\n", encoding="utf-8")
    f_srt = sortie.with_suffix(".srt")
    f_srt.write_text("\n".join(f"{i}\n{t_srt(a)} --> {t_srt(b)}\n{t}\n" for i, (a, b, t) in enumerate(lignes_srt, 1)), encoding="utf-8")

    # ——— 4. Motion design ———
    calques = []
    segments_ugc = []
    for c in infos:
        d0, d1 = c["decalage"], c["decalage"] + c["n"] / FPS
        if segments_ugc and segments_ugc[-1][2] == c["ugc"]:
            segments_ugc[-1][1] = d1
        else:
            segments_ugc.append([d0, d1, c["ugc"]])
        for a in c["cfg"].get("animations", []):
            calques.append(construire_calque(a, c["mots"], c["t_mots"], c["decalage"], d1, duree_totale))
    b = cfg.get("badge")
    if b:
        c = infos[b["clip"]]
        calques.append(A.Badge(temps_du_mot(b["mot"], c["mots"], c["t_mots"], c["decalage"]), duree_totale))
    calques.insert(0, A.BarreProgression([(a, z) for a, z, _ in segments_ugc], duree_totale))

    # ——— 5. Son ———
    voix = tmp / "voix.wav"
    son.construire_voix([dict(src=c["src"], carte=c["carte"], gain_db=cible_lufs - c["lufs"]) for c in infos], voix, duree_totale)
    effets = []
    if cfg.get("sons", True):
        souffle = son.whoosh()
        effets = [(c["decalage"] - 0.22, souffle) for c in infos if c["coupe_avant"]]
    mix = tmp / "mix.wav"
    son.mixer(voix, effets, mix)

    # ——— 6. Image : rendu, puis encodage avec sous-titres et normalisation du volume ———
    cmd = ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-i", str(mix)]
    if extrait:
        cmd += ["-ss", f"{extrait[0]:.3f}", "-t", f"{extrait[1] - extrait[0]:.3f}"]
    cmd += ["-vf", f"ass='{f_ass}':fontsdir='{police_dossier}'", "-af", "loudnorm=I=-16:TP=-1.5:LRA=9",
            "-c:v", "libx264", "-preset", "medium", "-crf", str(cfg.get("crf", 20)), "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(sortie)]
    ff = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    total = sum(c["n"] for c in infos)
    for k, img in enumerate(rendu.rendre(infos, calques, extrait)):
        if extrait and k / FPS > extrait[1] + 0.3:
            break                                    # le reste n'est pas demandé
        ff.stdin.write(img.tobytes())
        if k % 120 == 0:
            print(f"  image {k}/{total}", flush=True)
    ff.stdin.close()
    if ff.wait() != 0:
        raise SystemExit("L'encodage a échoué")

    print(f"OK : {sortie}  ({duree_totale:.1f} s)")
    print(f"     {f_srt}")
    print(f"  {'clip':26s} {'source':>6s} {'sortie':>6s} {'vitesse':>7s} {'cadence':>8s}  texte")
    for c in infos:
        print(f"  {Path(c['src']).name[:26]:26s} {c['fin'] - c['debut']:6.2f} {c['n'] / FPS:6.2f} {c['vitesse']:6.2f}× {c['cadence'] * c['vitesse']:6.2f}/s  {c['cfg']['texte'][:48]}…")


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    ext = None
    if "--extrait" in sys.argv:
        ext = tuple(float(v) for v in sys.argv[sys.argv.index("--extrait") + 1].split(","))
        args = [a for a in args if a != sys.argv[sys.argv.index("--extrait") + 1]]
    main(args[0], ext)
