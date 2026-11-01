// Render «Зомби в панельке»: stills for review, or the picture track (raw frames piped into ffmpeg, split over workers).
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
import { setCtx, W, H } from './src/draw.js';
import { init, frame, duration, cues, anchors } from './src/main.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const FPS = 30;
for (const f of ['Oswald-700.ttf', 'Oswald-600.ttf']) GlobalFonts.registerFromPath(path.join(ROOT, 'fonts', f), 'Oswald');
GlobalFonts.registerFromPath(path.join(ROOT, 'fonts', 'RubikWetPaint.ttf'), 'WetPaint');
const timing = JSON.parse(fs.readFileSync(path.join(ROOT, 'build/timing.json'), 'utf8'));
const env = JSON.parse(fs.readFileSync(path.join(ROOT, 'build/valya/valya_env.json'), 'utf8'));
init(timing, env);
const canvas = createCanvas(W, H);
setCtx(canvas.getContext('2d'));

const [mode, ...args] = process.argv.slice(2);
const total = Math.round(duration() * FPS);

function ffmpeg(out) {
  return spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '12', '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] });
}

if (mode === 'stills') {
  const [dir, ...ts] = args;
  fs.mkdirSync(dir, { recursive: true });
  for (const s of ts) {
    const t = parseFloat(s), t0 = Date.now();
    frame(t);
    const c = canvas.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1;
    c.font = '700 44px Oswald'; c.textAlign = 'right'; c.fillStyle = '#00ff88'; c.fillText(t.toFixed(2), 1060, 1900);
    fs.writeFileSync(path.join(dir, `f_${t.toFixed(2).padStart(6, '0')}.jpg`), canvas.encodeSync('jpeg', 88));
    console.log(t.toFixed(2), Date.now() - t0, 'ms');
  }
} else if (mode === 'part') {
  const [a, b, out] = [parseInt(args[0]), parseInt(args[1]), args[2]];
  const ff = ffmpeg(out);
  const t0 = Date.now();
  for (let i = a; i < b; i++) {
    frame(i / FPS);
    if (!ff.stdin.write(canvas.data())) await once(ff.stdin, 'drain');
    if ((i - a) % 150 === 0) console.log(`part ${a}-${b}: frame ${i} (${((Date.now() - t0) / Math.max(1, i - a)).toFixed(0)} ms/frame)`);
  }
  ff.stdin.end();
  await once(ff, 'close');
} else if (mode === 'video') {
  const out = args[0], n = parseInt(args[1] || '4');
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
  const cat = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', path.join(dir, 'list.txt'), '-c', 'copy', out], { stdio: 'inherit' });
  await once(cat, 'close');
  console.log('frames', total, '→', out);
} else if (mode === 'cues') {
  fs.writeFileSync(args[0], JSON.stringify({ total: duration(), anchors: anchors(), cues: cues() }, null, 1));
  console.log(cues().length, 'cues →', args[0]);
}
