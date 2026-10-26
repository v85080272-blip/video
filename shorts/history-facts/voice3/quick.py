# Light profile of casting samples (no Whisper): pitch, speaking rate from the known text, pauses.
import glob, os, sys
import numpy as np
sys.path[:0] = ['/home/user/work/voice/shorts/voxcpm2/tools']
import aud
text = open('/home/user/work/voice3/sample.txt').read()
syl = sum(c in 'аеёиоуыэюя' for c in text.lower())
def quick(p):
    x, sr = aud.read_wav(p)
    db, n = aud.frames_db(x, sr, 0.02)
    sp = db > db.max() - 35
    idx = np.where(sp)[0]
    gaps = (np.diff(idx) - 1) * 0.02
    pauses = gaps[gaps >= 0.15]
    speech = (idx[-1] - idx[0] + 1) * 0.02
    f0 = aud.f0_track(x, sr); f0 = f0[(f0 > 60) & (f0 < 500)]
    return dict(dur=round(len(x) / sr, 1), rate=round(syl / speech, 2), art=round(syl / (speech - pauses.sum()), 2),
                pauses=len(pauses), pmean=round(float(pauses.mean()), 2) if len(pauses) else 0,
                f0=round(float(np.median(f0))), f0lo=round(float(np.percentile(f0, 10))), f0hi=round(float(np.percentile(f0, 90))))
if __name__ == '__main__':
    print('syllables', syl)
    for p in sorted(glob.glob(sys.argv[1])):
        print(os.path.basename(p), quick(p))
