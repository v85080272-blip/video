# Takes for narrator lines, like shorts/voxcpm2/tools/lines.py (same take names <id>_c<cfg>_s<seed>.wav and
# result fields), plus: a "tts" text override for respelling tricks (variant tag in the take name),
# CER against alternative spellings ("alts", e.g. digits), one whisper pass with DTW word times,
# extra metrics (vt.extra_metrics) and syllable nuclei of the words listed in "stress".
# usage: python3 takes.py <lines.json> <out dir> [seeds 1,2,3] [ids L1,L2] [cfg 2.0] [variant]
import json, os, re, sys, time
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import vt  # noqa: E402  (sets VOX_HOME, imports aud)
import aud, gen  # noqa: E402

LJ, OUT = sys.argv[1], sys.argv[2]
CFG = json.load(open(LJ))
VOICES = os.path.join(os.path.dirname(os.path.abspath(LJ)), CFG['voices_dir'])
seeds = [int(s) for s in (sys.argv[3] if len(sys.argv) > 3 else '1,2,3').split(',')]
ids = sys.argv[4].split(',') if len(sys.argv) > 4 and sys.argv[4] else list(CFG['lines'])
cfg = float(sys.argv[5]) if len(sys.argv) > 5 and sys.argv[5] else 2.0
variant = sys.argv[6] if len(sys.argv) > 6 else ''
os.makedirs(OUT, exist_ok=True)
while not gen.ready():
    time.sleep(2)
jp = os.path.join(OUT, 'lines.json')


def find_word(words, target):
    t = aud.norm_text(target)
    best = None
    for i, w in enumerate(words):
        n = aud.norm_text(w['word'])
        if not n:
            continue
        d = aud.cer(t, n)
        if best is None or d < best[0]:
            best = (d, i)
    return best


for lid in ids:
    L = dict(CFG['lines'][lid])
    if variant:
        L.update(L.get('variants', {}).get(variant, {}))
    ref = os.path.join(VOICES, CFG['voices'][L['who']])
    say = L.get('tts', L['text'])
    for sd in seeds:
        name = f"{lid}{('_' + variant) if variant else ''}_c{cfg:g}_s{sd}"
        out = os.path.join(OUT, name + '.wav')
        prompt = f"({L['emotion']}){say}" if L.get('emotion') else say
        el = vt.tts(gen, prompt, out, seed=sd, ref=ref, cfg=cfg)
        st = vt.extra_metrics(out, L['text'])
        tx, toks = vt.whisper(out)
        x, sr = aud.read_wav(out)
        words = vt.refine_words(vt.words_from_tokens(toks), x, sr)
        refs = [L['text']] + L.get('alts', [])
        st.update(id=lid, who=L['who'], seed=sd, cfg=cfg, variant=variant, tts=prompt, gen=round(el, 1),
                  rtf=round(el / st['dur'], 2), asr=tx, cer=round(vt.cer_best(refs, tx), 3),
                  cer_plain=round(aud.cer(L['text'], tx), 3), fits=bool(st['speech'] <= L['max']), max=L['max'],
                  words=words)
        if words:
            st['tail_after_words'] = round(st['lead'] + st['speech'] - words[-1]['end'], 2)
        sy = {}
        for tw in L.get('stress', []):
            fw = find_word(words, tw['word'])
            if fw and fw[0] <= 0.34:
                w = words[fw[1]]
                sy[tw['word']] = dict(heard=w['word'], start=w['start'], end=w['end'],
                                      syl=vt.syllables(out, w['start'], w['end'], tw['nvow']))
            else:
                sy[tw['word']] = dict(heard=None)
        if sy:
            st['stress'] = sy
        res = json.load(open(jp)) if os.path.exists(jp) else {}
        res[name] = st
        json.dump(res, open(jp, 'w'), ensure_ascii=False, indent=1, default=float)
        brief = {k: st.get(k) for k in ('speech', 'max', 'f0', 'f0_range_st', 'syl_per_s', 'gap', 'noise_floor', 'tail_ms',
                                        'timbre_halves', 'rtf', 'cer')}
        print(name, brief, '|', tx, flush=True)
        for k, v in sy.items():
            print('   stress', k, v.get('heard'), v.get('syl'), flush=True)
