# Stress check of a finished voice track: the script tells which vowel of each word should be stressed (the author's
# '+' marks, else the orthoepic list, Silero's dictionary and its homograph model); meter.py aligns the script to the
# audio and hears which vowel of every word of two or more syllables is stressed.
import re, subprocess
import numpy as np

from meter import Meter, SR, CONF_MIN, vowel_pos
from silero_np import SileroStress, VOWELS
from lexicon import TRAP, DOUBLE

WILD = '*'
_TOKEN = re.compile(r"[А-Яа-яЁё+]+(?:-[А-Яа-яЁё+]+)*|[0-9]+(?:[.,:][0-9]+)*|[A-Za-z]+")
_PAUSE = re.compile(r'[.,!?;:…—–()«»"]')
HOMO_SURE = 0.97     # a homograph reading the BERT model is surer of than this counts as the only right one


def _sentence_start(before):
    b = re.sub(r'[\s"«»„“()\[\]—–-]+$', '', before)
    return not b or b[-1] in '.!?…'


def load_audio(path, sr=SR, start=None, end=None):
    """Any audio/video file -> mono float32 at sr (ffmpeg)."""
    cmd = ['ffmpeg', '-v', 'error', '-nostdin']
    if start is not None:
        cmd += ['-ss', str(start)]
    if end is not None:
        cmd += ['-to', str(end)]
    cmd += ['-i', path, '-vn', '-ac', '1', '-ar', str(sr), '-f', 'f32le', '-']
    raw = subprocess.run(cmd, check=True, capture_output=True).stdout
    return np.frombuffer(raw, np.float32).copy()


def _stress_of(marked):
    """'отр+езала' -> 1"""
    i = marked.index('+')
    return sum(c.lower() in VOWELS for c in marked[:i])


def script_words(text, silero):
    """Script -> list of words in reading order: {text, norm, stress, source, p, variants, ok, name, final, start}.
    Hyphenated words are split (кто-то -> кто, то); digits and Latin become wildcards. `ok` holds every stress
    that is not a mistake (both readings of a homograph, both accepted stresses of a doublet)."""
    _, sw = silero.analyze(text)
    cover = {}                                   # char position -> Silero's word that covers it
    for w in sw:
        for i in range(w['start'], w['end']):
            cover[i] = w
    out = []
    for m in _TOKEN.finditer(text):
        tok, pos = m.group(), m.start()
        nxt = text[m.end():m.end() + 3]
        final = bool(_PAUSE.search(nxt[:2])) or m.end() >= len(text.rstrip())
        if not re.search('[А-Яа-яЁё]', tok):
            out.append(dict(text=tok, norm=WILD, stress=None, source='wild', ok=set(), final=final, start=pos))
            continue
        # a capital letter inside a sentence: a name, where the dictionary itself may be wrong
        name = tok.lstrip('+')[:1].isupper() and not _sentence_start(text[:pos])
        parts = tok.split('-')
        off = pos
        for k, part in enumerate(parts):
            at0 = off + len(part) - len(part.lstrip('+'))     # «+озера»: the word starts at its first letter
            w = cover.get(at0)
            norm = part.replace('+', '').lower()
            st, variants = None, None
            if '+' in part:                         # the author's own mark wins
                st, src = _stress_of(part), 'author'
            elif w is not None:
                st, src = w['stress'], w['source']
                if w.get('yo'):
                    norm = w['text'].lower().rstrip('-')
                # phrase rules (p None) are reliable; a BERT choice it is not sure of leaves both readings open
                if src == 'homograph' and w.get('variants') and isinstance(w.get('p'), list) \
                        and max(w['p']) < HOMO_SURE:
                    variants = w['variants']
            else:
                src = 'none'
            # the orthoepic list wins over Silero's guess (it has e.g. «свЕрлит», «завИдно»), but not in homographs
            key = norm.replace('ё', 'е')
            if src not in ('author', 'homograph') and key in TRAP and TRAP[key] != st:
                st, src = TRAP[key], 'trap'
            if st is None and len(vowel_positions(norm)) == 1:
                st = 0
            ok = {st} if st is not None else set()
            if src != 'author':
                ok |= DOUBLE.get(key, set())
                ok |= {_stress_of(v) for v in variants or [] if '+' in v}
            out.append(dict(text=part.replace('+', ''), norm=norm, stress=st, source=src, ok=ok,
                            p=w and w.get('p'), alt=w and w.get('alt'), variants=variants, name=name,
                            cap=part.lstrip('+')[:1].isupper(),
                            final=final and k == len(parts) - 1, start=at0))
            off += len(part) + 1
    return out


def vowel_positions(word):
    return [i for i, c in enumerate(word.lower()) if c in VOWELS]


def check_stress(x, text, meter=None, silero=None):
    """x: 16 kHz mono voice (or the whole mix); text: what is said. -> {words, results, spans, unclear}.
    results: one per word of two or more syllables that was heard clearly:
    {word, norm, expected, ok, heard, p_expected, p_ok, p, t, end, align, source, name, homograph, doublet}."""
    meter = meter or Meter()
    silero = silero or SileroStress()
    W = script_words(text, silero)
    keep = [i for i, ch in enumerate(text) if ch not in '+́']      # plain text index -> script index
    R = meter.judge(x, text)
    res, spans, unclear = [], [], []
    for r in R:
        if r['start'] is not None:
            spans.append((r['start'], r['end']))
        a, b = keep[r['cs']], keep[r['ce'] - 1] + 1
        parts = [w for w in W if a <= w['start'] < b and w['norm'] != WILD]
        for w in parts:
            w['t'], w['align'] = r['start'], r['align']
        if r['align'] is not None and r['align'] < CONF_MIN and vowel_pos(r['word']):
            unclear.append(dict(word=r['word'], t=r['start'], align=r['align']))
        p = r['vowel_scores']
        if not p or len(p) < 2 or not parts:
            continue
        exp, ok, off = [], set(), 0
        for w in parts:
            if w['stress'] is not None:
                exp.append(off + w['stress'])
            ok |= {off + s for s in w['ok']}
            off += len(vowel_positions(w['norm']))
        if not exp or off != len(p):
            continue
        k = W.index(parts[0])
        a0, b0 = W[max(0, k - 5)], W[min(len(W) - 1, k + 5)]
        ctx = ' '.join(text[a0['start']:b0['start'] + len(b0['text'])].split())
        res.append(dict(word=r['word'], context=ctx, norm=''.join(w['norm'] + '-' for w in parts)[:-1], expected=exp,
                        ok=sorted(ok), heard=r['best'], p_expected=float(sum(p[i] for i in exp)),
                        p_ok=float(sum(p[i] for i in ok)), p=p, t=r['start'], end=r['end'], align=r['align'],
                        source='+'.join(sorted({w['source'] for w in parts})), name=any(w['name'] for w in parts),
                        cap=any(w['cap'] for w in parts),
                        homograph=any(w['variants'] for w in parts),
                        doublet=any(len(w['ok']) > 1 and not w['variants'] for w in parts)))
    return dict(words=W, results=res, spans=spans, unclear=unclear)


def stressed(word, vi):
    """'истерия', 2 -> 'истерИя' (the stressed vowel in capitals, as the report shows it). ё is always stressed,
    so a ё the stress has left reads е: 'озёра', 0 -> 'Озера'."""
    pos = vowel_positions(word)
    at = {pos[v] for v in (vi if isinstance(vi, (list, tuple, set)) else [vi]) if v is not None and v < len(pos)}
    if not at:
        return word
    return ''.join(c.upper() if k in at else {'ё': 'е', 'Ё': 'Е'}.get(c, c) for k, c in enumerate(word))
