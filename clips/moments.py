"""Find the hottest moments of a long stream.

Three signals, each turned into a robust z-score against its own local baseline:
  voice:   loudness of the voice band (250-3500 Hz) above the level of the last minutes: shouting, screaming, laughter;
  chat:    messages per second (laughs, hype words and "clip" weigh more) above the chat's usual pace,
           moved back by the chat lag;
  heatmap: YouTube "most replayed" graph, when the video has one.
"""
import os
import re
import subprocess

import numpy as np

from chat import weight
from common import hms, log

FRAME = 0.25            # seconds per loudness frame


def loudness(path, start=0.0, dur=None):
    """Voice-band loudness in dB per FRAME seconds."""
    sr = 8000
    cmd = ['ffmpeg', '-v', 'error', '-nostdin']
    if start:
        cmd += ['-ss', str(start)]
    cmd += ['-i', path]
    if dur:
        cmd += ['-t', str(dur)]
    cmd += ['-vn', '-ac', '1', '-ar', str(sr), '-af', 'highpass=f=250,lowpass=f=3500', '-f', 's16le', '-']
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE)
    n = int(sr * FRAME)
    out, rest = [], b''
    while True:
        buf = p.stdout.read(1 << 20)
        if not buf:
            break
        buf = rest + buf
        k = len(buf) // (2 * n) * 2 * n
        x = np.frombuffer(buf[:k], dtype='<i2').astype(np.float32).reshape(-1, n) / 32768.0
        out.append(10 * np.log10(np.mean(x * x, axis=1) + 1e-10))
        rest = buf[k:]
    p.wait()
    if p.returncode:
        raise RuntimeError(f'ffmpeg не прочитал звук из {path}')
    return np.concatenate(out) if out else np.zeros(0, np.float32)


def _roll(x, w, fn):
    """Centred rolling statistic with a window of w samples (edges padded)."""
    from numpy.lib.stride_tricks import sliding_window_view
    w = max(1, int(w)) | 1
    xp = np.pad(x, w // 2, mode='edge')
    step = max(1, w // 15)              # the baseline needs no per-sample precision: sample the window
    v = sliding_window_view(xp, w)[:, ::step]
    return fn(v, axis=1)


def _smooth(x, w):
    w = max(1, int(w))
    return np.convolve(x, np.ones(w) / w, mode='same')


def _z(x):
    med = np.median(x)
    mad = np.median(np.abs(x - med)) * 1.4826 + 1e-6
    return (x - med) / mad


def signals(n, frames=None, chat=None, heatmap=None, lag=5.0):
    """Per-second z-scores {name: array(n)} and the raw values for the explanation."""
    sig, raw = {}, {}
    if frames is not None and len(frames):
        per = int(round(1 / FRAME))
        m = len(frames) // per
        sec = np.percentile(frames[:m * per].reshape(m, per), 90, axis=1)
        sec = np.pad(sec, (0, max(0, n - m)), constant_values=sec.min() if m else -100)[:n]
        loud = _smooth(sec, 2)
        base = _roll(loud, 181, np.median)
        ex = loud - base                        # dB above the usual level of the last minutes
        sig['voice'] = np.clip(_z(ex), -3, 8)
        raw['voice'] = ex
    if chat:
        r = np.zeros(n)
        for t, text in chat:
            i = int(t - lag)
            if 0 <= i < n:
                r[i] += weight(text)
        sm = _smooth(r, 6) * 6                  # weighted messages in ~6 s
        base = _roll(sm, 301, np.median)
        lr = np.log1p(sm) - np.log1p(base)
        sig['chat'] = np.clip(_z(lr), -3, 8)
        raw['chat'] = (sm + 1) / (base + 1)     # how many times busier than usual
    if heatmap:
        h = np.zeros(n)
        for seg in heatmap:
            a, b = int(seg['start_time']), int(min(n, np.ceil(seg['end_time'])))
            h[a:b] = seg['value']
        sig['heat'] = np.clip(_z(h), -3, 8)
        raw['heat'] = h
    return sig, raw


WEIGHTS = {'voice': 1.0, 'chat': 1.3, 'heat': 1.0}


def pick(n, sig, raw, top=8, length=35.0, pre=0.65, skip_start=120, skip_end=30, frames=None, min_start=0.0):
    """Top non-overlapping windows around the score peaks."""
    if not sig:
        raise RuntimeError('нет ни звука, ни чата: искать моменты не по чему')
    score = sum(WEIGHTS[k] * v for k, v in sig.items()) / sum(WEIGHTS[k] for k in sig)
    score = _smooth(score, 4)
    lo, hi = max(min(skip_start, n * 0.1), min_start + length * pre), n - min(skip_end, n * 0.05)
    s = score.copy()
    s[:int(lo)] = -np.inf
    s[int(hi):] = -np.inf
    out = []
    while len(out) < top:
        t = int(np.argmax(s))
        if not np.isfinite(s[t]):
            break
        a = max(0.0, t - length * pre)
        b = min(float(n), a + length)
        a = max(0.0, b - length)
        if frames is not None and len(frames):
            a, b = _snap(frames, a, 2.5), _snap(frames, b, 2.5)
        why = {}
        win = slice(max(0, t - 4), min(n, t + 5))
        if 'chat' in raw:
            why['chat'] = round(float(np.max(raw['chat'][win])), 1)
        if 'voice' in raw:
            why['voice_db'] = round(float(np.max(raw['voice'][win])), 1)
        if 'heat' in raw:
            why['heat'] = round(float(np.max(raw['heat'][win])), 2)
        out.append({'n': len(out) + 1, 'start': round(a, 2), 'end': round(b, 2), 'peak': t,
                    'score': round(float(score[t]), 2), 'why': why})
        s[max(0, int(a - length * 0.5)):int(b + length * 0.5)] = -np.inf
    return out, score


def _snap(frames, t, radius):
    """Move a cut to the quietest frame nearby, so it does not fall in the middle of a word."""
    i0, i1 = int((t - radius) / FRAME), int((t + radius) / FRAME) + 1
    i0, i1 = max(0, i0), min(len(frames), i1)
    if i1 <= i0:
        return t
    seg = _smooth(frames[i0:i1], 2)
    return round((i0 + int(np.argmin(seg))) * FRAME, 2)


def explain(m):
    w = m['why']
    parts = []
    if 'text_score' in m:
        parts.append(f'реакция {m["text_score"]:+.0f}')
    if 'chat' in w:
        parts.append(f'чат ×{w["chat"]:g}')
    if 'voice_db' in w:
        parts.append(f'голос +{w["voice_db"]:.0f} дБ' if w['voice_db'] >= 0 else f'голос {w["voice_db"]:.0f} дБ')
    if 'heat' in w:
        parts.append(f'пересматривают {w["heat"]:.0%}')
    return ', '.join(parts)


def report(moments, title, url_fn):
    lines = [f'# Моменты: {title}', '', '| № | Время | Длина | Почему | Ссылка |', '| --- | --- | --- | --- | --- |']
    for m in moments:
        link = url_fn(m['start'])
        lines.append(f'| {m["n"]} | {hms(m["start"])}–{hms(m["end"])} | {m["end"] - m["start"]:.0f} с | '
                     f'{explain(m)} | {f"[открыть]({link})" if link else ""} |')
    return '\n'.join(lines) + '\n'


def summary(moments):
    for m in moments:
        log(f'  {m["n"]:>2}. {hms(m["start"])}–{hms(m["end"])}  ({explain(m)})')


# what a streamer says when something happens (game characters rarely laugh, swear or ask "что?!")
LAUGH = re.compile(r'(?:а?ха){2,}|(?:х[ае]){2,}|(?:ах){2,}|(?:ха-?){2,}', re.I)
REACT = re.compile(r'\b(?:что|чего|какого|как|офиг\w*|охуе\w*|ахуе\w*|ебать|ёбаный|ебан\w*|жесть|капец|пиздец|'
                   r'нифига|ничего себе|бля\w*|блин|вау|смотри\w*|стой|бежим|давай|нет|да ладно|серьезно|'
                   r'серьёзно|ору|ааа+|ооо+|эээ+|wow|what|bro|omg)\b', re.I)
MAT = re.compile(r'\b\w*(?:ху[йеёяи]|пизд|бля|еба|ёб|ебн)\w*', re.I)


def text_score(text, dur):
    """How much the streamer reacts in this transcript."""
    words = len(text.split())
    if words < 12:                       # music, game noise or silence
        return -3.0
    sc = 3.0 * len(LAUGH.findall(text)) + 1.0 * len(REACT.findall(text)) + 0.8 * min(6, len(MAT.findall(text)))
    sc += 0.6 * (text.count('!') + text.count('?'))
    sc += 0.5 * min(3.5, words / max(dur, 1) )      # lively talk
    return sc


def rerank(audio, moments, keep, model='small', lang='ru', work='.', offset=0.0):
    """Transcribe each candidate and put the ones where the streamer reacts first.
    offset: where `audio` starts in the stream."""
    import subs as S
    wav = os.path.join(work, '_cand.wav')
    for i, m in enumerate(moments, 1):
        dur = m['end'] - m['start']
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', str(max(0.0, m['start'] - offset)), '-t', str(dur),
                        '-i', audio, '-vn',
                        '-ac', '1', '-ar', '16000', wav], check=True)
        words = S.transcribe(wav, model, lang)
        text = ' '.join(w['word'] for w in words)
        m['text'] = text
        m['text_score'] = round(text_score(text, dur), 1)
        log(f'  {i}/{len(moments)} {hms(m["start"])}: {m["text_score"]:+.1f}  {text[:90]}')
    if os.path.exists(wav):
        os.remove(wav)
    for m in moments:
        m['rank'] = m['score'] + 0.5 * m.get('text_score', 0)
    best = sorted(moments, key=lambda m: -m['rank'])[:keep]
    for i, m in enumerate(best, 1):
        m['n'] = i
    return best
