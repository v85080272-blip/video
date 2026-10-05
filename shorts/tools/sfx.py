# Builds a soundtrack WAV from a JSON list of [time, kind] events plus a soft 120 BPM beat.
# usage: python3 sfx.py events.json out.wav duration [bpm]
import json, math, random, struct, sys, wave
SR = 44100
events = json.load(open(sys.argv[1])); out = sys.argv[2]; dur = float(sys.argv[3])
bpm = float(sys.argv[4]) if len(sys.argv) > 4 else 120
buf = [0.0] * int(dur * SR)
rnd = random.Random(7)

def add(t, samples, gain=1.0):
    s = int(t * SR)
    for i, v in enumerate(samples):
        if 0 <= s + i < len(buf): buf[s + i] += v * gain

def tone(f, d, decay=8.0, f2=None, shape='sine'):
    n = int(d * SR); ph = 0; o = []
    for i in range(n):
        u = i / n; fr = f * ((f2 / f) ** u) if f2 else f
        ph += fr / SR
        v = math.sin(2 * math.pi * ph) if shape == 'sine' else (1 if (ph % 1) < .5 else -1) * .5
        o.append(v * math.exp(-decay * u) * min(1, i / 60))
    return o

def noise(d, decay=20.0):
    n = int(d * SR); return [(rnd.random() * 2 - 1) * math.exp(-decay * i / n) for i in range(n)]

def mix(*parts):
    n = max(len(p) for p in parts); o = [0.0] * n
    for p in parts:
        for i, v in enumerate(p): o[i] += v
    return o

KINDS = {
    'tick': lambda: tone(1500, .05, 30),
    'tock': lambda: tone(1000, .05, 30),
    'ding': lambda: mix(tone(880, .7, 5), [v * .6 for v in tone(1320, .7, 6)], [v * .3 for v in tone(1760, .5, 8)]),
    'whoosh': lambda: [v * math.sin(math.pi * i / len(noise(.35, 1))) for i, v in enumerate(noise(.35, 1))],
    'pop': lambda: tone(500, .12, 12, f2=1100),
    'fanfare': lambda: mix(tone(523, .9, 3), [0] * int(.12 * SR) + tone(659, .8, 3), [0] * int(.24 * SR) + tone(784, .9, 3), [0] * int(.36 * SR) + tone(1046, 1.0, 2.5)),
    'blip': lambda: tone(700, .08, 18, shape='square'),
    'buzz': lambda: tone(140, .35, 4, shape='square'),
}
GAIN = {'tick': .35, 'tock': .35, 'ding': .45, 'whoosh': .18, 'pop': .3, 'fanfare': .35, 'blip': .12, 'buzz': .25}
for t, k in events: add(t, KINDS[k](), GAIN[k])

beat = 60 / bpm; t = 0.0; kick = tone(90, .18, 9, f2=40); hat = noise(.05, 25)
while t < dur - 0.3:
    add(t, kick, .35); add(t + beat / 2, hat, .06); t += beat

peak = max(1e-9, max(abs(v) for v in buf)); g = min(1.0, .9 / peak)
with wave.open(out, 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(b''.join(struct.pack('<h', int(max(-1, min(1, v * g)) * 32767)) for v in buf))
print('ok', out, round(dur, 2))
