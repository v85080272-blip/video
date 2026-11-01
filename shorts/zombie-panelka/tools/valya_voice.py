# Баба Валя's line, heard through the flat door: trim the chosen VoiceDesign take, clean the rumble, muffle it
# (door panel: low-pass + a body resonance, a little air through the gap) and add the concrete stairwell.
# Writes valya.wav (48 kHz), valya_words.json (word times from faster-whisper, relative to the cut) and
# valya_env.json (mouth-opening envelope at 30 fps for her lip flap).
# usage: python3 -I valya_voice.py <take.wav> <out dir>
import json, os, subprocess, sys
import numpy as np
import soundfile as sf
from scipy import signal

TAKE, OUT = sys.argv[1:3]
SR, FPS = 48000, 30
os.makedirs(OUT, exist_ok=True)


def load(path, sr):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(sr), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


x = load(TAKE, SR)
x = signal.sosfiltfilt(signal.butter(4, 100, 'highpass', fs=SR, output='sos'), x)

# words first (on the clean take), then cut from the first voiced sound to the end of the last word
from faster_whisper import WhisperModel
wm = WhisperModel('large-v3-turbo', device='cpu', compute_type='int8', cpu_threads=4)
segs, _ = wm.transcribe(load(TAKE, 16000).astype(np.float32), language='ru', word_timestamps=True, beam_size=5)
words = [dict(w=w.word.strip(' «»—'), s=w.start, e=w.end) for s in segs for w in s.words if w.word.strip(' «»—')]
hop = SR // 100
db = 10 * np.log10(np.mean(x[:len(x) // hop * hop].reshape(-1, hop) ** 2, axis=1) + 1e-12)
peak = np.percentile(db, 98)
k0 = int(words[0]['s'] * 100)
while k0 < len(db) and db[k0] < peak - 30:                 # whisper starts early on a whispered breath
    k0 += 1
t0 = max(0.0, k0 / 100 - 0.08)
t1 = min(len(x) / SR, words[-1]['e'] + 0.35)
x = x[int(t0 * SR):int(t1 * SR)]
x *= np.minimum(1, np.arange(len(x)) / (0.02 * SR)) * np.minimum(1, (len(x) - np.arange(len(x))) / (0.08 * SR))
for w in words:                                            # whisper glues pauses to the next word: start at its sound
    k, ke = int(w['s'] * 100), int(w['e'] * 100) - 5
    while k < ke and db[k] < peak - 28:
        k += 1
    w['s'], w['e'] = round(max(0.0, k / 100 - 0.03 - t0), 3), round(max(0.05, w['e'] - t0), 3)

# level: voiced frames at -20 dBFS like the narrator takes
fr = x[:len(x) // hop * hop].reshape(-1, hop)
e = np.sqrt(np.mean(fr ** 2, axis=1))
loud = e[e > np.max(e) * 0.1]
x *= 10 ** (-20 / 20) / np.sqrt(np.mean(loud ** 2))

# mouth envelope (before the door muffles it)
n = SR // FPS
env = np.sqrt(np.mean(x[:len(x) // n * n].reshape(-1, n) ** 2, axis=1))
env = np.clip((20 * np.log10(env + 1e-9) + 42) / 22, 0, 1)
env = np.convolve(env, [0.25, 0.5, 0.25], 'same')

# the door: 4-pole low-pass at 2.3 kHz, +4 dB panel resonance at 320 Hz, 12 % of the dry voice through the gap
door = signal.sosfilt(signal.butter(4, 2300, 'lowpass', fs=SR, output='sos'), x)
b, a = signal.iirpeak(320, 1.2, fs=SR)
door = door + 0.58 * signal.lfilter(b, a, door)
y = 0.88 * door + 0.12 * signal.sosfilt(signal.butter(2, 4500, 'lowpass', fs=SR, output='sos'), x)

# concrete stairwell: 18 ms pre-delay, RT60 1.3 s, darkening tail
rng = np.random.default_rng(7)
L = int(1.6 * SR)
tt = np.arange(L) / SR
ir = rng.standard_normal(L) * np.exp(-6.91 * tt / 1.3)
ir = signal.sosfilt(signal.butter(2, 2600, 'lowpass', fs=SR, output='sos'), ir)
ir = np.concatenate([np.zeros(int(0.018 * SR)), ir])
ir /= np.sqrt(np.sum(ir ** 2))
wet = signal.fftconvolve(y, ir)[:len(y) + int(1.2 * SR)]
y = np.concatenate([y, np.zeros(len(wet) - len(y))])
y = y + 0.32 * wet
y *= 10 ** (-1.5 / 20) / max(1e-9, np.max(np.abs(y))) if np.max(np.abs(y)) > 10 ** (-1.5 / 20) else 1

sf.write(os.path.join(OUT, 'valya.wav'), y.astype(np.float32), SR, subtype='PCM_24')
json.dump(words, open(os.path.join(OUT, 'valya_words.json'), 'w'), ensure_ascii=False, indent=1)
json.dump([round(float(v), 3) for v in env], open(os.path.join(OUT, 'valya_env.json'), 'w'))
print('cut', round(t0, 2), '-', round(t1, 2), 's; length', round(len(y) / SR, 2), 's')
print(' '.join(f"{w['w']}[{w['s']:.2f}-{w['e']:.2f}]" for w in words))
