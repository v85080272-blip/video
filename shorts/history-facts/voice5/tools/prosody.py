# Prosody of a narrator, to tell "robotic" from "lively" without listening:
# pitch (range, spread, how fast it moves, how many accents per second), rhythm (variability of syllable lengths, nPVI),
# loudness swings between syllables, pauses inside phrases. Works on clean lines or on a reel with a quiet music bed.
# usage: python3 prosody.py name=<wav|dir of L*.wav>[,...] ...   -> one table row per set
import glob, json, os, sys
import numpy as np
sys.path[:0] = ['/home/user/work/voice/shorts/voxcpm2/tools']
import aud

SR = 16000
HOP = 160          # 10 ms


def load16(p):
    x, sr = aud.read_wav(p)
    if sr != SR:
        t = np.arange(int(len(x) * SR / sr)) * sr / SR
        x = np.interp(t, np.arange(len(x)), x)
    return x.astype(np.float64)


def yin(x, fmin=65, fmax=400, W=640, thr=0.2):
    """f0 per 10 ms frame (nan = unvoiced), vectorized YIN."""
    tmax = SR // fmin
    tmin = SR // fmax
    n = (len(x) - W - tmax) // HOP
    if n <= 0:
        return np.full(0, np.nan)
    idx = np.arange(n)[:, None] * HOP + np.arange(W + tmax)[None, :]
    fr = x[idx]
    a = fr[:, :W]
    L = 1 << int(np.ceil(np.log2(W + tmax + W)))
    A = np.fft.rfft(a, L)
    F = np.fft.rfft(fr, L)
    cross = np.fft.irfft(np.conj(A) * F, L)[:, :tmax + 1]          # sum a[j] * fr[j + tau]
    e0 = (a ** 2).sum(1)[:, None]
    c2 = np.cumsum(np.pad(fr ** 2, ((0, 0), (1, 0))), axis=1)
    etau = c2[:, W:W + tmax + 1] - c2[:, 0:tmax + 1]                 # sum fr[tau:tau+W]^2
    d = e0 + etau - 2 * cross
    d[:, 0] = 0
    cm = d[:, 1:] * np.arange(1, tmax + 1) / (np.cumsum(d[:, 1:], axis=1) + 1e-12)
    cm = np.concatenate([np.ones((n, 1)), cm], axis=1)
    db = 10 * np.log10((a ** 2).mean(1) + 1e-12)
    f0 = np.full(n, np.nan)
    gate = np.percentile(db, 98) - 30
    for i in range(n):
        if db[i] < gate:
            continue
        c = np.where(cm[i, tmin:] < thr)[0]
        if not len(c):
            continue
        tau = c[0] + tmin
        while tau + 1 <= tmax and cm[i, tau + 1] < cm[i, tau]:
            tau += 1
        f0[i] = SR / tau
    # drop octave jumps: a frame more than 7 st away from both neighbours' median
    st = 12 * np.log2(f0 / np.nanmedian(f0))
    med = np.array([np.nanmedian(st[max(0, i - 5):i + 6]) for i in range(len(st))])
    f0[np.abs(st - med) > 7] = np.nan
    return f0


def nuclei(x):
    """Syllable nuclei: peaks of 300-2500 Hz band energy (5-frame smoothing), >= 80 ms apart, within 25 dB of the top."""
    W = 400
    n = (len(x) - W) // HOP
    fr = x[np.arange(n)[:, None] * HOP + np.arange(W)[None, :]] * np.hanning(W)
    S = np.abs(np.fft.rfft(fr, axis=1)) ** 2
    f = np.fft.rfftfreq(W, 1 / SR)
    env = 10 * np.log10(S[:, (f > 300) & (f < 2500)].sum(1) + 1e-12)
    env = np.convolve(env, np.ones(5) / 5, mode='same')
    top = np.percentile(env, 98)
    pk = [i for i in range(1, n - 1) if env[i] >= env[i - 1] and env[i] > env[i + 1] and env[i] > top - 25]
    out = []
    for p in sorted(pk, key=lambda i: -env[i]):
        if all(abs(p - q) >= 8 for q in out):
            out.append(p)
    out.sort()
    # a peak must stand 3 dB above the dip before it, else it is the same syllable
    keep = [out[0]] if out else []
    for p in out[1:]:
        if env[p] - env[keep[-1]:p + 1].min() >= 3 or env[keep[-1]] - env[keep[-1]:p + 1].min() >= 3:
            keep.append(p)
    return np.array(keep), env


def analyse(paths):
    f0s, ints, pks, slopes, acc, gaps, speech = [], [], [], [], 0, [], 0.0
    for p in paths:
        x = load16(p)
        a, b = aud.trim_bounds(x, SR)
        x = x[a:b]
        if len(x) < SR:
            continue
        speech += len(x) / SR
        f0 = yin(x)
        st = 12 * np.log2(f0)
        f0s.append(st[~np.isnan(st)])
        # pitch movement over voiced runs (st per second) and accents (turning points >= 2 st apart)
        run = []
        for v in list(st) + [np.nan]:
            if np.isnan(v):
                if len(run) >= 8:
                    r = np.convolve(run, np.ones(5) / 5, mode='valid')
                    slopes.extend(np.abs(np.diff(r)) * 100)
                run = []
            else:
                run.append(v)
        voiced = st[~np.isnan(st)]
        if len(voiced) > 10:
            sm = np.convolve(voiced, np.ones(7) / 7, mode='valid')
            last, direction = sm[0], 0
            for v in sm[1:]:
                if direction >= 0 and v < last - 2:
                    acc += direction > 0
                    direction, last = -1, v
                elif direction <= 0 and v > last + 2:
                    acc += direction < 0
                    direction, last = 1, v
                elif (direction > 0 and v > last) or (direction < 0 and v < last):
                    last = v
        pk, env = nuclei(x)
        if len(pk) > 2:
            d = np.diff(pk) * HOP / SR
            d = d[d < 0.5]                      # syllable intervals inside phrases
            ints.extend(d)
            pks.extend(env[pk] - np.median(env[pk]))
        db, _ = aud.frames_db(x, SR, 0.01)
        quiet = db < db.max() - 35
        k = 0
        for q in list(quiet) + [False]:
            if q:
                k += 1
            else:
                if k >= 15:
                    gaps.append(k / 100)
                k = 0
    allst = np.concatenate(f0s)
    ints = np.array(ints)
    npvi = 100 * np.mean(np.abs(np.diff(ints)) / ((ints[1:] + ints[:-1]) / 2)) if len(ints) > 3 else float('nan')
    return dict(speech_s=round(speech, 1), f0_hz=round(float(2 ** (np.median(allst) / 12)), 1),
                range_st=round(float(np.percentile(allst, 90) - np.percentile(allst, 10)), 1),
                slope_st_s=round(float(np.median(slopes)), 1) if slopes else None,
                accents_per_s=round(acc / speech, 2), syl_per_s=round(1 / float(np.median(ints)), 2) if len(ints) else None,
                rhythm_npvi=round(float(npvi), 1), rhythm_cv=round(float(np.std(ints) / np.mean(ints)), 2) if len(ints) else None,
                loud_sd_db=round(float(np.std(pks)), 1), pauses_per_10s=round(10 * len(gaps) / speech, 2),
                pause_mean_s=round(float(np.mean(gaps)), 2) if gaps else 0)


if __name__ == '__main__':
    rows = {}
    for arg in sys.argv[1:]:
        name, spec = arg.split('=', 1)
        paths = []
        for s in spec.split(','):
            paths += sorted(glob.glob(os.path.join(s, 'L*.wav'))) if os.path.isdir(s) else [s]
        rows[name] = analyse(paths)
        print(name, json.dumps(rows[name], ensure_ascii=False), flush=True)
