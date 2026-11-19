#!/usr/bin/env python3
"""Нарезки со стримов в вертикальные ролики. Команды:

  streamers   кто сейчас стримит игру на Twitch и YouTube, по числу зрителей
  top-clips   самые просматриваемые клипы игры на Twitch за последние часы -> вертикальные ролики
  moments     горячие моменты в записи стрима (чат, крики, пересмотры)
  render      вертикальный ролик из куска стрима или из найденного момента
  auto        moments + render лучших моментов одной командой
  youtube-top самые просматриваемые записи стримов YouTube за сутки -> лучшие моменты каждой

Подробно: clips/README.md
"""
import argparse
import csv
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import discover as D            # noqa: E402
import moments as M             # noqa: E402
from common import die, hms, link_at, log, need, parse_time, slug  # noqa: E402


def langs(s):
    return [x.strip().lower() for x in s.split(',') if x.strip()] if s else []


def cmd_streamers(a):
    rows = []
    if not a.no_twitch:
        log(f'Twitch: {", ".join(a.game)}' + (f', язык {a.lang}' if a.lang else ''))
        rows += D.twitch_streams(a.game, langs(a.lang), a.top)
    if not a.no_youtube:
        log(f'YouTube: «{a.yt_query}» в эфире')
        rows += D.youtube_live(a.yt_query, (langs(a.lang) or [''])[0], a.top)
    rows.sort(key=lambda r: -r['viewers'])
    if not rows:
        die('Никого не нашёл.')
    os.makedirs(a.work, exist_ok=True)
    path = os.path.join(a.work, 'streamers.csv')
    with open(path, 'w', newline='', encoding='utf-8-sig') as f:
        w = csv.DictWriter(f, fieldnames=['platform', 'name', 'viewers', 'lang', 'title', 'url', 'channel', 'game',
                                          'started'])
        w.writeheader()
        w.writerows(rows)
    print(f'\n{"":>3} {"площадка":<8} {"зрителей":>8}  {"стример":<22} название')
    for i, r in enumerate(rows, 1):
        print(f'{i:>3} {r["platform"]:<8} {r["viewers"]:>8}  {r["name"][:22]:<22} {r["title"][:70]}')
    print(f'\nСписок со ссылками: {path}')


def render_opts(p):
    p.add_argument('--layout', default='auto', choices=['auto', 'split', 'blur', 'crop'],
                   help='split: вебка сверху, игра снизу; blur: весь кадр на размытом фоне; crop: центр 9:16')
    p.add_argument('--cam', help='где вебка в исходнике: x,y,w,h в пикселях (если автопоиск ошибся)')
    p.add_argument('--zoom', type=float, default=1.0, help='приблизить игру (1.2 = на 20%%)')
    p.add_argument('--game-x', type=float, default=0.5, help='центр игры по горизонтали, 0..1')
    p.add_argument('--no-subs', action='store_true', help='без субтитров')
    p.add_argument('--model', default='small', help='модель Whisper: tiny, base, small, medium, large-v3-turbo')
    p.add_argument('--speech', default='ru', help='язык речи для субтитров (ru, en, ... или auto)')
    p.add_argument('--censor', action='store_true',
                   help='мат: звёздочки в субтитрах (б**ть) и писк в звуке поверх слова')
    p.add_argument('--no-bleep', action='store_true', help='с --censor: не пикать в звуке, только звёздочки')
    p.add_argument('--title-secs', type=float, help='сколько секунд держать заголовок (по умолчанию весь ролик)')
    p.add_argument('--no-credit', action='store_true', help='не подписывать канал стримера')
    p.add_argument('--out', default='clips_out', help='куда класть ролики')


def ropts(a, title, credit, source_url=''):
    import layout as L
    return dict(layout=a.layout, cam=L.parse_box(a.cam) if a.cam else None, title=title, title_secs=a.title_secs,
                credit='' if a.no_credit else credit, subtitles=not a.no_subs, model=a.model,
                lang=None if a.speech == 'auto' else a.speech, mat=a.censor, bleep=not a.no_bleep, zoom=a.zoom, game_x=a.game_x,
                source_url=source_url)


def credit_for(channel, platform):
    if not channel:
        return ''
    return f'twitch.tv/{channel}' if platform == 'twitch' else f'{channel} · YouTube' if platform == 'youtube' \
        else channel


def cmd_top_clips(a):
    import render as R
    from common import run, ytdlp
    need('ffmpeg', 'ffprobe')
    chans = [c.strip() for c in a.channels.split(',')] if a.channels else None
    log(f'Топ клипов Twitch за {a.hours:g} ч: {", ".join(a.game)}' + (f', язык {a.lang}' if a.lang else ''))
    clips = D.twitch_top_clips(a.game, a.hours, langs(a.lang), a.top, chans)
    if not clips:
        die('Клипов не нашёл.')
    dl = os.path.join(a.work, 'twitch_clips')
    os.makedirs(dl, exist_ok=True)
    done = []
    for i, c in enumerate(clips, 1):
        log(f'\n[{i}/{len(clips)}] {c["channel"]}: «{c["title"]}» — {c["views"]} просмотров')
        name = slug(f'{c["channel"]}_{c["title"]}', 60)
        out = os.path.join(a.out, name + '.mp4')
        if os.path.exists(out) and not a.force:
            log('  уже есть, пропускаю')
            continue
        src = os.path.join(dl, name + '.mp4')
        if not os.path.exists(src):
            run(ytdlp() + ['-f', 'best[height<=1080]/best', '-o', src, c['url']])
        title = '' if a.no_title else c['title']
        meta = R.render(src, 0, 600, out, os.path.join(dl, 'work'),
                        **ropts(a, title, credit_for(c['channel'], 'twitch'), c['url']))
        meta.update({'views': c['views'], 'clip_title': c['title'], 'channel': c['channel']})
        with open(os.path.splitext(out)[0] + '.json', 'w', encoding='utf-8') as f:
            json.dump(meta, f, ensure_ascii=False, indent=1)
        done.append(out)
    log(f'\nГотово, роликов: {len(done)}, папка {a.out}')


def _source(a):
    from source import Source
    src = a.src
    if src.startswith('twitch:'):               # twitch:<канал> = последняя запись канала
        vods = D.twitch_vods(src.split(':', 1)[1], 1)
        if not vods:
            die(f'У канала {src} нет записей (или они скрыты).')
        log(f'Последняя запись: {vods[0]["title"]} — {vods[0]["url"]}')
        src = vods[0]['url']
    return Source(src, a.work, a.chat, a.no_chat, getattr(a, 'last_hours', None))


def find_moments(a, s):
    from moments import loudness, pick, report, signals, summary
    need('ffmpeg', 'ffprobe')
    log(f'«{s.title}», {hms(s.duration)}')
    c = s.chat()
    log('Слушаю звук…')
    audio = s.audio()
    frames = loudness(audio, start=s.audio_offset if not s.url else 0.0)
    off = s.audio_offset
    if off:                                     # only the tail was analysed: the timeline still starts at 0
        frames = np.concatenate([np.full(int(off / M.FRAME), float(np.median(frames))), frames])
    n = int(max(s.duration, len(frames) * M.FRAME))
    sig, raw = signals(n, frames, c, s.heatmap, a.lag)
    rr = a.rerank == 'on' or (a.rerank == 'auto' and 'chat' not in sig)
    ms, _ = pick(n, sig, raw, a.top * 3 if rr else a.top, a.len, skip_start=a.skip_start, frames=frames,
                 min_start=off)
    if rr:
        log(f'\nСлушаю речь в {len(ms)} кандидатах, чтобы выбрать, где стример реагирует…')
        ms = M.rerank(audio, ms, a.top, getattr(a, 'model', 'small'), 'ru', s.work, 0.0 if not s.url else off)
    for m in ms:
        m['link'] = link_at(s.url, m['start'])
        m['title'] = ''
    path = os.path.join(s.work, 'moments.json')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump({'source': s.url or os.path.abspath(s.src), 'title': s.title, 'channel': s.channel,
                   'platform': s.platform, 'signals': sorted(sig), 'moments': ms}, f, ensure_ascii=False, indent=1)
    with open(os.path.join(s.work, 'moments.md'), 'w', encoding='utf-8') as f:
        f.write(report(ms, s.title, lambda t: link_at(s.url, t)))
    log(f'\nНайдено моментов: {len(ms)} (по сигналам: {", ".join(sorted(sig))}):')
    summary(ms)
    log(f'\nСписок: {path}\nВпиши заголовки в поле "title" и запусти render с --moments, или сразу auto.')
    return path


def cmd_moments(a):
    find_moments(a, _source(a))


def render_moments(a, path, picks=None):
    import render as R
    from source import Source
    with open(path, encoding='utf-8') as f:
        d = json.load(f)
    s = Source(d['source'], a.work, no_chat=True)
    ms = [m for m in d['moments'] if not picks or m['n'] in picks]
    credit = credit_for(s.channel or d.get('channel'), s.platform or d.get('platform'))
    outs = []
    for m in ms:
        name = slug(f'{s.channel or s.id}_{hms(m["start"]).replace(":", "-")}', 60)
        out = os.path.join(a.out, name + '.mp4')
        log(f'\n[{m["n"]}] {hms(m["start"])}–{hms(m["end"])} {m.get("title") or ""}')
        if os.path.exists(out) and not getattr(a, 'force', False):
            log('  уже есть, пропускаю')
            continue
        piece, off = s.piece(m['start'], m['end'], f'piece_{m["n"]:02d}')
        R.render(piece, off, m['end'] - m['start'], out, os.path.join(s.work, 'render'),
                 **ropts(a, m.get('title') or '', credit, m.get('link') or s.url))
        outs.append(out)
    log(f'\nГотово, роликов: {len(outs)}, папка {a.out}')


def cmd_render(a):
    import render as R
    need('ffmpeg', 'ffprobe')
    if a.moments:
        picks = {int(x) for x in a.pick.split(',')} if a.pick else None
        return render_moments(a, a.moments, picks)
    if not a.src or a.start is None:
        die('Нужно: render <файл или ссылка> --start 1:02:03 [--len 30], или render --moments moments.json')
    s = _source(a)
    start, length = parse_time(a.start), a.len
    piece, off = s.piece(start, start + length, slug(f'piece_{a.start}'))
    name = a.name or slug(f'{s.channel or s.id}_{a.start.replace(":", "-")}', 60)
    R.render(piece, off, length, os.path.join(a.out, name + '.mp4'), os.path.join(s.work, 'render'),
             **ropts(a, a.title or '', credit_for(s.channel, s.platform), link_at(s.url, start)))


def cmd_auto(a):
    s = _source(a)
    path = find_moments(a, s)
    render_moments(a, path, set(range(1, a.render_top + 1)))


def cmd_youtube_top(a):
    from source import Source
    log(f'YouTube: записи стримов «{a.yt_query}» за {a.hours:g} ч, по просмотрам')
    vids = D.youtube_recent(a.yt_query, (langs(a.lang) or [''])[0], a.hours, a.streams)
    if not vids:
        die('Записей стримов не нашёл. Попробуй другой --query или --hours 72.')
    for i, v in enumerate(vids, 1):
        log(f'  {i}. {v["channel"]}: «{v["title"][:70]}» — {v["views"]} просмотров, {hms(v["duration"] or 0)}')
    for i, v in enumerate(vids, 1):
        log(f'\n===== [{i}/{len(vids)}] {v["channel"]}: {v["url"]}')
        try:
            s = Source(v['url'], a.work, None, a.no_chat)
            path = find_moments(a, s)
            render_moments(a, path, set(range(1, a.render_top + 1)))
        except (Exception, SystemExit) as e:      # one broken stream must not stop the rest
            log(f'  пропускаю: {e}')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--work', default='clips_work', help='рабочая папка (звук, чат, куски видео)')
    sub = ap.add_subparsers(dest='cmd', required=True)

    p = sub.add_parser('streamers', help='кто сейчас стримит игру')
    p.add_argument('--game', action='append', help='категория Twitch, можно несколько (по умолчанию Grand Theft Auto VI)')
    p.add_argument('--lang', default='ru', help='язык стрима: ru, en, ru,uk или пусто для всех')
    p.add_argument('--top', type=int, default=30)
    p.add_argument('--yt-query', default='GTA 6', help='что искать на YouTube')
    p.add_argument('--no-twitch', action='store_true')
    p.add_argument('--no-youtube', action='store_true')
    p.set_defaults(fn=cmd_streamers)

    p = sub.add_parser('top-clips', help='топ клипов Twitch -> вертикальные ролики')
    p.add_argument('--game', action='append')
    p.add_argument('--hours', type=float, default=24)
    p.add_argument('--lang', default='ru')
    p.add_argument('--top', type=int, default=10)
    p.add_argument('--channels', help='только эти каналы, через запятую (те, кто разрешил нарезки)')
    p.add_argument('--no-title', action='store_true', help='не ставить название клипа заголовком')
    p.add_argument('--force', action='store_true', help='пересобрать уже готовые')
    render_opts(p)
    p.set_defaults(fn=cmd_top_clips)

    for name, fn, hlp in (('moments', cmd_moments, 'найти моменты'), ('auto', cmd_auto, 'найти и нарезать'),
                          ('youtube-top', cmd_youtube_top, 'записи стримов YouTube за сутки -> лучшие моменты')):
        p = sub.add_parser(name, help=hlp)
        if name == 'youtube-top':
            p.add_argument('--yt-query', '--query', default='GTA 6', help='что искать на YouTube')
            p.add_argument('--hours', type=float, default=24, help='записи не старше, ч (24 или 168)')
            p.add_argument('--lang', default='ru', help='язык (точно работает только с ключом YouTube API)')
            p.add_argument('--streams', type=int, default=3, help='сколько записей разобрать')
            p.add_argument('--force', action='store_true', help='пересобрать уже готовые')
        else:
            p.add_argument('src', help='файл, ссылка на запись Twitch или YouTube, или twitch:<канал>')
            p.add_argument('--chat', help='файл чата (TwitchDownloader .json, YouTube .live_chat.json)')
        p.add_argument('--no-chat', action='store_true', help='не качать чат, искать только по звуку')
        p.add_argument('--top', type=int, default=10, help='сколько моментов найти')
        p.add_argument('--len', type=float, default=35, help='длина ролика, с')
        p.add_argument('--lag', type=float, default=5, help='на сколько секунд чат отстаёт от стрима')
        p.add_argument('--skip-start', type=float, default=180, help='пропустить начало стрима (заставка), с')
        p.add_argument('--last-hours', type=float,
                       help='искать только в последних N часах записи (для многочасовых марафонов)')
        p.add_argument('--rerank', default='auto', choices=['auto', 'on', 'off'],
                       help='распознать речь в кандидатах и поднять те, где стример реагирует '
                            '(auto: когда нет чата)')
        if name != 'moments':
            p.add_argument('--render-top', type=int, default=5 if name == 'auto' else 3, help='сколько лучших нарезать')
            render_opts(p)
        p.set_defaults(fn=fn)

    p = sub.add_parser('render', help='нарезать кусок или найденные моменты')
    p.add_argument('src', nargs='?', help='файл или ссылка')
    p.add_argument('--moments', help='moments.json от команды moments')
    p.add_argument('--pick', help='какие моменты, например 1,3,4 (по умолчанию все)')
    p.add_argument('--start', help='начало куска: 1:02:03')
    p.add_argument('--len', type=float, default=30)
    p.add_argument('--title', help='заголовок сверху ролика')
    p.add_argument('--name', help='имя файла без .mp4')
    p.add_argument('--chat')
    p.add_argument('--no-chat', action='store_true', default=True)
    render_opts(p)
    p.set_defaults(fn=cmd_render)

    a = ap.parse_args()
    if getattr(a, 'game', 'x') is None:
        a.game = list(D.DEFAULT_GAMES)
    try:
        a.fn(a)
    except RuntimeError as e:
        die(f'Ошибка: {e}')


if __name__ == '__main__':
    main()
