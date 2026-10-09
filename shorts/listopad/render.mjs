// Рендер кадров в headless Chromium (WebGL через SwiftShader) → JPEG → ffmpeg.
// node render.mjs [--shot 3.2,9.5 out/stills] | [--from 0 --to 22.5 --out out/part.mp4]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? a.push([v.slice(2), arr[i + 1]]) : 0, a), []));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  const f = path.join(HERE, decodeURIComponent(q.url.split('?')[0]));
  if (!f.startsWith(HERE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
}).listen(0);
const port = srv.address().port;
const browser = await chromium.launch({
  executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
});
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
page.on('console', m => console.log('[page]', m.text())); page.on('pageerror', e => console.log('[err]', e.message));
await page.goto(`http://127.0.0.1:${port}/index.html`);
await page.waitForFunction('window.ready === true', null, { timeout: 180000 });
const fps = 30;
if (args.shot) {
  const dir = path.resolve(HERE, args.dir || 'out/stills'); fs.mkdirSync(dir, { recursive: true });
  for (const t of args.shot.split(',').map(Number)) {
    const t0 = Date.now();
    const url = await page.evaluate(t => window.frameJPEG(t, .9), t);
    fs.writeFileSync(path.join(dir, `t${t.toFixed(2)}.jpg`), Buffer.from(url.split(',')[1], 'base64'));
    console.log('still', t, Date.now() - t0, 'ms');
  }
} else {
  const from = +(args.from ?? 0), to = +(args.to ?? await page.evaluate('window.DUR'));
  const outFile = path.resolve(HERE, args.out || 'out/video.mp4'); fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', outFile], { stdio: ['pipe', 'inherit', 'inherit'] });
  const n0 = Math.round(from * fps), n1 = Math.round(to * fps);
  const T = Date.now();
  for (let n = n0; n < n1; n++) {
    const url = await page.evaluate(t => window.frameJPEG(t, .95), n / fps);
    if (!ff.stdin.write(Buffer.from(url.split(',')[1], 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
    if ((n - n0) % 30 === 0) console.log(`frame ${n}/${n1} ${((Date.now() - T) / (n - n0 + 1)).toFixed(0)} ms/frame`);
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r));
  console.log('done', outFile);
}
await browser.close(); srv.close();
