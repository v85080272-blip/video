#!/usr/bin/env python3
# Quick self-test after qa/setup.sh: models load, the stress dictionary agrees with Silero, the aligner finds letters
# where they are, the mix checks fire on a synthetic clip with known faults (clipping, a click, a dead stop,
# an effect louder than the voice).
import os, sys, tempfile, wave
import numpy as np

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path[:0] = [os.path.join(HERE, 'stress'), os.path.join(HERE, 'mix')]
ok = True


def check(name, cond, detail=''):
    global ok
    ok &= bool(cond)
    print(('ok   ' if cond else 'FAIL ') + name + (f' ({detail})' if detail and not cond else ''))


from silero_np import SileroStress
S = SileroStress()
out = S('Учёные нашли замок на двери замка. Массовая истерия.')
check('stress dictionary', 'зам+ок' in out and 'истер+ия' in out and 'з+амка' in out, out)

from check import script_words
txt = 'Посреди +озера стоит +Ольга.'
W = {w['norm']: w for w in script_words(txt, S)}
check('stress mark before the first letter', W['озера']['stress'] == 0 and W['озера']['source'] == 'author'
      and txt[W['озера']['start']] == 'о' and txt[W['ольга']['start']] == 'О' and W['ольга']['name'],
      str({k: (w['start'], w['stress'], w['name']) for k, w in W.items()}))
from textcheck import analyze_text
tts = analyze_text('Что делать, если ты оказался посреди радиоактивного озера?', S, engine='qwen3')['tts_text']
check('voice text leaves an unsure homograph as written', 'озера?' in tts, tts)

from meter import Meter
M = Meter()
lp, H = M.forward(np.zeros(16000, np.float32))
check('letter recogniser', lp.shape == (49, len(M.vocab)) and np.allclose(np.exp(lp).sum(1), 1, atol=1e-3)
      and len(H) == 2 and H[0].shape == (49, 1024), str(lp.shape))
p = M.scores([np.zeros((3, 2048))])[0]
check('stress head', p.shape == (3,) and abs(p.sum() - 1) < 1e-6)
# letters "м а м а" emitted at frames 1, 2-3, 5, 6 of 9: the aligner must put them there
em = np.full((9, len(M.vocab)), -9.0)
for t, ch in enumerate('_мaa_мa__'.replace('a', 'а')):
    em[t, M.vocab['<pad>'] if ch == '_' else M.vocab[ch]] = 0.0
em -= np.log(np.exp(em).sum(1, keepdims=True))
al = M.align(em, 'мама')[0]
check('letter alignment', al and al['letters'][1] == (2, 5) and al['letters'][3][0] == 6 and al['conf'] > 0.9, str(al))

from mixcheck import check_mix
sr = 48000
t = np.arange(int(7.5 * sr)) / sr
rng = np.random.default_rng(1)
bed = 0.04 * np.sin(2 * np.pi * 220 * t)                     # quiet music bed all along, ends at full level
voice = np.zeros_like(t)
spans = [(0.3, 2.0), (2.5, 5.5)]
for a, b in spans:
    m = (t >= a) & (t < b)
    voice[m] = 0.25 * rng.standard_normal(m.sum()) * (0.6 + 0.4 * np.sin(2 * np.pi * 4 * t[m]))
x = bed + voice
x[(t > 3.0) & (t < 3.002)] = 1.0                              # clipping
x[int(2.2 * sr)] += 0.6                                       # a click in the pause between the phrases
fx = (t >= 5.9) & (t < 6.5)
x[fx] += 0.6 * rng.standard_normal(fx.sum())                 # an effect after the last phrase, far louder than it
x = np.clip(x, -1, 1)
st = np.stack([x, x], 1)
with tempfile.TemporaryDirectory() as d:
    p = os.path.join(d, 't.wav')
    w = wave.open(p, 'wb')
    w.setnchannels(2), w.setsampwidth(2), w.setframerate(sr)
    w.writeframes((st * 32767).astype(np.int16).tobytes())
    w.close()
    Mx, F = check_mix(p, spans, music_expected=True)
codes = {f['code'] for f in F}
check('mix: clipping', 'clipping' in codes, str(codes))
check('mix: click', 'click' in codes, str(codes))
check('mix: dead stop at the end', 'abrupt_end' in codes, str(codes))
loud = [f for f in F if f['code'] == 'fx_loud']
check('mix: effect louder than the voice', len(loud) == 1 and loud[0]['level'] == 'ошибка'
      and 5.6 < loud[0]['t'] < 6.2, str(loud))
check('mix: voice over music measured', Mx.get('voice_over_bed_db') is not None and Mx['voice_over_bed_db'] > 10,
      str(Mx.get('voice_over_bed_db')))

from asr import compare
said = 'до девяноста процентов пыли'.split()
heard = lambda *ws: [(w, i * 0.3, i * 0.3 + 0.2, 0.9) for i, w in enumerate(ws)]
ops = compare(said, heard('до', '90', '%', 'пыли.')), compare(said, heard('до', '90', 'пыли.'))
check('speech: «90 %» is «девяноста процентов»', not ops[0] and [o['script'] for o in ops[1]] == ['процентов'],
      str(ops))
sys.exit(0 if ok else 1)
