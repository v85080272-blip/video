// A quiet lake at dawn in flat shapes: misty sky, the far shore with a forest and an old plant behind a fence, the lake
// itself (three water bands at three depths, ripples, a glint), the rusty radiation sign on a post in the water, the
// rowboat, and the near shore: reeds, a path up to a village yard with a log house, a fence with a gate, birches and a
// summer shower booth with a black water barrel on its roof.
// World units are pixels at zoom 1, the water line is y = 0. Layers: FAR 0.15, MID 0.4, MAIN 1, FG 1.4 (camera.js).
import { g, W, H, poly, rect, rrect, ell, fill, limb, polyPath, smoothPath, sample, inside, rrPath } from './flat.js';
import { hash, lerp, clamp, noise, mix, TAU, ease, shade, rgba } from './lib.js';
import { text, FONTS } from './type.js';

export const P = {
  sky: ['#26425c', '#36607a', '#5f879a', '#97b5b6', '#d0d8b8', '#f2e4b6'],
  far: '#4a6670', far2: '#5a7680', farTree: '#3a5560', plant: '#56646f', plantSh: '#465360', plantHi: '#6a7884', lamp: '#f6d98c',
  mid: '#3b605b', mid2: '#46706a', midTree: '#2d4c48',
  lakeFar: '#8eabb6', lakeMid: '#6f93a4', lake: '#517a93', lakeDeep: '#3d6179', lakeHi: '#b2d0dc', glint: '#f8ecc4',
  kino: '#6dff57', kinoHi: '#d8ff9c', kinoDeep: '#25c946',
  grass: '#6f9150', grassSh: '#5a7a40', grassHi: '#88a862', dirt: '#a68d63', dirtSh: '#8c7550', mud: '#6b5a44',
  reed: '#7c8a46', reedSh: '#5f6b33', cattail: '#6b4429',
  birch: '#ece5d6', birchMark: '#3a3540', leaf: '#8fb85a', leafSh: '#6f9a43',
  boat: '#3c8d93', boatSh: '#2c6b70', boatRim: '#ece3cf', boatIn: '#94653f', boatInSh: '#76502f',
  wood: '#8c5b38', woodSh: '#6b4329', woodHi: '#a8703f', roof: '#5a3b2a', hut: '#86562f', hutSh: '#6a4225', hutWin: '#ffd27a',
  fence: '#9a7a52', fenceSh: '#7a5d3c', barrel: '#2a2a33', barrelHi: '#4a4a58',
  sign: '#ffd23f', signSh: '#d9a92a', rust: '#9a5a2a', post: '#5a4a40', ink: '#17162f', text: '#fff3d6', red: '#ff4d4d',
};
export const F = { FAR: 0.15, MID: 0.4, MAIN: 1, FG: 1.4 };

// —— the near shore: ground line on the left, sloping into the water at SHORE ——
const GROUND = [[-6400, -250], [-4600, -246], [-3600, -240], [-3000, -236], [-2500, -222], [-2100, -170], [-1850, -96], [-1700, -40], [-1560, 8], [-1400, 60]];
const GROUND_S = sample(GROUND, 24, false);
export function groundY(x) {
  if (x <= GROUND_S[0][0]) return GROUND_S[0][1];
  for (let i = 1; i < GROUND_S.length; i++) {
    const a = GROUND_S[i - 1], b = GROUND_S[i];
    if (x <= b[0]) return lerp(a[1], b[1], (x - a[0]) / (b[0] - a[0]));
  }
  return GROUND_S[GROUND_S.length - 1][1];
}
export const SHORE = -1600;                       // where the ground meets the water
export const BOAT0 = { x: 260 };                  // the boat in the middle of the lake
export const SIGN = { x: 900, y: 0 };
export const HOUSE = { x: -3150, y: groundY(-3150) };
export const GATE = { x: -2700, y: groundY(-2700) };
export const SHOWER = { x: -4150, y: groundY(-4150), w: 250, h: 470 };

// —— sky: flat bands; green (0…1) turns it to the «film» look; lens and tilt follow the camera ——
export function drawSky(green = 0, cam = null) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  const lens = cam?.lens ?? 1, ty = cam?.ty ?? 0, hz = 1100;
  const ys = [0, 300, 560, 800, 980, 1100].map(y => hz + (y - hz) * lens + ty);
  const n = P.sky.length;
  for (let i = 0; i < n; i++) {
    const c = mix(P.sky[i], ['#0e2a12', '#14361a', '#1d4a22', '#2b6a2a', '#4f9a3a', '#8ed64e'][i], green * 0.85);
    const y0 = i === 0 ? 0 : Math.max(0, ys[i]), y1 = i === n - 1 ? H : Math.min(H, ys[i + 1]);
    if (y1 > y0) rect(0, y0, W, y1 - y0 + 1, c);
  }
}
// a low sun behind the mist (FAR layer)
export function drawSun(green = 0) {
  ell(-700, -620, 150, 150, rgba(mix('#fff1c6', '#d8ff9c', green), 0.35));
  ell(-700, -620, 96, 96, mix('#fff3d0', '#e8ffb0', green));
}

// —— far shore (FAR layer): forest, the plant behind its fence, the far water ——
export function drawFar(t, o = {}) {
  const gr = o.green ?? 0, wc = (c, k = 1) => mix(c, P.kino, gr * k);
  fill(smoothPath([[-3200, -470], [-2400, -540], [-1600, -490], [-900, -560], [-300, -500], [300, -560], [1000, -500], [1800, -560], [2600, -490], [3400, -540], [3400, 400], [-3200, 400]]), P.far2);
  // the plant on the far right shore: blocks, a striped stack, a long hall, a fence and lamps
  const px = 420;
  rect(px - 260, -620, 300, 220, P.plant);
  rect(px - 240, -600, 260, 30, P.plantSh);
  for (let i = 0; i < 5; i++) rect(px - 230 + i * 52, -540, 26, 40, P.plantSh);
  rect(px + 60, -700, 200, 300, P.plantHi);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) rect(px + 80 + i * 44, -670 + j * 70, 22, 34, ((i + j * 3) % 5 === 2) ? P.lamp : P.plantSh);
  const sx = px + 330;
  poly([[sx - 34, -460], [sx - 22, -1080], [sx + 22, -1080], [sx + 34, -460]], P.plantHi);
  for (let i = 0; i < 4; i++) poly([[sx - 33 + i * 0.4, -1080 + i * 150 + 70], [sx - 31, -1080 + i * 150 + 120], [sx + 31, -1080 + i * 150 + 120], [sx + 33 - i * 0.4, -1080 + i * 150 + 70]], '#c9584a');
  for (let i = 0; i < 6; i++) { const u = ((t * 0.08 + i / 6) % 1); ell(sx + 60 * u + 40 * u * u, -1100 - 220 * u, 30 + 50 * u, 24 + 40 * u, '#c9cfd2', 0, 0.5 * (1 - u)); }
  rect(px - 420, -470, 1100, 60, P.plantSh);
  for (let i = 0; i < 46; i++) limb([[px - 420 + i * 24, -410], [px - 420 + i * 24, -470]], 5, '#3a4650', false);
  limb([[px - 420, -462], [px + 680, -462]], 4, '#3a4650', false);
  // forest silhouettes along the far shore
  for (let i = 0; i < 64; i++) {
    const x = -3200 + i * 100 + hash(i) * 50;
    if (x > px - 460 && x < px + 700) continue;
    const y = -420 + 14 * Math.sin(x * 0.004), h = 120 + 90 * hash(i + 2);
    poly([[x, y - h], [x + 24, y - h * 0.45], [x + 14, y - h * 0.47], [x + 34, y], [x - 34, y], [x - 14, y - h * 0.47], [x - 24, y - h * 0.45]], P.farTree);
  }
  // the far water, up to the shore line
  rect(-3200, -420, 6600, 900, wc(P.lakeFar, 0.9));
  for (let i = 0; i < 40; i++) { const x = -3200 + i * 170 + 60 * hash(i + 7), y = -400 + 300 * hash(i + 8); limb([[x, y], [x + 60 + 40 * hash(i + 9), y]], 4, rgba(wc(P.lakeHi), 0.6), false); }
  // the shore's reflection, a darker band under it
  rect(-3200, -420, 6600, 26, wc(shade(P.lakeFar, -0.12), 0.9));
}
// mist bands drifting slowly over the water (any layer; the caller sets the transform)
export function drawMist(t, y, a = 0.32, seed = 0, w = 7000) {
  for (let i = 0; i < 9; i++) {
    const x = -w / 2 + ((i * 900 + t * (12 + 6 * hash(i + seed)) + 400 * hash(i + seed + 3)) % w), r = 380 + 220 * hash(i + seed + 1);
    ell(x, y + 40 * hash(i + seed + 2), r, 46 + 20 * hash(i + seed + 4), '#eef0e4', 0, a);
  }
}

// —— mid layer: the left shore's hills, a jetty of birches, the middle of the lake ——
export function drawMid(t, o = {}) {
  const gr = o.green ?? 0;
  fill(smoothPath([[-4800, -380], [-3800, -480], [-2900, -400], [-2200, -440], [-1500, -330], [-1100, -220], [-900, -160], [-800, 300], [-4800, 300]]), P.mid2);
  for (let i = 0; i < 44; i++) {
    const x = -4800 + i * 90 + hash(i + 50) * 40;
    if (x > -980) continue;
    const y = -360 + 60 * Math.sin(x * 0.0018) + (x > -1600 ? (x + 1600) * 0.3 : 0), h = 100 + 70 * hash(i + 52);
    poly([[x, y - h], [x + 22, y - h * 0.42], [x + 13, y - h * 0.44], [x + 30, y], [x - 30, y], [x - 13, y - h * 0.44], [x - 22, y - h * 0.42]], P.midTree);
  }
  rect(-900, -200, 6000, 900, mix(P.lakeMid, P.kino, gr * 0.85));
  rect(-4800, -170, 3900, 900, mix(P.lakeMid, P.kino, gr * 0.85));
  for (let i = 0; i < 50; i++) {
    const x = -4800 + i * 200 + 90 * hash(i + 60) + 20 * Math.sin(t * 0.7 + i), y = -150 + 520 * hash(i + 61);
    limb([[x, y], [x + 70 + 50 * hash(i + 62), y]], 5, rgba(mix(P.lakeHi, P.kinoHi, gr), 0.55), false);
  }
}

// —— the lake in front (MAIN): from the water line down, darker with depth; ripples drift, a glint shimmers.
// green 0…1: the «film» look, neon water that glows and bubbles ——
export function drawWater(t, o = {}) {
  const gr = o.green ?? 0, x0 = SHORE - 1200, x1 = 6000;
  const c = k => mix(k, P.kino, gr * 0.9);
  rect(x0, 0, x1 - x0, 3000, c(P.lake));
  rect(x0, 260, x1 - x0, 2800, c(P.lakeDeep));
  rect(x0, 0, x1 - x0, 14, c(shade(P.lake, 0.12)));
  for (let i = 0; i < 90; i++) {
    const x = x0 + ((i * 97.3 + 150 * hash(i + 3) + t * (10 + 14 * hash(i))) % (x1 - x0)), y = 30 + 520 * hash(i + 4) * hash(i + 4);
    const len = 50 + 90 * hash(i + 5) * (1 + y / 400);
    limb([[x, y], [x + len, y]], 5 + y / 70, rgba(mix(P.lakeHi, P.kinoHi, gr), 0.42), false);
  }
  // the glint of the low sun on the water
  for (let i = 0; i < 9; i++) { const y = 40 + i * 26 + 6 * Math.sin(t * 2 + i), w = 120 - i * 9 + 30 * Math.sin(t * 1.3 + i * 2); limb([[-900 - w / 2 + 30 * noise(t * 0.5, i), y], [-900 + w / 2 + 30 * noise(t * 0.5, i), y]], 7, rgba(P.glint, 0.5 - i * 0.04), false); }
  if (gr > 0.01) {       // the film cliché: glow over the surface and rising bubbles
    for (let i = 0; i < 30; i++) {
      const x = x0 + 300 + (i * 211 + 400 * hash(i + 20)) % 5800, u = (t * (0.6 + 0.5 * hash(i + 21)) + hash(i + 22)) % 1;
      ell(x, 600 - 620 * u, 10 + 16 * hash(i + 23), 10 + 16 * hash(i + 23), P.kinoHi, 0, gr * (1 - u) * 0.9);
    }
    rect(x0, -160, x1 - x0, 160, rgba(P.kino, 0.18 * gr));
    rect(x0, -70, x1 - x0, 70, rgba(P.kinoHi, 0.22 * gr));
  }
}
// rings spreading on the water from x, born at t0 (a splash, the float, the oars)
export function ripples(t, t0, x, y = 6, n = 3, size = 1) {
  for (let i = 0; i < n; i++) {
    const u = (t - t0 - i * 0.25) / 1.4;
    if (u <= 0 || u >= 1) continue;
    g.lineWidth = 6 * (1 - u) + 1; g.strokeStyle = rgba(P.lakeHi, 0.8 * (1 - u));
    g.beginPath(); g.ellipse(x, y, (30 + 170 * u) * size, (8 + 34 * u) * size, 0, 0, TAU); g.stroke();
  }
}
export function splash(t, t0, x, y = 0, k = 1, color = P.lakeHi) {
  const u = (t - t0) / 0.7;
  if (u <= 0 || u >= 1) return;
  for (let i = 0; i < 12; i++) {
    const a = -Math.PI * (0.15 + 0.7 * hash(i + 70)), v = (180 + 260 * hash(i + 71)) * k;
    const px = x + Math.cos(a) * v * u, py = y + Math.sin(a) * v * u + 900 * u * u * k;
    if (py > y + 10) continue;
    ell(px, py, (9 + 7 * hash(i + 72)) * k * (1 - u * 0.5), (12 + 8 * hash(i + 72)) * k * (1 - u * 0.5), color);
  }
}

// —— the radiation sign on a rusty post in the water: yellow, a black trefoil, «ОПАСНО» ——
export function trefoil(x, y, r, color = P.ink, rot = 0) {
  g.save(); g.translate(x, y); g.rotate(rot);
  for (let i = 0; i < 3; i++) {
    const a0 = -Math.PI / 2 + i * TAU / 3 - Math.PI / 6, a1 = a0 + Math.PI / 3;
    g.beginPath(); g.moveTo(Math.cos(a0) * r * 0.3, Math.sin(a0) * r * 0.3); g.arc(0, 0, r, a0, a1); g.arc(0, 0, r * 0.3, a1, a0, true); g.closePath();
    g.fillStyle = color; g.fill();
  }
  ell(0, 0, r * 0.2, r * 0.2, color);
  g.restore();
}
export function drawSign(t, o = {}) {
  const { x } = SIGN, tilt = 0.06 + (o.wob ?? 0);
  g.save(); g.translate(x, 30); g.rotate(tilt);
  limb([[0, 40], [0, -420]], 22, P.post, false);
  limb([[0, -40], [0, -120]], 22, P.rust, false);
  g.translate(0, -420);
  const s = 150;
  poly([[0 + 8, -s + 10], [s * 0.95 + 8, s * 0.6 + 10], [-s * 0.95 + 8, s * 0.6 + 10]], 'rgba(23,22,47,0.6)');
  poly([[0, -s], [s * 0.95, s * 0.6], [-s * 0.95, s * 0.6]], P.ink);
  poly([[0, -s + 26], [s * 0.95 - 30, s * 0.6 - 14], [-s * 0.95 + 30, s * 0.6 - 14]], P.sign);
  inside(polyPath([[0, -s + 26], [s * 0.95 - 30, s * 0.6 - 14], [-s * 0.95 + 30, s * 0.6 - 14]]), () => {
    ell(70, 50, 34, 22, P.rust, 0.4, 0.8); ell(-60, 64, 22, 14, P.rust, 0, 0.7); ell(10, -60, 14, 9, P.rust, 0, 0.6);
  });
  trefoil(0, 24, 56);
  rrect(-136, s * 0.6 + 26, 272, 70, 8, P.ink); rrect(-130, s * 0.6 + 30, 260, 60, 6, P.sign);
  text('ОПАСНО', 0, s * 0.6 + 78, 50, P.ink, { shadow: false });
  g.restore();
}

// —— the rowboat: hull (side view), bow to the left. back = the far gunwale and the inside, front = the near side;
// the hunter is drawn between them. x = centre, y = the water line under it, tilt in radians ——
export const BOAT = { len: 520, h: 96 };
export function boatFrame(x, y, t, tilt = 0) {
  const bob = 5 * Math.sin(t * 2.6) + 3 * Math.sin(t * 1.7 + 1);
  return { x, y: y + bob, tilt: tilt + 0.012 * Math.sin(t * 2.1) };
}
export function drawBoatBack(b) {
  const { len, h } = BOAT;
  g.save(); g.translate(b.x, b.y); g.rotate(b.tilt);
  fill(smoothPath([[-len / 2 - 30, -h - 10], [-len / 2 + 40, -h + 10], [len / 2 - 20, -h + 10], [len / 2 + 10, -h - 4], [len / 2, -h + 30], [-len / 2 + 20, -h + 30]]), P.boatInSh);
  rect(-len / 2 + 60, -h + 6, len - 120, 50, P.boatIn);
  rect(-60, -h - 4, 130, 22, P.woodHi);                   // the bench
  rect(-60, -h + 18, 130, 8, P.woodSh);
  g.restore();
}
export function drawBoatFront(b, o = {}) {
  const { len, h } = BOAT;
  g.save(); g.translate(b.x, b.y); g.rotate(b.tilt);
  const hull = smoothPath([[-len / 2 - 40, -h - 14], [-len / 2 + 30, -h + 4], [len / 2 - 10, -h + 4], [len / 2 + 14, -h - 6], [len / 2 + 6, -h + 40], [len / 2 - 40, 20], [-len / 2 + 70, 24], [-len / 2 + 10, -h + 30]]);
  fill(hull, P.boat);
  inside(hull, () => {
    rect(-len, -h - 30, len * 2, 30 + 12, P.boatRim);
    rect(-len, 0, len * 2, 60, P.boatSh);
    text(o.name ?? '', -40, -12, 40, P.boatRim, { fam: FONTS.cond, shadow: false });
  });
  for (const ox of o.locks ?? [-30, 120]) { rect(ox - 8, -h - 30, 16, 24, '#2a2a33'); }
  g.restore();
}
// world point on the boat (local coordinates: x along, y up negative, origin at the water line)
export function boatP(b, [lx, ly]) { const c = Math.cos(b.tilt), s = Math.sin(b.tilt); return [b.x + lx * c - ly * s, b.y + lx * s + ly * c]; }
// the boat's reflection and the water hiding its bottom
export function boatWater(b, t) {
  const { len } = BOAT;
  rect(b.x - len / 2 - 20, b.y + 2, len + 40, 34, rgba(P.lakeDeep, 0.55));
  for (let i = 0; i < 4; i++) limb([[b.x - len / 2 - 40 + 30 * Math.sin(t * 2 + i), b.y + 12 + i * 10], [b.x - len / 2 + 60 + 30 * Math.sin(t * 2 + i), b.y + 12 + i * 10]], 5, rgba(P.lakeHi, 0.6), false);
}

// —— the near shore (MAIN): grass, the muddy edge, reeds, the path up to the yard ——
// the near shore: from the waterline it curves away to the left, so the lake fills the bottom right
const EDGE = sample([[SHORE + 262, 60], [SHORE + 230, 220], [SHORE + 120, 520], [SHORE - 120, 1000], [SHORE - 480, 1800], [SHORE - 900, 3000]], 10, false);
export function drawShore(t, o = {}) {
  const pts = [];
  for (let x = -6400; x <= SHORE + 260; x += 40) pts.push([x, groundY(x)]);
  const land = polyPath([...pts, ...EDGE, [-6400, 3000]]);
  // the shallows along the near shore, on the water side
  limb(EDGE.map(([x, y]) => [x + 30, y]), 50, rgba(P.lakeHi, 0.35 + 0.08 * Math.sin(t * 2)), false);
  fill(land, P.grass);
  inside(land, () => {
    rect(-6400, 200, 6000, 2800, P.grassSh);
    for (let i = 0; i < 60; i++) { const x = -6400 + i * 90 + 40 * hash(i + 80), y = groundY(x) + 60 + 400 * hash(i + 81); ell(x, y, 60 + 40 * hash(i + 82), 14, P.grassSh, 0, 0.8); }
    // the mud strip at the waterline, running on down the near shore
    const mud = []; for (let x = -2100; x <= SHORE + 260; x += 40) mud.push([x, groundY(x) + 24]);
    limb([...mud, ...EDGE.map(([x, y]) => [x - 10, y])], 40, P.mud);
  });
  // the path from the water up to the gate
  const path = [[SHORE + 40, 10], [-1800, -66], [-2100, -170], [-2400, -214], [GATE.x, groundY(GATE.x) + 6]];
  limb(path.map(([x, y]) => [x, y + 10]), 70, P.dirtSh); limb(path, 56, P.dirt);
}
function reed(x, y, h, t, k = 1) {
  const sw = 10 * Math.sin(t * 1.6 + x * 0.01) * k;
  limb([[x, y], [x + sw * 0.4, y - h * 0.5], [x + sw, y - h]], 7 * k, P.reed);
  ell(x + sw, y - h + 36 * k, 9 * k, 30 * k, P.cattail);
  limb([[x, y - h * 0.3], [x - 40 * k, y - h * 0.7 + sw]], 5 * k, P.reedSh);
}
export function drawReeds(t, x0, x1, y = 20, k = 1, seed = 0) {
  for (let i = 0; i < 40; i++) {
    const x = lerp(x0, x1, hash(i * 1.3 + seed));
    reed(x, y + 20 * hash(i + seed + 5), (140 + 120 * hash(i + seed + 6)) * k, t, k);
  }
}
function birch(x, y, h, k = 1, lean = 0, t = 0) {
  const top = [x + lean * h, y - h];
  limb([[x, y], [x + lean * h * 0.5, y - h * 0.5], top], 26 * k, P.birch);
  for (let i = 1; i < 7; i++) { const v = i / 7; const px = x + lean * h * v; limb([[px - 10 * k, y - h * v], [px + 5 * k, y - h * v - 3]], 7 * k, P.birchMark, false); }
  const sway = 8 * Math.sin(t * 1.4 + x);
  for (const [dx, dy, r] of [[0, 0, 86], [-62, 36, 70], [64, 30, 72], [-22, -62, 64], [36, -50, 58], [-80, -10, 50]]) {
    ell(top[0] + dx * k + sway + 12 * k, top[1] + dy * k + 14 * k, r * k, r * 0.86 * k, P.leafSh);
    ell(top[0] + dx * k + sway, top[1] + dy * k, r * k, r * 0.86 * k, P.leaf);
  }
}
export const TREES = [[-2050, 1.0], [-2480, 0.9], [-3800, 1.1], [-4700, 1.0], [-5400, 1.15]];
export function drawTrees(t) { for (const [x, k] of TREES) birch(x, groundY(x) - 6, 560 * k, k, (hash(x) - 0.5) * 0.12, t); }

// —— the yard: the log house with a porch, the fence and its gate ——
export function drawHouse(t, o = {}) {
  const { x, y } = HOUSE, w = 640, h = 360;
  rect(x - w / 2, y - h, w, h, P.hut);
  for (let i = 0; i < 8; i++) rect(x - w / 2 - 10, y - h + i * 46 + 26, w + 20, 10, P.hutSh);
  for (const s of [-1, 1]) for (let i = 0; i < 8; i++) ell(x + s * (w / 2 + 6), y - h + i * 46 + 20, 16, 21, P.woodHi);
  poly([[x - w / 2 - 80, y - h + 6], [x, y - h - 230], [x + w / 2 + 80, y - h + 6]], P.roof);
  poly([[x - 70, y - h - 40], [x, y - h - 120], [x + 70, y - h - 40]], '#f0e2c4');                // the gable's carved board
  ell(x, y - h - 70, 22, 22, P.hutSh);
  // windows with white carved frames (наличники)
  for (const wx of [x - 190, x + 30]) {
    rrect(wx - 64, y - h + 92, 128, 128, 6, '#f0e2c4');
    rect(wx - 50, y - h + 106, 100, 100, mix('#3a2a20', P.hutWin, o.light ?? 0.2));
    limb([[wx, y - h + 106], [wx, y - h + 206]], 7, '#f0e2c4', false); limb([[wx - 50, y - h + 150], [wx + 50, y - h + 150]], 7, '#f0e2c4', false);
    poly([[wx - 76, y - h + 92], [wx, y - h + 60], [wx + 76, y - h + 92]], '#f0e2c4');
  }
  // the porch and the door on the right
  rect(x + 170, y - h + 110, 120, h - 110, '#5e3a22');
  rect(x + 150, y - 50, 180, 50, P.woodHi); rect(x + 150, y - 50, 180, 10, P.woodSh);
  rect(x + 120, y - 22, 240, 22, P.woodSh);
  ell(x + 270, y - h + 230, 9, 9, '#d9b46a');
  rect(x - 250, y - h - 180, 54, 130, '#4a3a33');
}
export function drawFence(t, o = {}) {
  const gx = GATE.x;
  for (let i = 0; i < 26; i++) {
    const x = gx - 1400 + i * 56;
    if (Math.abs(x - gx) < 90) continue;
    const y = groundY(x);
    poly([[x - 20, y + 6], [x - 20, y - 190], [x, y - 214], [x + 20, y - 190], [x + 20, y + 6]], i % 2 ? P.fence : P.fenceSh);
  }
  const y = groundY(gx);
  rect(gx - 1420, y - 150, 1330, 16, P.fenceSh); rect(gx + 90, y - 150, 30, 16, P.fenceSh);
  rect(gx - 1420, y - 70, 1330, 16, P.fenceSh);
  // the gate: two posts, a door that swings open (open 0…1)
  const op = clamp(o.open ?? 0);
  for (const s of [-1, 1]) rect(gx + s * 90 - 14, y - 250, 28, 256, P.woodSh);
  const gw = 160 * Math.cos(op * 1.3);
  if (gw > 4) { rect(gx - 76, y - 200, gw, 196, P.fence); for (let i = 1; i < 4; i++) rect(gx - 76 + gw * i / 4 - 4, y - 200, 8, 196, P.fenceSh); }
}

// —— the summer shower: a plank booth with a black barrel on the roof; door (open 0…1), water running, the shelf ——
export function drawShowerBack(t, o = {}) {
  const { x, y, w, h } = SHOWER;
  rect(x - w / 2, y - h, w, h, P.woodSh);
  if (o.water) for (let i = 0; i < 14; i++) { const ph = (t * 3 + i / 14) % 1; limb([[x - 40 + i * 6, y - h + 30 + ph * 280], [x - 40 + i * 6, y - h + 60 + ph * 280]], 4, rgba('#cfe6f2', 0.8), false); }
}
export function drawShowerFront(t, o = {}) {
  const { x, y, w, h } = SHOWER;
  // planks on the sides and a door that covers the body up to the shoulders
  const doorTop = y - 280;
  rect(x - w / 2 - 14, y - h - 10, 28, h + 10, P.wood); rect(x + w / 2 - 14, y - h - 10, 28, h + 10, P.wood);
  const op = clamp(o.open ?? 0), dw = (w - 20) * Math.cos(op * 1.3);
  if (dw > 4) {
    rect(x - w / 2 + 10, doorTop, dw, y - doorTop - 14, P.woodHi);
    for (let i = 1; i < 4; i++) rect(x - w / 2 + 10 + dw * i / 4 - 3, doorTop, 6, y - doorTop - 14, P.wood);
    ell(x - w / 2 + 10 + dw - 26, doorTop + 140, 8, 8, '#2a2a33');
    // a heart cut in the door, like in every dacha
    if (dw > 120) { g.save(); g.translate(x - w / 2 + 10 + dw / 2, doorTop + 46); ell(-9, -4, 11, 11, P.woodSh); ell(9, -4, 11, 11, P.woodSh); poly([[-19, 0], [19, 0], [0, 20]], P.woodSh); g.restore(); }
  }
  // the roof, the barrel, the pipe and the shower head
  rect(x - w / 2 - 30, y - h - 24, w + 60, 26, P.roof);
  rrect(x - 90, y - h - 150, 180, 128, 16, P.barrel);
  rect(x - 90, y - h - 120, 180, 10, P.barrelHi); rect(x - 90, y - h - 70, 180, 10, P.barrelHi);
  limb([[x + 10, y - h], [x + 10, y - h + 40], [x - 20, y - h + 50]], 10, '#8a8a96');
  ell(x - 30, y - h + 54, 24, 10, '#8a8a96');
  // the shelf on the outside wall with three bottles: soap, shampoo, conditioner
  const sx = x + w / 2 + 10, sy = y - 230;
  rect(sx, sy, 250, 14, P.woodSh);
  limb([[sx + 10, sy + 14], [sx - 10, sy + 50]], 8, P.woodSh, false);
  return { shelf: [sx, sy], doorTop };
}
export function soap(x, y, k = 1) {
  k *= 1; rrect(x - 30 * k, y - 22 * k, 60 * k, 22 * k, 8 * k, '#f2b6c6'); rrect(x - 24 * k, y - 20 * k, 30 * k, 6 * k, 3 * k, '#ffd9e4'); }
export function bottle(x, y, k, body, cap, label = '') {
  rrect(x - 22 * k, y - 96 * k, 44 * k, 96 * k, 12 * k, body);
  rrect(x - 12 * k, y - 118 * k, 24 * k, 24 * k, 4 * k, cap);
  rrect(x - 16 * k, y - 70 * k, 32 * k, 40 * k, 4 * k, '#fff7ea');
  if (label) text(label, x, y - 42 * k, 20 * k, '#17162f', { fam: FONTS.cond, shadow: false });
}
