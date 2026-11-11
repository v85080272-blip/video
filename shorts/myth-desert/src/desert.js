// The places and things of «Правда или миф», №6 «Пустыня» in flat shapes, straight in screen space: the desert at noon
// (a pale hot sky, the sun, dunes, heat haze), the desert at night (the moon, stars, cold dunes), a saguaro that can be cut
// open and drip, a rock with an overhang that throws shade, a thermometer, a water drop, the sick swirls.
import { lerp, clamp, TAU, hash } from './lib.js';
import { g, ell, limb, rect, rrect, fill, poly, smoothPath, polyPath, rrPath } from './flat.js';

export const FLOOR = 1300;
function grad(stops, y0 = 0, y1 = 1920, x0 = -400, x1 = 1480) { const gr = g.createLinearGradient(0, y0, 0, y1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); g.fillStyle = gr; g.fillRect(x0, y0, x1 - x0, y1 - y0); }
function dune(y, amp, ph, color, x0 = -400, x1 = 1480) {
  const pts = [[x0, 1920]];
  for (let x = x0; x <= x1; x += 60) pts.push([x, y - amp * (0.6 * Math.sin(x / 260 + ph) + 0.4 * Math.sin(x / 113 + ph * 2.3))]);
  pts.push([x1, 1920]);
  fill(smoothPath(pts), color);
}

// noon: o.heat 0…1 (more orange, the sun bigger), o.scroll (px, the dunes slide for a walk)
export function dayBg(t, o = {}) {
  const h = o.heat ?? 0, sc = o.scroll ?? 0;
  grad([[0, h > 0.5 ? '#f7b267' : '#8fd3f4'], [0.42, h > 0.5 ? '#ffd8a0' : '#cdeefa'], [0.62, '#fff1cf']], 0, FLOOR);
  const sx = o.sunX ?? 800, sy = o.sunY ?? 300, r = 90 + 40 * h;
  for (let i = 4; i >= 1; i--) ell(sx, sy, r + i * 46 + 8 * Math.sin(t * 2 + i), r + i * 46 + 8 * Math.sin(t * 2 + i), '#fff6c9', 0, 0.16);
  ell(sx, sy, r, r, '#fff3a6'); ell(sx, sy, r * 0.8, r * 0.8, '#fffbe0');
  dune(980, 40, 0.8 + sc / 900, '#f4d39a');
  dune(1090, 60, 2.1 + sc / 500, '#efc27a');
  dune(1230, 50, 4.0 + sc / 300, '#e8b062');
  grad([[0, '#e2a656'], [1, '#c98a3f']], FLOOR, 1920);
  for (let i = 0; i < 9; i++) {                                       // ripples in the sand
    const y = FLOOR + 60 + i * 70, x = ((i * 233 - sc) % 1500 + 1500) % 1500 - 300;
    limb([[x, y], [x + 120, y - 10], [x + 240, y]], 6, 'rgba(160,100,40,0.35)');
  }
  g.save(); g.globalAlpha = 0.18 + 0.12 * h;                          // the heat haze over the ground
  for (let i = 0; i < 5; i++) { const y = 1010 + i * 50; limb([[-100, y + 10 * Math.sin(t * 3 + i)], [300, y - 10 * Math.sin(t * 3.4 + i)], [700, y + 10 * Math.sin(t * 2.7 + i)], [1180, y]], 10, '#ffffff'); }
  g.restore();
}

// night: the moon, stars, cold dunes
export function nightBg(t, o = {}) {
  const sc = o.scroll ?? 0;
  grad([[0, '#0b1636'], [0.55, '#21366b'], [0.8, '#3a4f86']], 0, FLOOR);
  for (let i = 0; i < 90; i++) {
    const x = hash(i) * 1880 - 400, y = hash(i + 101) * 900 + 40, tw = 0.5 + 0.5 * Math.sin(t * (2 + hash(i + 7) * 3) + i);
    ell(x, y, 3 + 3 * hash(i + 3), 3 + 3 * hash(i + 3), '#ffffff', 0, 0.35 + 0.55 * tw);
  }
  const mx = o.moonX ?? 760, my = o.moonY ?? 330;
  for (let i = 3; i >= 1; i--) ell(mx, my, 80 + i * 40, 80 + i * 40, '#dfe8ff', 0, 0.08);
  ell(mx, my, 80, 80, '#f4f1dc'); ell(mx - 22, my - 14, 16, 16, '#dcd6b8'); ell(mx + 20, my + 22, 11, 11, '#dcd6b8'); ell(mx + 26, my - 26, 8, 8, '#dcd6b8');
  dune(980, 40, 0.8 + sc / 900, '#3f5585');
  dune(1090, 60, 2.1 + sc / 500, '#4b6293');
  dune(1230, 50, 4.0 + sc / 300, '#5a70a0');
  grad([[0, '#5f74a3'], [1, '#3a4b78']], FLOOR, 1920);
  for (let i = 0; i < 9; i++) {
    const y = FLOOR + 60 + i * 70, x = ((i * 233 - sc) % 1500 + 1500) % 1500 - 300;
    limb([[x, y], [x + 120, y - 10], [x + 240, y]], 6, 'rgba(20,30,60,0.35)');
  }
}

// the saguaro: base at (x, y), height h; o.cut 0…1 (a slit opens, pale green flesh), o.drip (a drop falls from the slit)
export function saguaro(t, x, y, h, o = {}) {
  const w = h * 0.15, c = '#4f9a4a', d = '#3b7d38', l = '#76b86a';
  const arm = (side, y0, up) => {
    const ax = x + side * (w * 0.5 + h * 0.14), pts = [[x + side * w * 0.4, y0], [ax, y0], [ax, y0 - up]];
    limb(pts, w * 0.62, d, false); limb(pts, w * 0.5, c, false); ell(ax, y0 - up, w * 0.25, w * 0.25, c);
  };
  arm(-1, y - h * 0.45, h * 0.28); arm(1, y - h * 0.6, h * 0.24);
  rrect(x - w / 2, y - h, w, h, w / 2, d); rrect(x - w / 2 + 6, y - h + 6, w - 12, h - 6, w / 2, c);
  for (let k = -1; k <= 1; k++) limb([[x + k * w * 0.22, y - h + 30], [x + k * w * 0.22, y - 10]], 4, k ? d : l, false);
  for (let i = 0; i < 18; i++) { const sy = y - h + 40 + i * (h - 60) / 18, sx = x + (i % 2 ? -1 : 1) * w * 0.5; limb([[sx, sy], [sx + (i % 2 ? -14 : 14), sy - 8]], 3, '#f5f0d6', false); }
  if (o.cut > 0) {
    const cy = y - h * 0.42, cw = w * 0.9 * clamp(o.cut);
    ell(x, cy, cw / 2, 14 + 18 * clamp(o.cut), '#cfe8a8'); ell(x, cy, cw / 3, 8 + 10 * clamp(o.cut), '#b2d67e');
    if (o.drip) { const u = (t * 1.6) % 1; ell(x, cy + 30 + u * 140, 9, 13, '#d7f0b0', 0, 1 - u * 0.7); }
  }
}

// a red-brown rock with an overhang; the shade under it
export function rock(x, y, s = 1, shade = 1) {
  if (shade > 0) ell(x + 40 * s, y + 10 * s, 240 * s, 30 * s, 'rgba(90,50,20,0.35)', 0, shade);
  fill(smoothPath([[x - 260 * s, y], [x - 250 * s, y - 180 * s], [x - 180 * s, y - 330 * s], [x + 40 * s, y - 380 * s], [x + 250 * s, y - 330 * s], [x + 290 * s, y - 280 * s], [x + 120 * s, y - 250 * s], [x - 40 * s, y - 220 * s], [x - 90 * s, y]]), '#b5643a');
  fill(smoothPath([[x - 230 * s, y - 40 * s], [x - 200 * s, y - 200 * s], [x - 140 * s, y - 310 * s], [x - 20 * s, y - 340 * s], [x - 120 * s, y - 230 * s], [x - 150 * s, y - 60 * s]]), '#cf7a4a');
  fill(smoothPath([[x - 40 * s, y - 220 * s], [x + 120 * s, y - 250 * s], [x + 290 * s, y - 280 * s], [x + 270 * s, y - 250 * s], [x + 100 * s, y - 225 * s], [x - 30 * s, y - 200 * s]]), '#8a4a2a');
}

// a thermometer: (x, y) its bulb, v 0…1 the column, the degrees above
export function thermo(x, y, v, str, color = '#e53935') {
  rrect(x - 26, y - 360, 52, 380, 26, '#ffffff'); rrect(x - 14, y - 346, 28, 350, 14, '#f0e6e6');
  const hgt = 30 + 300 * clamp(v);
  rrect(x - 14, y - hgt, 28, hgt, 14, color); ell(x, y, 44, 44, '#ffffff'); ell(x, y, 34, 34, color);
  for (let i = 0; i < 7; i++) rect(x + 18, y - 60 - i * 45, 16, 5, '#9a8f8f');
  return str;
}

export function drop(x, y, s = 1, color = '#3aa6e8') {
  fill(smoothPath([[x, y - 30 * s], [x + 16 * s, y - 2 * s], [x + 14 * s, y + 14 * s], [x, y + 22 * s], [x - 14 * s, y + 14 * s], [x - 16 * s, y - 2 * s]]), color);
  ell(x - 5 * s, y + 4 * s, 4 * s, 6 * s, '#ffffff', 0, 0.7);
}

// green «sick» swirls over a head
export function sick(x, y, t, k = 1) {
  if (k <= 0.01) return;
  g.save(); g.globalAlpha = k;
  for (let i = 0; i < 3; i++) {
    const a = t * 3 + i * TAU / 3, cx = x + 60 * Math.cos(a), cy = y - 20 + 18 * Math.sin(a);
    const pts = []; for (let j = 0; j < 14; j++) { const r = 6 + j * 1.6, b = j * 0.7; pts.push([cx + r * Math.cos(b), cy + r * Math.sin(b)]); }
    limb(pts, 6, '#5fbf3a');
  }
  g.restore();
}

// the heat-stroke stars over a head
export function stars(x, y, t, k = 1) {
  if (k <= 0.01) return;
  g.save(); g.globalAlpha = k;
  for (let i = 0; i < 4; i++) {
    const a = t * 4 + i * TAU / 4, cx = x + 80 * Math.cos(a), cy = y + 20 * Math.sin(a), r = 18;
    const pts = []; for (let j = 0; j < 10; j++) { const rr = j % 2 ? r * 0.45 : r, b = j * TAU / 10 - Math.PI / 2; pts.push([cx + rr * Math.cos(b), cy + rr * Math.sin(b)]); }
    poly(pts, '#ffd23f');
  }
  g.restore();
}
