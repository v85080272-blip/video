// Kamchatka at dawn in flat shapes: the sky, a snow-capped volcano that erupts (column, umbrella, lava, lightning),
// far ridges, forested hills, and the main slope: the hunting tower on a hilltop, the ridge path, the fork down to the
// river, the river valley where the mudflow runs, the forest road with the UAZ «буханка» and a log hut.
// World units are pixels at zoom 1. Layers: VOLC 0.04, FAR 0.15, MID 0.4, MAIN 1, FG 1.4 (camera.js).
import { g, W, H, poly, rect, rrect, ell, fill, limb, polyPath, rrPath, smoothPath, sample, inside, Path2D } from './flat.js';
import { hash, lerp, clamp, noise, mix, TAU, ease, shade, rgba } from './lib.js';

export const P = {
  sky: ['#232850', '#36396b', '#5d4d80', '#a4637a', '#e08e6a', '#f4b77c'], ash: '#3d3a44', ashDark: '#2a2830',
  volc: '#4b4f74', volcSh: '#3c3f61', snow: '#eef2f8', snowSh: '#c3cde0', lava: '#ff6a2a', lavaHot: '#ffd36a',
  plume: '#77727f', plumeSh: '#5c5866', plumeHi: '#958f9c', glow: '#d27a4e',
  far: '#3f4c70', far2: '#4a5a7e', mid: '#2e4b48', mid2: '#365853', midTree: '#24403d',
  grass: '#6f8f48', grassSh: '#5b7a3a', grassHi: '#86a557', bush: '#2f5a3f', bushSh: '#244a33', dirt: '#a68d63', dirtSh: '#8c7550',
  birch: '#ece5d6', birchMark: '#3a3540', leaf: '#e0b84a', leafSh: '#c29530', larch: '#d99a3a', fir: '#2c5640',
  river: '#3f6f96', riverHi: '#79a9cc', gravel: '#8f8a7c', bank: '#4f6e3c',
  wood: '#8c5b38', woodSh: '#6b4329', woodHi: '#a8703f', roof: '#5a3b2a',
  mud: '#7a6650', mudSh: '#5e4e3d', mudHi: '#a08a6e', rock: '#4c4852', log: '#7b5536',
  uaz: '#6b7f4a', uazSh: '#556839', uazHi: '#8a9c63', glass: '#1d2433', glassHi: '#3a4a66', tire: '#1e1d26', hub: '#8a8a96',
  hut: '#86562f', hutSh: '#6a4225', hutWin: '#ffd27a', bolt: '#f3e9ff', boltGlow: '#a98bff', text: '#fff3d6', red: '#ff4d4d',
};
export const F = { VOLC: 0.04, FAR: 0.15, MID: 0.4, MAIN: 1, FG: 1.4 };

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
export const RIVER = { top: 900, bot: 1010 };
export const TOWER = { x: 0, floor: -720, rail: -830, roof: -1010, peak: -1100, leg: 150, top: 108 };
export const LADDER = { a: [-330, 0], b: [-112, TOWER.floor] };
export const FORK = { x: -1800, sign: [-1745, 58], down: [[-1800, 58], [-1960, 300], [-2140, 520], [-2330, 760], [-2420, 900]] };
export const BOAT = { x: -2520, y: RIVER.top + 6 };
export const UAZ = { x: -3880, y: groundY(-3880), len: 640 };
export const HUT = { x: -4620, y: groundY(-4620) };

// —— sky: flat bands that go grey as the ash spreads (k 0 dawn … 1 ash) ——
export function drawSky(k = 0, flash = 0) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  const n = P.sky.length, hgt = [0, 300, 560, 820, 1020, 1160, 1920];
  for (let i = 0; i < n; i++) {
    const c = mix(mix(P.sky[i], i < 3 ? P.ashDark : P.ash, k), '#fff3d6', flash * (0.15 + 0.1 * i));
    rect(0, hgt[i], W, (i === n - 1 ? H : hgt[i + 1]) - hgt[i] + 1, c);
  }
}

// —— the volcano layer (layer units; the caller sets the transform) ——
export const VOLC = { x: 300, y: -800, base: -420, half: 620 };       // summit and base line in the VOLC layer
const VENT = [VOLC.x, VOLC.y + 8];
// eruption clock: te = the blast; returns the plume's state at t
export function plumeState(t, te) {
  const u = t - te;
  if (u < 0) return null;
  const rise = 1 - Math.exp(-u / 1.1);                 // the column shoots up, then slows
  const Hc = 1500 * rise + 90 * Math.max(0, u - 3);    // keeps growing slowly
  const bend = 360 * clamp((u - 1.5) / 9, 0, 1.6);     // the wind bends the top to the right
  const spread = clamp((u - 1.2) / 6, 0, 1.4);
  return { u, Hc, bend, spread };
}
function spine(st, v) {          // v 0 (vent) … 1 (top of the column)
  return [VENT[0] + st.bend * v * v * v + 30 * Math.sin(v * 3), VENT[1] - st.Hc * v];
}
export function drawVolcano(t, te, o = {}) {
  const { x, y, base, half } = VOLC;
  // cone with a snow cap and one shade side
  const cone = [[x - half - 260, base + 30], [x - half, base], [x - 160, y + 70], [x - 46, y + 4], [x + 46, y + 2], [x + 170, y + 80], [x + half + 40, base], [x + half + 300, base + 30]];
  fill(smoothPath(cone.concat([[x + half + 300, base + 400], [x - half - 260, base + 400]])), P.volc);
  inside(smoothPath(cone.concat([[x + half + 300, base + 400], [x - half - 260, base + 400]])), () => {
    poly([[x + 10, y], [x + half + 120, base + 20], [x + half + 400, base + 400], [x + 40, base + 400]], P.volcSh);
    const snow = [[x - 190, y + 120], [x - 120, y + 150], [x - 70, y + 120], [x - 20, y + 170], [x + 40, y + 130], [x + 110, y + 175], [x + 200, y + 125], [x + 120, y - 10], [x - 120, y - 10]];
    fill(smoothPath(snow), P.snow);
    inside(smoothPath(snow), () => poly([[x + 12, y - 20], [x + 260, y + 200], [x + 30, y + 220]], P.snowSh));
    // lava: streams creep down the flanks after the blast (far away: "лава сюда не дойдёт")
    if (t > te) {
      const u = clamp((t - te) / 9, 0, 1);
      for (const [dx, k, w] of [[-30, -1, 9], [24, 1, 11], [6, 0.35, 7]]) {
        const len = 60 + 300 * ease.out(u) * (0.7 + 0.3 * Math.abs(k));
        const pts = [];
        for (let i = 0; i <= 10; i++) { const v = i / 10; pts.push([x + dx + k * 140 * v * (len / 300) + 10 * Math.sin(v * 7 + dx), y + 6 + len * v]); }
        limb(pts, (w + 6) * (1 - 0.2 * u), P.lava);
        limb(pts.slice(0, 5), w * 0.6, P.lavaHot);
      }
    }
  });
  if (t <= te) return;
  const st = plumeState(t, te);
  // the blast: a flash and a ring
  const fl = clamp(1 - (t - te) / 0.5, 0, 1);
  if (fl > 0) { ell(VENT[0], VENT[1], 90 + 200 * (1 - fl), 70 + 160 * (1 - fl), P.lavaHot, 0, fl); }
  const ring = (t - te) / 1.4;
  if (ring > 0 && ring < 1) {
    g.save(); g.globalAlpha *= 0.55 * (1 - ring); g.lineWidth = 18 * (1 - ring) + 4; g.strokeStyle = P.text;
    g.beginPath(); g.ellipse(VENT[0], VENT[1], 120 + 1300 * ring, 40 + 420 * ring, 0, 0, TAU); g.stroke(); g.restore();
  }
  // lava fountain at the vent
  for (let i = 0; i < 26; i++) {
    const ph = (t * 1.3 + hash(i) * 7) % 1, a = -Math.PI / 2 + (hash(i + 9) - 0.5) * 1.3, v = 140 + 160 * hash(i + 3);
    const px = VENT[0] + Math.cos(a) * v * ph, py = VENT[1] + Math.sin(a) * v * ph + 260 * ph * ph;
    ell(px, py, 7 * (1 - ph) + 2, 7 * (1 - ph) + 2, ph < 0.4 ? P.lavaHot : P.lava, 0, 1 - ph * 0.7);
  }
  drawPlume(t, st, o);
}
// the eruption column and its umbrella: puffs along a spine that the wind bends to the right
function drawPlume(t, st, o = {}) {
  const N = 34, dark = o.dark ?? 0;
  const base = mix(P.plume, P.ashDark, dark * 0.5), sh = mix(P.plumeSh, P.ashDark, dark * 0.5), hi = mix(P.plumeHi, P.plume, dark);
  const puffs = [];
  for (let i = 0; i < N; i++) {
    const v = i / (N - 1), show = clamp(st.Hc / 1500 * 1.25 - v * 0.95, 0, 1);
    if (show <= 0) continue;
    const [px, py] = spine(st, v);
    const r = (60 + 150 * v + 260 * v * v * st.spread) * (0.55 + 0.45 * show);
    const wob = noise(i * 1.7 + t * 0.6, 2) * 24, wob2 = noise(i * 2.3 + t * 0.5, 5) * 20;
    puffs.push([px + wob + (i % 2 ? 1 : -1) * r * 0.42, py + wob2, r, v]);
    if (v > 0.55) {          // the umbrella spreads both ways, more downwind
      const sp = st.spread * (v - 0.55) / 0.45;
      puffs.push([px + r * (0.9 + 1.6 * sp) + wob, py + 40 + wob2, r * 0.85, v]);
      puffs.push([px - r * (0.6 + 0.8 * sp) - wob, py + 30 - wob2, r * 0.75, v]);
      if (sp > 0.3) puffs.push([px + r * (2.2 + 2.4 * sp), py + 110 + wob, r * 0.8, v]);
    }
  }
  for (const [px, py, r, v] of puffs) ell(px + r * 0.18, py + r * 0.16, r, r * 0.92, sh);
  for (const [px, py, r, v] of puffs) ell(px, py, r * 0.94, r * 0.86, base);
  for (const [px, py, r, v] of puffs) ell(px - r * 0.28, py - r * 0.3, r * 0.42, r * 0.36, hi, 0, 0.7);
  // glow on the underside near the vent
  const gl = clamp(1 - st.u / 14, 0.35, 1);
  for (let i = 0; i < 6; i++) { const [px, py] = spine(st, i / 30); ell(px, py + 20, 70 + 14 * i, 46 + 8 * i, P.glow, 0, 0.55 * gl); }
  // the ash curtain under the downwind arm
  if (st.spread > 0.2) {
    const k = clamp((st.spread - 0.2) / 0.8, 0, 1), top = spine(st, 0.8);
    g.save(); g.globalAlpha *= 0.42 * k;
    for (let i = 0; i < 14; i++) {
      const x0 = top[0] + 120 + i * 70 + 40 * Math.sin(i * 1.3 + t), w = 60 + 30 * hash(i);
      poly([[x0, top[1] + 80], [x0 + w, top[1] + 80], [x0 + w + 260, VOLC.base + 380], [x0 + 200, VOLC.base + 380]], mix(P.plumeSh, P.ashDark, 0.3));
    }
    g.restore();
  }
  // volcanic lightning in the column
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
export function strokeBolt(pts, w, a = 1) {
  g.save(); g.globalAlpha *= a;
  limb(pts, w * 3.2, rgba(P.boltGlow, 0.35), false);
  limb(pts, w * 1.6, P.boltGlow, false);
  limb(pts, w * 0.7, P.bolt, false);
  g.restore();
}
function drawBolt(b, st, t) {
  const v0 = b.v ?? 0.6, top = spine(st, v0), bot = spine(st, Math.max(0, v0 - 0.35));
  const a = [top[0] + (b.dx ?? 0), top[1]], e = [bot[0] + (b.ex ?? 120), bot[1] + 80];
  const flick = (Math.floor((t - b.t) * 30) % 2) ? 0.55 : 1;
  strokeBolt(boltPath(b.seed, a, e, 8, 60), 7, flick);
}

// —— far ridges and forested hills ——
export function drawFar(ash = 0) {
  const c1 = mix(P.far, P.ash, ash * 0.6), c2 = mix(P.far2, P.ash, ash * 0.6);
  fill(smoothPath([[-2200, -330], [-1500, -420], [-900, -360], [-300, -440], [400, -350], [1100, -430], [1900, -340], [2800, -420], [3400, -330], [3400, 400], [-2200, 400]]), c2);
  fill(smoothPath([[-2200, -260], [-1300, -320], [-500, -270], [200, -330], [900, -270], [1700, -320], [2500, -260], [3400, -300], [3400, 400], [-2200, 400]]), c1);
}
export function drawMid(t, ash = 0) {
  const c1 = mix(P.mid, P.ash, ash * 0.5), c2 = mix(P.mid2, P.ash, ash * 0.5), tr = mix(P.midTree, P.ash, ash * 0.5);
  fill(smoothPath([[-5200, -150], [-4200, -260], [-3300, -170], [-2500, -280], [-1500, -180], [-700, -260], [200, -170], [1000, -240], [2000, -160], [3200, -230], [3200, 600], [-5200, 600]]), c2);
  // a far reach of the river, winding toward the volcano
  limb([[-1400, 420], [-900, 300], [-300, 240], [200, 150], [600, 60], [900, -40]], 26, mix(P.riverHi, P.ash, ash * 0.5));
  fill(smoothPath([[-5200, -40], [-4000, -110], [-3000, -30], [-2000, -120], [-1000, -40], [0, -110], [900, -30], [2000, -100], [3200, -40], [3200, 600], [-5200, 600]]), c1);
  for (let i = 0; i < 70; i++) {             // fir and larch silhouettes on the hill crest
    const x = -5200 + i * 120 + hash(i) * 60, y = -60 + 50 * Math.sin(x * 0.0021) + 20 * hash(i + 4), h = 90 + 60 * hash(i + 2);
    poly([[x, y - h], [x + 22, y - h * 0.4], [x + 14, y - h * 0.42], [x + 30, y], [x - 30, y], [x - 14, y - h * 0.42], [x - 22, y - h * 0.4]], tr);
  }
}

// —— the main slope ——
function birch(x, y, h, k = 1, lean = 0, t = 0, wind = 0) {
  const top = [x + lean * h, y - h];
  limb([[x, y], [x + lean * h * 0.5, y - h * 0.5], top], 22 * k, P.birch);
  for (let i = 1; i < 6; i++) { const v = i / 6; const px = x + lean * h * v; limb([[px - 8 * k, y - h * v], [px + 4 * k, y - h * v - 3]], 6 * k, P.birchMark, false); }
  const sway = wind * 18 * Math.sin(t * 2 + x);
  for (const [dx, dy, r] of [[0, 0, 70], [-50, 30, 56], [52, 26, 58], [-18, -50, 52], [30, -40, 46]]) {
    ell(top[0] + dx * k + sway + 10 * k, top[1] + dy * k + 12 * k, r * k, r * 0.86 * k, P.leafSh);
    ell(top[0] + dx * k + sway, top[1] + dy * k, r * k, r * 0.86 * k, P.leaf);
  }
}
function bush(x, y, r, c = P.bush) {
  ell(x + r * 0.2, y + r * 0.1, r * 1.2, r * 0.6, P.bushSh);
  ell(x - r * 0.4, y - r * 0.1, r * 0.8, r * 0.55, c); ell(x + r * 0.4, y - r * 0.2, r * 0.9, r * 0.6, c); ell(x, y - r * 0.45, r * 0.7, r * 0.5, c);
}
export function drawTower(t, o = {}) {
  const { x, floor, rail, roof, peak, leg, top } = TOWER;
  const scorch = o.scorch ?? 0;
  // legs and braces
  for (const s of [-1, 1]) limb([[x + s * leg, 0], [x + s * top, floor]], 30, P.woodSh, false);
  for (const [a, b] of [[0, -360], [-360, floor]]) {
    const wa = leg - (leg - top) * (-a / -floor), wb = leg - (leg - top) * (-b / -floor);
    limb([[x - wa, a], [x + wb, b]], 16, P.woodSh, false); limb([[x + wa, a], [x - wb, b]], 16, P.woodSh, false);
  }
  // platform, railing, posts, roof
  rect(x - 150, floor, 300, 34, P.wood); rect(x - 150, floor + 26, 300, 8, P.woodSh);
  for (const s of [-1, 1]) limb([[x + s * 136, floor], [x + s * 136, roof]], 16, P.woodSh, false);
  rect(x - 150, rail, 300, 18, P.wood); rect(x - 150, rail + 50, 300, 12, P.woodSh);
  const rp = [[x - 190, roof + 6], [x, peak], [x + 190, roof + 6], [x + 190, roof + 30], [x, peak + 30], [x - 190, roof + 30]];
  fill(polyPath(rp), mix(P.roof, '#1a1820', scorch));
  poly([[x, peak], [x + 190, roof + 6], [x + 190, roof + 30], [x, peak + 30]], mix(shade(P.roof, -0.2), '#1a1820', scorch));
  if (o.smoke) for (let i = 0; i < 5; i++) { const ph = (o.smoke + i * 0.2) % 1; ell(x + 10 + 40 * ph, peak - 30 - 160 * ph, 20 + 40 * ph, 18 + 30 * ph, '#5c5866', 0, 0.6 * (1 - ph)); }
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
  const gr = mix(P.grass, '#8d8a8a', ash * 0.55), grs = mix(P.grassSh, '#6e6b70', ash * 0.55), grh = mix(P.grassHi, '#a5a2a6', ash * 0.6);
  // near bank below the river and the river itself
  rect(-7000, RIVER.bot - 4, 11000, 2600, mix(P.bank, '#6e6b70', ash * 0.5));
  rect(-7000, RIVER.top, 11000, RIVER.bot - RIVER.top, P.river);
  for (let i = 0; i < 90; i++) {
    const L = 120 + 80 * hash(i), x = ((-i * 157 - t * 140) % 11000 + 11000) % 11000 - 7000, y = RIVER.top + 18 + (i % 4) * 22;
    limb([[x, y], [x + L, y]], 6, P.riverHi, false);
  }
  rect(-7000, RIVER.top - 10, 11000, 14, P.gravel);
  // the slope from the path down to the river
  const top = PATH_S.filter(p => p[0] > -7000), poly0 = [...top, [top[top.length - 1][0], RIVER.top], [top[0][0], RIVER.top]];
  const sl = polyPath(poly0);
  fill(sl, gr);
  inside(sl, () => {
    for (let i = 0; i < 40; i++) {               // mowed stripes and patches in one shade tone
      const x = -6400 + i * 230 + hash(i) * 80, y = groundY(x) + 120 + hash(i + 5) * 600;
      ell(x, y, 160 + 90 * hash(i + 1), 40 + 30 * hash(i + 2), grs, -0.25);
    }
    for (let i = 0; i < 70; i++) { const x = -6400 + i * 130, y = groundY(x); ell(x, y + 6, 80, 16, grh); }      // lit lip of the path
  });
  // the path: a worn strip along the crest
  const strip = PATH_S.map(([x, y]) => [x, y + 4]);
  limb(strip, 26, mix(P.dirt, '#9a958f', ash * 0.5), true);
  // the side path down to the river
  limb(FORK.down, 34, mix(P.dirtSh, '#8a8580', ash * 0.5));
  limb(FORK.down, 18, mix(P.dirt, '#9a958f', ash * 0.5));
}
export function drawBoat(t, hit = -1) {
  if (hit >= 0 && t > hit) {                    // tossed away by the flow
    const u = t - hit, x = BOAT.x - 900 * u, y = BOAT.y - 260 * u + 600 * u * u;
    if (u < 1.2) { g.save(); g.translate(x, y); g.rotate(-u * 4); poly([[-90, -10], [90, -10], [60, 26], [-60, 26]], '#5a7a9a'); g.restore(); }
    return;
  }
  const bob = 4 * Math.sin(t * 3);
  poly([[BOAT.x - 90, BOAT.y - 10 + bob], [BOAT.x + 90, BOAT.y - 10 + bob], [BOAT.x + 60, BOAT.y + 24 + bob], [BOAT.x - 60, BOAT.y + 24 + bob]], '#5a7a9a');
  rect(BOAT.x - 80, BOAT.y - 14 + bob, 160, 8, '#7d9dbc');
  limb([[BOAT.x + 90, BOAT.y - 6 + bob], [BOAT.x + 170, BOAT.y - 30]], 4, '#3a3540', false);
  limb([[BOAT.x + 170, BOAT.y - 60], [BOAT.x + 170, BOAT.y + 10]], 12, P.woodSh, false);
}
export function drawSign(o = {}) {
  const [x, y] = FORK.sign, a = o.a ?? 1;
  limb([[x, y + 4], [x, y - 210]], 16, P.woodSh, false);
  g.save(); g.globalAlpha *= a; g.translate(x - 10, y - 190); g.rotate(0.12);
  poly([[-170, -34], [40, -34], [40, 34], [-170, 34], [-206, 0]], P.woodHi);
  g.restore();
  return [x - 70, y - 186];
}
export function drawTrees(t, ash = 0, wind = 0) {
  const tr = [[-560, 560, 0.9], [-980, 300, 1.0], [-1450, -40, 1.1, true], [-2050, 420, 0.9], [-2700, 640, 0.85], [-2950, -100, 1.15, true],
    [-3350, -190, 1.0, true], [-4200, -240, 1.2, true], [-5000, -230, 1.1, true], [600, 400, 0.9], [980, 620, 0.9], [-1250, 700, 0.8], [-3150, 520, 0.85]];
  for (const [x, dy, k, above] of tr) {
    const y = above ? groundY(x) - 10 : groundY(x) + dy;
    if (!above && y > RIVER.top - 30) continue;
    birch(x, y, 380 * k, k, (hash(x) - 0.5) * 0.12, t, wind);
  }
  for (let i = 0; i < 26; i++) { const x = -6000 + i * 330 + hash(i + 40) * 120; bush(x, groundY(x) + 140 + 260 * hash(i + 41), 60 + 30 * hash(i + 42)); }
}

// —— UAZ «буханка» (side view, facing left), door 0 shut … 1 open, win 0 down … 1 up ——
export function drawUAZ(t, o = {}) {
  const { x, y, len } = UAZ, h = 330, x0 = x - len / 2, yb = y - 70, ash = o.ash ?? 0;
  const body = mix(P.uaz, '#8d8a8a', ash * 0.35), sh = mix(P.uazSh, '#6e6b70', ash * 0.35);
  // wheels
  for (const wx of [x0 + 120, x0 + len - 120]) { ell(wx, y - 50, 62, 62, P.tire); ell(wx, y - 50, 28, 28, P.hub); }
  // the loaf body: rounded box with a sloped nose
  const pts = [[x0 + 8, yb - 40], [x0 + 20, yb - h + 80], [x0 + 70, yb - h], [x0 + len - 30, yb - h], [x0 + len, yb - h + 30], [x0 + len, yb - 20], [x0 + len - 20, yb], [x0 + 20, yb]];
  const bp = smoothPath(pts);
  fill(bp, body);
  inside(bp, () => {
    rect(x0, yb - 120, len + 20, 140, sh);                                 // lower shade band
    rect(x0, yb - h - 10, len + 20, 60, mix(P.uazHi, '#bdbab6', ash * 0.6));  // ash on the roof grows with ash
    for (const wx of [x0 + 120, x0 + len - 120]) ell(wx, y - 50, 84, 84, P.tire);      // wheel arches
  });
  // windows: windscreen (front, left), driver door window, side windows
  const win = (px, py, w, hh, r = 14) => rrect(px, py, w, hh, r, P.glass);
  win(x0 + 40, yb - h + 50, 70, 120, 18);
  const dw = { x: x0 + 140, y: yb - h + 50, w: 120, h: 120 };
  win(dw.x, dw.y, dw.w, dw.h);
  for (let i = 0; i < 2; i++) win(x0 + 300 + i * 150, yb - h + 50, 120, 110);
  rrect(x0 + 300 + 2, yb - h + 54, 30, 100, 10, P.glassHi, 0.6);
  // headlights, bumper, handle
  ell(x0 + 24, yb - 90, 20, 22, '#fff1c2'); rect(x0 - 6, yb - 30, 60, 22, '#2a2a33');
  // the driver inside (drawn by the caller), then the door window glass rising, then the door itself
  if (o.inside) o.inside(dw);
  const up = clamp(o.win ?? 1, 0, 1);
  rrect(dw.x + 4, dw.y + 4 + (1 - up) * (dw.h - 8), dw.w - 8, (dw.h - 8) * up, 10, '#9fb8d6', 0.45);
  const door = clamp(o.door ?? 0, 0, 1);
  if (door > 0.01) {                        // the door swings out toward us: drawn narrower as it turns
    const w = 140 * Math.cos(door * 1.25);
    rrect(x0 + 130, yb - h + 40, Math.max(14, w), h - 60, 12, shade(body, 0.08));
  } else {
    limb([[x0 + 130, yb - h + 40], [x0 + 130, yb - 10]], 5, sh, false); limb([[x0 + 270, yb - h + 40], [x0 + 270, yb - 10]], 5, sh, false);
    rect(x0 + 230, yb - 150, 26, 8, '#2a2a33');
  }
  return { door: [x0 + 200, yb - 40], seat: [dw.x + dw.w / 2, dw.y + 70] };
}
export function drawHut(t, o = {}) {
  const { x, y } = HUT, w = 520, h = 330, ash = o.ash ?? 0;
  const wall = mix(P.hut, '#8d8a8a', ash * 0.3);
  rect(x - w / 2, y - h, w, h, wall);
  for (let i = 0; i < 7; i++) rect(x - w / 2 - 10, y - h + i * 48 + 30, w + 20, 10, P.hutSh);
  for (const s of [-1, 1]) for (let i = 0; i < 7; i++) ell(x + s * (w / 2 + 6), y - h + i * 48 + 22, 16, 22, P.woodHi);
  poly([[x - w / 2 - 70, y - h + 6], [x, y - h - 190], [x + w / 2 + 70, y - h + 6]], P.roof);
  poly([[x - w / 2 - 70, y - h + 6], [x, y - h - 190], [x + w / 2 + 70, y - h + 6], [x + w / 2 + 40, y - h + 6]], mix(P.roof, '#9a979e', ash));
  rrect(x - 70, y - h + 90, 140, 110, 8, P.hutWin); limb([[x, y - h + 90], [x, y - h + 200]], 8, P.hutSh, false);
  rect(x + 120, y - h - 150, 50, 110, '#4a3a33');
}
// grass tufts and branches in front of everything (FG layer)
export function drawFG(t, cam, ash = 0) {
  const c = mix('#3f6a35', '#6e6b70', ash * 0.5);
  for (let i = 0; i < 40; i++) {
    const x = -7000 + i * 260 + hash(i + 70) * 140, y = groundY(x) + 30 + 40 * hash(i + 71), hh = 60 + 50 * hash(i + 72);
    for (let k = -2; k <= 2; k++) limb([[x + k * 14, y], [x + k * 22 + 10 * Math.sin(t * 2 + i), y - hh * (1 - Math.abs(k) * 0.15)]], 12, c, false);
  }
}
