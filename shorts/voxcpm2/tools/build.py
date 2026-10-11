# Put the chosen takes into a Морозилка film folder: same voice chain as the film's tts.py
# (trim, highpass, compressor, short freezer echo), then sd in story.json so mouths move exactly while the line sounds.
# usage: python3 build.py <film dir> <lines.json> <takes dir>
import json, os, re, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import aud

FILM, CFG, TAKES = sys.argv[1], json.load(open(sys.argv[2])), sys.argv[3]
p = os.path.join(FILM, 'story.json')
ST = json.load(open(p))
os.makedirs(os.path.join(FILM, 'out'), exist_ok=True)
VOW = re.compile('[аеёиоуыэюяАЕЁИОУЫЭЮЯ]')
for L in ST['lines']:
    take = CFG['chosen'].get(L['id'])
    if not take:
        continue
    out = os.path.join(FILM, 'out', f"tts_{L['id']}.wav")
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', os.path.join(TAKES, take + '.wav'), '-af',
                    'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,'
                    'highpass=f=90,acompressor=threshold=-20dB:ratio=3:attack=5:release=80,aecho=0.8:0.5:35:0.12', '-ar', '48000', '-ac', '1', out], check=True)
    x, sr = aud.read_wav(out)
    d = len(x) / sr
    L['t0'] = round(L['t0'] + CFG.get('shift', {}).get(L['id'], 0), 3)
    n = L.get('n') or max(3, len(VOW.findall(L['text'])))
    L['sd'] = round(d / n, 4)
    L['tts'] = f"out/tts_{L['id']}.wav"
    end = L['t0'] + d
    print(f"{L['id']} {L['who']} {d:.2f}s t0 {L['t0']:.2f} end {end:.2f} / sub1 {L['sub1']}" + ('  !! не влезает' if end > L['sub1'] - .1 else ''))
json.dump(ST, open(p, 'w'), ensure_ascii=False, indent=1)
