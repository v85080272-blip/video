// The places of «Правда или миф», №8 «Первая помощь» in flat shapes, straight in screen space; each subject sits near
// x = 540 so that a 352-px column shows it. A light room; a big head in profile that tilts back (blood runs down the
// throat) or forward (a hand pinches the nose, «10 МИН»); a hand with a burn under oil or under the tap («20 МИН»); a
// person lying on the floor with the legs up on a stool, the blood going back to the head, a phone with 112.
import { lerp, clamp, TAU } from './lib.js';
import { g, ell, limb, rect, rrect, fill, poly, smoothPath, polyPath, rrPath } from './flat.js';
import { text, FONTS, INK } from './type.js';

export const FLOOR = 1180;
const SKIN = '#f6c9a8', SKIN_D = '#e2a882', HAIR = '#5b3a29', RED = '#d62828';
function grad(stops, y0 = 0, y1 = 1920, x0 = -400, x1 = 1480) { const gr = g.createLinearGradient(0, y0, 0, y1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); g.fillStyle = gr; g.fillRect(x0, y0, x1 - x0, y1 - y0); }
// a light room: wall, a window, tiles, the floor
export function room(t, o = {}) {
  grad([[0, o.wall ?? '#e8f1f7'], [1, o.wall2 ?? '#d6e4ee']], 0, FLOOR);
  for (let r = 0; r < 6; r++) for (let c = -2; c < 12; c++) rect(c * 110 + (r % 2) * 55, 720 + r * 76, 104, 70, (r + c) % 2 ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.15)');
  rrect(-260, 140, 300, 380, 16, '#ffffff'); rect(-246, 154, 272, 352, '#bfe3f5'); rect(-118, 154, 8, 352, '#ffffff');
  grad([[0, '#c9a477'], [1, '#a8845a']], FLOOR, 1920);
}
// a timer badge: «10 МИН»
export function timer(x, y, str, k = 1) {
  if (k <= 0.01) return;
  g.save(); g.translate(x, y); g.scale(k, k);
  ell(6, 8, 92, 92, INK); ell(0, 0, 92, 92, '#ffffff'); ell(0, 0, 78, 78, '#e3f2fd');
  limb([[0, 0], [0, -52]], 9, INK, false); limb([[0, 0], [36, 14]], 9, INK, false);
  rrect(-84, 64, 168, 60, 16, INK); text(str, 0, 108, 40, '#ffffff', { fam: FONTS.block, shadow: false });
  g.restore();
}
// 1 — a big head in profile, facing right: tilt < 0 back, > 0 forward; drip 0…1 a drop at the nostril; throat 0…1 the
// blood running down inside; pinch 0…1 two fingers on the soft part of the nose
export function head(t, o = {}) {
  const cx = 520, cy = 640, r = 210;
  rect(cx - 110, cy + 120, 220, 330, SKIN_D); rrect(cx - 260, cy + 360, 520, 420, 120, '#4f8fd6');          // neck, shoulders
  g.save(); g.translate(cx, cy + 150); g.rotate(o.tilt ?? 0); g.translate(-cx, -(cy + 150));
  ell(cx, cy, r, r * 1.08, SKIN);
  fill(smoothPath([[cx - r - 6, cy - 10], [cx - r + 10, cy - r * 0.8], [cx - 40, cy - r * 1.18], [cx + r * 0.8, cy - r * 0.8], [cx + r * 0.7, cy - r * 0.45], [cx + 20, cy - r * 0.62], [cx - 90, cy - r * 0.2], [cx - 120, cy + 60]]), HAIR);
  ell(cx - 40, cy + 10, 38, 50, SKIN_D);                                                                  // ear
  const nx = cx + r - 6, ny = cy + 20;
  poly([[nx - 10, ny - 70], [nx + 58, ny + 22], [nx - 6, ny + 30]], SKIN); limb([[nx - 6, ny - 60], [nx + 52, ny + 20], [nx + 8, ny + 26]], 5, SKIN_D);
  ell(cx + 110, cy - 50, 16, 20, INK); limb([[cx + 86, cy - 92], [cx + 140, cy - 100]], 8, HAIR);       // eye, brow
  limb([[cx + 120, cy + 110], [cx + 170, cy + 104]], 6, '#a05a4a');                                      // mouth
  const d = o.drip ?? 0;
  if (d > 0) { const u = (t * 1.4) % 1; fill(smoothPath([[nx + 6, ny + 30], [nx + 16, ny + 46 + 40 * u], [nx + 6, ny + 58 + 40 * u], [nx - 4, ny + 46 + 40 * u]]), RED, d); ell(nx + 4, ny + 34, 10, 8, RED, 0, d); }
  const th = o.throat ?? 0;
  if (th > 0) {                                                                                           // inside: nose → throat
    g.save(); g.globalAlpha = th; g.setLineDash([22, 14]); g.lineWidth = 16; g.strokeStyle = RED; g.lineCap = 'round';
    g.beginPath(); g.moveTo(nx - 10, ny + 10); g.quadraticCurveTo(cx + 40, cy + 40, cx + 10, cy + 260 * th); g.stroke(); g.setLineDash([]); g.restore();
  }
  const p = o.pinch ?? 0;
  if (p > 0) {                                                                                            // the hand pinching the nose
    g.save(); g.globalAlpha = Math.min(1, p * 2);
    const hx = lerp(nx + 160, nx + 30, p), hy = ny + 6;
    rrect(hx + 20, hy - 40, 150, 90, 40, SKIN); ell(hx, hy - 30, 44, 22, SKIN, -0.2); ell(hx + 4, hy + 34, 44, 22, SKIN, 0.2);
    limb([[hx - 30, hy - 34], [hx + 30, hy - 30]], 3, SKIN_D); limb([[hx - 26, hy + 36], [hx + 34, hy + 30]], 3, SKIN_D);
    rrect(hx + 150, hy - 60, 200, 130, 30, '#4f8fd6');
    g.restore();
  }
  g.restore();
}
// 2 — a big hand with a burn; oil 0…1 the bottle pours oil on it (heat waves); water 0…1 the tap runs over it
export function burnHand(t, o = {}) {
  const x = 540, y = 820;
  rrect(-100, y + 120, 1300, 60, 10, '#ffffff'); rect(-100, y + 180, 1300, FLOOR - y - 180, '#d9c3a3');      // the counter
  g.save(); g.translate(x, y);
  rrect(-260, -40, 420, 200, 90, SKIN); rrect(-470, 0, 260, 140, 50, '#4f8fd6');                          // palm, sleeve
  for (let i = 0; i < 4; i++) { const fy = -30 + i * 46; rrect(120, fy, 190 - Math.abs(i - 1.5) * 26, 40, 20, SKIN); limb([[150, fy + 40], [260 - Math.abs(i - 1.5) * 26, fy + 40]], 3, SKIN_D); }
  ell(40, 60, 70, 44, '#e53935', 0, 0.85); ell(30, 54, 40, 24, '#ff8a80', 0, 0.9);                       // the burn
  g.restore();
  const oil = o.oil ?? 0;
  if (oil > 0) {
    g.save(); g.translate(x + 300, y - 330); g.rotate(-0.9 * oil);
    rrect(-46, -150, 92, 220, 24, '#f9c74f'); rect(-20, -190, 40, 44, '#e0a800'); rrect(-40, -60, 80, 60, 10, '#ffffff'); text('МАСЛО', 0, -22, 24, INK, { fam: FONTS.cond, shadow: false });
    g.restore();
    g.save(); g.globalAlpha = oil;
    for (let i = 0; i < 5; i++) { const u = (t * 2 + i / 5) % 1; ell(lerp(x + 190, x + 60, u), lerp(y - 300, y + 50, u), 12, 16, '#f9c74f'); }
    for (let i = 0; i < 3; i++) { const wx = x - 20 + i * 50, ph = t * 6 + i; limb([[wx, y - 20], [wx + 14 * Math.sin(ph), y - 70], [wx - 14 * Math.sin(ph), y - 120], [wx, y - 170]], 8, '#ff7043'); }
    g.restore();
  }
  const w = o.water ?? 0;
  if (w > 0) {
    g.save(); g.globalAlpha = Math.min(1, w * 2);
    rect(x - 40, 120, 80, 260, '#b0bec5'); rrect(x - 110, 360, 220, 70, 30, '#90a4ae'); rrect(x - 30, 420, 60, 60, 10, '#78909c');   // the tap
    g.restore();
    if (w > 0.3) {
      g.save(); g.globalAlpha = 0.75; fill(rrPath(x - 22, 480, 44, y - 480 + 20, 20), '#4fc3f7');
      for (let i = 0; i < 6; i++) { const u = (t * 3 + i / 6) % 1; ell(x - 30 + 60 * ((i * 37) % 10) / 10, y + 40 + 40 * u, 8, 8, '#81d4fa', 0, 1 - u); }
      g.restore();
    }
  }
}
// 3 — a person lying on the floor; legs 0…1 raised on a stool; flow 0…1 arrows of blood back to the head; phone 0…1
export function faint(t, o = {}) {
  const y = 1000, hx = 220;
  rrect(120, y + 10, 820, 70, 20, '#7e57c2'); rrect(120, y + 10, 820, 18, 9, '#9575cd');           // a mat, high enough to stay clear of the hosts
  const L = o.legs ?? 0;
  if (L > 0.05) { rrect(700, y - 160 * L, 230, 30, 10, '#8d6e63'); rect(720, y - 160 * L + 30, 26, 160 * L, '#6d4c41'); rect(880, y - 160 * L + 30, 26, 160 * L, '#6d4c41'); }
  ell(hx, y - 40, 66, 62, SKIN); fill(smoothPath([[hx - 60, y - 50], [hx - 50, y - 100], [hx + 10, y - 104], [hx + 40, y - 70]]), HAIR);
  limb([[hx + 30, y - 52], [hx + 40, y - 46]], 5, INK);                                                     // closed eye
  rrect(hx + 60, y - 70, 340, 100, 40, '#43a047');                                                        // body
  const kx = 560, ky = y - 40, fx = 860, fy = y - 40 - 170 * L;
  limb([[hx + 380, y - 30], [kx + 60, ky - 40 * L], [fx, fy]], 46, '#37474f', false);                       // the legs
  limb([[hx + 380, y - 4], [kx + 70, ky - 30 * L + 20], [fx + 20, fy + 34]], 46, '#455a64', false);
  ell(fx + 40, fy - 6, 34, 20, '#212121'); ell(fx + 56, fy + 30, 34, 20, '#212121');
  const f = o.flow ?? 0;
  if (f > 0) {
    g.save(); g.globalAlpha = f;
    for (let i = 0; i < 3; i++) { const u = ((t * 0.8 + i / 3) % 1); const px = lerp(fx - 40, hx + 80, u), py = lerp(fy, y - 60, u) - 90; poly([[px - 30, py - 16], [px - 30, py + 16], [px - 62, py]], RED); }
    g.restore();
  }
  const ph = o.phone ?? 0;
  if (ph > 0) { g.save(); g.translate(300, 520); g.scale(ph, ph); g.rotate(-0.1); rrect(-70, -120, 140, 240, 22, '#263238'); rrect(-58, -100, 116, 190, 10, '#4fc3f7'); text('112', 0, 12, 52, '#ffffff', { fam: FONTS.block, shadow: false }); g.restore(); }
}
