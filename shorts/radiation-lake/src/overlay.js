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
function roundInset(cx, cy, R, k, from, draw) {
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
