# Generate short test phrases with the cloned voice to see whether stress marks in the text are obeyed.
import json, os, sys, time, urllib.request
OUT = sys.argv[1]
cases = json.load(open(sys.argv[2]))          # {"name": "text", ...}
seeds = [int(s) for s in sys.argv[3].split(',')]
voice = os.environ.get('VOICE', 'v5')
os.makedirs(OUT, exist_ok=True)
for seed in seeds:
    for name, text in cases.items():
        dst = os.path.join(OUT, f'{name}_s{seed}.wav')
        if os.path.exists(dst):
            continue
        body = dict(input=text, voice=voice, language='Russian', response_format='wav', seed=seed)
        t0 = time.time()
        req = urllib.request.Request('http://127.0.0.1:8098/v1/audio/speech', data=json.dumps(body).encode(),
                                     headers={'Content-Type': 'application/json'})
        open(dst, 'wb').write(urllib.request.urlopen(req, timeout=900).read())
        print(name, seed, round(time.time() - t0, 1), flush=True)
print('ALLDONE', flush=True)
