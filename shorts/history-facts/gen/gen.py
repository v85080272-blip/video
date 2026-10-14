#!/usr/bin/env python3
"""Queue runner: sd-cli (latent only, patched) -> ONNX SDXL VAE decode. Usage: gen.py shots.json [ids...] [--threads N] [--steps N]"""
import json, os, subprocess, sys, time
sys.path.insert(0, '/home/user/work/gen')
from vae_decode import load_session, decode
SD = '/home/user/work/src/stable-diffusion.cpp/build/bin/sd-cli'
MODEL = '/home/user/work/models/RealVisXL_V5.0_Lightning_fp16.safetensors'
OUT = os.environ.get('GEN_OUT', '/home/user/work/gen/shots')
args = sys.argv[1:]
threads = 2; steps = 5; W, H = 640, 1120; seeds_override = None
if '--threads' in args: i = args.index('--threads'); threads = int(args[i+1]); del args[i:i+2]
if '--steps' in args: i = args.index('--steps'); steps = int(args[i+1]); del args[i:i+2]
if '--seeds' in args: i = args.index('--seeds'); seeds_override = [int(x) for x in args[i+1].split(',')]; del args[i:i+2]
cfg = json.load(open(args[0])); want = set(args[1:])
sess = None
for shot in cfg['shots']:
    if want and shot['id'] not in want: continue
    prompt = shot['prompt'] + ', ' + cfg['style']
    for seed in (seeds_override or shot['seeds']):
        base = f"{OUT}/{shot['id']}_s{seed}"
        if os.path.exists(base + '.png'): print('skip', base, flush=True); continue
        t = time.time()
        try: threads = int(open('/home/user/work/gen/threads.txt').read().strip())
        except Exception: pass
        env = dict(os.environ, SD_DUMP_LATENT=base + '_lat')
        cmd = [SD, '-m', MODEL, '--mmap', '-p', prompt, '-W', str(W), '-H', str(H), '--steps', str(steps), '--cfg-scale', '1.0',
               '--sampling-method', 'dpm++2m_sde', '--scheduler', 'karras', '-s', str(seed), '-t', str(threads),
               '--conv-direct', 'on', '--flash-attn', 'on', '-o', base + '_unused.png']
        r = subprocess.run(cmd, env=env, capture_output=True, text=True)
        if not os.path.exists(base + '_lat_0.bin'):
            print('FAILED', base, r.returncode, r.stderr[-800:], flush=True); continue
        if sess is None: sess = load_session(threads=threads)
        decode(sess, base + '_lat_0', base + '.png')
        json.dump({'prompt': prompt, 'seed': seed, 'steps': steps, 'W': W, 'H': H}, open(base + '.json', 'w'))
        print(f'done {base} in {time.time()-t:.0f}s', flush=True)
