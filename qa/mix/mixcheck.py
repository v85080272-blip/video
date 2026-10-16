# Checks of a finished clip's sound: loudness and peaks, clipping and clicks, stereo, how speech and pauses
# sit on the timeline (start, gaps, tail), whether the music is there under the voice and at what level,
# whether it drops out or stops dead at the end. Speech spans come from the stress check's alignment
# (words of the script) or from Whisper's words; without either, only the level checks run.
import json, re, subprocess
import numpy as np

SR = 48000
ERR, WARN, INFO = 'ошибка', 'внимание', 'инфо'


def probe(path):
    r = subprocess.run(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', path],
                       capture_output=True, text=True, check=True)
    d = json.loads(r.stdout)
    v = next((s for s in d['streams'] if s['codec_type'] == 'video'), None)
    a = next((s for s in d['streams'] if s['codec_type'] == 'audio'), None)
    dur = lambda s: float(s['duration']) if s and s.get('duration') not in (None, 'N/A') else None
    return dict(duration=float(d['format'].get('duration', 0) or 0),
                video=v and dict(w=v['width'], h=v['height'], fps=v.get('avg_frame_rate'), duration=dur(v), codec=v['codec_name']),
                audio=a and dict(sr=int(a['sample_rate']), channels=a['channels'], duration=dur(a), codec=a['codec_name']))


def decode(path, sr=SR):
    """Stereo float32 (n, 2) at sr; a mono file comes back as two equal channels."""
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-nostdin', '-i', path, '-vn', '-ac', '2', '-ar', str(sr),
                          '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).copy()


def loudness(path):
    """EBU R128 via ffmpeg: integrated LUFS, loudness range, true peak."""
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-nostdin', '-i', path, '-vn', '-af', 'ebur128=peak=true',
                        '-f', 'null', '-'], capture_output=True, text=True)
    s = r.stderr[r.stderr.rfind('Summary:'):]
    num = lambda key: float(re.search(key + r':\s+(-?[\d.]+|-inf)', s).group(1).replace('-inf', '-200'))
    try:
        return dict(lufs=num('I'), lra=num('LRA'), true_peak=num('Peak'))
    except AttributeError:
        return dict(lufs=None, lra=None, true_peak=None)


def db(x):
    return 10 * np.log10(np.mean(np.square(x)) + 1e-12) if len(x) else -120.0


def env_db(mono, sr=SR, hop=0.05, win=0.05):
    """RMS level in dBFS per 50 ms."""
    h, n = int(sr * hop), int(sr * win)
    k = max(1, (len(mono) - n) // h + 1)
    fr = np.lib.stride_tricks.sliding_window_view(mono[:max(n, (k - 1) * h + n)], n)[::h][:k]
    return 10 * np.log10(np.mean(fr ** 2, axis=1) + 1e-12)


def clipping(x):
    """Runs of 3+ samples at full scale (real clipping, not a single hot sample)."""
    hot = np.abs(x).max(1) >= 0.999
    if not hot.any():
        return []
    d = np.diff(np.concatenate([[0], hot.astype(np.int8), [0]]))
    a, b = np.where(d == 1)[0], np.where(d == -1)[0]
    return [(s / SR, (e - s)) for s, e in zip(a, b) if e - s >= 3]


def clicks(mono, sr=SR, limit=8):
    """Sample-to-sample jumps far above the local signal: splices without a fade, sounds cut off mid-wave, pops.
    A jump into a much louder sound is the attack of a hit or a word, not a click, so it is skipped."""
    d = np.abs(np.diff(mono))
    w = int(0.01 * sr)
    k = len(d) // w
    if k < 3:
        return []
    blocks = d[:k * w].reshape(k, w)
    med = np.median(blocks, axis=1)
    peak = blocks.max(axis=1)
    out = []
    for i in np.where((peak > 0.15) & (peak > 25 * (med + 1e-4)))[0]:
        j = i * w + int(blocks[i].argmax())
        seg = d[max(0, j - 48):j + 48]
        if (seg > 0.5 * d[j]).sum() > 2:          # drums and plosives jump again and again; a click is isolated
            continue
        before = np.sqrt(np.mean(mono[max(0, j - w):j] ** 2)) + 1e-6
        after = np.sqrt(np.mean(mono[j + 2:j + 2 + w] ** 2)) + 1e-6
        if after > 1.8 * before:                  # attack of a new sound
            continue
        out.append(j / sr)
    merged = []
    for t in out:
        if not merged or t - merged[-1] > 0.2:
            merged.append(t)
    return merged[:limit]


def merge_spans(spans, gap=0.12):
    """Word spans -> speech segments (words closer than gap are one segment)."""
    spans = sorted(s for s in spans if s)
    out = []
    for a, b in spans:
        if out and a - out[-1][1] <= gap:
            out[-1][1] = max(out[-1][1], b)
        else:
            out.append([a, b])
    return out


def check_mix(path, speech=None, findings=None, music_expected=None, dialog=False):
    """path: the clip; speech: [(start, end)] of words or None; dialog: a scene with characters, where pauses
    between lines are part of the action. Returns (metrics, findings)."""
    F = findings if findings is not None else []
    add = lambda lvl, code, msg, t=None: F.append(dict(level=lvl, code=code, msg=msg, t=t))
    info = probe(path)
    M = dict(probe=info)
    if not info['audio']:
        add(ERR, 'no_audio', 'В файле нет звуковой дорожки.')
        return M, F
    vd = (info['video'] or {}).get('duration') or info['duration']
    ad = info['audio']['duration'] or info['duration']
    M['video_s'], M['audio_s'] = vd, ad
    if info['video'] and vd and ad and ad < vd - 0.15:
        add(WARN, 'audio_short', f'Звук короче видео на {vd - ad:.1f} с: в конце тишина.', ad)
    if info['video'] and (info['video']['w'], info['video']['h']) != (1080, 1920):
        add(INFO, 'not_vertical_hd', f"Кадр {info['video']['w']}×{info['video']['h']}, для коротких роликов обычно 1080×1920.")
    if vd and vd > 90:
        add(INFO, 'long', f'Ролик {vd:.0f} с: Reels длиннее 90 с показывают реже, Shorts до 3 минут.')
    x = decode(path)
    mono = x.mean(1)
    L = loudness(path)
    M.update(L)
    if L['lufs'] is not None:
        if L['lufs'] < -16.5 or L['lufs'] > -12.0:
            add(WARN, 'loudness', f"Громкость {L['lufs']:.1f} LUFS, для YouTube, Instagram и TikTok нужно около −14 "
                                  f"(тише: площадка не прибавит, громче: убавит и сожмёт).")
        if L['true_peak'] > 0.0:
            add(ERR, 'true_peak', f"Пик {L['true_peak']:+.1f} dBTP: выше нуля, после сжатия площадкой будут искажения.")
        elif L['true_peak'] > -0.3:
            add(WARN, 'true_peak', f"Пик {L['true_peak']:+.1f} dBTP, нужен запас до −1 dBTP.")
        elif L['true_peak'] > -1.0:
            add(INFO, 'true_peak', f"Пик {L['true_peak']:+.1f} dBTP, чуть выше −1 dBTP (обычно это добавляет сжатие AAC).")
    cl = clipping(x)
    if cl:
        add(ERR, 'clipping', f'Перегруз (срезанные пики) в {len(cl)} местах, первое на {cl[0][0]:.2f} с.', cl[0][0])
    M['clipping'] = len(cl)
    ck = clicks(mono)
    for t in ck[:3]:
        add(WARN, 'click', f'Щелчок на {t:.2f} с: склейка без плавного перехода или обрыв звука.', t)
    M['clicks'] = ck
    # stereo
    l, r = x[:, 0], x[:, 1]
    dl, dr = db(l), db(r)
    if min(dl, dr) < -60 < max(dl, dr):
        add(ERR, 'one_channel', 'Один канал стерео пустой: в наушниках звук только с одной стороны.')
    elif np.std(l) > 1e-4 and np.std(r) > 1e-4:
        c = float(np.corrcoef(l, r)[0, 1])
        M['stereo_corr'] = c
        if c < -0.3:
            add(ERR, 'phase', 'Каналы в противофазе: на телефоне (моно) звук почти пропадает.')
    E = env_db(mono)
    hop = 0.05
    t_end = len(mono) / SR
    # dead air: the whole mix drops out inside the clip
    quiet = E < -55
    runs = _runs(quiet)
    for a, b in runs:
        ta, tb = a * hop, b * hop
        if tb - ta >= 0.7 and ta > 0.3 and tb < t_end - 0.3:
            add(WARN, 'silence', f'Полная тишина {tb - ta:.1f} с ({ta:.1f}–{tb:.1f} с): звук пропадает.', ta)
    if len(E) > 4:
        lead = next((i for i, v in enumerate(E) if v > -45), len(E)) * hop
        M['sound_start_s'] = lead
        if lead > 0.5:
            add(WARN, 'late_start', f'Звук начинается только через {lead:.1f} с после начала ролика.', 0.0)
        tail = E[-max(1, int(0.1 / hop)):]
        before = E[max(0, len(E) - int(0.4 / hop)):max(1, len(E) - int(0.25 / hop))]     # a fade shows by here
        M['last_100ms_db'], M['fade_db'] = float(tail.max()), float(before.max() - tail.max())
        if tail.max() > max(-40.0, float(np.median(E)) - 20) and before.max() - tail.max() < 6:
            add(WARN, 'abrupt_end', f'Звук обрывается на последнем кадре на уровне {tail.max():.0f} dBFS: '
                                    f'в конце нет затухания (нужно 0,5–1 с).', t_end - 0.1)
        sound_end = (len(E) - next((i for i, v in enumerate(E[::-1]) if v > -45), len(E))) * hop
        M['sound_end_s'] = sound_end
        if t_end - sound_end > 1.5:
            add(INFO, 'quiet_tail', f'Последние {t_end - sound_end:.1f} с без звука.', sound_end)
    if speech:
        _speech_checks(mono, E, hop, merge_spans(speech), t_end, M, add, music_expected, dialog)
    return M, F


def _runs(mask):
    d = np.diff(np.concatenate([[0], mask.astype(np.int8), [0]]))
    return list(zip(np.where(d == 1)[0], np.where(d == -1)[0]))


def _speech_checks(mono, E, hop, segs, t_end, M, add, music_expected, dialog=False):
    first, last = segs[0][0], segs[-1][1]
    M['speech_start_s'], M['speech_end_s'] = first, last
    if first > 1.0:
        add(WARN, 'hook_late', f'Голос вступает только на {first:.1f} с: первые секунды решают, досмотрят ли ролик.', 0.0)
    if t_end - last < 0.25:
        add(WARN, 'tail_short', f'После последнего слова {max(0.0, t_end - last):.2f} с: слово может обрезаться.', last)
    elif t_end - last > 4.0:
        add(INFO, 'tail_long', f'После последнего слова ещё {t_end - last:.1f} с.', last)
    gaps = [(a[1], b[0]) for a, b in zip(segs, segs[1:])]
    M['pauses'] = [round(b - a, 2) for a, b in gaps if b - a >= 0.3]
    # narration should flow; in a dialogue scene a beat between lines is normal, only a long stretch stands out
    for a, b in gaps:
        if b - a > (4.0 if dialog else 1.6):
            add(WARN, 'long_pause', f'Пауза {b - a:.1f} с между словами ({a:.1f}–{b:.1f} с).', a)
    # voice level vs the music bed in pauses: the bed is what plays where nobody speaks
    frames = lambda a, b: E[int(a / hop):max(int(a / hop) + 1, int(b / hop))]
    voice = np.concatenate([frames(a, b) for a, b in segs]) if segs else np.array([])
    bed_parts = [frames(a + 0.08, b - 0.08) for a, b in gaps if b - a >= 0.36]
    bed_parts += [frames(0.05, first - 0.08)] if first > 0.4 else []
    bed = np.concatenate(bed_parts) if bed_parts else np.array([])
    if len(voice):
        v = float(np.percentile(voice, 75))
        M['voice_db'] = v
        if len(bed) >= 6:
            m = float(np.median(bed))
            M['bed_db'] = m
            M['voice_over_bed_db'] = v - m
            if m < -50:
                lvl = WARN if music_expected else INFO
                add(lvl, 'no_music', 'В паузах между фразами тишина: музыки под голосом нет или она пропадает в паузах.')
            elif v - m < 4:
                # in a cartoon the music and effects swell between lines on purpose: worth a listen, not a stop
                add(WARN if dialog else ERR, 'music_loud',
                    f'Музыка в паузах почти так же громка, как голос (разница {v - m:.0f} дБ): '
                    f'если под голосом она не приглушается, слова тонут.')
            elif v - m < 8:
                add(WARN, 'music_loud', f'Музыка в паузах всего на {v - m:.0f} дБ тише голоса (обычно 10–15 дБ): '
                                        f'если под голосом она не приглушается, слова тонут.')
            elif v - m > 28:
                add(INFO, 'music_quiet', f'Музыка тише голоса на {v - m:.0f} дБ: её почти не слышно.')
            # the bed should be steady: a pause where it suddenly falls away reads as a hole
            for a, b in gaps:
                if b - a >= 0.6:
                    g = frames(a + 0.1, b - 0.1)
                    if len(g) and np.median(g) < m - 15 and m > -50:
                        add(WARN, 'music_hole', f'В паузе {a:.1f}–{b:.1f} с музыка проваливается на {m - np.median(g):.0f} дБ.', a)
        elif music_expected:
            add(INFO, 'bed_unknown', 'Пауз почти нет, уровень музыки под голосом не измерить.')
