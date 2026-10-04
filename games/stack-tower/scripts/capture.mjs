// Records the autopilot run as a 1080x1920 MP4 with sound.
//
//   node scripts/capture.mjs --seed 7 --floor 26
//
// The game is stepped frame by frame (no real-time recording), so the clip is
// smooth at any machine speed and the same seed always gives the same video.
// Sound is synthesized offline from the game's drop events with the same
// tone design the browser uses (src/core/Tones.js).

import { createServer } from 'vite';
import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { tonesFor } from '../src/core/Tones.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(
  process.argv.slice(2).join(' ').split('--').filter(Boolean).map(a => { const [k, v] = a.trim().split(/\s+/); return [k, v ?? true]; }),
);
const seed = parseInt(args.seed ?? '7', 10);
const floor = args.floor ? parseInt(args.floor, 10) : 0;
const fps = parseInt(args.fps ?? '60', 10);
const tail = parseFloat(args.tail ?? '3.4');
const out = path.resolve(root, args.out ?? `output/tower-seed${seed}${floor ? `-floor${floor}` : ''}.mp4`);
const framesDir = path.join(root, 'output', `frames-${seed}`);
const SR = 48000;

function synth(events, duration) {
  const buf = new Float32Array(Math.ceil(duration * SR));
  for (const ev of events) {
    for (const p of tonesFor(ev)) {
      const start = Math.floor((ev.t + p.at) * SR);
      const len = Math.floor(p.dur * SR);
      let phase = 0;
      for (let i = 0; i < len && start + i < buf.length; i++) {
        const u = i / len;
        const f = p.freqEnd ? p.freq * Math.pow(p.freqEnd / p.freq, u) : p.freq;
        phase += f / SR;
        const x = phase % 1;
        let w;
        if (p.wave === 'sine') w = Math.sin(2 * Math.PI * x);
        else if (p.wave === 'triangle') w = 4 * Math.abs(x - 0.5) - 1;
        else w = (x < 0.5 ? 1 : -1) * 0.6;
        const attack = Math.min(1, i / (0.005 * SR));
        const env = attack * Math.pow(0.0001, u);
        if (start + i >= 0) buf[start + i] += w * env * p.gain;
      }
    }
  }
  const pcm = Buffer.alloc(44 + buf.length * 2);
  pcm.write('RIFF', 0); pcm.writeUInt32LE(36 + buf.length * 2, 4); pcm.write('WAVE', 8);
  pcm.write('fmt ', 12); pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(1, 22);
  pcm.writeUInt32LE(SR, 24); pcm.writeUInt32LE(SR * 2, 28); pcm.writeUInt16LE(2, 32); pcm.writeUInt16LE(16, 34);
  pcm.write('data', 36); pcm.writeUInt32LE(buf.length * 2, 40);
  for (let i = 0; i < buf.length; i++) pcm.writeInt16LE(Math.round(Math.tanh(buf[i] * 1.2) * 30000), 44 + i * 2);
  return pcm;
}

const server = await createServer({ root, server: { port: 0 }, logLevel: 'error' });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('page error:', e.message));
  await page.goto(`${url}?capture&seed=${seed}${floor ? `&floor=${floor}` : ''}`);
  await page.waitForFunction(() => window.__capture?.status().ready, null, { timeout: 30000 });

  rmSync(framesDir, { recursive: true, force: true });
  mkdirSync(framesDir, { recursive: true });
  mkdirSync(path.dirname(out), { recursive: true });

  const dt = 1 / fps;
  let n = 0;
  for (;;) {
    const res = await page.evaluate(async ([step, first]) => {
      if (!first) window.__capture.advance(step);
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      return { img: document.querySelector('canvas').toDataURL('image/jpeg', 0.93), st: window.__capture.status() };
    }, [dt, n === 0]);
    writeFileSync(path.join(framesDir, `${String(n).padStart(5, '0')}.jpg`), Buffer.from(res.img.split(',')[1], 'base64'));
    n += 1;
    if (n % 120 === 0) console.log(`frame ${n}, t=${res.st.time.toFixed(2)}s, floor ${res.st.floor}`);
    if ((res.st.failed && res.st.time - res.st.failTime > tail) || n > fps * 60) break;
  }
  const duration = n / fps;
  const events = await page.evaluate(() => window.__capture.sounds());
  const wav = path.join(framesDir, 'audio.wav');
  writeFileSync(wav, synth(events, duration));

  const ff = spawnSync('ffmpeg', [
    '-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(framesDir, '%05d.jpg'), '-i', wav,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out,
  ], { stdio: 'inherit' });
  if (ff.status !== 0) throw new Error('ffmpeg failed');
  const final = events.filter(e => e.type === 'fail')[0];
  console.log(`saved ${path.relative(root, out)}: ${duration.toFixed(1)}s, ${n} frames, fell on floor ${final?.floor ?? '?'}`);
  if (!args.keep && existsSync(framesDir)) rmSync(framesDir, { recursive: true, force: true });
} finally {
  await browser.close();
  await server.close();
}
