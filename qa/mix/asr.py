# Does the voice say the script: Whisper on the finished clip, then a word-by-word comparison with the script.
# Numbers match either way round ("1518" heard, "тысяча пятьсот восемнадцатом" written).
import difflib, os, re
import numpy as np

CACHE = os.environ.get('QA_CACHE', os.path.expanduser('~/.cache/qa'))
MODEL = os.environ.get('QA_WHISPER', os.path.join(CACHE, 'whisper-turbo'))
_CARD = re.compile(
    r'^(ноль|нуль|один|одна|одно|одного|одной|одному|одним|два|две|двух|двум|двумя|три|тр[её]х|тр[её]м|тремя|четыре|'
    r'четыр[её]х|четыр[её]м|четырьмя|пять|пяти|пятью|шесть|шести|шестью|семь|семи|семью|восемь|восьми|восемью|девять|'
    r'девяти|девятью|десять|десяти|десятью|(одинн|двен|трин|четырн|пятн|шестн|семн|восемн|девятн)адцат(ь|и|ью)|'
    r'двадцат(ь|и|ью)|тридцат(ь|и|ью)|сорок|сорока|пятьдесят|пятидесяти|шестьдесят|шестидесяти|семьдесят|семидесяти|'
    r'восемьдесят|восьмидесяти|девяносто|девяноста|сто|ста|двести|двухсот|триста|тр[её]хсот|четыреста|четыр[её]хсот|'
    r'пятьсот|пятисот|шестьсот|шестисот|семьсот|семисот|восемьсот|восьмисот|девятьсот|девятисот|тысяч[аиуеы]?|тысячами|'
    r'тысячам|миллион\w*|миллиард\w*)$')
_ORD = re.compile(
    r'^(перв|втор|трет|четв[её]рт|пят|шест|седьм|восьм|девят|десят|(одинн|двен|трин|четырн|пятн|шестн|семн|восемн|девятн)'
    r'адцат|двадцат|тридцат|сороков|пятидесят|шестидесят|семидесят|восьмидесят|девяност|сот|двухсот|тр[её]хсот|'
    r'четыр[её]хсот|пятисот|шестисот|семисот|восьмисот|девятисот|тысячн|миллионн)'
    r'(ый|ой|ая|ое|ые|ого|ому|ым|ом|ую|ых|ыми|ий|ья|ье|ьи|ьего|ьему|ьим|ьем|ью|ьих|ьими)$')


def norm(w):
    return re.sub(r'[^а-яa-z0-9]', '', w.lower().replace('ё', 'е'))


def is_num(w):
    return bool(re.fullmatch(r'[0-9]+([.,:][0-9]+)*(-?[а-я]{1,3})?', w) or _CARD.match(w) or _ORD.match(w))


GAP = 2.0   # s without a word that gets a second, separate decode


def _decode(m, x, at=0.0, strict=False):
    segs, _ = m.transcribe(np.asarray(x, np.float32), language='ru', word_timestamps=True, beam_size=5,
                           vad_filter=False, condition_on_previous_text=False)
    out = []
    for s in segs:
        if _HALLU.search(s.text) or (strict and (s.no_speech_prob > 0.5 or s.avg_logprob < -1.0)):
            continue
        out += [(w.word.strip(), at + float(w.start), at + float(w.end), float(w.probability)) for w in s.words]
    return out


_LOADED = {}


def transcribe(x16, model_dir=MODEL, threads=None):
    """16 kHz mono -> [(word, start, end, prob)] from faster-whisper."""
    from faster_whisper import WhisperModel
    key = (model_dir, int(threads or os.environ.get('QA_THREADS', '4')))
    if key not in _LOADED:
        try:
            _LOADED[key] = WhisperModel(model_dir, device='cpu', compute_type='int8', cpu_threads=key[1])
        except RuntimeError as e:
            raise RuntimeError(f'Whisper in {model_dir} does not load ({e}): bash qa/setup.sh adds the missing files') from e
    m = _LOADED[key]
    words = _decode(m, x16)
    # long-form decoding can jump over a quiet passage inside its 30 s window (a voice muffled behind a door):
    # every long stretch without words is decoded once more on its own
    sr, edge, gaps = 16000, 0.0, []
    for w in words + [('', len(x16) / sr, 0.0, 0.0)]:
        if w[1] - edge >= GAP:
            gaps.append((edge, w[1]))
        edge = max(edge, w[2])
    for a, b in gaps:
        words += _decode(m, x16[int(a * sr):int(b * sr)], a, strict=True)
    return sorted(words, key=lambda w: w[1])


def _groups(tokens):
    """Collapse runs of number words into one token; returns [(normalized, [indices])]."""
    out = []
    for i, t in enumerate(tokens):
        n = norm(t)
        if not n:
            continue
        if is_num(n):
            if out and out[-1][0] == '#':
                out[-1][1].append(i)
                continue
            out.append(('#', [i]))
        else:
            out.append((n, [i]))
    return out


# what Whisper writes over music or silence when nobody speaks (learned from subtitle credits of Russian videos)
_HALLU = re.compile(r'субтитр|dimatorzok|синецкая|кулакова|егорова|продолжение следует|спасибо за просмотр|'
                    r'подписывайтесь', re.I)


def noise(op):
    """Differences not worth a line: a one-letter preposition (к, в, с) merged into the next word, a stock
    hallucination."""
    s, h = norm(op.get('script') or ''), norm(op.get('heard') or '')
    if op['op'] == 'extra':
        return len(h) <= 1 or bool(_HALLU.search(op['heard'] or ''))
    if op['op'] == 'missing':
        return not re.search('[аеиоуыэюя]', s)
    return len(s) <= 1 and len(h) <= 1


def compare(script_tokens, heard):
    """script_tokens: words of the script in order; heard: transcribe() output.
    Returns [{op: missing|extra|changed, script, heard, si (script index), t}]."""
    S = _groups(script_tokens)
    H = _groups([h[0] for h in heard])
    n, m = len(S), len(H)
    sim = lambda a, b: 1.0 if a == b else difflib.SequenceMatcher(None, a, b).ratio()
    D = np.zeros((n + 1, m + 1))
    D[:, 0] = np.arange(n + 1)
    D[0, :] = np.arange(m + 1)
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            c = 0.0 if S[i - 1][0] == H[j - 1][0] else (1.0 - 0.6 * sim(S[i - 1][0], H[j - 1][0]))
            D[i, j] = min(D[i - 1, j - 1] + c, D[i - 1, j] + 1, D[i, j - 1] + 1)
    ops, i, j = [], n, m
    while i > 0 or j > 0:
        if i > 0 and j > 0:
            c = 0.0 if S[i - 1][0] == H[j - 1][0] else (1.0 - 0.6 * sim(S[i - 1][0], H[j - 1][0]))
            if abs(D[i, j] - (D[i - 1, j - 1] + c)) < 1e-9:
                if c > 0 and sim(S[i - 1][0], H[j - 1][0]) < 0.75:
                    hj = H[j - 1][1]
                    ops.append(dict(op='changed', script=' '.join(script_tokens[k] for k in S[i - 1][1]),
                                    heard=' '.join(heard[k][0] for k in hj), si=S[i - 1][1][0], t=heard[hj[0]][1]))
                i, j = i - 1, j - 1
                continue
        if i > 0 and (j == 0 or abs(D[i, j] - (D[i - 1, j] + 1)) < 1e-9):
            ops.append(dict(op='missing', script=' '.join(script_tokens[k] for k in S[i - 1][1]), heard=None,
                            si=S[i - 1][1][0], t=None))
            i -= 1
        else:
            hj = H[j - 1][1]
            ops.append(dict(op='extra', script=None, heard=' '.join(heard[k][0] for k in hj), si=None, t=heard[hj[0]][1]))
            j -= 1
    return ops[::-1]
