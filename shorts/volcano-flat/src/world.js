// Kamchatka at dawn in flat shapes: the sky, a snow-capped volcano that erupts (column, umbrella, lava, lightning),
// far ridges, forested hills, and the main slope: the hunting tower on a hilltop, the ridge path, the fork down to the
// river, the river valley where the mudflow runs, the forest road with the UAZ «буханка» and a log hut.
// World units are pixels at zoom 1. Layers: VOLC 0.04, FAR 0.15, MID 0.4, MAIN 1, FG 1.4 (camera.js).
import { g, W, H, poly, rect, rrect, ell, fill, limb, polyPath, smoothPath, sample, inside, tube } from './flat.js';
import { hash, lerp, clamp, noise, mix, TAU, ease, shade, rgba } from './lib.js';
import { scaleOf } from './camera.js';
import { text, FONTS } from './type.js';

export const P = {
  sky: ['#232850', '#36396b', '#5d4d80', '#a4637a', '#e08e6a', '#f4b77c'], ash: '#3d3a44', ashDark: '#2a2830',
  volc: '#4b4f74', volcSh: '#3c3f61', snow: '#eef2f8', snowSh: '#c3cde0', lava: '#ff6a2a', lavaHot: '#ffd36a', crust: '#8f2f1c',
  plume: '#7a7582', plumeSh: '#5a5664', plumeHi: '#9a94a2', glow: '#e0835a',
  far: '#3f4c70', far2: '#4a5a7e', mid: '#2e4b48', mid2: '#365853', midTree: '#24403d',
  grass: '#6f8f48', grassSh: '#5b7a3a', grassHi: '#86a557', bush: '#2f5a3f', bushSh: '#244a33', dirt: '#a68d63', dirtSh: '#8c7550',
  birch: '#ece5d6', birchMark: '#3a3540', leaf: '#e0b84a', leafSh: '#c29530',
  river: '#3f6f96', riverHi: '#79a9cc', gravel: '#8f8a7c', gravelSh: '#77736a', bank: '#4f6e3c',
  wood: '#8c5b38', woodSh: '#6b4329', woodHi: '#a8703f', roof: '#5a3b2a',
  mud: '#7a6650', mudSh: '#5e4e3d', mudHi: '#a08a6e', mudDark: '#4a3d31', rock: '#4c4852', rockHi: '#6a6572', log: '#7b5536',
  uaz: '#6b7f4a', uazSh: '#556839', uazHi: '#8a9c63', glass: '#1d2433', glassHi: '#3a4a66', tire: '#1e1d26', hub: '#8a8a96',
  hut: '#86562f', hutSh: '#6a4225', hutWin: '#ffd27a', bolt: '#f3e9ff', boltGlow: '#a98bff', text: '#fff3d6', red: '#ff4d4d',
  ashFlake: '#cfcad2', ashFlakeSh: '#8e8995',
};
export const F = { VOLC: 0.04, FAR: 0.15, MID: 0.4, MAIN: 1, FG: 1.4 };
const greyOf = (c, k) => mix(c, '#8d8a8f', k);     // ash settling on things

// —— the main slope: the path line, smooth through control points ——
const PATH = [[-6200, -215], [-4600, -205], [-3800, -192], [-3300, -160], [-2700, -70], [-2200, 22], [-1800, 58], [-1200, 72], [-560, 42],
  [-220, 6], [0, 0], [260, 12], [620, 96], [1100, 270], [1800, 430], [2800, 540]];
const PATH_S = sample(PATH, 24, false);
export function groundY(x) {
  if (x <= PATH_S[0][0]) return PATH_S[0][1];
  for (let i = 1; i < PATH_S.length; i++) {
    const a = PATH_S[i - 1], b = PATH_S[i];
    if (x <= b[0]) return lerp(a[1], b[1], (x - a[0]) / (b[0] - a[0]));
  }
  return PATH_S[PATH_S.length - 1][1];
}
export const RIVER = { top: 880, bot: 1060 };
export const TOWER = { x: 0, floor: -720, rail: -830, roof: -1090, peak: -1185, leg: 150, top: 108 };
export const LADDER = { a: [-330, 0], b: [-112, TOWER.floor] };
export const FORK = { x: -1800, sign: [-1905, 112], down: [[-1800, 58], [-1960, 300], [-2140, 520], [-2330, 760], [-2420, RIVER.top]] };
export const BOAT = { x: -2560, y: RIVER.top + 22 };
export const UAZ = { x: -3880, y: groundY(-3880), len: 640 };
export const HUT = { x: -4620, y: groundY(-4620) };

// —— sky: flat bands that go grey as the ash spreads (k 0 dawn … 1 ash); they follow the camera's tilt and lens ——
export function drawSky(k = 0, flash = 0, cam = null) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  const lens = cam?.lens ?? 1, ty = cam?.ty ?? 0, hz = 1100;
  const ys = [0, 300, 560, 820, 1020, 1160].map(y => hz + (y - hz) * lens + ty);
  const n = P.sky.length;
  for (let i = 0; i < n; i++) {
    const c = mix(mix(P.sky[i], i < 3 ? P.ashDark : P.ash, k), '#fff3d6', flash * (0.15 + 0.1 * i));
    const y0 = i === 0 ? 0 : Math.max(0, ys[i]), y1 = i === n - 1 ? H : Math.min(H, ys[i + 1]);
    if (y1 > y0) rect(0, y0, W, y1 - y0 + 1, c);
  }
}

// —— the volcano layer (layer units; the caller sets the transform) ——
export const VOLC = { x: 300, y: -800, base: -420, half: 620 };       // summit and base line in the VOLC layer
const VENT = [VOLC.x, VOLC.y + 8], HMAX = 1500;
// eruption clock: te = the blast
export function plumeState(t, te) {
  const u = t - te;
  if (u < 0) return null;
  return { u, bend: 280 * clamp((u - 1.5) / 9, 0, 1.5) };
}
// a point of the column's axis h pixels above the vent: the wind bends the top to the right
function spineH(st, h) { const v = h / HMAX; return [VENT[0] + st.bend * v * v * v + 24 * Math.sin(v * 3), VENT[1] - h]; }
export function drawVolcano(t, te, o = {}) {
  const { x, y, base, half } = VOLC;
  const cone = [[x - half - 260, base + 30], [x - half, base], [x - 160, y + 70], [x - 46, y + 4], [x + 46, y + 2], [x + 170, y + 80], [x + half + 40, base], [x + half + 300, base + 30]];
  const body = smoothPath(cone.concat([[x + half + 300, base + 600], [x - half - 260, base + 600]]));
  fill(body, P.volc);
  inside(body, () => {
    poly([[x + 10, y], [x + half + 120, base + 20], [x + half + 400, base + 600], [x + 40, base + 600]], P.volcSh);
    const snow = [[x - 190, y + 120], [x - 120, y + 150], [x - 70, y + 120], [x - 20, y + 170], [x + 40, y + 130], [x + 110, y + 175], [x + 200, y + 125], [x + 120, y - 10], [x - 120, y - 10]];
    fill(smoothPath(snow), P.snow);
    inside(smoothPath(snow), () => poly([[x + 12, y - 20], [x + 260, y + 200], [x + 30, y + 220]], P.snowSh));
    // lava: three tongues creep down the flanks after the blast, a dark crust round a hot core (far away: "лава сюда не дойдёт")
    if (t > te + 0.5) {
      const u = ease.out(clamp((t - te - 0.5) / 9));
      for (const [dx, k, w, reach, ph] of [[-30, -0.32, 20, 0.95, 0], [28, 0.38, 22, 0.72, 2], [4, 0.04, 15, 0.5, 4]]) {
        const len = (60 + 270 * reach) * u;
        if (len < 6) continue;
        const pts = [];
        for (let i = 0; i <= 14; i++) { const v = i / 14; pts.push([x + dx + k * len * v + 16 * Math.sin(v * 7 + ph) * v, y + 8 + len * v]); }
        fill(polyPath(tube(pts, s => w * (1 - 0.35 * s))), P.crust);
        fill(polyPath(tube(pts, s => w * 0.58 * (1 - 0.4 * s))), P.lava);
        fill(polyPath(tube(pts.slice(0, 6), s => w * 0.28 * (1 - 0.5 * s))), P.lavaHot);
      }
    }
  });
  if (t <= te) { if (o.smoke) wisp(t); return; }
  const st = plumeState(t, te), u = st.u;
  // the blast: a flash at the vent and a pressure ring
  const fl = clamp(1 - u / 0.4);
  if (fl > 0) {
    for (let i = 0; i < 12; i++) {
      const a = -Math.PI * (0.06 + 0.88 * i / 11) + 0.08 * Math.sin(i * 3), L = (260 + 260 * hash(i + 60)) * (0.4 + 0.6 * (1 - fl)), w = 0.07;
      poly([[VENT[0], VENT[1]], [VENT[0] + Math.cos(a - w) * L, VENT[1] + Math.sin(a - w) * L], [VENT[0] + Math.cos(a + w) * L, VENT[1] + Math.sin(a + w) * L]], i % 2 ? P.lavaHot : '#fff3d6', fl);
    }
    ell(VENT[0], VENT[1] - 20, 70 + 120 * (1 - fl), 50 + 90 * (1 - fl), '#fff3d6', 0, fl);
  }
  const ring = u / 1.2;
  if (ring > 0 && ring < 1) {
    g.save(); g.globalAlpha *= 0.5 * (1 - ring); g.lineWidth = 16 * (1 - ring) + 4; g.strokeStyle = P.text;
    g.beginPath(); g.ellipse(VENT[0], VENT[1], 100 + 900 * ring, 30 + 280 * ring, 0, 0, TAU); g.stroke(); g.restore();
  }
  ell(VENT[0], VENT[1] + 4, 60, 18, P.lava);                              // the crater glows
  for (let i = 0; i < 22; i++) {                                         // lava bombs over the crater
    const ph = (t * 1.2 + hash(i) * 7) % 1, a = -Math.PI / 2 + (hash(i + 9) - 0.5) * 1.4, v = 120 + 150 * hash(i + 3);
    const px = VENT[0] + Math.cos(a) * v * ph, py = VENT[1] + Math.sin(a) * v * ph + 240 * ph * ph;
    ell(px, py, 6 * (1 - ph) + 2, 6 * (1 - ph) + 2, ph < 0.4 ? P.lavaHot : P.lava, 0, 1 - ph * 0.7);
  }
  drawPlume(t, st, o);
}
// a thin wisp of steam before the blast
function wisp(t) {
  for (let i = 0; i < 6; i++) {
    const ph = (t * 0.35 + i / 6) % 1;
    ell(VENT[0] + 30 * ph + 6 * Math.sin(t + i), VENT[1] - 20 - 150 * ph, 16 + 26 * ph, 13 + 20 * ph, P.plumeHi, 0, 0.7 * (1 - ph));
  }
}
// the eruption column as a conveyor: K puffs ride up from the vent to the top and come back in at the bottom with new
// looks, so the column is always closed; it grows from the blast (the jet shoots up, then slows). Over it the umbrella:
// M puffs that come out one after another as it spreads, mostly downwind, swelling and boiling
const K = 40, M = 64, CROSS = 3.6;
const colH = u => HMAX * (1 - Math.exp(-u / 1.1)) + 30 * Math.max(0, u - 3);
const spreadOf = u => clamp((u - 1.6) / 11, 0, 1.25);
function puffs(t, st) {
  const out = [], u = st.u, Hc = colH(u), sp = spreadOf(u);
  for (let j = 0; j < K; j++) {
    const ph = j / K + u / CROSS, id = j + K * Math.floor(ph), f = ph - Math.floor(ph);
    const h1 = hash(id * 1.37 + 0.11), h2 = hash(id * 2.11 + 0.77), h3 = hash(id * 0.53 + 0.31);
    const v = Math.pow(f, 0.85), [sx, sy] = spineH(st, Hc * v), wcol = (60 + 360 * v) * (0.5 + 0.5 * Hc / HMAX);
    const r = (40 + 160 * v) * (0.75 + 0.5 * h1) * (0.5 + 0.5 * Hc / HMAX) * clamp(f / 0.06) * (1 - 0.6 * clamp((f - 0.88) / 0.12))
      * (1 + 0.06 * Math.sin(u * 2.3 + id));
    out.push({ x: sx + (h2 * 2 - 1) * wcol * 0.55, y: sy + 10 * Math.sin(u * 1.7 + id), r, v, side: h2 * 2 - 1, k: id, late: 0 });
  }
  {                                                   // the rounded head of the rising jet, which later feeds the umbrella
    const [hx, hy] = spineH(st, Hc), k = 0.5 + 0.5 * Hc / HMAX;
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * (0.1 + 0.8 * i / 6), rr = (150 + 50 * hash(i + 70)) * k;
      out.push({ x: hx - Math.cos(a) * 220 * k + 20 * Math.sin(u * 1.4 + i), y: hy + 30 - Math.sin(a) * 90 * k, r: rr, v: 1, side: -Math.cos(a), k: 500 + i, late: 0.01 });
    }
  }
  if (sp > 0) {
    const [tx, ty] = spineH(st, Hc * 0.97);
    for (let m = 0; m < M; m++) {
      const h1 = hash(m * 4.13 + 0.5), h2 = hash(m * 1.91 + 0.2), h3 = hash(m * 3.37 + 0.8), on = clamp((sp * 1.2 - h1 * 0.9) / 0.15);
      if (on <= 0) continue;
      const down = h2 < 0.68, reach = (down ? 1500 : 650) * sp * (0.25 + 0.75 * h3), dx = (down ? 1 : -1) * reach;
      const sag = 90 * Math.pow(reach / 1500, 1.5) * (down ? 1 : 0.6);            // the arm droops a little far out
      const r = (110 + 100 * h3) * (0.5 + 0.5 * on) * (1 + 0.04 * Math.sin(u * 1.6 + m)) * (1 - 0.3 * reach / 1800);
      out.push({ x: tx + dx + 16 * Math.sin(u * 0.7 + m), y: ty - 60 + 150 * (h2 - 0.4) + sag + 10 * Math.sin(u * 1.3 + m * 2), r, v: 1, side: h3 * 2 - 1.3, k: 1000 + m, late: reach / 300 });
    }
  }
  // the umbrella sits behind the column top: draw it first
  return out.sort((p, q) => q.late - p.late || q.v - p.v);
}
export function plumeExtent(t, te) {           // the umbrella's right edge and underside (layer units), for the ash curtain
  const st = plumeState(t, te); if (!st) return null;
  let xr = VENT[0], yb = VENT[1] - 400;
  for (const p of puffs(t, st)) if (p.late > 0) { xr = Math.max(xr, p.x + p.r * 0.6); yb = Math.max(yb, p.y + p.r * 0.5); }
  return { xr, yb };
}
function drawPlume(t, st, o = {}) {
  const dark = o.dark ?? 0, gl = clamp(1 - st.u / 20, 0.4, 1);
  const base = mix(P.plume, P.ashDark, dark * 0.45), sh = mix(P.plumeSh, P.ashDark, dark * 0.5), hi = mix(P.plumeHi, P.plume, dark * 0.7);
  const ps = puffs(t, st);
  for (const p of ps) {
    const warm = clamp(1 - p.v / 0.16) * 0.55 * gl;
    ell(p.x + p.r * 0.16, p.y + p.r * 0.14, p.r, p.r * 0.9, mix(sh, P.crust, warm * 0.6));
    ell(p.x, p.y, p.r * 0.93, p.r * 0.84, mix(base, P.glow, warm));
    if (p.side < -0.15 && hash(p.k * 7.7) < 0.6) ell(p.x - p.r * 0.3, p.y - p.r * 0.32, p.r * 0.4, p.r * 0.33, hi, 0, 0.8);
  }
  // the ash curtain under the downwind arm
  const ext = plumeExtent(t, t - st.u);
  if (ext && ext.xr > VENT[0] + 300) {
    const k = clamp((ext.xr - VENT[0] - 300) / 900) * (o.curtain ?? 1);
    g.save(); g.globalAlpha *= 0.4 * k;
    for (let i = 0; i < 16; i++) {
      const x0 = VENT[0] + 220 + i * ((ext.xr - VENT[0] - 220) / 16) + 30 * Math.sin(i * 1.3 + t * 0.7), w = 50 + 40 * hash(i);
      if (x0 > ext.xr) break;
      poly([[x0, ext.yb - 60], [x0 + w, ext.yb - 60], [x0 + w + 220, VOLC.base + 420], [x0 + 160, VOLC.base + 420]], mix(P.plumeSh, P.ashDark, 0.4));
    }
    g.restore();
  }
  // volcanic lightning: in the column, or from the cloud down to the ground
  for (const b of o.bolts ?? []) if (t >= b.t && t < b.t + b.d) drawBolt(b, st, t);
}
export function boltPath(seed, a, b, n = 9, amp = 70) {
  const pts = [a];
  for (let i = 1; i < n; i++) {
    const v = i / n;
    pts.push([lerp(a[0], b[0], v) + (hash(seed * 13 + i) - 0.5) * 2 * amp, lerp(a[1], b[1], v) + (hash(seed * 7 + i) - 0.5) * amp * 0.5]);
  }
  pts.push(b);
  return pts;
}
export function strokeBolt(pts, w, a = 1, branch = 0) {
  g.save(); g.globalAlpha *= a;
  limb(pts, w * 3.4, rgba(P.boltGlow, 0.3), false);
  limb(pts, w * 1.7, P.boltGlow, false);
  limb(pts, w * 0.75, P.bolt, false);
  if (branch) {                                   // a forked side branch from a third of the way down
    const i = Math.floor(pts.length / 3), p = pts[i], q = pts[Math.min(pts.length - 1, i + 3)];
    const side = boltPath(branch, p, [q[0] + 140 * (hash(branch) > 0.5 ? 1 : -1), q[1] + 40], 4, 40);
    limb(side, w * 1.0, P.boltGlow, false); limb(side, w * 0.45, P.bolt, false);
  }
  g.restore();
}
// flicker: a stroke of lightning is two or three fast flashes
export const flick = (t, t0) => ((Math.floor((t - t0) * 28) % 3) === 1 ? 0.35 : 1);
function drawBolt(b, st, t) {
  const top = spineH(st, HMAX * (b.v ?? 0.6));
  const a = [top[0] + (b.dx ?? 0), top[1]];
  const e = b.to ?? [spineH(st, HMAX * Math.max(0, (b.v ?? 0.6) - 0.3))[0] + (b.ex ?? 120), top[1] + (b.len ?? 380)];
  strokeBolt(boltPath(b.seed, a, e, b.to ? 11 : 8, b.to ? 90 : 60), b.w ?? 8, flick(t, b.t), b.to ? b.seed + 5 : 0);
}

// —— far ridges and forested hills ——
export function drawFar(ash = 0) {
  const c1 = mix(P.far, P.ash, ash * 0.6), c2 = mix(P.far2, P.ash, ash * 0.6);
  fill(smoothPath([[-2200, -330], [-1500, -420], [-900, -360], [-300, -440], [400, -350], [1100, -430], [1900, -340], [2800, -420], [3400, -330], [3400, 600], [-2200, 600]]), c2);
  fill(smoothPath([[-2200, -260], [-1300, -320], [-500, -270], [200, -330], [900, -270], [1700, -320], [2500, -260], [3400, -300], [3400, 600], [-2200, 600]]), c1);
}
export function drawMid(t, ash = 0) {
  const c1 = mix(P.mid, P.ash, ash * 0.5), c2 = mix(P.mid2, P.ash, ash * 0.5), tr = mix(P.midTree, P.ash, ash * 0.5);
  fill(smoothPath([[-5200, -150], [-4200, -260], [-3300, -170], [-2500, -280], [-1500, -180], [-700, -260], [200, -170], [1000, -240], [2000, -160], [3200, -230], [3200, 900], [-5200, 900]]), c2);
  // a far reach of the river, winding toward the volcano
  limb([[-1400, 420], [-900, 300], [-300, 240], [200, 150], [600, 60], [900, -40]], 26, mix(P.riverHi, P.ash, ash * 0.5));
  fill(smoothPath([[-5200, -40], [-4000, -110], [-3000, -30], [-2000, -120], [-1000, -40], [0, -110], [900, -30], [2000, -100], [3200, -40], [3200, 900], [-5200, 900]]), c1);
  for (let i = 0; i < 70; i++) {             // fir and larch silhouettes on the hill crest
    const x = -5200 + i * 120 + hash(i) * 60, y = -60 + 50 * Math.sin(x * 0.0021) + 20 * hash(i + 4), h = 90 + 60 * hash(i + 2);
    poly([[x, y - h], [x + 22, y - h * 0.4], [x + 14, y - h * 0.42], [x + 30, y], [x - 30, y], [x - 14, y - h * 0.42], [x - 22, y - h * 0.4]], tr);
  }
}

// —— the main slope ——
function birch(x, y, h, k = 1, lean = 0, t = 0, wind = 0, ash = 0) {
  const top = [x + lean * h, y - h];
  limb([[x, y], [x + lean * h * 0.5, y - h * 0.5], top], 26 * k, P.birch);
  for (let i = 1; i < 7; i++) { const v = i / 7; const px = x + lean * h * v; limb([[px - 10 * k, y - h * v], [px + 5 * k, y - h * v - 3]], 7 * k, P.birchMark, false); }
  const sway = wind * 22 * Math.sin(t * 2.2 + x) + wind * 16;
  const lf = greyOf(P.leaf, ash * 0.5), lsh = greyOf(P.leafSh, ash * 0.5);
  for (const [dx, dy, r] of [[0, 0, 86], [-62, 36, 70], [64, 30, 72], [-22, -62, 64], [36, -50, 58], [-80, -10, 50]]) {
    ell(top[0] + dx * k + sway + 12 * k, top[1] + dy * k + 14 * k, r * k, r * 0.86 * k, lsh);
    ell(top[0] + dx * k + sway, top[1] + dy * k, r * k, r * 0.86 * k, lf);
  }
}
function bush(x, y, r, ash = 0) {
  const c = greyOf(P.bush, ash * 0.4);
  ell(x + r * 0.2, y + r * 0.1, r * 1.2, r * 0.6, greyOf(P.bushSh, ash * 0.4));
  ell(x - r * 0.4, y - r * 0.1, r * 0.8, r * 0.55, c); ell(x + r * 0.4, y - r * 0.2, r * 0.9, r * 0.6, c); ell(x, y - r * 0.45, r * 0.7, r * 0.5, c);
}
export function drawTower(t, o = {}) {
  const { x, floor, rail, roof, peak, leg, top } = TOWER;
  const scorch = o.scorch ?? 0;
  for (const s of [-1, 1]) limb([[x + s * leg, 0], [x + s * top, floor]], 30, P.woodSh, false);
  for (const [a, b] of [[0, -360], [-360, floor]]) {
    const wa = leg - (leg - top) * (-a / -floor), wb = leg - (leg - top) * (-b / -floor);
    limb([[x - wa, a], [x + wb, b]], 16, P.woodSh, false); limb([[x + wa, a], [x - wb, b]], 16, P.woodSh, false);
  }
  rect(x - 150, floor, 300, 34, P.wood); rect(x - 150, floor + 26, 300, 8, P.woodSh);
  for (const s of [-1, 1]) limb([[x + s * 136, floor], [x + s * 136, roof]], 16, P.woodSh, false);
  rect(x - 150, rail, 300, 18, P.wood); rect(x - 150, rail + 50, 300, 12, P.woodSh);
  const rp = [[x - 190, roof + 6], [x, peak], [x + 190, roof + 6], [x + 190, roof + 30], [x, peak + 30], [x - 190, roof + 30]];
  fill(polyPath(rp), mix(P.roof, '#1a1820', scorch));
  poly([[x, peak], [x + 190, roof + 6], [x + 190, roof + 30], [x, peak + 30]], mix(shade(P.roof, -0.2), '#1a1820', scorch));
  if (scorch > 0) {                                       // a charred split where the bolt hit, embers on it
    limb([[x - 6, peak + 4], [x + 18, peak + 40], [x - 10, peak + 70]], 9, '#1a1820', false);
    for (let i = 0; i < 5; i++) ell(x - 30 + 15 * i, peak + 24 + 10 * Math.sin(i * 2), 5, 5, P.lava, 0, scorch * (0.5 + 0.5 * Math.sin(t * 9 + i * 2)));
  }
  if (o.smoke) for (let i = 0; i < 7; i++) {
    const ph = (o.smoke * 0.8 + i / 7) % 1;
    ell(x + 10 + 70 * ph + 10 * Math.sin(i), peak - 20 - 220 * ph, 18 + 46 * ph, 16 + 36 * ph, '#4a4652', 0, 0.75 * (1 - ph) * clamp(o.smoke * 3));
  }
}
// the near rail of the platform goes over the hunter's legs
export function drawTowerFront() {
  const { x, floor, rail } = TOWER;
  for (let i = -2; i <= 2; i++) rect(x + i * 60 - 6, rail + 10, 12, floor - rail - 10, P.woodSh);
  rect(x - 150, rail + 6, 300, 16, P.woodHi);
}
export function drawLadder() {
  const [a, b] = [LADDER.a, LADDER.b], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), nx = -dy / L * 34, ny = dx / L * 34;
  limb([[a[0] - nx, a[1] - ny], [b[0] - nx, b[1] - ny]], 12, P.wood, false);
  for (let i = 1; i < 12; i++) { const v = i / 12; limb([[a[0] + dx * v - nx, a[1] + dy * v - ny], [a[0] + dx * v + nx, a[1] + dy * v + ny]], 9, P.woodSh, false); }
  limb([[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny]], 12, P.woodHi, false);
}
export function ladderAt(v) { return [lerp(LADDER.a[0], LADDER.b[0], v), lerp(LADDER.a[1], LADDER.b[1], v)]; }

export function drawSlope(t, o = {}) {
  const ash = o.ash ?? 0;
  const gr = greyOf(P.grass, ash * 0.55), grs = greyOf(P.grassSh, ash * 0.55), grh = greyOf(P.grassHi, ash * 0.6);
  // the near bank below the river, gravel on both sides, the river with streaks running left (downstream)
  rect(-7000, RIVER.bot + 14, 11000, 2600, greyOf(P.bank, ash * 0.5));
  for (let i = 0; i < 30; i++) { const x = -6800 + i * 360 + 120 * hash(i + 3); ell(x, RIVER.bot + 120 + 300 * hash(i + 4), 200, 40, greyOf(P.grassSh, ash * 0.5), 0); }
  rect(-7000, RIVER.bot - 6, 11000, 24, P.gravel);
  rect(-7000, RIVER.top, 11000, RIVER.bot - RIVER.top, P.river);
  if (!o.noStreaks) for (let i = 0; i < 110; i++) {
    const L = 120 + 90 * hash(i), x = ((-i * 157 - t * 160) % 11000 + 11000) % 11000 - 7000, y = RIVER.top + 22 + (i % 6) * 26;
    limb([[x, y], [x + L, y]], 7, P.riverHi, false);
  }
  rect(-7000, RIVER.top - 16, 11000, 20, P.gravel);
  for (let i = 0; i < 80; i++) { const x = -6900 + i * 140 + 60 * hash(i); ell(x, RIVER.top - 8 + 4 * hash(i + 1), 16 + 10 * hash(i + 2), 8, P.gravelSh); }
  // the slope from the path down to the river
  const top = PATH_S.filter(p => p[0] > -7000), poly0 = [...top, [top[top.length - 1][0], RIVER.top - 12], [top[0][0], RIVER.top - 12]];
  const sl = polyPath(poly0);
  fill(sl, gr);
  inside(sl, () => {
    for (let i = 0; i < 40; i++) {
      const x = -6400 + i * 230 + hash(i) * 80, y = groundY(x) + 120 + hash(i + 5) * 600;
      ell(x, y, 160 + 90 * hash(i + 1), 40 + 30 * hash(i + 2), grs, -0.25);
    }
    for (let i = 0; i < 70; i++) { const x = -6400 + i * 130, y = groundY(x); ell(x, y + 6, 80, 16, grh); }      // lit lip of the path
  });
  const strip = PATH_S.map(([x, y]) => [x, y + 4]);
  limb(strip, 26, greyOf(P.dirt, ash * 0.5), true);
  limb(FORK.down, 34, greyOf(P.dirtSh, ash * 0.5));
  limb(FORK.down, 18, greyOf(P.dirt, ash * 0.5));
}
export function drawBoat(t, hit = Infinity) {
  if (t > hit) {                                  // flipped and swept away by the flow
    const u = t - hit, x = BOAT.x - 1100 * u, y = BOAT.y - 300 * u + 700 * u * u;
    if (u < 1.0) { g.save(); g.translate(x, y); g.rotate(-u * 5); poly([[-90, -10], [90, -10], [60, 26], [-60, 26]], '#5a7a9a'); rect(-80, -14, 160, 8, '#7d9dbc'); g.restore(); }
    return;
  }
  const bob = 4 * Math.sin(t * 3);
  poly([[BOAT.x - 90, BOAT.y - 10 + bob], [BOAT.x + 90, BOAT.y - 10 + bob], [BOAT.x + 60, BOAT.y + 24 + bob], [BOAT.x - 60, BOAT.y + 24 + bob]], '#5a7a9a');
  rect(BOAT.x - 80, BOAT.y - 14 + bob, 160, 8, '#7d9dbc');
  limb([[BOAT.x + 90, BOAT.y - 6 + bob], [BOAT.x + 170, BOAT.y - 40]], 4, '#3a3540', false);
  limb([[BOAT.x + 170, BOAT.y - 70], [BOAT.x + 170, BOAT.y - 10]], 12, P.woodSh, false);
}
// the signpost at the fork: «К РЕКЕ», pointing down the side path
export function drawSign(o = {}) {
  const [x, y] = FORK.sign;
  limb([[x, y + 4], [x, y - 230]], 16, P.woodSh, false);
  g.save(); g.translate(x - 20, y - 200); g.rotate(0.14 + (o.wob ?? 0));
  poly([[-210, -42], [50, -42], [50, 42], [-210, 42], [-252, 0]], P.woodSh);
  poly([[-206, -38], [46, -38], [46, 34], [-206, 34], [-246, -2]], P.woodHi);
  text('К РЕКЕ', -86, 18, 50, '#3b2416', { shadow: false });
  g.restore();
  return [x - 100, y - 205];
}
export const TREES = [[-560, 560, 0.9], [-980, 300, 1.0], [-1450, -40, 1.1, true], [-2050, 420, 0.9], [-2700, 640, 0.85], [-2950, -100, 1.15, true],
  [-3350, -190, 1.0, true], [-5000, -230, 1.1, true], [600, 400, 0.9], [980, 620, 0.9], [-1250, 700, 0.8], [-3150, 520, 0.85], [-4300, -200, 0.95, true]];
export function drawTrees(t, ash = 0, wind = 0) {
  for (const [x, dy, k, above] of TREES) {
    const y = above ? groundY(x) - 10 : groundY(x) + dy;
    if (!above && y > RIVER.top - 30) continue;
    birch(x, y, 560 * k, k, (hash(x) - 0.5) * 0.12, t, wind, ash);
  }
  for (let i = 0; i < 26; i++) { const x = -6000 + i * 330 + hash(i + 40) * 120; bush(x, groundY(x) + 140 + 260 * hash(i + 41), 60 + 30 * hash(i + 42), ash); }
}

// —— the mudflow (lahar): rushes down the river from the right (upstream, the volcano's side) to the left; xf = its head.
// A steep snout with a curling crest, boulders tumbling in its face, logs riding the lower body behind it ——
export function drawLahar(t, xf, o = {}) {
  const top = RIVER.top, bot = RIVER.bot, x1 = xf + 5200;
  const boil = (i, a) => a * noise(t * 6 + i * 1.7, i + 3);
  const surf = x => {
    const d = x - xf;
    return top - 70 - 150 * Math.exp(-Math.pow((d - 140) / 260, 2)) + 22 * noise(x * 0.006 + t * 8, 3) + 12 * Math.sin(x * 0.02 + t * 15);
  };
  const pts = [[xf + 70, bot + 28], [xf - 6, bot - 30], [xf - 36, top - 40 + boil(1, 10)], [xf - 60 + boil(2, 14), top - 160 + boil(3, 12)],
    [xf - 30 + boil(4, 10), top - 236 + boil(5, 14)], [xf + 60, top - 262 + boil(6, 12)], [xf + 170, top - 222 + boil(7, 10)], [xf + 300, surf(xf + 300)]];
  for (let x = xf + 380; x <= x1; x += 70) pts.push([x, surf(x)]);
  pts.push([x1, bot + 28]);
  const body = smoothPath(pts);
  fill(body, P.mud);
  inside(body, () => {
    rect(xf - 200, bot - 70, 5600, 200, P.mudSh);                      // the wet, darker underside
    for (let i = 0; i < 60; i++) {                                    // bands carried along with the flow
      const L = 160 + 220 * hash(i), x = xf + 120 + (i * 233) % 5000 + 40 * Math.sin(t * 3 + i);
      const y = top - 100 + (bot - top + 140) * hash(i + 7) + 8 * Math.sin(t * 5 + i);
      limb([[x, y], [x + L, y + 5 * Math.sin(i)]], 12 + 10 * hash(i + 2), i % 3 ? P.mudDark : P.mudHi, false);
    }
  });
  // the foaming lip of the crest
  limb([[xf - 58 + boil(2, 14), top - 156 + boil(3, 12)], [xf - 30 + boil(4, 10), top - 232 + boil(5, 14)], [xf + 60, top - 256 + boil(6, 12)], [xf + 170, top - 216 + boil(7, 10)], [xf + 300, surf(xf + 300) + 6]], 22, P.mudHi);
  for (let i = 0; i < 26; i++) { const x = xf + 340 + i * 150 + 50 * Math.sin(t * 6 + i); ell(x, surf(x) + 12, 40 + 26 * hash(i), 11, P.mudHi); }
  // boulders tumbling in the face of the snout, logs riding behind
  for (let i = 0; i < 6; i++) {
    const r = 30 + 26 * hash(i + 20), u = hash(i + 21), x = xf - 10 + 260 * u + 20 * Math.sin(t * 5 + i);
    const y = lerp(top - 190, bot - 40, hash(i + 22)) + 18 * Math.sin(t * 7 + i * 2);
    rock(x, y, r, -(xf / r) * 0.7 + i);
    ell(x + r * 0.3, y + r * 0.7, r * 1.1, r * 0.45, P.mud);
  }
  for (let i = 0; i < 6; i++) {
    const x = xf + 420 + i * 520 + 90 * hash(i + 30), y = surf(x) + 14, a = 0.35 * Math.sin(t * 2.5 + i * 2) + (hash(i + 31) - 0.5) * 1.2;
    g.save(); g.translate(x, y); g.rotate(a);
    rrect(-100, -16, 200, 32, 16, P.log); ell(100, 0, 11, 16, P.mudHi); limb([[-30, -16], [-50, -40]], 8, P.log, false); g.restore();
    ell(x, y + 14, 90, 16, P.mud);
  }
  // mud thrown ahead of the snout
  for (let i = 0; i < 30; i++) {
    const ph = (t * 2.4 + hash(i + 50)) % 1, vx = -300 - 420 * hash(i + 51), vy = -380 - 420 * hash(i + 52);
    const x = xf + 60 * hash(i + 53) + vx * ph * 0.6, y = top - 200 + vy * ph * 0.6 + 1100 * ph * ph * 0.36;
    ell(x, y, 13 * (1 - ph) + 4, 11 * (1 - ph) + 3, i % 3 ? P.mud : P.mudDark, ph * 3, 1);
  }
}
// in front of the river: stones and willow bushes on the near bank
export function drawNearBank(t, ash = 0, wind = 0) {
  for (let i = 0; i < 40; i++) {
    const x = -6800 + i * 250 + 120 * hash(i + 90);
    if (hash(i + 91) < 0.5) ell(x, RIVER.bot + 22, 30 + 26 * hash(i + 92), 16 + 8 * hash(i + 93), P.gravelSh);
    else {
      const r = 50 + 40 * hash(i + 94), sw = wind * 10 * Math.sin(t * 2 + i);
      ell(x + r * 0.2, RIVER.bot + 30, r * 1.2, r * 0.5, greyOf(P.bushSh, ash * 0.4));
      ell(x - r * 0.4 + sw, RIVER.bot - 2, r * 0.8, r * 0.55, greyOf(P.bush, ash * 0.4)); ell(x + r * 0.4 + sw, RIVER.bot - 12, r * 0.9, r * 0.6, greyOf(P.bush, ash * 0.4));
    }
  }
}
function rock(x, y, r, a) {
  g.save(); g.translate(x, y); g.rotate(a);
  fill(smoothPath([[-r, -r * 0.2], [-r * 0.6, -r * 0.85], [r * 0.3, -r], [r, -r * 0.3], [r * 0.8, r * 0.6], [0, r], [-r * 0.8, r * 0.6]]), P.rock);
  fill(smoothPath([[-r * 0.6, -r * 0.3], [-r * 0.3, -r * 0.7], [r * 0.3, -r * 0.75], [r * 0.2, -r * 0.2]]), P.rockHi);
  g.restore();
}

// —— UAZ «буханка» (side view, facing left), door 0 shut … 1 open, win 0 down … 1 up ——
export function drawUAZ(t, o = {}) {
  const { x, y, len } = UAZ, h = 330, x0 = x - len / 2, yb = y - 70 + (o.bounce ?? 0), ash = o.ash ?? 0;
  const body = greyOf(P.uaz, ash * 0.35), sh = greyOf(P.uazSh, ash * 0.35);
  for (const wx of [x0 + 120, x0 + len - 120]) { ell(wx, y - 50, 62, 62, P.tire); ell(wx, y - 50, 28, 28, P.hub); }
  const pts = [[x0 + 8, yb - 40], [x0 + 20, yb - h + 80], [x0 + 70, yb - h], [x0 + len - 30, yb - h], [x0 + len, yb - h + 30], [x0 + len, yb - 20], [x0 + len - 20, yb], [x0 + 20, yb]];
  const bp = smoothPath(pts);
  fill(bp, body);
  inside(bp, () => {
    rect(x0, yb - 120, len + 20, 140, sh);
    rect(x0, yb - h - 10, len + 20, 20 + 50 * ash, mix(P.uazHi, '#c9c5cb', ash));     // ash settles on the roof
    for (const wx of [x0 + 120, x0 + len - 120]) ell(wx, y - 50 - (o.bounce ?? 0), 84, 84, P.tire);
  });
  const win = (px, py, w, hh, r = 14) => rrect(px, py, w, hh, r, P.glass);
  win(x0 + 40, yb - h + 50, 70, 120, 18);
  const dw = { x: x0 + 140, y: yb - h + 50, w: 120, h: 120 };
  win(dw.x, dw.y, dw.w, dw.h);
  for (let i = 0; i < 2; i++) win(x0 + 300 + i * 150, yb - h + 50, 120, 110);
  rrect(x0 + 300 + 2, yb - h + 54, 30, 100, 10, P.glassHi, 0.6);
  ell(x0 + 24, yb - 90, 20, 22, '#fff1c2'); rect(x0 - 6, yb - 30, 60, 22, '#2a2a33');
  if (o.inside) { g.save(); g.clip(polyPath([[dw.x, dw.y], [dw.x + dw.w, dw.y], [dw.x + dw.w, dw.y + dw.h + 400], [dw.x, dw.y + dw.h + 400]])); o.inside(dw); g.restore(); }
  const up = clamp(o.win ?? 1, 0, 1);
  rrect(dw.x + 4, dw.y + 4 + (1 - up) * (dw.h - 8), dw.w - 8, (dw.h - 8) * up, 10, '#9fb8d6', 0.4);
  if (up > 0.02) limb([[dw.x + 14, dw.y + 4 + (1 - up) * (dw.h - 8) + 16], [dw.x + 40, dw.y + 4 + (1 - up) * (dw.h - 8) + 8]], 6, '#e6f0ff', false);
  const door = clamp(o.door ?? 0, 0, 1);
  if (door > 0.01) {
    const w = 140 * Math.cos(door * 1.25);
    rrect(x0 + 130 - (140 - w) * 0.1, yb - h + 40, Math.max(16, w), h - 60, 12, shade(body, 0.1));
  } else {
    limb([[x0 + 130, yb - h + 40], [x0 + 130, yb - 10]], 5, sh, false); limb([[x0 + 270, yb - h + 40], [x0 + 270, yb - 10]], 5, sh, false);
    rect(x0 + 230, yb - 150, 26, 8, '#2a2a33');
  }
  return { door: [x0 + 200, yb - 40], dw, x0, yb };
}
export function drawHut(t, o = {}) {
  const { x, y } = HUT, w = 520, h = 330, ash = o.ash ?? 0;
  const wall = greyOf(P.hut, ash * 0.3);
  rect(x - w / 2, y - h, w, h, wall);
  for (let i = 0; i < 7; i++) rect(x - w / 2 - 10, y - h + i * 48 + 30, w + 20, 10, P.hutSh);
  for (const s of [-1, 1]) for (let i = 0; i < 7; i++) ell(x + s * (w / 2 + 6), y - h + i * 48 + 22, 16, 22, P.woodHi);
  poly([[x - w / 2 - 70, y - h + 6], [x, y - h - 190], [x + w / 2 + 70, y - h + 6]], P.roof);
  poly([[x - w / 2 - 70, y - h + 6], [x, y - h - 190], [x + w / 2 + 70, y - h + 6], [x + w / 2 + 40, y - h + 6]], mix(P.roof, '#9a979e', ash));
  const lit = o.light ?? 0;
  if (lit > 0) ell(x, y - h + 145, 130 + 30 * lit, 100 + 20 * lit, P.hutWin, 0, 0.35 * lit);
  rrect(x - 70, y - h + 90, 140, 110, 8, mix('#3a2a20', P.hutWin, 0.25 + 0.75 * lit)); limb([[x, y - h + 90], [x, y - h + 200]], 8, P.hutSh, false);
  rect(x + 120, y - h - 150, 50, 110, '#4a3a33');
}

// —— falling ash flakes in screen space, drifting with the wind and sliding past at the parallax of layer f ——
export function drawAsh(t, cam, dens, f = 1, o = {}) {
  if (dens <= 0.001) return;
  const n = Math.round(dens * (o.n ?? 140)), z = scaleOf(cam, f), seed = o.seed ?? 0, sz = o.size ?? 7;
  const TW = W + 300, TH = H + 300, cx = cam.x * f * z, cy = cam.y * f * z;
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  for (let i = 0; i < n; i++) {
    const h1 = hash(i * 1.31 + seed), h2 = hash(i * 2.73 + seed), h3 = hash(i * 0.91 + seed);
    const fall = (70 + 90 * h3) * (o.speed ?? 1), r = sz * (0.6 + 0.8 * h3) * Math.sqrt(f);
    let x = h1 * TW - cx + (o.wind ?? 50) * t + 16 * Math.sin(t * 1.9 + i);
    let y = h2 * TH - cy + fall * t;
    x = ((x % TW) + TW) % TW - 150; y = ((y % TH) + TH) % TH - 150;
    ell(x, y, r, r * 0.62, i % 4 ? (o.color ?? P.ashFlake) : P.ashFlakeSh, t * 2 + i, o.a ?? 0.9);
  }
  g.restore();
}
