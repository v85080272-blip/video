// The places and things of «Правда или миф», №5 «Пожар дома» in flat shapes, straight in screen space: a bright kitchen
// (tiles, a cooker with a pan of burning oil, a lid, a knob), the fireball when water hits the oil, a corridor with the
// smoke filling it from the ceiling down, a block of flats cut open with the lift shaft drawing smoke like a chimney and
// the stairs beside it, flames, the hook's cards.
import { lerp, clamp, TAU, hash } from './lib.js';
import { g, ell, limb, rect, rrect, fill, poly, smoothPath, polyPath, rrPath } from './flat.js';

export const FLOOR = 1420;
function grad(stops, y0 = 0, y1 = 1920, x0 = 0, x1 = 1080) { const gr = g.createLinearGradient(0, y0, 0, y1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); g.fillStyle = gr; g.fillRect(x0, y0, x1 - x0, y1 - y0); }
export function flames(x, y, w, h, t, a = 1) {
  if (a <= 0.01) return;
  g.save(); g.globalAlpha = a;
  for (let i = 0; i < 7; i++) { const u = i / 6, fx = x - w / 2 + w * u, fh = h * (0.6 + 0.4 * Math.sin(t * 9 + i * 1.7)) * (1 - Math.abs(u - 0.5)); fill(smoothPath([[fx - w / 10, y], [fx - w / 20, y - fh * 0.6], [fx, y - fh], [fx + w / 20, y - fh * 0.6], [fx + w / 10, y]]), i % 2 ? '#ff9f1c' : '#ff6b1c'); }
  for (let i = 0; i < 5; i++) { const fx = x - w / 3 + (w * 2 / 3) * i / 4, fh = h * 0.45 * (0.6 + 0.4 * Math.sin(t * 11 + i)); fill(smoothPath([[fx - w / 16, y], [fx, y - fh], [fx + w / 16, y]]), '#ffe066'); }
  g.restore();
}
export function kitchen(t, o = {}) {
  grad([[0, '#fbf3e4'], [1, '#f1e4cc']], 0, FLOOR);
  for (let r = 0; r < 6; r++) for (let c = 0; c < 9; c++) rect(40 + c * 112, 820 + r * 70, 104, 62, (r + c) % 2 ? '#e4f0f4' : '#d6e8ee');
  grad([[0, '#c9a477'], [1, '#a8845a']], FLOOR, 1920);
  rrect(120, 260, 300, 340, 14, '#ffffff'); rect(134, 274, 272, 312, '#a9dcf5'); rect(266, 274, 8, 312, '#ffffff');
  // the cooker
  rect(560, 1160, 380, FLOOR - 1160, '#e8e8ec'); rect(560, 1160, 380, 26, '#cfd0d6'); rrect(600, 1230, 300, 150, 10, '#3a3a44');
  for (let i = 0; i < 3; i++) { const on = o.knobOff ? 0 : 1; ell(640 + i * 110, 1206, 14, 14, i === 1 && !on ? '#2f8f4e' : '#3a3a44'); }
  // the pan
  const px = 700, py = 1150;
  ell(px, py, 130, 26, '#2a2d36'); rect(px - 130, py - 6, 260, 30, '#2a2d36'); limb([[px + 130, py], [px + 290, py - 20]], 18, '#2a2d36', false);
  ell(px, py - 2, 116, 18, '#c98a2a');
  if (o.lid) { const k = o.lid; g.save(); g.translate(lerp(px - 320, px, k), lerp(py - 240, py - 20, k)); ell(0, 0, 134, 30, '#9aa2b0'); ell(0, -8, 24, 12, '#5a6070'); g.restore(); }
  flames(px, py - 10, 220, 240, t, o.fire ?? 1);
  if ((o.ball ?? 0) > 0) { const b = o.ball; g.save(); g.globalAlpha = 1 - clamp((b - 0.6) / 0.4); for (let i = 0; i < 9; i++) { const a = -Math.PI / 2 + (i - 4) * 0.33, d = 380 * b; ell(px + Math.cos(a) * d * 0.9, py - 60 + Math.sin(a) * d, 120 * b + 30, 100 * b + 26, i % 2 ? '#ff9f1c' : '#ff6b1c'); } ell(px, py - 200 * b, 220 * b, 180 * b, '#ffe066'); g.restore(); }
}
// a corridor; smoke fills from the ceiling down to y = smokeY
export function corridor(t, smokeY = 0) {
  grad([[0, '#f3ead8'], [1, '#e8dcc4']], 0, FLOOR);
  for (let i = 0; i < 4; i++) { rect(80 + i * 260, 760, 140, FLOOR - 760, '#b07a4a'); ell(190 + i * 260, 1100, 9, 9, '#e8c45a'); }
  rect(0, FLOOR - 20, 1080, 20, '#8a6a4a'); grad([[0, '#c9a477'], [1, '#a8845a']], FLOOR, 1920);
  rrect(860, 300, 140, 70, 10, '#2f8f4e'); g.fillStyle = '#ffffff'; g.font = '700 34px Oswald'; g.textAlign = 'center'; g.fillText('ВЫХОД', 930, 348);
  if (smokeY > 0) {
    grad([[0, 'rgba(70,70,80,0.95)'], [0.85, 'rgba(110,110,120,0.85)'], [1, 'rgba(140,140,150,0)']], 0, smokeY + 120);
    for (let i = 0; i < 14; i++) ell((i * 97 + t * 40) % 1180 - 50, smokeY - 30 + 30 * Math.sin(t * 1.5 + i), 110, 60, 'rgba(110,110,120,0.6)');
  }
}
// a block of flats cut open: the lift shaft on the left (o.smoke 0…1 filling it), the stairs on the right
export function shaft(t, o = {}) {
  grad([[0, '#8fcaf0'], [1, '#e2f2fa']], 0, 1920);
  rect(120, 160, 840, 1400, '#e8dcc4'); rect(120, 160, 840, 24, '#c9b89a');
  for (let k = 0; k < 7; k++) rect(120, 300 + k * 180, 840, 14, '#c9b89a');
  // the shaft
  rect(170, 184, 260, 1376, '#5a5e68'); limb([[300, 184], [300, 900]], 3, '#2a2a2a', false);
  rect(200, 900, 200, 200, '#9aa2b0'); rect(214, 914, 172, 172, '#c9d0da'); rect(298, 914, 4, 172, '#9aa2b0');
  if ((o.smoke ?? 0) > 0) { const k = o.smoke; for (let i = 0; i < 10; i++) { const u = ((t * 0.5 + i / 10) % 1); ell(300 + 50 * Math.sin(t + i), lerp(1500, 200, u), 90 * k, 60 * k, `rgba(70,70,80,${0.7 * k})`); } }
  // the stairs
  for (let k = 0; k < 7; k++) { const fy = 300 + k * 180 + 180; limb([[520, fy - 10], [900, fy - 170]], 12, '#9a8a6a', false); for (let j = 0; j < 9; j++) rect(520 + j * 42, fy - 22 - j * 18, 44, 8, '#9a8a6a'); }
  flames(700, 300 + 180 * 2 + 160, 260, 160, t, o.fire ?? 0.8);
  rect(0, 1560, 1080, 360, '#b8bcc4');
}
export function card(x, y, s, kind, t) {
  g.save(); g.translate(x, y); g.scale(s, s); g.rotate(0.04 * Math.sin(t * 2 + x));
  rrect(-140 + 8, -180 + 10, 280, 360, 30, 'rgba(0,0,0,0.25)'); rrect(-140, -180, 280, 360, 30, '#fff3d6');
  if (kind === 'pan') { ell(0, 60, 90, 18, '#2a2d36'); limb([[90, 60], [150, 50]], 12, '#2a2d36', false); flames(0, 56, 150, 160, t); g.save(); g.translate(-60, -110); g.rotate(-0.5); rrect(-24, -30, 48, 70, 10, '#3aa6cf'); g.restore(); }
  else if (kind === 'smoke') { rect(-140, -180, 280, 150, 'rgba(90,90,100,0.85)'); ell(-10, 110, 26, 26, '#f2c19b'); limb([[-10, 130], [80, 140]], 26, '#f2782f', false); limb([[80, 140], [130, 150]], 18, '#4a6a3a', false); }
  else { rect(-110, -150, 100, 300, '#5a5e68'); rect(-100, -40, 80, 90, '#c9d0da'); for (let i = 0; i < 4; i++) ell(-60 + 10 * Math.sin(i), -120 + i * 30, 30, 20, 'rgba(70,70,80,0.7)'); for (let j = 0; j < 6; j++) rect(10 + j * 20, 120 - j * 40, 40, 8, '#9a8a6a'); }
  g.restore();
}
