# Read a whole episode script in one go (continuous narration) with the cloned narrator, instead of line by line:
# the model then shapes the melody across sentences like a storyteller, not one announcement per line.
# usage: python3 gen_cont.py <voice id> <script.json> <out dir> <seeds 1,2,3> [joiner: nl|space] [temperature]
import base64, json, os, subprocess, sys, time, urllib.request

V, SCRIPT, OUT, SEEDS = sys.argv[1:5]
JOIN = '\n' if (sys.argv[5] if len(sys.argv) > 5 else 'nl') == 'nl' else ' '
TEMP = float(sys.argv[6]) if len(sys.argv) > 6 else None
W = '/home/user/work/voice3'
M = '/home/user/work/models/qwen3tts'
Q = '/home/user/work/src/qwentts.cpp/build'
os.makedirs(OUT, exist_ok=True)
text = JOIN.join(l['text'] for l in json.load(open(SCRIPT))['lines'])
open(os.path.join(OUT, 'text.txt'), 'w').write(text)


def log(*a):
    print(time.strftime('%H:%M:%S'), *a, flush=True)


ref = f'{W}/ref/{V}'
srv_log_p = os.path.join(OUT, 'server.log')
srv = subprocess.Popen([f'{Q}/tts-server', '--model', f'{M}/qwen-talker-1.7b-base-Q8_0.gguf', '--codec',
                        f'{M}/qwen-tokenizer-12hz-Q8_0.gguf', '--host', '127.0.0.1', '--port', '8098', '--lang', 'Russian'],
                       stdout=open(srv_log_p, 'w'), stderr=subprocess.STDOUT, env=dict(os.environ, QT_THREADS='4'))
try:
    t0 = time.time()
    while 'listening' not in open(srv_log_p).read():
        if srv.poll() is not None or time.time() - t0 > 300:
            sys.exit('tts-server did not start, see ' + srv_log_p)
        time.sleep(2)
    body = dict(name=V, ref_text=open(ref + '.txt').read().strip(),
                spk_b64=base64.b64encode(open(ref + '.spk', 'rb').read()).decode(),
                rvq_b64=base64.b64encode(open(ref + '.rvq', 'rb').read()).decode())
    req = urllib.request.Request('http://127.0.0.1:8098/v1/audio/voices', data=json.dumps(body).encode(),
                                 headers={'Content-Type': 'application/json'})
    log(urllib.request.urlopen(req).read().decode())
    for s in SEEDS.split(','):
        dst = os.path.join(OUT, f'cont_s{s}.wav')
        if os.path.exists(dst):
            continue
        body = dict(input=text, voice=V, language='Russian', response_format='wav', seed=int(s))
        if TEMP is not None:
            body['temperature'] = TEMP
        t1 = time.time()
        r = urllib.request.Request('http://127.0.0.1:8098/v1/audio/speech', data=json.dumps(body).encode(),
                                   headers={'Content-Type': 'application/json'})
        data = urllib.request.urlopen(r, timeout=3600).read()
        open(dst + '.part', 'wb').write(data)
        os.replace(dst + '.part', dst)
        log('seed', s, 'done in', round(time.time() - t1), 's')
finally:
    srv.terminate()
    srv.wait()
log('CONT DONE')
