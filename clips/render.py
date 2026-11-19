"""One vertical clip: layout, subtitles, title, loudness."""
import json
import os
import shutil

import layout as L
import subs as S
from common import FONTS, hms, log, probe, run


def render(src, start, dur, out, work, layout='auto', cam=None, title='', title_secs=None, credit='',
           subtitles=True, model='small', lang=None, mat=False, zoom=1.0, game_x=0.5, source_url='', bleep=True):
    os.makedirs(work, exist_ok=True)
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    info = probe(src)
    dur = min(dur, max(0.5, info['duration'] - start)) if info['duration'] else dur
    stem = os.path.splitext(os.path.basename(out))[0]

    if cam is None and layout in ('auto', 'split'):
        cam = L.detect_cam(src, start, start + dur, debug_jpg=os.path.join(work, stem + '.cam.jpg'))
        if cam:
            log(f'  вебка: x={cam[0]} y={cam[1]} {cam[2]}×{cam[3]} (проверка: {stem}.cam.jpg в рабочей папке)')
        elif layout == 'auto':
            log('  вебку не нашёл: кадр по центру на размытом фоне')
    p = L.plan(layout, info['width'], info['height'], cam, zoom, game_x)

    words = []
    if subtitles and info['has_audio']:
        wav = os.path.join(work, stem + '.wav')
        run(['ffmpeg', '-y', '-v', 'error', '-ss', str(start), '-t', str(dur), '-i', src, '-vn', '-ac', '1',
             '-ar', '16000', wav])
        words = S.transcribe(wav, model, lang)
        os.remove(wav)
    ass = S.build(words, dur, p, title, title_secs, credit, mat)
    with open(os.path.join(work, stem + '.ass'), 'w', encoding='utf-8') as f:
        f.write(ass)
    fonts = os.path.join(work, 'fonts')
    if not os.path.isdir(fonts):
        shutil.copytree(FONTS, fonts)

    # run inside the work folder: the subtitles filter gets plain relative names (no Windows drive colons)
    vf = p['filter'][:-3] + f'[v0];[v0]subtitles={stem}.ass:fontsdir=fonts[v]'
    af = (f'loudnorm=I=-14:TP=-1.5:LRA=11,afade=t=in:d=0.12,afade=t=out:st={max(0, dur - 0.35):.2f}:d=0.35,'
          f'aresample=48000')
    fps = min(60.0, info['fps'] or 30)
    spans = S.bleeps(words) if (mat and bleep) else []
    if info['has_audio']:
        if spans:
            # the swear words are muted and a 1 kHz beep plays over them
            on = '+'.join(f'between(t,{a:.2f},{b:.2f})' for a, b in spans)
            vf += (f";[0:a]volume=0:enable='{on}',{af}[a0];"
                   f"sine=frequency=1000:sample_rate=48000:duration={dur:.2f},volume=0.2,"
                   f"volume=0:enable='not({on})'[bp];[a0][bp]amix=inputs=2:normalize=0:duration=first[a]")
        else:
            vf += f';[0:a:0]{af}[a]'
    cmd = ['ffmpeg', '-y', '-v', 'error', '-stats', '-ss', f'{start:.3f}', '-t', f'{dur:.3f}', '-i', os.path.abspath(src),
           '-filter_complex', vf, '-map', '[v]']
    if info['has_audio']:
        cmd += ['-map', '[a]', '-c:a', 'aac', '-b:a', '160k']
        if spans:
            log(f'  запикано слов: {len(spans)}')
    cmd += ['-r', f'{fps:.3f}', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
            '-movflags', '+faststart', os.path.abspath(out)]
    log(f'  рендер {os.path.basename(out)} ({hms(dur)}, {p["layout"]})')
    run(cmd, cwd=work)

    text = ' '.join(w['word'] for w in words)
    meta = {'file': os.path.basename(out), 'source': source_url or src, 'start': round(start, 2),
            'duration': round(dur, 2), 'layout': p['layout'], 'cam': cam, 'title': title, 'credit': credit,
            'transcript': text}
    with open(os.path.splitext(out)[0] + '.json', 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)
    return meta
