# ElevenLabs clips for the dialogue: one wav per generated line (not one joined take), each in its speaker's voice from
# voice/script.json «voices». «copy» and «parts» lines are not generated: they replay other clips (the mimic).
# The API key is not here: the session's network proxy adds it to requests to api.elevenlabs.io.
# usage: ONLY="L03 L10" python3 tools/el_lines.py <out dir> <seed>
import json, os, subprocess, sys, urllib.request
import numpy as np, soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
out, seed = sys.argv[1], int(sys.argv[2])
only = os.environ.get('ONLY', '').split()
d = json.load(open(os.path.join(ROOT, 'voice/script.json')))
SR = 44100
gen = [l for l in d['lines'] if 'text' in l and 'copy' not in l and 'parts' not in l]
os.makedirs(os.path.join(out, f's{seed}'), exist_ok=True)


def say(l, prev, nxt):
    v = d['voices'][l['who']]
    body = {'text': l.get('tts', l['text']), 'model_id': v['model'], 'voice_settings': v['set'], 'seed': seed}
    if prev: body['previous_text'] = prev
    if nxt: body['next_text'] = nxt
    req = urllib.request.Request(f'https://api.elevenlabs.io/v1/text-to-speech/{v["voice"]}?output_format=mp3_44100_128',
                                 data=json.dumps(body, ensure_ascii=False).encode(), headers={'Content-Type': 'application/json'})
    mp3 = urllib.request.urlopen(req, timeout=600).read()
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', '-', '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], input=mp3, capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32)


n = 0
for i, l in enumerate(gen):
    if only and l['id'] not in only: continue
    path = os.path.join(out, f's{seed}', f'{l["id"]}.wav')
    if os.path.exists(path): continue
    # context only from the same speaker's neighbouring lines, so the narrator keeps one flow and the radio keeps its own
    same = [x for x in gen if x['who'] == l['who']]
    k = same.index(l)
    prev = same[k - 1].get('tts', same[k - 1]['text']) if k else None
    nxt = same[k + 1].get('tts', same[k + 1]['text']) if k + 1 < len(same) else None
    sf.write(path, say(l, prev, nxt), SR)
    n += len(l.get('tts', l['text']))
    print(l['id'], 'ok', flush=True)
print(f's{seed} done ({n} characters)')
