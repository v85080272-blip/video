# manifest.json for the exported lines (after shorts/voxcpm2/tools/export.py): per line text, duration, seed,
# CER, whisper transcript and word timestamps measured on the exported file itself
# ("words": whisper's words; "script_words": the script's words with times, digits spread over the spelled-out words).
# usage: python3 manifest.py <lines.json> <takes dir> <exported dir> [ids L1,L2]  (updates <exported dir>/manifest.json)
import difflib, json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import vt  # noqa: E402
import aud  # noqa: E402

LJ, TAKES, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
CFG = json.load(open(LJ))
ids = sys.argv[4].split(',') if len(sys.argv) > 4 and sys.argv[4] else list(CFG['chosen'])
mp = os.path.join(OUT, 'manifest.json')
man = json.load(open(mp)) if os.path.exists(mp) else {}
tres = json.load(open(os.path.join(TAKES, 'lines.json')))


def script_words(text, words):
    """Times for the script's own words: 1:1 where normalized words match, else spread a block's time span
    over the script words in proportion to their letter counts."""
    disp = text.split()
    toks = []                                   # (display, norm) ; dashes glue to the previous word
    for d in disp:
        n = aud.norm_text(d)
        if not n and toks:
            toks[-1] = (toks[-1][0] + ' ' + d, toks[-1][1])
        elif n:
            toks.append((d, n))
    wn = [aud.norm_text(w['word']) for w in words]
    sm = difflib.SequenceMatcher(a=[t[1] for t in toks], b=wn, autojunk=False)
    out = [None] * len(toks)
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == 'equal':
            for k in range(i2 - i1):
                w = words[j1 + k]
                out[i1 + k] = dict(word=toks[i1 + k][0], start=w['start'], end=w['end'], matched=True)
        elif i2 > i1:
            if j2 > j1:
                s, e = words[j1]['start'], words[j2 - 1]['end']
            else:                                # whisper dropped these words: squeeze between neighbours
                s = words[j1 - 1]['end'] if j1 > 0 else 0.0
                e = words[j1]['start'] if j1 < len(words) else s + 0.3
            lens = [max(1, len(toks[i][1].replace(' ', ''))) for i in range(i1, i2)]
            tot, acc = sum(lens), 0
            for k, i in enumerate(range(i1, i2)):
                a = s + (e - s) * acc / tot
                acc += lens[k]
                b = s + (e - s) * acc / tot
                out[i] = dict(word=toks[i][0], start=round(a, 3), end=round(b, 3), matched=False)
    return out


for lid in ids:
    L = CFG['lines'][lid]
    take = CFG['chosen'][lid]
    path = os.path.join(OUT, f'{lid}.wav')
    x, sr = aud.read_wav(path)
    tx, toks = vt.whisper(path)
    words = vt.refine_words(vt.words_from_tokens(toks), x, sr)
    refs = [L['text']] + L.get('alts', [])
    t = tres.get(take, {})
    man[lid] = dict(
        text=L['text'], emotion=L.get('emotion'), file=f'{lid}.wav', duration_s=round(len(x) / sr, 3),
        take=take, seed=t.get('seed'), cfg=t.get('cfg'), tts_input=t.get('tts'),
        cer=round(vt.cer_best(refs, tx), 3), cer_take=t.get('cer'), whisper=tx,
        words=words, script_words=script_words(L['text'], words))
    if L.get('note'):
        man[lid]['note'] = L['note']
    print(lid, man[lid]['duration_s'], 's  cer', man[lid]['cer'], '|', tx, flush=True)
    json.dump(dict(sorted(man.items(), key=lambda kv: int(re.sub(r'\D', '', kv[0]) or 0))),
              open(mp, 'w'), ensure_ascii=False, indent=1, default=float)
