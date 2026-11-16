// The places and things of «Правда или миф», №2 «Мифы про холод» in flat shapes, straight in screen space: a bright snowy
// day (sky, sun, hills, pines, falling snow), the hook's cards (a flask, three layers, a hand with snow), a mug of hot tea
// and a bowl of warm water with steam, the thermometer of the body, the layers diagram (one thick coat or three thin
// layers with warm air between them), snow puffs.
import { lerp, clamp, TAU, hash } from './lib.js';
import { g, ell, limb, rect, rrect, fill, poly, smoothPath, polyPath, rrPath } from './flat.js';
import { flask } from './hunter.js';

function grad(stops, y0 = 0, y1 = 1920) { const gr = g.createLinearGradient(0, y0, 0, y1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); g.fillStyle = gr; g.fillRect(0, y0, 1080, y1 - y0); }
export function pine(x, y, s, c = '#2f5a46') {
  for (let k = 0; k < 4; k++) { const w = (90 - k * 18) * s, yy = y - k * 46 * s; poly([[x - w, yy], [x, yy - 90 * s], [x + w, yy]], c); poly([[x - w * 0.8, yy - 4 * s], [x, yy - 70 * s], [x + w * 0.2, yy - 30 * s]], '#f4fbff', 0.85); }
  rect(x - 8 * s, y, 16 * s, 26 * s, '#5a4632');
}
// a bright snowy day; the snow ground from y
export function winterDay(t, y = 1250) {
  grad([[0, '#8fcaf0'], [1, '#e8f5fb']], 0, y);
  ell(820, 240, 72, 72, '#fffbe6'); ell(820, 240, 120, 120, 'rgba(255,251,230,0.3)');
  for (let i = 0; i < 3; i++) { const cx = (i * 380 + t * 6) % 1400 - 160, cy = 130 + 110 * (i % 2); ell(cx, cy, 120, 32, 'rgba(255,255,255,0.85)'); ell(cx + 60, cy - 16, 70, 28, 'rgba(255,255,255,0.85)'); }
  fill(smoothPath([[-60, y - 120], [200, y - 260], [480, y - 160], [760, y - 300], [1140, y - 140], [1140, y + 20], [-60, y + 20]]), '#eef7fb');
  for (let i = 0; i < 12; i++) pine(-20 + i * 100 + 30 * hash(i), y - 60 - 80 * hash(i * 3), 0.55 + 0.25 * hash(i * 2), i % 3 ? '#2f5a46' : '#264c3c');
  grad([[0, '#f6fbfe'], [1, '#d9e9f2']], y, 1920);
  for (let i = 0; i < 40; i++) { const x = 1080 * hash(i * 1.9), yy = y + 30 + 650 * hash(i * 2.7); ell(x, yy, 3, 3, 'rgba(160,200,225,0.8)'); }
  for (let i = 0; i < 46; i++) { const x = (1080 * hash(i * 3.1) + 30 * Math.sin(t * 0.8 + i)) % 1080, yy = (1920 * hash(i * 1.3) + t * (60 + 40 * hash(i))) % 1920; ell(x, yy, 4 + 3 * hash(i), 4 + 3 * hash(i), 'rgba(255,255,255,0.9)'); }
}
// three layers of clothes seen in cut: shirt, fleece, jacket, with warm air dots between; k = how warm the air glows
export function layers(x, y, s, t, k = 0) {
  g.save(); g.translate(x, y); g.scale(s, s);
  const C = ['#ff6f59', '#ffd23f', '#3a6aa8'];
  for (let i = 2; i >= 0; i--) { const r = 120 + i * 50; g.lineWidth = 22; g.strokeStyle = C[i]; g.beginPath(); g.arc(0, 0, r, Math.PI * 1.05, Math.PI * 1.95); g.stroke(); }
  for (let i = 0; i < 22; i++) { const a = Math.PI * (1.08 + 0.84 * hash(i * 1.7)), r = 145 + 50 * (i % 2) + 4 * Math.sin(t * 3 + i); ell(Math.cos(a) * r, Math.sin(a) * r, 7, 7, k > 0 ? `rgba(255,${180 - 60 * k | 0},80,${0.5 + 0.5 * k})` : 'rgba(255,255,255,0.8)'); }
  ell(0, -10, 70, 70, '#f2c19b');
  g.restore();
}
export function thickCoat(x, y, s) { g.save(); g.translate(x, y); g.scale(s, s); g.lineWidth = 80; g.strokeStyle = '#6a5a8a'; g.beginPath(); g.arc(0, 0, 170, Math.PI * 1.05, Math.PI * 1.95); g.stroke(); ell(0, -10, 70, 70, '#f2c19b'); g.restore(); }
export function steam(x, y, t, n = 3, s = 1) {
  for (let i = 0; i < n; i++) { const u = ((t * 0.7 + i / n) % 1); limb([[x + (i - 1) * 24 * s, y - 10], [x + (i - 1) * 24 * s + 18 * s * Math.sin(t * 3 + i), y - 60 * s * u - 20], [x + (i - 1) * 24 * s - 10 * s, y - 120 * s * u - 30]], 8 * s, `rgba(255,255,255,${0.7 * (1 - u)})`, true); }
}
export function mug(x, y, s, t) {
  g.save(); g.translate(x, y); g.scale(s, s);
  rrect(-50, -70, 100, 110, 16, '#d9433b'); g.lineWidth = 14; g.strokeStyle = '#d9433b'; g.beginPath(); g.arc(56, -16, 26, -1.2, 1.2); g.stroke();
  ell(0, -70, 50, 12, '#8a4a1e'); rect(-50, -40, 100, 10, '#fff3d6');
  g.restore(); steam(x, y - 76 * s, t, 3, s);
}
export function bowl(x, y, s, t) {
  g.save(); g.translate(x, y); g.scale(s, s);
  fill(smoothPath([[-180, -40], [180, -40], [150, 60], [-150, 60]]), '#3a6aa8'); ell(0, -40, 180, 30, '#7fc2e6'); ell(0, -40, 150, 20, '#a9d9f0');
  g.restore(); steam(x - 60 * s, y - 50 * s, t, 3, s); steam(x + 60 * s, y - 50 * s, t + 0.5, 2, s);
}
export function thermometer(x, y, k, val) {
  if (k <= 0.01) return;
  g.save(); g.translate(x, y); g.scale(k, k);
  rrect(-60, -330, 120, 520, 60, 'rgba(11,15,26,0.85)');
  rrect(-22, -290, 44, 380, 22, '#f2f2f2'); ell(0, 120, 46, 46, '#f2f2f2');
  const u = clamp((val - 30) / 10), top = lerp(90, -290, u);
  rect(-12, top, 24, 110 - top, '#e53935'); ell(0, 120, 34, 34, '#e53935');
  g.restore();
}
export function snowPuff(x, y, t, k = 1) { for (let i = 0; i < 8; i++) { const a = hash(i * 2.1) * TAU, d = 30 + 40 * ((t * 3 + hash(i)) % 1); ell(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.6, 10 * k, 10 * k, 'rgba(255,255,255,0.9)'); } }
// the hook's card: a rounded card with the thing drawn in it
export function card(x, y, s, kind, t) {
  g.save(); g.translate(x, y); g.scale(s, s); g.rotate(0.04 * Math.sin(t * 2 + x));
  rrect(-140 + 8, -180 + 10, 280, 360, 30, 'rgba(0,0,0,0.25)'); rrect(-140, -180, 280, 360, 30, '#fff3d6');
  if (kind === 'vodka') { flask(0, 20, 2.6, -0.2); }
  else if (kind === 'layers') layers(0, 80, 0.55, t, 0);
  else { ell(-20, 40, 70, 50, '#f2c19b'); for (let i = 0; i < 4; i++) limb([[-70 + i * 26, 10], [-74 + i * 26, -50]], 22, '#f2c19b', false); ell(40, 0, 60, 50, '#ffffff'); ell(30, -10, 30, 20, '#e4f2f8'); }
  g.restore();
}
