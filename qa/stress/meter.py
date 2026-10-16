# Which vowel of each word the voice stresses, from the audio and the known text: "meter2" by siriusfreak
# (huggingface.co/siriusfreak/qwen3-tts-12hz-1.7b-ru-stress-cf, folder meter/), ported to onnxruntime + numpy.
# A Russian letter CTC model (wav2vec2 XLSR-53 fine-tuned by jonatasgrosman, Apache-2.0) is force-aligned to the
# script's letters; its hidden states of layers 12 and 19 are averaged over every vowel letter, and a small head
# scores the vowels of each word (softmax over the word's vowels). 98.3% exact syllable on unseen LibriSpeech readers.
#   python3 meter.py prepare            once: adds the hidden layers to the ONNX graph, converts head.pt to numpy
#   python3 meter.py audio.wav "текст"  prints the heard stress of every word
import io, json, math, os, pickle, re, sys, zipfile
import numpy as np

SR = 16000
FRAME = 0.02
V = 'аеёиоуыэюя'
ACUTE = '́'
WORD_RE = re.compile(r"[А-Яа-яЁё]+(?:-[А-Яа-яЁё]+)*")
OTHER_RE = re.compile(r"[A-Za-z0-9]+(?:[.,'][A-Za-z0-9]+)*")      # spoken, but not spelled with the CTC alphabet
DIR = os.environ.get('QA_METER', os.path.expanduser('~/.cache/qa/meter'))
CONF_MIN = 0.5        # below this the letters were hardly heard where they were aligned: probably not said as written
HIDDEN = {12: '/wav2vec2/encoder/layers.11/Add_1_output_0', 19: '/wav2vec2/encoder/layers.18/Add_1_output_0'}
CHUNK, MARGIN = 20 * SR, 3 * SR      # long clips run in 20 s pieces with 3 s of context on each side


def plain_text(text):
    return text.replace(ACUTE, '').replace('+', '')


def words_in(text):
    """[(word, start, end)] of the Cyrillic words of plain_text(text); hyphenated words are one word."""
    return [(m.group(0), m.start(), m.end()) for m in WORD_RE.finditer(plain_text(text))]


def vowel_pos(word):
    return [i for i, ch in enumerate(word.lower()) if ch in V]


# ---------------------------------------------------------------- one-time preparation

def patch_onnx(src, dst):
    """Expose the hidden states the head reads as extra graph outputs (onnxruntime returns only graph outputs)."""
    import onnx
    m = onnx.load(src)
    have = {o.name for o in m.graph.output}
    for name in HIDDEN.values():
        if name not in have:
            m.graph.output.append(onnx.helper.make_tensor_value_info(name, onnx.TensorProto.FLOAT, None))
    onnx.save(m, dst)


class _HeadUnpickler(pickle.Unpickler):
    """torch.save() checkpoint -> numpy arrays, without torch."""
    _DT = {'FloatStorage': np.float32, 'LongStorage': np.int64, 'HalfStorage': np.float16, 'IntStorage': np.int32,
           'DoubleStorage': np.float64, 'BoolStorage': np.bool_, 'ByteStorage': np.uint8}

    def __init__(self, zf, prefix):
        super().__init__(io.BytesIO(zf.read(prefix + 'data.pkl')))
        self.zf, self.prefix = zf, prefix

    def find_class(self, mod, name):
        if mod == 'torch' and name.endswith('Storage'):
            return name
        if mod == 'torch._utils' and name == '_rebuild_tensor_v2':
            def rebuild(storage, offset, size, stride, *a):
                if not size:
                    return storage[offset].copy()
                return np.lib.stride_tricks.as_strided(storage[offset:], size,
                                                       [s * storage.itemsize for s in stride]).copy()
            return rebuild
        if mod == 'torch._utils' and name == '_rebuild_parameter':
            return lambda data, *a: data
        if mod == 'collections' and name == 'OrderedDict':
            import collections
            return collections.OrderedDict
        if mod == 'torch' and name == 'device':
            return lambda *a: 'cpu'
        raise pickle.UnpicklingError(f'unexpected {mod}.{name} in the head file')

    def persistent_load(self, pid):
        _, kind, key = pid[0], pid[1], pid[2]
        return np.frombuffer(self.zf.read(f'{self.prefix}data/{key}'), self._DT[kind])


def convert_head(pt, dst):
    zf = zipfile.ZipFile(pt)
    prefix = next(n for n in zf.namelist() if n.endswith('data.pkl'))[:-len('data.pkl')]
    ck = _HeadUnpickler(zf, prefix).load()
    assert ck['model'] == 'mlp' and not ck['nctx'], 'only the MLP head without context layers is supported'
    st = ck['state']
    np.savez(dst, mu=ck['mu'], sd=ck['sd'], norm_w=st['norm.weight'], norm_b=st['norm.bias'],
             w1=st['proj.1.weight'], b1=st['proj.1.bias'], w2=st['out.weight'], b2=st['out.bias'],
             feats=np.array([l for k, l in ck['feats'] if k == 'ctc'], np.int64))


def prepare(model_dir=DIR, onnx_src=None, head_pt=None):
    onnx_src = onnx_src or os.path.join(model_dir, 'onnx', 'model.onnx')
    head_pt = head_pt or next(p for p in (os.path.join(model_dir, 'meter', 'head.pt'), os.path.join(model_dir, 'head.pt'))
                              if os.path.exists(p))
    patch_onnx(onnx_src, os.path.join(model_dir, 'meter.onnx'))
    convert_head(head_pt, os.path.join(model_dir, 'head.npz'))


# ---------------------------------------------------------------- the model

def _n_frames(n):
    for k, s in zip((10, 3, 3, 3, 3, 2, 2), (5, 2, 2, 2, 2, 2, 2)):
        n = (n - k) // s + 1
    return n


_erf = np.frompyfunc(math.erf, 1, 1)


class Meter:
    def __init__(self, model_dir=None, threads=None, onnx='meter.onnx'):
        import onnxruntime as ort
        d = model_dir or DIR
        self.vocab = json.load(open(os.path.join(d, 'vocab.json'), encoding='utf-8'))
        so = ort.SessionOptions()
        so.intra_op_num_threads = int(threads or os.environ.get('QA_THREADS', '4'))
        # the full optimisation level spends 15-40 s on this 1.2 GB graph and runs no faster
        so.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_EXTENDED
        self.sess = ort.InferenceSession(os.path.join(d, onnx), so, providers=['CPUExecutionProvider'])
        h = np.load(os.path.join(d, 'head.npz'))
        self.head = {k: h[k] for k in h.files}
        self.layers = [int(l) for l in self.head['feats']]
        self.outs = ['logits'] + [HIDDEN[l] for l in self.layers]

    # -- encoder
    def forward(self, x):
        """16 kHz mono -> log-probs (T, C) and the head's hidden layers [(T, 1024), ...], one row per 20 ms."""
        x = np.asarray(x, np.float32)
        if len(x) < 400:
            x = np.pad(x, (0, 400 - len(x)))
        x = (x - x.mean()) / np.sqrt(x.var() + 1e-7)
        T = _n_frames(len(x))
        if len(x) <= CHUNK + 2 * MARGIN:
            outs = [o[0] for o in self.sess.run(self.outs, {'input_values': x[None]})]
        else:
            outs = [None] * len(self.outs)
            for a in range(0, len(x), CHUNK):        # chunk starts are multiples of 320 samples = whole frames
                s0 = max(0, a - MARGIN)
                o = self.sess.run(self.outs, {'input_values': x[s0:a + CHUNK + MARGIN][None]})
                k0, f0 = (a - s0) // 320, a // 320
                f1 = min(T, (a + CHUNK) // 320)
                for i, v in enumerate(o):
                    if outs[i] is None:
                        outs[i] = np.zeros((T, v.shape[2]), np.float32)
                    n = min(f1 - f0, v.shape[1] - k0)
                    outs[i][f0:f0 + n] = v[0, k0:k0 + n]
        lg = outs[0][:T]
        m = lg.max(1, keepdims=True)
        lp = lg - m - np.log(np.exp(lg - m).sum(1, keepdims=True))
        return lp, [h[:T] for h in outs[1:]]

    # -- forced alignment of the letters
    def _targets(self, text):
        """Token ids with '|' between spoken units, and per Cyrillic word the positions of its letters."""
        t = plain_text(text)
        ids, units = [], []
        star = len(self.vocab)                       # an extra column: "any letter", for digits and Latin
        for m in re.finditer(WORD_RE.pattern + '|' + OTHER_RE.pattern, t):
            w = m.group(0)
            if ids:
                ids.append(self.vocab['|'])
            if not WORD_RE.fullmatch(w):
                ids.append(star)
                continue
            pos = []
            for ch in w.lower():
                if ch == '-':
                    pos.append(None)
                    continue
                ids.append(self.vocab.get(ch, star))
                pos.append(len(ids) - 1)
            units.append((w, pos))
        return ids, units

    @staticmethod
    def _viterbi(em, ids):
        """Best CTC path (blank 0) of the target ids through em (T, C). -> state per frame (odd = target k*2+1)."""
        T, L = len(em), len(ids)
        S = 2 * L + 1
        tok = np.zeros(S, np.int64)
        tok[1::2] = ids
        skip = np.zeros(S, bool)
        skip[3::2] = np.array(ids[1:]) != np.array(ids[:-1])
        NEG = -1e30
        alpha = np.full(S, NEG)
        alpha[0] = em[0, 0]
        alpha[1] = em[0, ids[0]]
        bp = np.zeros((T, S), np.int8)
        for t in range(1, T):
            a1 = np.concatenate(([NEG], alpha[:-1]))
            a2 = np.concatenate(([NEG, NEG], alpha[:-2]))
            a2[~skip] = NEG
            c = np.stack([alpha, a1, a2])
            k = c.argmax(0)
            alpha = c[k, np.arange(S)] + em[t, tok]
            bp[t] = k
        s = S - 1 if S == 1 or alpha[S - 1] >= alpha[S - 2] else S - 2
        path = np.empty(T, np.int64)
        for t in range(T - 1, -1, -1):
            path[t] = s
            s -= int(bp[t, s])
        return path, tok

    def align(self, lp, text):
        """Per Cyrillic word None (failed) or {span, letters [(f0, f1) | None per character], conf} in frames.
        A letter runs from its first emitted frame to the next letter's first frame; a word-final letter stops
        at most 6 frames after its last emission. conf = mean posterior of the word's letters on the path."""
        ids, units = self._targets(text)
        if not ids:
            return [None] * len(units)
        T = lp.shape[0]
        rep = sum(a == b for a, b in zip(ids, ids[1:]))
        if T < len(ids) + rep:
            return [None] * len(units)
        m = lp[:, 1:].max(1, keepdims=True)
        nonblank = m + np.log(np.exp(lp[:, 1:] - m).sum(1, keepdims=True)) - 1.0
        em = np.concatenate([lp, nonblank], 1)
        path, tok = self._viterbi(em, ids)
        sc = em[np.arange(T), tok[path]]
        first, last = [None] * len(ids), [None] * len(ids)
        lsum, lcnt = np.zeros(len(ids)), np.zeros(len(ids))
        for t, s in enumerate(path):
            if s % 2:
                j = s // 2
                if first[j] is None:
                    first[j] = t
                last[j] = t
                lsum[j] += sc[t]
                lcnt[j] += 1
        if any(f is None for f in first):
            return [None] * len(units)
        starts = first + [T]
        out = []
        for w, pos in units:
            real = [p for p in pos if p is not None]
            letters = []
            for p in pos:
                if p is None:
                    letters.append(None)
                    continue
                nxt = starts[p + 1]
                if p == real[-1]:
                    nxt = min(nxt, last[p] + 1 + 6)
                letters.append((first[p], max(nxt, first[p] + 1)))
            f0, f1 = first[real[0]], max(last[real[-1]] + 1, letters[-1][1])
            conf = float(np.mean([math.exp(lsum[p] / max(lcnt[p], 1)) for p in real]))
            out.append(dict(span=(f0, f1), letters=letters, conf=conf))
        return out

    # -- the head
    def scores(self, rows):
        """rows: [(n_vowels, D)] pooled features per word -> [probabilities over the word's vowels]."""
        h = self.head
        out = []
        for X in rows:
            X = (X - h['mu']) / h['sd']
            mu = X.mean(1, keepdims=True)
            var = ((X - mu) ** 2).mean(1, keepdims=True)
            X = (X - mu) / np.sqrt(var + 1e-5) * h['norm_w'] + h['norm_b']
            Z = np.concatenate([X, X - X.mean(0, keepdims=True)], 1) @ h['w1'].T + h['b1']
            Z = 0.5 * Z * (1 + _erf(Z / math.sqrt(2)).astype(np.float64))
            s = (Z @ h['w2'].T + h['b2'])[:, 0]
            e = np.exp(s - s.max())
            out.append(e / e.sum())
        return out

    def judge(self, x, text, lp_h=None):
        """Per Cyrillic word of text: {word, start/end (s), align, vowel_scores, best, margin}. One-vowel words get
        [1.0]; words that could not be aligned or with align below CONF_MIN get vowel_scores None."""
        words = words_in(text)
        res = [dict(word=w, cs=a, ce=b, vowel_scores=[] if not vowel_pos(w) else None, best=None, margin=None,
                    start=None, end=None, align=None) for w, a, b in words]
        if not words:
            return res
        lp, H = lp_h or self.forward(x)
        T = lp.shape[0]
        al = self.align(lp, text)
        todo, rows = [], []
        for i, ((w, _, _), a) in enumerate(zip(words, al)):
            vp = vowel_pos(w)
            if a is None:
                continue
            r = res[i]
            r['start'], r['end'] = round(a['span'][0] * FRAME, 3), round(a['span'][1] * FRAME, 3)
            r['align'] = round(a['conf'], 3)
            if not vp or a['conf'] < CONF_MIN:
                continue
            if len(vp) == 1:
                r.update(vowel_scores=[1.0], best=0, margin=1.0)
                continue
            V_ = []
            for ci in vp:
                s, e = a['letters'][ci]
                s = min(s, T - 1)
                e = min(max(e, s + 1), T)
                # the head was trained on float16-stored features
                V_.append(np.concatenate([h[s:e].mean(0).astype(np.float16).astype(np.float32) for h in H]))
            todo.append(i)
            rows.append(np.stack(V_).astype(np.float64))
        for i, p in zip(todo, self.scores(rows)):
            o = np.argsort(-p)
            res[i].update(vowel_scores=[round(float(v), 4) for v in p], best=int(o[0]),
                          margin=round(float(p[o[0]] - p[o[1]]), 4))
        return res


if __name__ == '__main__':
    if sys.argv[1:2] == ['prepare']:
        prepare(*(sys.argv[2:3] or [DIR]))
        sys.exit(0)
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from check import load_audio
    M = Meter()
    for r in M.judge(load_audio(sys.argv[1]), sys.argv[2]):
        w, b = r['word'], r['best']
        if b is not None and len(vowel_pos(w)) > 1:
            k = vowel_pos(w)[b]
            w = w[:k] + w[k].upper() + w[k + 1:]
        print(f"{r['start']}\t{w}\t{r['vowel_scores']}\t{r['align']}")
