#!/usr/bin/env python3
"""Выбор дубля по ударениям: какой вариант озвучки фразы или всего сценария звучит без ошибок.

    python3 qa/pick_take.py --text "Массовая истерия от голода и страха?" дубль1.wav дубль2.wav ...
    python3 qa/pick_take.py --text сценарий.json --asr --out выбор.md дубль1.wav дубль2.wav ...
    python3 qa/pick_take.py --text "Внизу — они." --bed музыка.wav --bed-db -12 дубль1.wav дубль2.wav ...

Для каждого дубля: слова, где ударение, похоже, не там (время, как нужно и как слышно), с --asr ещё слова,
которых Whisper не слышит, и разборчивость (насколько буквы текста слышны там, где их нашла проверка, от 0 до 1).
--bed проверяет каждый дубль ещё и с музыкой ролика под ним (на --bed-db дБ тише голоса): слабо ударенное слово,
верное в чистом дубле, после сведения может зазвучать неверно. Лучший дубль — первый в списке. --out пишет тот же
список в файл .md.
"""
import argparse, datetime, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path[:0] = [os.path.join(HERE, 'stress'), os.path.join(HERE, 'mix'), HERE]


def at(t):
    return '—' if t is None else f'{t:.1f} с'.replace('.', ',')


def under_bed(x, bed, rel_db):
    """The take with the bed (music of the clip) looped under it, rel_db below the voice's active level."""
    import numpy as np
    b = np.resize(bed, len(x))
    v = x[np.abs(x) > 0.01 * np.abs(x).max()]
    g = 10 ** (rel_db / 20) * np.sqrt(np.mean(v ** 2)) / (np.sqrt(np.mean(b ** 2)) + 1e-9)
    return (x + g * b).astype(np.float32)


def judge(path, text, M, S, use_asr, bed=None, bed_db=-12.0):
    from check import check_stress, load_audio, stressed
    from check_clip import STRESS_ERR, STRESS_WARN
    from meter import CONF_MIN
    x = load_audio(path)
    r = check_stress(x, text, M, S)
    if bed is not None:
        # a take whose stress only holds without music flips once mixed: judge it by the worse of the two
        rb = check_stress(under_bed(x, bed, bed_db), text, M, S)['results']
        if [z['word'] for z in rb] == [z['word'] for z in r['results']]:
            for z, zb in zip(r['results'], rb):
                if zb['p_ok'] < z['p_ok']:
                    z.update(p_ok=zb['p_ok'], heard=zb['heard'], bed=z['p_ok'] >= STRESS_WARN)
    found, errs, doubts = [], 0, 0
    for z in r['results']:
        if z['p_ok'] >= STRESS_WARN:
            continue
        err = z['p_ok'] < STRESS_ERR and not z['name']
        errs, doubts = errs + err, doubts + (not err)
        exp, hrd = stressed(z['norm'], z['expected']), stressed(z['norm'], z['heard'])
        note = ' (имя или название, словарь мог ошибиться)' if z['name'] else ''
        note += ' (под музыкой, без неё верно)' if z.get('bed') else ''
        found.append((z['t'], f"{'❌' if err else '⚠️'} {at(z['t'])} «{z['word']}»: нужно {exp}, "
                              f"{'слышно' if err else 'похоже на'} {hrd}{note}"))
    if not use_asr:
        # a take that skips or garbles words is not a better take: words the letter model cannot find count too
        for u in r['unclear']:
            gone = u['align'] < 0.3
            errs, doubts = errs + gone, doubts + (not gone)
            found.append((u['t'], f"{'❌' if gone else '⚠️'} {at(u['t'])} «{u['word']}» "
                                  f"{'не слышно' if gone else 'звучит неразборчиво'}"))
    else:
        import asr as ASR
        W = r['words']
        for op in ASR.compare([w['text'] for w in W], ASR.transcribe(x)):
            if ASR.noise(op):
                continue
            if op['op'] == 'missing':
                w = W[op['si']]
                weak = w.get('align') is not None and w['align'] < CONF_MIN
                errs, doubts = errs + weak, doubts + (not weak)
                found.append((w.get('t'), f"{'❌' if weak else '⚠️'} {at(w.get('t'))} не слышно «{op['script']}»"))
            else:
                doubts += 1
                what = (f"лишнее «{op['heard']}»" if op['op'] == 'extra' else
                        f"в тексте «{op['script']}», слышно «{op['heard']}»")
                found.append((op['t'], f"⚠️ {at(op['t'])} {what}"))
    al = [w['align'] for w in r['words'] if w.get('align') is not None]
    return dict(name=os.path.basename(path), errs=errs, doubts=doubts, words=len(r['results']),
                worst=min((z['p_ok'] for z in r['results']), default=1.0), fit=sum(al) / len(al) if al else 0.0,
                found=[s for _, s in sorted(found, key=lambda f: -1 if f[0] is None else f[0])])


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--text', required=True)
    ap.add_argument('--asr', action='store_true', help='ещё и сверить с текстом через Whisper: пропущенные слова')
    ap.add_argument('--out', help='записать результат в этот .md')
    ap.add_argument('--bed', help='музыка ролика (или ролик без голоса): проверить дубли ещё и с ней под голосом')
    ap.add_argument('--bed-db', type=float, default=-12.0, help='насколько музыка тише голоса, дБ (по умолчанию -12)')
    ap.add_argument('takes', nargs='+')
    a = ap.parse_args(argv)
    from check import load_audio
    from check_clip import read_script
    from meter import Meter
    from silero_np import SileroStress
    text, src = read_script(a.text)
    M, S = Meter(), SileroStress()
    bed = load_audio(a.bed) if a.bed else None
    rows = [judge(p, text, M, S, a.asr, bed, a.bed_db) for p in a.takes]
    rows.sort(key=lambda r: (r['errs'], r['doubts'], -r['worst'], -r['fit']))
    out = []
    for i, r in enumerate(rows):
        out.append(f"{'→' if i == 0 else ' '} {r['name']}: ошибок {r['errs']}, сомнений {r['doubts']}, "
                   f"разборчивость {r['fit']:.2f} (слов из двух и более слогов: {r['words']})")
        out += ['    ' + s for s in r['found']]
    print('\n'.join(out))
    if a.out:
        md = [f'# Выбор дубля: {src}', '',
              f"Проверено {datetime.datetime.now(datetime.timezone.utc):%Y-%m-%d %H:%M} UTC"
              f"{', со сверкой Whisper' if a.asr else ''}"
              f"{f', ещё и с музыкой {os.path.basename(a.bed)} на {a.bed_db:g} дБ под голосом' if a.bed else ''}."
              f" Лучший дубль первый: меньше всего ошибок, потом сомнений.", '']
        for i, r in enumerate(rows):
            md.append(f"{i + 1}. **{r['name']}**: ошибок {r['errs']}, сомнений {r['doubts']}, "
                      f"разборчивость {r['fit']:.2f}")
            md += [f'   - {s}' for s in r['found']] or ['   - всё верно']
        open(a.out, 'w', encoding='utf-8').write('\n'.join(md) + '\n')
    return 0


if __name__ == '__main__':
    sys.exit(main())
