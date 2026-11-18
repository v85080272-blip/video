"""Shared helpers: running tools, HTTP JSON, keys, time formats."""
import json
import os
import re
import shutil
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.join(HERE, 'fonts')
FONT_NAME = 'Russo One'
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'


def die(msg):
    print(msg, file=sys.stderr)
    sys.exit(1)


def log(msg):
    print(msg, flush=True)


def need(*tools):
    for t in tools:
        if not shutil.which(t):
            die(f'Нет программы {t}. Поставь ffmpeg (в нём есть ffprobe): https://ffmpeg.org/download.html')


def run(cmd, quiet=False, **kw):
    if quiet:
        kw.setdefault('stdout', subprocess.DEVNULL)
        kw.setdefault('stderr', subprocess.PIPE)
    r = subprocess.run(cmd, **kw)
    if r.returncode:
        err = r.stderr.decode('utf-8', 'replace')[-2000:] if isinstance(r.stderr, bytes) else ''
        die(f'Команда упала ({r.returncode}): {" ".join(map(str, cmd))[:300]}\n{err}')
    return r


def ytdlp():
    """yt-dlp as a module of this Python, so `pip install yt-dlp` is enough."""
    try:
        import yt_dlp  # noqa: F401
    except ImportError:
        die('Нет yt-dlp: pip install -r clips/requirements.txt')
    return [sys.executable, '-m', 'yt_dlp', '--no-warnings']


def ytdlp_json(url, *extra):
    r = subprocess.run(ytdlp() + ['-J', *extra, url], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if r.returncode:
        raise RuntimeError(r.stderr.decode('utf-8', 'replace').strip()[-800:])
    return json.loads(r.stdout)


def probe(path):
    r = run(['ffprobe', '-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', path],
            stdout=subprocess.PIPE)
    d = json.loads(r.stdout)
    v = next((s for s in d['streams'] if s['codec_type'] == 'video'), None)
    a = next((s for s in d['streams'] if s['codec_type'] == 'audio'), None)
    fps = 30.0
    if v and v.get('avg_frame_rate', '0/0') != '0/0':
        n, m = v['avg_frame_rate'].split('/')
        fps = float(n) / float(m or 1)
    return {
        'duration': float(d['format'].get('duration') or 0),
        'width': int(v['width']) if v else 0,
        'height': int(v['height']) if v else 0,
        'fps': fps,
        'has_audio': a is not None,
    }


def http_json(url, data=None, headers=None, method=None, timeout=30):
    h = {'User-Agent': UA, 'Accept': 'application/json'}
    h.update(headers or {})
    if isinstance(data, (dict, list)):
        data = json.dumps(data).encode()
        h.setdefault('Content-Type', 'application/json')
    req = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', 'replace')[:500]
        raise RuntimeError(f'{e.code} {url.split("?")[0]}: {body}') from None


def load_keys():
    """API keys from the environment or clips/keys.json (that file is in .gitignore)."""
    keys = {}
    p = os.path.join(HERE, 'keys.json')
    if os.path.exists(p):
        with open(p, encoding='utf-8') as f:
            keys.update(json.load(f))
    for k in ('TWITCH_CLIENT_ID', 'TWITCH_CLIENT_SECRET', 'YOUTUBE_API_KEY'):
        if os.environ.get(k):
            keys[k] = os.environ[k]
    return keys


def hms(t):
    t = int(round(t))
    h, m, s = t // 3600, t // 60 % 60, t % 60
    return f'{h}:{m:02d}:{s:02d}' if h else f'{m}:{s:02d}'


def parse_time(s):
    """'1:02:03', '62:03', '3723', '1h2m3s' -> seconds."""
    s = str(s).strip()
    m = re.fullmatch(r'(?:(\d+)h)?(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s)?', s)
    if m and any(m.groups()):
        h, mi, se = m.groups()
        return int(h or 0) * 3600 + int(mi or 0) * 60 + float(se or 0)
    parts = [float(p) for p in s.split(':')]
    t = 0.0
    for p in parts:
        t = t * 60 + p
    return t


def slug(s, n=40):
    s = re.sub(r'[^\w\-]+', '_', str(s), flags=re.U).strip('_')
    return s[:n] or 'clip'


def link_at(url, t):
    """Link to a moment in the VOD, so it can be checked in the browser."""
    if not url or not url.startswith('http'):
        return ''
    t = int(t)
    if 'twitch.tv' in url:
        return f'{url.split("?")[0]}?t={t // 3600}h{t // 60 % 60}m{t % 60}s'
    sep = '&' if '?' in url else '?'
    return f'{url}{sep}t={t}'
