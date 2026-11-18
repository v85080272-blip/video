"""Speech to word timings (faster-whisper) and the ASS file with big word-by-word subtitles, title and credit."""
import re

from common import FONT_NAME, log

# phrases Whisper invents on music and noise in Russian videos
HALLUCINATIONS = re.compile(r'субтитр|dimatorzok|редактор|корректор|продолжение следует|подписывайтесь на канал|'
                            r'спасибо за просмотр|синецкая|егорова|amara\.org', re.I)

MAT = re.compile(r'^(?:за|на|по|от|вы|у|при|до|раз|рас|недо|пере|съ|въ|подъ|объ|о)?'
                 r'(?:ху[йеёяи]|пизд|бля|еба|ебн|еби|ебу|ёб|сук[аи]|суч|пид[оа]р|мудак|мудил|залуп|fuck|shit|bitch)',
                 re.I)

_model = None
_broken = False


def transcribe(wav, model='small', lang=None):
    """[{'start', 'end', 'word'}] for the speech in wav."""
    global _model, _broken
    if _broken:
        return []
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        _broken = True
        log('  субтитры пропущены: нет faster-whisper (pip install -r clips/requirements.txt)')
        return []
    try:
        if _model is None or _model[0] != model:
            log(f'  Whisper {model}: загрузка (первый раз скачивается с Hugging Face)')
            _model = (model, WhisperModel(model, device='auto', compute_type='int8'))
        segs, _info = _model[1].transcribe(wav, language=lang or None, word_timestamps=True, vad_filter=True,
                                           beam_size=5, condition_on_previous_text=False)
        segs = list(segs)
    except Exception as e:      # no model, no network: the clip is still worth making
        _broken = True
        log(f'  субтитры пропущены: Whisper не запустился ({str(e)[:160]})')
        return []
    words = []
    for s in segs:
        if HALLUCINATIONS.search(s.text) or (s.no_speech_prob > 0.6 and s.avg_logprob < -1.0):
            continue
        for w in s.words or []:
            t = w.word.strip()
            if t and w.probability > 0.15:
                words.append({'start': float(w.start), 'end': float(w.end), 'word': t})
    return words


def censor(word):
    core = re.sub(r'[^\w]', '', word)
    if len(core) >= 3 and MAT.match(core):
        masked = core[0] + '*' * (len(core) - 2) + core[-1]
        return word.replace(core, masked)
    return word


def groups(words, max_words=3, max_chars=16, gap=0.45):
    out, cur = [], []
    for w in words:
        if cur and (len(cur) >= max_words or w['start'] - cur[-1]['end'] > gap
                    or len(' '.join(x['word'] for x in cur + [w])) > max_chars
                    or re.search(r'[.!?…]$', cur[-1]['word'])):
            out.append(cur)
            cur = []
        cur.append(w)
    if cur:
        out.append(cur)
    return out


def _ts(t):
    t = max(0.0, t)
    cs = int(round(t * 100))
    return f'{cs // 360000}:{cs // 6000 % 60:02d}:{cs // 100 % 60:02d}.{cs % 100:02d}'


def _esc(s):
    return s.replace('\\', '').replace('{', '(').replace('}', ')').replace('\n', ' ')


def _clean(w):
    w = re.sub(r'[,;:]+$', '', w)
    w = re.sub(r'\.+$', '', w)
    return w.upper()


HEADER = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,{FONT_NAME},96,&H00FFFFFF,&H00FFFFFF,&H00000000,&H99000000,0,0,0,0,100,100,1,0,1,8,4,5,50,50,0,1
Style: Title,{FONT_NAME},66,&H00000000,&H00000000,&H00FFFFFF,&H66000000,0,0,0,0,100,100,0,0,3,22,0,8,90,90,0,1
Style: Credit,{FONT_NAME},38,&H30FFFFFF,&H30FFFFFF,&H90000000,&H00000000,0,0,0,0,100,100,1,0,1,3,0,5,40,40,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

HIGHLIGHT = '&H0000E1FF&'     # yellow, ASS colours are BGR


def build(words, dur, pos, title='', title_secs=None, credit='', mat=False):
    """ASS text. pos: {'sub_y', 'title_y', 'credit_y'} in 1080x1920 pixels."""
    ev = []
    sub_y, credit_y = pos['sub_y'], pos['credit_y']
    if title:
        end = min(dur, title_secs) if title_secs else dur
        if end >= dur * 0.5:
            sub_y = pos.get('sub_y_title', sub_y)
            credit_y = pos.get('credit_y_title', credit_y)
        t = re.sub(r'\b(GTA|ГТА)\s+(\d+|VI|V)\b', r'\1\\h\2', _esc(title), flags=re.I)   # keep "GTA 6" on one line
        ev.append(f'Dialogue: 2,{_ts(0)},{_ts(end)},Title,,0,0,0,,{{\\an5\\pos(540,{pos["title_y"]})}}{t}')
    if credit:
        ev.append(f'Dialogue: 1,{_ts(0)},{_ts(dur)},Credit,,0,0,0,,{{\\an5\\pos(540,{credit_y})}}{_esc(credit)}')
    gs = groups(words)
    for gi, g in enumerate(gs):
        texts = [_esc(_clean(censor(w['word']) if mat else w['word'])) for w in g]
        g_end = g[-1]['end'] + 0.25
        if gi + 1 < len(gs):
            g_end = min(g_end, gs[gi + 1][0]['start'])
        g_end = min(g_end, dur)
        for i, w in enumerate(g):
            a = g[0]['start'] if i == 0 else w['start']
            b = g[i + 1]['start'] if i + 1 < len(g) else g_end
            if b <= a or a >= dur:
                continue
            line = ' '.join(f'{{\\c{HIGHLIGHT}}}{t}{{\\c&H00FFFFFF&}}' if j == i else t for j, t in enumerate(texts))
            pop = '\\fscx72\\fscy72\\t(0,90,\\fscx100\\fscy100)' if i == 0 else ''
            ev.append(f'Dialogue: 0,{_ts(a)},{_ts(b)},Sub,,0,0,0,,{{\\an5\\pos(540,{sub_y}){pop}}}{line}')
    return HEADER + '\n'.join(ev) + '\n'
