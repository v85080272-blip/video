// The places of «Правда или миф», №10 «Гололёд» in flat shapes, straight in screen space; each subject sits near x = 540
// so that a 352-px column shows it. A winter street (grey-blue sky, far houses, an icy pavement with glare, snowbanks,
// falling snow); a person in a red winter coat, hat and scarf who walks (big or small steps, hands in the pockets or out
// for balance), slips (tilts back, a leg up, the arms thrown straight out) or lies tucked on the side; a penguin that
// waddles along; a house seen from the side with an eave, icicles, a snow cap and a canopy over the door.
import { lerp, clamp, TAU, hash } from './lib.js';
import { g, ell, limb, rect, rrect, fill, poly, smoothPath } from './flat.js';
import { text, FONTS, INK } from './type.js';

export const FLOOR = 1000;
const SKIN = '#f2c19b', SKIN_D = '#d9a07a', HAIR = '#4a2f22', COAT = '#d84a3a', COAT_D = '#b03628', SCARF = '#ffd23f', HAT = '#3f7fd8',
  JEANS = '#2c3550', BOOT = '#1f2230', MITT = '#3f7fd8';
function grad(stops, y0 = 0, y1 = 1920, x0 = -400, x1 = 1480) { const gr = g.createLinearGradient(0, y0, 0, y1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); g.fillStyle = gr; g.fillRect(x0, y0, x1 - x0, y1 - y0); }
// a winter street: o.houses (far houses on the horizon), snow falling
export function street(t, o = {}) {
  grad([[0, '#b9d3ea'], [1, '#eaf3fa']], 0, FLOOR - 120);
  if (o.houses !== false) for (let i = 0; i < 7; i++) {
    const x = -160 + i * 210, h = 300 + 120 * hash(i + 2);
    rect(x, FLOOR - 120 - h, 170, h, i % 2 ? '#c7d3df' : '#d4dee8');
    for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (FLOOR - 150 - h + 40 + r * 60 < FLOOR - 160) rect(x + 22 + c * 50, FLOOR - 120 - h + 30 + r * 60, 26, 30, hash(i * 9 + r * 3 + c) > 0.6 ? '#ffe7a8' : '#9fb3c6');
    rect(x - 6, FLOOR - 126 - h, 182, 14, '#ffffff');
  }
  fill(smoothPath([[-400, FLOOR - 130], [1480, FLOOR - 120], [1480, FLOOR - 70], [-400, FLOOR - 60]]), '#f6fbff');   // the snowbank
  grad([[0, '#cfe6f5'], [1, '#a9cfe8']], FLOOR - 80, 1920);                                                            // the icy pavement
  for (let i = 0; i < 9; i++) { const x = -60 + i * 140; limb([[x, FLOOR + 40 + 18 * (i % 3)], [x + 90, FLOOR + 30 + 18 * (i % 3)]], 6, 'rgba(255,255,255,0.75)', false); }
  snowfall(t);
}
export function snowfall(t, n = 40) {
  for (let i = 0; i < n; i++) { const x = (hash(i) * 1300 + 30 * Math.sin(t * 0.8 + i)) % 1200 - 60, y = (hash(i + 50) * 1920 + t * (60 + 40 * hash(i + 9))) % 1300; ell(x, y, 6 + 4 * hash(i + 3), 6 + 4 * hash(i + 3), '#ffffff', 0, 0.85); }
}
// the person, feet at (x, y), ≈ 400·s tall, facing right (face 1) or left (-1).
// o.walk 0…1 + o.ph: walking; o.small 0…1: small «penguin» steps, the whole foot down; o.pockets 0…1: hands in the
// pockets; o.balance 0…1: hands a little out to the sides; o.slip 0…1: tilting back, the front leg up; o.out 0…1: the
// arms thrown straight out to catch the fall; o.run 0…1: running; o.flat 0…1: pressed to a wall (straight, arms down)
export function walker(x, y, s, t, o = {}) {
  const f = o.face ?? 1, walk = clamp(o.walk ?? 0), run = clamp(o.run ?? 0), small = clamp(o.small ?? 0), slip = clamp(o.slip ?? 0);
  const ph = (o.ph ?? t * (1.6 + 1.2 * run)) * TAU, amp = lerp(0.42, 0.14, small) * walk + 0.7 * run;
  g.save(); g.translate(x, y); g.scale(s * f, s);
  g.translate(-40 * slip, 0); g.rotate(-0.75 * slip + 0.15 * run); g.translate(0, -12 * slip);
  const legA = k => amp * Math.sin(ph + k);
  [[Math.PI, '#232b42'], [0, JEANS]].forEach(([k, c], j) => {
    const a = legA(k) + (j === 1 ? 1.2 * slip : -0.15 * slip);
    const foot = [Math.sin(a) * 170, -170 + Math.cos(a) * 170], knee = [foot[0] * 0.5 + 10 * (walk + run), (foot[1] - 180) * 0.5 - 10];
    limb([[0, -180], knee, foot], 34, c, false); ell(foot[0] + 16 * (1 - slip), foot[1] + 4, 32, 15, BOOT, 0.4 * slip * (j ? 1 : 0));
  });
  rrect(-52, -340, 104, 190, 34, COAT); rect(-4, -330, 8, 170, COAT_D); rect(-52, -176, 104, 14, COAT_D);
  const out = clamp(o.out ?? 0), pockets = clamp(o.pockets ?? 0) * (1 - out), bal = clamp(o.balance ?? 0) * (1 - out), flat = clamp(o.flat ?? 0);
  const arm = (k, back) => {
    const sh = [back ? -28 : 28, -312];
    const swing = (walk * 0.5 * (1 - small) + run * 0.9) * Math.sin(ph + k) * (1 - pockets) * (1 - flat);
    let hand = [sh[0] + Math.sin(swing) * 150, sh[1] + Math.cos(swing) * 150];
    if (bal > 0) hand = [lerp(hand[0], sh[0] + (back ? -70 : 90), bal), lerp(hand[1], sh[1] + 120, bal)];
    if (pockets > 0) hand = [lerp(hand[0], back ? -30 : 34, pockets), lerp(hand[1], -190, pockets)];
    if (out > 0) { const a = lerp(0, back ? -2.0 : -2.3, out); hand = [lerp(hand[0], sh[0] + Math.sin(a) * 165, out), lerp(hand[1], sh[1] + Math.cos(a) * 165, out)]; }
    const el = [lerp(sh[0], hand[0], 0.5) + (back ? -10 : 10) * (1 - out), lerp(sh[1], hand[1], 0.5) + 8 * (1 - out)];
    limb([sh, el, hand], 30, back ? COAT_D : COAT, false);
    if (pockets < 0.6) ell(hand[0], hand[1], 19, 19, MITT);
    return hand;
  };
  const hb = arm(Math.PI, true);
  const hy = -400;
  ell(0, hy, 54, 60, SKIN);
  fill(smoothPath([[-58, hy - 10], [-50, hy - 62], [0, hy - 82], [50, hy - 62], [58, hy - 10], [0, hy - 30]]), HAT); ell(0, hy - 86, 22, 22, '#ffffff');
  rrect(-50, -352, 100, 30, 14, SCARF);
  ell(24, hy - 4, 8 + 4 * slip, 10 + 4 * slip, '#ffffff'); ell(26, hy - 4, 5, 6, INK);
  if (slip > 0.3) ell(40, hy + 32, 10, 12, '#a05a4a'); else limb([[34, hy + 30], [48, hy + 28]], 5, '#a05a4a', false);
  const hf = arm(0, false);
  g.restore();
  // the hands in screen space (for the marks on the wrists)
  const M = (p) => { const r = -0.75 * slip + 0.15 * run, px = p[0] * s, py = p[1] * s - 12 * slip * s; return [x + f * (Math.cos(r) * px - Math.sin(r) * py - 40 * slip * s), y + Math.sin(r) * px + Math.cos(r) * py]; };
  return { hands: [M(hb), M(hf)] };
}
// lying tucked on the side: knees up, chin down, the arms in front of the chest
export function tucked(x, y, s) {
  g.save(); g.translate(x, y); g.scale(s, s);
  ell(0, -60, 150, 64, COAT); rect(-150, -70, 300, 12, COAT_D);
  limb([[90, -50], [170, -110], [230, -40]], 34, JEANS, false); limb([[70, -30], [150, -70], [210, -10]], 34, '#232b42', false);
  ell(240, -30, 32, 15, BOOT); ell(220, -4, 32, 15, BOOT);
  ell(-170, -96, 56, 52, SKIN); fill(smoothPath([[-226, -100], [-210, -150], [-160, -160], [-120, -130], [-140, -110]]), HAT);
  rrect(-140, -96, 50, 60, 20, SCARF);
  limb([[-80, -80], [-60, -20], [-120, -20]], 28, COAT_D, false); ell(-126, -20, 18, 18, MITT);
  limb([[-186, -100], [-168, -98]], 5, INK, false);
  g.restore();
}
// a penguin, feet at (x, y), waddling while walk > 0
export function penguin(x, y, s, t, walk = 1) {
  g.save(); g.translate(x, y); g.rotate(0.12 * walk * Math.sin(t * 7)); g.scale(s, s);
  ell(-26, -6, 30, 12, '#ff9f1c'); ell(26, -6, 30, 12, '#ff9f1c');
  ell(0, -130, 92, 130, '#1d2433'); ell(10, -110, 64, 104, '#ffffff');
  limb([[-74, -170], [-118, -90]], 26, '#1d2433', false); limb([[80, -170], [120, -96]], 26, '#1d2433', false);
  ell(0, -262, 70, 66, '#1d2433'); ell(28, -270, 14, 16, '#ffffff'); ell(32, -268, 7, 9, INK);
  poly([[56, -256], [104, -246], [56, -236]], '#ff9f1c');
  g.restore();
}
// footprints: n small steps along the pavement up to x
export function steps(x0, x1, y, n, k, small = true) {
  const m = Math.floor(n * clamp(k));
  for (let i = 0; i < m; i++) { const x = lerp(x0, x1, i / Math.max(1, n - 1)); ell(x, y + (i % 2 ? 10 : -6), small ? 16 : 22, 8, 'rgba(60,90,120,0.45)'); }
}
// a house seen from the side: the wall up to x = wx, the eave out to wx + 130 at y = ey with a snow cap and icicles, a
// canopy over the door (y = cy, out to wx + cw). o.crack 0…1: cracks in the snow cap; o.cap 0…1: how much of the cap is
// left (it slides off); returns the canopy's edge.
export const HOUSE = { wx: 430, ey: 300, cy: 500, cw: 190 };
export function house(t, o = {}) {
  const { wx, ey, cy, cw } = HOUSE;
  rect(-400, 120, wx + 400, FLOOR - 120 + 10, '#e8c9a3');
  for (let r = 0; r < 4; r++) rect(-400, 180 + r * 200, wx + 400, 8, '#d9b58b');
  rect(wx - 160, cy + 40, 120, FLOOR - cy - 40, '#7a5232'); ell(wx - 60, (cy + FLOOR) / 2 + 40, 8, 8, '#ffd23f');                    // the door
  rrect(wx - 340, 360, 120, 150, 8, '#bfe3f5'); rect(wx - 284, 360, 8, 150, '#ffffff');
  poly([[-400, 120], [wx + 130, ey], [wx + 130, ey + 26], [-400, 146]], '#8d6e63');                                              // the roof and the eave
  const cap = clamp(o.cap ?? 1);
  if (cap > 0.02) fill(smoothPath([[-400, 96], [wx + 130 * cap, ey - 18], [wx + 140 * cap, ey + 4], [-400, 130]]), '#ffffff');
  for (let i = 0; i < 6; i++) { const ix = wx + 10 + i * 22, L = 50 + 40 * hash(i + 7); if (ix < wx + 130 * Math.max(cap, 0.7)) poly([[ix - 9, ey + 24], [ix + 9, ey + 24], [ix, ey + 24 + L]], '#e3f4ff'); }
  const cr = clamp(o.crack ?? 0);
  if (cr > 0.01) { g.save(); g.globalAlpha = cr; limb([[wx - 40, ey - 30], [wx - 10, ey - 6], [wx + 20, ey - 26], [wx + 50, ey - 4]], 6, '#5a7590', false); g.restore(); }
  rect(wx, cy - 6, cw, 22, '#5d4037'); poly([[wx, cy + 16], [wx + 60, cy + 16], [wx, cy + 70]], '#5d4037');                    // the canopy
  if (o.canopySnow) fill(smoothPath([[wx, cy - 6], [wx + cw * 0.5, cy - 30], [wx + cw, cy - 8]]), '#ffffff');
  return [wx + cw, cy];
}
// a block of snow and ice falling from the eave: k 0…1 along an arc to (x1, FLOOR); then a snow pile and a puff
export function fallingSnow(k, x1 = 680, burst = 0) {
  const { wx, ey } = HOUSE;
  if (k > 0 && k < 1) {
    const x = lerp(wx + 120, x1, k), y = lerp(ey - 10, FLOOR - 30, k * k);
    g.save(); g.translate(x, y); g.rotate(k * 2.4); ell(0, 0, 70, 46, '#ffffff'); ell(-20, -10, 30, 20, '#e3f4ff'); poly([[30, 20], [44, 20], [37, 70]], '#e3f4ff'); g.restore();
  }
  if (k >= 1) {
    fill(smoothPath([[x1 - 110, FLOOR + 10], [x1 - 60, FLOOR - 50], [x1 + 10, FLOOR - 70], [x1 + 80, FLOOR - 40], [x1 + 120, FLOOR + 10]]), '#ffffff');
    if (burst > 0 && burst < 1) for (let i = 0; i < 10; i++) { const a = -Math.PI * (0.1 + 0.8 * i / 9); ell(x1 + Math.cos(a) * 140 * burst, FLOOR - 40 + Math.sin(a) * 110 * burst, 16 * (1 - burst) + 4, 16 * (1 - burst) + 4, '#ffffff'); }
  }
}
// «ТРЕСК!» by the roof
export function crackText(x, y, k, t) {
  if (k <= 0.01) return;
  g.save(); g.globalAlpha = Math.min(1, k * 2); g.translate(x + 3 * Math.sin(t * 45), y); g.rotate(-0.1); g.scale(k, k);
  text('ТРЕСК!', 0, 0, 64, '#e53935', { fam: FONTS.block }); g.restore();
}
// a «crack» mark on a wrist: a yellow lightning in a red ring (no blood: just the sign of a break)
export function wristMark(x, y, k) {
  if (k <= 0.01) return;
  g.save(); g.translate(x, y); g.scale(k, k);
  g.lineWidth = 9; g.strokeStyle = '#e53935'; g.beginPath(); g.arc(0, 0, 48, 0, TAU); g.stroke();
  poly([[8, -34], [-18, 4], [0, 4], [-10, 34], [20, -6], [2, -6]], '#ffd23f');
  g.restore();
}
