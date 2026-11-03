// The bull of «Арена»: flat shapes like the hunter and the dog. One rig in local units (facing right, origin on the sand
// under his middle, y up is negative): stand → walk → gallop (gait 0…1 with a phase), the head lowered for the charge,
// a front hoof pawing the sand, squashed on the wall (squash), tired (tongue out, heavy lids), lying down (lie), the
// breath steaming from his nostrils. drawBull returns where his nose and horns are, for the cape and the sound.
import { lerp, clamp, TAU } from './lib.js';
import { g, ell, limb, fill, smoothPath, polyPath, rrect } from './flat.js';

export const BULL = {
  hide: '#4a2e22', hideSh: '#3a2219', belly: '#5f3d2d', snout: '#c9a58c', snoutSh: '#a98670', nostril: '#3a2219',
  horn: '#f1e6cf', hornSh: '#cfc1a3', hoof: '#1d1512', eye: '#17162f', white: '#fbf7ee', tongue: '#e8687a', tuft: '#2a1912',
};

// a leg from the joint to the hoof, bending at the knee (front legs bend forward, hind legs back)
function leg(j, hoof, w, c, front) {
  const mx = (j[0] + hoof[0]) / 2, my = (j[1] + hoof[1]) / 2, d = Math.hypot(hoof[0] - j[0], hoof[1] - j[1]);
  const bend = Math.max(0, 150 - d) * 0.5 * (front ? 1 : -1);
  const knee = [mx + bend, my];
  limb([j, knee, [hoof[0], hoof[1] - 14]], w, c, true);
  rrect(hoof[0] - w * 0.55, hoof[1] - 20, w * 1.1, 22, 6, BULL.hoof);
}

export function drawBull(o) {
  const s = o.s ?? 1, face = o.face ?? 1, ph = o.phase ?? 0, gait = clamp(o.gait ?? 0), head = clamp(o.head ?? 0);
  const lie = clamp(o.lie ?? 0), tired = clamp(o.tired ?? 0), sq = o.squash ?? 0, paw = o.paw ?? 0;
  g.save(); g.translate(o.x, o.y ?? 0); g.scale(face * s * (1 - 0.12 * sq), s * (1 + 0.1 * sq));
  // the body bobs with the gait and sinks when he lies down
  const bob = gait * 10 * Math.sin(ph * 2) + (1 - gait) * 2 * Math.sin((o.t ?? 0) * 2.2);
  const by = -215 + bob + lie * 140;
  const legLen = 150 * (1 - lie * 0.85);
  // hooves: a gallop is the pairs out of phase; walking a gentler step; lying, the legs folded under
  const hoofAt = (x0, off, front) => {
    if (lie > 0.5) return [x0 + (front ? 40 : -40), 0];
    const a = ph + off, stride = lerp(10, 70, gait), lift = lerp(6, 46, gait);
    let x = x0 + stride * Math.cos(a), y = -Math.max(0, Math.sin(a)) * lift;
    if (front && paw > 0 && off === 0) { x = x0 + 40 * Math.sin(paw * TAU * 2); y = -26 * Math.max(0, Math.sin(paw * TAU * 2 + 1)); }
    return [x, y];
  };
  const J = { fn: [118, by + 55], ff: [142, by + 45], hn: [-132, by + 30], hf: [-108, by + 25] };
  // far legs and the tail behind the body
  leg(J.ff, hoofAt(150, Math.PI * 0.5, true), 30, BULL.hideSh, true);
  leg(J.hf, hoofAt(-100, Math.PI * 1.5, false), 32, BULL.hideSh, false);
  const tw = Math.sin((o.t ?? 0) * 3.1) * 0.3 + gait * 0.5;
  const tail = [[-185, by - 30], [-215, by + 10 + 20 * tw], [-225 - 20 * tw, by + 70]];
  limb(tail, 9, BULL.hideSh, true); ell(tail[2][0], tail[2][1] + 14, 14, 22, BULL.tuft, 0.2 * tw);
  // the body: barrel, belly, hump over the shoulders
  const body = smoothPath([[-195, by - 40], [-178, by - 88], [-80, by - 96], [30, by - 112], [110, by - 142], [172, by - 112], [188, by - 40],
    [168, by + 58], [92, by + 86], [-40, by + 70], [-122, by + 50], [-186, by + 22]]);
  fill(body, BULL.hide);
  fill(smoothPath([[-110, by + 40], [0, by + 58], [120, by + 66], [150, by + 60], [92, by + 86], [-40, by + 70]]), BULL.belly);
  ell(95, by - 118, 80, 30, BULL.hideSh, -0.25);
  // near legs
  leg(J.hn, hoofAt(-130, 0, false), 34, BULL.hide, false);
  leg(J.fn, hoofAt(120, 0, true), 32, BULL.hide, true);
  // the head: on a thick neck, lowered for the charge
  const hx = lerp(225, 250, head), hy = lerp(by - 70, by + 10, head) + lie * 20, ha = lerp(-0.05, 0.55, head);
  fill(smoothPath([[130, by - 115], [hx - 40, hy - 50], [hx - 10, hy + 20], [150, by + 40]]), BULL.hide);
  g.save(); g.translate(hx, hy); g.rotate(ha);
  // horns behind the head first (far one), then the skull and the snout
  limb([[2, -40], [-6, -74], [26, -104], [52, -100]], 15, BULL.hornSh, true);
  fill(smoothPath([[-56, -44], [12, -58], [66, -22], [80, 42], [44, 70], [-22, 58], [-62, 10]]), BULL.hide);
  fill(smoothPath([[36, 14], [80, 20], [90, 52], [70, 70], [36, 64], [26, 36]]), BULL.snout);
  ell(78, 46, 7, 5, BULL.nostril, 0.3); ell(60, 52, 6, 4, BULL.nostril, 0.3);
  limb([[-12, -42], [-26, -80], [8, -112], [34, -108]], 19, BULL.horn, true);   // near horn, curving forward
  limb([[18, -112], [34, -108]], 13, BULL.hornSh, false);
  ell(-30, -28, 20, 10, BULL.hideSh, -0.6);                            // ear
  // the eye: angry brow; heavy lids when tired; crossed out when dizzy
  const ex = 20, ey = -10, lid = clamp((o.lid ?? 0) + tired * 0.45 + (o.blink ?? 0));
  ell(ex, ey, 13, 12, BULL.white); ell(ex + 3, ey + 1, 6, 7, BULL.eye);
  if (lid > 0.02) fill(smoothPath([[ex - 15, ey - 13], [ex + 15, ey - 13], [ex + 15, ey - 13 + 26 * lid], [ex - 15, ey - 13 + 26 * lid]]), BULL.hide);
  if (o.dizzy) { limb([[ex - 8, ey - 8], [ex + 8, ey + 8]], 4, BULL.eye, false); limb([[ex - 8, ey + 8], [ex + 8, ey - 8]], 4, BULL.eye, false); }
  const brow = o.brow ?? 1;
  if (brow > 0) limb([[ex - 18, ey - 20 - 6 * brow], [ex + 16, ey - 16 + 4 * brow]], 8, BULL.hideSh, false);
  if (tired > 0.05) fill(smoothPath([[50, 66], [64, 66], [66, 66 + 34 * tired], [56, 74 + 34 * tired], [48, 66 + 30 * tired]]), BULL.tongue);
  g.restore();
  g.restore();
  // world positions of the nose and the horn tip
  const W = ([x, y]) => [o.x + face * s * x * (1 - 0.12 * sq), (o.y ?? 0) + s * y * (1 + 0.1 * sq)];
  const rot = ([x, y]) => [hx + x * Math.cos(ha) - y * Math.sin(ha), hy + x * Math.sin(ha) + y * Math.cos(ha)];
  return { nose: W(rot([84, 46])), horn: W(rot([34, -108])), head: W([hx, hy]) };
}

// breath: two puffs from the nostrils that drift and fade (u 0…1 through one puff)
export function steam(p, face, s, u) {
  if (u <= 0 || u >= 1) return;
  for (let i = 0; i < 3; i++) {
    const k = clamp(u * 1.4 - i * 0.15);
    if (k <= 0 || k >= 1) continue;
    ell(p[0] + face * (20 + 60 * k) * s, p[1] + (10 - 20 * k + i * 6) * s, (10 + 26 * k) * s, (8 + 18 * k) * s, 'rgba(255,255,255,0.55)', 0, 1 - k);
  }
}
// cartoon stars circling over a dazed head
export function stars(p, s, t, k = 1) {
  if (k <= 0.01) return;
  for (let i = 0; i < 4; i++) {
    const a = t * 5 + i * TAU / 4, x = p[0] + Math.cos(a) * 70 * s, y = p[1] - 70 * s + Math.sin(a) * 18 * s;
    g.save(); g.translate(x, y); g.rotate(a); g.globalAlpha *= k;
    const r = 16 * s, pts = [];
    for (let j = 0; j < 10; j++) { const rr = j % 2 ? r * 0.45 : r, aa = j * TAU / 10 - Math.PI / 2; pts.push([Math.cos(aa) * rr, Math.sin(aa) * rr]); }
    fill(polyPath(pts), '#ffd23f');
    g.restore();
  }
}
