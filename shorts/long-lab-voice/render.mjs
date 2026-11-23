// Render «Я поверил голосу из закрытой лаборатории» (1920×1080, 30 fps) from build/timeline.json and img/*.jpg.
// usage: node render.mjs stills <out dir> <t> [<t> ...]
//        node render.mjs video <out.mp4> [workers = 4]     (picture only; the sound is muxed after)
//        node render.mjs part <first frame> <end frame> <out.mp4>
//        node render.mjs cover <out.jpg>                    (the 1280×720 thumbnail)
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { init, frame, preload, need, coverVariant, COVER_IMGS, TL, W, H } from './src/film.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const FPS = 30;
GlobalFonts.registerFromPath(path.join(ROOT, 'fonts', 'Oswald-700.ttf'), 'Oswald');
GlobalFonts.registerFromPath(path.join(ROOT, 'fonts', 'DejaVuSansMono-Bold.ttf'), 'MonoBold');
GlobalFonts.registerFromPath('/usr/share/fonts/opentype/inter/Inter-SemiBold.otf', 'Inter');
const canvas = createCanvas(W, H), ctx = canvas.getContext('2d');
await init(ctx, ROOT, createCanvas);
const total = Math.round(TL.dur * FPS);

async function draw(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  await preload(t);
  frame(t);
}
function ffmpeg(file) {
  return spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-maxrate', '12M', '-bufsize', '24M', '-pix_fmt', 'yuv420p', '-r', String(FPS), file], { stdio: ['pipe', 'inherit', 'inherit'] });
}

const [mode, ...args] = process.argv.slice(2);
if (mode === 'stills') {
  const [dir, ...ts] = args;
  fs.mkdirSync(dir, { recursive: true });
  for (const s of ts) {
    const t = parseFloat(s), t0 = Date.now();
    await draw(t);
    ctx.font = '700 30px Oswald'; ctx.textAlign = 'right'; ctx.fillStyle = '#00ff88'; ctx.fillText(t.toFixed(2), W - 20, H - 20);
    fs.writeFileSync(path.join(dir, `f_${t.toFixed(2).padStart(7, '0')}.jpg`), canvas.encodeSync('jpeg', 85));
    console.log(t.toFixed(2), Date.now() - t0, 'ms');
  }
} else if (mode === 'cover') {
  const k = args[1] ?? 'a';
  await need(...COVER_IMGS[k]);
  coverVariant(k);
  const small = createCanvas(1280, 720), sc = small.getContext('2d');
  sc.drawImage(canvas, 0, 0, 1280, 720);
  fs.writeFileSync(args[0], small.encodeSync('jpeg', 92));
  console.log('cover', args[0]);
} else if (mode === 'part') {
  const [a, b, file] = [parseInt(args[0]), parseInt(args[1]), args[2]];
  const ff = ffmpeg(file), t0 = Date.now();
  for (let i = a; i < b; i++) {
    await draw(i / FPS);
    if (!ff.stdin.write(Buffer.from(canvas.data()))) await once(ff.stdin, 'drain');
    if ((i - a) % 300 === 0) console.log(`part ${a}-${b}: frame ${i} (${((Date.now() - t0) / Math.max(1, i - a + 1)).toFixed(0)} ms/frame)`);
  }
  ff.stdin.end();
  await once(ff, 'close');
  console.log(`part ${a}-${b}: done`);
} else if (mode === 'video') {
  const file = args[0], n = parseInt(args[1] || '4');
  const dir = path.join(ROOT, 'build/parts');
  fs.mkdirSync(dir, { recursive: true });
  const jobs = [];
  for (let k = 0; k < n; k++) {
    const a = Math.floor(total * k / n), b = Math.floor(total * (k + 1) / n), f = path.join(dir, `p${k}.mp4`);
    const p = spawn(process.execPath, [fileURLToPath(import.meta.url), 'part', String(a), String(b), f], { stdio: 'inherit' });
    jobs.push(once(p, 'close'));
  }
  await Promise.all(jobs);
  const list = path.join(dir, 'list.txt');
  fs.writeFileSync(list, [...Array(n).keys()].map(k => `file 'p${k}.mp4'`).join('\n'));
  const c = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', file], { stdio: 'inherit' });
  await once(c, 'close');
  console.log('video', file, total, 'frames');
}
