# Round 3: rank casting samples (all read the same excerpt as the reference) by timbre similarity
# (Qwen3-TTS speaker embedding, mean-centred cosine), pitch level and spread, articulation rate, UTMOS.
# Usage: python3 cast_score3.py [subfolder of voice4, default cast]  -> voice4/<subfolder>_scores.json
import glob, json, os, subprocess, sys
import numpy as np
sys.path[:0] = ['/home/user/work/voice4/tools', '/home/user/work/voice2/tools', '/home/user/work/voice/shorts/voxcpm2/tools']
import aud
from mos import ut

W = '/home/user/work/voice4'
M = '/home/user/work/models/qwen3tts'
CODEC = '/home/user/work/src/qwentts.cpp/build/qwen-codec'
REF = ['/home/user/work/refreels/prof/reel_a_spk.spk', '/home/user/work/refreels/prof/reel_b_spk.spk']
BG = sorted(glob.glob('/home/user/work/voice2/spk_test/v*.spk')) + sorted(glob.glob('/home/user/work/voice3/cast/*.spk'))
F0_T, RANGE_T, ART_T = 112.0, 10.5, 4.3      # reference: 113/101 Hz, 10.4-11 st (p10-p90), 4.5/3.9 syl/s without pauses
TEXT = open(f'{W}/sample.txt').read()
SYL = sum(c in 'аеёиоуыэюя' for c in TEXT.lower())


def spk(wav):
    s = wav[:-4] + '.spk'
    if not os.path.exists(s):
        subprocess.run([CODEC, '--model', f'{M}/qwen-tokenizer-12hz-Q8_0.gguf', '--talker',
                        f'{M}/qwen-talker-1.7b-base-Q8_0.gguf', '-i', wav], capture_output=True, check=True)
    return np.fromfile(s, np.float32)


def prosody(w):
    x, sr = aud.read_wav(w)
    db, n = aud.frames_db(x, sr, 0.02)
    sp = db > db.max() - 35
    idx = np.where(sp)[0]
    gaps = (np.diff(idx) - 1) * 0.02
    pauses = gaps[gaps >= 0.15]
    span = (idx[-1] - idx[0] + 1) * 0.02
    f0 = aud.f0_track(x, sr)
    f0 = f0[(f0 > 60) & (f0 < 500)]
    return dict(f0=round(float(np.median(f0)), 1),
                range=round(float(12 * np.log2(np.percentile(f0, 90) / np.percentile(f0, 10))), 1),
                art=round(SYL / (span - pauses.sum()), 2), pauses=int(len(pauses)),
                pmean=round(float(pauses.mean()), 2) if len(pauses) else 0.0, dur=round(len(x) / sr, 1))


def cos(a, b):
    return float(a @ b / np.linalg.norm(a) / np.linalg.norm(b))


if __name__ == '__main__':
    wavs = sorted(glob.glob(f'{W}/{sys.argv[1] if len(sys.argv) > 1 else "cast"}/*.wav'))
    E = {os.path.basename(w)[:-4]: spk(w) for w in wavs}
    bg = np.mean(list(E.values()) + [np.fromfile(p, np.float32) for p in BG], axis=0)
    ref = np.mean([np.fromfile(p, np.float32) for p in REF], axis=0) - bg
    rows = []
    for w in wavs:
        k = os.path.basename(w)[:-4]
        p = prosody(w)
        mos = ut(w)
        dst = abs(12 * np.log2(p['f0'] / F0_T))
        s = (cos(E[k] - bg, ref) - 0.05 * max(0, dst - 1.5) - 0.05 * max(0, RANGE_T - 1 - p['range'])
             - 0.15 * max(0, abs(p['art'] - ART_T) - 0.4) + 0.15 * (mos - 4.0))
        rows.append(dict(id=k, score=round(s, 3), sim=round(cos(E[k] - bg, ref), 3), dst=round(dst, 1), mos=round(mos, 2), **p))
    rows.sort(key=lambda r: -r['score'])
    for r in rows:
        print(f"{r['id']:7s} score {r['score']:+.3f}  sim {r['sim']:+.3f}  f0 {r['f0']:5.1f} (Δ{r['dst']:.1f} st) range {r['range']:4.1f} st  "
              f"art {r['art']:.2f}  pauses {r['pauses']}×{r['pmean']:.2f}  dur {r['dur']}  MOS {r['mos']:.2f}")
    sub = sys.argv[1] if len(sys.argv) > 1 else 'cast'
    json.dump(rows, open(f'{W}/{sub.replace("/", "_")}_scores.json', 'w'), indent=1)
