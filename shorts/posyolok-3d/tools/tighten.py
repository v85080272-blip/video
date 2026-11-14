# Her v3 takes breathe slowly: every pause inside a line that is longer than MAXP is cut down to KEEP (the breath and the
# sigh themselves stay — only the near-silence goes), so the clip keeps to the Studio's 35–45 s without speeding her up much.
# usage: python3 tools/tighten.py <in.wav> <out.wav> [max pause 0.42] [keep 0.26]
import sys

import numpy as np
import soundfile as sf

src, dst = sys.argv[1], sys.argv[2]
MAXP = float(sys.argv[3]) if len(sys.argv) > 3 else 0.42
KEEP = float(sys.argv[4]) if len(sys.argv) > 4 else 0.26
x, sr = sf.read(src, always_2d=False)
mono = x if x.ndim == 1 else x.mean(axis=1)
hop = int(0.01 * sr)
n = len(mono) // hop
env = np.array([np.sqrt(np.mean(mono[i * hop:(i + 1) * hop] ** 2) + 1e-12) for i in range(n)])
db = 20 * np.log10(env + 1e-9)
quiet = db < (np.percentile(db, 95) - 38)              # near-silence relative to the line's loud parts
keep = np.ones(len(mono), bool)
i = 0
while i < n:
    if quiet[i]:
        j = i
        while j < n and quiet[j]: j += 1
        if i > 0 and j < n and (j - i) * hop > MAXP * sr:   # only pauses inside the line
            cut0 = i * hop + int(KEEP * sr / 2); cut1 = j * hop - int(KEEP * sr / 2)
            keep[cut0:cut1] = False
        i = j
    else:
        i += 1
y = x[keep] if x.ndim == 1 else x[keep, :]
sf.write(dst, y, sr)
print(f'{src}: {len(mono) / sr:.2f} s → {len(y) / sr:.2f} s')
