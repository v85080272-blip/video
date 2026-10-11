# Takes for every line: clone the character's voice from voices/ + the line's emotion in parentheses,
# then score each take: Whisper CER (wrong or swallowed words), length vs the gap before the next beat, pitch.
# usage: python3 lines.py <lines.json> <out dir> [seeds 1,2,3,4] [ids s1,p1] [cfg 2.0]
import json, os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import aud, gen

LJ, OUT = sys.argv[1], sys.argv[2]
CFG = json.load(open(LJ))
VOICES = os.path.join(os.path.dirname(os.path.abspath(LJ)), CFG['voices_dir'])
seeds = [int(s) for s in (sys.argv[3] if len(sys.argv) > 3 else '1,2,3,4').split(',')]
ids = sys.argv[4].split(',') if len(sys.argv) > 4 and sys.argv[4] else list(CFG['lines'])
cfg = float(sys.argv[5]) if len(sys.argv) > 5 else 2.0
os.makedirs(OUT, exist_ok=True)
while not gen.ready():
    time.sleep(2)
jp = os.path.join(OUT, 'lines.json')
res = json.load(open(jp)) if os.path.exists(jp) else {}
for lid in ids:
    L = CFG['lines'][lid]
    ref = os.path.join(VOICES, CFG['voices'][L['who']])
    for sd in seeds:
        name = f'{lid}_c{cfg:g}_s{sd}'
        out = os.path.join(OUT, name + '.wav')
        el = gen.tts(f"({L['emotion']}){L['text']}", out, seed=sd, ref=ref, cfg=cfg)
        st = aud.stats(out)
        tx = aud.asr(out)
        st.update(id=lid, who=L['who'], seed=sd, cfg=cfg, gen=round(el, 1), rtf=round(el / st['dur'], 2),
                  asr=tx, cer=round(aud.cer(L['text'], tx), 3), fits=bool(st['speech'] <= L['max']), max=L['max'])
        res[name] = st
        json.dump(res, open(jp, 'w'), ensure_ascii=False, indent=1, default=float)
        print(name, {k: st.get(k) for k in ('speech', 'max', 'f0', 'f0lo', 'f0hi', 'rms', 'gap', 'rtf', 'cer')}, '|', tx, flush=True)
