# Voice features without listening: pitch level and spread, spectral tilt and centroid, harmonicity (HNR),
# share of creaky frames, speech rate proxy (voiced onsets/s), pauses. Usage: python3 feat.py a.wav [b.wav ...]
import json, sys
import numpy as np
sys.path[:0] = ['/home/user/work/voice/shorts/voxcpm2/tools', '/home/user/work/voice2/tools']
import aud
from voice_profile import speech_frames, ltas_tilt


def hnr_frames(x, sr, f0s, hop):
    """Per voiced frame: normalized autocorrelation at the pitch period -> HNR in dB (higher = cleaner, less breathy/raspy)."""
    out = []
    n = int(0.04 * sr)
    for i, f in enumerate(f0s):
        if not (60 < f < 400):
            continue
        a = int(i * hop)
        fr = x[a:a + n]
        if len(fr) < n:
            break
        fr = fr - fr.mean()
        T = int(round(sr / f))
        if T * 2 >= n:
            continue
        r = np.dot(fr[:-T], fr[T:]) / (np.sqrt(np.dot(fr[:-T], fr[:-T]) * np.dot(fr[T:], fr[T:])) + 1e-12)
        r = min(max(r, 1e-4), 0.9999)
        out.append(10 * np.log10(r / (1 - r)))
    return np.array(out)


def centroid(x, sr):
    n = 1024
    fr = np.lib.stride_tricks.sliding_window_view(x, n)[::n // 2] * np.hanning(n)
    e = (fr ** 2).mean(1)
    fr = fr[e > np.percentile(e, 60)]
    sp = (np.abs(np.fft.rfft(fr, axis=1)) ** 2).mean(0)
    f = np.fft.rfftfreq(n, 1 / sr)
    m = f < 8000
    return float((f[m] * sp[m]).sum() / sp[m].sum())


def feats(path):
    x, sr = aud.read_wav(path)
    sp, db, top, floor, n = speech_frames(x, sr)
    win = n / sr
    idx = np.where(sp)[0]
    pauses = [g * win for g in (np.diff(idx) - 1) if g * win >= 0.15] if len(idx) > 1 else []
    f0 = aud.f0_track(x, sr)
    hop = len(x) / max(len(f0), 1)
    v = f0[(f0 > 60) & (f0 < 500)]
    h = hnr_frames(x, sr, f0, hop)
    return dict(file=path.split('/')[-1], dur=round(len(x) / sr, 1), speech=round(float(sp.sum() * win), 1),
                f0_med=round(float(np.median(v)), 1), range_st=round(float(12 * np.log2(np.percentile(v, 90) / np.percentile(v, 10))), 1),
                creak=round(float((v < 75).mean()), 3), hnr=round(float(np.median(h)), 1) if len(h) else None,
                tilt=round(ltas_tilt(x, sr), 1), centroid=int(centroid(x, sr)), pauses=len(pauses),
                pause_mean=round(float(np.mean(pauses)), 2) if pauses else 0)


if __name__ == '__main__':
    for p in sys.argv[1:]:
        print(json.dumps(feats(p), ensure_ascii=False))
