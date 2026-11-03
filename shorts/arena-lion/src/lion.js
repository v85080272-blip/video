// The lion of «Арена», битва 2: flat shapes like the bull. One rig in local units (facing right, origin on the sand under
// his middle, y up is negative): stand → walk → run (gait 0…1 with a phase), crouched and stalking (crouch), roaring
// (roar), startled and leaning back (back), a front paw raised with a thorn in it (limp, thorn), lying like a sphinx
// (lie). drawLion returns where his head and the raised paw are.
import { lerp, clamp, TAU } from './lib.js';
import { g, ell, limb, fill, smoothPath, polyPath, rrect } from './flat.js';

export const LION = {
  coat: '#d9a441', coatSh: '#b9862c', belly: '#ecc778', mane: '#8a4b1e', maneSh: '#6e3913', face: '#e8b55a', muzzle: '#f6e2b8',
  nose: '#4a2a20', eye: '#f2b632', pupil: '#17162f', white: '#fbf7ee', tuft: '#5a2e12', mouth: '#5a1e1e', tooth: '#fffaf0', thorn: '#4b3a2a',
};

function leg(j, paw, w, c, front) {
  const mx = (j[0] + paw[0]) / 2, my = (j[1] + paw[1]) / 2, d = Math.hypot(paw[0] - j[0], paw[1] - j[1]);
  const bend = Math.max(0, 135 - d) * 0.55 * (front ? 1 : -1);
  limb([j, [mx + bend, my], [paw[0], paw[1] - 10]], w, c, true);
  ell(paw[0] + 6, paw[1] - 8, w * 0.75, 12, c === LION.coat ? LION.belly : LION.coatSh);
}

export function drawLion(o) {
  const s = o.s ?? 1, face = o.face ?? 1, ph = o.phase ?? 0, gait = clamp(o.gait ?? 0), t = o.t ?? 0;
  const crouch = clamp(o.crouch ?? 0), lie = clamp(o.lie ?? 0), roar = clamp(o.roar ?? 0), back = clamp(o.back ?? 0), limp = clamp(o.limp ?? 0);
  g.save(); g.translate(o.x, o.y ?? 0); g.scale(face * s, s); g.rotate(-0.08 * back);
  const bob = gait * 8 * Math.sin(ph * 2) + (1 - gait) * 2 * Math.sin(t * 2.4);
  const by = -175 + bob + crouch * 45 + lie * 110 + back * 10;
  const pawAt = (x0, off, front) => {
    if (lie > 0.5) return front ? [x0 + 70, 0] : [x0 + 30, 0];
    const a = ph + off, stride = lerp(8, 60, gait), lift = lerp(4, 36, gait);
    return [x0 + stride * Math.cos(a), -Math.max(0, Math.sin(a)) * lift];
  };
  const J = { fn: [110, by + 45], ff: [128, by + 38], hn: [-118, by + 35], hf: [-98, by + 30] };
  // far legs, the tail
  leg(J.ff, pawAt(132, Math.PI * 0.5, true), 26, LION.coatSh, true);
  leg(J.hf, pawAt(-96, Math.PI * 1.5, false), 30, LION.coatSh, false);
  const tw = Math.sin(t * 2.6) * 0.4 + gait * 0.4;
  const tail = [[-168, by - 20], [-215, by + 20], [-240 - 20 * tw, by - 30 - 40 * (1 - lie)], [-250 - 30 * tw, by - 70 * (1 - lie) - 10]];
  limb(tail, 11, LION.coatSh, true); ell(tail[3][0], tail[3][1], 16, 22, LION.tuft, 0.4 * tw);
  // the body
  fill(smoothPath([[-178, by - 25], [-155, by - 68], [-40, by - 80], [80, by - 86], [140, by - 66], [165, by - 10], [146, by + 50], [60, by + 62],
    [-60, by + 56], [-150, by + 42], [-180, by + 12]]), LION.coat);
  fill(smoothPath([[-120, by + 30], [0, by + 46], [120, by + 44], [130, by + 56], [60, by + 62], [-60, by + 56]]), LION.belly);
  // near legs; the near front one can be raised (the paw with the thorn)
  leg(J.hn, pawAt(-122, 0, false), 32, LION.coat, false);
  let pawUp = null;
  if (limp <= 0.01) leg(J.fn, pawAt(118, 0, true), 28, LION.coat, true);
  // the head in its mane
  const hx = lerp(200, 225, crouch) + lie * 20 - back * 30, hy = by - lerp(55, 20, crouch) + lie * 10 - back * 10;
  g.save(); g.translate(hx, hy); g.rotate(lerp(0, 0.18, crouch) - 0.15 * roar - 0.12 * back);
  const mane = [];
  for (let i = 0; i < 22; i++) {
    const a = i / 22 * TAU, r = (i % 2 ? 92 : 112) + 6 * Math.sin(t * 3 + i);
    mane.push([-25 + Math.cos(a) * r * 0.95, 8 + Math.sin(a) * r]);
  }
  fill(smoothPath(mane), LION.mane);
  ell(-40, 20, 70, 80, LION.maneSh, 0.2);
  ell(-6, -64, 16, 14, LION.coatSh); ell(-6, -64, 9, 8, LION.muzzle);          // ear
  fill(smoothPath([[-30, -50], [30, -58], [66, -24], [74, 26], [48, 64], [-10, 62], [-40, 24]]), LION.face);
  // the eyes: wary when startled, soft when lying, angry brow when stalking or roaring
  const ex = 26, ey = -18, lid = clamp((o.lid ?? 0) + 0.4 * lie + (o.blink ?? 0));
  ell(ex, ey, 13, 11, LION.white); ell(ex + 3, ey, 8, 9, LION.eye); ell(ex + 4, ey, 3.5, 7, LION.pupil);
  if (lid > 0.02) fill(smoothPath([[ex - 15, ey - 12], [ex + 15, ey - 12], [ex + 15, ey - 12 + 24 * lid], [ex - 15, ey - 12 + 24 * lid]]), LION.face);
  const brow = o.brow ?? (crouch + roar > 0.3 ? 1 : 0);
  if (brow > 0) limb([[ex - 16, ey - 18 - 4 * brow], [ex + 14, ey - 13 + 5 * brow]], 7, LION.coatSh, false);
  if (back > 0.2) limb([[ex - 14, ey - 22], [ex + 14, ey - 26]], 6, LION.coatSh, false);
  // the muzzle, the nose, the mouth (open to roar)
  ell(56, 26, 30, 24, LION.muzzle);
  fill(polyPath([[66, 2], [86, 6], [76, 20]]), LION.nose);
  if (roar > 0.05) {
    fill(smoothPath([[34, 40], [80, 38], [74, 40 + 44 * roar], [40, 40 + 40 * roar]]), LION.mouth);
    for (const tx of [44, 70]) { fill(polyPath([[tx - 5, 40], [tx + 5, 40], [tx, 54]]), LION.tooth); fill(polyPath([[tx - 5, 40 + 40 * roar], [tx + 5, 40 + 40 * roar], [tx, 28 + 40 * roar]]), LION.tooth); }
  } else limb([[44, 44], [56, 50], [70, 46]], 4, LION.nose, true);
  for (const [dx, dy] of [[40, 22], [44, 30], [62, 30]]) ell(dx, dy, 2.5, 2.5, LION.nose);
  g.restore();
  // the raised front paw (with the thorn) comes in front of the mane, so it reads
  if (limp > 0.01) {
    const p = [lerp(118, 250, limp), lerp(0, by + 20, limp)];
    limb([J.fn, [lerp(J.fn[0], 200, limp), lerp(by + 110, by + 80, limp)], p], 30, LION.coat, true);
    ell(p[0] + 12, p[1] + 2, 24, 17, LION.belly, -0.7 * limp);
    for (let i = 0; i < 3; i++) ell(p[0] + 26 + i * 2, p[1] - 10 + i * 10, 5, 4, LION.coatSh);
    if (o.thorn) { limb([[p[0] + 26, p[1] + 6], [p[0] + 58, p[1] + 22]], 7, LION.thorn, false); }
    pawUp = p;
  }
  g.restore();
  const W = ([x, y]) => [o.x + face * s * x, (o.y ?? 0) + s * y];
  return { head: W([hx + 40, hy]), paw: pawUp ? W(pawUp) : null, nose: W([hx + 80, hy + 10]) };
}
