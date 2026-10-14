# Table of all takes per line with the selection flags, plus timbre similarity to the narrator reference.
# usage: python3 pick.py <lines.json> <takes dir> [ids]
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import vt  # noqa: E402
import aud  # noqa: E402

CFG = json.load(open(sys.argv[1]))
D = sys.argv[2]
ids = sys.argv[3].split(',') if len(sys.argv) > 3 else list(CFG['lines'])
REF = os.path.join(os.path.dirname(os.path.abspath(sys.argv[1])), CFG['voices_dir'], CFG['voices']['N'])
res = json.load(open(os.path.join(D, 'lines.json')))
cache_p = os.path.join(D, 'timbre_cache.json')
cache = json.load(open(cache_p)) if os.path.exists(cache_p) else {}
for lid in ids:
    L = CFG['lines'][lid]
    refs = [L['text']] + L.get('alts', [])
    print(f"== {lid}: {L['text']}")
    for name, st in sorted(res.items()):
        if st.get('id') != lid:
            continue
        if name not in cache:
            cache[name] = round(aud.timbre_sim(os.path.join(D, name + '.wav'), REF), 3)
        cer = vt.cer_best(refs, st['asr'])
        flags = []
        if cer > 0:
            flags.append(f'CER{cer:.3f}')
        if st['gap'] > (0.75 if lid == 'L10' else 0.65):
            flags.append(f"gap{st['gap']}")
        if st.get('noise_floor', -99) > -40:
            flags.append(f"noise{st['noise_floor']}")
        if st.get('f0_range_st', 99) < 5:
            flags.append('monotone')
        if st.get('f0', 120) > 145 or st.get('f0', 120) < 90:
            flags.append(f"f0={st.get('f0')}")
        if st.get('tail_after_words', 0) > 0.5:
            flags.append(f"tail{st['tail_after_words']}")
        if st.get('clip') or st.get('clicks'):
            flags.append(f"clip{st.get('clip')}/clicks{st.get('clicks')}")
        print(f"  {name:22s} sp {st['speech']:5.2f} syl/s {st.get('syl_per_s', 0):4.2f} f0 {st.get('f0')} "
              f"({st.get('f0lo')}-{st.get('f0hi')}) rng {st.get('f0_range_st')} gap {st['gap']:.2f} "
              f"noise {st.get('noise_floor')} tsim {cache[name]:.3f} timb {st.get('timbre_halves')} "
              f"{'OK' if not flags else ' '.join(flags)} | {st['asr']}")
json.dump(cache, open(cache_p, 'w'), indent=1)
