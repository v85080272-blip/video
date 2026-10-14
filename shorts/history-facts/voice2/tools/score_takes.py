# Score every take in a folder: Whisper CER (digit-aware), UTMOS, pace, pitch, timbre vs the reference voice.
import json, os, re, sys, glob
import numpy as np
sys.path[:0] = ['/home/user/work/voice2/tools', '/home/user/work/voice/shorts/voxcpm2/tools']
os.environ.setdefault('VOX_HOME', '/home/user/work/voice/vox')
import aud, score

TAKES = sys.argv[1]
REF = sys.argv[2] if len(sys.argv) > 2 else '/home/user/work/voice2/ref/v5.wav'
SCRIPT = json.load(open('/home/user/video/shorts/history-facts/tunguska/script_v2.json'))
texts = {l['id']: l['text'] for l in SCRIPT['lines']}
DIG = [('тысяча девятьсот восьмом', '1908'), ('тридцатого', '30'), ('шестьдесят пять', '65'), ('девятнадцать', '19')]

def refs(t):
    out = [t]
    d = t
    for a, b in DIG:
        d = d.replace(a, b)
    if d != t:
        out.append(d)
    return out

cache_p = os.path.join(TAKES, 'scores.json')
cache = json.load(open(cache_p)) if os.path.exists(cache_p) else {}
ref_ltas = aud.ltas(REF)
x0, sr0 = aud.read_wav(REF)
f0_ref = float(np.median(aud.f0_track(x0, sr0)))

def ut(path):
    x = score.load16(path)
    a, b = aud.trim_bounds(x, 16000)
    y = x[a:b]
    if len(y) < 16000:
        return float('nan')
    if len(y) > 16000 * 8:
        return score.utmos(y)[0]
    if score._sess is None:
        score.utmos(np.zeros(16000 * 3, np.float32))   # creates the session
    return float(score._sess.run(None, {'wave': y[None].astype(np.float32)})[0][0])


files = sorted(glob.glob(os.path.join(TAKES, 'L*_s*.wav')) + glob.glob(os.path.join(TAKES, 'L*_ref.wav')))
for f in files:
    k = os.path.basename(f)
    if k in cache and cache[k].get('mtime') == os.path.getmtime(f):
        continue
    lid = k.split('_')[0]
    x, sr = aud.read_wav(f)
    a, b = aud.trim_bounds(x, sr)
    y = x[a:b]
    hyp = aud.asr(f)
    c = min(aud.cer(r, hyp) for r in refs(texts[lid]))
    f0 = aud.f0_track(y, sr)
    v = aud.ltas(f)
    sim = float(v @ ref_ltas / (np.linalg.norm(v) * np.linalg.norm(ref_ltas) + 1e-12))
    nw = len(texts[lid].replace('—', ' ').split())
    tail_rise = None
    if len(f0) > 20:
        q = len(f0) // 4
        tail_rise = round(float(12 * np.log2(np.median(f0[-max(5, q // 2):]) / np.median(f0[q:3 * q]))), 1)
    cache[k] = dict(lid=lid, mtime=os.path.getmtime(f), dur=round((b - a) / sr, 2), lead=round(a / sr, 2),
                    cer=round(c, 3), hyp=hyp, utmos=round(ut(f), 2), sim=round(sim, 3),
                    f0=round(float(np.median(f0))) if len(f0) else 0,
                    f0_dev=round(float(12 * np.log2(np.median(f0) / f0_ref)), 1) if len(f0) else None,
                    wps=round(nw / ((b - a) / sr), 2), gap=round(aud.longest_gap(y, sr), 2), tail_rise=tail_rise)
    print(k, json.dumps({kk: vv for kk, vv in cache[k].items() if kk not in ('mtime', 'lid')}, ensure_ascii=False), flush=True)
    json.dump(cache, open(cache_p, 'w'), ensure_ascii=False, indent=1)
print('SCORED', len(cache), flush=True)
