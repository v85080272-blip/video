# How repetitive is the melody from phrase to phrase? Per phrase (speech run) the pitch contour relative to the phrase
# median, resampled to 10 points; mean pairwise correlation (high = every phrase sings the same tune) and the spread of
# phrase endings (last fifth vs the middle, semitones).
import sys
import numpy as np
sys.path[:0] = ['/home/user/work/voice/shorts/voxcpm2/tools', '/home/user/work/voice4/tools', '/home/user/work/voice5']
import aud
from prosody import yin, SR
from phrasing import runs

for arg in sys.argv[1:]:
    name, p = arg.split('=', 1)
    t0, t1 = 0.0, None
    if '@' in p:
        p, rng = p.split('@')
        t0, t1 = map(float, rng.split('-'))
    x, sr = aud.read_wav(p)
    x = x[int(t0 * sr):int(t1 * sr) if t1 else len(x)]
    ph, pa, segs = runs(x, sr)
    k = sr / SR
    t = np.arange(int(len(x) / k)) * k
    x16 = np.interp(t, np.arange(len(x)), x)
    f0 = yin(x16)
    st = 12 * np.log2(f0)
    shapes, ends, spans = [], [], []
    for a, b in segs:                       # segs in 10 ms frames, same hop as yin
        c = st[a:min(b, len(st))]
        v = ~np.isnan(c)
        if v.sum() < 25:
            continue
        idx = np.where(v)[0]
        y = c[v] - np.median(c[v])
        yy = np.interp(np.linspace(0, len(y) - 1, 10), np.arange(len(y)), np.convolve(y, np.ones(5) / 5, mode='same'))
        shapes.append(yy)
        q = len(y) // 5
        ends.append(np.median(y[-q:]) - np.median(y[q:-q]) if q > 2 else 0)
        spans.append(np.percentile(y, 90) - np.percentile(y, 10))
    S = np.array(shapes)
    C = np.corrcoef(S)
    iu = np.triu_indices(len(S), 1)
    print(f'{name:22s} phrases {len(S):3d}  same-tune corr {np.mean(C[iu]):.2f}  ending mean {np.mean(ends):+.1f} st '
          f'sd {np.std(ends):.1f}  in-phrase span {np.median(spans):.1f} st', flush=True)
