// Render «Вулкан проснулся»: stills for review, or the picture track at 60 fps. Fast frames get motion blur: several sub-frames
// inside a 180° shutter, averaged; how many depends on how far things move on screen during the exposure.
// usage: node render.mjs stills <out dir> <t> [<t> ...]
//        node render.mjs video <out.mp4> [workers = 4]
//        node render.mjs part <first frame> <end frame> <out.mp4>
//        node render.mjs cues <out.json>
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setCtx, W, H } from './src/flat.js';
import { init, frame, motion, cues, DUR, MARKS, CUTS, SNAPS } from './src/main.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const FPS = 60, SHUTTER = 0.5 / FPS, PX_PER_SUB = 3, MAX_SUB = 16;
GlobalFonts.registerFromPath(path.join(ROOT, 'fonts', 'Oswald-700.ttf'), 'Oswald');
GlobalFonts.registerFromPath(path.join(ROOT, 'fonts', 'RussoOne.ttf'), 'Russo');
const canvas = createCanvas(W, H), ctx = canvas.getContext('2d');
setCtx(ctx); init(ctx);
const total = Math.round(DUR * FPS);
const acc = new Uint32Array(W * H * 4), out = Buffer.alloc(W * H * 4);

function draw(t) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.fillStyle = '#17162f'; ctx.fillRect(0, 0, W, H); frame(t); }
export function render(t) {
  const n = Math.max(1, Math.min(MAX_SUB, Math.ceil(motion(t) / PX_PER_SUB)));
  if (n === 1) { draw(t); return [canvas.data(), 1]; }
  // the shutter stays on one side of a cut or a state switch: the first frame of a shot never shows the end of the previous one
  let open = t - SHUTTER / 2;
  for (const c of [...CUTS, ...SNAPS]) { if (t >= c && open < c) open = c; else if (t < c && open + SHUTTER >= c) open = c - SHUTTER - 1e-6; }
  acc.fill(0);
  for (let j = 0; j < n; j++) {
    draw(open + (j + 0.5) / n * SHUTTER);
    const d = canvas.data();
    for (let k = 0; k < d.length; k++) acc[k] += d[k];
  }
  for (let k = 0; k < out.length; k++) out[k] = (acc[k] + (n >> 1)) / n;
  return [out, n];
}
function ffmpeg(file) {
  return spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '12', '-pix_fmt', 'yuv420p', '-r', String(FPS), file], { stdio: ['pipe', 'inherit', 'inherit'] });
}

const [mode, ...args] = process.argv.slice(2);
if (mode === 'stills') {
  const [dir, ...ts] = args;
  fs.mkdirSync(dir, { recursive: true });
  const view = createCanvas(W, H), vc = view.getContext('2d');
  for (const s of ts) {
    const t = parseFloat(s), t0 = Date.now();
    const [data, n] = render(t);
    const img = vc.createImageData(W, H); img.data.set(data); vc.putImageData(img, 0, 0);
    vc.font = '700 40px Oswald'; vc.textAlign = 'right'; vc.fillStyle = '#00ff88'; vc.fillText(`${t.toFixed(3)}  ×${n}`, 1060, 1900);
    fs.writeFileSync(path.join(dir, `f_${t.toFixed(3).padStart(7, '0')}.jpg`), view.encodeSync('jpeg', 88));
    console.log(t.toFixed(3), `×${n}`, Date.now() - t0, 'ms');
  }
} else if (mode === 'part') {
  const [a, b, file] = [parseInt(args[0]), parseInt(args[1]), args[2]];
  const ff = ffmpeg(file), t0 = Date.now();
  let subs = 0;
  for (let i = a; i < b; i++) {
    const [data, n] = render(i / FPS); subs += n;
    if (!ff.stdin.write(Buffer.from(data))) await once(ff.stdin, 'drain');
    if ((i - a) % 120 === 0) console.log(`part ${a}-${b}: frame ${i} (${((Date.now() - t0) / Math.max(1, i - a + 1)).toFixed(0)} ms/frame)`);
  }
  ff.stdin.end();
  await once(ff, 'close');
  console.log(`part ${a}-${b}: ${b - a} frames, ${subs} renders`);
} else if (mode === 'video') {
  const file = args[0], n = parseInt(args[1] || '4');
  const dir = path.join(ROOT, 'build/parts');
  fs.mkdirSync(dir, { recursive: true });
  const jobs = [];
  for (let k = 0; k < n; k++) {
    const a = Math.floor(total * k / n), b = Math.floor(total * (k + 1) / n), f = path.join(dir, `p${k}.mp4`);
    const p = spawn(process.execPath, [fileURLToPath(import.meta.url), 'part', String(a), String(b), f], { stdio: 'inherit' });
    jobs.push(once(p, 'close').then(([code]) => { if (code) throw new Error(`part ${k} failed`); return f; }));
  }
  const parts = await Promise.all(jobs);
  fs.writeFileSync(path.join(dir, 'list.txt'), parts.map(f => `file '${f}'`).join('\n'));
  const cat = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', path.join(dir, 'list.txt'), '-c', 'copy', file], { stdio: 'inherit' });
  await once(cat, 'close');
  console.log('frames', total, '→', file);
} else if (mode === 'cues') {
  fs.writeFileSync(args[0], JSON.stringify({ duration: DUR, fps: FPS, marks: MARKS, cues: cues() }, null, 1));
  console.log(cues().length, 'cues →', args[0]);
}
