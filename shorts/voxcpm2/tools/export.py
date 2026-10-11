# Export the chosen takes as plain per-line files for another film's own mix:
# trim silence at the edges (short pad left), cut rumble, same speech level for every line
# (the "gain" dict lowers whispered or sleepy lines), mono 48 kHz 16-bit.
# usage: python3 export.py <lines.json> <takes dir> <out dir> [level dBFS, default -20]
import json, os, subprocess, sys, tempfile
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import aud

CFG, TAKES, OUT = json.load(open(sys.argv[1])), sys.argv[2], sys.argv[3]
LEVEL = float(sys.argv[4]) if len(sys.argv) > 4 else -20.0
PAD = 0.04
os.makedirs(OUT, exist_ok=True)
for lid, take in CFG['chosen'].items():
    with tempfile.TemporaryDirectory() as td:
        t = os.path.join(td, 'a.wav')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', os.path.join(TAKES, take + '.wav'), '-af', 'highpass=f=60',
                        '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le', t], check=True)
        x, sr = aud.read_wav(t)
    a, b = aud.trim_bounds(x, sr)
    p = int(PAD * sr)
    y = x[max(0, a - p):min(len(x), b + p)].astype(np.float64)
    fade = min(int(0.01 * sr), len(y) // 4)
    if fade:
        r = np.linspace(0, 1, fade)
        y[:fade] *= r
        y[-fade:] *= r[::-1]
    db, n = aud.frames_db(y, sr)
    act = db[db > db.max() - 20]
    level = 10 * np.log10(np.mean(10 ** (act / 10)))
    g = LEVEL + CFG.get('gain', {}).get(lid, 0) - level
    g = min(g, -1.0 - 20 * np.log10(np.abs(y).max() + 1e-12))     # keep peaks under -1 dBFS
    y *= 10 ** (g / 20)
    aud.write_wav(os.path.join(OUT, f'{lid}.wav'), y, sr)
    print(f'{lid} {CFG["lines"][lid]["who"]} {take} {len(y) / sr:.2f}s gain {g:+.1f} dB')
