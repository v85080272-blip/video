# Casting: voice-design takes per character (description in parentheses before the text),
# each checked by Whisper (CER) and pitch, so a voice can be picked without listening to all of them.
# usage: python3 cast.py <cast.json> <out dir> [seeds 1,2,3] [keys S1,P2]
import json, os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import aud, gen

CFG, OUT = json.load(open(sys.argv[1])), sys.argv[2]
seeds = [int(s) for s in (sys.argv[3] if len(sys.argv) > 3 else '1,2,3').split(',')]
os.makedirs(OUT, exist_ok=True)
jobs = [(who, key, desc) for who, c in CFG.items() for key, desc in c['voices'].items()]
if len(sys.argv) > 4:
    jobs = [j for j in jobs if j[1] in sys.argv[4].split(',')]
while not gen.ready():
    time.sleep(2)
jp = os.path.join(OUT, 'cast.json')
res = json.load(open(jp)) if os.path.exists(jp) else {}
for who, key, desc in jobs:
    text = CFG[who]['text']
    for sd in seeds:
        name = f'{key}_s{sd}'
        out = os.path.join(OUT, name + '.wav')
        el = gen.tts(f'({desc}){text}', out, seed=sd)
        st = aud.stats(out)
        tx = aud.asr(out)
        st.update(who=who, desc=desc, seed=sd, gen=round(el, 1), rtf=round(el / st['dur'], 2), asr=tx, cer=round(aud.cer(text, tx), 3))
        res[name] = st
        json.dump(res, open(jp, 'w'), ensure_ascii=False, indent=1, default=float)
        print(name, {k: st.get(k) for k in ('speech', 'f0', 'f0lo', 'f0hi', 'rms', 'gap', 'rtf', 'cer')}, '|', tx, flush=True)
