#!/usr/bin/env python3
"""Queue runner for the channel art: sd-cli (patched to dump the latent) -> ONNX SDXL VAE decode.

Same engine as shorts/history-facts/gen/gen.py, but every item carries its own size.
Usage: GEN_OUT=<dir> gen.py prompts.json [ids...] [--threads N] [--steps N] [--seeds 1,2,3]
"""
import json, os, subprocess, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from vae_decode import load_session, decode

WORK = os.environ.get('WORK', '/home/user/work')
SD = f'{WORK}/src/stable-diffusion.cpp/build/bin/sd-cli'
MODEL = f'{WORK}/models/RealVisXL_V5.0_Lightning_fp16.safetensors'
VAE = f'{WORK}/models/sdxl_vae_decoder.onnx'
OUT = os.environ.get('GEN_OUT', f'{WORK}/gen/branding')

args = sys.argv[1:]
threads, steps, seeds_override = 4, None, None
if '--threads' in args: i = args.index('--threads'); threads = int(args[i + 1]); del args[i:i + 2]
if '--steps' in args: i = args.index('--steps'); steps = int(args[i + 1]); del args[i:i + 2]
if '--seeds' in args: i = args.index('--seeds'); seeds_override = [int(x) for x in args[i + 1].split(',')]; del args[i:i + 2]
cfg = json.load(open(args[0]))
want = set(args[1:])
os.makedirs(OUT, exist_ok=True)
sess = None
for item in cfg['items']:
    if want and item['id'] not in want:
        continue
    style = cfg['styles'][item.get('style', 'default')]
    prompt = item['prompt'] + ', ' + style
    W, H = item['size']
    n_steps = steps or item.get('steps', cfg.get('steps', 5))
    for seed in (seeds_override or item['seeds']):
        base = f"{OUT}/{item['id']}_s{seed}"
        if os.path.exists(base + '.png'):
            print('skip', base, flush=True)
            continue
        t = time.time()
        env = dict(os.environ, SD_DUMP_LATENT=base + '_lat')
        cmd = [SD, '-m', MODEL, '--mmap', '-p', prompt, '-W', str(W), '-H', str(H), '--steps', str(n_steps),
               '--cfg-scale', '1.0', '--sampling-method', 'dpm++2m_sde', '--scheduler', 'karras', '-s', str(seed),
               '-t', str(threads), '--conv-direct', 'on', '--flash-attn', 'on', '-o', base + '_unused.png']
        r = subprocess.run(cmd, env=env, capture_output=True, text=True)
        if not os.path.exists(base + '_lat_0.bin'):
            print('FAILED', base, r.returncode, r.stderr[-800:], flush=True)
            continue
        if sess is None:
            sess = load_session(VAE, threads=threads)
        decode(sess, base + '_lat_0', base + '.png')
        for ext in ('_lat_0.bin', '_lat_0.shape'):
            os.remove(base + ext)
        json.dump({'prompt': prompt, 'seed': seed, 'steps': n_steps, 'W': W, 'H': H}, open(base + '.json', 'w'))
        print(f'done {base} in {time.time() - t:.0f}s', flush=True)
