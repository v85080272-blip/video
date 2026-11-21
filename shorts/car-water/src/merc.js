// «Разбился градусник, ты дома»: the thermometer (whole, falling, broken), the mercury beads on the floor, the glass
// shards, a vacuum cleaner, the open window's cold air, the jar of water with its lid, a damp paper towel, a torch with
// its beam and the glint of the beads in it. World units as in smoke.js: the floor at y = 0.
import { lerp, clamp, ease, hash, noise, TAU } from './lib.js';
import { g, ell, limb, rect, rrect, poly, fill, smoothPath, polyPath, rrPath } from './flat.js';
import { text, FONTS, INK } from './type.js';

export const SPOT = [70, -6];                               // where it breaks
// the beads: a few big ones and many small; each [dx, size, delay]
const BEADS = Array.from({ length: 16 }, (_, i) => [(hash(i * 3.7) - 0.4) * 300, i < 5 ? 10 + 5 * hash(i) : 4 + 4 * hash(i * 5.1), hash(i * 2.3) * 0.6]);
export const beadPos = i => [SPOT[0] + BEADS[i][0], SPOT[1] - BEADS[i][1] * 0.5];
// the thermometer in a hand or in the air at p, angle a
export function thermometer(p, a = 0, s = 1) {
  g.save(); g.translate(p[0], p[1]); g.rotate(a); g.scale(s, s);
  rrect(-8, -70, 16, 140, 8, 'rgba(225,238,248,0.95)'); g.lineWidth = 2; g.strokeStyle = '#9fb3c4'; g.stroke(rrPath(-8, -70, 16, 140, 8));
  limb([[0, 52], [0, -30]], 4, '#b9c2cc'); ell(0, 58, 7, 9, '#c9d0d8');
  for (let i = 0; i < 8; i++) limb([[-7, -55 + i * 12], [-2, -55 + i * 12]], 1.5, '#5d6570');
  g.restore();
}
// on the floor: the shards; the beads rolled out (roll 0…1), scattered into tiny ones (split 0…1), collected (gone 0…1 of them)
export function spill(t, o = {}) {
  const roll = clamp(o.roll ?? 1), gone = o.gone ?? 0;
  // the shards
  for (let i = 0; i < 5; i++) { const x = SPOT[0] - 40 + i * 20, r = (hash(i * 9) - 0.5) * 1.2; g.save(); g.translate(x, -6); g.rotate(r); fill(polyPath([[-10, 0], [12, -3], [4, -9]]), 'rgba(220,235,248,0.95)'); g.restore(); }
  for (let i = 0; i < BEADS.length; i++) {
    if (i / BEADS.length < gone) continue;
    const [dx, sz, dl] = BEADS[i], u = ease.out(clamp((roll - dl * 0.5) / 0.6));
    if (u <= 0.01) continue;
    const x = SPOT[0] + dx * u, y = SPOT[1] - sz * 0.5;
    bead(x, y, sz * (o.split ? lerp(1, 0.55, o.split) : 1));
    if (o.split > 0.01) for (let k = 0; k < 3; k++) bead(x + (k - 1) * 22 * o.split + 6 * Math.sin(i + k), y - 2, sz * 0.4 * o.split);
  }
}
function bead(x, y, r) {
  const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.35, '#d7dde3'); gr.addColorStop(1, '#7d8792');
  g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, r, r * 0.8, 0, 0, TAU); g.fill();
}
// the glints in the torch's beam: little four-point stars over the beads that are left
export function glints(t, k, gone = 0) {
  if (k <= 0.01) return;
  for (let i = 0; i < BEADS.length; i++) {
    if (i / BEADS.length < gone) continue;
    const [x, y] = beadPos(i), tw = 0.5 + 0.5 * Math.sin(t * 9 + i * 1.7), r = (14 + 10 * tw) * k;
    g.save(); g.globalAlpha = k * (0.6 + 0.4 * tw); g.translate(x, y - 4);
    fill(polyPath([[0, -r], [r * 0.18, -r * 0.18], [r, 0], [r * 0.18, r * 0.18], [0, r], [-r * 0.18, r * 0.18], [-r, 0], [-r * 0.18, -r * 0.18]]), '#ffffff');
    g.restore();
  }
}
// a canister vacuum cleaner on the floor at x, its hose up to the hand at p
export function vacuum(x, p) {
  rrect(x - 70, -90, 140, 86, 34, '#3c7ad6'); ell(x - 40, -6, 14, 14, '#2b2f38'); ell(x + 40, -6, 14, 14, '#2b2f38'); rect(x - 30, -80, 60, 12, '#2a5aa8');
  limb([[x + 60, -60], [x + 110, -120], p], 12, '#3b3f48', true);
}
// a glass jar on the floor at x: water inside; lid 0…1 coming on; towel 0…1 the paper towel inside
export function jar(x, k = 1, lid = 0, towel = 0) {
  if (k <= 0.01) return;
  g.save(); g.translate(x, 0); g.scale(k, k);
  fill(rrPath(-40, -110, 80, 110, 14), 'rgba(200,225,240,0.55)');
  fill(rrPath(-36, -70, 72, 66, 10), 'rgba(110,170,220,0.7)');
  if (towel > 0.01) { g.save(); g.globalAlpha = towel; rrect(-22, -60, 44, 40, 6, '#f4f4ee'); ell(-6, -36, 6, 5, '#d7dde3'); ell(10, -46, 4, 3, '#d7dde3'); g.restore(); }
  g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,0.8)'; g.stroke(rrPath(-40, -110, 80, 110, 14));
  const ly = lerp(-170, -118, ease.out(clamp(lid)));
  if (lid > 0.01) { g.save(); g.globalAlpha = clamp(lid * 3); rrect(-44, ly, 88, 18, 6, '#d63a2f'); g.restore(); }
  g.restore();
}
// a damp paper towel in the hand at p
export function towel(p) { g.save(); g.translate(p[0], p[1]); g.rotate(0.2); rrect(-30, -24, 60, 48, 6, '#f4f4ee'); ell(-6, 0, 18, 12, '#d9e6ee', 0, 0.8); g.restore(); }
// a torch in the hand at p pointing at angle a; its beam to the floor
export function torch(p, a, k = 1) {
  if (k > 0.01) {
    const L = 900, sp = 0.32, x = p[0], y = p[1];
    const gr = g.createLinearGradient(x, y, x + Math.cos(a) * L, y + Math.sin(a) * L);
    gr.addColorStop(0, `rgba(255,246,200,${0.55 * k})`); gr.addColorStop(1, 'rgba(255,246,200,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(x, y);
    g.lineTo(x + Math.cos(a - sp) * L, y + Math.sin(a - sp) * L); g.lineTo(x + Math.cos(a + sp) * L, y + Math.sin(a + sp) * L); g.closePath(); g.fill();
  }
  g.save(); g.translate(p[0], p[1]); g.rotate(a); rrect(-60, -14, 70, 28, 8, '#2b2f38'); rrect(4, -18, 22, 36, 6, '#3b3f48'); ell(26, 0, 6, 16, '#fff6c8'); g.restore();
}
// the window opened: a cold-air swirl from it (k 0…1); drawn after the room
export function coldAir(t, x0, x1, y0, y1, k) {
  if (k <= 0.01) return;
  g.save(); g.lineWidth = 6; g.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const ph = (t * 0.6 + i / 4) % 1, y = lerp(y0 + 40, y1 - 20, i / 3), xs = lerp(x0, x0 - 260, ph);
    g.strokeStyle = `rgba(160,210,255,${k * (1 - ph) * 0.8})`;
    g.beginPath(); for (let j = 0; j <= 12; j++) { const xx = xs + j * 18, yy = y + 10 * Math.sin(j * 0.8 + t * 4 + i); j ? g.lineTo(xx, yy) : g.moveTo(xx, yy); } g.stroke();
  }
  g.restore();
}
