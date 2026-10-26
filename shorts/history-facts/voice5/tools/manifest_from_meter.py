# Caption word times straight from the stress meter (no whisper.cpp in this container): every script word of a line
# gets start/end from the meter's forced alignment; a word the meter is unsure of is spread evenly between its
# neighbours. Writes <cut dir>/manifest.json in the shape film.py reads (script_words).
# usage: python3 manifest_from_meter.py <cut dir> <script.json>
import json, os, re, sys
sys.path[:0] = [os.path.join(os.environ.get('QA_DIR', '/mnt/project-files/qa'), 'stress')]
from meter import Meter, CONF_MIN  # noqa: E402
from check import load_audio  # noqa: E402
import wave  # noqa: E402

D, SCRIPT = sys.argv[1:3]
M = Meter()
man = {}
for l in json.load(open(SCRIPT))['lines']:
    lid = l['id']
    wav = os.path.join(D, f'{lid}.wav')
    with wave.open(wav) as wf:
        dur = wf.getnframes() / wf.getframerate()
    R = M.judge(load_audio(wav), l['text'])
    words = []
    for r in R:
        ok = r['start'] is not None and r['align'] is not None and r['align'] >= CONF_MIN
        words.append(dict(word=r['word'], start=r['start'] if ok else None, end=r['end'] if ok else None))
    # fill gaps by interpolation
    n = len(words)
    for i, w in enumerate(words):
        if w['start'] is None:
            j0 = max([k for k in range(i) if words[k]['end'] is not None], default=None)
            j1 = min([k for k in range(i + 1, n) if words[k]['start'] is not None], default=None)
            a = words[j0]['end'] if j0 is not None else 0.0
            b = words[j1]['start'] if j1 is not None else dur
            span = (j1 if j1 is not None else n) - (j0 if j0 is not None else -1) - 1
            pos = i - (j0 if j0 is not None else -1) - 1
            w['start'] = a + (b - a) * pos / span
            w['end'] = a + (b - a) * (pos + 1) / span
    man[lid] = dict(script_words=words)
    bad = sum(1 for r in R if r['start'] is None or r['align'] is None or r['align'] < CONF_MIN)
    print(f'{lid}: {n} words, {bad} interpolated')
json.dump(man, open(os.path.join(D, 'manifest.json'), 'w'), ensure_ascii=False, indent=1)
