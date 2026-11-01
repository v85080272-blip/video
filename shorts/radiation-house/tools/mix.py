# Final mix for «Взрыв на станции, ты дома»: the score, every effect from build/cues.json, a quiet house bed (room tone, wind)
# and the narrator (build/voice.wav from tools/voice.py).
# The narrator is the reference: the score sits MUSIC_LU under him and dips while he speaks, never closer than MUSIC_UNDER
# dB to his voice; an effect's loudest 400 ms stays V_CAP LU against him (V_UNDER while he speaks); the blast is the one
# loud hit (class 'blast': close under him even on his word); nothing is a scare that may go over him (SCARE is empty).
# Without a voice the score is the reference instead.
# What rings past the end is folded onto the start so the short loops without a seam. Normalised to −14 LUFS under a
# −2 dBTP ceiling (AAC adds some true peak).
# usage: python3 tools/mix.py build/cues.json build/music.wav build/mix.wav [build/voice.wav [stems dir]]
import json
import os
import sys

import numpy as np
import soundfile as sf
from scipy import signal
from scipy.ndimage import maximum_filter1d, minimum_filter1d

from sfx import SR, pan, hp, peak, room, verb
from fx import FX, amb_house

TARGET_LUFS, CEIL_DBTP = -14.0, -2.0
SFX_DB, BED_LU = 0.0, -22.0
FX_CAP = {'scare': 4.0, 'blast': 0.0, 'other': -1.0, 'soft': -5.0}
SCARE = set()
BLAST = {'boom'}
SOFT = {'step', 'cloth', 'marker', 'pop_word', 'whoosh_short', 'whoosh', 'whoosh_in', 'projector', 'reel', 'squish', 'shower', 'bubbles',
        'flop', 'creak', 'birds', 'wind', 'fan', 'ticks', 'ladder', 'radio', 'rattle'}                 # textures that should sit inside the score
TRIM = {}
# the voiced version
V_CAP = {'scare': 3.0, 'blast': -1.0, 'soft': -6.0, 'other': -1.0}     # an effect's loudest 400 ms against the narrator's integrated loudness
V_UNDER = {'blast': -3.0, 'soft': -12.0, 'other': -7.0}                # …when that loudest moment falls while he speaks
REST_LU, SCARE_LU = 0.0, 3.0                            # everything but him together, against him: anywhere / at the hit
MUSIC_LU, MUSIC_UNDER, MUSIC_DUCK, MUSIC_DUCK_MAX = -7.0, 12.0, 6.0, 18.0
FX_DUCK, BED_V = 2.0, -27.0                            # every effect dips 2 dB while he speaks; the bed under him


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


def movavg(p, w):
    """centred moving average over w samples, zero outside: np.convolve(p, ones(w) / w, 'same') in O(n)"""
    c = np.concatenate([[0.0], np.cumsum(p)])
    k = np.arange(len(p))
    hi = np.minimum(k + (w - 1) // 2, len(p) - 1) + 1
    lo = np.clip(k + (w - 1) // 2 - w + 1, 0, len(p))
    return (c[hi] - c[lo]) / w


def momentary(x, win=0.4):
    """BS.1770 momentary loudness per sample (window centred), stereo in"""
    p = np.sum(kweight(x) ** 2, axis=0)
    return -0.691 + 10 * np.log10(np.maximum(movavg(p, int(win * SR)), 0) + 1e-15)


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


# ——— the narrator (episode 1's chain) and how loud he is from moment to moment ———
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
    gr = smooth(np.maximum(0, level_db(x) - thr_db) * (1 - 1 / ratio), att, rel)
    return x * 10 ** (-per_sample(gr, len(x)) / 20)


def voice_chain(x):
    """light touch: a presence boost and fast compression made the TTS narrator sound more artificial (episode 1)"""
    return compress(peak(hp(x, 70), 300, 1.0, -1.0), thr_db=-28.0, ratio=1.8, att=0.02, rel=0.25)


def cue_audio(i, c):
    rng = np.random.default_rng(1000 + i)
    x = np.asarray(FX[c['name']](rng, **{k: v for k, v in c.items() if k not in ('t', 'name', 'db', 'pan')}), float)
    return pan(x, c['pan']) if x.ndim == 1 else x


def cls_of(name):
    return 'scare' if name in SCARE else 'blast' if name in BLAST else 'soft' if name in SOFT else 'other'


def house_bed(dur, n, level):
    """the house: room tone and a faint wind, looped: its end crossfades into its start"""
    bed = stereo(amb_house(np.random.default_rng(7), dur + 3.0))[:, at(1.0):at(1.0) + n + at(1.0)]
    xf = at(1.0)
    ramp = np.sin(np.linspace(0, np.pi / 2, xf)) ** 2
    loop = bed[:, :n].copy()
    loop[:, :xf] = bed[:, :xf] * ramp + bed[:, n:n + xf] * (1 - ramp)
    return loop * 10 ** ((level - lufs(loop)) / 20)


def finish(mix, out, info, levels):
    for _ in range(3):
        mix *= 10 ** ((TARGET_LUFS - lufs(mix)) / 20)
        mix = limit(mix, CEIL_DBTP - 0.2)
    loud, tp = lufs(mix), true_peak_db(mix)
    sf.write(out, mix.T, SR, subtype='PCM_24')
    json.dump(dict(info, mix_lufs=round(loud, 2), true_peak=round(tp, 2), cues=levels),
              open(out.replace('.wav', '_levels.json'), 'w'), ensure_ascii=False, indent=1)
    print(f'mix {mix.shape[1] / SR:.2f}s  {loud:.2f} LUFS  true peak {tp:.2f} dBTP  {info} → {out}')
    return mix


def voiced(D, music, voice_path, out, stems=None):
    dur = D['duration']
    n = at(dur)
    v, sr = sf.read(voice_path)
    assert sr == SR
    v = voice_chain(np.pad(v, (0, max(0, n - len(v))))[:n])
    voice = fold(verb(v, room(np.random.default_rng(5), 0.35, damp=6000, width=0.3), 0.05), n)
    ref = lufs(voice)
    act = per_sample(smooth(np.clip((level_db(v) + 50) / 18, 0, 1), 0.015, 0.4), n)     # 0 silent … 1 speaking

    # the score: MUSIC_LU under him, dipping while he speaks, and never closer than MUSIC_UNDER dB to his voice
    music = music * 10 ** ((ref + MUSIC_LU - lufs(music)) / 20)
    ms = lambda x: np.convolve(x, np.ones(50) / 50, mode='same')                    # 50 ms average of a per-ms level
    vl = maximum_filter1d(ms(level_db(v)), 120)                                      # held over the gaps between words
    ml = ms(level_db(music.mean(0)))
    a_ms = act[::48]
    m = min(len(vl), len(ml), len(a_ms))
    need = np.maximum(MUSIC_DUCK * a_ms[:m], np.where(a_ms[:m] > 0.5, np.clip(ml[:m] - (vl[:m] - MUSIC_UNDER), 0, MUSIC_DUCK_MAX), 0))
    music = music * 10 ** (-per_sample(smooth(need, 0.02, 0.3), n) / 20)
    bed = house_bed(dur, n, ref + BED_V)

    fx, levels = np.zeros((2, n + at(4.0))), []
    duck = np.concatenate([act, np.zeros(at(4.0))])
    for i, c in enumerate(D['cues']):
        x = cue_audio(i, c)
        g = c['db'] + SFX_DB + TRIM.get(c['name'], 0)
        cls = cls_of(c['name'])
        i0 = at(c['t'])
        mo = momentary(x * 10 ** ((g - FX_DUCK * duck[i0:i0 + x.shape[1]]) / 20))
        k = int(np.argmax(mo))
        speaking = duck[max(0, i0 + k - at(0.2)):i0 + k + at(0.2)].max() > 0.5
        cap = ref + (V_UNDER.get(cls, V_CAP[cls]) if speaking and cls != 'scare' else V_CAP[cls])
        top = float(mo[k])
        if top > cap:
            g -= top - cap
        place(fx, c['t'], x, g)
        levels.append(dict(t=round(c['t'], 3), name=c['name'], gain=round(float(g), 1), vs_voice=round(min(top, cap) - ref, 1),
                           speaking=bool(speaking)))
    fx = fold(fx, n) * 10 ** (-FX_DUCK * act / 20)

    # several effects at their caps and the score add up: where they all together (400 ms loudness) would stand over him,
    # the score, the effects and the bed dip together; only around a scare (none here) may they reach SCARE_LU over him
    rest = music + fx + bed
    cap = np.full(n, ref + REST_LU)
    for c in D['cues']:
        if cls_of(c['name']) == 'scare':
            cap[at(c['t'] - 0.2):at(c['t'] + 1.0)] = ref + SCARE_LU
    g_db = np.zeros(n)
    for _ in range(3):
        over = np.maximum(0, momentary(rest * 10 ** (g_db / 20)) - cap)[::48]        # per ms
        if over.max() < 0.05:
            break
        dip = maximum_filter1d(over, 400)                                              # the whole 400 ms window
        g_db -= per_sample(np.convolve(dip, np.ones(40) / 40, mode='same'), n)
    k = 10 ** (g_db / 20)
    music, fx, bed = music * k, fx * k, bed * k
    # how far the score stays under the voice where he speaks (5th percentile over his loud 400 ms windows)
    vm, mm = momentary(voice), momentary(music)
    talk = vm > ref - 6
    margin = float(np.percentile((vm - mm)[talk], 5))
    top = float(momentary(music + fx + bed).max()) - ref
    if stems:                                     # the voice alone and everything else, at the gain of the final mix
        os.makedirs(stems, exist_ok=True)
        gl = 10 ** ((TARGET_LUFS - lufs(voice + music + fx + bed)) / 20)
        for name, b in (('voice', voice), ('rest', music + fx + bed)):
            sf.write(os.path.join(stems, name + '.wav'), (b * gl).T, SR, subtype='FLOAT')
    return finish(voice + music + fx + bed, out, dict(voice_lufs=round(float(ref), 1), music_lufs=round(float(lufs(music)), 1),
                                                      loudest_without_voice=round(float(top), 1), score_under_voice_p5=round(margin, 1),
                                                      rest_dip_max_db=round(float(-g_db.min()), 1)), levels)


def main():
    cues_path, music_path, out = sys.argv[1:4]
    D = json.load(open(cues_path))
    dur = D['duration']
    n = at(dur)
    music, sr = sf.read(music_path, always_2d=True)
    assert sr == SR
    music = music.T[:, :n]
    if len(sys.argv) > 4:
        voiced(D, music, sys.argv[4], out, sys.argv[5] if len(sys.argv) > 5 else None)
        return
    ref = lufs(music)

    fx = np.zeros((2, n + at(4.0)))
    levels = []
    mm = momentary(music)
    for i, c in enumerate(D['cues']):
        x = cue_audio(i, c)
        g = c['db'] + SFX_DB + TRIM.get(c['name'], 0)
        cls = cls_of(c['name'])
        top = loudest(x * 10 ** (g / 20))
        here = float(mm[max(0, at(c['t'] - 0.2)):max(1, at(c['t'] + 0.5))].max())
        cap = (max(here, ref) if cls == 'scare' else max(here, ref - 6)) + FX_CAP[cls]
        if top > cap:
            g -= top - cap
        place(fx, c['t'], x, g)
        levels.append(dict(t=round(c['t'], 3), name=c['name'], gain=round(float(g), 1), fx=round(float(min(top, cap)), 1),
                           vs_score=round(float(min(top, cap) - ref), 1), score_here=round(here, 1)))

    finish(music + fold(fx, n) + house_bed(dur, n, ref + BED_LU), out, dict(music_lufs=round(float(ref), 1)), levels)
    for l in levels:
        print(f"  {l['t']:7.3f} {l['name']:13s} fx {l['fx']:6.1f} ({l['vs_score']:+5.1f} vs score)   score here {l['score_here']:6.1f}")


if __name__ == '__main__':
    main()
