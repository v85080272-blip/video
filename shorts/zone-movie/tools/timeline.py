# The timeline of «Зона: 5 походов» (the long 16:9 cut): the intro over a montage, the five episodes (1–4 cut before their
# vote), a transition before episodes 2–5, the outro. Writes build/timeline.json (read by src/main.js, tools/movie_audio.py
# and tools/assemble.sh) and build/script_abs.json (the voice script with every line at its absolute time, for voice.py).
# usage: python3 tools/timeline.py   (after a first voice.py pass has written build/words.json; else it estimates)
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
S = json.load(open(os.path.join(ROOT, 'voice/script.json')))
EPS = json.load(open(os.path.join(HERE, 'episodes.json')))
try:
    W = {l['id']: l for l in json.load(open(os.path.join(ROOT, 'build/words_seq.json')))['lines']}
except FileNotFoundError:
    W = {}
def length(i):
    if i in W: return W[i]['end'] - W[i]['at']
    l = next(l for l in S['lines'] if l['id'] == i); return len(l['text'].split()) * 0.36
# the montage: the most dangerous seconds of each episode, clean 3D (no text), first the bright fire
MONT = [(5, 0.3, 2.2), (4, 18.4, 2.0), (3, 42.9, 2.0), (2, 31.5, 2.0), (1, 6.3, 2.2)]
at, segs, clips, lines = 0.0, [], [], {}
lines['I0'] = 0.3
mont = sum(d for _, _, d in MONT)
intro = max(lines['I0'] + length('I0') + 0.8, mont)
t = 0.0
for k, s0, d in MONT:
    if k == 1: d = intro - t                                           # the last clip runs to the end of the intro
    clips.append(dict(k=k, src=EPS[k - 1]['bg'], s0=s0, dur=round(d, 3), t0=round(t, 3))); t += d
segs.append(dict(kind='intro', t0=0.0, t1=round(intro, 3)))
t = intro
for e in EPS:
    if e['k'] > 1:
        T = f"T{e['k'] - 1}"; lines[T] = t + 0.9; t1 = lines[T] + length(T) + 0.8
        segs.append(dict(kind='trans', k=e['k'], t0=round(t, 3), t1=round(t1, 3))); t = t1
    c = json.load(open(e['cues']))
    A = c['marks']['A']
    rules = [[round(A[i] + 0.2, 3), r] for i, r in e['rules']]
    segs.append(dict(kind='ep', k=e['k'], t0=round(t, 3), t1=round(t + e['trim'], 3), file=e['file'], trim=e['trim'], rules=rules,
                     title=e['title'], place=e['place'], with_=e['with'], chosen=e['chosen'], id=e['id'], black=e['starts_black']))
    t += e['trim']
o0 = t; lines['O1'] = t + 1.2
for a, b, gap in (('O1', 'O2', 0.5), ('O2', 'O3', 0.5), ('O3', 'O4', 0.5), ('O4', 'O5', 0.8)):
    lines[b] = lines[a] + length(a) + gap
end = lines['O5'] + length('O5') + 3.0
segs.append(dict(kind='outro', t0=round(o0, 3), t1=round(end, 3)))
abs_ = dict(S); abs_['lines'] = []
for l in S['lines']:
    m = {k: v for k, v in l.items() if k != 'after'}; m['at'] = round(lines[l['id']], 3); abs_['lines'].append(m)
abs_['tail'] = round(end - lines['O5'] - length('O5'), 3)
json.dump(abs_, open(os.path.join(ROOT, 'build/script_abs.json'), 'w'), ensure_ascii=False, indent=1)
json.dump(dict(dur=round(end, 3), segs=segs, clips=clips, lines={k: round(v, 3) for k, v in lines.items()}, center=[656, 0, 608, 1080]),
          open(os.path.join(ROOT, 'build/timeline.json'), 'w'), ensure_ascii=False, indent=1)
print(f'timeline {end:.1f} s = {int(end // 60)}:{end % 60:04.1f}', [(s['kind'], s.get('k'), s['t0'], s['t1']) for s in segs])
