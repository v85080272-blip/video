# Final mix for «Зомби в панельке»: the narrator and баба Валя, every effect from build/cues.json and the score,
# with the score and the long effects ducked under the voices and every effect but the scares held under the narrator
# (FX_CAP; levels go to build/fx_levels.json), then normalised to −14 LUFS under a −2 dBTP ceiling.
# usage: python3 tools/mix.py <out.wav> [stems dir]   (reads build/timing.json, build/cues.json, build/music.wav)
import json
import os
import sys

import numpy as np
import soundfile as sf
from scipy import signal
from scipy.ndimage import maximum_filter1d, minimum_filter1d

from sfx import SFX, SR, hp, peak, room, verb, pan

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGET_LUFS, CEIL_DBTP = -14.0, -2.0    # AAC adds up to ~1.4 dB of true peak on the slams
END_FADE = 0.9

MUSIC_DB, SFX_DB, VALYA_LU = -9.0, -5.0, 3.0    # баба Валя sits this far under the narrator
MUSIC_UNDER = 12.0                               # the score never closer than this to the voice while it speaks
MUSIC_DUCK_MAX = 18.0                            # the riser and the tape stop need up to this much
BREATH_DB = -2.0                                 # the narrator's own breaths, a touch under their natural level
TRIM = {'boom': -3, 'alert': -4, 'beep': -3, 'beep_long': -3, 'error': -4, 'buzz': -3, 'zap': -2, 'slam': -6, 'tick_big': 3, 'scratch': 2,
        'clang': -7, 'thud': -3, 'meow': -3, 'power_down': -2, 'hit_end': -3, 'cut': -2}
DUCK = {  # how far each layer dips while someone speaks (dB)
    'music': 6,
    'long': 7,      # beds and long effects
    'short': 2,
    'deep': 18,     # effects that sit on a key word: the power-down under «Свет гаснет» bent its stress for the checker
}
DEEP = {'power_down', 'beep_long'}
# No effect jumps over the narrator unless it is there to scare: a cue's loudest 400 ms (BS.1770 momentary loudness,
# after ducking) is held to FX_CAP LU against the narrator's integrated loudness. The meow came out 5 LU over him.
FX_CAP = {'scare': 3.0, 'cat': -3.0, 'other': -1.0}
SCARE = {'sting', 'sting_small', 'sting_big', 'zap', 'scratch', 'door_rattle', 'heartbeat', 'hiss'}   # the door, the shadow, the blood
CAT = {'meow', 'mrr', 'clang', 'clang_small', 'scrape_short', 'land_soft', 'thump_bag'}             # the cat and the mess it makes
LONG = {'amb_city', 'amb_room', 'amb_stairs', 'water', 'horde', 'route', 'heartbeat', 'alert', 'buzz', 'sputter', 'groan', 'power_down',
        'sting', 'sting_small'}


def load(path):
    y, sr = sf.read(path, always_2d=True)
    assert sr == SR, (path, sr)
    return y.T


def at(t):
    return int(round(t * SR))


def stereo(x):
    x = np.asarray(x, float)
    if x.ndim == 1:
        return pan(x, 0.0)
    return pan(x[0], 0.0) if x.shape[0] == 1 else x


def place(bus, t, x, gain_db=0.0):
    x = stereo(x)
    i = at(t)
    j = min(bus.shape[1], i + x.shape[1])
    if j > i:
        bus[:, i:j] += x[:, :j - i] * 10 ** (gain_db / 20)


def level_db(x, win=0.01):
    """10 ms RMS level of a mono signal, one value per millisecond"""
    k = int(win * SR)
    ms = np.convolve(x ** 2, np.ones(k) / k, mode='same')
    return 10 * np.log10(ms[::48] + 1e-12)


def smooth(target, att, rel):
    """one-pole attack/release smoothing of a per-millisecond control signal"""
    a_att, a_rel = np.exp(-1e-3 / att), np.exp(-1e-3 / rel)
    out = np.empty_like(target)
    g = target[0]
    for i, v in enumerate(target):
        a = a_att if v > g else a_rel
        g = a * g + (1 - a) * v
        out[i] = g
    return out


def per_sample(ctrl, n):
    return np.interp(np.arange(n), np.arange(len(ctrl)) * 48, ctrl)


def compress(x, thr_db=-26.0, ratio=3.0, att=0.005, rel=0.09):
    ldb = level_db(x)
    over = np.maximum(0, ldb - thr_db) * (1 - 1 / ratio)
    gr = smooth(over, att, rel)
    return x * 10 ** (-per_sample(gr, len(x)) / 20)


def voice_chain(x):
    """light touch: a presence boost and fast compression made the TTS narrator sound more artificial"""
    x = hp(x, 70)
    x = peak(x, 300, 1.0, -1.0)
    return compress(x, thr_db=-28.0, ratio=1.8, att=0.02, rel=0.25)


# ——— loudness (ITU-R BS.1770-4) and true peak ———
def kweight(x):
    b1, a1 = [1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585]
    b2, a2 = [1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621]
    return signal.lfilter(b2, a2, signal.lfilter(b1, a1, x, axis=-1), axis=-1)


def loudest(x, win=0.4):
    """loudness of the loudest `win` seconds of a stereo signal (BS.1770 momentary loudness at win = 0.4)"""
    p = np.sum(kweight(x) ** 2, axis=0)
    w = int(win * SR)
    p = np.pad(p, (0, max(0, w - len(p))))
    return -0.691 + 10 * np.log10(np.convolve(p, np.ones(w) / w, mode='valid').max() + 1e-15)


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
    ahead = minimum_filter1d(need, size=L + 1, origin=-(L // 2), mode='nearest')      # min over [i, i + L]
    blk = 16
    m = int(np.ceil(n / blk))
    coarse = np.pad(ahead, (0, m * blk - n), constant_values=1.0).reshape(m, blk).min(1)
    a = np.exp(-blk / SR / rel)
    g = np.empty(m)
    cur = 1.0
    for i, v in enumerate(coarse):                                                       # instant down, slow back up
        cur = v if v < cur else a * cur + (1 - a) * v
        g[i] = cur
    g = np.minimum(np.repeat(g, blk)[:n], ahead)
    g = np.convolve(np.concatenate([np.ones(L - 1), g]), np.ones(L) / L, mode='valid')  # trailing average keeps g ≤ need
    return x * g


def main():
    out = sys.argv[1]
    stems_dir = sys.argv[2] if len(sys.argv) > 2 else None
    timing = json.load(open(os.path.join(ROOT, 'build/timing.json')))
    cues = json.load(open(os.path.join(ROOT, 'build/cues.json')))
    total = cues['total']
    n = at(total)

    # voices
    narr = np.zeros(n)
    for k, line in timing['lines'].items():
        y = load(line['file'])[0]
        y = voice_chain(y)
        i = at(line['start'])
        narr[i:i + len(y)] += y[:n - i]
    for k, b in timing.get('breaths', {}).items():
        y = load(b['file'])[0][at(b['skip']):]
        f = min(len(y) // 3, at(0.04))
        y[:f] *= np.linspace(0, 1, f)
        y = voice_chain(y) * 10 ** (BREATH_DB / 20)
        i = at(b['start'])
        narr[i:i + len(y)] += y[:n - i]
    valya = np.zeros(n)
    v = compress(load(os.path.join(ROOT, timing['valya']['file']))[0], thr_db=-30.0, ratio=2.5)   # evens out her loud «Внучок»
    i = at(timing['valya']['start'])
    valya[i:i + len(v)] += v[:n - i]
    valya *= 10 ** ((lufs(np.vstack([narr, narr])) - VALYA_LU - lufs(np.vstack([valya, valya]))) / 20)
    voice_mono = narr + valya
    vroom = room(np.random.default_rng(5), 0.35, damp=6000, width=0.3)
    voice = verb(voice_mono, vroom, 0.05)[:, :n]

    # speech activity 0..1 (−50 dBFS → 0, −32 dBFS → 1), fast attack, slow release
    act = np.clip((level_db(voice_mono) + 50) / 18, 0, 1)
    act = smooth(act, 0.015, 0.4)
    act = per_sample(act, n)

    # effects, each turned down to its FX_CAP against the narrator as it will sound after ducking
    ref = lufs(np.vstack([narr, narr]))
    fx_long, fx_short, fx_deep = np.zeros((2, n)), np.zeros((2, n)), np.zeros((2, n))
    levels = []
    for idx, c in enumerate(cues['cues']):
        name = c['n']
        kw = {k: v for k, v in c.items() if k not in ('t', 'n', 'db')}
        y = stereo(SFX[name](np.random.default_rng(1000 + idx), **kw))
        if name.startswith('amb_') and 'dur' in c:                                          # beds end on the cut
            keep = min(at(c['dur'] + 0.12), y.shape[-1])
            y = y[..., :keep].copy()
            f = min(keep, at(0.12))
            y[..., keep - f:] *= np.linspace(1, 0, f)
        d = DUCK['deep'] if name in DEEP else DUCK['long'] if name in LONG else DUCK['short']
        gain = c['db'] + TRIM.get(name, 0) + SFX_DB
        i = at(c['t'])
        m = min(y.shape[1], n - i)
        rel = loudest(y[:, :m] * 10 ** ((gain - d * act[i:i + m]) / 20)) - ref
        cls = 'scare' if name in SCARE else 'cat' if name in CAT else 'other'
        cut = max(0.0, rel - FX_CAP[cls])
        levels.append(dict(t=round(c['t'], 2), n=name, cls=cls, rel=round(rel - cut, 1), cut=round(cut, 1)))
        place(fx_deep if name in DEEP else fx_long if name in LONG else fx_short, c['t'], y, gain - cut)
    json.dump(dict(narrator_lufs=round(ref, 1), cap=FX_CAP, cues=levels), open(os.path.join(ROOT, 'build/fx_levels.json'), 'w'),
              ensure_ascii=False, indent=1)
    print('turned down to the cap: ' + ', '.join(f"{l['n']} {l['t']:.1f} s −{l['cut']:.1f} dB" for l in levels if l['cut'] > 0))

    music = load(os.path.join(ROOT, 'build/music.wav'))[:, :n]
    music = np.pad(music, ((0, 0), (0, n - music.shape[1])))
    duck = lambda d: 10 ** (-d * act / 20)
    music = music * 10 ** (MUSIC_DB / 20)
    # while someone speaks the score dips DUCK['music'] dB, and more if it would still sit closer than MUSIC_UNDER dB
    # to the voice (the riser before the escape route buried «Внизу», the tape stop «Свет гаснет»)
    ms = lambda x: np.convolve(x, np.ones(50) / 50, mode='same')                    # 50 ms average of a per-ms level
    vl = maximum_filter1d(ms(level_db(voice_mono)), 120)                            # held over the gaps between words
    ml = ms(level_db(music.mean(0)))
    act_ms = act[::48][:len(vl)]
    need = np.maximum(DUCK['music'] * act_ms, np.where(act_ms > 0.5, np.clip(ml - (vl - MUSIC_UNDER), 0, MUSIC_DUCK_MAX), 0.0))
    music = music * 10 ** (-per_sample(smooth(need, 0.02, 0.3), n) / 20)
    fx = fx_long * duck(DUCK['long']) + fx_short * duck(DUCK['short']) + fx_deep * duck(DUCK['deep'])

    mix = voice + fx + music
    for it in range(3):
        g = TARGET_LUFS - lufs(mix)
        mix = limit(mix * 10 ** (g / 20), CEIL_DBTP - 0.3)
    f = at(END_FADE)                                     # the end card fades out instead of stopping on the last frame
    mix[:, -f:] *= np.cos(np.linspace(0, np.pi / 2, f)) ** 2
    loud, tp = lufs(mix), true_peak_db(mix)
    sf.write(out, mix.T, SR, subtype='PCM_24')
    print(f'mix {total:.2f}s  {loud:.2f} LUFS  true peak {tp:.2f} dBTP → {out}')
    if stems_dir:
        os.makedirs(stems_dir, exist_ok=True)
        gl = 10 ** ((TARGET_LUFS - lufs(voice + fx + music)) / 20)
        for name, b in (('voice', voice), ('fx', fx), ('music', music)):
            sf.write(os.path.join(stems_dir, name + '.wav'), (b * gl).T, SR, subtype='FLOAT')
        np.save(os.path.join(stems_dir, 'activity.npy'), act[::480])


if __name__ == '__main__':
    main()
