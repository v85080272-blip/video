# Casting takes like shorts/voxcpm2/tools/cast.py (description in parentheses before the text, same take names
# <key>_s<seed>.wav and result fields in <out>/cast.json), but resumable (existing takes are kept), with server
# retries, the memory guard for whisper, CER with digit spellings and the extra metrics of vt.extra_metrics.
# usage: python3 cast_takes.py <cast.json> <out dir> [seeds 1,2,3] [keys R1,R2] [alt spelling ...]
import json, os, sys, time
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import vt  # noqa: E402
import aud, gen  # noqa: E402

CFG, OUT = json.load(open(sys.argv[1])), sys.argv[2]
seeds = [int(s) for s in (sys.argv[3] if len(sys.argv) > 3 else '1,2,3').split(',')]
jobs = [(who, key, desc) for who, c in CFG.items() for key, desc in c['voices'].items()]
if len(sys.argv) > 4 and sys.argv[4]:
    jobs = [j for j in jobs if j[1] in sys.argv[4].split(',')]
alts = sys.argv[5:]
os.makedirs(OUT, exist_ok=True)
while not gen.ready():
    time.sleep(2)
jp = os.path.join(OUT, 'cast.json')
for who, key, desc in jobs:
    text = CFG[who]['text']
    for sd in seeds:
        name = f'{key}_s{sd}'
        res = json.load(open(jp)) if os.path.exists(jp) else {}
        out = os.path.join(OUT, name + '.wav')
        if name in res and os.path.exists(out):
            continue
        el = vt.tts(gen, f'({desc}){text}', out, seed=sd)
        st = vt.extra_metrics(out, text)
        tx, toks = vt.whisper(out)
        st.update(who=who, desc=desc, seed=sd, gen=round(el, 1), rtf=round(el / st['dur'], 2), asr=tx,
                  cer=round(vt.cer_best([text] + alts, tx), 3), cer_plain=round(aud.cer(text, tx), 3))
        res = json.load(open(jp)) if os.path.exists(jp) else {}
        res[name] = st
        json.dump(res, open(jp, 'w'), ensure_ascii=False, indent=1, default=float)
        print(name, {k: st.get(k) for k in ('speech', 'f0', 'f0lo', 'f0hi', 'f0_range_st', 'syl_per_s', 'gap', 'noise_floor',
                                            'hiss', 'tail_ms', 'timbre_halves', 'rtf', 'cer')}, '|', tx, flush=True)
