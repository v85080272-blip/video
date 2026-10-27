// Things drawn over the world in screen space: the dosimeter close-up and its small gauge, the «film» frame of the
// green-water cliché, the round insets (swimming, inside the body), the 90 % card, the step stamps and the end card.
import { g, W, H, ell, limb, fill, poly, rect, rrect, polyPath, smoothPath, rrPath, inside } from './flat.js';
import { lerp, clamp, ease, spring, bump, hash, noise, TAU, mix, rgba } from './lib.js';
import { text, stamp, pill, measure, FONTS, INK } from './type.js';
import { dosimeter, HUN, fish } from './hunter.js';
import { trefoil } from './world.js';

const sp = (t, t0, f = 2.4, d = 7) => (t <= t0 ? 0 : spring(t - t0, f, d));
const RED = '#ff4d4d', GREEN = '#3e9a4a', CREAM = '#fff3d6';

// a round inset with a rim and a pointer line from a world point (from), k = its pop
export function roundInset(cx, cy, R, k, from, draw) {
  if (k <= 0.01) return;
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  if (from) { limb([from, [lerp(from[0], cx, 0.85), lerp(from[1], cy, 0.85)]], 8, 'rgba(255,243,214,0.75)', false); ell(from[0], from[1], 14, 14, 'rgba(255,243,214,0.75)'); }
  g.translate(cx, cy); g.scale(k, k);
  ell(10, 14, R + 24, R + 24, 'rgba(13,12,22,0.5)');
  ell(0, 0, R + 24, R + 24, INK);
  ell(0, 0, R + 12, R + 12, CREAM);
  g.save(); g.beginPath(); g.arc(0, 0, R, 0, TAU); g.clip();
  draw(R);
  g.restore();
  g.restore();
}

// —— the dosimeter close-up: the device big in a round inset, the bar climbing into red, the lamp blinking ——
export function dosiInset(t, cx, cy, R, k, level, led, from) {
  roundInset(cx, cy, R, k, from, R => {
    rect(-R, -R, 2 * R, 2 * R, '#2b4a5c');
    const jx = 4 * led * noise(t * 50, 2), jy = 4 * led * noise(t * 47, 3);
    g.save(); g.translate(jx, jy + 20); g.rotate(-0.08);
    dosimeter(0, 0, R / 70, led, 0, level);
    g.restore();
    // the clicks as little sound marks around it
    if (led > 0.5) for (let i = 0; i < 3; i++) { const a = -0.9 + i * 0.5 + 0.1 * noise(t * 20, i); limb([[Math.cos(a) * R * 0.7, Math.sin(a) * R * 0.7 - 20], [Math.cos(a) * R * 0.92, Math.sin(a) * R * 0.92 - 20]], 10, '#ffd23f', false); }
  });
}
// —— the dose gauge in the corner: a dosimeter icon and a bar, red when high ——
export function doseHud(t, x, y, k, level, led) {
  if (k <= 0.01) return;
  g.save(); g.setTransform(1, 0, 0, 1, x, y); g.scale(k, k);
  const w = 300, h = 96;
  rrect(-w / 2 + 6, -h / 2 + 8, w, h, 22, 'rgba(13,12,22,0.55)');
  rrect(-w / 2, -h / 2, w, h, 22, '#1f2b2a');
  trefoil(-w / 2 + 50, 0, 30, '#ffd23f');
  const bw = 180, lv = clamp(level), c = lv > 0.6 ? '#ff6a4d' : lv > 0.35 ? '#ffd23f' : '#7be37a';
  rrect(-w / 2 + 96, -16, bw, 32, 10, '#33403f');
  rrect(-w / 2 + 96, -16, Math.max(20, bw * lv), 32, 10, c);
  text('ДОЗА', -w / 2 + 96 + bw / 2, -26, 30, CREAM, { fam: FONTS.cond, shadow: false });
  if (led > 0.5) ell(w / 2 - 14, -h / 2 + 14, 9, 9, RED);
  g.restore();
}

// —— «как в кино»: a film frame round the picture, sprocket holes, a clapperboard tag ——
export function filmFrame(t, k) {
  if (k <= 0.01) return;
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  const bar = 130 * ease.out(clamp(k));
  rect(0, 0, W, bar, '#0d0c16'); rect(0, H - bar, W, bar, '#0d0c16');
  rect(0, 0, 60 * clamp(k), H, '#0d0c16'); rect(W - 60 * clamp(k), 0, 60 * clamp(k), H, '#0d0c16');
  const roll = (t * 600) % 120;
  for (let i = -1; i < 18; i++) {
    const y = i * 120 + roll;
    rrect(14, y, 32, 60, 8, rgba(CREAM, 0.85 * clamp(k))); rrect(W - 46, y, 32, 60, 8, rgba(CREAM, 0.85 * clamp(k)));
  }
  // scratches and a flicker, like an old reel
  for (let i = 0; i < 3; i++) { const x = 100 + ((hash(Math.floor(t * 12) + i) * 900) | 0); limb([[x, 0], [x + 10, H]], 2, rgba(CREAM, 0.25 * clamp(k)), false); }
  g.restore();
}
// —— swimming: his head in the water, gulping it, bubbles ——
export function swimInset(t, cx, cy, R, k, from) {
  roundInset(cx, cy, R, k, from, R => {
    rect(-R, -R, 2 * R, 2 * R, '#9fbccc');
    rect(-R, 10, 2 * R, R, '#517a93');
    const bob = 10 * Math.sin(t * 6);
    g.save(); g.translate(-10, 20 + bob);
    // the head: skin, beard, ushanka, open mouth at the waterline
    ell(0, -40, 70, 66, HUN.skin);
    ell(-20, -8, 50, 34, HUN.beard);
    ell(-34, 0, 18, 14 + 6 * Math.abs(Math.sin(t * 8)), HUN.mouth);
    ell(-58, -34, 18, 15, HUN.nose);
    ell(-30, -58, 14, 18, HUN.eye); ell(-34, -54, 7, 7, HUN.pupil);
    limb([[-48, -82], [-14, -86]], 10, HUN.brow, false);
    fill(smoothPath([[-70, -80], [-60, -130], [-10, -150], [40, -136], [66, -96], [64, -70], [-60, -66]]), HUN.hat);
    fill(smoothPath([[-76, -76], [-70, -100], [0, -106], [70, -96], [74, -70], [0, -64]]), HUN.fur);
    g.restore();
    // waves over the mouth and bubbles
    for (let i = -3; i <= 3; i++) ell(i * 60 + 20 * Math.sin(t * 3 + i), 18 + 6 * Math.sin(t * 5 + i), 46, 16, '#6f93a4');
    for (let i = 0; i < 6; i++) { const u = (t * 1.2 + i / 6) % 1; ell(-60 + 30 * Math.sin(i * 2 + t), 20 - 140 * u, 8 + 4 * (i % 3), 8 + 4 * (i % 3), 'rgba(255,255,255,0.8)', 0, 1 - u); }
    text('БУЛЬ!', 80, -120, 56, CREAM, { fam: FONTS.cond, rot: 0.15 });
  });
}
// —— inside the body: a body outline with specks in the belly; water from a shower bounces off the outside ——
export function insideInset(t, cx, cy, R, k, from) {
  roundInset(cx, cy, R, k, from, R => {
    rect(-R, -R, 2 * R, 2 * R, '#1f3a5a');
    for (let i = -6; i <= 6; i++) limb([[-R, i * 40], [R, i * 40]], 2, 'rgba(159,211,255,0.18)', false);
    // the outline
    const body = [[0, -190], [40, -176], [52, -136], [40, -104], [96, -84], [120, 20], [96, 30], [80, -40], [74, 60], [70, 190], [20, 190], [0, 80], [-20, 190], [-70, 190], [-74, 60], [-80, -40], [-96, 30], [-120, 20], [-96, -84], [-40, -104], [-52, -136], [-40, -176]];
    g.lineWidth = 8; g.strokeStyle = '#cfe6ff'; g.stroke(smoothPath(body));
    fill(smoothPath(body), 'rgba(159,211,255,0.12)');
    // what got in: specks in the belly that pulse
    for (let i = 0; i < 12; i++) {
      const a = i * 2.4, r = 40 * Math.sqrt(hash(i + 4)), x = Math.cos(a) * r, y = 0 + Math.sin(a) * r * 0.8, p = 0.6 + 0.4 * Math.sin(t * 6 + i);
      ell(x, y, 12 * p + 4, 12 * p + 4, 'rgba(255,210,63,0.35)'); ell(x, y, 7, 7, '#ffd23f');
    }
    // the water: drops falling on the shoulders and bouncing off
    for (let i = 0; i < 10; i++) {
      const u = (t * 1.6 + i / 10) % 1, x = -110 + 22 * i, y = -R + (R - 110) * Math.min(1, u * 1.3);
      if (u < 0.77) ell(x, y, 6, 12, '#9fd3ff'); else { const v = (u - 0.77) / 0.23; ell(x + (i % 2 ? 1 : -1) * 40 * v, -110 - 30 * Math.sin(Math.PI * v), 5, 5, '#9fd3ff', 0, 1 - v); }
    }
  });
}
// —— the 90 % card: the jacket and the boots covered in specks of dust go into the bag ——
export function percentCard(t, cx, cy, k, num) {
  if (k <= 0.01) return;
  g.save(); g.setTransform(1, 0, 0, 1, cx, cy); g.scale(k, k); g.rotate(-0.04);
  const w = 560, h = 210;
  rrect(-w / 2 + 10, -h / 2 + 12, w, h, 30, INK); rrect(-w / 2, -h / 2, w, h, 30, '#ffd23f');
  text(`ДО ${Math.round(num)}%`, 0, 18, 120, INK, { shadow: false });
  text('РАДИОАКТИВНОЙ ПЫЛИ', 0, 82, 46, INK, { fam: FONTS.cond, shadow: false });
  g.restore();
}

// —— a red cross and a green tick stamped on screen ——
export function redX(x, y, size, k, rot = -0.08) {
  if (k <= 0.01) return;
  g.save(); g.setTransform(1, 0, 0, 1, x, y);
  const z = lerp(1.8, 1, Math.min(1, k)) * Math.min(1, k * 4); g.scale(z, z); g.rotate(rot);
  for (const [c, d] of [[INK, 8], [RED, 0]]) for (const s of [-1, 1]) limb([[-size + d, -size * s + d], [size + d, size * s + d]], size * 0.42, c, false);
  g.restore();
}
export function tick(x, y, k, r = 74) {
  if (k <= 0.01) return;
  g.save(); g.setTransform(1, 0, 0, 1, x, y); const z = lerp(1.6, 1, Math.min(1, k)) * Math.min(1, k * 4) * r / 74; g.scale(z, z); g.rotate(-0.06);
  ell(6, 8, 74, 74, INK); ell(0, 0, 74, 74, CREAM);
  for (const [c, d] of [[INK, 6], [GREEN, 0]]) limb([[-34 + d, 2 + d], [-8 + d, 30 + d], [38 + d, -28 + d]], 22, c, false);
  g.restore();
}

function dashed(a, b, c, w) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.floor(L / 46));
  for (let i = 0; i < n; i++) {
    const u0 = i / n, u1 = Math.min(1, u0 + 0.6 / n);
    limb([[lerp(a[0], b[0], u0), lerp(a[1], b[1], u0)], [lerp(a[0], b[0], u1), lerp(a[1], b[1], u1)]], w, c, false);
  }
}
function head(p, a, c) {
  const pts = [[30, 0], [-22, -30], [-22, 30]].map(([x, y]) => [p[0] + x * Math.cos(a) - y * Math.sin(a), p[1] + x * Math.sin(a) + y * Math.cos(a)]);
  poly(pts, c);
}
// a dashed arrow growing from a to b (k 0…1), with an ink shadow
export function arrow(a, b, k, c = GREEN, w = 18) {
  if (k <= 0.01) return;
  g.setTransform(1, 0, 0, 1, 0, 0);
  const e = ease.out(clamp(k)), p = [lerp(a[0], b[0], e), lerp(a[1], b[1], e)], ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const sh = q => [q[0] + 5, q[1] + 7];
  dashed(sh(a), sh(p), INK, w); dashed(a, p, c, w);
  head(sh(p), ang, INK); head(p, ang, c);
}

// —— the step stamp at the top: a yellow badge with the number and a red stamp with the rule ——
export function stepHeader(t, n, str, t0, t1) {
  if (t < t0 || t > t1 + 0.3) return;
  const kin = sp(t, t0, 2.4, 7), kout = clamp((t - t1) / 0.25), y = 330;
  const k = kin * (1 - ease.in(kout));
  if (k <= 0.01) return;
  const size = 62, sw = measure(str, size) + size * 0.6, total = 128 + 26 + sw, x0 = 540 - total / 2;
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  g.translate(x0 + 64, y); g.scale(k, k); g.rotate(-0.08 * (1 - kin));
  ell(6, 8, 64, 64, INK); ell(0, 0, 64, 64, '#ffd23f');
  text(String(n), 0, 30, 88, INK, { shadow: false });
  g.restore();
  const ks = sp(t, t0 + 0.12, 2.2, 8) * (1 - ease.in(kout));
  if (ks > 0.01) { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); stamp(str, x0 + 128 + 26 + sw / 2, y, size, { k: lerp(1.8, 1, Math.min(1, ks)), rot: -0.04, a: Math.min(1, ks * 3), color: o_color(str) }); g.restore(); }
}
const o_color = str => (/^НЕ /.test(str) ? RED : '#2f8f4e');

// —— the end card: the series tag and a «subscribe» button ——
export function endCard(t, t0, out = 0) {
  if (t < t0) return;
  const k = sp(t, t0, 2.4, 7) * (1 - out), kb = sp(t, t0 + 0.15, 2.6, 6) * (1 + 0.08 * bump(((t - t0 - 0.9) % 1.2) / 0.25)) * (1 - out);
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  if (k > 0.01) {
    const hw = measure('КАК ВЫЖИТЬ', 56, FONTS.cond) / 2 + 30;
    g.save(); g.translate(540, 300); g.scale(k, k); fill(polyPath([[-hw + 6, -38 + 8], [hw + 6, -38 + 8], [hw + 6, 38 + 8], [-hw + 6, 38 + 8]]), INK);
    fill(polyPath([[-hw, -38], [hw, -38], [hw, 38], [-hw, 38]]), '#ffd23f'); g.restore();
    text('КАК ВЫЖИТЬ', 540, 320, 56 * k, INK, { fam: FONTS.cond, shadow: false });
  }
  pill('ПОДПИСЫВАЙСЯ', 540, 470, 80, { k: kb });
  g.restore();
}

// —— «only from bottles»: a kitchen tap with a drop ——
export function tapInset(t, cx, cy, R, k) {
  roundInset(cx, cy, R, k, null, R => {
    rect(-R, -R, 2 * R, 2 * R, '#cfe0e8');
    rect(-R, 60, 2 * R, R, '#9fb6c2');
    limb([[-140, -60], [10, -60], [40, -40], [40, 0]], 46, '#9aa4b0');
    rrect(-40, -110, 60, 40, 10, '#7a8490'); rrect(20, -6, 40, 24, 6, '#7a8490');
    for (let i = 0; i < 3; i++) { const u = (t * 1.4 + i / 3) % 1; ell(40, 30 + 150 * u, 10, 16, '#7fc0e8', 0, 1 - u * 0.6); }
  });
}
// —— the fridge at home: a white door with a handle and a magnet ——
export function fridgeInset(t, cx, cy, R, k) {
  roundInset(cx, cy, R, k, null, R => {
    rect(-R, -R, 2 * R, 2 * R, '#e8d8b8');
    rrect(-90, -170, 180, 340, 22, '#f8f6f0'); rect(-90, -60, 180, 8, '#d8d4ca');
    rrect(54, -140, 12, 60, 6, '#9aa4b0'); rrect(54, -30, 12, 90, 6, '#9aa4b0');
    ell(-40, 20, 16, 16, '#e0453a'); ell(-10, -120, 12, 12, '#3e9a4a');
  });
}
// —— the tablets: a blister of potassium iodide and a radio that announces when to take them ——
export function pillsCard(t, cx, cy, k) {
  if (k <= 0.01) return;
  g.save(); g.setTransform(1, 0, 0, 1, cx, cy); g.scale(k, k); g.rotate(-0.04);
  const w = 600, h = 300;
  rrect(-w / 2 + 10, -h / 2 + 12, w, h, 30, INK); rrect(-w / 2, -h / 2, w, h, 30, CREAM);
  // the blister
  rrect(-260, -110, 230, 150, 18, '#c8ccd4');
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { ell(-216 + i * 72, -66 + j * 66, 26, 26, '#e8ebf0'); ell(-222 + i * 72, -72 + j * 66, 10, 6, '#ffffff'); }
  text('ЙОДИД КАЛИЯ', -145, 92, 34, INK, { fam: FONTS.cond, shadow: false });
  // the radio with waves
  rrect(40, -90, 200, 120, 16, '#4a3a33'); rrect(54, -76, 90, 92, 10, '#6b574c'); rrect(156, -76, 66, 36, 6, '#ffd27a');
  for (let i = 0; i < 3; i++) { const u = (t * 1.2 + i / 3) % 1; g.lineWidth = 7; g.strokeStyle = rgba('#e0a91f', 1 - u); g.beginPath(); g.arc(140, -30, 90 + 50 * u, -1.0, -0.2); g.stroke(); }
  text('ПО СИГНАЛУ', 140, 92, 34, INK, { fam: FONTS.cond, shadow: false });
  g.restore();
}
// —— the thyroid: a head and neck in profile, the gland a glowing butterfly at the throat ——
export function thyroidInset(t, cx, cy, R, k) {
  roundInset(cx, cy, R, k, null, R => {
    rect(-R, -R, 2 * R, 2 * R, '#1f3a5a');
    for (let i = -6; i <= 6; i++) limb([[-R, i * 40], [R, i * 40]], 2, 'rgba(159,211,255,0.18)', false);
    const head = [[40, -200], [-30, -196], [-80, -150], [-92, -96], [-110, -70], [-96, -52], [-100, -20], [-78, 6], [-70, 40], [-40, 60], [-40, 220], [70, 220], [70, 90], [90, 20], [96, -60], [90, -150]];
    fill(smoothPath(head), 'rgba(159,211,255,0.12)'); g.lineWidth = 8; g.strokeStyle = '#cfe6ff'; g.stroke(smoothPath(head));
    const p = 0.6 + 0.4 * Math.sin(t * 6);
    ell(-20, 110, 70 * p + 20, 50 * p + 16, 'rgba(255,210,63,0.3)');
    for (const s of [-1, 1]) ell(-20 + s * 26, 112, 26, 36, '#ffd23f', s * 0.35);
    ell(-20, 118, 14, 12, '#ffd23f');
  });
}
// —— walls between you and the dust: three bands, rays that get thinner after each one ——
export function shieldCard(t, cx, cy, k, prog = 1) {
  if (k <= 0.01) return;
  g.save(); g.setTransform(1, 0, 0, 1, cx, cy); g.scale(k, k); g.rotate(-0.03);
  const w = 760, h = 360;
  rrect(-w / 2 + 10, -h / 2 + 12, w, h, 30, INK); rrect(-w / 2, -h / 2, w, h, 30, '#1f2b3a');
  const bands = [[-170, '#9a6a40', 'СТЕНА'], [-30, '#7a5232', 'ПОЛ'], [110, '#4a3526', 'ЗЕМЛЯ']];
  for (const [x, c, label] of bands) { rect(x - 30, -h / 2 + 40, 60, h - 120, c); text(label, x, h / 2 - 34, 30, CREAM, { fam: FONTS.cond, shadow: false }); }
  // the dust cloud on the left, the little man on the right
  for (let i = 0; i < 9; i++) ell(-320 + 30 * Math.sin(i * 2.1), -60 + 20 * i - 80, 10, 10, '#ffd23f', 0, 0.9);
  trefoil(-310, -110, 26, '#ffd23f');
  ell(300, -70, 26, 26, CREAM); rrect(276, -42, 48, 90, 16, CREAM);
  // three rays: full width, then thinner after each band (prog reveals them left to right)
  for (let r = 0; r < 3; r++) {
    const y = -100 + r * 60, xs = [-280, -170, -30, 110, 250], ws = [18, 12, 7, 3];
    for (let i = 0; i < 4; i++) {
      const a = xs[i], b = xs[i + 1], u = clamp((prog * 4 - i));
      if (u <= 0) break;
      const e = lerp(a, b, u), wave = x => y + 10 * Math.sin((x + t * 300) * 0.06 + r);
      const pts = []; for (let x = a; x <= e; x += 8) pts.push([x, wave(x)]);
      if (pts.length > 1) limb(pts, ws[i], '#ffd23f', false);
    }
  }
  g.restore();
}
// —— a clock that runs a whole day: the hand spins twice, «24 ЧАСА» ——
export function clockCard(t, t0, cx, cy, k) {
  if (k <= 0.01) return;
  g.save(); g.setTransform(1, 0, 0, 1, cx, cy); g.scale(k, k); g.rotate(-0.04);
  ell(10, 12, 170, 170, INK); ell(0, 0, 170, 170, CREAM); ell(0, 0, 150, 150, '#ffffff');
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; limb([[Math.cos(a) * 124, Math.sin(a) * 124], [Math.cos(a) * 140, Math.sin(a) * 140]], i % 3 ? 6 : 12, INK, false); }
  const u = clamp((t - t0) / 1.6), turns = ease.inOut(u) * 2;
  const ah = -Math.PI / 2 + turns * TAU / 12 * 12, am = -Math.PI / 2 + turns * TAU * 12;
  limb([[0, 0], [Math.cos(turns * TAU - Math.PI / 2) * 80, Math.sin(turns * TAU - Math.PI / 2) * 80]], 16, INK, false);
  limb([[0, 0], [Math.cos(turns * TAU * 12 - Math.PI / 2) * 118, Math.sin(turns * TAU * 12 - Math.PI / 2) * 118]], 8, '#e0453a', false);
  ell(0, 0, 14, 14, INK);
  g.restore();
  const w = 420, h = 110;
  g.save(); g.setTransform(1, 0, 0, 1, cx, cy + 230); g.scale(k, k); g.rotate(-0.03);
  rect(-w / 2 + 10, -h / 2 + 12, w, h, INK); rect(-w / 2, -h / 2, w, h, '#ffd23f');
  text('24 ЧАСА', 0, 30, 88, INK, { fam: FONTS.cond, shadow: false });
  g.restore();
}
