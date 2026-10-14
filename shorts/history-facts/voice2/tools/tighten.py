# Shorten long internal pauses so samples match reel pacing: any silence > MAXP s becomes MAXP s.
import sys, numpy as np
sys.path[:0] = ['/home/user/work/voice/shorts/voxcpm2/tools']
import aud

def tighten(x, sr, maxp=0.40, thr=-40.0, keep=0.12):
    db, n = aud.frames_db(x, sr, 0.01)
    loud = db > thr
    idx = np.where(loud)[0]
    a, b = idx[0] * n, (idx[-1] + 1) * n
    x = x[max(0, a - int(0.05 * sr)):min(len(x), b + int(0.15 * sr))]
    db, n = aud.frames_db(x, sr, 0.01)
    loud = db > thr
    out, i, cur = [], 0, 0
    runs = []
    k = 0
    while k < len(loud):
        if not loud[k]:
            j = k
            while j < len(loud) and not loud[j]:
                j += 1
            runs.append((k * n, j * n))
            k = j
        else:
            k += 1
    pos = 0
    xf = int(0.01 * sr)
    for s, e in runs:
        if s == 0 or e >= len(x) - n:
            continue
        if (e - s) / sr <= maxp:
            continue
        cut_a = s + int(keep * sr)
        cut_b = e - int((maxp - keep) * sr)
        seg = x[pos:cut_a].copy()
        out.append(seg)
        pos = cut_b
    out.append(x[pos:])
    y = out[0]
    for seg in out[1:]:
        if len(y) > xf and len(seg) > xf:
            r = np.linspace(0, 1, xf)
            mid = y[-xf:] * (1 - r) + seg[:xf] * r
            y = np.concatenate([y[:-xf], mid, seg[xf:]])
        else:
            y = np.concatenate([y, seg])
    return y

if __name__ == '__main__':
    src, dst = sys.argv[1], sys.argv[2]
    maxp = float(sys.argv[3]) if len(sys.argv) > 3 else 0.40
    x, sr = aud.read_wav(src)
    y = tighten(x, sr, maxp)
    aud.write_wav(dst, y, sr)
    print(src, round(len(x) / sr, 2), '->', round(len(y) / sr, 2))
