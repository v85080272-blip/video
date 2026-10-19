# Final mix for «Правило №6»: the score, every effect from build/cues.json and a quiet stairwell bed. There is no voice, so
# the score is the reference: an effect's loudest 400 ms (BS.1770 momentary loudness) is held to FX_CAP LU against the
# score around it (or, where the score is quiet or silent, against its integrated loudness − 6), and only the hiss
# (the scare) may jump over it. What rings past the end is folded onto the
# start so the short loops without a seam. Normalised to −14 LUFS under a −2 dBTP ceiling (AAC adds some true peak).
# usage: python3 tools/mix.py build/cues.json build/music.wav build/mix.wav
import json
import sys

import numpy as np
import soundfile as sf
from scipy import signal
from scipy.ndimage import minimum_filter1d

from sfx import SR, amb_stairs, pan
from fx import FX

TARGET_LUFS, CEIL_DBTP = -14.0, -2.0
SFX_DB, BED_LU = 0.0, -22.0
FX_CAP = {'scare': 4.0, 'other': -1.0, 'soft': -5.0}
SCARE = {'hiss'}
SOFT = {'purr', 'blink', 'pre_hit', 'eye_shing', 'creak', 'sniff', 'groan', 'lick'}    # textures that should sit inside the score
TRIM = {'hiss': 8, 'clack': 8, 'grab': 6, 'creak': 10, 'pop_arm': 6, 'thud_small': 6, 'flick': 6, 'purr': 8, 'blink': 6, 'pop_ui': 4,
        'pop_word': 6, 'drip': 14, 'pre_hit': 4, 'deflate': 6, 'step_run': 8, 'whoosh_short': 4, 'step': 1}


def at(t):
    return int(round(t * SR))


def stereo(x):
    x = np.asarray(x, float)
    return pan(x, 0.0) if x.ndim == 1 else x


def place(bus, t, x, gain_db=0.0):
    i = at(t)
    j = min(bus.shape[1], i + x.shape[1])
    if j > i:
        bus[:, i:j] += x[:, :j - i] * 10 ** (gain_db / 20)


def fold(y, n):
    """what rings past sample n goes back onto the start: the end and the start join"""
    out = y[:, :n].copy()
    tail = y[:, n:]
    out[:, :tail.shape[1]] += tail[:, :n]
    return out


# ——— loudness (ITU-R BS.1770-4) and true peak ———
def kweight(x):
    b1, a1 = [1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585]
    b2, a2 = [1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621]
    return signal.lfilter(b2, a2, signal.lfilter(b1, a1, x, axis=-1), axis=-1)


def momentary(x, win=0.4):
    """BS.1770 momentary loudness per sample (window centred), stereo in"""
    p = np.sum(kweight(x) ** 2, axis=0)
    w = int(win * SR)
    return -0.691 + 10 * np.log10(np.convolve(p, np.ones(w) / w, mode='same') + 1e-15)


def loudest(x, win=0.4):
    return float(momentary(x, win).max())


def lufs(x):
    k = kweight(x)
    blk, hop = int(0.4 * SR), int(0.1 * SR)
    z = np.array([np.sum(np.mean(k[:, i:i + blk] ** 2, axis=1)) for i in range(0, k.shape[1] - blk, hop)])
    l = -0.691 + 10 * np.log10(z + 1e-15)
    z1 = z[l > -70]
    rel = -0.691 + 10 * np.log10(np.mean(z1)) - 10
    z2 = z[(l > -70) & (l > rel)]
    return -0.691 + 10 * np.log10(np.mean(z2))


def true_peak_db(x):
    up = signal.resample_poly(x, 4, 1, axis=1)
    return 20 * np.log10(np.max(np.abs(up)) + 1e-12)


def limit(x, ceil_db, look=0.003, rel=0.08):
    """look-ahead peak limiter driven by 4× oversampled peaks"""
    n = x.shape[1]
    up = signal.resample_poly(x, 4, 1, axis=1)
    pk = np.max(np.abs(up), axis=0)
    pk = np.pad(pk, (0, max(0, 4 * n - len(pk))))[:4 * n].reshape(n, 4).max(1)
    need = np.minimum(1.0, 10 ** (ceil_db / 20) / (pk + 1e-12))
    L = int(look * SR)
    ahead = minimum_filter1d(need, size=L + 1, origin=-(L // 2), mode='nearest')
    blk = 16
    m = int(np.ceil(n / blk))
    coarse = np.pad(ahead, (0, m * blk - n), constant_values=1.0).reshape(m, blk).min(1)
    a = np.exp(-blk / SR / rel)
    g = np.empty(m)
    cur = 1.0
    for i, v in enumerate(coarse):
        cur = v if v < cur else a * cur + (1 - a) * v
        g[i] = cur
    g = np.minimum(np.repeat(g, blk)[:n], ahead)
    g = np.convolve(np.concatenate([np.ones(L - 1), g]), np.ones(L) / L, mode='valid')
    return x * g


def main():
    cues_path, music_path, out = sys.argv[1:4]
    D = json.load(open(cues_path))
    dur = D['duration']
    n = at(dur)
    music, sr = sf.read(music_path, always_2d=True)
    assert sr == SR
    music = music.T[:, :n]
    ref = lufs(music)

    fx = np.zeros((2, n + at(4.0)))
    levels = []
    mm = momentary(music)
    for i, c in enumerate(D['cues']):
        rng = np.random.default_rng(1000 + i)
        x = np.asarray(FX[c['name']](rng, **{k: v for k, v in c.items() if k not in ('t', 'name', 'db', 'pan')}), float)
        x = pan(x, c['pan']) if x.ndim == 1 else x
        g = c['db'] + SFX_DB + TRIM.get(c['name'], 0)
        cls = 'scare' if c['name'] in SCARE else 'soft' if c['name'] in SOFT else 'other'
        top = loudest(x * 10 ** (g / 20))
        here = float(mm[max(0, at(c['t'] - 0.2)):max(1, at(c['t'] + 0.5))].max())
        cap = (max(here, ref) if cls == 'scare' else max(here, ref - 6)) + FX_CAP[cls]
        if top > cap:
            g -= top - cap
        place(fx, c['t'], x, g)
        levels.append(dict(t=round(c['t'], 3), name=c['name'], gain=round(float(g), 1), fx=round(float(min(top, cap)), 1),
                           vs_score=round(float(min(top, cap) - ref), 1), score_here=round(here, 1)))

    rng = np.random.default_rng(7)
    bed = amb_stairs(rng, dur + 3.0)
    bed = stereo(bed)[:, at(1.0):at(1.0) + n + at(1.0)]
    xf = at(1.0)
    ramp = np.sin(np.linspace(0, np.pi / 2, xf)) ** 2
    bed_loop = bed[:, :n].copy()
    bed_loop[:, :xf] = bed[:, :xf] * ramp + bed[:, n:n + xf] * (1 - ramp)       # the end crossfades into the start
    bed_loop *= 10 ** ((ref + BED_LU - lufs(bed_loop)) / 20)

    mix = music + fold(fx, n) + bed_loop
    for _ in range(3):
        mix *= 10 ** ((TARGET_LUFS - lufs(mix)) / 20)
        mix = limit(mix, CEIL_DBTP - 0.2)
    loud, tp = lufs(mix), true_peak_db(mix)
    sf.write(out, mix.T, SR, subtype='PCM_24')
    json.dump(dict(music_lufs=round(ref, 1), mix_lufs=round(loud, 2), true_peak=round(tp, 2), cues=levels),
              open(out.replace('.wav', '_levels.json'), 'w'), ensure_ascii=False, indent=1)
    print(f'mix {n / SR:.2f}s  {loud:.2f} LUFS  true peak {tp:.2f} dBTP  (score {ref:.1f} LUFS) → {out}')
    for l in levels:
        print(f"  {l['t']:7.3f} {l['name']:13s} fx {l['fx']:6.1f} ({l['vs_score']:+5.1f} vs score)   score here {l['score_here']:6.1f}")


if __name__ == '__main__':
    main()
