#!/usr/bin/env python3
"""Проверка готового ролика перед отправкой: ударения, текст и голос, сведение, паузы, музыка.

    python3 qa/check_clip.py ролик.mp4 --text сценарий.json [--engine qwen3] [--voice голос.wav] [--music]

--text   сценарий: .txt, .json (lines: [{text}], {id: {text}} или список строк) или сам текст в кавычках;
         без него проверяются только сведение и паузы, а ударения — по тому, что расслышал Whisper.
--voice  дорожка одного голоса, если есть (ударения меряются точнее, чем по миксу с музыкой).
--music  в ролике должна быть музыка (иначе её отсутствие только отмечается).
--dialog сцена с персонажами (мультик): паузы между репликами — часть действия, замечание только на паузу от 4 с.
         Включается само, если в сценарии .json у реплик разные «who»/«speaker».
--accept "причина"   принять найденные ошибки (например, проверили на слух): хук перестанет останавливать отправку.

Отчёт: /mnt/project-files/qa/reports/<имя>.md и .json (или рядом с роликом), код выхода 0 — ошибок нет, 1 — есть.
"""
import argparse, datetime, json, os, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path[:0] = [os.path.join(HERE, 'stress'), os.path.join(HERE, 'mix')]

STRESS_ERR, STRESS_WARN = 0.02, 0.2       # P(the stress is where it should be) below these
SHARED = '/mnt/project-files'


def report_dir():
    if os.path.isdir(SHARED):
        d = os.path.join(SHARED, 'qa', 'reports')
        os.makedirs(d, exist_ok=True)
        return d
    return None


def report_paths(clip):
    stem = os.path.splitext(os.path.basename(clip))[0]
    d = report_dir() or os.path.dirname(os.path.abspath(clip))
    return os.path.join(d, stem + '.json'), os.path.join(d, stem + '.md')


def file_id(path):
    st = os.stat(path)
    return dict(size=st.st_size, mtime=round(st.st_mtime, 3))


def read_script(arg):
    if arg is None:
        return None, None
    if not os.path.exists(arg):
        return arg, 'текст из командной строки'
    raw = open(arg, encoding='utf-8').read()
    if arg.endswith('.json'):
        d = json.loads(raw)
        lines = d.get('lines', d) if isinstance(d, dict) else d
        if isinstance(lines, dict):
            lines = list(lines.values())
        texts = [l if isinstance(l, str) else l.get('text', '') for l in lines]
        return ' '.join(t.strip() for t in texts if t.strip()), f'{os.path.basename(arg)} ({len(texts)} фраз)'
    return ' '.join(raw.split()), os.path.basename(arg)


def script_is_dialog(arg):
    """A .json script whose lines name two or more speakers."""
    if not arg or not arg.endswith('.json') or not os.path.exists(arg):
        return False
    try:
        d = json.load(open(arg, encoding='utf-8'))
    except ValueError:
        return False
    lines = d.get('lines', d) if isinstance(d, dict) else d
    if isinstance(lines, dict):
        lines = list(lines.values())
    who = {l.get('who') or l.get('speaker') or l.get('character') for l in lines if isinstance(l, dict)}
    return len(who - {None, ''}) >= 2


def fmt_t(t):
    return '—' if t is None else f'{t:.1f} с'.replace('.', ',')


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('clip')
    ap.add_argument('--text')
    ap.add_argument('--engine', default='any', choices=['qwen3', 'voxcpm2', 'rhvoice', 'silero', 'any'])
    ap.add_argument('--voice')
    ap.add_argument('--music', action='store_true')
    ap.add_argument('--dialog', action='store_true')
    ap.add_argument('--no-asr', action='store_true')
    ap.add_argument('--accept')
    ap.add_argument('--out')
    a = ap.parse_args(argv)
    clip = os.path.abspath(a.clip)
    jpath, mpath = report_paths(clip)
    if a.out:
        os.makedirs(a.out, exist_ok=True)
        stem = os.path.splitext(os.path.basename(clip))[0]
        jpath, mpath = os.path.join(a.out, stem + '.json'), os.path.join(a.out, stem + '.md')
    if a.accept:
        return accept(clip, jpath, mpath, a.accept)
    t0 = time.time()
    text, text_src = read_script(a.text)
    dialog = a.dialog or script_is_dialog(a.text)
    R = run_checks(clip, text, a.engine, a.voice, a.music, not a.no_asr, dialog)
    R.update(clip=clip, file=file_id(clip), text_source=text_src, engine=a.engine, dialog=dialog,
             checked_at=datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M UTC'),
             seconds=round(time.time() - t0, 1))
    finish(R, jpath, mpath)
    print(open(mpath, encoding='utf-8').read())
    print(f'Отчёт: {mpath}')
    return 1 if R['status'] == 'fail' else 0


def run_checks(clip, text, engine, voice, music, use_asr, dialog=False):
    from check import load_audio, check_stress, stressed
    from mixcheck import check_mix, ERR, WARN, INFO
    F = []
    add = lambda lvl, part, code, msg, t=None, **kw: F.append(dict(level=lvl, part=part, code=code, msg=msg, t=t, **kw))
    x16 = load_audio(voice or clip)
    R = dict(stress=[], asr=[], text=None, mix=None)
    heard = None
    if use_asr:
        try:
            import asr as ASR
            if os.path.isdir(ASR.MODEL):
                heard = ASR.transcribe(x16)
            else:
                R['asr_note'] = 'Whisper не установлен (qa/setup.sh), сверка голоса с текстом пропущена.'
        except ImportError:
            R['asr_note'] = 'faster-whisper не установлен (qa/setup.sh), сверка голоса с текстом пропущена.'
    if text is None and heard:
        text = ' '.join(h[0] for h in heard)
        R['text_from_asr'] = True
    spans = None
    if text:
        from meter import Meter, CONF_MIN
        from silero_np import SileroStress
        from textcheck import analyze_text
        S = SileroStress()
        T = analyze_text(text, S, engine=engine)
        # words the dictionary is unsure of were just checked by ear: keep only what the ear check cannot judge
        risky = [dict(r, reasons=[x for x in r['reasons'] if not x.startswith(('словарь не уверен', 'омограф'))])
                 for r in T['risky']]
        R['text'] = dict(risky=[r for r in risky if r['reasons']], traps=[t['display'] for t in T['traps']],
                         note=T['note'], tts_text=T['tts_text'])
        st = check_stress(x16, text, Meter(), S)
        spans = st['spans']
        for z in st['results']:
            exp, hrd = stressed(z['norm'], z['expected']), stressed(z['norm'], z['heard'])
            r = dict(word=z['word'], t=z['t'], end=z['end'], expected=exp, heard=hrd, p=round(z['p_ok'], 4),
                     source=z['source'], context=z['context'])
            sf = {k: r[k] for k in ('word', 'expected', 'heard', 'p', 'context', 'end')}
            if z['p_ok'] < STRESS_ERR and z['name']:
                add(WARN, 'stress', 'stress_name', f"«{z['word']}»: по словарю {exp}, голос говорит {hrd}. Это имя или "
                    f"название, словарь здесь мог ошибиться: если голос прав, поставьте «+» в сценарии.", r['t'], **sf)
            elif z['p_ok'] < STRESS_ERR:
                add(ERR, 'stress', 'stress', f"«{z['word']}»: нужно {exp}, слышно {hrd}." + (
                    " Если это имя или название и голос прав, поставьте «+» в сценарии."
                    if z['cap'] and len(z['word']) >= 5 and z['source'] in ('model', 'none') else ''), r['t'], **sf)
            elif z['p_ok'] < STRESS_WARN:
                add(WARN, 'stress', 'stress_maybe', f"«{z['word']}»: нужно {exp}, похоже на {hrd}, послушайте.",
                    r['t'], **sf)
            elif z['p_expected'] < STRESS_ERR and z['homograph']:
                add(WARN, 'stress', 'homograph', f"«{z['word']}»: голос прочитал {hrd}, а по смыслу словарь выбрал {exp}. "
                    f"Проверьте, какое слово тут нужно.", r['t'], **sf)
            R['stress'].append(r)
        R['stress_words'] = len(st['results'])
        if heard:
            W = st['words']
            ops = [op for op in ASR.compare([w['text'] for w in W], heard) if not ASR.noise(op)]
            for op in ops:
                t = op['t']
                if op['op'] == 'missing':
                    w = W[op['si']]
                    t = w.get('t')
                    weak = w.get('align') is not None and w['align'] < CONF_MIN
                    add(ERR if weak else WARN, 'asr', 'missing', f"Не слышно «{op['script']}»"
                        + (' (и по звуку его нет)' if weak else ' (Whisper не расслышал, послушайте)') + '.', t)
                elif op['op'] == 'extra':
                    add(WARN, 'asr', 'extra', f"Лишнее «{op['heard']}», которого нет в тексте.", t)
                else:
                    add(WARN, 'asr', 'changed', f"В тексте «{op['script']}», слышно «{op['heard']}».", t)
            R['asr'] = ops
        else:
            for u in [u for u in st['unclear'] if u['align'] < 0.3][:5]:
                add(WARN, 'asr', 'unclear', f"«{u['word']}» звучит не так, как написано (или его нет).", u['t'])
    elif heard:
        spans = [(h[1], h[2]) for h in heard]
    M, MF = check_mix(clip, spans, music_expected=music, dialog=dialog)
    for f in MF:
        add(f['level'], 'mix', f['code'], f['msg'], f['t'])
    R['mix'] = {k: v for k, v in M.items() if k != 'probe'}
    R['probe'] = M.get('probe')
    R['findings'] = sorted(F, key=lambda f: ({ERR: 0, WARN: 1, INFO: 2}[f['level']], f['t'] if f['t'] is not None else -1))
    n_err = sum(f['level'] == ERR for f in F)
    R['status'] = 'fail' if n_err else ('warn' if any(f['level'] == WARN for f in F) else 'ok')
    return R


def finish(R, jpath, mpath):
    json.dump(R, open(jpath, 'w', encoding='utf-8'), ensure_ascii=False, indent=1, default=float)
    open(mpath, 'w', encoding='utf-8').write(markdown(R))


def markdown(R):
    from mixcheck import ERR, WARN
    F = R['findings']
    ne, nw = sum(f['level'] == ERR for f in F), sum(f['level'] == WARN for f in F)
    head = {'fail': f'есть ошибки: {ne}', 'warn': 'ошибок нет', 'ok': 'ошибок нет'}[R['status']]
    if nw:
        head += f', замечаний: {nw}'
    if R.get('accepted'):
        head += f" (принято: {R['accepted']['reason']})"
    p = R.get('probe') or {}
    v = p.get('video') or {}
    L = [f"# Проверка ролика {os.path.basename(R['clip'])}", '',
         f"**Итог: {head}.**", '',
         f"Длительность {fmt_t(R['mix'].get('video_s'))}" + (f", кадр {v['w']}×{v['h']}" if v else '') +
         f", текст: {R.get('text_source') or ('расслышанный Whisper' if R.get('text_from_asr') else 'нет')}"
         f", проверено {R['checked_at']} за {R['seconds']:.0f} с.", '']
    sym = {ERR: '❌', WARN: '⚠️', 'инфо': 'ℹ️'}
    for part, title in (('stress', 'Ударения'), ('asr', 'Голос и текст'), ('mix', 'Сведение и паузы')):
        items = [f for f in F if f['part'] == part]
        L.append(f'## {title}')
        if part == 'stress':
            L.append(f"Проверено слов из двух и более слогов: {R.get('stress_words', 0)}." if R['stress'] else
                     'Нет текста, ударения не проверялись.')
        if part == 'asr' and R.get('asr_note'):
            L.append(R['asr_note'])
        if part == 'mix':
            m = R['mix']
            bits = []
            if m.get('lufs') is not None:
                bits.append(f"громкость {m['lufs']:.1f} LUFS, пик {m['true_peak']:+.1f} dBTP")
            if m.get('speech_start_s') is not None:
                bits.append(f"голос с {fmt_t(m['speech_start_s'])}, после последнего слова "
                            f"{fmt_t(m['video_s'] - m['speech_end_s'])}")
            if m.get('pauses'):
                bits.append(f"самая длинная пауза {fmt_t(max(m['pauses']))}")
            if m.get('voice_over_bed_db') is not None:
                bits.append(f"голос громче музыки в паузах на {m['voice_over_bed_db']:.0f} дБ")
            if bits:
                L.append('Замеры: ' + '; '.join(bits) + '.')
        if not items:
            L.append('Замечаний нет.')
        for f in items:
            L.append(f"- {sym.get(f['level'], '')} {fmt_t(f['t'])}: {f['msg']}" if f['t'] is not None else
                     f"- {sym.get(f['level'], '')} {f['msg']}")
        L.append('')
    if any(f['part'] == 'stress' and f['level'] == ERR for f in F):
        L += ['Как исправить ударение: перегенерировать фразу другим дублем (`qa/pick_take.py` выберет лучший) или заменить '
              'слово простым. Qwen3-TTS знаков ударения не понимает; RHVoice и Silero TTS понимают «+» перед гласной '
              '(`qa/check_text.py --engine rhvoice` расставит).', '']
    T = R.get('text')
    if T and (T['risky'] or T['traps']):
        L.append('## Текст: на что обратить внимание в следующий раз')
        for r in T['risky']:
            L.append(f"- {r['display']}: {'; '.join(r['reasons'])}")
        if T['traps']:
            L.append('- Слова-ловушки (проверьте на слух): ' + ', '.join(T['traps']))
        L.append('')
    return '\n'.join(L)


def accept(clip, jpath, mpath, reason):
    if not os.path.exists(jpath):
        print('Нет отчёта: сначала запустите проверку.', file=sys.stderr)
        return 2
    R = json.load(open(jpath, encoding='utf-8'))
    if R.get('file') != file_id(clip):
        print('Ролик изменился после проверки: запустите проверку заново.', file=sys.stderr)
        return 2
    R['accepted'] = dict(reason=reason, at=datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M UTC'))
    finish(R, jpath, mpath)
    print(f'Принято: {reason}. Отчёт: {mpath}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
