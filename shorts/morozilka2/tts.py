# Озвучка реплик офлайн-голосами RHVoice (apt: rhvoice rhvoice-russian).
# Пишет out/tts_<id>.wav и подгоняет sd в story.json, чтобы рот двигался ровно столько, сколько звучит фраза.
import json, os, re, subprocess, sys
import soundfile as sf
FILM = sys.argv[1]
VOICES = {'P': ('aleksandr-hq', 78, 92), 'S': ('artemiy', 135, 112), 'B': ('vitaliy', 165, 108)}  # голос, высота %, темп %
p = os.path.join(FILM, 'story.json'); ST = json.load(open(p))
os.makedirs(os.path.join(FILM, 'out'), exist_ok=True)
VOW = re.compile('[аеёиоуыэюяАЕЁИОУЫЭЮЯ]')
for L in ST['lines']:
    if L.get('voice') is False or len(L['who']) != 1: continue
    v, pitch, rate = VOICES[L['who']]
    raw = os.path.join(FILM, 'out', f"tts_{L['id']}_raw.wav"); out = os.path.join(FILM, 'out', f"tts_{L['id']}.wav")
    subprocess.run(['RHVoice-test', '-p', v, '-t', str(pitch), '-r', str(rate), '-R', '48000', '-o', raw], input=L['text'].encode(), check=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', raw, '-af',
                    'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,'
                    'highpass=f=90,acompressor=threshold=-20dB:ratio=3:attack=5:release=80,aecho=0.8:0.5:35:0.12', '-ar', '48000', '-ac', '1', out], check=True)
    d = sf.info(out).duration
    n = L.get('n') or max(3, len(VOW.findall(L['text'])))
    L['sd'] = round(d / n, 4); L['tts'] = f"out/tts_{L['id']}.wav"
    end = L['t0'] + d
    print(f"{L['id']} {L['who']} {d:.2f}s end {end:.2f} / sub1 {L['sub1']}" + ('  !! не влезает' if end > L['sub1'] - .1 else ''))
json.dump(ST, open(p, 'w'), ensure_ascii=False, indent=1)
