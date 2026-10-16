#!/usr/bin/env python3
"""Выбор дубля фразы по ударениям: какой из вариантов озвучки звучит с правильными ударениями.

    python3 qa/pick_take.py --text "Массовая истерия от голода и страха?" дубль1.wav дубль2.wav ...

Для каждого дубля: число слов с подозрительным ударением, самое сомнительное слово (вероятность, что ударение там,
где нужно) и разборчивость (насколько буквы текста слышны там, где их нашла проверка, от 0 до 1).
Лучший дубль — первый в списке.
"""
import argparse, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path[:0] = [os.path.join(HERE, 'stress'), HERE]


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--text', required=True)
    ap.add_argument('takes', nargs='+')
    a = ap.parse_args(argv)
    from check import check_stress, load_audio, stressed
    from check_clip import STRESS_WARN, read_script
    from meter import Meter
    from silero_np import SileroStress
    text, _ = read_script(a.text)
    M, S = Meter(), SileroStress()
    rows = []
    for path in a.takes:
        r = check_stress(load_audio(path), text, M, S)
        res = r['results']
        worst = min(res, key=lambda z: z['p_ok']) if res else None
        al = [w['align'] for w in r['words'] if w.get('align') is not None]
        rows.append(dict(path=path, worst=worst, flags=sum(z['p_ok'] < STRESS_WARN for z in res),
                         fit=sum(al) / len(al) if al else 0.0))
    rows.sort(key=lambda r: (r['flags'], -(r['worst']['p_ok'] if r['worst'] else 1), -r['fit']))
    for i, r in enumerate(rows):
        w = r['worst']
        desc = (f"самое сомнительное «{w['word']}» {w['p_ok']:.0%} (слышно {stressed(w['norm'], w['heard'])})"
                if w else 'многосложных слов нет')
        print(f"{'→' if i == 0 else ' '} {os.path.basename(r['path'])}: подозрительных слов {r['flags']}, {desc}, "
              f"разборчивость {r['fit']:.2f}")
    return 0


if __name__ == '__main__':
    sys.exit(main())
