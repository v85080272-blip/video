// Renders finished Trend Studio clips straight to MP4 (1080×1920, 60 fps,
// with sound), no screen recording needed. Needs Playwright's Chromium and ffmpeg.
//
//   node scripts/render-studio.mjs clips.json out-dir
//
// clips.json: [{ "name": "bitva-mesyacev", "format": "survive",
//                "params": { "set": "months" }, "seed": 123 | "search", "searchFrom"?: 5000 }]
// RUBIK_DIR: folder with rubik-*-normal.woff2 (npm @fontsource/rubik, files/)
// when the Google Fonts CDN can't be reached.

import { build } from 'esbuild';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import os from 'node:os';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = createRequire(path.join(process.env.NODE_PATH || '/opt/node-tools/node_modules', 'x'))('playwright'));
}

const FPS = 60;
const RATE = 44100;
const root = new URL('..', import.meta.url);
const [clipsFile, outDir = 'renders'] = process.argv.slice(2);
const clips = JSON.parse(await readFile(clipsFile, 'utf8'));
await mkdir(outDir, { recursive: true });

const fontDir = process.env.RUBIK_DIR;
const faces = fontDir
  ? ['cyrillic', 'latin'].flatMap((sub) => [700, 800, 900].map((w) =>
      `@font-face{font-family:Rubik;font-weight:${w};src:url(${pathToFileURL(path.join(fontDir, `rubik-${sub}-${w}-normal.woff2`))})}`)).join('')
  : '';
const fontLink = fontDir ? '' : '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Rubik:wght@700;800;900&display=swap">';

const { outputFiles } = await build({
  entryPoints: [new URL('src/studio/render.js', root).pathname],
  bundle: true, format: 'iife', write: false, target: 'es2020',
});
const page = path.join(os.tmpdir(), 'studio-render.html');
await writeFile(page, `<!doctype html><meta charset="utf-8">${fontLink}<style>${faces}body{margin:0}</style><body><script>${outputFiles[0].text}</script>`);

const browser = await chromium.launch();
const tab = await browser.newPage();
await tab.goto(pathToFileURL(page).href);
await tab.evaluate(() => Promise.all([700, 800, 900].map((w) => document.fonts.load(`${w} 80px Rubik`))));

const run = (cmd, args) => new Promise((resolve, reject) =>
  spawn(cmd, args, { stdio: 'inherit' }).on('close', (c) => (c ? reject(new Error(`${cmd} exited ${c}`)) : resolve())));

for (const clip of clips) {
  const params = { ...(await tab.evaluate((id) => window.studio.defaults(id), clip.format)), ...clip.params };
  let seed = clip.seed;
  if (seed === 'search') {
    // searchFrom keeps two clips of the same format from landing on the same seed
    seed = (await tab.evaluate(([id, p, from]) => window.studio.search(id, p, from), [clip.format, params, clip.searchFrom || 1000])).seed;
  }
  await tab.evaluate(([id, p, s]) => window.studio.start(id, p, s), [clip.format, params, seed]);

  const silent = path.join(outDir, `.${clip.name}.video.mp4`);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', silent], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((r) => ff.on('close', r));
  let n = 0;
  for (;;) {
    const { over, data } = await tab.evaluate((t) => window.studio.frame(t), n / FPS);
    if (!ff.stdin.write(Buffer.from(data.split(',')[1], 'base64'))) await new Promise((r) => ff.stdin.once('drain', r));
    n++;
    if (over) break;
  }
  ff.stdin.end();
  await done;

  const len = n / FPS;
  const wav = path.join(outDir, `.${clip.name}.wav`);
  await writeFile(wav, synth(await tab.evaluate(() => window.studio.events()), len));
  const out = path.join(outDir, `${clip.name}.mp4`);
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', silent, '-i', wav,
    '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
    '-movflags', '+faststart', '-shortest', out]);
  await rm(silent);
  await rm(wav);
  console.log(`${out}: ${len.toFixed(1)} s, seed ${seed}`);
}
await browser.close();

// The same voices the page's Web Audio synth uses, mixed offline.
function synth(events, len) {
  const total = Math.ceil((len + 1) * RATE);
  const mix = new Float32Array(total);
  const LEN = { tick: 0.05, pop: 0.18, boom: 0.5, bell: 0.9 };
  let winStart = -1;
  let winCount = 0;
  for (const [t, freq, type, vol0] of events.sort((a, b) => a[0] - b[0])) {
    // like the live page: at most a few sounds in any 50 ms window
    if (t - winStart > 0.05) { winStart = t; winCount = 0; }
    if (++winCount > 4 && type !== 'bell' && type !== 'boom') continue;
    const vol = vol0 * (type === 'tick' ? 0.35 : 1) * 0.3;
    const dur = LEN[type] || 0.2;
    const start = Math.floor(t * RATE);
    let phase = 0;
    for (let i = 0; i < dur * RATE && start + i < total; i++) {
      const s = i / RATE;
      const f = type === 'boom' ? freq * Math.pow(0.35, s / dur) : freq;
      phase += f / RATE;
      const p = phase % 1;
      const wave = type === 'tick' ? (p < 0.5 ? 1 : -1)
        : type === 'pop' ? 4 * Math.abs(p - 0.5) - 1
        : Math.sin(2 * Math.PI * p);
      const env = s < 0.008 ? s / 0.008 : Math.exp((-6.9 * (s - 0.008)) / dur);
      mix[start + i] += wave * env * vol;
    }
  }
  const buf = Buffer.alloc(44 + total * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + total * 2, 4); buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(RATE, 24); buf.writeUInt32LE(RATE * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(total * 2, 40);
  for (let i = 0; i < total; i++) buf.writeInt16LE(Math.round(Math.tanh(mix[i] * 1.5) * 32000), 44 + i * 2);
  return buf;
}
