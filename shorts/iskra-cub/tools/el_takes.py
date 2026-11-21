# Takes from ElevenLabs instead of the local TTS: every line of voice/script.json (its `tts`, with stress marks, or its
# `text`) read by one voice, joined with 1 s of silence into one take — the same shape as voice/takes.sh makes, so the
# usual chain (cut_voice.py, pick_take.py) works on it. A seed per take; ONLY="L2 L5" reads just those lines.
# The API key is not here: the session's network proxy adds it to requests to api.elevenlabs.io.
# usage: ONLY="…" python3 tools/el_takes.py <out dir> <seed> [<seed> …]
import json
import os
import subprocess
import sys
import urllib.request

import numpy as np
import soundfile as sf

VOICE = 'TPIitICAZ8CqlGZ81AKm'            # Elen Kuragina (ElevenLabs voice library), added to the account 11.11
MODEL = 'eleven_multilingual_v2'
SETTINGS = {'stability': 0.45, 'similarity_boost': 0.8, 'style': 0.3, 'use_speaker_boost': True, 'speed': 1.08}
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
out, seeds = sys.argv[1], [int(s) for s in sys.argv[2:]]
only = os.environ.get('ONLY', '').split()
d = json.load(open(os.path.join(ROOT, 'voice/script.json')))
d['lines'] = [l for l in d['lines'] if not only or l['id'] in only]
os.makedirs(os.path.join(out, 'takes'), exist_ok=True)
json.dump(d, open(os.path.join(out, 'script.json'), 'w'), ensure_ascii=False, indent=1)
SR = 24000


def say(text, seed, prev, nxt):
    body = {'text': text, 'model_id': MODEL, 'voice_settings': SETTINGS, 'seed': seed}
    if prev: body['previous_text'] = prev
    if nxt: body['next_text'] = nxt
    req = urllib.request.Request(f'https://api.elevenlabs.io/v1/text-to-speech/{VOICE}?output_format=mp3_44100_128',
                                 data=json.dumps(body, ensure_ascii=False).encode(), headers={'Content-Type': 'application/json'})
    mp3 = urllib.request.urlopen(req, timeout=120).read()
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', '-', '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], input=mp3, capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32)


for s in seeds:
    path = os.path.join(out, 'takes', f's{s}.wav')
    if os.path.exists(path):
        continue
    parts, L = [], d['lines']
    for i, l in enumerate(L):
        t = l.get('tts', l['text'])
        prev = L[i - 1].get('tts', L[i - 1]['text']) if i else None
        nxt = L[i + 1].get('tts', L[i + 1]['text']) if i + 1 < len(L) else None
        parts += [say(t, s, prev, nxt), np.zeros(SR)]
        print(f's{s} {l["id"]} ok', flush=True)
    sf.write(path, np.concatenate([np.zeros(SR // 2)] + parts), SR)
    print(f's{s} done ({sum(len(l.get("tts", l["text"])) for l in L)} characters)')
