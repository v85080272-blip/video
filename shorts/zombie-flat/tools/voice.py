# The narration track: each line of voice/script.json, cut from a take by ../zombie-panelka/tools/cut_voice.py, placed in
# the short at its `at` (or so that its anchor word lands on the anchor's beat), with the breath the take had before it.
# Lines may come from different takes of the same voice. A line can be tightened with "tempo" (ffmpeg atempo, ≤ 1.1).
# Writes build/voice.wav (48 kHz mono) and build/words.json (absolute word times, for subtitles and the lettering).
# usage: python3 tools/voice.py voice/script.json build/voice.wav L1=<cut dir> L2=<cut dir> ...   (or *=<cut dir> for all)
import json
import os
import subprocess
import sys

import numpy as np
import soundfile as sf

SR = 48000
BREATH_DB = -2.0                     # the narrator's own breaths, a touch under their natural level (episode 1)
script, out = sys.argv[1:3]
pick = dict(a.split('=', 1) for a in sys.argv[3:])
lines = json.load(open(script))['lines']
dur = 22.5
track = np.zeros(int(dur * SR))
placed, ok = [], True


def load(path, tempo=1.0):
    if tempo == 1.0:
        y, sr = sf.read(path)
        assert sr == SR
        return y
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-af', f'atempo={tempo}', '-ac', '1', '-ar', str(SR),
                          '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


for l in lines:
    src = pick.get(l['id'], pick.get('*'))
    tempo = l.get('tempo', 1.0)
    y = load(os.path.join(src, f"{l['id']}.wav"), tempo)
    # Whisper starts a line's first word in the silence before it: no word starts before its line
    words = [dict(w, s=max(0.0, w['s']) / tempo, e=w['e'] / tempo) for w in json.load(open(os.path.join(src, 'words.json')))[l['id']]]
    at = l['at'] if 'anchor' not in l else l['anchor']['t'] - words[l['anchor']['word']]['s']
    i = int(round(at * SR))
    track[i:i + len(y)] += y[:len(track) - i]
    b = os.path.join(src, f"B_{l['id']}.wav")
    if os.path.exists(b):                                 # the breath right before the line, as the take had it
        br = load(b, tempo) * 10 ** (BREATH_DB / 20)
        j = max(0, i - len(br))
        track[j:i] += br[len(br) - (i - j):]
    end = at + len(y) / SR
    flag = '' if end <= l['by'] + 1e-3 else f'  ✗ runs {end - l["by"]:.2f} s past {l["by"]}'
    ok &= not flag
    print(f"{l['id']} {at:6.2f}–{end:6.2f} s ({len(y) / SR:.2f} s) from {os.path.basename(src.rstrip('/'))}{flag}")
    placed.append(dict(id=l['id'], text=l['text'], at=round(at, 3), end=round(end, 3), sub=l.get('sub', False),
                       words=[dict(w=w['w'], s=round(at + w['s'], 3), e=round(at + w['e'], 3)) for w in words]))

sf.write(out, track.astype(np.float32), SR, subtype='FLOAT')
json.dump(dict(lines=placed), open(os.path.join(os.path.dirname(out), 'words.json'), 'w'), ensure_ascii=False, indent=1)
print('voice →', out, '' if ok else '(some lines overrun their slot)')
