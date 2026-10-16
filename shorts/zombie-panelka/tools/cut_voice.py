# Cut one continuous narration take into the script's lines (L1.wav …) with faster-whisper word times.
# One gain for the whole take (the narrator's own dynamics stay), cuts at the quietest 10 ms between lines,
# words.json keeps every word's time relative to its line (for word-by-word subtitles), report.json the
# per-line character error rate.
# usage: python3 -I cut_voice.py <take.wav> <script.json> <out dir> [level dBFS = -20]
import difflib, json, os, re, subprocess, sys
import numpy as np
import soundfile as sf

TAKE, SCRIPT, OUT = sys.argv[1:4]
LEVEL = float(sys.argv[4]) if len(sys.argv) > 4 else -20.0
SR = 48000
os.makedirs(OUT, exist_ok=True)
lines = json.load(open(SCRIPT))['lines']


def norm(w):
    return re.sub(r'[^0-9a-zа-я]', '', w.lower().replace('ё', 'е'))


def load(path, sr):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-af', 'highpass=f=60', '-ac', '1', '-ar', str(sr),
                          '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


x = load(TAKE, SR)
x16 = load(TAKE, 16000).astype(np.float32)
hop = int(0.01 * SR)
fr = x[:len(x) // hop * hop].reshape(-1, hop)
db = 10 * np.log10(np.mean(fr ** 2, axis=1) + 1e-12)

from faster_whisper import WhisperModel
model = WhisperModel(os.environ.get('WHISPER', 'large-v3-turbo'), device='cpu', compute_type='int8',
                     cpu_threads=int(os.environ.get('WHISPER_THREADS', '4')))
words, start = [], 0
while start < len(x16):                                   # 25 s windows cut at quiet points
    end = min(len(x16), start + 25 * 16000)
    if end < len(x16):
        a, b = (end - 5 * 16000) * SR // 16000 // hop, end * SR // 16000 // hop
        end = (a + int(np.argmin(db[a:b]))) * hop * 16000 // SR
    segs, _ = model.transcribe(x16[start:end], language='ru', word_timestamps=True, beam_size=5, vad_filter=False,
                               condition_on_previous_text=False)
    for s in segs:
        for w in s.words:
            words.append(dict(word=w.word.strip(), start=w.start + start / 16000, end=w.end + start / 16000, p=w.probability))
    start = end
print('whisper:', ' '.join(w['word'] for w in words))

toks = [(li, norm(part), wi) for li, l in enumerate(lines) for wi, w in enumerate(l['text'].split()) for part in w.split('-') if norm(part)]
wn = [norm(w['word']) for w in words]
sm = difflib.SequenceMatcher(a=[t[1] for t in toks], b=wn, autojunk=False)
first, last = {}, {}
times = {li: [None] * len(l['text'].split()) for li, l in enumerate(lines)}   # (start, end) per script word
heard = {li: [] for li in range(len(lines))}
for tag, i1, i2, j1, j2 in sm.get_opcodes():
    same = tag == 'equal' or (tag == 'replace' and (i2 - i1) == (j2 - j1))   # same count: misheard words
    if not same:
        continue
    for k in range(i2 - i1):
        li, _, wi = toks[i1 + k]
        w = words[j1 + k]
        first.setdefault(li, w['start']); last[li] = w['end']
        old = times[li][wi]
        times[li][wi] = (min(old[0], w['start']), max(old[1], w['end'])) if old else (w['start'], w['end'])
        heard[li].append(w['word'])
missing = [lines[i]['id'] for i in range(len(lines)) if i not in first]
if missing:
    sys.exit(f'no matched words for {missing}')

cuts = [0.0]
for i in range(len(lines) - 1):
    a, b = int(last[i] * 100), int(first[i + 1] * 100)
    cuts.append((a + int(np.argmin(db[a:b + 1]))) / 100 if b > a else (last[i] + first[i + 1]) / 2)
cuts.append(len(x) / SR)

act = db[db > db.max() - 20]
gain = LEVEL - 10 * np.log10(np.mean(10 ** (act / 10)))
gain = min(gain, -1.0 - 20 * np.log10(np.abs(x).max() + 1e-12))
x = x * 10 ** (gain / 20)


def trim(y):                                              # silence below -45 dB relative to the line peak
    e = 20 * np.log10(np.abs(y) + 1e-9)
    k = np.where(e > 20 * np.log10(np.abs(y).max() + 1e-9) - 45)[0]
    return (k[0], k[-1]) if len(k) else (0, len(y))


report, out_words, gaps = {}, {}, {}
PAD = 0.04
for i, l in enumerate(lines):
    s0 = max(cuts[i], first[i] - PAD)
    s1 = min(cuts[i + 1], last[i] + PAD + 0.08)
    seg = x[int(s0 * SR):int(s1 * SR)]
    a, b = trim(seg)
    a = max(0, a - int(0.03 * SR)); b = min(len(seg), b + int(0.05 * SR))
    y = seg[a:b].copy()
    f = min(int(0.01 * SR), len(y) // 4)
    y[:f] *= np.linspace(0, 1, f); y[-f:] *= np.linspace(1, 0, f)
    sf.write(os.path.join(OUT, f'{l["id"]}.wav'), y.astype(np.float32), SR, subtype='PCM_24')
    t0 = s0 + a / SR
    tw = times[i]
    sw = l['text'].split()
    known = [k for k, v in enumerate(tw) if v]
    for k in range(len(tw)):                      # unmatched words: share the gap between known neighbours
        if tw[k] is None:
            lo = max([j for j in known if j < k], default=None); hi = min([j for j in known if j > k], default=None)
            a0 = tw[lo][1] if lo is not None else first[i]; b0 = tw[hi][0] if hi is not None else last[i]
            n0 = (hi if hi is not None else len(tw)) - (lo if lo is not None else -1) - 1
            pos = k - (lo if lo is not None else -1) - 1
            d = (b0 - a0) / max(1, n0)
            tw[k] = (a0 + d * pos, a0 + d * (pos + 1))
    out_words[l['id']] = [dict(w=sw[k], s=round(tw[k][0] - t0, 3), e=round(tw[k][1] - t0, 3)) for k in range(len(sw))]
    hrd = ''.join(norm(w['word']) for w in words if cuts[i] <= (w['start'] + w['end']) / 2 < cuts[i + 1])
    ref = ''.join(norm(w) for w in sw)
    cer = 1 - difflib.SequenceMatcher(a=ref, b=hrd).ratio()
    report[l['id']] = dict(dur=round(len(y) / SR, 2), cer=round(cer, 3), heard=len(heard[i]), of=len(sw))
    if i + 1 < len(lines):
        gaps[l['id']] = round(max(0.0, first[i + 1] - last[i]), 2)
json.dump(out_words, open(os.path.join(OUT, 'words.json'), 'w'), ensure_ascii=False, indent=1)
json.dump(gaps, open(os.path.join(OUT, 'gaps.json'), 'w'))
json.dump(report, open(os.path.join(OUT, 'report.json'), 'w'), ensure_ascii=False, indent=1)
print('gain', round(gain, 1), 'dB')
for k, v in report.items():
    print(k, v)
