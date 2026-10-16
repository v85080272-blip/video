# Test set for the stress check: narration lines spoken by four Piper Russian voices, each line once as written
# and up to three times with one word deliberately stressed on another vowel (eval_set.py then measures how many
# of those the check catches). Piper takes espeak-style phones, and ru_phon writes them with the stress anywhere.
#   python3 make_set.py texts.json out_dir        (texts.json: a list of lines)
# Needs the Piper voices ru_RU irina, denis, dmitri, ruslan (medium) from huggingface.co/rhasspy/piper-voices
# in $PIPER_DIR (default ~/.cache/qa/piper).
import json, os, random, re, sys, time, wave
import numpy as np
import onnxruntime as ort

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from ru_phon import ipa, vowel_positions
from silero_np import SileroStress, VOWELS

PD = os.environ.get('PIPER_DIR', os.path.expanduser('~/.cache/qa/piper'))
VOICES = ['irina', 'denis', 'dmitri', 'ruslan']
FUNC = set('это этот эта эти если когда тогда потом только тоже также уже даже ещё или чтобы будто перед через после '
           'около между под над без для про'.split())
_S = {}


def voice(name):
    if name not in _S:
        base = f'{PD}/ru/ru_RU/{name}/medium/ru_RU-{name}-medium.onnx'
        so = ort.SessionOptions()
        so.intra_op_num_threads = 4
        _S[name] = (ort.InferenceSession(base, so, providers=['CPUExecutionProvider']), json.load(open(base + '.json')))
    return _S[name]


def synth_ipa(phon, name, length=1.0, noise=0.667, noise_w=0.8, seed=0):
    sess, cfg = voice(name)
    m = cfg['phoneme_id_map']
    ids = m['^'] + m['_']
    for ch in phon:
        if ch in m:
            ids += m[ch] + m['_']
    ids += m['$']
    np.random.seed(seed)
    x = sess.run(None, {'input': np.array([ids], np.int64), 'input_lengths': np.array([len(ids)], np.int64),
                        'scales': np.array([noise, length, noise_w], np.float32)})[0].squeeze()
    return x.astype(np.float32), cfg['audio']['sample_rate']


def write(path, x, sr):
    x = np.clip(x / (np.abs(x).max() + 1e-9) * 0.9, -1, 1)
    w = wave.open(path, 'wb')
    w.setnchannels(1), w.setsampwidth(2), w.setframerate(sr)
    w.writeframes((x * 32767).astype('<i2').tobytes())
    w.close()


TOK = re.compile(r"[А-Яа-яЁё+]+(?:-[А-Яа-яЁё+]+)*|[.,!?;:—…-]")


def stress_line(S, text):
    """-> [(token, 'w'|'p', stress)] with Silero's stresses (ё restored)."""
    out = []
    for t in TOK.findall(S(text)):
        if t in '.,!?;:—…-':
            out.append((t, 'p', None))
            continue
        w = t.lower()
        st = None
        if '+' in w:
            k = w.index('+')
            st = sum(c in VOWELS for c in w[:k])
        w = w.replace('+', '')
        if sum(c in VOWELS for c in w) == 1:
            st = 0
        out.append((w, 'w', st))
    return out


def main(texts_path, out):
    os.makedirs(out, exist_ok=True)
    texts = json.load(open(texts_path))
    S = SileroStress()
    random.seed(7)
    items, t0 = [], time.time()
    for li, text in enumerate(texts):
        toks = stress_line(S, text)
        elig = [(i, w, st) for i, (w, k, st) in enumerate(toks) if k == 'w' and st is not None
                and len(vowel_positions(w)) >= 2 and 'ё' not in w and w not in FUNC]
        variants = [None] + random.sample(elig, min(3, len(elig)))
        for vi_, var in enumerate(variants):
            v0 = VOICES[(li + vi_) % 4]
            for v in (VOICES if var is None else [v0, VOICES[(li + vi_ + 1) % 4]]):
                seq, actual = [], []
                for i, (w, k, st) in enumerate(toks):
                    if k == 'p':
                        seq.append({'—': ',', '…': '.', '-': ','}.get(w, w))
                        continue
                    s = st
                    if var is not None and i == var[0]:
                        n = len(vowel_positions(w))
                        s = random.choice([k2 for k2 in range(n) if k2 != st])
                    seq.append(ipa(w, s))
                    actual.append((w, st, s))
                phon = ''
                for x in seq:
                    phon += x if x in '.,!?;:' else (' ' + x if phon else x)
                name = f'L{li:03d}_{vi_}_{v}'
                x, sr = synth_ipa(phon, v, length=random.uniform(0.9, 1.12), seed=li * 10 + vi_)
                write(f'{out}/{name}.wav', x, sr)
                items.append(dict(name=name, voice=v, text=text, phon=phon, words=actual,
                                  var=None if var is None else var[1]))
        if li % 10 == 0:
            print(li, len(items), round(time.time() - t0, 1), flush=True)
    json.dump(items, open(f'{out}/items.json', 'w'), ensure_ascii=False, indent=0)
    print('done', len(items))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
