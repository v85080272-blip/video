# Narrator helpers on top of shorts/voxcpm2/tools (aud.py, gen.py):
#  - one whisper.cpp pass per take giving the transcript AND word timestamps (DTW, flash-attn off),
#  - CER against several spellings of the same line (whisper writes numbers as digits),
#  - extra take metrics: pitch movement in semitones, noise floor, reverb tail, timbre steadiness, pace,
#  - syllable nuclei of one word (duration / loudness / pitch per vowel) to check word stress.
import json, os, re, subprocess, sys, tempfile
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
TOOLS = os.path.join(HERE, '..', 'shorts', 'voxcpm2', 'tools')
sys.path.insert(0, TOOLS)
os.environ.setdefault('VOX_HOME', os.path.join(HERE, '..', 'vox'))
import aud  # noqa: E402

THREADS = os.environ.get('WHISPER_THREADS', '2')
VOW = 'аеёиоуыэюя'
CG = '/sys/fs/cgroup/memory/process_api/01a1366a-e5e1-716f-98df-7640a8c9001e/claude-code-bash'
try:                                    # if the shared cgroup runs out, the kernel should kill us, not sd-cli
    open('/proc/self/oom_score_adj', 'w').write('900')
except OSError:
    pass


def headroom_mb():
    """Free room in the memory cgroup shared by all Bash-launched processes (sd-cli too): limit - rss - shmem."""
    try:
        lim = int(open(os.path.join(CG, 'memory.limit_in_bytes')).read())
        st = dict(l.split() for l in open(os.path.join(CG, 'memory.stat')))
        return (lim - int(st['total_rss']) - int(st['total_shmem'])) // 2 ** 20
    except OSError:
        return 99999


def avail_mb():
    for l in open('/proc/meminfo'):
        if l.startswith('MemAvailable:'):
            return int(l.split()[1]) // 1024
    return 99999


def wait_mem(need_mb, what=''):
    import time
    while True:
        h, a = headroom_mb(), avail_mb()
        if h >= need_mb and a >= need_mb:
            return
        print(f'   waiting for memory for {what}: cgroup headroom {h} MB, available {a} MB, need {need_mb}', flush=True)
        time.sleep(30)


def tts(gen, *a, **k):
    """gen.tts with retries: if the server was killed (OOM) the supervisor restarts it after its memory check."""
    import time
    for attempt in range(20):
        try:
            return gen.tts(*a, **k)
        except Exception as e:  # connection refused / reset while the server restarts
            print(f'   tts failed ({e.__class__.__name__}: {e}); waiting for the server', flush=True)
            time.sleep(10)
            while not gen.ready():
                time.sleep(10)
    raise RuntimeError('TTS server keeps failing')


def to16k(path, dst):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', path, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', dst], check=True)


def whisper(path, prompt=None):
    """Transcript + tokens (t0/t1 heuristic, tdtw = DTW end time of the token, seconds)."""
    with tempfile.TemporaryDirectory() as td:
        w = os.path.join(td, 'a.wav')
        to16k(path, w)
        cmd = [aud.WHISPER, '-m', aud.WMODEL, '-l', 'ru', '-f', w, '-np', '-t', THREADS,
               '-nfa', '-dtw', 'large.v3.turbo', '-ojf', '-of', os.path.join(td, 'o')]
        if prompt:
            cmd += ['--prompt', prompt]
        for attempt in range(10):
            wait_mem(1800, 'whisper')
            r = subprocess.run(['choom', '-n', '1000', '--'] + cmd, capture_output=True, text=True)
            if r.returncode == 0:
                break
            print(f'   whisper failed with code {r.returncode}, retrying', flush=True)
        else:
            raise RuntimeError(r.stderr[-2000:])
        d = json.load(open(os.path.join(td, 'o.json')))
    toks, texts = [], []
    for seg in d['transcription']:
        texts.append(seg['text'])
        for t in seg['tokens']:
            if t['text'].startswith('[_'):
                continue
            toks.append(dict(text=t['text'], t0=t['offsets']['from'] / 1000, t1=t['offsets']['to'] / 1000,
                             tdtw=(t['t_dtw'] / 100 if t.get('t_dtw', -1) >= 0 else None), p=round(float(t['p']), 3)))
    return ' '.join(' '.join(texts).split()), toks


def words_from_tokens(toks):
    """Group BPE tokens into words; end = DTW time of the word's last letter token."""
    words = []
    for t in toks:
        s = t['text']
        letters = re.sub(r'[^\wёЁ-]', '', s)
        if s.startswith(' ') or not words:
            if not letters:                         # stand-alone punctuation / dash
                if words:
                    words[-1]['punct'] = words[-1].get('punct', '') + s.strip()
                continue
            words.append(dict(word=s.strip(), toks=[t]))
        else:
            if letters:
                words[-1]['word'] += s
                words[-1]['toks'].append(t)
            else:
                words[-1]['punct'] = words[-1].get('punct', '') + s.strip()
                words[-1]['word'] += s
    out, prev_end = [], 0.0
    for w in words:
        lt = [t for t in w['toks'] if re.sub(r'[^\wёЁ]', '', t['text'])]
        end = lt[-1]['tdtw'] if lt and lt[-1]['tdtw'] is not None else lt[-1]['t1']
        out.append(dict(word=w['word'], start=prev_end, end=end,
                        p=round(float(np.prod([t['p'] for t in w['toks']])), 3)))
        prev_end = end
    return out


def refine_words(words, x, sr, thr_rel=-40.0, hop=0.01, min_pause=0.12):
    """Word times from DTW, anchored to the audio: every pause (>= min_pause below max-40 dB) is snapped to the
    nearest word boundary (previous word ends where the pause starts, next word starts where it ends);
    the first word starts at the speech onset, the last ends at the speech offset."""
    if not words:
        return []
    n = int(sr * hop)
    m = len(x) // n
    db = 10 * np.log10((x[:m * n].reshape(m, n) ** 2).mean(1) + 1e-12)
    loud = db > db.max() + thr_rel
    on = np.where(loud)[0]
    first, last = (on[0] * hop, (on[-1] + 1) * hop) if len(on) else (0.0, len(x) / sr)
    pauses, i = [], on[0] if len(on) else 0
    while i < (on[-1] if len(on) else 0):
        if not loud[i]:
            j = i
            while j < m and not loud[j]:
                j += 1
            if (j - i) * hop >= min_pause:
                pauses.append((i * hop, j * hop))
            i = j
        else:
            i += 1
    st = [w['start'] for w in words]
    en = [w['end'] for w in words]
    st[0] = first
    en[-1] = max(min(last + 0.03, len(x) / sr), st[-1] + 0.05)
    best = {}
    for ps, pe in pauses:                        # boundary j sits between word j-1 and word j
        mid = (ps + pe) / 2
        cand = [(abs(st[j] - mid), j) for j in range(1, len(words))]
        if not cand:
            break
        d, j = min(cand)
        if d <= 0.8 and (j not in best or (pe - ps) > (best[j][1] - best[j][0])):
            best[j] = (ps, pe)
    for j, (ps, pe) in best.items():
        en[j - 1] = ps + 0.02
        st[j] = pe - 0.02
    res = []
    for k, w in enumerate(words):
        s_, e_ = st[k], en[k]
        if k + 1 < len(words) and (k + 1) not in best:
            e_ = min(e_, st[k + 1]) if st[k + 1] > s_ + 0.05 else e_
        res.append(dict(word=w['word'], start=round(float(s_), 3), end=round(float(max(e_, s_ + 0.05)), 3), p=w['p']))
    for k in range(1, len(res)):                 # keep times monotonic
        if res[k]['start'] < res[k - 1]['start'] + 0.03:
            res[k]['start'] = round(res[k - 1]['start'] + 0.03, 3)
        if res[k - 1]['end'] > res[k]['start'] and (k not in best):
            res[k - 1]['end'] = res[k]['start']
        res[k]['end'] = max(res[k]['end'], round(res[k]['start'] + 0.05, 3))
    return res


def cer_best(refs, hyp):
    refs = refs if isinstance(refs, (list, tuple)) else [refs]
    return min(aud.cer(r, hyp) for r in refs)


def semitones(f0):
    return 12 * np.log2(f0 / np.median(f0))


def extra_metrics(path, text=None):
    x, sr = aud.read_wav(path)
    a, b = aud.trim_bounds(x, sr)
    y = x[a:b]
    st = aud.stats(path)
    f0 = aud.f0_track(y, sr)
    if len(f0) >= 10:
        s = semitones(f0)
        st['f0_range_st'] = round(float(np.percentile(s, 90) - np.percentile(s, 10)), 2)
        st['f0_std_st'] = round(float(np.std(s)), 2)
        d = np.abs(np.diff(s))                                 # octave jumps / jitter of the tracker
        st['f0_jumps'] = int((d > 7).sum())
    db, n = aud.frames_db(y, sr)
    level = 10 * np.log10(np.mean(10 ** (db[db > db.max() - 20] / 10)))
    st['level'] = round(float(level), 1)
    st['noise_floor'] = round(float(np.percentile(db, 5) - level), 1)    # dB below speech level
    # high-band hiss in the quietest 10% of frames (6-12 kHz)
    hop = 960
    fr = np.lib.stride_tricks.sliding_window_view(y, 1920)[::hop] if len(y) > 1920 else y[None, :1920]
    S = np.abs(np.fft.rfft(fr * np.hanning(fr.shape[1]), axis=1)) ** 2
    f = np.fft.rfftfreq(fr.shape[1], 1 / sr)
    e_all = 10 * np.log10(S.sum(1) + 1e-12)
    quiet = e_all < np.percentile(e_all, 10)
    hb = 10 * np.log10(S[:, (f > 6000) & (f < 12000)].sum(1) + 1e-12)
    st['hiss'] = round(float(np.mean(hb[quiet]) - level), 1)
    # reverb tail: after the last loud frame, time to fall from -10 dB to -40 dB under speech level
    dbx, nx = aud.frames_db(x, sr, 0.005)
    lvl = level
    idx = np.where(dbx > lvl - 10)[0]
    if len(idx):
        j = idx[-1]
        k = j
        while k < len(dbx) and dbx[k] > lvl - 40:
            k += 1
        st['tail_ms'] = int((k - j) * 5)
    # timbre steadiness: log-mel LTAS of first vs second half
    h = len(y) // 2
    with tempfile.TemporaryDirectory() as td:
        p1, p2 = os.path.join(td, '1.wav'), os.path.join(td, '2.wav')
        aud.write_wav(p1, y[:h], sr)
        aud.write_wav(p2, y[h:], sr)
        st['timbre_halves'] = round(aud.timbre_sim(p1, p2), 3)
    # clipping and clicks
    st['clip'] = int((np.abs(x) > 0.99).sum())
    dx = np.abs(np.diff(x))
    st['clicks'] = int((dx > 0.5).sum())
    if text:
        nv = len([c for c in text.lower() if c in VOW])
        st['syl'] = nv
        st['syl_per_s'] = round(nv / st['speech'], 2) if st['speech'] else 0
    return st


def syllables(path, t0, t1, nvow, pad=0.03):
    """Vowel nuclei of a word between t0 and t1 (s): per syllable duration, loudness and pitch.
    Envelope: 300-2500 Hz band energy, 5 ms hop; nuclei = the nvow strongest peaks >= 60 ms apart;
    syllable borders = envelope minima between neighbouring peaks."""
    x, sr = aud.read_wav(path)
    a, b = max(0, int((t0 - pad) * sr)), min(len(x), int((t1 + pad) * sr))
    y = x[a:b]
    hop, win = int(0.005 * sr), int(0.025 * sr)
    if len(y) < win * 2:
        return None
    fr = np.lib.stride_tricks.sliding_window_view(y, win)[::hop] * np.hanning(win)
    S = np.abs(np.fft.rfft(fr, axis=1)) ** 2
    f = np.fft.rfftfreq(win, 1 / sr)
    env = 10 * np.log10(S[:, (f > 300) & (f < 2500)].sum(1) + 1e-12)
    k = 5
    env_s = np.convolve(env, np.ones(k) / k, mode='same')
    # f2-ish: share of 1500-3000 Hz in 200-3000 Hz (high for и/е, low for у/о)
    lo = S[:, (f > 200) & (f < 1000)].sum(1)
    hi = S[:, (f > 1500) & (f < 3000)].sum(1)
    hratio = 10 * np.log10((hi + 1e-12) / (lo + 1e-12))
    peaks = [i for i in range(1, len(env_s) - 1) if env_s[i] >= env_s[i - 1] and env_s[i] > env_s[i + 1]]
    peaks.sort(key=lambda i: -env_s[i])
    chosen = []
    for p in peaks:
        if env_s[p] < env_s.max() - 25:
            break
        if all(abs(p - q) * hop / sr >= 0.06 for q in chosen):
            chosen.append(p)
        if len(chosen) == nvow:
            break
    chosen.sort()
    if len(chosen) < nvow:
        return dict(found=len(chosen), need=nvow)
    bounds = [0]
    for p, q in zip(chosen[:-1], chosen[1:]):
        bounds.append(p + int(np.argmin(env_s[p:q + 1])))
    bounds.append(len(env_s) - 1)
    f0 = []
    out = []
    for i, p in enumerate(chosen):
        l, r = bounds[i], bounds[i + 1]
        seg = env_s[l:r + 1]
        core = np.where(seg > env_s[p] - 6)[0]                 # nucleus: within 6 dB of the peak
        nuc = (core[-1] - core[0] + 1) * hop / sr if len(core) else 0
        s0, s1 = a + (l * hop), a + (r * hop + win)
        ff = aud.f0_track(x[s0:s1], sr)
        out.append(dict(t=round((a + p * hop) / sr, 3), syl_ms=int((r - l) * hop / sr * 1000), nucleus_ms=int(nuc * 1000),
                        peak_db=round(float(env_s[p]), 1), f0=(round(float(np.median(ff))) if len(ff) >= 2 else None),
                        hr=round(float(np.mean(hratio[l + core[0]:l + core[-1] + 1])), 1) if len(core) else None))
    return out
