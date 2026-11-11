# The sound of «Зона: 5 походов»: the episodes keep their own mixes (cut before the vote, with a short fade); the intro,
# the transitions and the outro get their own score and effects and are mixed like an episode (tools/mix.py: the score
# ducks under the voice, every part at −14 LUFS), then everything is laid on the timeline (build/timeline.json).
# usage: python3 tools/movie_audio.py build/timeline.json build/voice.wav build/mix.wav
import json
import os
import subprocess
import sys

import numpy as np
import soundfile as sf

import mix as M
from sfx import SR
from instruments import pizz, celesta, glock, saws, trem, timp, brass, crash, riser, Sec

BEAT = 0.5
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)


def grid(t0, t1, step):
    return np.arange(t0, t1 - 1e-6, step)


def score(kind, dur, marks, rng):
    """one inserted part, in D minor; marks: times inside the part"""
    S = []
    if kind == 'intro':
        a = Sec(dur, stop=dur - 0.05, over=0.05); S.append(a)
        a.wet.add(0.0, saws(rng, [26, 33, 38, 41], dur + 0.2, attack=0.05, release=0.2, bright=700), -15, 0.0)
        for i, t in enumerate(grid(0.05, dur - 0.1, BEAT / 2)):
            a.dry.add(t, pizz(rng, [38, 38, 41, 38, 45, 41, 38, 36][i % 8], 0.4), -15, -0.2 + 0.4 * (i % 2))
        a.dry.add(0.0, brass(rng, [26, 33, 38, 44], 0.8, bright=2200), -11, 0.0)
        for t in marks['cuts']:
            a.dry.add(t, timp(rng, 26, 0.8), -12, 0.0)
        a.wet.add(max(0.0, dur - 2.0), riser(rng, 2.0), -18, 0.0)
    elif kind == 'trans':
        a = Sec(dur, stop=dur - 0.05, over=0.08); S.append(a)
        a.wet.add(0.0, saws(rng, [38, 45, 50, 53], dur + 0.2, attack=0.35, release=0.2, bright=900), -17, 0.0)
        a.dry.add(0.12, glock(rng, 81, 0.6, 2.0), -14, 0.2)
        for i, t in enumerate(grid(0.4, dur - 0.2, BEAT)):
            a.dry.add(t, pizz(rng, [38, 45, 41, 45][i % 4], 0.35), -17, -0.15 + 0.3 * (i % 2))
    else:                                                                       # the outro
        a = Sec(dur, gain=((0, 0.0), (dur - 2.0, 0.0), (dur, -30.0))); S.append(a)
        sub = marks['sub']
        a.wet.add(0.0, saws(rng, [38, 45, 50, 53], sub + 0.3, attack=0.4, release=0.3, bright=900), -16, 0.0)
        a.wet.add(sub, saws(rng, [38, 45, 50, 54, 57], dur - sub, attack=0.3, release=0.6, bright=1100), -15, 0.0)
        for i, t in enumerate(grid(0.3, dur - 1.5, BEAT)):
            a.dry.add(t, pizz(rng, [38, 45, 41, 45, 38, 45, 43, 45][i % 8], 0.35), -16, -0.15 + 0.3 * (i % 2))
            if i % 4 == 0:
                a.dry.add(t, timp(rng, 26, 0.3), -17, 0.0)
        for c in range(5):
            a.dry.add(0.3 + c * 0.25, glock(rng, [74, 77, 81, 84, 86][c], 0.5, 1.6), -17, -0.4 + 0.2 * c)
        for k, (dt, n) in enumerate([(0.0, 74), (0.3, 78), (0.6, 81), (0.9, 86)]):
            a.dry.add(sub + 0.1 + dt, celesta(rng, n, 0.6), -12, 0.15)
    rooms = (M.room(rng, 1.2, damp=5000, width=0.7), M.room(rng, 3.0, damp=3600, width=0.95))
    y = sum(s.render(rooms) for s in S)[:, :M.at(dur)]
    return np.pad(y, ((0, 0), (0, max(0, M.at(dur) - y.shape[1]))))


def episode_audio(path, trim, fade):
    raw = subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-i', path, '-t', f'{trim:.3f}', '-vn', '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    y = np.frombuffer(raw, np.float32).reshape(-1, 2).T.astype(np.float64)
    n = y.shape[1]
    if fade:
        k = M.at(0.12); y[:, n - k:] *= np.linspace(1, 0, k)          # after the last word of the vote (it can end 0.15 s before the cut)
    k = M.at(0.02); y[:, :k] *= np.linspace(0, 1, k)
    return y


def main():
    tl_path, voice_path, out = sys.argv[1:4]
    TL = json.load(open(tl_path))
    W = {l['id']: l for l in json.load(open(os.path.join(ROOT, 'build/words.json')))['lines']}
    voice, sr = sf.read(voice_path)
    assert sr == SR
    total = M.at(TL['dur'])
    out_mix = np.zeros((2, total + M.at(1.0)))
    rng = np.random.default_rng(2604)
    tmp = os.path.join(ROOT, 'build/parts'); os.makedirs(tmp, exist_ok=True)
    for s in TL['segs']:
        t0, t1 = s['t0'], s['t1']; dur = t1 - t0
        if s['kind'] == 'ep':
            y = episode_audio(s['file'], s['trim'], fade=s['k'] < 5)
            i0 = M.at(t0); out_mix[:, i0:i0 + y.shape[1]] += y
            continue
        # an inserted part: its own little short, mixed like the episodes
        cues, marks = [], {}
        if s['kind'] == 'intro':
            marks['cuts'] = [c['t0'] for c in TL['clips'] if c['t0'] > 0.01]
            cues += [dict(t=0.02, name='stamp', db=-10, pan=0), dict(t=0.0, name='roof_wind', db=-20, pan=0, dur=dur)]
            cues += [dict(t=c - 0.12, name='whoosh', db=-12, pan=0) for c in marks['cuts']]
        elif s['kind'] == 'trans':
            cues += [dict(t=0.05, name='whoosh', db=-14, pan=-0.3), dict(t=0.12, name='pop_word', db=-10, pan=0),
                     dict(t=0.25, name='paper', db=-16, pan=0.2)]
        else:
            marks['sub'] = W['O5']['at'] - t0
            cues += [dict(t=0.1, name='paper', db=-12, pan=0)]
            cues += [dict(t=0.3 + c * 0.25, name='pop_word', db=-14, pan=-0.4 + 0.2 * c) for c in range(5)]
            for lid, ws in (('O2', (0, 6, 10)), ('O3', (0, 4, 8)), ('O4', (0, 4, 9))):
                cues += [dict(t=W[lid]['words'][w]['s'] - t0, name='blip', db=-16, pan=0) for w in ws]
            cues += [dict(t=W['O5']['at'] - t0, name='pop_word', db=-8, pan=0)]
        music = score(s['kind'], dur, marks, rng)
        v = voice[M.at(t0):M.at(t1)]
        v = np.pad(v, (0, max(0, M.at(dur) - len(v))))
        vp = os.path.join(tmp, f"voice_{s['kind']}_{s.get('k', 0)}.wav"); sf.write(vp, v, SR, subtype='FLOAT')
        D = dict(duration=dur, cues=sorted(cues, key=lambda c: c['t']))
        mp = os.path.join(tmp, f"mix_{s['kind']}_{s.get('k', 0)}.wav")
        M.voiced(D, music, vp, mp)
        y, _ = sf.read(mp, always_2d=True); y = y.T
        k = M.at(0.03); y[:, :k] *= np.linspace(0, 1, k); y[:, -k:] *= np.linspace(1, 0, k)
        i0 = M.at(t0); out_mix[:, i0:i0 + y.shape[1]] += y
    out_mix = out_mix[:, :total]
    out_mix = M.limit(out_mix, -1.5)
    sf.write(out, out_mix.T, SR, subtype='PCM_24')
    print(f'movie mix {total / SR:.1f}s  {M.lufs(out_mix):.2f} LUFS  true peak {M.true_peak_db(out_mix):.2f} dBTP → {out}')


if __name__ == '__main__':
    main()
