// The picture of «Эндьюранс: 28 человек во льдах»: 1920×1080, from build/timeline.json (tools/doc.py) and the Codex
// frames img/01–61.jpg. Slow camera moves with dissolves, a natural documentary grade (vignette, grain), animated route
// maps drawn here from simplified coastlines (lon/lat), the title, chapter cards, date and number captions, subtitles
// with the speaker for quoted lines, and the end card.
import { loadImage } from '@napi-rs/canvas';
import fs from 'node:fs';
import path from 'node:path';

// VERT=1: a vertical 1080×1920 version for Shorts cut from the film (see long-lab-voice/src/film.js)
export const VERT = process.env.VERT === '1';
export let W = VERT ? 1080 : 1920, H = VERT ? 1920 : 1080;
const CLIP_END = parseFloat(process.env.CLIP_END ?? 'NaN');
const FOCUS = { 1: 0.55, 2: 0.55, 3: 0.75, 4: 0.5, 40: 0.4, 41: 0.6, 42: 0.72, 43: 0.3, 44: 0.5, 45: 0.45, 46: 0.6, 47: 0.45, 48: 0.55, 49: 0.5, 50: 0.45, 51: 0.35, 52: 0.4, 53: 0.5, 54: 0.5 };
function virtual(fn) {
  if (!VERT) return fn();
  const w = W, h = H, k = 1080 / 1920;
  g.save(); g.translate(0, (1920 - 1080 * k) / 2 - 140); g.scale(k, k); W = 1920; H = 1080;
  try { fn(); } finally { W = w; H = h; g.restore(); }
}
let g = null, ROOT = '.';
export const TL = { dur: 0 };
const IMG = new Map();
let grain = [];

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const ease = x => (x = clamp(x), x * x * (3 - 2 * x));
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const lerp = (a, b, k) => a + (b - a) * k;

export async function init(ctx, root, makeCanvas) {
  g = ctx; ROOT = root;
  Object.assign(TL, JSON.parse(fs.readFileSync(path.join(root, 'build/timeline.json'), 'utf8')));
  for (let k = 0; k < 4; k++) {
    const c = makeCanvas(480, 270), x = c.getContext('2d'), d = x.createImageData(480, 270);
    for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    x.putImageData(d, 0, 0); grain.push(c);
  }
  TL.T = Object.fromEntries(TL.lines.map(l => [l.id, [l.t0, l.t1]]));
}
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
  for (const s of TL.shots) if (typeof s.img === 'number' && s.img && s.t1 > t - 1 && s.t0 < t + 1) await img(s.img);
}

// hard cuts where something breaks; everything else dissolves
const HARD = new Set(['B001', 'S01', 'F06', 'J10', 'B006']);
const XF = 0.9;

function move(s, k) {
  const i = TL.shots.indexOf(s), dur = s.t1 - s.t0;
  const zin = hash(i * 3.1) > 0.45, z0 = zin ? 1.03 : 1.12, z1 = zin ? 1.12 : 1.03;
  const amp = clamp(dur / 14, 0.35, 1) * 0.035;
  const ax = (hash(i * 7.7) - 0.5) * 2 * amp, ay = (hash(i * 5.3) - 0.5) * 1.2 * amp;
  return { z: lerp(z0, z1, k), dx: lerp(-ax, ax, k) * W, dy: lerp(-ay, ay, k) * H };
}
function shake(t) {
  let a = 0;
  const st = TL.T.J05, wv = TL.T.J10;
  if (st && t > st[0] && t < st[1] + 1) a = 4;                      // the storm
  if (wv && t > wv[0] && t < wv[1] + 1.8) a = Math.max(a, 14 * (1 - (t - wv[0]) / 3.6));
  return [Math.sin(t * 41) * a * 0.6 + Math.sin(t * 23) * a * 0.4, Math.cos(t * 37) * a * 0.5 + Math.sin(t * 17) * a * 0.3];
}

function drawShot(s, t, alpha) {
  if (!s.img) return;
  const k = clamp((t - s.t0) / Math.max(0.1, s.t1 - s.t0 + XF));
  g.save(); g.globalAlpha = alpha;
  if (typeof s.img === 'string') { drawMap(s.img.slice(4), t - s.t0, k); g.restore(); return; }
  const v = IMG.get(s.img), m = move(s, k), [sx, sy] = shake(t);
  g.translate(W / 2 + m.dx + sx, H / 2 + m.dy + sy); g.scale(m.z, m.z);
  if (VERT) {
    const sc = H / 1080, half = (1920 * sc - W) / 2;
    g.translate(clamp(-((FOCUS[s.img] ?? 0.5) - 0.5) * 1920 * sc, -half, half), 0); g.scale(sc, sc);
  }
  if (v) g.drawImage(v, -960, -540, 1920, 1080);
  else { g.fillStyle = '#1c2730'; g.fillRect(-W / 2, -H / 2, W, H); g.fillStyle = 'rgba(160,200,220,0.25)'; g.font = '700 300px Oswald'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(s.img), 0, 0); }
  g.restore();
}

// —— maps ——
// simplified coastlines, [lon, lat]
const ANT = [[-180, -100], [-180, -78], [-170, -78], [-160, -78], [-150, -77], [-140, -75.5], [-130, -74.5], [-120, -73.8], [-110, -74], [-100, -73.5], [-90, -72.8], [-85, -73.8], [-80, -73.5], [-77, -73.0], [-73.5, -72.5], [-70.5, -71.5], [-68.5, -70.5], [-68.0, -69.0],
  [-67.5, -67.6], [-65.5, -66.7], [-64.0, -65.6], [-62.5, -65.0], [-60.5, -64.3], [-58.5, -63.6], [-56.5, -63.2], [-57.0, -64.0],
  [-58.5, -65.5], [-60.5, -66.5], [-61.5, -68.0], [-62.5, -69.5], [-63.0, -71.0], [-61.5, -72.5], [-61.0, -74.0], [-63.0, -75.5],
  [-66.0, -77.5], [-60, -77.7], [-50, -77.9], [-45, -78.0], [-40, -78.2], [-36, -78.0], [-33, -77.0], [-28, -76.0], [-24, -75.0],
  [-18, -73.5], [-12, -72.0], [-5, -71.0], [0, -70.0], [10, -70.2], [20, -69.8], [30, -69.5], [40, -69], [50, -67], [60, -67], [70, -68], [80, -67], [90, -66.5], [100, -66], [110, -66.2], [120, -66.5], [130, -66.2], [140, -66.5], [150, -68.5], [160, -70.5], [170, -72], [180, -77], [180, -100]];
const SAM = [[-80, -48], [-75.4, -48], [-75.4, -50], [-74.6, -52.6], [-73.0, -53.8], [-71.0, -54.7], [-68.5, -55.5], [-67.3, -55.98], [-66.2, -55.2],
  [-65.1, -54.7], [-66.5, -54.4], [-68.3, -53.3], [-68.4, -52.4], [-69.6, -52.3], [-68.8, -51.6], [-69.2, -50.6], [-68.0, -49.5], [-66.5, -48]];
const FALK = [[-61.3, -51.3], [-59.0, -51.2], [-57.7, -51.6], [-58.5, -52.3], [-60.3, -52.2], [-61.3, -51.8]];
const SGEO = [[-38.08, -54.0], [-37.85, -53.98], [-37.6, -54.02], [-37.4, -54.03], [-37.2, -54.06], [-37.05, -54.08], [-36.9, -54.1],
  [-36.78, -54.12], [-36.7, -54.165], [-36.62, -54.14], [-36.5, -54.2], [-36.4, -54.27], [-36.3, -54.3], [-36.15, -54.38], [-36.05, -54.47],
  [-35.95, -54.57], [-35.8, -54.73], [-35.85, -54.82], [-36.0, -54.86], [-36.25, -54.82], [-36.5, -54.76], [-36.75, -54.66], [-36.95, -54.56],
  [-37.1, -54.45], [-37.2, -54.33], [-37.26, -54.2], [-37.33, -54.24], [-37.38, -54.32], [-37.55, -54.26], [-37.75, -54.17], [-37.95, -54.08]];
const ISLANDS = [[-55.1, -61.13, 0.45, 0.09], [-58.6, -62.1, 0.55, 0.12], [-60.3, -62.6, 0.5, 0.1], [-61.9, -62.9, 0.4, 0.08], [-56.9, -61.9, 0.3, 0.06],
  [-45.4, -60.65, 0.6, 0.08], [-26.4, -58.4, 0.15, 0.08]];
const P = {
  grytviken: [-36.5, -54.28], beset: [-31.5, -76.6], vahsel: [-34.9, -77.8], sink: [-52.3, -68.7], launch: [-53.8, -62.0],
  elephant: [-54.9, -61.1], haakon: [-37.25, -54.2], stromness: [-36.7, -54.16], punta: [-70.9, -53.15], wreck: [-52.32, -68.73],
};
const R = {
  south: [P.grytviken, [-30, -58], [-26, -63], [-22, -68], [-25, -72], [-29, -75], P.beset],
  drift: [P.beset, [-35, -76.8], [-40, -76.5], [-45, -75.0], [-48, -73.5], [-50, -71.5], [-51.5, -70.0], P.sink],
  floe: [P.sink, [-52.5, -67.0], [-53.0, -65.5], [-53.5, -64.0], P.launch],
  boats: [P.launch, [-54.4, -61.8], [-54.8, -61.4], P.elephant],
  caird: [P.elephant, [-50, -59.5], [-45, -58], [-40.5, -56], [-38.3, -54.7], P.haakon],
  cross: [P.haakon, [-37.12, -54.22], [-37.0, -54.2], [-36.9, -54.24], [-36.8, -54.2], P.stromness],
  rescue: [P.punta, [-68, -55.8], [-62, -59], [-57.5, -60.5], P.elephant],
  plan: [P.vahsel, [-35.5, -80], [-36, -86]],
};
// views: centre lon/lat and how many degrees of latitude fit the screen height; z grows over the shot
const MAPS = {
  plan: { c: [-45, -66], span: 34, z: 1.06, routes: [['plan', 0.1, 0.8, true]], marks: [['vahsel', 'ЗАЛИВ ФАЗЕЛЯ', 22, -30]], note: 'К ПОЛЮСУ И ДАЛЬШЕ · ~2900 КМ', noteAt: [-12, -79.5] },
  south: { c: [-38, -66], span: 30, z: 1.08, routes: [['south', 0.05, 0.9]], marks: [['grytviken', 'ЮЖНАЯ ГЕОРГИЯ'], ['beset', '']] },
  beset: { c: [-33, -76.2], span: 7, z: 1.1, routes: [], marks: [['beset', '«ЭНДЬЮРАНС»'], ['vahsel', 'БЕРЕГ']], note: '1 ДЕНЬ ПУТИ', link: ['beset', 'vahsel'] },
  drift: { c: [-42, -72.5], span: 14, z: 1.06, routes: [['drift', 0.05, 0.92]], marks: [['beset', '18.01.1915'], ['sink', '21.11.1915']] },
  boats: { c: [-53.5, -65], span: 11, z: 1.07, routes: [['floe', 0.0, 0.45, true], ['boats', 0.45, 0.9]], marks: [['sink', ''], ['elephant', 'ОСТРОВ ЭЛЕФАНТ']] },
  caird: { c: [-46, -57.8], span: 11, z: 1.05, routes: [['caird', 0.08, 0.9]], marks: [['elephant', 'ОСТРОВ ЭЛЕФАНТ'], ['haakon', 'ЮЖНАЯ ГЕОРГИЯ']], note: '1300 КМ', noteAt: [-46, -59.4] },
  georgia: { c: [-36.95, -54.35], span: 1.25, z: 1.06, routes: [['cross', 0.15, 0.9]], marks: [['haakon', 'ЗАЛИВ КОРОЛЯ ХОКОНА', -22, 44, 'right'], ['stromness', 'СТРОМНЕСС', 22, -36]], note: '≈ 40 КМ · 36 ЧАСОВ', noteAt: [-36.95, -54.42] },
  rescue: { c: [-62, -57.5], span: 11, z: 1.05, routes: [['rescue', 0.05, 0.85]], marks: [['punta', 'ПУНТА-АРЕНАС'], ['elephant', 'ОСТРОВ ЭЛЕФАНТ']], note: '«ЙЕЛЧО»', noteAt: [-63, -59.8] },
  wreck: { c: [-46, -70], span: 16, z: 1.12, routes: [['drift', 0.0, 0.0, false, true]], marks: [['wreck', 'ГЛУБИНА 3008 М']], pulse: 'wreck' },
};
let proj = null;
const FIT = {
  plan: [[-60, -60], [-36.5, -54.28], [-36, -79.5], [-20, -74]], south: [[-56.5, -63.2], [-36.5, -54.28], [-31.5, -76.6], [-20, -70]],
  beset: [[-31.5, -76.6], [-34.9, -77.8], [-29, -75.8]], georgia: [[-37.75, -53.98], [-36.3, -54.5]], wreck: [[-60, -64], [-36, -76]],
};
function setView(m, name, k) {
  const pts = [...(FIT[name] ?? []), ...m.marks.map(([p]) => P[p]), ...m.routes.filter(([r]) => r !== 'plan').flatMap(([r]) => R[r])];
  const lons = pts.map(p => p[0]), lats = pts.map(p => p[1]);
  const lo0 = Math.min(...lons), lo1 = Math.max(...lons), la0 = Math.min(...lats), la1 = Math.max(...lats);
  const lc = (lo0 + lo1) / 2, ac = (la0 + la1) / 2, cl = Math.cos(ac * Math.PI / 180);
  const BW = VERT ? 940 : 1500, BH = VERT ? 1000 : 620, CY = VERT ? 820 : 450;
  const s = Math.min(BW / Math.max(0.3, (lo1 - lo0) * cl), BH / Math.max(0.3, la1 - la0)) * lerp(1, m.z, ease(k));
  proj = ([lon, lat]) => [W / 2 + (lon - lc) * cl * s, CY - (lat - ac) * s];
  return s;
}
function poly(pts, fill, stroke) {
  g.beginPath(); pts.forEach((p, i) => { const [x, y] = proj(p); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath();
  g.fillStyle = fill; g.fill(); if (stroke) { g.strokeStyle = stroke; g.lineWidth = 2; g.stroke(); }
}
function label(str, x, y, size, color, align = 'left') {
  g.font = `700 ${size}px MonoBold`; g.textAlign = align; g.textBaseline = 'middle';
  g.lineWidth = 6; g.strokeStyle = 'rgba(0,10,20,0.85)'; g.strokeText(str, x, y); g.fillStyle = color; g.fillText(str, x, y);
}
function routePath(pts, u, color, dashed, full) {
  // a polyline drawn up to fraction u of its length, with a glowing head
  const xy = pts.map(proj), seg = [];
  let L = 0; for (let i = 1; i < xy.length; i++) { const l = Math.hypot(xy[i][0] - xy[i - 1][0], xy[i][1] - xy[i - 1][1]); seg.push(l); L += l; }
  let left = (full ? 1 : u) * L, head = xy[0];
  g.save(); g.strokeStyle = color; g.lineWidth = 6; g.lineCap = 'round'; g.lineJoin = 'round';
  if (dashed) g.setLineDash([18, 14]);
  g.beginPath(); g.moveTo(...xy[0]);
  for (let i = 1; i < xy.length && left > 0; i++) {
    const f = Math.min(1, left / seg[i - 1]);
    head = [lerp(xy[i - 1][0], xy[i][0], f), lerp(xy[i - 1][1], xy[i][1], f)];
    g.lineTo(...head); left -= seg[i - 1];
  }
  g.stroke(); g.setLineDash([]);
  if (!full && u > 0 && u < 1) {
    const r = g.createRadialGradient(head[0], head[1], 2, head[0], head[1], 34); r.addColorStop(0, 'rgba(255,220,150,0.9)'); r.addColorStop(1, 'rgba(255,180,80,0)');
    g.fillStyle = r; g.beginPath(); g.arc(head[0], head[1], 34, 0, 7); g.fill();
  }
  g.restore();
}
function drawMap(name, tt, k) {
  const m = MAPS[name];
  const sc = setView(m, name, k);
  const o = g.createLinearGradient(0, 0, 0, H); o.addColorStop(0, '#12304a'); o.addColorStop(1, '#081a2a');
  g.fillStyle = o; g.fillRect(0, 0, W, H);
  // graticule
  g.strokeStyle = 'rgba(150,200,240,0.12)'; g.lineWidth = 1;
  const step = sc < 120 ? 5 : 0.5;
  for (let lon = -90; lon <= 10; lon += step) { g.beginPath(); for (let lat = -86; lat <= -46; lat += 0.5) { const [x, y] = proj([lon, lat]); lat === -86 ? g.moveTo(x, y) : g.lineTo(x, y); } g.stroke(); }
  for (let lat = -86; lat <= -46; lat += step) { g.beginPath(); const [x0, y0] = proj([-90, lat]), [x1, y1] = proj([10, lat]); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
  // land
  poly(ANT, '#dfe8ee', 'rgba(255,255,255,0.6)');
  poly(SAM, '#4a5a4c', 'rgba(220,230,220,0.4)'); poly(FALK, '#4a5a4c', 'rgba(220,230,220,0.4)');
  poly(SGEO, '#c9d3d6', 'rgba(255,255,255,0.6)');
  for (const [lon, lat, a, b] of ISLANDS) { const [x, y] = proj([lon, lat]), [x2] = proj([lon + a, lat]), [, y2] = proj([lon, lat - b]); g.fillStyle = '#c9d3d6'; g.beginPath(); g.ellipse(x, y, Math.max(3, Math.abs(x2 - x)), Math.max(2, Math.abs(y2 - y)), -0.3, 0, 7); g.fill(); }
  if (sc < 120) {
    const [ax, ay] = proj(name === 'plan' ? [-75, -79] : [-45, -80.5]); if (ay < H - 260 && ay > 60) label('АНТАРКТИДА', ax, ay, 34, 'rgba(40,60,80,0.75)', 'center');
    const [wx, wy] = proj([-42, -70]); if (name !== 'drift' && name !== 'wreck') label('МОРЕ УЭДДЕЛЛА', wx, wy, 26, 'rgba(170,210,240,0.7)', 'center');
  }
  // routes
  for (const [r, a, b, dashed, full] of m.routes) routePath(R[r], ease((k - a) / Math.max(0.01, b - a)), r === 'plan' ? '#b4532a' : dashed ? 'rgba(255,230,170,0.85)' : '#ffb347', dashed, full);
  if (m.link) { const [a, b] = m.link.map(n => proj(P[n])); g.save(); g.strokeStyle = 'rgba(255,255,255,0.8)'; g.setLineDash([8, 8]); g.lineWidth = 3; g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.stroke(); g.restore(); }
  // marks
  for (const [p, txt, dx, dy, al] of m.marks) {
    const [x, y] = proj(P[p]);
    const pulse = m.pulse === p ? 1 + 0.5 * Math.abs(Math.sin(tt * 2.5)) : 1;
    g.fillStyle = '#ffd36b'; g.beginPath(); g.arc(x, y, 10 * pulse, 0, 7); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 3; g.stroke();
    if (txt && dx !== undefined) label(txt, x + dx, y + dy, 30, '#ffffff', al ?? 'left');
    else if (txt) { g.font = '700 30px MonoBold'; const w = g.measureText(txt).width; x + 22 + w > W - 60 ? label(txt, x - 22, y - 4, 30, '#ffffff', 'right') : label(txt, x + 22, y - 4, 30, '#ffffff'); }
  }
  if (m.note) {
    const [x, y] = m.noteAt ? proj(m.noteAt) : proj([lerp(P[m.link[0]][0], P[m.link[1]][0], 0.5) + 1.5, lerp(P[m.link[0]][1], P[m.link[1]][1], 0.5)]);
    g.save(); g.globalAlpha = ease((k - 0.25) / 0.2); label(m.note, x, y, 36, '#ffd36b', 'center'); g.restore();
  }
}

// —— grade, captions, cards ——
function grade(t) {
  const v = g.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 1.0);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.5)');
  g.fillStyle = v; g.fillRect(0, 0, W, H);
  g.save(); g.globalAlpha = 0.06; g.globalCompositeOperation = 'overlay';
  g.drawImage(grain[Math.floor(t * 24) % grain.length], 0, 0, W, H); g.restore();
}
function mono(str, x, y, size, color, align = 'left') {
  g.font = `700 ${size}px MonoBold`; g.textAlign = align; g.textBaseline = 'alphabetic';
  g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillText(str, x + 2, y + 3); g.fillStyle = color; g.fillText(str, x, y);
}
function title(o, t) {
  const k = (t - o.t0) / (o.t1 - o.t0), a = ease(k / 0.15) * (1 - ease((k - 0.82) / 0.18));
  g.save(); g.globalAlpha = a;
  g.font = '700 200px Oswald'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.letterSpacing = '30px';
  g.fillStyle = '#eef3f6'; g.fillText(o.text, W / 2 + 15, H / 2 - 40); g.letterSpacing = '0px';
  g.fillStyle = '#c8a25a'; g.fillRect(W / 2 - 360, H / 2 + 82, 720, 5);
  mono(o.sub, W / 2, H / 2 + 150, 34, '#cfd8de', 'center');
  g.restore();
}
function chapter(o, t) {
  const a = ease((t - o.t0) / 0.6) * (1 - ease((t - o.t1 + 0.6) / 0.6));
  g.save(); g.globalAlpha = a;
  const x = 110, y = H - 300;
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, y - 90, 1100, 190);
  mono(o.text, x, y - 25, 34, '#c8a25a');
  g.font = '700 96px Oswald'; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillStyle = '#f2f5f7';
  g.fillText(o.sub, x - 4, y + 72);
  g.restore();
}
function cap(o, t) {
  const a = ease((t - o.t0) / 0.5) * (1 - ease((t - o.t1 + 0.5) / 0.5));
  if (a <= 0) return;
  const chap = TL.overlays.some(c => c.kind === 'chapter' && t >= c.t0 && t <= c.t1);
  g.save(); g.globalAlpha = a;
  const y = VERT ? 230 : (chap ? 120 : 110);
  g.font = '700 40px MonoBold'; const w = g.measureText(o.text).width;
  g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(80, y - 52, w + 60, 76);
  g.fillStyle = '#c8a25a'; g.fillRect(80, y - 52, 6, 76);
  mono(o.text, 110, y, 40, '#f2f5f7');
  g.restore();
}
function endCard(o, t) {
  const a = ease((t - o.t0) / 0.6) * (1 - ease((t - o.t1 + 0.6) / 0.6));
  g.save(); g.globalAlpha = a;
  g.font = '700 110px Oswald'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#eef3f6';
  g.letterSpacing = '12px'; g.fillText('ПОДПИСЫВАЙСЯ', W / 2, H / 2 - 20); g.letterSpacing = '0px';
  g.fillStyle = '#c8a25a'; g.fillRect(W / 2 - 300, H / 2 + 60, 600, 5);
  g.restore();
}
function wrap(str, size, maxW) {
  g.font = `600 ${size}px Inter`;
  const out = []; let cur = '';
  for (const w of str.split(' ')) { const c = cur ? cur + ' ' + w : w; if (g.measureText(c).width > maxW && cur) { out.push(cur); cur = w; } else cur = c; }
  if (cur) out.push(cur);
  return out;
}
function balance(str, size, maxW) {
  g.font = `600 ${size}px Inter`;
  if (g.measureText(str).width <= maxW) return [str];
  const w = str.split(' '); let best = null;
  for (let i = 1; i < w.length; i++) {
    const a = w.slice(0, i).join(' '), b = w.slice(i).join(' '), m = Math.max(g.measureText(a).width, g.measureText(b).width);
    if (!best || m < best[0]) best = [m, [a, b]];
  }
  return best[0] <= maxW ? best[1] : wrap(str, size, maxW);
}
// long narration lines are shown in parts, split at sentence ends, each for its share of the line's time
function parts(l) {
  const ss = l.text.match(/[^.!?…]+[.!?…»]*\s*/g) ?? [l.text];
  const out = []; let cur = '';
  for (const s of ss) { if ((cur + s).length > 95 && cur) { out.push(cur.trim()); cur = s; } else cur += s; }
  if (cur.trim()) out.push(cur.trim());
  const tot = out.reduce((a, s) => a + s.length, 0); let t0 = l.t0;
  return out.map(s => { const d = (l.t1 - l.t0) * s.length / tot, r = [s, t0, t0 + d]; t0 += d; return r; });
}
const WHO = { S: 'ШЕКЛТОН', W: 'ФРЭНК УАЙЛД', M: 'С БЕРЕГА' };
function subs(t) {
  for (const l of TL.lines) {
    if (t < l.t0 - 0.1 || t > l.t1 + 0.4) continue;
    for (const [s, a0, a1] of parts(l)) {
      if (t < a0 - 0.1 || t > a1 + 0.3) continue;
      const a = ease((t - a0 + 0.1) / 0.15) * (1 - ease((t - a1 - 0.15) / 0.15));
      const FS = VERT ? 52 : 44, LH = VERT ? 66 : 58;
      const lines = VERT ? wrap(s, FS, W - 140) : balance(s, 44, 1500), y0 = (VERT ? H - 560 : H - 70) - (lines.length - 1) * LH;
      g.save(); g.globalAlpha = a;
      if (WHO[l.who]) mono(WHO[l.who], W / 2, y0 - 62, 26, '#e8c477', 'center');
      g.font = `600 ${FS}px Inter`; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.lineJoin = 'round'; g.lineWidth = 8; g.strokeStyle = 'rgba(0,0,0,0.85)';
      lines.forEach((x, i) => g.strokeText(x, W / 2, y0 + i * LH));
      g.fillStyle = WHO[l.who] ? '#fff4dc' : '#ffffff';
      lines.forEach((x, i) => g.fillText(x, W / 2, y0 + i * LH));
      g.restore();
    }
  }
}

export function frame(t) {
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  const i = TL.shots.findIndex(s => t >= s.t0 && t < s.t1);
  const s = TL.shots[i] ?? TL.shots[TL.shots.length - 1], p = TL.shots[i - 1];
  const hard = HARD.has(s.ev), k = hard ? 1 : clamp((t - s.t0) / XF);
  if (p && k < 1 && p.img) drawShot(p, t, 1);
  if (s.img) drawShot(s, t, p && !p.img ? ease((t - s.t0) / 1.2) : (p ? ease(k) : ease(t / 1.5)));
  grade(t);
  for (const o of TL.overlays) {
    if (t < o.t0 - 0.05 || t > o.t1 + 0.6) continue;
    if (o.kind === 'cap') cap(o, t); else virtual(() => ({ title, chapter, end: endCard })[o.kind]?.(o, t));
  }
  if (!NOSUBS) subs(t);
  if (VERT && !NOSUBS && t > CLIP_END - 3.2) fullStory(t);
}
function fullStory(t) {
  const a = ease((t - (CLIP_END - 3.2)) / 0.4);
  g.save(); g.globalAlpha = a; g.translate(W / 2, 330); g.rotate(-0.02);
  // PLATE=soon (the film is not out yet): «ПОЛНЫЙ ФИЛЬМ / СКОРО НА КАНАЛЕ», no arrow; default: «ПОЛНАЯ ИСТОРИЯ / ПО ССЫЛКЕ ВНИЗУ» + arrow
  const soon = process.env.PLATE === 'soon', s2 = soon ? 'СКОРО НА КАНАЛЕ' : 'ПО ССЫЛКЕ ВНИЗУ';
  g.font = '700 64px Oswald'; const s1 = soon ? 'ПОЛНЫЙ ФИЛЬМ' : 'ПОЛНАЯ ИСТОРИЯ', w = g.measureText(s1).width + 70;
  g.fillStyle = '#ffd400'; g.fillRect(-w / 2, -60, w, 120); g.fillStyle = '#111'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s1, 0, 4);
  g.font = '700 46px Oswald'; g.lineWidth = 8; g.strokeStyle = '#000'; g.strokeText(s2, 0, 120); g.fillStyle = '#fff'; g.fillText(s2, 0, 120);
  if (soon) { g.restore(); return; }
  const ay = 175 + 12 * Math.abs(Math.sin(t * 5));
  g.fillStyle = '#ffd400'; g.strokeStyle = '#000'; g.lineWidth = 6; g.beginPath(); g.moveTo(-34, ay); g.lineTo(34, ay); g.lineTo(0, ay + 46); g.closePath(); g.stroke(); g.fill();
  g.restore();
}
let NOSUBS = false;
export function thumbAt(t, lines, plateText, plateY = 1500) {
  NOSUBS = true; frame(t); NOSUBS = false;
  const gr = g.createLinearGradient(0, 0, 0, 900); gr.addColorStop(0, 'rgba(0,0,0,0.65)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, 900);
  for (const [str, y, size, col] of lines) {
    g.font = `700 ${size}px Oswald`; const w = g.measureText(str).width, k = Math.min(1, (W - 80) / w);
    g.save(); g.translate(W / 2, y); g.scale(k, k); g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
    g.lineWidth = size * 0.15; g.strokeStyle = '#000'; g.strokeText(str, 0, 0); g.fillStyle = col; g.fillText(str, 0, 0); g.restore();
  }
  if (plateText) { g.save(); g.translate(W / 2, plateY); g.rotate(-0.03); g.font = '700 70px Oswald'; const w = g.measureText(plateText).width + 60; g.fillStyle = '#ffd400'; g.fillRect(-w / 2, -56, w, 112); g.fillStyle = '#111'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(plateText, 0, 4); g.restore(); }
}

// the thumbnail: the crushed ship, «2 ГОДА ВО ЛЬДАХ» and «ВЕРНУЛИСЬ ВСЕ 28»
export function cover() {
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  const v = IMG.get(1);
  if (v) { g.save(); g.translate(W / 2, H / 2); g.scale(1.1, 1.1); g.drawImage(v, -W / 2 + 40, -H / 2, W, H); g.restore(); }
  const v2 = g.createLinearGradient(0, 0, W, 0); v2.addColorStop(0, 'rgba(0,0,0,0.75)'); v2.addColorStop(0.55, 'rgba(0,0,0,0.15)'); v2.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = v2; g.fillRect(0, 0, W, H);
  for (const [str, y, size, col] of [['2 ГОДА', 300, 230, '#ffffff'], ['ВО ЛЬДАХ', 520, 200, '#ffffff']]) {
    g.font = `700 ${size}px Oswald`; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
    g.lineWidth = size * 0.14; g.strokeStyle = '#000'; g.strokeText(str, 70, y); g.fillStyle = col; g.fillText(str, 70, y);
  }
  g.save(); g.translate(80, 640); g.rotate(-0.03);
  g.fillStyle = '#ffd400'; g.fillRect(0, 0, 860, 130); g.font = '700 86px Oswald'; g.fillStyle = '#111'; g.textAlign = 'left'; g.textBaseline = 'middle';
  g.fillText('ВЕРНУЛИСЬ ВСЕ 28', 34, 68); g.restore();
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
export const COVER_IMGS = { a: [1], b: [42], c: [60] };
export function coverVariant(k) {
  if (k === 'b') {
    thumbBg(IMG.get(42), 1.12, 160, 0);
    shade('left');
    bigText([['1300 КМ', 330, 250, '#ffd400'], ['НА ЛОДКЕ', 560, 210, '#ffffff']], 70);
    tplate('ЧЕРЕЗ САМЫЙ БУРНЫЙ ОКЕАН', 80, 680, 70);
  } else if (k === 'c') {
    thumbBg(IMG.get(60), 1.1, 140, 0);
    shade('left');
    bigText([['НАШЛИ', 300, 220, '#ffffff'], ['ЧЕРЕЗ 100 ЛЕТ', 520, 200, '#ffd400']], 70);
    tplate('ГЛУБИНА 3 КМ', 80, 660, 80, '#ff2b2b', '#ffffff');
  } else cover();
}
