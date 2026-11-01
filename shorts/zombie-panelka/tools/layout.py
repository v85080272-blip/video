# Lay the cut narration lines on the episode timeline with designed pauses (gags, slams, the scratching),
# and write build/timing.json: per line start, duration and absolute word times; Баба Валя's line; total length.
# A line's own breath (B_<id>.wav from cut_voice.py) goes right before it when the pause has room for it.
# usage: python3 layout.py <narrator cut dir> <valya wav> <valya words.json> <out timing.json>
import json, os, subprocess, sys

CUT, VALYA, VWORDS, OUT = sys.argv[1:5]

LEAD = 0.45                      # a hit before the first word
GAP = {                          # pause after each line (seconds); the default is the narrator's own breath
    'L1': 0.2, 'L2': 0.25, 'L3': 0.85, 'L4': 0.25, 'L5': 0.55, 'L6': 0.2, 'L7': 1.05, 'L8': 0.25, 'L9': 1.75,
    'L10': 0.55, 'L11': 0.2, 'L12': 0.6, 'L13': 0.2, 'L14': 0.3, 'L15': 0.95, 'L16': 0.2, 'L17': 0.35,
    'L18': 1.45, 'L19': 0.9, 'L20': 3.1,
}
VALYA_AFTER = 1.15               # from the end of Баба Валя's line to the black screen
L21_DELAY = 0.45                 # black screen, then «Ты бы открыл?»
END_HOLD = 3.2                   # end card after the last word
BREATH_CLEAR = 0.08              # a breath never starts sooner than this after the previous voice


def dur(path):
    return float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path],
                                capture_output=True, text=True, check=True).stdout)


words = json.load(open(os.path.join(CUT, 'words.json')))
ids = [f'L{i}' for i in range(1, 22)]
t = LEAD
lines, breaths = {}, {}


def breath(lid, t, room):
    f = os.path.join(CUT, f'B_{lid}.wav')
    if not os.path.exists(f):
        return
    bd = dur(f)
    use = min(bd, room - BREATH_CLEAR)
    if use >= 0.12:
        breaths[lid] = dict(start=round(t - use, 3), dur=round(use, 3), file=f, skip=round(bd - use, 3))


room = LEAD
for lid in ids:
    if lid == 'L21':
        continue
    breath(lid, t, room)
    room = GAP.get(lid, 0.3)
    d = dur(os.path.join(CUT, f'{lid}.wav'))
    lines[lid] = dict(start=round(t, 3), dur=round(d, 3), file=os.path.join(CUT, f'{lid}.wav'),
                      words=[dict(w=w['w'], s=round(t + max(0.0, w['s']), 3), e=round(t + max(0.05, w['e']), 3)) for w in words[lid]])
    t += d + GAP.get(lid, 0.3)
# Баба Валя after the scratching pause
vd = dur(VALYA)
vw = json.load(open(VWORDS))
valya = dict(start=round(t, 3), dur=round(vd, 3), file=VALYA,
             words=[dict(w=w['w'], s=round(t + max(0.0, w['s']), 3), e=round(t + w['e'], 3)) for w in vw])
t += vd + VALYA_AFTER
black = t
t += L21_DELAY
breath('L21', t, VALYA_AFTER + L21_DELAY)
d = dur(os.path.join(CUT, 'L21.wav'))
lines['L21'] = dict(start=round(t, 3), dur=round(d, 3), file=os.path.join(CUT, 'L21.wav'),
                    words=[dict(w=w['w'], s=round(t + max(0.0, w['s']), 3), e=round(t + max(0.05, w['e']), 3)) for w in words['L21']])
t += d + END_HOLD
os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
json.dump(dict(lines=lines, breaths=breaths, valya=valya, black=round(black, 3), total=round(t, 3)), open(OUT, 'w'),
          ensure_ascii=False, indent=1)
print('total', round(t, 2), 's; black at', round(black, 2), '; valya at', valya['start'], '; breaths before',
      ' '.join(f'{k} {v["dur"]:.2f}s' for k, v in breaths.items()))
for k, v in lines.items():
    print(k, v['start'], v['dur'], ' '.join(w['w'] for w in v['words']))
