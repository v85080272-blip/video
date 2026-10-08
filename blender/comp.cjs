// Assembles the rounds rendered by melon3d.py into one MP4 with captions and sound.
//
//   node blender/comp.cjs job.json
//
// job.json: { "rounds": ["out/r0", ...], "out": "clip.mp4", "work": "tmpdir",
//             "fonts": ".../@fontsource/rubik/files", "crf": 21 }
// Needs Playwright (Chromium), ffmpeg and esbuild.
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const job = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const work = path.resolve(job.work);
fs.mkdirSync(work, { recursive: true });

const esbuild = path.join(__dirname, '..', 'node_modules', '.bin', 'esbuild');
execFileSync(esbuild, [path.join(__dirname, 'comp.js'), '--bundle', '--format=iife', `--outfile=${work}/comp.bundle.js`], { stdio: 'inherit' });

const face = (w, sub, range) =>
  `@font-face{font-family:"Rubik";font-weight:${w};src:url("file://${job.fonts}/rubik-${sub}-${w}-normal.woff2") format("woff2");unicode-range:${range}}`;
const cyr = 'U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116';
const lat = 'U+0000-00FF,U+2000-206F,U+20AC,U+2122,U+2212';
fs.writeFileSync(
  `${work}/comp.html`,
  `<!doctype html><html><head><meta charset="utf-8"><style>${[800, 900].map((w) => face(w, 'cyrillic', cyr) + face(w, 'latin', lat)).join('')}body{margin:0;background:#000}</style></head><body><canvas id="c"></canvas><script src="comp.bundle.js"></script></body></html>`,
);

const run = (args) => new Promise((ok) => spawn('ffmpeg', args, { stdio: 'inherit' }).on('close', ok));

(async () => {
  const rounds = job.rounds.map((d) => JSON.parse(fs.readFileSync(path.join(d, 'meta.json'), 'utf8')));
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 400, height: 400 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(`file://${work}/comp.html`);
  await page.evaluate(() => Promise.all(['900 80px Rubik', '800 40px Rubik'].map((f) => document.fonts.load(f, 'Ж'))));
  const total = await page.evaluate((r) => window.setup(r), rounds);
  const fps = rounds[0].fps;
  const video = `${work}/video.mp4`;
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', String(job.crf || 21), '-pix_fmt', 'yuv420p', '-r', String(fps), video]);
  let g = 0;
  for (const [r, m] of rounds.entries()) {
    for (let f = 0; f < m.frames.length; f++, g++) {
      const file = path.join(job.rounds[r], `f${String(f).padStart(4, '0')}.png`);
      const src = 'data:image/png;base64,' + fs.readFileSync(file).toString('base64');
      const jpg = Buffer.from(await page.evaluate(([i, s]) => window.frame(i, s), [g, src]), 'base64');
      if (!ff.stdin.write(jpg)) await new Promise((ok) => ff.stdin.once('drain', ok));
      if (job.stills && job.stills.includes(g)) fs.writeFileSync(`${work}/still-${g}.jpg`, jpg);
    }
  }
  ff.stdin.end();
  await new Promise((ok) => ff.on('close', ok));
  const a = await page.evaluate(() => window.renderAudio());
  fs.writeFileSync(`${work}/audio.wav`, Buffer.from(a.wav, 'base64'));
  await b.close();
  await run(['-y', '-loglevel', 'error', '-i', video, '-i', `${work}/audio.wav`, '-c:v', 'copy', '-af', 'loudnorm=I=-14:TP=-1.5',
    '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-shortest', '-movflags', '+faststart', job.out]);
  console.log('frames', total, 'secs', (total / fps).toFixed(1), 'sounds', a.events, 'peak', a.peak.toFixed(2), '->', job.out);
})();
