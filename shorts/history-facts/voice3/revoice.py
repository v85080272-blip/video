# Re-voice both episodes with a new cloned narrator, unattended:
# clone the casting sample (Base model, ICL) -> 3 takes per line for both scripts -> score (Whisper CER, UTMOS) ->
# extra seeds for lines without a clean take -> pick -> export -20 dBFS -> word-timing manifest.
# Usage: python3 revoice.py <voice id> <casting wav> <casting text file>
import base64, json, os, shutil, subprocess, sys, time, urllib.request

V, WAV, TXT = sys.argv[1:4]
W = '/home/user/work/voice3'
D = f'{W}/{V}'            # takes, choices and exported lines for this voice
M = '/home/user/work/models/qwen3tts'
Q = '/home/user/work/src/qwentts.cpp/build'
T2 = '/home/user/work/voice2/tools'
VOX = '/home/user/work/voice/shorts/voxcpm2/tools'
EPS = {
    'tunguska': dict(script='/home/user/video/shorts/history-facts/tunguska/script_v2.json',
                     cfg='/home/user/video/shorts/history-facts/voice2/lines_cfg.json',
                     title='«Что взорвалось над Сибирью? Тунгусский взрыв 1908»'),
    'dance': dict(script='/home/user/work/ep2/script.json', cfg='/home/user/work/ep2/lines_cfg.json',
                  title='«Город, который не мог перестать танцевать. Танцевальная чума 1518»'),
}
env = dict(os.environ, VOX_HOME='/home/user/work/voice/vox', WHISPER_THREADS='4')


def log(*a):
    print(time.strftime('%H:%M:%S'), *a, flush=True)


def run(cmd, **kw):
    log('$', ' '.join(cmd) if isinstance(cmd, list) else cmd)
    subprocess.run(cmd, check=True, env=kw.pop('env', env), **kw)


# 1. clone latents
os.makedirs(f'{W}/ref', exist_ok=True)
ref_wav, ref_txt = f'{W}/ref/{V}.wav', f'{W}/ref/{V}.txt'
shutil.copy(WAV, ref_wav)
shutil.copy(TXT, ref_txt)
if not os.path.exists(f'{W}/ref/{V}.spk'):
    run([f'{Q}/qwen-codec', '--model', f'{M}/qwen-tokenizer-12hz-Q8_0.gguf', '--talker',
         f'{M}/qwen-talker-1.7b-base-Q8_0.gguf', '-i', ref_wav], capture_output=True)

# 2. server + voice
srv_log = open(f'{W}/server_{V}.log', 'w')
srv = subprocess.Popen([f'{Q}/tts-server', '--model', f'{M}/qwen-talker-1.7b-base-Q8_0.gguf', '--codec',
                        f'{M}/qwen-tokenizer-12hz-Q8_0.gguf', '--host', '127.0.0.1', '--port', '8098', '--lang', 'Russian'],
                       stdout=srv_log, stderr=subprocess.STDOUT, env=dict(env, QT_THREADS='4'))
while 'listening' not in open(f'{W}/server_{V}.log').read():
    time.sleep(2)
body = dict(name=V, ref_text=open(ref_txt).read().strip(),
            spk_b64=base64.b64encode(open(f'{W}/ref/{V}.spk', 'rb').read()).decode(),
            rvq_b64=base64.b64encode(open(f'{W}/ref/{V}.rvq', 'rb').read()).decode())
req = urllib.request.Request('http://127.0.0.1:8098/v1/audio/voices', data=json.dumps(body).encode(),
                             headers={'Content-Type': 'application/json'})
log(urllib.request.urlopen(req).read().decode())


def gen(ep, seeds, ids=''):
    e = EPS[ep]
    run(['python3', f'{T2}/gen_lines.py', f'{D}/{ep}/takes', ','.join(map(str, seeds)), ids],
        env=dict(env, SCRIPT=e['script'], VOICE=V, PAR='1'))


def score(ep):
    e = EPS[ep]
    run(['python3', f'{T2}/score_takes.py', f'{D}/{ep}/takes', ref_wav], env=dict(env, SCRIPT=e['script']))
    return json.load(open(f'{D}/{ep}/takes/scores.json'))


def pick(sc, lid):
    takes = [(k, s) for k, s in sc.items() if s['lid'] == lid]
    clean = [(k, s) for k, s in takes if s['cer'] <= 0.03 and s['gap'] < 1.2]
    if not clean:
        return None
    return max(clean, key=lambda t: t[1]['utmos'])[0][:-4]


# 3. takes: 3 seeds per line, then up to 3 more seeds for lines without a clean take
for ep in EPS:
    gen(ep, [1, 2, 3])
for ep in EPS:
    sc = score(ep)
    lids = sorted({s['lid'] for s in sc.values()}, key=lambda x: int(x[1:]))
    bad = [l for l in lids if not pick(sc, l)]
    if bad:
        log(ep, 'extra seeds for', bad)
        gen(ep, [4, 5, 6], ','.join(bad))
        sc = score(ep)
    chosen = {l: pick(sc, l) or max(((k, s) for k, s in sc.items() if s['lid'] == l), key=lambda t: -t[1]['cer'])[0][:-4]
              for l in lids}
    cfg = json.load(open(EPS[ep]['cfg']))
    cfg.update(episode=f"{EPS[ep]['title']}, рассказчик {V}, Qwen3-TTS 1.7B Base, клон ref/{V}.wav",
               voices=dict(N=f'ref/{V}.wav'), chosen=chosen, gain={})
    json.dump(cfg, open(f'{D}/{ep}/lines_cfg.json', 'w'), ensure_ascii=False, indent=1)
    log(ep, 'chosen', chosen)
srv.terminate()

# 4. export + manifest (word timings for captions and cuts)
for ep in EPS:
    d = f'{D}/{ep}'
    run(['python3', f'{T2}/takes_meta.py', f'{d}/takes', V])
    run(['python3', f'{VOX}/export.py', f'{d}/lines_cfg.json', f'{d}/takes', f'{d}/lines', '-20'])
    run(['python3', '/home/user/work/voice/scripts/manifest.py', f'{d}/lines_cfg.json', f'{d}/takes', f'{d}/lines'])
log('REVOICE DONE')
