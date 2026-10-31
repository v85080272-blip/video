// Things drawn over the world in screen space: the view through the binoculars, the target on the tower, the paper map
// that explains the wind, the magnifier that shows ash is glass, the step stamps and the end card.
import { g, W, H, ell, limb, fill, poly, rect, rrect, polyPath, smoothPath, rrPath, inside } from './flat.js';
import { lerp, clamp, ease, spring, bump, hash, noise, TAU, mix } from './lib.js';
import { text, stamp, pill, measure, FONTS, INK } from './type.js';
import { drawSky, drawVolcano, drawFar, VOLC, P } from './world.js';

const sp = (t, t0, f = 2.4, d = 7) => (t <= t0 ? 0 : spring(t - t0, f, d));

// —— the view through the binoculars: two round lenses, the summit magnified, a hand-held wobble ——
export function binocularView(t, te, o = {}) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  rect(0, 0, W, H, '#0d0c16');
  const r = 340, cy = 930, c1 = [540 - 200, cy], c2 = [540 + 200, cy];
  const jx = 9 * noise(t * 3.1, 1) + (o.kick ?? 0) * 18 * noise(t * 40, 4), jy = 7 * noise(t * 2.7, 2) + (o.kick ?? 0) * 18 * noise(t * 37, 5);
  g.save();
  g.beginPath(); g.arc(c1[0], c1[1], r, 0, TAU); g.moveTo(c2[0] + r, c2[1]); g.arc(c2[0], c2[1], r, 0, TAU); g.clip();
  drawSky(o.sky ?? 0, o.flash ?? 0);
  const Z = o.zoom ?? 2.4;
  g.setTransform(Z, 0, 0, Z, 540 + jx - VOLC.x * Z, cy + 150 + jy - VOLC.y * Z);
  drawVolcano(t, te, { bolts: o.bolts, smoke: true });
  g.setTransform(Z * 0.9, 0, 0, Z * 0.9, 540 + jx * 1.3 - 300 * Z * 0.9, cy + 760 + jy * 1.3 + 330 * Z * 0.9);
  drawFar(0);
  g.restore();
  // the lens rims: a dark ring with a soft inner shade, and a faint rangefinder scale
  g.setTransform(1, 0, 0, 1, 0, 0);
  for (const c of [c1, c2]) {
    g.save(); g.beginPath(); g.arc(c[0], c[1], r, 0, TAU); g.clip();
    g.lineWidth = 70; g.strokeStyle = 'rgba(13,12,22,0.45)'; g.beginPath(); g.arc(c[0], c[1], r, 0, TAU); g.stroke();
    g.lineWidth = 26; g.strokeStyle = 'rgba(13,12,22,0.6)'; g.beginPath(); g.arc(c[0], c[1], r, 0, TAU); g.stroke();
    g.restore();
  }
  for (let i = -4; i <= 4; i++) limb([[540 + i * 40, cy + 150], [540 + i * 40, cy + 150 - (i % 2 ? 14 : 26)]], 4, 'rgba(255,243,214,0.5)', false);
  limb([[540 - 170, cy + 150], [540 + 170, cy + 150]], 4, 'rgba(255,243,214,0.5)', false);
}

// —— a red target over the tower: rings and ticks that snap tight ——
export function crosshair(x, y, R, k, a = 1) {
  if (k <= 0.01 || a <= 0) return;
  g.save(); g.setTransform(1, 0, 0, 1, x, y); g.globalAlpha *= a; g.scale(k, k); g.rotate((1 - Math.min(1, k)) * 1.2);
  const ring = (rr, w, c, dx = 0, dy = 0) => { g.lineWidth = w; g.strokeStyle = c; g.beginPath(); g.arc(dx, dy, rr, 0, TAU); g.stroke(); };
  for (const [c, d] of [[INK, 6], ['#ff4d4d', 0]]) {
    ring(R, 14, c, d, d); ring(R * 0.45, 9, c, d, d);
    for (let i = 0; i < 4; i++) {
      const a2 = i * Math.PI / 2;
      limb([[Math.cos(a2) * R * 0.62 + d, Math.sin(a2) * R * 0.62 + d], [Math.cos(a2) * R * 1.3 + d, Math.sin(a2) * R * 1.3 + d]], 13, c, false);
    }
    ell(d, d, 11, 11, c);
  }
  g.restore();
}

// —— the paper map: where the wind carries the cloud, where the ash will fall, and which way to go ——
// m: { k (0 hidden … 1 on screen), out (0 … 1 flown away), wind, fan, ash, red, cross, green, walk, check }
const CARD = { x: 540, y: 880, w: 940, h: 1060, k: 0.85 };
const MV = [70, -370], ME = [110, 170], MG = [-330, 170];           // volcano, «ты» at the start, where he goes
export function drawMap(t, m) {
  const k = m.k ?? 0, out = m.out ?? 0;
  if (k <= 0.01 || out >= 1) return;
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.translate(CARD.x - 1500 * ease.in(out) * 0.9, CARD.y + (1 - k) * 1400 - 200 * Math.sin(out * 2));
  g.rotate(-0.035 + (1 - k) * 0.25 - out * 0.5);
  g.scale((0.94 + 0.06 * k) * CARD.k, (0.94 + 0.06 * k) * CARD.k);
  const { w, h } = CARD;
  rrect(-w / 2 + 14, -h / 2 + 20, w, h, 34, 'rgba(13,12,22,0.45)');
  rrect(-w / 2, -h / 2, w, h, 34, '#efe0bf');
  inside(rrPath(-w / 2, -h / 2, w, h, 34), () => {
    rect(-w / 2, -h / 2, w, 70, '#e3cfa6');
    for (const [x, y, r] of [[-300, -300, 120], [-170, -390, 90], [-360, 40, 110], [-60, 80, 80], [340, 330, 130], [-250, 420, 120], [60, 440, 90], [380, -60, 70]])
      for (let i = 0; i < 5; i++) ell(x + (hash(x + i) - 0.5) * r, y + (hash(y + i) - 0.5) * r * 0.7, r * 0.42, r * 0.36, '#c9d39b');
    // the river and the road
    const river = [];
    for (let i = 0; i <= 20; i++) { const x = -w / 2 - 20 + (w + 40) * i / 20; river.push([x, 310 + 34 * Math.sin(i * 0.9) - i * 3]); }
    limb(river, 40, '#8fbbe0'); limb(river, 12, '#b9d6ee');
    for (let i = 0; i < 9; i++) { const x = -w / 2 + 40 + i * 44; limb([[x, -70 + i * 22], [x + 24, -58 + i * 22]], 12, '#b08a5a', false); }
    // the hut, the tower
    poly([[-400, -60], [-360, -98], [-320, -60], [-320, -20], [-400, -20]], '#9a6a40');
    rect(ME[0] - 22, ME[1] + 30, 44, 44, '#8c5b38'); limb([[ME[0] - 22, ME[1] + 74], [ME[0] - 34, ME[1] + 104]], 8, '#6b4329', false); limb([[ME[0] + 22, ME[1] + 74], [ME[0] + 34, ME[1] + 104]], 8, '#6b4329', false);
    // the volcano
    poly([[MV[0] - 120, MV[1] + 70], [MV[0] - 26, MV[1] - 60], [MV[0] + 26, MV[1] - 60], [MV[0] + 120, MV[1] + 70]], '#6d6f8f');
    poly([[MV[0] - 60, MV[1] - 4], [MV[0] - 26, MV[1] - 60], [MV[0] + 26, MV[1] - 60], [MV[0] + 60, MV[1] - 4], [MV[0] + 20, MV[1] - 22], [MV[0] - 16, MV[1] + 2]], '#ffffff');
    ell(MV[0], MV[1] - 60, 26, 9, '#ff6a2a');
    // the ash cloud fans out downwind; the dots are the ash falling under it
    const fan = ease.inOut(clamp(m.fan ?? 0));
    if (fan > 0.01) {
      const L = 800 * fan, pts = [];
      const half = y => 46 + 0.36 * (y - MV[1] + 60);
      for (let i = 0; i <= 14; i++) { const y = MV[1] - 50 + L * i / 14; pts.push([MV[0] + half(y) + 18 * Math.sin(i * 1.7 + t * 2), y]); }
      for (let i = 14; i >= 0; i--) { const y = MV[1] - 50 + L * i / 14; pts.push([MV[0] - half(y) - 18 * Math.sin(i * 1.3 + t * 2), y]); }
      const fp = smoothPath(pts);
      fill(fp, 'rgba(98,92,108,0.78)');
      for (let i = 0; i < 16; i++) { const v = i / 15, y = MV[1] - 50 + L * v; ell(MV[0] + (hash(i) - 0.5) * half(y) * 1.4, y, half(y) * 0.45, 40, 'rgba(128,122,138,0.5)'); }
      const ash = clamp(m.ash ?? 0);
      if (ash > 0) inside(fp, () => {
        for (let i = 0; i < 90; i++) {
          if (hash(i + 300) > ash) continue;
          const y0 = MV[1] + 20 + 760 * hash(i + 301), x = MV[0] + (hash(i + 302) - 0.5) * 2 * (46 + 0.36 * (y0 - MV[1] + 60)), y = y0 + ((t * 60 + 80 * hash(i + 303)) % 80);
          ell(x, y, 6, 6, '#2e2b36');
        }
      });
      if (ash > 0.3) text('ПЕПЕЛ', MV[0] - 70, -60, 58 * sp(t, m.ashT ?? 0, 2.6, 8), '#fff3d6', { fam: FONTS.cond });
    }
    // the wind arrow
    const wd = clamp(m.wind ?? 0);
    if (wd > 0.01) {
      const x = 340, y0 = MV[1] + 10, y1 = y0 + 300 * ease.out(wd);
      limb([[x + 6, y0 + 8], [x + 6, y1 + 8]], 34, INK, false); limb([[x, y0], [x, y1]], 34, '#fff3d6', false);
      poly([[x - 50 + 6, y1 - 6 + 8], [x + 50 + 6, y1 - 6 + 8], [x + 6, y1 + 60 + 8]], INK); poly([[x - 50, y1 - 6], [x + 50, y1 - 6], [x, y1 + 60]], '#fff3d6');
      for (let i = 0; i < 3; i++) {
        const ph = (t * 1.6 + i / 3) % 1, yy = y0 + 40 + 260 * ph;
        if (yy < y1 - 20) limb([[x - 90, yy], [x - 70, yy + 20], [x - 90, yy + 40]], 7, 'rgba(23,22,47,0.55)', false);
      }
      text('ВЕТЕР', x + 2, y0 - 30, 56 * ease.out(wd), INK, { fam: FONTS.cond, shadow: false });
    }
    // where not to go: along the wind, under the cloud
    const red = clamp(m.red ?? 0);
    if (red > 0.01) {
      dashed([ME[0], ME[1] + 70], [ME[0], ME[1] + 70 + 300 * ease.out(red)], '#e2463f', 16);
      if (red > 0.95) head([ME[0], ME[1] + 380], Math.PI / 2, '#e2463f');
      const c = sp(t, m.crossT ?? 1e9, 2.6, 8);
      if (c > 0.01) { const [x, y] = [ME[0], ME[1] + 250]; g.save(); g.translate(x, y); g.scale(c, c); for (const s of [-1, 1]) { limb([[-56 + 5, -56 * s + 7], [56 + 5, 56 * s + 7]], 30, INK, false); limb([[-56, -56 * s], [56, 56 * s]], 30, '#e2463f', false); } g.restore(); }
    }
    // the way out: across the wind, out from under it
    const gr = clamp(m.green ?? 0);
    if (gr > 0.01) {
      dashed([ME[0] - 60, ME[1]], [lerp(ME[0] - 60, MG[0] + 40, ease.out(gr)), ME[1]], '#3e9a4a', 16);
      if (gr > 0.95) head([MG[0] + 10, ME[1]], Math.PI, '#3e9a4a');
    }
    const ck = sp(t, m.checkT ?? 1e9, 2.6, 8);
    if (ck > 0.01) { g.save(); g.translate(MG[0] - 10, ME[1] - 120); g.scale(ck, ck); limb([[-34 + 5, 0 + 7], [-8 + 5, 28 + 7], [40 + 5, -30 + 7]], 26, INK, false); limb([[-34, 0], [-8, 28], [40, -30]], 26, '#3e9a4a', false); g.restore(); }
    // «ты»: a little hunter's head
    const wk = ease.inOut(clamp(m.walk ?? 0)), you = [lerp(ME[0], MG[0], wk), ME[1] - 6 * bump((wk * 6) % 1)];
    ell(you[0] + 5, you[1] + 7, 46, 46, INK);
    ell(you[0], you[1], 46, 46, '#f2782f');
    ell(you[0], you[1] + 6, 30, 30, '#f2c19b');
    fill(smoothPath([[you[0] - 30, you[1] + 8], [you[0] - 22, you[1] - 22], [you[0] + 22, you[1] - 22], [you[0] + 30, you[1] + 8], [you[0] + 34, you[1] - 8], [you[0] - 34, you[1] - 8]]), '#7a5236');
    ell(you[0], you[1] + 28, 20, 12, '#6a4127');
    text('ТЫ', you[0], you[1] - 64, 44, INK, { fam: FONTS.cond, shadow: false });
  });
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

// a dashed arrow growing from a to b (k 0…1), with an ink shadow, as on the map
export function arrow(a, b, k, c = '#3e9a4a', w = 18) {
  if (k <= 0.01) return;
  g.setTransform(1, 0, 0, 1, 0, 0);
  const e = ease.out(clamp(k)), p = [lerp(a[0], b[0], e), lerp(a[1], b[1], e)], ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const sh = q => [q[0] + 5, q[1] + 7];
  dashed(sh(a), sh(p), INK, w); dashed(a, p, c, w);
  head(sh(p), ang, INK); head(p, ang, c);
}

// —— the magnifier: a round lens over a flake of ash, showing what it is: sharp splinters of glass ——
export function magnifier(t, cx, cy, R, k, from = null) {
  if (k <= 0.01) return;
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  if (from) { limb([from, [cx, cy + R * k]], 8, 'rgba(255,243,214,0.7)', false); ell(from[0], from[1], 14, 14, 'rgba(255,243,214,0.7)'); }
  g.translate(cx, cy); g.scale(k, k);
  ell(10, 14, R + 26, R + 26, 'rgba(13,12,22,0.5)');
  ell(0, 0, R + 26, R + 26, '#2b2a3a');
  ell(0, 0, R + 12, R + 12, '#9aa6b8');
  ell(0, 0, R, R, '#3b4058');
  g.save(); g.beginPath(); g.arc(0, 0, R, 0, TAU); g.clip();
  for (let i = 0; i < 9; i++) {
    const a = t * (0.25 + 0.2 * hash(i)) * (i % 2 ? 1 : -1) + i, d = R * 0.62 * Math.sqrt(hash(i + 7)), s = R * (0.2 + 0.2 * hash(i + 3));
    const x = Math.cos(i * 2.4) * d + 8 * Math.sin(t + i), y = Math.sin(i * 2.4) * d + 8 * Math.cos(t * 0.8 + i);
    const n = 5 + (i % 3), pts = [];
    for (let j = 0; j < n; j++) { const b = a + TAU * j / n + (hash(i * 9 + j) - 0.5) * 0.9, rr = s * (j % 2 ? 0.35 + 0.3 * hash(i + j) : 1); pts.push([x + Math.cos(b) * rr, y + Math.sin(b) * rr * 0.8]); }
    fill(polyPath(pts), 'rgba(196,228,244,0.92)');
    poly([pts[0], pts[1], [x, y]], 'rgba(122,170,200,0.9)');
    limb([pts[0], pts[1]], 4, '#ffffff', false);
  }
  g.restore();
  ell(-R * 0.45, -R * 0.5, R * 0.22, R * 0.1, 'rgba(255,255,255,0.35)', -0.7);
  g.restore();
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
  if (ks > 0.01) { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); stamp(str, x0 + 128 + 26 + sw / 2, y, size, { k: lerp(1.8, 1, Math.min(1, ks)) * (ks > 1 ? 1 : 1), rot: -0.04, a: Math.min(1, ks * 3) }); g.restore(); }
}

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
