"""A stream to clip: a local file or a link (Twitch or YouTube).

For a link only the audio and the chat are downloaded to look for moments; then only the chosen pieces of video.
"""
import concurrent.futures as cf
import glob
import json
import os
import subprocess
import time
import urllib.parse
import urllib.request

import chat as C
from common import UA, log, probe, run, slug, ytdlp, ytdlp_json

VIDEO_FMT = 'bv*[height<=1080]+ba/b[height<=1080]/bv*+ba/b'


def is_url(s):
    return s.startswith('http://') or s.startswith('https://')


class Source:
    def __init__(self, src, work_root, chat_file=None, no_chat=False):
        self.src = src
        self.url = src if is_url(src) else ''
        if self.url:
            log('Смотрю ссылку…')
            self.info = ytdlp_json(src)
            self.id = slug(f'{self.info.get("extractor_key", "")}_{self.info.get("id", "")}')
            self.title = self.info.get('title') or self.id
            self.channel = self.info.get('uploader') or self.info.get('channel') or ''
            self.duration = float(self.info.get('duration') or 0)
        else:
            if not os.path.exists(src):
                raise FileNotFoundError(src)
            self.info = {}
            self.id = slug(os.path.splitext(os.path.basename(src))[0])
            self.title = os.path.basename(src)
            self.channel = ''
            self.duration = probe(src)['duration']
        self.work = os.path.join(work_root, self.id)
        os.makedirs(self.work, exist_ok=True)
        if self.info:
            keep = {k: self.info.get(k) for k in ('id', 'title', 'uploader', 'channel', 'duration', 'webpage_url',
                                                  'extractor_key', 'heatmap', 'timestamp')}
            with open(os.path.join(self.work, 'info.json'), 'w', encoding='utf-8') as f:
                json.dump(keep, f, ensure_ascii=False, indent=1)
        self.chat_file, self.no_chat = chat_file, no_chat

    @property
    def platform(self):
        k = (self.info.get('extractor_key') or '').lower()
        return 'twitch' if 'twitch' in k else 'youtube' if 'youtube' in k else k

    @property
    def heatmap(self):
        return self.info.get('heatmap') or None

    def audio(self):
        """Path of the audio to analyse (the file itself for a local video)."""
        if not self.url:
            return self.src
        have = glob.glob(os.path.join(self.work, 'audio.*'))
        have = [h for h in have if not h.endswith(('.part', '.ytdl'))]
        if have:
            return have[0]
        if self.recording:
            log('Стрим ещё идёт: качаю звук записи с начала до текущего момента…')
            out = os.path.join(self.work, 'audio.ts')
            hls_fetch(hls_list(self._format_url('Audio_Only/audio_only/ba/worst')), out)
            return out
        log('Качаю звук стрима (только звук, чтобы найти моменты)…')
        run(ytdlp() + ['-f', 'ba/bestaudio/worst', '-o', os.path.join(self.work, 'audio.%(ext)s'),
                       '--concurrent-fragments', '8', self.url])
        have = [h for h in glob.glob(os.path.join(self.work, 'audio.*')) if not h.endswith(('.part', '.ytdl'))]
        return have[0]

    def chat(self):
        if self.no_chat:
            return []
        if self.chat_file:
            c = C.load(self.chat_file)
            log(f'Чат: {len(c)} сообщений из {self.chat_file}')
            return c
        cached = os.path.join(self.work, 'chat.jsonl')
        if os.path.exists(cached):
            return C.load(cached)
        c = []
        try:
            if self.platform == 'twitch':
                log('Качаю чат Twitch…')
                c = C.fetch_twitch(self.info['id'], self.duration)
            elif self.platform == 'youtube':
                log('Качаю чат YouTube…')
                subprocess.run(ytdlp() + ['--skip-download', '--write-subs', '--sub-langs', 'live_chat',
                                          '-o', os.path.join(self.work, 'chat'), self.url])
                f = C.find_file(self.work)
                c = C.load(f) if f else []
        except Exception as e:      # the moments can still be found by the voice
            log(f'  чат не скачался ({str(e)[:200]}); ищу по звуку')
        if c:
            C.save(c, cached)
            log(f'Чат: {len(c)} сообщений')
        else:
            log('Чата нет: ищу только по звуку' + (' и графику пересмотров' if self.heatmap else ''))
        return c

    @property
    def recording(self):
        """A Twitch VOD of a stream that is still live: yt-dlp would download it from the live edge."""
        return bool(self.url and self.platform == 'twitch' and self.info.get('is_live'))

    def _format_url(self, fmt):
        self._urls = getattr(self, '_urls', {})
        if fmt not in self._urls:
            r = run(ytdlp() + ['-f', fmt, '-g', self.url], stdout=subprocess.PIPE)
            self._urls[fmt] = r.stdout.decode().strip().splitlines()[-1]
        return self._urls[fmt]

    def piece(self, a, b, name):
        """A video file that holds [a, b]; returns (path, offset of a inside it)."""
        if not self.url:
            return self.src, a
        if self.recording:
            segs = [x for x in hls_list(self._format_url('best[height<=1080]/best')) if x[0] + x[1] > a and x[0] < b]
            if not segs:
                raise RuntimeError(f'в записи нет отрезка {a:.0f}–{b:.0f} с')
            out = os.path.join(self.work, name + '.ts')
            if not os.path.exists(out):
                log(f'Качаю кусок видео {name}…')
                hls_fetch(segs, out, quiet=True)
            return out, a - segs[0][0]
        out = os.path.join(self.work, name + '.mp4')
        if not os.path.exists(out):
            log(f'Качаю кусок видео {name}…')
            run(ytdlp() + ['-f', VIDEO_FMT, '--download-sections', f'*{a:.2f}-{b:.2f}', '--force-keyframes-at-cuts',
                           '--merge-output-format', 'mp4', '--concurrent-fragments', '8', '-o', out, self.url])
        return out, 0.0


def _get(url, tries=4):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=60) as r:
                return r.read()
        except Exception:
            if i == tries - 1:
                raise
            time.sleep(1 + 2 * i)


def hls_list(url):
    """[(start, duration, segment url)] of an HLS media playlist."""
    segs, t, dur = [], 0.0, None
    for line in _get(url).decode('utf-8', 'replace').splitlines():
        line = line.strip()
        if line.startswith('#EXTINF:'):
            dur = float(line[8:].split(',')[0])
        elif line and not line.startswith('#') and dur is not None:
            segs.append((t, dur, urllib.parse.urljoin(url, line)))
            t += dur
            dur = None
    return segs


def hls_fetch(segs, out, workers=12, quiet=False):
    """Download the segments in order into one MPEG-TS file."""
    tmp = out + '.part'
    with open(tmp, 'wb') as f, cf.ThreadPoolExecutor(workers) as ex:
        for i, data in enumerate(ex.map(_get, [x[2] for x in segs]), 1):
            f.write(data)
            if not quiet and (i % 200 == 0 or i == len(segs)):
                log(f'  {i}/{len(segs)} кусков')
    os.replace(tmp, out)
