// A power line along the forest road, and a broken wire lying across it (the end of «Приключения Искры» №2, the start
// of №3). Wooden poles with a crossbar and three wires; one wire is torn from the near pole: it hangs down to the road,
// lies across it in loops, and sparks where it touches the ground (o.spark 0…1 how hard).
import { lerp, clamp, TAU, hash } from './lib.js';
import { g, ell, limb, rect, fill, poly, polyPath, texArea } from './flat.js';
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
  const a = near[2];
  const hang = [];
  for (let i = 0; i <= 14; i++) { const u = i / 14; hang.push([lerp(a[0], 640, u) + 40 * Math.sin(u * Math.PI), lerp(a[1], 1000, u * u)]); }
  const lie = [];
  for (let i = 0; i <= 18; i++) { const u = i / 18; lie.push([lerp(640, 190, u), 1000 + 22 * Math.sin(u * 9) + 40 * u]); }
  limb([...hang, ...lie.slice(1)], 7, WIRE);
  limb([[tops[1][2][0], tops[1][2][1]], [tops[1][2][0] + 14, tops[1][2][1] + 70]], 2.5, WIRE);    // its stub on the far pole
  const ends = { touch: [640, 1000], tip: lie[lie.length - 1] };
  sparks(ends.touch[0], ends.touch[1], sp, t, 1);
  sparks(ends.tip[0], ends.tip[1], sp * 0.7, t + 0.37, 0.7);
  return ends;
}
