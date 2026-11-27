// A power line along the forest road, and a broken wire lying across it (the end of «Приключения Искры» №2, the start
// of №3). Wooden poles with a crossbar and three wires; one wire is torn from the near pole: it hangs down to the road,
// lies across it in loops, and sparks where it touches the ground (o.spark 0…1 how hard).
import { lerp, clamp, TAU, hash, ease } from './lib.js';
import { g, ell, limb, rect, rrect, fill, poly, polyPath, rrPath, smoothPath, texArea } from './flat.js';
import { autumnForest, HOR } from './bear.js';

const WOOD = '#6b4a2e', WOOD_D = '#4c331f', WIRE = '#1d1a1a';

function pole(x, y, h, t) {                      // the bottom at (x, y), h tall; returns the three insulator points
  const w = h * 0.035;
  const p = polyPath([[x - w * 0.6, y], [x - w * 0.45, y - h], [x + w * 0.45, y - h], [x + w * 0.6, y]]);
  fill(p, WOOD); texArea(p, 'bark', 0.5, 0.5);
  const cy = y - h * 0.93, cw = h * 0.22;
  rect(x - cw, cy - w * 0.35, cw * 2, w * 0.7, WOOD_D);
  const ins = [[x - cw * 0.85, cy - w * 0.35], [x, y - h], [x + cw * 0.85, cy - w * 0.35]];
  for (const [ix, iy] of ins) { ell(ix, iy - w * 0.5, w * 0.32, w * 0.5, '#e8eef0'); ell(ix, iy - w * 0.95, w * 0.22, w * 0.22, '#c9d3d6'); }
  return ins.map(([ix, iy]) => [ix, iy - w * 0.95]);
}
function sag(a, b, d, wd) {                     // a hanging wire from a to b with sag d
  const pts = [];
  for (let i = 0; i <= 16; i++) { const u = i / 16; pts.push([lerp(a[0], b[0], u), lerp(a[1], b[1], u) + d * 4 * u * (1 - u)]); }
  limb(pts, wd, WIRE);
}
// sparks at (x, y): a white-yellow star that flickers, little hot bits flying
export function sparks(x, y, k, t, s = 1) {
  if (k <= 0.01) return;
  const fl = 0.55 + 0.45 * Math.sin(t * 47) * Math.sin(t * 31 + 1);
  g.save(); g.globalAlpha = k * fl;
  const gr = g.createRadialGradient(x, y, 0, x, y, 90 * s); gr.addColorStop(0, 'rgba(255,250,210,0.95)'); gr.addColorStop(0.3, 'rgba(255,214,90,0.55)'); gr.addColorStop(1, 'rgba(255,190,60,0)');
  g.fillStyle = gr; g.fillRect(x - 90 * s, y - 90 * s, 180 * s, 180 * s);
  for (let i = 0; i < 7; i++) { const a = TAU * hash(i + Math.floor(t * 20) * 7), r = (25 + 45 * hash(i + 3 + Math.floor(t * 20))) * s;
    limb([[x, y], [x + Math.cos(a) * r, y - Math.abs(Math.sin(a)) * r]], 3 * s, '#fff3b0'); }
  ell(x, y, 12 * s, 12 * s, '#ffffff');
  g.restore();
}
export function wireRoad(t, o = {}) {
  const pan = o.pan ?? 0, sp = o.spark ?? 0;
  autumnForest(t, { pan });
  // the far poles in the haze, then the near one at the right
  const far = [[430 - pan * 0.4, HOR + 32, 130], [300 - pan * 0.35, HOR + 90, 260]];
  const tops = far.map(([x, y, h]) => pole(x, y, h, t));
  const near = pole(900 - pan * 0.8, 1010, 720, t);
  for (let i = 0; i < 3; i++) sag(tops[0][i], tops[1][i], 10, 2);
  sag(tops[1][0], near[0], 40, 4); sag(tops[1][1], near[1], 46, 4);           // two wires still up
  // the torn one: from the near pole's right insulator down to the road, then lying across it in loops
  const a = near[2], fall = clamp(o.fall ?? 1);
  const hang = [];
  for (let i = 0; i <= 14; i++) { const u = i / 14; hang.push([lerp(a[0], 640, u) + 40 * Math.sin(u * Math.PI), lerp(a[1], 1000, u * u)]); }
  const lie = [];
  for (let i = 0; i <= 18; i++) { const u = i / 18; lie.push([lerp(640, 190, u), 1000 + 22 * Math.sin(u * 9) + 40 * u]); }
  let pts = [...hang, ...lie.slice(1)];
  if (fall < 1) {                               // it snaps at the far pole and whips down around the near insulator
    const up = pts.map((_, i) => { const u = i / (pts.length - 1); return [lerp(a[0], tops[1][2][0], u), lerp(a[1], tops[1][2][1], u) + 46 * 4 * u * (1 - u)]; });
    const f = ease.in(fall);
    pts = pts.map((p, i) => { const u = i / (pts.length - 1), k = clamp(f * 1.25 - u * 0.25); return [lerp(up[i][0], p[0], k), lerp(up[i][1], p[1], k) + Math.sin(u * 9 + fall * 12) * 30 * k * (1 - k)]; });
  }
  limb(pts, 7, WIRE);
  limb([[tops[1][2][0], tops[1][2][1]], [tops[1][2][0] + 14, tops[1][2][1] + 70]], 2.5, WIRE);    // its stub on the far pole
  const ends = { touch: [640, 1000], tip: lie[lie.length - 1] };
  if (fall >= 1) { sparks(ends.touch[0], ends.touch[1], sp, t, o.sparkSize ?? 1); sparks(ends.tip[0], ends.tip[1], sp * 0.7, t + 0.37, 0.7 * (o.sparkSize ?? 1)); }
  return ends;
}

// the current spreading through the ground around (cx, cy): rings in perspective (ry = rx · 0.22), rippling outwards;
// k 0…1 how much is shown; r8: the radius of the 8 m ring in px (dashed red, labelled)
export function groundRings(cx, cy, t, k, r8 = 640, o = {}) {
  if (k <= 0.01) return;
  g.save();
  const n = 6;
  for (let i = n; i >= 1; i--) {
    const r = r8 * (i / n) * clamp(k * 1.4 - (i - 1) * 0.08), a = (1 - i / (n + 1)) * 0.35 * k;
    if (r <= 2) continue;
    g.globalAlpha = a; g.fillStyle = i < 3 ? '#ffd23f' : i < 5 ? '#ff9a3c' : '#e5533d';
    g.beginPath(); g.ellipse(cx, cy, r, r * 0.22, 0, 0, TAU); g.fill();
  }
  for (let j = 0; j < 3; j++) {                           // the ripples running out
    const ph = ((t * 0.7 + j / 3) % 1), r = r8 * ph;
    g.globalAlpha = k * 0.8 * (1 - ph); g.lineWidth = 4; g.strokeStyle = '#fff3b0';
    g.beginPath(); g.ellipse(cx, cy, r, r * 0.22, 0, 0, TAU); g.stroke();
  }
  g.globalAlpha = k; g.lineWidth = 6; g.strokeStyle = '#e53935'; g.setLineDash([22, 16]); g.lineDashOffset = -t * 40;
  g.beginPath(); g.ellipse(cx, cy, r8, r8 * 0.22, 0, 0, TAU); g.stroke(); g.setLineDash([]);
  g.restore();
}
// a passer-by, flat: side view walking (dir -1 = to the left), x, y the ground under him, h his height; walk 0…1 swing
export function walker(x, y, h, t, o = {}) {
  const u = h / 100, dir = o.dir ?? -1, sw = (o.walk ?? 1) * 0.45 * Math.sin(t * 7);
  g.save(); g.translate(x, y); g.scale(u * dir, u);
  ell(0, 1, 18, 3, 'rgba(0,0,0,0.25)');
  const leg = (a, c) => { const kx = Math.sin(a) * 30; limb([[0, -48], [kx * 0.5, -24], [kx, -2]], 8, c); ell(kx + 4, -2, 7, 3.5, '#222'); };
  leg(-sw, '#2a3550'); leg(sw, '#34416a');
  limb([[0, -50], [0, -84]], 20, '#3f6f9e');                 // the jacket
  const arm = (a, c) => { const kx = Math.sin(a) * 18; limb([[0, -80], [kx * 0.6, -64], [kx, -50]], 6.5, c); };
  arm(sw, '#355e88'); 
  ell(1, -94, 9, 10, '#f0c8a0'); fill(smoothPath([[-9, -98], [-7, -106], [4, -107], [10, -99], [2, -101]]), '#3a2a20');   // head and hair
  arm(-sw, '#3f6f9e');
  g.restore();
}
// the stairwell of a block of flats: green paint below, whitewash above, a padded door, a light switch, a bulb; gas: 0…1
export function stairwell(t, o = {}) {
  const gas = o.gas ?? 0;
  rect(0, 0, 1080, 1920, '#d9d2c0');
  const low = polyPath([[0, 760], [1080, 760], [1080, 1500], [0, 1500]]); fill(low, '#4f7f5a'); texArea(low, 'concrete', 0.8, 0.45);
  rect(0, 752, 1080, 12, '#3a5f43');
  const up = polyPath([[0, 0], [1080, 0], [1080, 752], [0, 752]]); texArea(up, 'concrete', 0.9, 0.35);
  const fl = polyPath([[0, 1340], [1080, 1340], [1080, 1920], [0, 1920]]); fill(fl, '#8a7a66'); texArea(fl, 'concrete', 0.6, 0.5);
  for (let i = 0; i < 8; i++) rect(i * 140, 1340, 3, 580, 'rgba(0,0,0,0.12)');
  // the door, padded with brown leatherette and studs
  const dp = rrPath(150, 420, 420, 920, 8); fill(dp, '#6b3f26'); texArea(dp, 'fabric', 0.5, 0.5);
  for (let r = 0; r < 6; r++) for (let c = 0; c < 3; c++) ell(220 + c * 140 + (r % 2) * 70, 500 + r * 140, 6, 6, '#c9a36a');
  rect(130, 400, 20, 950, '#4a2c1a'); rect(570, 400, 20, 950, '#4a2c1a'); rect(130, 400, 460, 20, '#4a2c1a');
  ell(520, 900, 14, 14, '#c9a36a'); rrect(320, 330, 90, 56, 8, '#2b2b2b'); 
  // the switch and the bulb
  rrect(760, 820, 110, 150, 14, '#f2efe6'); rrect(795, 850, 40, 90, 8, '#dedad0'); rect(800, 860, 30, 34, '#ffffff');
  limb([[815, 0], [815, 120]], 4, '#222'); ell(815, 150, 34, 40, '#e8e4d6', 0, 0.9); rect(800, 112, 30, 18, '#777');
  // gas: green wavy wisps drifting up
  if (gas > 0.01) {
    g.save(); g.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      const x0 = 120 + i * 105 + 30 * Math.sin(i * 1.7), ph = ((t * 0.25 + hash(i)) % 1);
      g.globalAlpha = gas * 0.8 * Math.sin(ph * Math.PI); g.lineWidth = 14; g.strokeStyle = '#8fdc7a';
      g.beginPath();
      for (let j = 0; j <= 12; j++) { const yy = 1400 - ph * 700 - j * 28; const xx = x0 + 22 * Math.sin(j * 0.8 + t * 2 + i); j ? g.lineTo(xx, yy) : g.moveTo(xx, yy); }
      g.stroke();
    }
    g.restore();
  }
}
