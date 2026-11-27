# How open Искра's mouth is, frame by frame, from the voice: the loudness in 40 ms windows at 60 fps, −46…−16 dB mapped
# to 0…1, quick to open and a little slower to close. → build/mouth.json (read by src/iskra.js)
# usage: python3 tools/mouth.py build/voice.wav build/mouth.json
import json
import sys

import numpy as np
import soundfile as sf

y, sr = sf.read(sys.argv[1]); y = y if y.ndim == 1 else y.mean(1)
fps, win = 60, int(0.04 * sr)
n = int(len(y) / sr * fps)
v = []
for i in range(n):
    c = int(i / fps * sr); s = y[max(0, c - win // 2):c + win // 2]
    db = 20 * np.log10(np.sqrt((s ** 2).mean()) + 1e-9) if len(s) else -90
    v.append(float(np.clip((db + 46) / 30, 0, 1)))
out, cur = [], 0.0
for x in v:
    cur += (x - cur) * (0.75 if x > cur else 0.45); out.append(round(cur, 3))
json.dump(dict(fps=fps, v=out), open(sys.argv[2], 'w'))
print(f'mouth: {n} frames, open {np.mean(np.array(out) > 0.1) * 100:.0f} % of the time')
