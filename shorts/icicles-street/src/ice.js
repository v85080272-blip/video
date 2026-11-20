// «Сосульки, ты на улице»: the street in section — an old two-storey house on the left (its wall face at x = WALL),
// the roof's eave sticking out over the pavement with a snow cornice and icicles, a drainpipe with a fat icicle at its
// mouth, the pavement with ice mounds, the road and a winter sky; the snow and ice coming down, the cloud of powder.
// World units: the pavement at y = 0, up is negative.
import { lerp, clamp, ease, hash, noise, TAU } from './lib.js';
import { g, ell, limb, rect, rrect, poly, fill, smoothPath, polyPath, rrPath } from './flat.js';

export const WALL = -260;                                    // the wall's face
export const EAVE = { y: -900, x1: -90 };                    // the eave: its underside at y, its edge at x1
export const PIPE = { x: -330 };                             // the drainpipe, on the wall face... drawn in front of it
export const MOUNDS = [[260, 0], [520, 0]];
export const FALL_X = [-60, 120];                            // where the snow lands: just past the eave's edge
export function street(t, o = {}) {
  // the sky and the far side of the street
  const sky = g.createLinearGradient(0, -2400, 0, 0); sky.addColorStop(0, '#9fb8d6'); sky.addColorStop(1, '#e6eef5'); g.fillStyle = sky; g.fillRect(-2000, -2600, 4000, 2700);
  for (let i = 0; i < 6; i++) rect(200 + i * 260, -700 - 300 * hash(i), 220, 700 + 300 * hash(i), '#c9d2dc');
  for (let i = 0; i < 6; i++) for (let r = 0; r < 4; r++) rect(230 + i * 260, -620 - r * 140 - 300 * hash(i) + 300 * hash(i), 40, 60, '#aab8c6');
  // the road and the pavement with its kerb
  rect(-2000, 0, 4000, 700, '#d9dde2'); rect(600, 0, 1400, 700, '#8f969e'); rect(560, 0, 50, 30, '#c9cdd3');
  for (let i = 0; i < 12; i++) ell(-1000 + i * 170 + 40 * hash(i), 30 + 40 * hash(i * 3), 60, 10, '#eef2f6');
  // the house: the wall (old plaster), two rows of windows, the eave with the snow on the roof and its cornice
  const wl = polyPath([[-2000, EAVE.y], [WALL, EAVE.y], [WALL, 0], [-2000, 0]]); fill(wl, '#d8b48c');
  rect(WALL - 18, EAVE.y, 18, -EAVE.y, 'rgba(0,0,0,0.12)');
  for (const wy of [-780, -380]) for (const wx of [-1200, -800]) { rect(wx - 90, wy, 180, 240, '#f4efe4'); rect(wx - 78, wy + 12, 156, 216, '#5d7a96'); rect(wx - 4, wy + 12, 8, 216, '#f4efe4'); }
  rect(-2000, -40, WALL + 2000, 40, '#a88a6a');
  fill(polyPath([[-2000, EAVE.y], [EAVE.x1, EAVE.y], [EAVE.x1 + 40, EAVE.y - 40], [-2000, EAVE.y - 300]]), '#7a4a3a');
  const cr = o.crack ?? 0, gone = clamp(o.gone ?? 0);
  // the snow on the roof: a thick cornice hanging over the edge (it breaks away: gone 0…1)
  fill(smoothPath([[-2000, EAVE.y - 300], [-600, EAVE.y - 170], [EAVE.x1 - 40, EAVE.y - 90], [EAVE.x1 + (gone > 0.5 ? 30 : 110), EAVE.y - 40], [EAVE.x1 + (gone > 0.5 ? 20 : 90), EAVE.y + 10], [-2000, EAVE.y - 230]]), '#f7fbff');
  if (cr > 0.01) { g.save(); g.globalAlpha = cr; g.lineWidth = 4; g.strokeStyle = '#7d8fa3'; g.beginPath(); g.moveTo(EAVE.x1 - 40, EAVE.y - 100); g.lineTo(EAVE.x1 - 10, EAVE.y - 70); g.lineTo(EAVE.x1 - 30, EAVE.y - 40); g.lineTo(EAVE.x1, EAVE.y - 10); g.stroke(); g.restore(); }
  // icicles along the eave's edge
  for (let i = 0; i < 6; i++) { if (gone > 0.5 && i < 4) continue; const x = EAVE.x1 - 20 - i * 60, L = 50 + 70 * hash(i * 4.1); fill(polyPath([[x - 10, EAVE.y + 4], [x + 10, EAVE.y + 4], [x, EAVE.y + L]]), '#d6ecfa'); }
  // the drainpipe down the wall's face (seen in section: drawn just in front of it) with the fat icicle at its mouth
  rect(PIPE.x - 16, EAVE.y + 10, 32, -EAVE.y - 160, '#8a9096'); fill(polyPath([[PIPE.x - 16, -150], [PIPE.x + 16, -150], [PIPE.x + 60, -110], [PIPE.x + 20, -110]]), '#8a9096');
  fill(polyPath([[PIPE.x + 20, -110], [PIPE.x + 60, -110], [PIPE.x + 40, -10]]), '#d6ecfa');
  for (let i = 0; i < 4; i++) fill(polyPath([[PIPE.x - 30 - i * 26, EAVE.y + 6], [PIPE.x - 14 - i * 26, EAVE.y + 6], [PIPE.x - 22 - i * 26, EAVE.y + 120 + 60 * hash(i + 9)]]), '#d6ecfa');
  if (o.pipeMark) { g.save(); g.globalAlpha = o.pipeMark; g.lineWidth = 8; g.strokeStyle = '#e53935'; g.setLineDash([18, 12]); g.strokeRect(PIPE.x - 120, EAVE.y - 40, 240, -EAVE.y + 60); g.restore(); }
  // the ice mounds on the pavement (marked: ring 0…1)
  for (const [mx] of MOUNDS) {
    fill(smoothPath([[mx - 70, 0], [mx - 40, -26], [mx, -38], [mx + 44, -24], [mx + 70, 0]]), '#e6f2fb');
    for (let i = 0; i < 3; i++) ell(mx - 30 + i * 30, -10 - 8 * hash(i + mx), 10, 6, '#cfe4f4');
    if (o.ring > 0.01) { g.save(); g.globalAlpha = o.ring; g.lineWidth = 7; g.strokeStyle = '#ffd23f'; const pz = 1 + 0.05 * Math.sin(t * 8); g.beginPath(); g.ellipse(mx, -16, 110 * pz, 44 * pz, 0, 0, TAU); g.stroke(); g.restore(); }
  }
}
// the snow and ice coming down past the eave's edge: k 0…1 through the fall (0 = breaking away, 1 = landed)
export function avalanche(t, k) {
  if (k <= 0.01) return;
  const fall = ease.in(clamp(k / 0.6));
  const y = lerp(EAVE.y - 30, -40, fall);
  if (k < 0.6) {
    fill(smoothPath([[FALL_X[0], y - 80], [FALL_X[0] + 60, y - 120], [FALL_X[1], y - 90], [FALL_X[1] + 30, y], [FALL_X[0] + 20, y + 30]]), '#f7fbff');
    for (let i = 0; i < 5; i++) { const cx = lerp(FALL_X[0], FALL_X[1], hash(i)), cy = y - 60 - 120 * hash(i * 3); fill(polyPath([[cx - 14, cy], [cx + 16, cy - 8], [cx + 6, cy + 20]]), '#d6ecfa'); }
  } else {
    const u = clamp((k - 0.6) / 0.4);
    fill(smoothPath([[FALL_X[0] - 60, 0], [FALL_X[0], -60], [(FALL_X[0] + FALL_X[1]) / 2, -90], [FALL_X[1] + 20, -50], [FALL_X[1] + 90, 0]]), '#f7fbff');
    for (let i = 0; i < 8; i++) { const a = -Math.PI * hash(i * 2.3), d = 120 + 260 * u; g.save(); g.globalAlpha = 0.7 * (1 - u); ell((FALL_X[0] + FALL_X[1]) / 2 + Math.cos(a) * d, -40 + Math.sin(a) * d * 0.6, 60 + 80 * u, 40 + 50 * u, '#ffffff'); g.restore(); }
  }
}
