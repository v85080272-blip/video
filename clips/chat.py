"""Chat replay as a list of (second in the VOD, text).

Sources: Twitch VOD chat through the website's GraphQL (no keys; Twitch can change it), a TwitchDownloader
export (`TwitchDownloaderCLI chatdownload --id <vod> -o chat.json`), the YouTube live chat replay yt-dlp writes
(`*.live_chat.json`), or a cached chat.jsonl of this tool.
"""
import concurrent.futures as cf
import json
import os
import re

from common import http_json, log

GQL = 'https://gql.twitch.tv/gql'
WEB_CLIENT = 'kimne78kx3ncx6brgo4mv6wki5h1ko'          # client id of the twitch.tv website
COMMENTS_HASH = 'b70a3591ff0f4e0313d126c6a1502d79a1c02baebb288227c582044aa76adf6a'

# what chat writes when something happens; short tokens count only as whole words
LAUGH_RE = re.compile(r'(?:а?ха){2,}|(?:х[ае]){2,}|(?:ах){2,}|пх[ап]х|аха+х|(?:ha){2,}|(?:ah){2,}|lmao|lmfao|lol')
FUNNY = {'kekw', 'lul', 'lulw', 'omegalul', 'xd', 'xdd', 'ору', 'орууу', 'ржу', 'кек', 'лол', 'icant', 'pepelaugh',
         'kekwait', 'aware', 'clueless', 'жиза'}
HYPE = {'pog', 'pogchamp', 'poggers', 'pogu', 'w', 'жесть', 'имба', 'вау', 'wow', 'omg', 'омг', 'wtf', 'ватафак',
        'нифига', 'офигеть', 'капец', 'pause', 'monkas', 'monkaw', 'peepoclap', 'ez', 'gg', 'гг', 'base', 'база',
        'пиздец', 'ахуеть', 'ебать', 'бля', 'what', 'чё', 'чо', 'что', '?', '??', '???', '!!'}
CLIP = {'clip', 'clipit', 'клип', 'клипани', 'клипаем', 'клипните', 'клипнул', 'клипай', 'clipped'}


def weight(text):
    """1 for every message, more when it laughs, hypes or asks to clip."""
    t = text.lower()
    toks = re.findall(r'\w+|\?+|!+', t)
    w = 1.0
    if LAUGH_RE.search(t) or any(x in FUNNY for x in toks):
        w += 1.0
    if any(x in HYPE for x in toks):
        w += 0.6
    if any(x in CLIP for x in toks) or 'clip' in t:
        w += 2.0
    return w


def load(path):
    """Any of the supported files -> sorted [(t, text)]."""
    out = []
    with open(path, encoding='utf-8') as f:
        text = f.read()
    whole = None
    try:
        whole = json.loads(text)
    except ValueError:
        pass
    if isinstance(whole, dict) and isinstance(whole.get('comments'), list):     # TwitchDownloader
        for c in whole['comments']:
            msg = c.get('message') or {}
            body = msg.get('body') or ''.join(fr.get('text') or '' for fr in msg.get('fragments') or [])
            out.append((float(c['content_offset_seconds']), body))
    else:
        for line in text.splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                d = json.loads(line)
            except ValueError:
                continue
            if isinstance(d, list) and len(d) == 2:                            # our chat.jsonl
                out.append((float(d[0]), str(d[1])))
            elif isinstance(d, dict):                                          # YouTube live_chat.json
                out += _youtube_line(d)
    out.sort(key=lambda x: x[0])
    return out


def _youtube_line(d):
    act = d.get('replayChatItemAction') or {}
    off = act.get('videoOffsetTimeMsec')
    res = []
    for a in act.get('actions', []):
        item = (a.get('addChatItemAction') or {}).get('item') or {}
        r = item.get('liveChatTextMessageRenderer') or item.get('liveChatPaidMessageRenderer')
        if not r or off is None:
            continue
        text = ''
        for run in (r.get('message') or {}).get('runs', []):
            if 'text' in run:
                text += run['text']
            elif 'emoji' in run:
                sc = run['emoji'].get('shortcuts') or []
                text += ' ' + (sc[0].strip(':') if sc else '') + ' '
        res.append((int(off) / 1000.0, text.strip()))
    return res


def save(chat, path):
    with open(path, 'w', encoding='utf-8') as f:
        for t, text in chat:
            f.write(json.dumps([t, text], ensure_ascii=False) + '\n')


def _page(vid, off):
    """One page of comments from offset `off` (seconds): [(id, t, text)], has_next."""
    q = ('query($id:ID!,$off:Int){video(id:$id){comments(contentOffsetSeconds:$off){edges{node{id '
         'contentOffsetSeconds message{fragments{text}}}} pageInfo{hasNextPage}}}}')
    tries = [
        ({'query': q, 'variables': {'id': vid, 'off': off}}, WEB_CLIENT),
        ([{'operationName': 'VideoCommentsByOffsetOrCursor', 'variables': {'videoID': vid, 'contentOffsetSeconds': off},
           'extensions': {'persistedQuery': {'version': 1, 'sha256Hash': COMMENTS_HASH}}}], WEB_CLIENT),
    ]
    err = None
    for body, cid in tries:
        try:
            d = http_json(GQL, data=body, headers={'Client-ID': cid})
        except RuntimeError as e:
            err = e
            continue
        if isinstance(d, list):
            d = d[0]
        c = (((d or {}).get('data') or {}).get('video') or {}).get('comments')
        if c is None:
            err = RuntimeError(str(d.get('errors') or d)[:200])
            continue
        rows = [(e['node']['id'], int(e['node']['contentOffsetSeconds']),
                 ''.join(fr.get('text') or '' for fr in (e['node'].get('message') or {}).get('fragments') or []))
                for e in c.get('edges') or []]
        return rows, bool((c.get('pageInfo') or {}).get('hasNextPage'))
    raise RuntimeError(f'Twitch не отдал чат: {err}')


def fetch_twitch(vid, duration, workers=8):
    """Whole VOD chat, fetched in parallel time slices."""
    vid = str(vid).lstrip('v')
    n = max(1, min(64, int(duration // 600) + 1))
    edges = [int(duration * i / n) for i in range(n + 1)]
    edges[-1] = int(duration) + 1

    def part(a, b):
        seen, out, off = set(), [], a
        while off < b:
            rows, more = _page(vid, off)
            new = [r for r in rows if r[0] not in seen and r[1] < b]
            for r in new:
                seen.add(r[0])
                out.append((float(r[1]), r[2]))
            last = max((r[1] for r in rows), default=off)
            if not more or not rows:
                break
            off = last if last > off else off + 1
        return out

    chat = []
    with cf.ThreadPoolExecutor(workers) as ex:
        futs = [ex.submit(part, edges[i], edges[i + 1]) for i in range(n)]
        for i, fu in enumerate(cf.as_completed(futs), 1):
            chat += fu.result()
            log(f'  чат: {i}/{n} кусков, {len(chat)} сообщений')
    chat.sort(key=lambda x: x[0])
    return chat


def find_file(folder):
    for f in sorted(os.listdir(folder)):
        if f.endswith('.live_chat.json') or f == 'chat.jsonl':
            return os.path.join(folder, f)
    return None
