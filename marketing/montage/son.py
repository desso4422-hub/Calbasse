"""
Piste sonore : voix étirée tranche par tranche selon la carte de temps, volume égalisé,
puis un petit « whoosh » discret à chaque changement d'avatar.
"""
import subprocess
import wave
from pathlib import Path

import numpy as np

SR = 48000


def chaine_tempo(v):
    """atempo accepte de 0,5 à 100 ; on enchaîne si besoin pour rester sur de petits pas."""
    fs = []
    while v > 2.0:
        fs.append(2.0)
        v /= 2.0
    fs.append(v)
    return ",".join(f"atempo={f:.5f}" for f in fs)


def construire_voix(clips, sortie_wav, duree_totale):
    """clips : liste de dict(src, carte, gain_db). Écrit la voix assemblée en WAV 48 kHz stéréo."""
    entrees, filtres, etiquettes = [], [], []
    for i, c in enumerate(clips):
        entrees += ["-i", c["src"]]
        segs = []
        for j, s in enumerate(c["carte"]):
            dur = s["ob"] - s["oa"]
            tempo = (s["b"] - s["a"]) / dur
            lab = f"c{i}s{j}"
            fondu = min(0.004, dur / 3)
            filtres.append(
                f"[{i}:a]atrim=start={s['a']:.4f}:end={s['b']:.4f},asetpts=PTS-STARTPTS,{chaine_tempo(tempo)},"
                f"aformat=sample_fmts=fltp:sample_rates={SR}:channel_layouts=stereo,"
                f"afade=t=in:d={fondu:.4f},afade=t=out:st={max(0.0, dur - fondu):.4f}:d={fondu:.4f}[{lab}]"
            )
            segs.append(f"[{lab}]")
        filtres.append(f"{''.join(segs)}concat=n={len(segs)}:v=0:a=1,volume={c['gain_db']:.2f}dB[v{i}]")
        etiquettes.append(f"[v{i}]")
    filtres.append(
        f"{''.join(etiquettes)}concat=n={len(clips)}:v=0:a=1,apad=whole_dur={duree_totale:.4f},atrim=0:{duree_totale:.4f}[out]"
    )
    script = Path(str(sortie_wav) + ".graphe.txt")
    script.write_text(";\n".join(filtres))
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", *entrees, "-filter_complex_script", str(script), "-map", "[out]", "-c:a", "pcm_s16le", str(sortie_wav)],
        check=True,
    )


def whoosh(duree=0.55, niveau_db=-19.0, graine=7):
    """Souffle qui monte puis retombe : bruit filtré dont la bande passante balaie les aigus."""
    rng = np.random.default_rng(graine)
    n = int(SR * duree)
    bruit = rng.standard_normal(n).astype(np.float32)
    fen, hop = 1024, 256
    fenetre = np.hanning(fen).astype(np.float32)
    sortie = np.zeros(n + fen, np.float32)
    norm = np.zeros(n + fen, np.float32)
    freqs = np.fft.rfftfreq(fen, 1 / SR)
    for pos in range(0, n - fen, hop):
        u = pos / n
        centre = 500 * (9000 / 500) ** (u ** 0.8)        # balayage de 500 Hz à 9 kHz
        largeur = 300 + 2500 * u
        gain = np.exp(-0.5 * ((freqs - centre) / largeur) ** 2)
        spec = np.fft.rfft(bruit[pos:pos + fen] * fenetre) * gain
        sortie[pos:pos + fen] += np.fft.irfft(spec) * fenetre
        norm[pos:pos + fen] += fenetre ** 2
    s = sortie[:n] / np.maximum(norm[:n], 1e-6)
    t = np.linspace(0, 1, n)
    enveloppe = np.where(t < 0.62, np.sin(t / 0.62 * np.pi / 2) ** 2, np.cos((t - 0.62) / 0.38 * np.pi / 2) ** 3)
    s = s * enveloppe
    s = s / (np.max(np.abs(s)) + 1e-9) * 10 ** (niveau_db / 20)
    return s.astype(np.float32)


def mixer(voix_wav, effets, sortie_wav):
    """effets : liste de (temps_s, signal mono float32). Ajoute chaque effet à la voix."""
    with wave.open(str(voix_wav)) as w:
        canaux, sr, n = w.getnchannels(), w.getframerate(), w.getnframes()
        x = np.frombuffer(w.readframes(n), dtype=np.int16).astype(np.float32).reshape(-1, canaux) / 32768
    for t, sig in effets:
        a = max(0, int(round(t * sr)))
        b = min(len(x), a + len(sig))
        if b > a:
            x[a:b] += sig[: b - a, None]
    x = np.clip(x, -1.0, 1.0)
    with wave.open(str(sortie_wav), "wb") as w:
        w.setnchannels(canaux)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes((x * 32767).astype(np.int16).tobytes())
