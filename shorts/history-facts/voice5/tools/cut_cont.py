# Cut a continuous narration take into the episode's lines (L1.wav ... + manifest.json for captions and cuts),
# keeping the storyteller's own dynamics (one gain for the whole take, not a level per line) and his own pauses
# between lines (gaps.json, for the renderer's GAPS_JSON).
# usage: python3 cut_cont.py <take.wav> <script.json> <out dir> [level dBFS, default -20]
import difflib, json, os, subprocess, sys
import numpy as np
sys.path[:0] = ['/home/user/work/voice/scripts', '/home/user/work/voice/shorts/voxcpm2/tools']
os.environ.setdefault('VOX_HOME', '/home/user/work/voice/vox')
import aud, vt

TAKE, SCRIPT, OUT = sys.argv[1:4]
LEVEL = float(sys.argv[4]) if len(sys.argv) > 4 else -20.0
PAD = 0.04
os.makedirs(OUT, exist_ok=True)
lines = json.load(open(SCRIPT))['lines']

# 48 kHz mono, rumble cut, as export.py does per line
tmp = os.path.join(OUT, '_take48.wav')
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', TAKE, '-af', 'highpass=f=60', '-ar', '48000', '-ac', '1',
                '-c:a', 'pcm_s16le', tmp], check=True)
x, sr = aud.read_wav(tmp)
x = x.astype(np.float64)

# whisper words of the whole take, in 25 s windows cut at quiet points (whole-clip whisper skips phrases)
db, hop_n = aud.frames_db(x, sr, 0.01)
words = []
start = 0
while start < len(x):
    end = min(len(x), start + 25 * sr)
    if end < len(x):                                       # move the cut back to the quietest 10 ms in the last 5 s
        a = (end - 5 * sr) // int(0.01 * sr)
        b = end // int(0.01 * sr)
        end = (a + int(np.argmin(db[a:b]))) * int(0.01 * sr)
    seg = os.path.join(OUT, '_seg.wav')
    aud.write_wav(seg, x[start:end], sr)
    tx, toks = vt.whisper(seg)
    for w in vt.refine_words(vt.words_from_tokens(toks), x[start:end], sr):
        words.append(dict(w, start=w['start'] + start / sr, end=w['end'] + start / sr))
    start = end
os.remove(seg)

# align script words to whisper words
toks = []                                                  # (line index, normalized word)
for li, l in enumerate(lines):
    for w in l['text'].split():
        n = aud.norm_text(w)
        if n:
            toks.append((li, n))
wn = [aud.norm_text(w['word']) for w in words]
sm = difflib.SequenceMatcher(a=[t[1] for t in toks], b=wn, autojunk=False)
first, last = {}, {}
for tag, i1, i2, j1, j2 in sm.get_opcodes():
    if tag != 'equal':
        continue
    for k in range(i2 - i1):
        li = toks[i1 + k][0]
        w = words[j1 + k]
        first.setdefault(li, w['start'])
        last[li] = w['end']
missing = [lines[i]['id'] for i in range(len(lines)) if i not in first]
if missing:
    sys.exit(f'no matched words for {missing}; whisper: ' + ' '.join(w["word"] for w in words))

# cut points: the quietest 10 ms between one line's last word and the next line's first word
cuts = [0]
for i in range(len(lines) - 1):
    a, b = int(last[i] * 100), int(first[i + 1] * 100)
    cuts.append((a + int(np.argmin(db[a:b + 1]))) / 100 if b > a else (last[i] + first[i + 1]) / 2)
cuts.append(len(x) / sr)

# one gain for the whole take: its speech at LEVEL dBFS, peaks under -1 dBFS
act = db[db > db.max() - 20]
g = LEVEL - 10 * np.log10(np.mean(10 ** (act / 10)))
g = min(g, -1.0 - 20 * np.log10(np.abs(x).max() + 1e-12))
x *= 10 ** (g / 20)

gaps = {}
for i, l in enumerate(lines):
    s0 = max(cuts[i], first[i] - PAD)
    s1 = min(cuts[i + 1], last[i] + PAD + 0.06)               # keep the word's tail
    a, b = aud.trim_bounds(x[int(s0 * sr):int(s1 * sr)], sr)
    y = x[int(s0 * sr) + max(0, a - int(PAD * sr)):int(s0 * sr) + min(int((s1 - s0) * sr), b + int(PAD * sr))].copy()
    f = min(int(0.01 * sr), len(y) // 4)
    y[:f] *= np.linspace(0, 1, f)
    y[-f:] *= np.linspace(1, 0, f)
    aud.write_wav(os.path.join(OUT, f'{l["id"]}.wav'), y, sr)
    if i + 1 < len(lines):
        gaps[l['id']] = round(max(0.0, first[i + 1] - last[i]), 2)
json.dump(gaps, open(os.path.join(OUT, 'gaps.json'), 'w'))
os.remove(tmp)
print('gain', round(g, 1), 'dB; gaps', gaps)
