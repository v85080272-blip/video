# Голоса RHVoice (офлайн, apt: rhvoice rhvoice-russian) + огибающая громкости для рта (30 к/с).
import json, os, subprocess, sys
import numpy as np, soundfile as sf
HERE = os.path.dirname(os.path.abspath(__file__))
VOICES = {'C': 'vitaliy', 'O': 'pavel'}
p = os.path.join(HERE, 'story.json'); ST = json.load(open(p)); FPS = ST['fps']
os.makedirs(os.path.join(HERE, 'out'), exist_ok=True)
for L in ST['lines']:
    raw = os.path.join(HERE, 'out', f"tts_{L['id']}_raw.wav"); out = os.path.join(HERE, 'out', f"tts_{L['id']}.wav")
    subprocess.run(['RHVoice-test', '-p', VOICES[L['who']], '-t', str(L['pitch']), '-r', str(L['rate']), '-R', '48000', '-o', raw], input=L.get('say', L['text']).encode(), check=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', raw, '-af',
                    'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,' +
                    (f"atempo={L['tempo']}," if 'tempo' in L else '') + 'highpass=f=90,acompressor=threshold=-20dB:ratio=3:attack=5:release=80', '-ar', '48000', '-ac', '1', out], check=True)
    x, sr = sf.read(out); d = len(x) / sr
    hop = sr // FPS; n = int(np.ceil(len(x) / hop))
    rms = np.array([np.sqrt(np.mean(x[i * hop:(i + 1) * hop] ** 2)) for i in range(n)])
    env = np.clip(rms / (np.percentile(rms, 90) + 1e-9), 0, 1.2)
    L['env'] = [round(float(v), 3) for v in env]; L['tts'] = f"out/tts_{L['id']}.wav"; L['d'] = round(d, 3)
    print(f"{L['id']} {d:.2f}s end {L['t0'] + d:.2f} / sub1 {L['sub1']}" + ('  !! не влезает' if L['t0'] + d > L['sub1'] - .05 else ''))
json.dump(ST, open(p, 'w'), ensure_ascii=False, indent=1)
