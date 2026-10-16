# How well the stress check hears stress: on a make_set.py set, the share of deliberately wrong stresses it catches
# and the share of correctly stressed words it would flag, per threshold of P(the dictionary vowel is stressed).
#   python3 eval_set.py set_dir [--out results.jsonl]     (resumes from --out if it exists)
import argparse, json, os, sys
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from check import load_audio
from meter import Meter


def run(d, out):
    M = Meter()
    done = set()
    if os.path.exists(out):
        done = {json.loads(l)['name'] for l in open(out) if l.strip()}
    with open(out, 'a') as f:
        for it in json.load(open(os.path.join(d, 'items.json'))):
            if it['name'] in done:
                continue
            x = load_audio(os.path.join(d, it['name'] + '.wav'))
            R = M.judge(x, ' '.join(w for w, _, _ in it['words']))
            rows = [dict(w=w, dict=ds, act=a, p=r['vowel_scores'], best=r['best'], align=r['align'])
                    for r, (w, ds, a) in zip(R, it['words'])]
            f.write(json.dumps(dict(name=it['name'], voice=it['voice'], rows=rows), ensure_ascii=False) + '\n')
            f.flush()


def stats(out):
    n = ok = 0
    wrong, right, dropped = [], [], [0, 0]
    for rec in map(json.loads, open(out)):
        for r in rec['rows']:
            p, d, a = r['p'], r['dict'], r['act']
            if d is None or a is None:
                continue
            if p is None:
                dropped[int(d != a)] += r['align'] is not None
                continue
            if len(p) < 2:
                continue
            n += 1
            ok += r['best'] == a
            (wrong if d != a else right).append(p[d])
    wrong, right = np.array(wrong), np.array(right)
    print(f'words of 2+ syllables: {n}, heard stress = spoken stress: {ok / n:.1%}')
    print(f'said wrong: {len(wrong)}, said right: {len(right)}; not judged (letters not heard): '
          f'{dropped[0]} right, {dropped[1]} wrong')
    for th in (0.01, 0.02, 0.05, 0.1, 0.2, 0.5):
        print(f'  threshold {th}: caught {np.mean(wrong < th):.1%}, false alarms {np.mean(right < th):.2%}')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('set_dir')
    ap.add_argument('--out', default='eval_results.jsonl')
    a = ap.parse_args()
    run(a.set_dir, a.out)
    stats(a.out)
