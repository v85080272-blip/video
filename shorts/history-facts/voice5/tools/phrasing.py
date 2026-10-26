# Phrase/pause structure of narration: speech runs vs pauses, from 300-3000 Hz band energy relative to the speech level
# (robust to a music bed 20+ dB under the voice). Prints phrase and pause statistics.
import json, sys
import numpy as np
sys.path[:0] = ['/home/user/work/voice/shorts/voxcpm2/tools']
import aud


def runs(x, sr, drop=18.0, min_pause=0.12, min_phrase=0.15):
    hop, W = int(0.01 * sr), int(0.03 * sr)
    n = (len(x) - W) // hop
    fr = x[np.arange(n)[:, None] * hop + np.arange(W)[None, :]] * np.hanning(W)
    S = np.abs(np.fft.rfft(fr, axis=1)) ** 2
    f = np.fft.rfftfreq(W, 1 / sr)
    e = 10 * np.log10(S[:, (f > 300) & (f < 3000)].sum(1) + 1e-12)
    e = np.convolve(e, np.ones(5) / 5, mode='same')
    lvl = np.percentile(e, 90)
    sp = e > lvl - drop
    # close short gaps, drop tiny blips
    segs, i = [], 0
    while i < n:
        if sp[i]:
            j = i
            while j < n and sp[j]:
                j += 1
            segs.append([i, j])
            i = j
        else:
            i += 1
    merged = []
    for s in segs:
        if merged and (s[0] - merged[-1][1]) * 0.01 < min_pause:
            merged[-1][1] = s[1]
        else:
            merged.append(s)
    merged = [s for s in merged if (s[1] - s[0]) * 0.01 >= min_phrase]
    ph = np.array([(b - a) * 0.01 for a, b in merged])
    pa = np.array([(merged[k + 1][0] - merged[k][1]) * 0.01 for k in range(len(merged) - 1)])
    return ph, pa, merged


def report(name, x, sr, t0=0.0, t1=None):
    x = x[int(t0 * sr):int(t1 * sr) if t1 else len(x)]
    ph, pa, _ = runs(x, sr)
    tot = len(x) / sr
    print(f'{name:22s} phrases {len(ph):3d}  phrase median {np.median(ph):.2f}s mean {ph.mean():.2f}s  '
          f'pause median {np.median(pa):.2f}s mean {pa.mean():.2f}s  pauses/min {60 * len(pa) / tot:.0f}  '
          f'pause share {pa.sum() / tot:.0%}', flush=True)


if __name__ == '__main__':
    for arg in sys.argv[1:]:
        name, p = arg.split('=', 1)
        t0, t1 = 0.0, None
        if '@' in p:
            p, rng = p.split('@')
            t0, t1 = map(float, rng.split('-'))
        x, sr = aud.read_wav(p)
        report(name, x, sr, t0, t1)
