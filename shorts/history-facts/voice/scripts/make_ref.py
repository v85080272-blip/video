# Voice reference from a casting take: trim silence at the edges (40 ms pad, 10 ms fades) and shorten internal
# pauses longer than max_pause (the middle of the silent stretch is cut with a 10 ms crossfade), 16-bit mono.
# usage: python3 make_ref.py <take.wav> <out.wav> [max_pause_s 0.4] [silence thr dBFS -50]
import os, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import vt  # noqa: E402
import aud  # noqa: E402

src, dst = sys.argv[1], sys.argv[2]
max_pause = float(sys.argv[3]) if len(sys.argv) > 3 else 0.4
thr = float(sys.argv[4]) if len(sys.argv) > 4 else -50.0
x, sr = aud.read_wav(src)
a, b = aud.trim_bounds(x, sr, -45.0)
pad = int(0.04 * sr)
y = x[max(0, a - pad):min(len(x), b + pad)].astype(np.float64)
hop = int(0.01 * sr)
m = len(y) // hop
db = 10 * np.log10((y[:m * hop].reshape(m, hop) ** 2).mean(1) + 1e-12)
quiet = db < thr
segs, i = [], 0
while i < m:
    if quiet[i]:
        j = i
        while j < m and quiet[j]:
            j += 1
        if i > 0 and j < m and (j - i) * hop / sr > max_pause:
            segs.append((i * hop, j * hop))
        i = j
    else:
        i += 1
xf = int(0.01 * sr)
out, pos = [], 0
for s, e in segs:
    keep = int(max_pause * sr / 2)
    cut0, cut1 = s + keep, e - keep
    left, right = y[pos:cut0 + xf].copy(), y[cut1:cut1 + xf].copy()
    r = np.linspace(0, 1, xf)
    left[-xf:] = left[-xf:] * (1 - r) + right * r
    out.append(left)
    pos = cut1 + xf
    print(f'pause {s / sr:.2f}-{e / sr:.2f}s ({(e - s) / sr:.2f}s) -> {max_pause:.2f}s')
out.append(y[pos:])
z = np.concatenate(out)
f = int(0.01 * sr)
z[:f] *= np.linspace(0, 1, f)
z[-f:] *= np.linspace(1, 0, f)
aud.write_wav(dst, z, sr)
print(dst, f'{len(z) / sr:.2f}s', sr, 'Hz')
