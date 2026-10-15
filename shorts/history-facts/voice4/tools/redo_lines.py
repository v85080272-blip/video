# Re-voice single lines of an episode after a text fix (e.g. a word the model keeps stressing wrong was rephrased):
# tts-server + the cloned narrator -> new seeds for the given lines -> score (Whisper CER, UTMOS) -> ranking.
# Then put the pick in <voice dir>/<ep>/lines_cfg.json "chosen" and rerun takes_meta, export, manifest, eq_lines.
# usage: python3 redo_lines.py <voice id> <takes dir> <script.json> <ids L12,L13> <seeds 11,12,13>
import base64, json, os, subprocess, sys, time, urllib.request

V, TAKES, SCRIPT, IDS, SEEDS = sys.argv[1:6]
W = '/home/user/work/voice3'
M = '/home/user/work/models/qwen3tts'
Q = '/home/user/work/src/qwentts.cpp/build'
T2 = '/home/user/work/voice2/tools'
env = dict(os.environ, VOX_HOME='/home/user/work/voice/vox', WHISPER_THREADS='4')


def log(*a):
    print(time.strftime('%H:%M:%S'), *a, flush=True)


ref = f'{W}/ref/{V}'
srv_log_p = f'{W}/server_{V}_redo.log'
srv = subprocess.Popen([f'{Q}/tts-server', '--model', f'{M}/qwen-talker-1.7b-base-Q8_0.gguf', '--codec',
                        f'{M}/qwen-tokenizer-12hz-Q8_0.gguf', '--host', '127.0.0.1', '--port', '8098', '--lang', 'Russian'],
                       stdout=open(srv_log_p, 'w'), stderr=subprocess.STDOUT, env=dict(env, QT_THREADS='4'))
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
    subprocess.run(['python3', f'{T2}/gen_lines.py', TAKES, SEEDS, IDS], check=True,
                   env=dict(env, SCRIPT=SCRIPT, VOICE=V, PAR='1'))
finally:
    srv.terminate()
    srv.wait()
log('takes done, scoring')
subprocess.run(['python3', f'{T2}/score_takes.py', TAKES, ref + '.wav'], check=True, env=dict(env, SCRIPT=SCRIPT),
               stdout=subprocess.DEVNULL)
sc = json.load(open(os.path.join(TAKES, 'scores.json')))
for lid in IDS.split(','):
    rows = sorted(((k, s) for k, s in sc.items() if s['lid'] == lid), key=lambda t: (t[1]['cer'] > 0.03, -t[1]['utmos']))
    for k, s in rows:
        log(lid, k, 'cer', s['cer'], 'utmos', s['utmos'], 'dur', s['dur'], 'gap', s['gap'], 'wps', s['wps'], '|', s['hyp'])
log('REDO DONE')
