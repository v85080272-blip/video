# Clone voices (Qwen3-TTS Base, ICL from a casting sample) and have each read a text with a few seeds.
# Usage: python3 clone_read.py <out_dir> <text file> <seeds e.g. 1,2> <id>=<wav>[:<ref text file>] ...
# (the ref text defaults to <wav without .wav>.txt, or the casting text voice4/sample.txt)
import base64, json, os, subprocess, sys, time, urllib.request

M = '/home/user/work/models/qwen3tts'
Q = '/home/user/work/src/qwentts.cpp/build'
out, text_p, seeds = sys.argv[1], sys.argv[2], [int(s) for s in sys.argv[3].split(',')]
voices = []
for a in sys.argv[4:]:
    vid, rest = a.split('=', 1)
    wav, _, txt = rest.partition(':')
    if not txt:
        txt = wav[:-4] + '.txt' if os.path.exists(wav[:-4] + '.txt') else '/home/user/work/voice4/sample.txt'
    voices.append((vid, wav, txt))
os.makedirs(out, exist_ok=True)
text = open(text_p).read().strip()


def post(path, body):
    req = urllib.request.Request('http://127.0.0.1:8098' + path, data=json.dumps(body).encode(),
                                 headers={'Content-Type': 'application/json'})
    return urllib.request.urlopen(req, timeout=900).read()


log = open(os.path.join(out, 'server.log'), 'w')
srv = subprocess.Popen([f'{Q}/tts-server', '--model', f'{M}/qwen-talker-1.7b-base-Q8_0.gguf', '--codec',
                        f'{M}/qwen-tokenizer-12hz-Q8_0.gguf', '--host', '127.0.0.1', '--port', '8098', '--lang', 'Russian'],
                       stdout=log, stderr=subprocess.STDOUT, env=dict(os.environ, QT_THREADS='4'))
try:
    while 'listening' not in open(os.path.join(out, 'server.log')).read():
        time.sleep(2)
    for vid, wav, txt in voices:
        spk, rvq = wav[:-4] + '.spk', wav[:-4] + '.rvq'
        if not (os.path.exists(spk) and os.path.exists(rvq)):
            subprocess.run([f'{Q}/qwen-codec', '--model', f'{M}/qwen-tokenizer-12hz-Q8_0.gguf', '--talker',
                            f'{M}/qwen-talker-1.7b-base-Q8_0.gguf', '-i', wav], capture_output=True, check=True)
        post('/v1/audio/voices', dict(name=vid, ref_text=open(txt).read().strip(),
                                      spk_b64=base64.b64encode(open(spk, 'rb').read()).decode(),
                                      rvq_b64=base64.b64encode(open(rvq, 'rb').read()).decode()))
        for s in seeds:
            dst = os.path.join(out, f'{vid}_s{s}.wav')
            if os.path.exists(dst):
                continue
            t0 = time.time()
            audio = post('/v1/audio/speech', dict(input=text, voice=vid, language='Russian', response_format='wav', seed=s))
            open(dst, 'wb').write(audio)
            print(f'{vid} seed {s}: {time.time() - t0:.0f} s', flush=True)
finally:
    srv.terminate()
