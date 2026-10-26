# Which part of the "radio" chain costs naturalness? UTMOS of the dance lines through chain variants.
import glob, json, os, subprocess, sys
import numpy as np
sys.argv = sys.argv[:1]
sys.path[:0] = ['/home/user/work/voice4/tools']
import match_eq
from mos import ut
SRC = '/home/user/work/voice3/d2_s43/dance/lines'
OUT = '/home/user/work/voice5/eqtest'
curve = json.load(open('/home/user/work/voice3/d2_s43/dance/lines_eq/eq_curve.json'))
C = match_eq.CENTERS
g = np.array([curve[str(c)] for c in C])
COMP = "acompressor=threshold=-22dB:ratio=3:attack=8:release=120:makeup=2,alimiter=limit=0.89:latency=1"


def eq(gains):
    e = ';'.join(f'entry({c},{v:.1f})' for c, v in zip(C, gains))
    return f"highpass=f=60,firequalizer=gain_entry='{e}':delay=0.02:accuracy=4,atrim=start=0.02,asetpts=PTS-STARTPTS"


bass = np.where(np.array(C) <= 250, g, 0) + np.where(np.array(C) >= 1000, np.minimum(g, 3.0), 0)
variants = {
    'full+comp': eq(g) + ',' + COMP,
    'full': eq(g),
    'comp_only': 'highpass=f=60,' + COMP,
    'half+comp': eq(g * 0.5) + ',' + COMP,
    'half': eq(g * 0.5),
    'bass+3dB_top': eq(bass),
    'top_only': eq(np.where(np.array(C) >= 1000, g, 0)),
    'bass_only': eq(np.where(np.array(C) <= 250, g, 0)),
}
for name, chain in variants.items():
    d = os.path.join(OUT, name.replace('+', '_'))
    os.makedirs(d, exist_ok=True)
    vals = []
    for p in sorted(glob.glob(SRC + '/L*.wav')):
        q = os.path.join(d, os.path.basename(p))
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', p, '-af', chain, '-ar', '48000', q], check=True)
        vals.append(ut(q))
    print(f'{name:14s} UTMOS {np.mean(vals):.2f}  min {np.min(vals):.2f}', flush=True)
