// The rhino of «Арена», битва 3: flat shapes like the bull and the lion. One rig in local units (facing right, origin on
// the sand under his middle, y up is negative): stand → walk → run (gait 0…1 with a phase), the head lowered to charge
// (charge), raised to sniff with the nostrils flaring (sniff), the ears turning to a sound (ear −1…1), looking about,
// lost (look −1…1), dazed after the hit (daze: a wobble). drawRhino returns where his head, horn and nose are.
import { lerp, clamp, TAU } from './lib.js';
import { g, ell, limb, fill, smoothPath, polyPath, rrect } from './flat.js';

export const RHINO = {
  hide: '#8d8f94', hideSh: '#6f7177', belly: '#a5a7ab', fold: '#5f6166', horn: '#e9dfc8', hornSh: '#c9bc9e',
  eye: '#17162f', white: '#f4f1ea', nostril: '#3b3c40', ear: '#7a7c81', earIn: '#c99a9a', toe: '#4a4b4f',
};

function leg(j, foot, w, c) {
  limb([j, [(j[0] + foot[0]) / 2, (j[1] + foot[1]) / 2], [foot[0], foot[1] - 12]], w, c, true);
  ell(foot[0], foot[1] - 10, w * 0.62, 12, RHINO.toe);
}

export function drawRhino(o) {
  const s = o.s ?? 1, face = o.face ?? 1, ph = o.phase ?? 0, gait = clamp(o.gait ?? 0), t = o.t ?? 0;
  const charge = clamp(o.charge ?? 0), sniff = clamp(o.sniff ?? 0), daze = clamp(o.daze ?? 0), ear = o.ear ?? 0, look = o.look ?? 0;
  g.save(); g.translate(o.x, o.y ?? 0); g.scale(face * s, s);
  const wob = daze * 0.08 * Math.sin(t * 11);
  g.rotate(wob);
  const bob = gait * 10 * Math.sin(ph * 2) + (1 - gait) * 2 * Math.sin(t * 2);
  const by = -165 + bob + charge * 18;
  const footAt = (x0, off) => { const a = ph + off, stride = lerp(6, 70, gait), lift = lerp(3, 34, gait); return [x0 + stride * Math.cos(a), -Math.max(0, Math.sin(a)) * lift]; };
  // far legs, the tail
  leg([95, by + 55], footAt(100, Math.PI * 0.5), 40, RHINO.hideSh);
  leg([-120, by + 50], footAt(-118, Math.PI * 1.5), 44, RHINO.hideSh);
  const tw = Math.sin(t * 4) * 0.5;
  limb([[-205, by - 20], [-228, by + 10 + 10 * tw], [-232, by + 46]], 8, RHINO.hideSh, true); ell(-232, by + 52, 7, 12, RHINO.fold);
  // the body: a barrel with a hump over the shoulders, folds of skin at the shoulder and the hip
  fill(smoothPath([[-210, by - 20], [-180, by - 82], [-60, by - 100], [40, by - 112], [110, by - 98], [168, by - 40], [160, by + 46], [80, by + 74],
    [-80, by + 72], [-180, by + 50], [-214, by + 14]]), RHINO.hide);
  fill(smoothPath([[-150, by + 40], [0, by + 66], [140, by + 52], [120, by + 72], [0, by + 80], [-140, by + 66]]), RHINO.belly);
  limb([[90, by - 96], [70, by - 30], [92, by + 50]], 7, RHINO.fold, true);
  limb([[-120, by - 80], [-130, by - 20], [-110, by + 46]], 7, RHINO.fold, true);
  for (let i = 0; i < 9; i++) ell(-150 + i * 34, by - 40 + 14 * Math.sin(i * 1.7), 6, 4, RHINO.hideSh);
  // near legs
  leg([-100, by + 56], footAt(-96, 0), 48, RHINO.hide);
  leg([110, by + 60], footAt(116, Math.PI), 44, RHINO.hide);
  // the head: long, low, the two horns; lowered for the charge, raised to sniff
  const hx = 190 + 18 * charge - 6 * sniff, hy = by - 10 + 46 * charge - 30 * sniff;
  g.save(); g.translate(hx, hy); g.rotate(0.32 * charge - 0.34 * sniff + 0.12 * look * Math.sin(t * 3));
  // the ears turn towards a sound
  for (const [ex, k] of [[-30, 0], [-6, 1]]) {
    g.save(); g.translate(ex, -66); g.rotate(-0.4 + 0.7 * ear + 0.1 * k);
    fill(smoothPath([[-12, 0], [-14, -38], [0, -54], [14, -38], [12, 0]]), k ? RHINO.ear : RHINO.hideSh);
    if (k) fill(smoothPath([[-6, -6], [-6, -34], [0, -44], [6, -34], [6, -6]]), RHINO.earIn);
    g.restore();
  }
  fill(smoothPath([[-60, -40], [0, -70], [70, -54], [130, -6], [140, 34], [100, 56], [20, 50], [-50, 30]]), RHINO.hide);
  limb([[-20, -30], [-6, 20]], 6, RHINO.fold, true);
  // horns: the big front one on the nose, the small one behind it
  fill(smoothPath([[96, -12], [112, -96], [126, -110], [130, -92], [132, -10]]), RHINO.horn);
  limb([[110, -20], [122, -94]], 5, RHINO.hornSh, false);
  fill(smoothPath([[52, -48], [62, -86], [72, -92], [78, -50]]), RHINO.horn);
  // the eye (small, a little sad), the lid when dazed
  const ey = -18, ex = 34;
  ell(ex, ey, 11, 9, RHINO.white); ell(ex + 3 + 3 * look, ey + 1, 6, 7, RHINO.eye);
  const lid = clamp((o.lid ?? 0.25) + 0.5 * daze + (o.blink ?? 0));
  fill(smoothPath([[ex - 14, ey - 11], [ex + 14, ey - 11], [ex + 14, ey - 11 + 20 * lid], [ex - 14, ey - 11 + 20 * lid]]), RHINO.hide);
  if (charge > 0.3) limb([[ex - 14, ey - 16], [ex + 14, ey - 8]], 6, RHINO.fold, false);
  // the nostrils flare when he sniffs; the mouth
  const nf = 1 + 0.8 * sniff * (0.6 + 0.4 * Math.sin(t * 18));
  ell(128, 22, 6 * nf, 4 * nf, RHINO.nostril, -0.5);
  limb([[96, 46], [120, 44], [134, 36]], 5, RHINO.fold, true);
  g.restore();
  g.restore();
  const Wp = ([x, y]) => [o.x + face * s * x, (o.y ?? 0) + s * y];
  return { head: Wp([hx + 40, hy - 30]), horn: Wp([hx + 120, hy - 100]), nose: Wp([hx + 135, hy + 20]) };
}
