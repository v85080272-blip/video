# Generate takes for every script line with the cloned voice via tts-server (batched requests).
import json, os, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor
SCRIPT = json.load(open('/home/user/video/shorts/history-facts/tunguska/script_v2.json'))
OUT = sys.argv[1]
seeds = [int(s) for s in sys.argv[2].split(',')]
ids = sys.argv[3].split(',') if len(sys.argv) > 3 and sys.argv[3] else [l['id'] for l in SCRIPT['lines']]
voice = os.environ.get('VOICE', 'v5')
texts = {l['id']: l['text'] for l in SCRIPT['lines']}
over = json.load(open(os.environ['TEXTS'])) if os.environ.get('TEXTS') else {}
os.makedirs(OUT, exist_ok=True)

def job(a):
    lid, seed = a
    dst = os.path.join(OUT, f'{lid}_s{seed}.wav')
    if os.path.exists(dst):
        return lid, seed, 'skip', 0
    text = over.get(lid, texts[lid])
    body = dict(input=text, voice=voice, language='Russian', response_format='wav', seed=seed)
    t0 = time.time()
    req = urllib.request.Request('http://127.0.0.1:8098/v1/audio/speech', data=json.dumps(body).encode(),
                                 headers={'Content-Type': 'application/json'})
    data = urllib.request.urlopen(req, timeout=1800).read()
    open(dst + '.part', 'wb').write(data)
    os.replace(dst + '.part', dst)
    return lid, seed, 'ok', round(time.time() - t0, 1)

jobs = [(lid, s) for s in seeds for lid in ids]
with ThreadPoolExecutor(int(os.environ.get('PAR', '3'))) as ex:
    for r in ex.map(job, jobs):
        print(*r, flush=True)
print('ALLDONE', flush=True)
