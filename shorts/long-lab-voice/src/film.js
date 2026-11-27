// The picture of «Я поверил голосу из закрытой лаборатории»: 1920×1080, from build/timeline.json (tools/lab.py) and the
// Codex frames img/01–50.jpg. Slow camera moves over the frames (dissolves, hard cuts on the scares), a cold grade with
// grain and vignette, the dark stretch with the torch off, the CCTV look, and everything with letters drawn here
// (Codex draws no clean Russian text): the title, the memo, the screens, the name tag, the plan, the countdown,
// the phone message, and the subtitles with who is speaking.
import { loadImage } from '@napi-rs/canvas';
import fs from 'node:fs';
import path from 'node:path';

// VERT=1 renders a vertical 1080×1920 version for Shorts cut from the film: the frames fill the height (cropped around
// a focus point), the overlays made for 16:9 are drawn into a centred 16:9 band, the subtitles sit higher (above the
// Shorts buttons) and the last seconds of a clip say where the full story is.
export const VERT = process.env.VERT === '1';
export let W = VERT ? 1080 : 1920, H = VERT ? 1920 : 1080;
const CLIP_END = parseFloat(process.env.CLIP_END ?? 'NaN');
const FOCUS = { 1: 0.42, 2: 0.7, 3: 0.4, 4: 0.5, 5: 0.32, 6: 0.78, 7: 0.3, 8: 0.55, 9: 0.55, 32: 0.55, 47: 0.6, 19: 0.55, 20: 0.62, 21: 0.33, 22: 0.45, 23: 0.48, 24: 0.6, 30: 0.67, 31: 0.45, 32: 0.4, 33: 0.5, 34: 0.65, 35: 0.3 };
function virtual(fn) {                                   // draw a 16:9 overlay into the vertical frame's middle band
  if (!VERT) return fn();
  const w = W, h = H, k = 1080 / 1920;
  g.save(); g.translate(0, (1920 - 1080 * k) / 2 - 140); g.scale(k, k); W = 1920; H = 1080;
  try { fn(); } finally { W = w; H = h; g.restore(); }
}
let g = null, ROOT = '.';
export const TL = { dur: 0 };
const IMG = new Map();
let grain = [], scan = null;

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const ease = x => (x = clamp(x), x * x * (3 - 2 * x));
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const lerp = (a, b, k) => a + (b - a) * k;

export async function init(ctx, root, makeCanvas) {
  g = ctx; ROOT = root;
  Object.assign(TL, JSON.parse(fs.readFileSync(path.join(root, 'build/timeline.json'), 'utf8')));
  for (let k = 0; k < 4; k++) {                                     // grain tiles
    const c = makeCanvas(480, 270), x = c.getContext('2d'), d = x.createImageData(480, 270);
    for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    x.putImageData(d, 0, 0); grain.push(c);
  }
  scan = makeCanvas(W, H); const s = scan.getContext('2d');
  for (let y = 0; y < H; y += 4) { s.fillStyle = 'rgba(0,0,0,0.22)'; s.fillRect(0, y, W, 2); }
  TL.T = Object.fromEntries(TL.lines.map(l => [l.id, [l.t0, l.t1]]));
  TL.mk = Object.fromEntries(TL.shots.map(s => [s.ev, s.t0]));
}

// —— frames: the Codex image, or a numbered placeholder until it arrives ——
async function img(n) {
  if (IMG.has(n)) return IMG.get(n);
  const f = path.join(ROOT, 'img', `${String(n).padStart(2, '0')}.jpg`);
  const v = fs.existsSync(f) ? await loadImage(f) : null;
  IMG.set(n, v);
  if (IMG.size > 6) IMG.delete(IMG.keys().next().value);
  return v;
}
export async function need(...ns) { for (const n of ns) await img(n); }
export async function preload(t) {
  for (const s of TL.shots) if (s.img && s.t1 > t - 1 && s.t0 < t + 1) await img(s.img);
}

// hard cuts: the scares and the door that stops; everything else dissolves
const HARD = new Set(['B01', 'B02', 'L22', 'B13', 'B16', 'L35', 'B15', 'L52', 'L53', 'L55', 'L59', 'L61', 'B22']);
const XF = 0.7;

function move(s, k) {
  // each shot drifts and zooms its own way (seeded by its place in the film), slower on the long ones
  const i = TL.shots.indexOf(s), dur = s.t1 - s.t0;
  const zin = hash(i * 3.1) > 0.4, z0 = zin ? 1.04 : 1.13, z1 = zin ? 1.13 : 1.04;
  const amp = clamp(dur / 12, 0.35, 1) * 0.035;
  const ax = (hash(i * 7.7) - 0.5) * 2 * amp, ay = (hash(i * 5.3) - 0.5) * 1.2 * amp;
  return { z: lerp(z0, z1, k), dx: lerp(-ax, ax, k) * W, dy: lerp(-ay, ay, k) * H };
}
function shake(t) {
  let a = 0;
  const run = [TL.T.L52?.[0] ?? 0, TL.T.L56?.[0] ?? 0];
  if (t > run[0] && t < run[1]) a = 7;
  const hit = TL.cuts.door_stop;
  if (t > hit && t < hit + 0.6) a = Math.max(a, 26 * (1 - (t - hit) / 0.6));
  const tb = TL.overlays.find(o => o.kind === 'title');
  if (tb && t > tb.t0 && t < tb.t0 + 0.5) a = Math.max(a, 10 * (1 - (t - tb.t0) / 0.5));
  return [Math.sin(t * 53) * a * 0.6 + Math.sin(t * 31) * a * 0.4, Math.cos(t * 47) * a * 0.5 + Math.sin(t * 23) * a * 0.3];
}

function drawShot(s, t, alpha) {
  if (!s.img) return;
  const v = IMG.get(s.img), k = clamp((t - s.t0) / Math.max(0.1, s.t1 - s.t0 + XF));
  const m = move(s, k), [sx, sy] = shake(t);
  g.save(); g.globalAlpha = alpha;
  g.translate(W / 2 + m.dx + sx, H / 2 + m.dy + sy); g.scale(m.z, m.z);
  if (VERT) {                                            // fill the height, keep the frame's focus in the middle
    const sc = H / 1080, half = (1920 * sc - W) / 2;
    g.translate(clamp(-((FOCUS[s.img] ?? 0.5) - 0.5) * 1920 * sc, -half, half), 0); g.scale(sc, sc);
  }
  if (v) { g.drawImage(v, -960, -540, 1920, 1080); inImage(s.img, t); }
  else {
    const r = g.createLinearGradient(0, -H / 2, 0, H / 2); r.addColorStop(0, '#1c2730'); r.addColorStop(1, '#06090c');
    g.fillStyle = r; g.fillRect(-W / 2, -H / 2, W, H);
    g.fillStyle = 'rgba(160,200,220,0.25)'; g.font = '700 300px Oswald'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(String(s.img).padStart(2, '0'), 0, -40);
  }
  g.restore();
  if ([27, 28].includes(s.img)) cctv(s, t, alpha);
}

// letters that sit on things inside a frame move with it: drawn in the frame's own coordinates (u, v in 0..1)
const U = u => -960 + u * 1920, V = v => -540 + v * 1080;
function inImage(n, t) {
  onScreens(n, t);
  if (n === 23) {                                                   // the blank metal tag: x 0.305–0.655, y 0.375–0.585
    const o = TL.overlays.find(o => o.kind === 'badge'), a = o ? ease((t - o.t0 - 0.6) / 0.5) : 1;
    g.save(); g.globalAlpha = a; g.translate(U(0.48), V(0.485)); g.rotate(-0.01);
    g.font = '700 112px Oswald'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.letterSpacing = '8px';
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillText('СОКОЛОВ', 2, -12);           // engraved: a light lip under a dark cut
    g.fillStyle = 'rgba(25,28,32,0.86)'; g.fillText('СОКОЛОВ', 0, -15);
    g.font = '700 24px MonoBold'; g.letterSpacing = '3px'; g.fillStyle = 'rgba(25,28,32,0.72)';
    g.fillText('СЛУЖБА ОХРАНЫ · СЕКТОР 4', 0, 68);
    g.letterSpacing = '0px'; g.restore();
  }
  if (n === 21) {                                                   // the monitor's screen: x 0.165–0.515, y 0.125–0.585
    const o = TL.overlays.find(o => o.kind === 'progress');
    const x = U(0.172), y = V(0.135), w = U(0.508) - x, h = V(0.575) - y;
    g.save(); g.fillStyle = 'rgba(4,22,24,0.93)'; g.fillRect(x, y, w, h);
    g.font = '700 46px MonoBold'; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillStyle = '#5ff0e0';
    g.fillText('ПОДГОТОВКА ШЛЮЗА', x + 40, y + 90);
    let p = o ? clamp((t - o.t0) / 40) * 0.64 + 0.02 : 0.3;
    const back = TL.T.L50b?.[0];                                    // seen again before the countdown: almost done
    if (back && t > back - 1.5) p = 0.95 + 0.04 * clamp((t - back) / 4);
    g.fillStyle = '#0d3a3a'; g.fillRect(x + 40, y + 160, w - 80, 56);
    g.fillStyle = '#45ead8'; g.fillRect(x + 40, y + 160, (w - 80) * p, 56);
    g.font = '700 34px MonoBold'; g.fillStyle = '#5ff0e0';
    g.fillText(`${Math.round(p * 100)}%`, x + 40, y + 270);
    g.fillText('АВАРИЙНЫЙ ШЛЮЗ 4-И', x + 40, y + 330);
    g.fillStyle = Math.floor(t * 2) % 2 ? '#ff5050' : '#5ff0e0'; g.fillText('ИЗОЛЯТОР → КОРПУС', x + 40, y + 390);
    g.restore();
  }
}

const mmss = n => (n >= 60 ? '01:00' : `00:${String(n).padStart(2, '0')}`);
function countLeft(t) {
  const o = TL.overlays.find(x => x.kind === 'timer'), sv = TL.overlays.find(x => x.kind === 'saved');
  if (!o) return 60;
  const end = sv ? sv.t0 : o.t1;
  return t >= end ? 3 : Math.max(3, Math.ceil(60 - 57 * clamp((t - o.t0) / (end - o.t0))));
}
function onScreens(n, t) {
  if (n === 30) {                                                   // the red screen: x 0.48–0.87, y 0.12–0.60; its box x 0.52–0.81, y 0.32–0.44
    g.save(); g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '700 64px Oswald'; g.fillStyle = 'rgba(20,0,0,0.88)'; g.fillText('СНЯТИЕ КАРАНТИНА', U(0.665), V(0.235));
    g.font = '700 150px MonoBold'; g.fillStyle = Math.floor(t * 2) % 2 ? '#2a0000' : '#ffffff';
    g.fillText(mmss(countLeft(t)), U(0.665), V(0.385));
    g.font = '700 30px MonoBold'; g.fillStyle = 'rgba(20,0,0,0.8)'; g.fillText('ОТМЕНА С ПУЛЬТА НЕДОСТУПНА', U(0.665), V(0.52));
    g.restore();
  }
  if (n === 41) {                                                   // the phone's screen: x 0.385–0.615, y 0.11–0.90
    const o = TL.overlays.find(x => x.kind === 'message');
    const x = U(0.389), y = V(0.115), w = U(0.611) - x, h = V(0.895) - y;
    g.save(); g.globalAlpha = 0.93; g.fillStyle = '#0b0e14'; rr(x, y, w, h, 34); g.fill(); g.globalAlpha = 1;
    g.fillStyle = '#1a2130'; g.fillRect(x + 10, y + 10, w - 20, 84);
    g.font = '600 28px Inter'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#e6ebf2'; g.fillText('Диспетчерская ЧС', x + w / 2, y + 52);
    const n0 = o ? Math.floor(clamp((t - o.t0 - 0.4) / (o.t1 - o.t0 - 1.6)) * MSG.length) : MSG.length;
    const lines = wrap(MSG.slice(0, n0) + (n0 < MSG.length && Math.floor(t * 3) % 2 ? '|' : ''), 30, w - 110, 'Inter');
    const bw = w - 50, bh = 36 + lines.length * 42, bx = x + 25, by = y + 150;
    g.fillStyle = '#2f6fe0'; rr(bx, by, bw, bh, 22); g.fill();
    g.font = '600 30px Inter'; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillStyle = '#fff';
    lines.forEach((l, i) => g.fillText(l, bx + 24, by + 46 + i * 42));
    if (n0 >= MSG.length) { g.font = '600 22px Inter'; g.textAlign = 'right'; g.fillStyle = '#8fa3c0'; g.fillText('Доставлено ✓✓', bx + bw, by + bh + 34); }
    g.restore();
  }
}

function cctv(s, t, alpha) {
  g.save(); g.globalAlpha = alpha;
  g.globalCompositeOperation = 'saturation'; g.fillStyle = '#808080'; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'multiply'; g.fillStyle = 'rgba(200,225,205,1)'; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = alpha * 0.8; g.drawImage(scan, 0, 0);
  g.globalAlpha = alpha;
  const live = s.img !== 26;
  mono(live ? 'КАМ 12 · ИЗОЛЯТОР' : 'АРХИВ · КАМ 03 · ДИСПЕТЧЕРСКАЯ', 70, 92, 40, '#e8f2e8', 'left');
  const sec = live ? 3 * 3600 + 47 * 60 + 12 + (t - s.t0) : 1 * 3600 + 52 * 60 + 40 + (t - s.t0);
  const hh = String(Math.floor(sec / 3600)).padStart(2, '0'), mm = String(Math.floor(sec / 60) % 60).padStart(2, '0'), ss = String(Math.floor(sec) % 60).padStart(2, '0');
  mono(`22.11  ${hh}:${mm}:${ss}`, 70, 146, 34, '#cfe0cf', 'left');
  if (live) { if (Math.floor(t * 1.6) % 2 === 0) { g.fillStyle = '#ff3030'; g.beginPath(); g.arc(W - 250, 80, 15, 0, 7); g.fill(); } mono('LIVE', W - 220, 92, 40, '#e8f2e8', 'left'); }
  else mono('▶ ЗАПИСЬ', W - 70, 92, 40, '#e8f2e8', 'right');
  g.strokeStyle = 'rgba(230,240,230,0.6)'; g.lineWidth = 3;
  for (const [x, y, dx, dy] of [[50, 50, 1, 1], [W - 50, 50, -1, 1], [50, H - 50, 1, -1], [W - 50, H - 50, -1, -1]]) { g.beginPath(); g.moveTo(x + dx * 70, y); g.lineTo(x, y); g.lineTo(x, y + dy * 70); g.stroke(); }
  g.restore();
}

function mono(str, x, y, size, color, align = 'center') {
  g.font = `700 ${size}px MonoBold`; g.textAlign = align; g.textBaseline = 'alphabetic';
  g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillText(str, x + 2, y + 3);
  g.fillStyle = color; g.fillText(str, x, y);
}

function grade(t) {
  // vignette, a cold lift in the shadows, grain
  const v = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.62)');
  g.fillStyle = v; g.fillRect(0, 0, W, H);
  g.save(); g.globalCompositeOperation = 'screen'; g.fillStyle = 'rgba(8,18,30,0.5)'; g.fillRect(0, 0, W, H); g.restore();
  g.save(); g.globalAlpha = 0.07; g.globalCompositeOperation = 'overlay';
  const tile = grain[Math.floor(t * 24) % grain.length];
  g.drawImage(tile, 0, 0, W, H);
  g.restore();
}

function darkness(t) {
  // the torch is off: only a red emergency glow from below; it comes back with a stutter
  for (const [a, b] of TL.dark) {
    if (t < a - 0.1 || t > b + 0.5) continue;
    let k = ease((t - a) / 0.25);
    if (t > b) { const u = (t - b) / 0.5; k = u > 1 ? 0 : (Math.sin(u * 40) > 0.2 ? 0.25 : 0.85) * (1 - u); }
    g.save(); g.globalAlpha = 0.86 * k; g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.5 * k;
    const r = g.createRadialGradient(W * 0.5, H * 1.15, 50, W * 0.5, H * 1.15, H * 0.95);
    r.addColorStop(0, 'rgba(120,10,10,0.6)'); r.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = r; g.fillRect(0, 0, W, H); g.restore();
  }
}

// —— letters on screen ——
function title(o, t) {
  const k = (t - o.t0) / (o.t1 - o.t0);
  let a = ease(k / 0.12) * (1 - ease((k - 0.8) / 0.2));
  if (k < 0.2 && hash(Math.floor(t * 30)) > 0.6) a *= 0.3;            // the sign flickers on
  g.save(); g.globalAlpha = a;
  g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(0, H / 2 - 150, W, 300);
  g.font = '700 190px Oswald'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.letterSpacing = '40px';
  g.fillStyle = '#e9eef0'; g.fillText(o.text, W / 2 + 20, H / 2 - 20);
  g.letterSpacing = '0px';
  g.fillStyle = '#d33'; g.fillRect(W / 2 - 330, H / 2 + 92, 660, 6);
  mono('ИССЛЕДОВАТЕЛЬСКИЙ КОМПЛЕКС · КАРАНТИН', W / 2, H / 2 + 140, 30, '#b9c6cc');
  g.restore();
}

function memo(o, t) {
  const t0 = (TL.T.L19?.[0] ?? o.t0) + 1.4, a = ease((t - t0) / 0.5) * (1 - ease((t - o.t1 + 0.4) / 0.4));
  if (a <= 0) return;
  g.save(); g.globalAlpha = a; g.translate(W / 2, H / 2 - 20); g.rotate(-0.025);
  g.beginPath();                                                     // torn paper: jagged left, right and bottom edges
  const w = 1060, h = 330;
  g.moveTo(-w / 2, -h / 2);
  for (let x = -w / 2; x <= w / 2; x += 30) g.lineTo(x, -h / 2 + (hash(x) - 0.5) * 10);
  for (let y = -h / 2; y <= h / 2; y += 22) g.lineTo(w / 2 + (hash(y + 9) - 0.5) * 34, y);
  for (let x = w / 2; x >= -w / 2; x -= 24) g.lineTo(x, h / 2 + (hash(x + 3) - 0.5) * 40);
  for (let y = h / 2; y >= -h / 2; y -= 22) g.lineTo(-w / 2 + (hash(y + 5) - 0.5) * 34, y);
  g.closePath();
  g.fillStyle = '#cfc8b4'; g.fill();
  const st = g.createRadialGradient(260, 60, 10, 260, 60, 260); st.addColorStop(0, 'rgba(120,95,50,0.35)'); st.addColorStop(1, 'rgba(120,95,50,0)');
  g.fillStyle = st; g.fill();
  g.font = '700 34px MonoBold'; g.textAlign = 'left'; g.fillStyle = 'rgba(40,40,40,0.35)';
  g.fillText('ПАМЯТКА ПЕРСОН', -w / 2 + 60, -h / 2 + 70);
  g.fillStyle = 'rgba(40,40,40,0.3)'; g.fillRect(-w / 2 + 60, -h / 2 + 100, 520, 12); g.fillRect(-w / 2 + 60, -h / 2 + 126, 380, 12);
  g.font = '700 46px MonoBold'; g.textAlign = 'center'; g.fillStyle = '#1d1d1d';
  g.fillText('…сохраняют ранее', 0, 40);
  g.fillText('приобретённые навыки…', 0, 100);
  g.restore();
}

function screenPanel(x, y, w, h, a) {
  g.save(); g.globalAlpha = a * 0.88; g.fillStyle = '#04110a'; g.fillRect(x, y, w, h);
  g.globalAlpha = a; g.strokeStyle = '#2fd16a'; g.lineWidth = 3; g.strokeRect(x, y, w, h); g.restore();
}
function progress(o, t) {
  const s = TL.shots.find(s => s.img === 21);
  if (!s || t < s.t0 || t > s.t1) return;
  const a = ease((t - s.t0) / 0.5) * (1 - ease((t - s.t1 + 0.5) / 0.5));
  const x = W / 2 - 430, y = H / 2 + 60, w = 860, h = 230;
  screenPanel(x, y, w, h, a);
  g.save(); g.globalAlpha = a;
  mono('ПОДГОТОВКА ШЛЮЗА', x + 40, y + 70, 46, '#5df08f', 'left');
  const p = clamp((t - o.t0) / 40) * 0.64 + 0.02;
  g.fillStyle = '#0d3a1e'; g.fillRect(x + 40, y + 110, w - 80, 44);
  g.fillStyle = '#3fe07a'; g.fillRect(x + 40, y + 110, (w - 80) * p, 44);
  mono(`${Math.round(p * 100)}%   АВАРИЙНЫЙ ШЛЮЗ 4-И`, x + 40, y + 200, 30, '#5df08f', 'left');
  g.restore();
}
function badge(o, t) {
  const a = ease((t - o.t0 - 0.8) / 0.5) * (1 - ease((t - o.t1 + 0.3) / 0.3));
  if (a <= 0) return;
  g.save(); g.globalAlpha = a; g.translate(W / 2 + 10, H / 2 + 10); g.rotate(0.035);
  const w = 760, h = 240;
  g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(-w / 2 + 14, -h / 2 + 18, w, h);
  const r = g.createLinearGradient(-w / 2, 0, w / 2, 0); r.addColorStop(0, '#22314a'); r.addColorStop(0.45, '#3a5172'); r.addColorStop(1, '#172234');
  g.fillStyle = r; g.fillRect(-w / 2, -h / 2, w, h);
  g.fillStyle = '#c9d4e2'; g.fillRect(-w / 2, -h / 2, w, 46);
  g.font = '700 28px MonoBold'; g.textAlign = 'center'; g.fillStyle = '#1b2638'; g.fillText('СЛУЖБА ОХРАНЫ · СЕКТОР 4', 0, -h / 2 + 33);
  g.font = '700 118px Oswald'; g.fillStyle = '#f3f5f8'; g.textBaseline = 'middle'; g.letterSpacing = '10px';
  g.fillText('СОКОЛОВ', 0, 34); g.letterSpacing = '0px';
  const lit = g.createRadialGradient(-120, -20, 20, -120, -20, 520); lit.addColorStop(0, 'rgba(255,250,230,0.28)'); lit.addColorStop(1, 'rgba(0,0,0,0.35)');
  g.fillStyle = lit; g.fillRect(-w / 2, -h / 2, w, h);
  g.restore();
}
function plan(o, t) {
  const t39 = TL.T.L39 ?? [o.t1, o.t1];
  const a = ease((t - o.t0 - 0.6) / 0.6) * (1 - ease((t - o.t1 + 0.4) / 0.4));
  if (a <= 0) return;
  const x0 = 260, y0 = 170, w = 1400, h = 680;
  g.save(); g.globalAlpha = a * 0.82; g.fillStyle = '#04121f'; g.fillRect(x0, y0, w, h); g.globalAlpha = a;
  g.strokeStyle = 'rgba(110,190,255,0.25)'; g.lineWidth = 1;
  for (let x = x0; x <= x0 + w; x += 40) { g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y0 + h); g.stroke(); }
  for (let y = y0; y <= y0 + h; y += 40) { g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + w, y); g.stroke(); }
  const iso = (t - t39[0]) / Math.max(1, t39[1] - t39[0]);            // «…соединял изолятор…» lands at about two thirds of L39
  const R = { 'ЩИТОВАЯ': [x0 + 70, y0 + 420, 230, 150], 'ПОСТ ОХРАНЫ': [x0 + 430, y0 + 250, 280, 170], 'ШЛЮЗ': [x0 + 830, y0 + 270, 170, 130], 'ИЗОЛЯТОР': [x0 + 1080, y0 + 120, 260, 430], 'ВЫХОД': [x0 + 70, y0 + 90, 200, 120] };
  for (const [name, [x, y, ww, hh]] of Object.entries(R)) {
    const hot = name === 'ИЗОЛЯТОР' && iso > 0.55, blink = hot && Math.floor(t * 3) % 2 === 0;
    g.lineWidth = hot ? 6 : 3; g.strokeStyle = hot ? '#ff3b3b' : '#7cc4ff';
    if (hot) { g.fillStyle = blink ? 'rgba(255,40,40,0.35)' : 'rgba(255,40,40,0.18)'; g.fillRect(x, y, ww, hh); }
    g.strokeRect(x, y, ww, hh);
    mono(name, x + ww / 2, y + 42, name.length > 8 ? 28 : 32, hot ? '#ffd0d0' : '#cfe8ff');
    if (name === 'ВЫХОД') { g.strokeStyle = '#ff5050'; g.lineWidth = 5; g.beginPath(); g.moveTo(x + 15, y + 15); g.lineTo(x + ww - 15, y + hh - 15); g.moveTo(x + ww - 15, y + 15); g.lineTo(x + 15, y + hh - 15); g.stroke(); }
  }
  // the route he was given, drawn as he reads the plan: switchroom → post → airlock → (the isolation ward)
  const P = [[x0 + 185, y0 + 420], [x0 + 185, y0 + 335], [x0 + 430, y0 + 335], [x0 + 710, y0 + 335], [x0 + 830, y0 + 335], [x0 + 1000, y0 + 335], [x0 + 1080, y0 + 335]];
  const draw = clamp((t - o.t0 - 1.2) / 4) * 4 + (iso > 0.55 ? clamp((iso - 0.55) / 0.2) * 2 : 0);
  g.strokeStyle = iso > 0.55 ? '#ff4545' : '#ffd24a'; g.lineWidth = 7; g.setLineDash([22, 14]); g.lineDashOffset = -t * 40;
  g.beginPath(); g.moveTo(...P[0]);
  for (let i = 1; i < P.length; i++) { const u = clamp(draw - (i - 1)); if (u <= 0) break; g.lineTo(lerp(P[i - 1][0], P[i][0], u), lerp(P[i - 1][1], P[i][1], u)); }
  g.stroke(); g.setLineDash([]);
  g.fillStyle = '#ffd24a'; g.beginPath(); g.arc(x0 + 570, y0 + 335, 16, 0, 7); g.fill();
  mono('ВЫ ЗДЕСЬ', x0 + 570, y0 + 395, 26, '#ffd24a');
  mono('СЕКТОР 4 · СХЕМА ЭВАКУАЦИИ', x0 + 30, y0 + 52, 30, '#7cc4ff', 'left');
  g.restore();
}
function timer(o, t) {
  const saved = TL.overlays.find(x => x.kind === 'saved');
  const end = saved ? saved.t0 : o.t1, k = clamp((t - o.t0) / (end - o.t0));
  const left = t >= end ? 3 : Math.max(3, Math.ceil(60 - 57 * k));
  if (t > end + 0.2) return;
  const cur = TL.shots.find(x => t >= x.t0 && t < x.t1);
  if (cur && cur.img === 30) return;
  const big = 0;
  const x = lerp(W - 300, W / 2, big), y = lerp(110, H / 2 - 30, big), s = lerp(0.42, 1, big);
  g.save(); g.translate(x, y); g.scale(s, s);
  const blink = Math.floor(t * 2) % 2 === 0;
  g.fillStyle = 'rgba(30,0,0,0.72)'; g.fillRect(-520, -150, 1040, 300);
  g.strokeStyle = '#ff2b2b'; g.lineWidth = 6; g.strokeRect(-520, -150, 1040, 300);
  g.font = '700 64px Oswald'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ff5a5a';
  g.fillText('СНЯТИЕ КАРАНТИНА', 0, -80);
  g.font = '700 150px MonoBold'; g.fillStyle = blink || big < 0.5 ? '#ffffff' : '#ffb3b3';
  g.fillText(mmss(left), 0, 50);
  g.restore();
}
function savedBox(o, t) {
  const a = ease((t - o.t0) / 0.25) * (1 - ease((t - o.t1 + 0.3) / 0.3));
  g.save(); g.globalAlpha = a;
  g.fillStyle = 'rgba(0,25,10,0.75)'; g.fillRect(W / 2 - 560, H / 2 - 110, 1120, 220);
  g.strokeStyle = '#38e07a'; g.lineWidth = 6; g.strokeRect(W / 2 - 560, H / 2 - 110, 1120, 220);
  g.font = '700 110px Oswald'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#7dffaa';
  g.fillText('КАРАНТИН СОХРАНЁН', W / 2, H / 2 + 4);
  g.restore();
}
const MSG = 'Я снаружи. Карантин удержан. Не открывайте сектор. Голосам по связи не верить.';
function message(o, t) {
  const a = ease((t - o.t0) / 0.4) * (1 - ease((t - o.t1 + 0.3) / 0.3));
  const n = Math.floor(clamp((t - o.t0 - 0.4) / (o.t1 - o.t0 - 1.6)) * MSG.length);
  const x = W / 2 - 420, y = 150, w = 840, h = 780;
  g.save(); g.globalAlpha = a;
  g.fillStyle = 'rgba(10,12,16,0.92)'; rr(x, y, w, h, 40); g.fill();
  g.fillStyle = '#1c2230'; rr(x, y, w, 110, 40); g.fill(); g.fillRect(x, y + 70, w, 40);
  g.font = '600 40px Inter'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = '#e6ebf2';
  g.fillText('Диспетчерская ЧС', x + 50, y + 58);
  // the bubble grows with the text
  const lines = wrap(MSG.slice(0, n) + (n < MSG.length && Math.floor(t * 3) % 2 ? '|' : ''), 40, 640, 'Inter');
  const bh = 50 + lines.length * 56;
  g.fillStyle = '#2f6fe0'; rr(x + w - 60 - 700, y + 160, 700, bh, 30); g.fill();
  g.fillStyle = '#fff'; g.font = '600 40px Inter';
  lines.forEach((l, i) => g.fillText(l, x + w - 60 - 700 + 34, y + 160 + 50 + i * 56));
  if (n >= MSG.length) { g.font = '600 30px Inter'; g.textAlign = 'right'; g.fillStyle = '#8fa3c0'; g.fillText('Доставлено ✓✓', x + w - 64, y + 160 + bh + 40); }
  g.restore();
}
function endCard(o, t) {
  const a = ease((t - o.t0) / 0.6) * (1 - ease((t - o.t1 + 0.6) / 0.6));
  g.save(); g.globalAlpha = a;
  g.font = '700 110px Oswald'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#e8ecef';
  g.letterSpacing = '12px'; g.fillText('ПОДПИСЫВАЙСЯ', W / 2, H / 2 - 20); g.letterSpacing = '0px';
  g.fillStyle = '#d33'; g.fillRect(W / 2 - 300, H / 2 + 60, 600, 5);
  g.restore();
}
function rr(x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function wrap(str, size, maxW, fam) {
  g.font = `600 ${size}px ${fam}`;
  const out = []; let cur = '';
  for (const w of str.split(' ')) { const c = cur ? cur + ' ' + w : w; if (g.measureText(c).width > maxW && cur) { out.push(cur); cur = w; } else cur = c; }
  if (cur) out.push(cur);
  return out;
}

// —— subtitles ——
// one line when it fits, else two lines of about equal width (no lone word on the second line)
function balance(str, size, maxW) {
  g.font = `600 ${size}px Inter`;
  if (g.measureText(str).width <= maxW) return [str];
  const w = str.split(' ');
  let best = null;
  for (let i = 1; i < w.length; i++) {
    const a = w.slice(0, i).join(' '), b = w.slice(i).join(' ');
    const m = Math.max(g.measureText(a).width, g.measureText(b).width);
    if (!best || m < best[0]) best = [m, [a, b]];
  }
  return best[0] <= maxW ? best[1] : wrap(str, size, maxW, 'Inter');
}
const LABEL = { radio: 'РАЦИЯ', door: 'ЗА ДВЕРЬЮ', glass: 'ЗА СТЕКЛОМ', room: 'ИЗ СОСЕДНЕЙ КОМНАТЫ', near: 'В ТЕМНОТЕ', pa: 'ДИНАМИКИ', intercom: 'ПЕРЕГОВОРНОЕ УСТРОЙСТВО', whisper: 'Я, ШЁПОТОМ', calm: 'В ТЕМНОТЕ' };
const COLOR = { radio: '#9dffb8', pa: '#ffb0a0', intercom: '#ffd59a', calm: '#ff9a9a' };
function subs(t) {
  for (const l of TL.lines) {
    if (t < l.t0 - 0.1 || t > l.t1 + 0.35) continue;
    const a = ease((t - l.t0 + 0.1) / 0.15) * (1 - ease((t - l.t1 - 0.2) / 0.15));
    const text = l.text.replace(/\+/g, '');
    const FS = VERT ? 52 : 46, LH = VERT ? 66 : 60;
    const lines = VERT ? wrap(text, FS, W - 140, 'Inter') : balance(text, 46, 1500);
    const y0 = (VERT ? H - 560 : H - 70) - (lines.length - 1) * LH;
    g.save(); g.globalAlpha = a;
    const lab = l.fx === 'vo' ? null : LABEL[l.fx];
    if (lab) mono(lab, W / 2, y0 - 64, 26, COLOR[l.fx] ?? '#cfd8e0');
    g.font = `600 ${FS}px Inter`; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.lineJoin = 'round'; g.lineWidth = 8; g.strokeStyle = 'rgba(0,0,0,0.85)';
    lines.forEach((s, i) => { g.strokeText(s, W / 2, y0 + i * LH); });
    g.fillStyle = l.fx === 'vo' ? '#ffffff' : (COLOR[l.fx] ? '#f2fff5' : '#eef3f6');
    lines.forEach((s, i) => { g.fillText(s, W / 2, y0 + i * LH); });
    g.restore();
  }
}

let NOSUBS = false;
export function thumbAt(t, lines, plateText, plateY = 1500) {
  NOSUBS = true; frame(t); NOSUBS = false;
  const gr = g.createLinearGradient(0, 0, 0, 900); gr.addColorStop(0, 'rgba(0,0,0,0.65)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, 900);
  for (const [str, y, size, col] of lines) {
    g.font = `700 ${size}px Oswald`; const w = g.measureText(str).width; const k = Math.min(1, (W - 80) / w);
    g.save(); g.translate(W / 2, y); g.scale(k, k); g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
    g.lineWidth = size * 0.15; g.strokeStyle = '#000'; g.strokeText(str, 0, 0); g.fillStyle = col; g.fillText(str, 0, 0); g.restore();
  }
  if (plateText) { g.save(); g.translate(W / 2, plateY); g.rotate(-0.03); g.font = '700 70px Oswald'; const w = g.measureText(plateText).width + 60; g.fillStyle = '#ffd400'; g.fillRect(-w / 2, -56, w, 112); g.fillStyle = '#111'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(plateText, 0, 4); g.restore(); }
}
export function frame(t) {
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  // the shot on screen, and the one it dissolves from
  const i = TL.shots.findIndex(s => t >= s.t0 && t < s.t1);
  const s = TL.shots[i] ?? TL.shots[TL.shots.length - 1], p = TL.shots[i - 1];
  const hard = HARD.has(s.ev), k = hard ? 1 : clamp((t - s.t0) / XF);
  if (p && k < 1 && p.img) drawShot(p, t, 1);
  if (s.img) drawShot(s, t, p && !p.img ? ease((t - s.t0) / 1.2) : (p ? ease(k) : 1));
  darkness(t);
  grade(t);
  for (const o of TL.overlays) {
    if (t < o.t0 - 0.05 || t > o.t1 + 0.6) continue;
    if (o.kind === 'timer') timer(o, t);
    else virtual(() => ({ title, memo, plan, saved: savedBox, end: endCard })[o.kind]?.(o, t));
  }
  if (!NOSUBS) subs(t);
  if (VERT && !NOSUBS && t > CLIP_END - 3.2) fullStory(t);
}
function fullStory(t) {
  const a = ease((t - (CLIP_END - 3.2)) / 0.4);
  g.save(); g.globalAlpha = a; g.translate(W / 2, 300); g.rotate(-0.02);
  g.font = '700 64px Oswald'; const s1 = 'ПОЛНАЯ ИСТОРИЯ', w = g.measureText(s1).width + 70;
  g.fillStyle = '#ffd400'; g.fillRect(-w / 2, -60, w, 120); g.fillStyle = '#111'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s1, 0, 4);
  g.font = '700 46px Oswald'; g.lineWidth = 8; g.strokeStyle = '#000'; g.strokeText('ПО ССЫЛКЕ ВНИЗУ', 0, 120); g.fillStyle = '#fff'; g.fillText('ПО ССЫЛКЕ ВНИЗУ', 0, 120);
  const ay = 175 + 12 * Math.abs(Math.sin(t * 5));               // a bouncing arrow (the font has no ↓)
  g.fillStyle = '#ffd400'; g.strokeStyle = '#000'; g.lineWidth = 6; g.beginPath(); g.moveTo(-34, ay); g.lineTo(34, ay); g.lineTo(0, ay + 46); g.closePath(); g.stroke(); g.fill();
  g.restore();
}

// the thumbnail (1280×720 scaled from 1920×1080): a torch on frosted glass with a hand behind it, «НЕ ОТКРЫВАЙ ШЛЮЗ»
export function cover() {
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  const v = IMG.get(11) ?? IMG.get(10);
  if (v) { g.save(); g.translate(W / 2, H / 2); g.scale(1.08, 1.08); g.drawImage(v, -W / 2 - 60, -H / 2, W, H); g.restore(); }
  const v2 = g.createRadialGradient(W * 0.62, H * 0.45, 200, W * 0.62, H * 0.45, 1300); v2.addColorStop(0, 'rgba(0,0,0,0)'); v2.addColorStop(1, 'rgba(0,0,0,0.8)');
  g.fillStyle = v2; g.fillRect(0, 0, W, H);
  g.save(); g.translate(60, 0);
  for (const [str, y, size, col] of [['НЕ ОТКРЫВАЙ', 330, 210, '#ffffff'], ['ШЛЮЗ', 600, 300, '#ff2b2b']]) {
    g.font = `700 ${size}px Oswald`; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
    g.lineWidth = size * 0.16; g.strokeStyle = '#000'; g.strokeText(str, 0, y); g.fillStyle = col; g.fillText(str, 0, y);
  }
  g.restore();
  g.save(); g.translate(80, 760); g.rotate(-0.03);
  g.fillStyle = '#ffd400'; g.fillRect(0, 0, 820, 120); g.font = '700 74px Oswald'; g.fillStyle = '#111'; g.textAlign = 'left'; g.textBaseline = 'middle';
  g.fillText('ГОЛОС ПО РАЦИИ ВРЁТ', 30, 64); g.restore();
}

// —— thumbnail variants for YouTube «Тестировать и сравнивать» ——
function thumbBg(v, sc = 1.08, dx = 0, dy = 0) {
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  if (v) { g.save(); g.translate(W / 2, H / 2); g.scale(sc, sc); g.drawImage(v, -W / 2 + dx, -H / 2 + dy, W, H); g.restore(); }
}
function bigText(lines, x) {
  for (const [str, y, size, col] of lines) {
    g.font = `700 ${size}px Oswald`; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
    g.lineWidth = size * 0.15; g.strokeStyle = '#000'; g.strokeText(str, x, y); g.fillStyle = col; g.fillText(str, x, y);
  }
}
function tplate(str, x, y, size, bg = '#ffd400', fg = '#111', rot = -0.03) {
  g.save(); g.translate(x, y); g.rotate(rot);
  g.font = `700 ${size}px Oswald`; const w = g.measureText(str).width + size * 0.8;
  g.fillStyle = bg; g.fillRect(0, 0, w, size * 1.6); g.fillStyle = fg; g.textAlign = 'left'; g.textBaseline = 'middle';
  g.fillText(str, size * 0.4, size * 0.86); g.restore();
}
function shade(kind) {
  const v = kind === 'left' ? g.createLinearGradient(0, 0, W, 0) : g.createLinearGradient(0, H, 0, 0);
  v.addColorStop(0, 'rgba(0,0,0,0.8)'); v.addColorStop(0.55, 'rgba(0,0,0,0.15)'); v.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = v; g.fillRect(0, 0, W, H);
}
export const COVER_IMGS = { a: [11, 10], b: [27], c: [1] };
export function coverVariant(k) {
  if (k === 'b') {
    thumbBg(IMG.get(27), 1.1, -120, 0);
    g.save(); g.globalCompositeOperation = 'saturation'; g.fillStyle = '#808080'; g.fillRect(0, 0, W, H); g.restore();
    g.save(); g.globalAlpha = 0.5; g.drawImage(scan, 0, 0); g.restore();
    shade('left');
    g.fillStyle = '#ff2020'; g.beginPath(); g.arc(W - 250, 90, 22, 0, 7); g.fill();
    g.font = '700 54px MonoBold'; g.fillStyle = '#ffffff'; g.textAlign = 'left'; g.fillText('REC', W - 210, 110);
    g.font = '700 40px MonoBold'; g.fillText('КАМ 12 · ИЗОЛЯТОР', 70, 100);
    bigText([['ОН ГОВОРИТ', 420, 190, '#ffffff'], ['МОИМ ГОЛОСОМ', 640, 190, '#ff2b2b']], 70);
    tplate('НЕ ОТКРЫВАЙ ШЛЮЗ', 80, 760, 74);
  } else if (k === 'c') {
    thumbBg(IMG.get(1), 1.12, 0, 60);
    shade('bottom');
    tplate('ГОЛОС ИЗ РАЦИИ:', 80, 70, 70, '#ffd400');
    bigText([['НЕ', 760, 200, '#ffffff'], ['ОБОРАЧИВАЙСЯ', 960, 230, '#ff2b2b']], 70);
  } else cover();
}
