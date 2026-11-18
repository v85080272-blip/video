"""Who streams the game right now, and which of their clips are the hottest.

Twitch: the official Helix API when TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET are set (free app at dev.twitch.tv),
otherwise the public GraphQL endpoint of the Twitch website (no keys, but Twitch may change it at any time).
YouTube: the Data API v3 with YOUTUBE_API_KEY, otherwise the live-filtered search page through yt-dlp.
"""
import datetime as dt
import urllib.parse

from common import http_json, load_keys, log, ytdlp_json

DEFAULT_GAMES = ['Grand Theft Auto VI']
GQL = 'https://gql.twitch.tv/gql'
GQL_CLIENT = 'ue6666qo983tsx6so1t0vnawi233wa'   # public client id yt-dlp uses for the Twitch GraphQL


class Helix:
    def __init__(self, cid, secret):
        tok = http_json('https://id.twitch.tv/oauth2/token', method='POST', data=urllib.parse.urlencode({
            'client_id': cid, 'client_secret': secret, 'grant_type': 'client_credentials'}).encode(),
            headers={'Content-Type': 'application/x-www-form-urlencoded'})
        self.h = {'Client-Id': cid, 'Authorization': 'Bearer ' + tok['access_token']}

    def get(self, path, **params):
        q = urllib.parse.urlencode({k: v for k, v in params.items() if v not in (None, [], '')}, doseq=True)
        return http_json(f'https://api.twitch.tv/helix/{path}?{q}', headers=self.h)

    def pages(self, path, limit, **params):
        out, after = [], None
        while len(out) < limit:
            d = self.get(path, first=min(100, limit - len(out)), after=after, **params)
            out += d.get('data', [])
            after = (d.get('pagination') or {}).get('cursor')
            if not after or not d.get('data'):
                break
        return out[:limit]

    def game_ids(self, names):
        d = self.get('games', name=list(names))
        found = {g['name']: g['id'] for g in d.get('data', [])}
        for n in names:
            if n not in found:
                log(f'  на Twitch нет категории «{n}» (имя должно совпадать точно, как на сайте)')
        return found


def helix(keys=None):
    keys = keys if keys is not None else load_keys()
    if keys.get('TWITCH_CLIENT_ID') and keys.get('TWITCH_CLIENT_SECRET'):
        return Helix(keys['TWITCH_CLIENT_ID'], keys['TWITCH_CLIENT_SECRET'])
    return None


def _gql(query, variables):
    d = http_json(GQL, data={'query': query, 'variables': variables},
                  headers={'Client-ID': GQL_CLIENT, 'Content-Type': 'text/plain;charset=UTF-8'})
    if d.get('errors'):
        raise RuntimeError('Twitch GraphQL: ' + '; '.join(e.get('message', '?') for e in d['errors'])[:300])
    return d['data']


def _gql_streams(game, limit):
    q = ('query($name:String!,$after:Cursor){game(name:$name){displayName streams(first:30,after:$after){'
         'edges{cursor node{title viewersCount createdAt broadcaster{login displayName '
         'broadcastSettings{language}}}} pageInfo{hasNextPage}}}}')
    out, after = [], None
    while len(out) < limit:
        g = (_gql(q, {'name': game, 'after': after}) or {}).get('game')
        if not g:
            log(f'  на Twitch нет категории «{game}»')
            break
        edges = g['streams']['edges']
        for e in edges:
            n = e['node']
            b = n.get('broadcaster') or {}
            lang = ((b.get('broadcastSettings') or {}).get('language') or '').lower()
            out.append({'user_login': b.get('login'), 'user_name': b.get('displayName'), 'title': n.get('title'),
                        'viewer_count': n.get('viewersCount') or 0, 'started_at': n.get('createdAt'),
                        'language': lang, 'game_name': g['displayName']})
        if not edges or not g['streams']['pageInfo'].get('hasNextPage'):
            break
        after = edges[-1]['cursor']
    return out


def twitch_streams(games=DEFAULT_GAMES, langs=(), limit=50, api=None):
    """Live streams of the games, most viewers first."""
    api = api if api is not None else helix()
    rows = []
    if api:
        ids = api.game_ids(games)
        if ids:
            rows = api.pages('streams', limit, game_id=list(ids.values()), language=list(langs))
    else:
        for g in games:
            try:
                rows += _gql_streams(g, limit * (4 if langs else 1))
            except RuntimeError as e:
                log(f'  Twitch без ключей не ответил ({e}). Заведи ключи Helix, см. clips/README.md')
        if langs:
            rows = [r for r in rows if r['language'] in langs]
    rows.sort(key=lambda r: -r['viewer_count'])
    return [{'platform': 'twitch', 'channel': r['user_login'], 'name': r['user_name'], 'viewers': r['viewer_count'],
             'title': (r.get('title') or '').strip(), 'lang': r.get('language', ''), 'game': r.get('game_name', ''),
             'started': r.get('started_at', ''), 'url': f'https://www.twitch.tv/{r["user_login"]}'} for r in rows[:limit]]


def twitch_top_clips(games=DEFAULT_GAMES, hours=24, langs=(), limit=20, channels=None, api=None):
    """Most-viewed clips of the games made in the last `hours`, across every channel (needs Helix keys);
    without keys: the top clips of each channel in `channels` (or of the live streamers) via yt-dlp."""
    api = api if api is not None else helix()
    now = dt.datetime.now(dt.timezone.utc)
    since = now - dt.timedelta(hours=hours)
    fmt = '%Y-%m-%dT%H:%M:%SZ'
    out = []
    if api and not channels:
        for gid in api.game_ids(games).values():
            for c in api.pages('clips', 500, game_id=gid, started_at=since.strftime(fmt), ended_at=now.strftime(fmt)):
                if langs and c.get('language') not in langs:
                    continue
                out.append({'url': c['url'], 'title': c['title'], 'channel': c['broadcaster_name'],
                            'views': c['view_count'], 'duration': c['duration'], 'created': c['created_at'],
                            'lang': c.get('language', ''), 'video_id': c.get('video_id'),
                            'vod_offset': c.get('vod_offset')})
    else:
        if not channels:
            channels = [s['channel'] for s in twitch_streams(games, langs, 25, api)]
        rng = '24hr' if hours <= 24 else '7d' if hours <= 24 * 7 else '30d'
        for ch in channels:
            try:
                pl = ytdlp_json(f'https://www.twitch.tv/{ch}/clips?filter=clips&range={rng}',
                                '--flat-playlist', '--playlist-end', '10')
            except RuntimeError as e:
                log(f'  {ch}: клипы не получены ({str(e)[:120]})')
                continue
            for e in pl.get('entries') or []:
                if e.get('timestamp') and e['timestamp'] < since.timestamp():
                    continue
                if langs and e.get('language') and e['language'] not in langs:
                    continue
                out.append({'url': e['url'], 'title': e.get('title') or '', 'channel': ch,
                            'views': e.get('view_count') or 0, 'duration': e.get('duration') or 0,
                            'created': e.get('timestamp'), 'lang': e.get('language') or ''})
    out.sort(key=lambda c: -c['views'])
    return out[:limit]


def twitch_vods(channel, n=1, api=None):
    """Latest finished broadcasts of a channel."""
    api = api if api is not None else helix()
    if api:
        u = api.get('users', login=channel).get('data') or []
        if not u:
            return []
        vids = api.pages('videos', n, user_id=u[0]['id'], type='archive')
        return [{'url': v['url'], 'title': v['title'], 'duration': v['duration'], 'created': v['created_at']}
                for v in vids]
    pl = ytdlp_json(f'https://www.twitch.tv/{channel}/videos?filter=archives&sort=time',
                    '--flat-playlist', '--playlist-end', str(n))
    return [{'url': e['url'], 'title': e.get('title') or '', 'duration': e.get('duration'),
             'created': e.get('timestamp')} for e in pl.get('entries') or []]


def youtube_live(query='GTA 6', lang='', limit=30, keys=None):
    """Live YouTube streams for the query, most concurrent viewers first."""
    keys = keys if keys is not None else load_keys()
    rows = []
    if keys.get('YOUTUBE_API_KEY'):
        k = keys['YOUTUBE_API_KEY']
        q = {'part': 'snippet', 'type': 'video', 'eventType': 'live', 'q': query, 'order': 'viewCount',
             'maxResults': min(50, limit), 'key': k}
        if lang:
            q['relevanceLanguage'] = lang
        items = http_json('https://www.googleapis.com/youtube/v3/search?' + urllib.parse.urlencode(q)).get('items', [])
        ids = [i['id']['videoId'] for i in items]
        if ids:
            v = http_json('https://www.googleapis.com/youtube/v3/videos?' + urllib.parse.urlencode(
                {'part': 'snippet,liveStreamingDetails', 'id': ','.join(ids), 'key': k}))
            for it in v.get('items', []):
                sn, ls = it['snippet'], it.get('liveStreamingDetails') or {}
                rows.append({'platform': 'youtube', 'channel': sn['channelTitle'], 'name': sn['channelTitle'],
                             'viewers': int(ls.get('concurrentViewers') or 0), 'title': sn['title'],
                             'lang': sn.get('defaultAudioLanguage') or sn.get('defaultLanguage') or '',
                             'game': query, 'started': ls.get('actualStartTime', ''),
                             'url': f'https://www.youtube.com/watch?v={it["id"]}'})
    else:
        url = 'https://www.youtube.com/results?' + urllib.parse.urlencode({'search_query': query, 'sp': 'EgJAAQ=='})
        try:
            pl = ytdlp_json(url, '--flat-playlist', '--playlist-end', str(limit))
        except RuntimeError as e:
            log(f'  YouTube не ответил: {str(e)[:200]}')
            return []
        for e in pl.get('entries') or []:
            if e.get('ie_key') not in (None, 'Youtube') or not e.get('id'):
                continue
            rows.append({'platform': 'youtube', 'channel': e.get('channel') or e.get('uploader') or '',
                         'name': e.get('channel') or '', 'viewers': e.get('concurrent_view_count') or 0,
                         'title': e.get('title') or '', 'lang': '', 'game': query, 'started': '',
                         'url': e.get('url') or f'https://www.youtube.com/watch?v={e["id"]}'})
    rows.sort(key=lambda r: -r['viewers'])
    return rows[:limit]
