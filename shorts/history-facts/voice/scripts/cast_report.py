# Score casting takes made by shorts/voxcpm2/tools/cast.py: CER with digit spellings allowed,
# pitch movement, noise floor, hiss, reverb tail, timbre steadiness, pace.
# usage: python3 cast_report.py <cast dir> <cast config json> [alt reference ...]
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import vt  # noqa: E402

D = sys.argv[1]
res = json.load(open(os.path.join(D, 'cast.json')))
CAST = json.load(open(sys.argv[2]))
alts = sys.argv[3:]
rows = []
for name, st in res.items():
    p = os.path.join(D, name + '.wav')
    text = CAST[st['who']]['text']
    m = vt.extra_metrics(p, text)
    cer = vt.cer_best([text] + alts, st['asr'])
    rows.append((name, st, m, cer))
out = {}
for name, st, m, cer in sorted(rows, key=lambda r: r[0]):
    out[name] = dict(m, cer2=cer, asr=st['asr'], desc=st['desc'], seed=st['seed'], gen=st['gen'])
    print(f"{name:7s} speech {m['speech']:.2f} lead {m['lead']:.2f} f0 {m.get('f0')} ({m.get('f0lo')}-{m.get('f0hi')}) "
          f"range {m.get('f0_range_st')}st std {m.get('f0_std_st')} jumps {m.get('f0_jumps')} gap {m['gap']} "
          f"noise {m['noise_floor']} hiss {m['hiss']} tail {m.get('tail_ms')}ms timbre {m['timbre_halves']} "
          f"pace {m.get('syl_per_s')} cer {st['cer']}/{cer:.3f} gen {st['gen']}s | {st['asr']}")
json.dump(out, open(os.path.join(D, 'cast_report.json'), 'w'), ensure_ascii=False, indent=1, default=float)
