# Rank casting samples against the reference narrator: timbre (Qwen3-TTS speaker embedding, mean-centred cosine),
# pitch distance in semitones, pace, naturalness (UTMOS). Usage: python3 cast_score.py
import glob, json, os, subprocess, sys
import numpy as np
sys.path[:0] = ['/home/user/work/voice3', '/home/user/work/voice2/tools', '/home/user/work/voice/shorts/voxcpm2/tools']
from quick import quick
import score

M = '/home/user/work/models/qwen3tts'
CODEC = '/home/user/work/src/qwentts.cpp/build/qwen-codec'
REF = ['/home/user/work/refreels/prof/reel_a_spk.spk', '/home/user/work/refreels/prof/reel_b_spk.spk']
OLD = sorted(glob.glob('/home/user/work/voice2/spk_test/v*.spk'))
REF_F0 = 107.0          # median of the two reels (113 and 101 Hz on clean openings)


def spk(wav):
    s = wav[:-4] + '.spk'
    if not os.path.exists(s):
        subprocess.run([CODEC, '--model', f'{M}/qwen-tokenizer-12hz-Q8_0.gguf', '--talker',
                        f'{M}/qwen-talker-1.7b-base-Q8_0.gguf', '-i', wav], capture_output=True, check=True)
    return np.fromfile(s, np.float32)


wavs = sorted(glob.glob('/home/user/work/voice3/cast/*.wav'))
E = {os.path.basename(w)[:-4]: spk(w) for w in wavs}
old = [np.fromfile(p, np.float32) for p in OLD]
bg = np.mean(list(E.values()) + old, axis=0)
ref = np.mean([np.fromfile(p, np.float32) for p in REF], axis=0) - bg
v5 = np.fromfile('/home/user/work/voice2/spk_test/v5_energetic.spk', np.float32) - bg


def cos(a, b):
    return float(a @ b / np.linalg.norm(a) / np.linalg.norm(b))


rows = []
for w in wavs:
    k = os.path.basename(w)[:-4]
    q = quick(w)
    mos = score.utmos(score.load16(w))[0]
    rows.append(dict(id=k, sim=round(cos(E[k] - bg, ref), 3), f0=q['f0'], dst=round(abs(12 * np.log2(q['f0'] / REF_F0)), 1),
                     rate=float(q['rate']), pauses=q['pauses'], pmean=q['pmean'], mos=round(float(mos), 2)))
rows.sort(key=lambda r: -r['sim'])
print(f"reference vs current v5 voice: {cos(v5, ref):+.3f}")
for r in rows:
    print(f"{r['id']:8s} sim {r['sim']:+.3f}  f0 {r['f0']:4d} Hz (Δ{r['dst']:4.1f} st)  rate {r['rate']:.2f}  "
          f"pauses {r['pauses']} × {r['pmean']:.2f} s  MOS {r['mos']:.2f}")
json.dump(rows, open('/home/user/work/voice3/cast_scores.json', 'w'), indent=1)
