# Silero Stress (MIT, github.com/snakers4/silero-stress) without torch.
# `extract` reads the torch.package inside the PyPI wheel with a plain unpickler and saves the weights as numpy;
# `SileroStress` runs the same pipeline in numpy: phrase rules and a small BERT pick the variant of each homograph,
# then the n-gram accentor puts the stress (and ё) in every other word. `analyze` also says how sure it was.
import gzip, io, json, math, os, pickle, re, sys, zipfile
import numpy as np

VOWELS = 'аоуыэиеяёю'
_DTYPES = {'FloatStorage': np.float32, 'LongStorage': np.int64, 'CharStorage': np.int8, 'IntStorage': np.int32,
           'ByteStorage': np.uint8, 'HalfStorage': np.float16, 'DoubleStorage': np.float64, 'BoolStorage': np.bool_}
DATA = os.environ.get('QA_SILERO', os.path.expanduser('~/.cache/qa/silero_stress'))


# ---------------------------------------------------------------- reading the torch.package without torch

class _Obj(dict):
    """Stand-in for any pickled class: keeps constructor args, state and items."""
    def __init__(self, *a, **k):
        super().__init__()
        self.__dict__['_args'] = a

    def __setstate__(self, st):
        if isinstance(st, tuple) and len(st) == 2 and isinstance(st[1], dict):
            st = {**(st[0] or {}), **st[1]}
        if isinstance(st, dict):
            self.__dict__.update(st)
        else:
            self.__dict__['_state'] = st

    def __getattr__(self, k):
        try:
            return self.__dict__[k]
        except KeyError:
            raise AttributeError(k)

    def append(self, v):
        self.setdefault('_list', []).append(v)

    def extend(self, v):
        self.setdefault('_list', []).extend(v)


class _Storage:
    pass


class _Unpickler(pickle.Unpickler):
    def __init__(self, data, zf, prefix, ts_loader=None):
        super().__init__(io.BytesIO(data))
        self.zf, self.prefix, self.ts_loader = zf, prefix, ts_loader

    def find_class(self, mod, name):
        if mod == 'torch' and name.endswith('Storage'):
            return type(name, (_Storage,), {})
        if mod == 'torch._utils' and name == '_rebuild_tensor_v2':
            return self._tensor
        if mod == 'torch._utils' and name == '_rebuild_parameter':
            return lambda data, *a: data
        if mod == 'torch.jit._pickle' and name == 'restore_type_tag':
            return lambda obj, tag: obj
        if mod == 'torch.jit._script' and name == 'unpackage_script_module':
            return lambda importer, sid: self.ts_loader(sid)
        if mod == 'torch' and name == 'device':
            return lambda *a: 'cpu'
        if mod == 're' and name == '_compile':
            return re.compile
        if mod == 'collections' and name == 'OrderedDict':
            import collections
            return collections.OrderedDict
        if mod == 'builtins' and name in ('set', 'frozenset', 'list', 'dict', 'tuple'):
            return {'set': set, 'frozenset': frozenset, 'list': list, 'dict': dict, 'tuple': tuple}[name]
        return type(name, (_Obj,), {'__module__': mod})

    def persistent_load(self, pid):
        if isinstance(pid, tuple) and pid and pid[0] == 'storage':
            kind, key = pid[1], str(pid[2])
            kind = kind.__name__ if isinstance(kind, type) else str(kind)
            raw = self.zf.read(f'{self.prefix}.data/{key if key.endswith(".storage") else key + ".storage"}')
            return np.frombuffer(raw, _DTYPES[kind])
        if isinstance(pid, tuple) and pid and pid[0] == 'reduce_package':      # ('reduce_package', id, func, args)
            return pid[2](None, *pid[3])
        return pid

    @staticmethod
    def _tensor(storage, offset, size, stride, *a):
        if not size:
            return storage[offset].copy() if len(storage) else np.zeros(())
        return np.lib.stride_tricks.as_strided(storage[offset:], size, [s * storage.itemsize for s in stride]).copy()


def _load_package(pt_path):
    zf = zipfile.ZipFile(pt_path)
    prefix = zf.namelist()[0].split('/')[0] + '/'

    def ts_loader(sid):
        return _Unpickler(zf.read(f'{prefix}.data/ts_code/{sid}/data.pkl'), zf, prefix).load()

    return _Unpickler(zf.read(prefix + 'accentor_models/accentor'), zf, prefix, ts_loader).load()


def _linear_stack(seq):
    """TorchScript Sequential -> [(W, b), ...] of its Linear layers (ReLU between them, dropout ignored)."""
    out = []
    for k in sorted((k for k in seq.__dict__ if k.isdigit()), key=int):
        m = seq.__dict__[k]
        if 'weight' in m.__dict__:
            out.append((np.asarray(m.weight, np.float32), np.asarray(m.bias, np.float32)))
    return out


def _codes(w, scale, zp):
    """Weights stored as scale * (code - zp) with int8 codes: back to the codes (exact)."""
    q = np.round(np.asarray(w, np.float64) / scale + zp)
    assert np.abs(scale * (q - zp) - w).max() < 1e-4 and q.min() >= -128 and q.max() <= 127
    return q.astype(np.int8)


def extract(pt_path, out_dir=DATA):
    """Read accentor.pt (from the silero-stress wheel) and write numpy weights + json tables to out_dir."""
    root = _load_package(pt_path)
    acc, homo = root.accentor, root.homosolver
    m = acc.model
    arrays = {}
    # the accentor's n-gram embeddings are already dequantized in the package; keep them as their int8 codes
    s, z = float(np.asarray(m.scale).reshape(-1)[0]), float(np.asarray(m.zero_point).reshape(-1)[0])
    arrays['acc_emb_q'], arrays['acc_emb_sz'] = _codes(m.embedding.weight, s, z), np.array([s, z], np.float32)
    for name, seq in (('stress', m.stress_clf), ('yo', m.yo_clf)):
        for i, (w, b) in enumerate(_linear_stack(seq)):
            arrays[f'acc_{name}_{i}_w'], arrays[f'acc_{name}_{i}_b'] = w, b
    bert = homo.model.bert
    E = bert.embeddings
    we = np.asarray(E.word_embeddings.weight)
    assert we.dtype == np.int8           # BERT word embeddings are stored as codes; silero dequantizes them on load
    arrays['bert_word_q'] = we
    arrays['bert_word_sz'] = np.array([float(np.asarray(bert.scale).reshape(-1)[0]),
                                       float(np.asarray(bert.zero_point).reshape(-1)[0])], np.float32)
    arrays['bert_pos'] = np.asarray(E.position_embeddings.weight, np.float32)
    arrays['bert_type'] = np.asarray(E.token_type_embeddings.weight, np.float32)
    arrays['bert_ln_w'], arrays['bert_ln_b'] = np.asarray(E.LayerNorm.weight), np.asarray(E.LayerNorm.bias)
    layers = bert.encoder.layer
    keys = sorted((k for k in layers.__dict__ if k.isdigit()), key=int)
    for k in keys:
        L = layers.__dict__[k]
        a = L.attention
        for nm, mod in (('q', a.self.query), ('k', a.self.key), ('v', a.self.value), ('o', a.output.dense),
                        ('i', L.intermediate.dense), ('f', L.output.dense)):
            arrays[f'bert_{k}_{nm}_w'] = np.asarray(mod.weight, np.float32)
            arrays[f'bert_{k}_{nm}_b'] = np.asarray(mod.bias, np.float32)
        arrays[f'bert_{k}_ln1_w'], arrays[f'bert_{k}_ln1_b'] = a.output.LayerNorm.weight, a.output.LayerNorm.bias
        arrays[f'bert_{k}_ln2_w'], arrays[f'bert_{k}_ln2_b'] = L.output.LayerNorm.weight, L.output.LayerNorm.bias
    for i, (w, b) in enumerate(_linear_stack(homo.model.homo_clf)):
        arrays[f'homo_clf_{i}_w'], arrays[f'homo_clf_{i}_b'] = w, b
    tok = homo.tokenizer
    tables = dict(
        version='silero-stress 1.5',
        ngrams=[g for g, _ in sorted(m.embedding.ngram_dict.items(), key=lambda kv: kv[1])],
        exceptions={k: list(v) for k, v in acc.exceptions.items()},
        homodict=homo.homodict,
        phrases={k: v.pattern for k, v in homo.compiled_phrases.items()},
        bert=dict(layers=len(keys), heads=int(layers.__dict__[keys[0]].attention.self.num_attention_heads),
                  vocab=[t for t, _ in sorted(tok.vocab.items(), key=lambda kv: kv[1])],
                  never_split=sorted(tok.never_split), unk=tok.unk_token_id, cls=tok.cls_token_id,
                  sep=tok.sep_token_id, homo_start=tok.homo_start_id, homo_end=tok.homo_end_id),
        window=homo.window_size,
    )
    os.makedirs(out_dir, exist_ok=True)
    np.savez(os.path.join(out_dir, 'silero_stress.npz'), **{k: np.asarray(v) for k, v in arrays.items()})
    with gzip.open(os.path.join(out_dir, 'silero_stress.json.gz'), 'wt', encoding='utf-8') as f:
        json.dump(tables, f, ensure_ascii=False)
    return out_dir


# ---------------------------------------------------------------- numpy inference

def _mlp(x, layers):
    for i, (w, b) in enumerate(layers):
        x = x @ w.T + b
        if i + 1 < len(layers):
            x = np.maximum(x, 0)
    return x


def _softmax(x):
    e = np.exp(x - x.max(-1, keepdims=True))
    return e / e.sum(-1, keepdims=True)


def _ln(x, w, b, eps=1e-12):
    m = x.mean(-1, keepdims=True)
    v = ((x - m) ** 2).mean(-1, keepdims=True)
    return (x - m) / np.sqrt(v + eps) * w + b


_erf = np.frompyfunc(math.erf, 1, 1)


def _gelu(x):
    return 0.5 * x * (1.0 + _erf(x / math.sqrt(2.0)).astype(np.float32))


def _is_punct(ch):
    import unicodedata
    cp = ord(ch)
    return 33 <= cp <= 47 or 58 <= cp <= 64 or 91 <= cp <= 96 or 123 <= cp <= 126 or \
        unicodedata.category(ch).startswith('P')


class SileroStress:
    def __init__(self, data_dir=DATA):
        npz, js = os.path.join(data_dir, 'silero_stress.npz'), os.path.join(data_dir, 'silero_stress.json.gz')
        if not os.path.exists(npz):
            raise FileNotFoundError(f'{npz} missing: run qa/setup.sh (it converts the silero-stress wheel)')
        A = np.load(npz)
        with gzip.open(js, 'rt', encoding='utf-8') as f:
            T = json.load(f)
        s, z = A['acc_emb_sz']
        self.acc_emb = (s * (A['acc_emb_q'].astype(np.float32) - z)).astype(np.float32)
        self.stress_clf = [(A[f'acc_stress_{i}_w'], A[f'acc_stress_{i}_b']) for i in range(4)]
        self.yo_clf = [(A[f'acc_yo_{i}_w'], A[f'acc_yo_{i}_b']) for i in range(4)]
        self.ngram = {g: i for i, g in enumerate(T['ngrams'])}
        self.exceptions = {k: tuple(v) for k, v in T['exceptions'].items()}
        self.homodict = T['homodict']
        self.phrases = {k: re.compile(p, re.IGNORECASE) for k, p in T['phrases'].items()}
        B = T['bert']
        self.vocab = {t: i for i, t in enumerate(B['vocab'])}
        self.never_split = set(B['never_split'])
        self.tok_ids = B
        self.heads = B['heads']
        s, z = A['bert_word_sz']
        self.bert_word_q, self.bert_word_sz = A['bert_word_q'], (float(s), float(z))
        self.bert = {k: A[k] for k in A.files if k.startswith('bert_') and k != 'bert_word_q'}
        self.n_layers = B['layers']
        self.homo_clf = [(A[f'homo_clf_{i}_w'], A[f'homo_clf_{i}_b']) for i in range(2)]
        self.window = T['window']
        self._word_re = re.compile(r'(?=.*[а-яё])[а-яё+]+', re.IGNORECASE)
        self._clean_re = [re.compile(p) for p in (r'[^a-zA-Zа-яА-ЯёЁ0-9\s.!?,\-]', r'\s+', r'-{2,}', r'([.!?])\1+',
                                                   r',{2,}', r'\s+([.,!?])', r'([.,!?])(?=\S)')]

    # ---- n-gram accentor
    def word_probs(self, words):
        """Clean lower-case words -> (stress probs (n, 10) over vowel index, ё probs (n, 7): 0 none, k = k-th е)."""
        X = np.empty((len(words), self.acc_emb.shape[1]), np.float32)
        for n, w in enumerate(words):
            s = '<' + w + '>'
            ids = [self.ngram[s[i:i + k]] for k in range(1, len(w) + 4) for i in range(len(s) - k + 1)
                   if s[i:i + k] in self.ngram]
            if not w and '' in self.ngram:
                ids.append(self.ngram[''])
            X[n] = self.acc_emb[ids or [self.ngram['UNK']]].mean(0)
        return _softmax(_mlp(X, self.stress_clf)), _softmax(_mlp(X, self.yo_clf))

    # ---- homograph BERT
    def _tokenize(self, text):
        out = []
        for tok in text.strip().split():
            if tok in self.never_split:
                out.append(tok)
                continue
            cur = []
            for ch in tok:
                if _is_punct(ch):
                    if cur:
                        out.append(''.join(cur))
                        cur = []
                    out.append(ch)
                else:
                    cur.append(ch)
            if cur:
                out.append(''.join(cur))
        ids = [self.tok_ids['cls']]
        for tok in out:
            if len(tok) > 100:
                ids.append(self.tok_ids['unk'])
                continue
            start, sub = 0, []
            while start < len(tok):
                end = len(tok)
                while start < end:
                    piece = ('##' if start else '') + tok[start:end]
                    if piece in self.vocab:
                        break
                    end -= 1
                if start == end:
                    sub = None
                    break
                sub.append(self.vocab[piece])
                start = end
            ids.extend(sub if sub is not None else [self.tok_ids['unk']])
        return ids + [self.tok_ids['sep']]

    def homo_logit(self, marked):
        """Text with '[HOMO] word [/HOMO]' -> logit that the 2nd (sorted) variant is meant."""
        ids = self._tokenize(marked)
        P = self.bert
        s, z = self.bert_word_sz
        h = s * (self.bert_word_q[ids].astype(np.float32) - z) + P['bert_pos'][:len(ids)] + P['bert_type'][0]
        h = _ln(h, P['bert_ln_w'], P['bert_ln_b'])
        T, H = h.shape
        nh, hs = self.heads, H // self.heads
        for k in range(self.n_layers):
            g = lambda nm: (P[f'bert_{k}_{nm}_w'], P[f'bert_{k}_{nm}_b'])
            q, kk, v = [(h @ w.T + b).reshape(T, nh, hs).transpose(1, 0, 2) for w, b in (g('q'), g('k'), g('v'))]
            att = _softmax(q @ kk.transpose(0, 2, 1) / math.sqrt(hs))
            ctx = (att @ v).transpose(1, 0, 2).reshape(T, H)
            w, b = g('o')
            a = _ln(ctx @ w.T + b + h, P[f'bert_{k}_ln1_w'], P[f'bert_{k}_ln1_b'])
            w, b = g('i')
            inter = _gelu(a @ w.T + b)
            w, b = g('f')
            h = _ln(inter @ w.T + b + a, P[f'bert_{k}_ln2_w'], P[f'bert_{k}_ln2_b'])
        i0, i1 = ids.index(self.tok_ids['homo_start']), ids.index(self.tok_ids['homo_end'])
        feat = np.concatenate([h[i0], h[i0 + 1:i1].mean(0)])
        return float(_mlp(feat[None], self.homo_clf)[0, 0])

    def _clean(self, text, is_start):
        if not text:
            return ''
        r = self._clean_re
        text = r[0].sub('', text)
        text = r[1].sub(' ', text)
        text = r[2].sub(' - ', text)
        text = r[3].sub(r'\1', text)
        text = r[4].sub(',', text)
        text = r[5].sub(r'\1', text)
        text = r[3].sub(r'\1', text)
        text = r[4].sub(',', text)
        text = r[6].sub(r'\1 ', text)
        text = r[1].sub(' ', text).strip()
        if is_start:
            text = text.lstrip(' .,!?-')
            if text:
                text = text[0].upper() + text[1:].lower()
        else:
            if text:
                text = text[0] + text[1:].lower()
            if text and text[-1] not in '.!?':
                text += '.'
        return text

    def _homographs(self, sentence, meta):
        """Silero's HomoSolver: put the stress (and ё) into each homograph; meta[start in result] = details."""
        found = []
        for mt in self._word_re.finditer(sentence):
            start, end = mt.span()
            word = mt.group()
            wl = word.lower()
            if wl not in self.homodict and wl not in self.phrases:
                continue
            left = self._clean(sentence[:start], True)[-(self.window // 2):]
            right = self._clean(sentence[end:], False)[:self.window // 2]
            marked = (left + ' [HOMO] ' + wl + ' [/HOMO] ' + right).strip()
            pred, info = None, None
            if wl in self.phrases:
                m = self.phrases[wl].search(marked)
                if m:
                    g = next(k for k, v in m.groupdict().items() if v is not None)
                    i = next(i for i, c in enumerate(g) if c.isupper())
                    pred, info = g[:i] + '+' + g[i:].lower(), dict(how='phrase')
            if pred is None:
                if wl not in self.homodict:
                    continue
                variants = sorted(self.homodict[wl])
                p = 1 / (1 + math.exp(-self.homo_logit(marked)))
                pred = variants[int(p > 0.5)]
                info = dict(how='bert', variants=variants, p=[1 - p, p])
            info['variants'] = info.get('variants') or sorted(self.homodict.get(wl, [pred]))
            found.append((start, end, word, pred, info))
        out, offset = sentence, 0
        for start, end, word, pred, info in found:
            start, end = start + offset, end + offset
            si = pred.index('+')
            plain = pred.replace('+', '')
            plain = ''.join(c2.lower() if c1.islower() else c2.upper() for c1, c2 in zip(word, plain))
            plain = plain[:si] + '+' + plain[si:]
            meta[start] = dict(source='homograph', **info)
            out = out[:start] + plain + out[end:]
            offset += 1
        return out

    def analyze(self, sentence):
        """Silero's full pipeline on one text. Returns (accented text, words), where each word is
        {text, start, end, stress (vowel index) or None, yo, source, p (confidence), variants (homographs)}.
        The word offsets refer to the input text; '+' already in the input is kept as the author's stress."""
        meta = {}
        homo = self._homographs(sentence, meta)
        tokens, starts, model_in, mask = [], [], [], []
        pos = 0
        for piece in re.split(r'([\s.,!?;:<>=()/\\]+)', homo):
            parts = piece.split('-')
            toks = parts if len(parts) == 1 else [p + '-' for p in parts[:-1]] + [parts[-1]]
            pm = [True] if len(parts) == 1 else [True] * (len(parts) - 1) + [parts[-1] != 'то']
            for t, ok in zip(toks, pm):
                clean = re.sub(r'[^А-Яа-яёЁ]', '', t.lower())
                tokens.append(t)
                starts.append(pos)
                model_in.append(clean)
                mask.append(ok and len(clean) > 0)
                pos += len(t)
        sp, yp = self.word_probs(model_in)
        out_tokens, words = [], []
        for k, (raw, clean, ok) in enumerate(zip(tokens, model_in, mask)):
            info = meta.get(starts[k], {})
            if not ok:
                out_tokens.append(raw)
                continue
            low = raw.lower()
            have_stress, have_yo = '+' in low, 'ё' in low
            nv = sum(c in VOWELS for c in low)
            src = info.get('source') or ('author' if have_stress else None)
            res = None
            if have_stress and have_yo:
                res = raw
            elif have_yo:
                ys = [i for i, c in enumerate(low) if c == 'ё']
                res = raw
                for i, y in enumerate(ys):
                    res = res[:y + i] + '+' + res[y + i:]
                src = src or 'ё'
            elif clean in self.exceptions:
                res = self._exception(clean, raw, have_stress)
                src = src or 'exception'
            if res is None:
                stress_id = int(sp[k].argmax())
                set_stress = sp[k, stress_id] > 0.5 and not have_stress
                yo_id = int(yp[k].argmax())
                set_yo = yp[k, yo_id] > 0.5
                stress_ids = [stress_id]
                if have_stress:
                    stress_ids = [sum(map(part.count, VOWELS)) for part in low.split('+')]
                vpos = [i for i, c in enumerate(low) if c in VOWELS]
                epos = [i for i, c in enumerate(low) if c == 'е']
                s_pos = [vpos[i] for i in stress_ids if i < len(vpos)]
                y_pos = [epos[yo_id - 1]] if 0 < yo_id <= len(epos) else []
                res = raw
                if vpos:
                    for y in y_pos:
                        if y in s_pos and set_yo and low[y] == 'е':
                            res = res[:y] + ('ё' if res[y].islower() else 'Ё') + res[y + 1:]
                    if len(vpos) == 1:
                        s_pos, set_stress = [vpos[0]], True
                    if not have_stress and set_stress:
                        for i, p in enumerate(s_pos):
                            res = res[:p + i] + '+' + res[p + i:]
                if src is None:
                    src = 'single' if nv == 1 else 'model'
                    info = dict(info, p=float(sp[k, stress_id]), alt=self._alternatives(sp[k], nv))
            out_tokens.append(res)
            words.append(self._word(res, starts[k], len(raw.rstrip('-')) - (starts[k] in meta), src, info))
        text = ''.join(out_tokens)
        # map offsets back onto the input text (the homograph stage inserted '+' signs)
        shift = sorted(s for s in meta)
        for w in words:
            before = sum(1 for s in shift if s < w['start'])
            w['start'] -= before
            w['end'] = w['start'] + w.pop('span')
        return text, words

    @staticmethod
    def _alternatives(p, nv):
        order = np.argsort(-p[:max(nv, 1)])
        return [(int(i), float(p[i])) for i in order[:3]]

    def _exception(self, clean, raw, have_stress):
        st, yo = self.exceptions[clean]
        if have_stress:
            marks = [i for i, c in enumerate(raw) if c == '+']
            w = raw.replace('+', '')
            if yo != -1 and yo + 1 in marks:
                w = w[:yo] + ('ё' if w[yo].islower() else 'Ё') + w[yo + 1:]
            for m in marks:
                w = w[:m] + '+' + w[m:]
            return w
        if yo != -1:
            raw = raw[:yo] + ('ё' if raw[yo].islower() else 'Ё') + raw[yo + 1:]
        return raw[:st] + '+' + raw[st:]

    @staticmethod
    def _word(res, start, span, src, info):
        plain = res.replace('+', '').rstrip('-')
        low = res.lower()
        stress = None
        if '+' in low:
            i = low.index('+')
            stress = sum(c in VOWELS for c in low[:i].replace('+', ''))
        return dict(text=plain, start=start, span=span, stress=stress, yo='ё' in plain.lower(),
                    source=src, p=info.get('p'), variants=info.get('variants'), alt=info.get('alt'))

    def __call__(self, sentence):
        return self.analyze(sentence)[0]


if __name__ == '__main__':
    if len(sys.argv) >= 2 and sys.argv[1].endswith('.pt'):
        print(extract(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else DATA))
    else:
        S = SileroStress()
        for line in sys.argv[1:] or sys.stdin:
            print(S(line.rstrip('\n')))
