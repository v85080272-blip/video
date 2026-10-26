"""Word timing for captions: syllable-proportional inside voiced segments of each line's WAV."""
import re, wave
import numpy as np

VOWELS = set('аеёиоуыэюяАЕЁИОУЫЭЮЯaeiouyAEIOUY')


def syllables(spoken):
    n = sum(1 for ch in spoken if ch in VOWELS)
    return max(n, 1)


def read_wav_mono(path):
    with wave.open(path, 'rb') as w:
        sr, n, ch, sw = w.getframerate(), w.getnframes(), w.getnchannels(), w.getsampwidth()
        raw = w.readframes(n)
    if sw == 2:
        a = np.frombuffer(raw, np.int16).astype(np.float32) / 32768
    elif sw == 3:
        b = np.frombuffer(raw, np.uint8).reshape(-1, 3)
        a = (b[:, 0].astype(np.int32) | (b[:, 1].astype(np.int32) << 8) | (b[:, 2].astype(np.int32) << 16))
        a = np.where(a >= 2 ** 23, a - 2 ** 24, a).astype(np.float32) / 2 ** 23
    else:
        a = np.frombuffer(raw, np.int32).astype(np.float32) / 2 ** 31
    if ch > 1:
        a = a.reshape(-1, ch).mean(axis=1)
    return a, sr


def voiced_segments(a, sr, win=0.02, thr_db=-38, min_gap=0.16, min_seg=0.08):
    hop = int(sr * win)
    n = len(a) // hop
    rms = np.sqrt(np.mean(a[:n * hop].reshape(n, hop) ** 2, axis=1) + 1e-12)
    db = 20 * np.log10(rms + 1e-9)
    ref = np.percentile(db, 95)
    on = db > ref + thr_db + 12  # relative to loud speech
    segs = []
    i = 0
    while i < n:
        if on[i]:
            j = i
            while j < n and on[j]:
                j += 1
            segs.append([i * win, j * win])
            i = j
        else:
            i += 1
    merged = []
    for s in segs:
        if merged and s[0] - merged[-1][1] < min_gap:
            merged[-1][1] = s[1]
        else:
            merged.append(s)
    return [s for s in merged if s[1] - s[0] >= min_seg]


def parse_display(display):
    """'В 1908{тысяча девятьсот восьмом} ГОДУ,' -> list of (shown_word, spoken_text, punct_after)"""
    toks = re.findall(r'(\S+?\{[^}]*\}\S*|\S+)', display)
    out = []
    for t in toks:
        m = re.match(r'^(.*?)\{([^}]*)\}(.*)$', t)
        if m:
            shown = m.group(1) + m.group(3)
            spoken = m.group(2)
        else:
            shown = t
            spoken = t
        punct = bool(re.search(r'[.,!?:;—…]$', shown)) or shown == '—'
        out.append((shown, spoken, punct))
    return out


def word_times(display, wav_path):
    """Return [(shown_word, t_start, t_end)] relative to the WAV start."""
    a, sr = read_wav_mono(wav_path)
    words = parse_display(display)
    segs = voiced_segments(a, sr)
    if not segs:
        segs = [[0.0, len(a) / sr]]
    # phrases split on punctuation
    phrases = []
    cur = []
    for w in words:
        cur.append(w)
        if w[2]:
            phrases.append(cur)
            cur = []
    if cur:
        phrases.append(cur)
    total_syl = sum(syllables(w[1]) for w in words if w[0] != '—')
    # map phrases to segments when counts allow, else spread over the whole voiced span
    res = []
    if len(segs) >= len(phrases) > 1:
        # merge extra segments: keep the len(phrases)-1 largest gaps as phrase boundaries
        gaps = sorted(range(len(segs) - 1), key=lambda k: segs[k + 1][0] - segs[k][1], reverse=True)[:len(phrases) - 1]
        gaps = sorted(gaps)
        groups = []
        start = 0
        for g in gaps:
            groups.append([segs[start][0], segs[g][1]])
            start = g + 1
        groups.append([segs[start][0], segs[-1][1]])
        spans = list(zip(phrases, groups))
    else:
        spans = [(words, [segs[0][0], segs[-1][1]])]
    for ph, (s0, s1) in spans:
        syl = [0 if w[0] == '—' else syllables(w[1]) for w in ph]
        tot = max(sum(syl), 1)
        t = s0
        for w, sy in zip(ph, syl):
            d = (s1 - s0) * sy / tot
            res.append((w[0], t, t + d))
            t += d
    return res


# short words that belong to the next word: a chunk never ends on them ("без | сил" -> "без сил")
STICKY = {'В', 'ВО', 'С', 'СО', 'К', 'КО', 'О', 'ОБ', 'ОТ', 'ДО', 'НА', 'ПО', 'ЗА', 'ИЗ', 'У', 'ДЛЯ', 'БЕЗ', 'ПРИ',
          'ПРО', 'ПОД', 'НАД', 'И', 'А', 'НО', 'НЕ', 'НИ', 'КАК', 'ЕЩЁ', 'ЕЩЕ'}


def chunk(words_t, max_words=3, max_chars=16):
    """Group timed words into caption chunks; break after punctuation."""
    chunks = []
    cur = []
    for w in words_t:
        if w[0] == '—':                 # a dash ends the chunk ("третий —" | "пока не падает")
            if cur:
                chunks.append(cur)
                cur = []
            continue
        cand = cur + [w]
        text = ' '.join(x[0] for x in cand)
        if cur and (len(cand) > max_words or len(text) > max_chars):
            if cur[-1][0].upper() not in STICKY:
                chunks.append(cur)
                cur = [w]
            elif len(cur) > 1:          # carry the hanging preposition over to the next chunk
                chunks.append(cur[:-1])
                cur = [cur[-1], w]
            else:
                cur = cand
        else:
            cur = cand
        if re.search(r'[.,!?:;…]$', w[0]):
            chunks.append(cur)
            cur = []
    if cur:
        chunks.append(cur)
    return chunks


def _norm(w):
    return re.sub(r'[^0-9a-zа-я]', '', w.lower().replace('ё', 'е'))


def word_times_manifest(display, script_words, speed=1.0):
    """Use the recogniser's word timings (voice manifest) instead of the syllable estimate.
    script_words: [{'word','start','end'}] for the line as spoken; numbers are spelled out there.
    Returns [(shown_word, t_start, t_end)] in the time base of the sped-up WAV, or None if the words do not line up."""
    sw = [w for w in script_words if _norm(w['word'])]
    out, i = [], 0
    for shown, spoken, _ in parse_display(display):
        if shown == '—':                # keep the dash as a zero-length marker so captions can break there
            if out:
                out.append(('—', out[-1][2], out[-1][2]))
            continue
        need = [_norm(x) for x in spoken.split() if _norm(x)]
        got = sw[i:i + len(need)]
        if len(got) != len(need) or [_norm(g['word']) for g in got] != need:
            return None
        out.append((shown, got[0]['start'] / speed, got[-1]['end'] / speed))
        i += len(need)
    return out if i == len(sw) else None
