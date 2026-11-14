// The places and things of «Правда или миф», №4 «Землетрясение» in flat shapes, straight in screen space: a bright flat
// (a wall with a window, a shelf of books and a vase, a swinging lamp, a doorway with its door, a sturdy wooden table),
// things falling and flying, the street outside a block of flats with glass and bricks falling from it, the hook's cards.
import { lerp, clamp, TAU, hash } from './lib.js';
import { g, ell, limb, rect, rrect, fill, poly, smoothPath, polyPath, rrPath } from './flat.js';

export const FLOOR = 1420;
function grad(stops, y0 = 0, y1 = 1920) { const gr = g.createLinearGradient(0, y0, 0, y1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); g.fillStyle = gr; g.fillRect(0, y0, 1080, y1 - y0); }

// the flat; o.shake 0…1 how hard it shakes (the lamp swings, things wobble); o.fall 0…1 how far the shelf things have flown
export function room(t, o = {}) {
  const sh = o.shake ?? 0;
  grad([[0, '#f6e7cf'], [1, '#ecd8b8']], 0, FLOOR);
  for (let i = 0; i < 12; i++) rect(i * 96, 0, 4, FLOOR, 'rgba(200,170,130,0.25)');
  grad([[0, '#c08a5a'], [1, '#9c6a40']], FLOOR, 1920);
  for (let i = 0; i < 8; i++) rect(0, FLOOR + 40 + i * 64, 1080, 3, 'rgba(90,60,30,0.25)');
  // the window
  rrect(90, 420, 300, 380, 12, '#ffffff'); rect(104, 434, 272, 352, '#a9dcf5'); rect(236, 434, 8, 352, '#ffffff'); rect(104, 606, 272, 8, '#ffffff');
  ell(180, 500, 60, 22, 'rgba(255,255,255,0.9)');
  // the doorway on the right with its door
  rect(800, 560, 220, FLOOR - 560, '#7a5236'); rect(820, 580, 180, FLOOR - 580, '#5a3a22');
  const sw = o.door ?? 0;
  g.save(); g.translate(1000, 580); g.scale(lerp(1, -0.6, sw), 1); rect(-180, 0, 180, FLOOR - 580, '#b07a4a'); ell(-150, (FLOOR - 580) / 2, 10, 10, '#e8c45a'); g.restore();
  // the shelf with books and a vase
  rect(460, 520, 260, 16, '#7a5236');
  const f = o.fall ?? 0;
  for (let i = 0; i < 6; i++) {
    const bx = 470 + i * 34, by = 520, fx = bx + (i - 2) * 60 * f + 40 * f, fy = by + (FLOOR - 560) * f * f * (0.8 + 0.2 * hash(i)), a = f * (i % 2 ? 2.4 : -1.8);
    g.save(); g.translate(fx + 14 * sh * Math.sin(t * 40 + i), fy - 60); g.rotate(a); rect(-14, -60 + 60, 28, 60, ['#d9433b', '#3a6aa8', '#e0a030', '#2f8f4e', '#8a4ad0', '#d9433b'][i]); g.restore();
  }
  { const fx = 690 + 120 * f, fy = 470 + (FLOOR - 520) * f * f; g.save(); g.translate(fx, fy); g.rotate(f * 3); fill(smoothPath([[-22, 50], [-30, 10], [-12, -40], [12, -40], [30, 10], [22, 50]]), '#3aa6cf'); g.restore(); }
  // the lamp on its cord
  const a = sh * 0.45 * Math.sin(t * 9);
  g.save(); g.translate(560, 0); g.rotate(a); limb([[0, 0], [0, 260]], 4, '#3a3a44', false); poly([[-60, 330], [-30, 260], [30, 260], [60, 330]], '#ffd23f'); ell(0, 334, 20, 10, '#fff8d0'); g.restore();
}
// a sturdy wooden table; (x, FLOOR) = the middle of its feet line
export function table(x, s = 1) {
  g.save(); g.translate(x, FLOOR); g.scale(s, s);
  rect(-230, -300, 460, 34, '#8a5a32'); rect(-230, -270, 460, 10, '#6a4224');
  for (const lx of [-210, 180]) rect(lx, -266, 30, 266, '#7a4e2a');
  g.restore();
}
// cracks on the wall
export function wallCracks(k) {
  if (k <= 0.01) return;
  for (const [x, y, a] of [[300, 300, 0.6], [760, 380, 2.3], [420, 900, 1.2]]) {
    const pts = [[x, y]]; for (let i = 1; i <= 5; i++) pts.push([x + Math.cos(a) * 60 * i * k + 14 * (hash(i + x) - 0.5), y + Math.sin(a + 0.6) * 60 * i * k]);
    limb(pts, 5, 'rgba(90,60,40,0.7)', false);
  }
}
// outside: a block of flats with glass and bricks falling off it (fall 0…1), the pavement
export function street(t, fall = 0) {
  grad([[0, '#8fcaf0'], [1, '#e2f2fa']], 0, 1300);
  rect(120, 120, 840, 1180, '#d8c8b0'); rect(120, 120, 840, 30, '#b8a890');
  for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) { const x = 170 + c * 160, y = 200 + r * 150; rect(x, y, 100, 100, '#9fd3ea'); rect(x + 46, y, 8, 100, '#ffffff'); }
  rect(470, 1130, 140, 170, '#5a3a22');
  grad([[0, '#b8bcc4'], [1, '#9aa0aa']], 1300, 1920);
  for (let i = 0; i < 18; i++) {
    const x0 = 170 + 800 * hash(i * 1.7), y0 = 260 + 900 * hash(i * 2.9), d = clamp(fall * 1.4 - 0.4 * hash(i * 5)), y = y0 + (1500 - y0) * d * d, x = x0 + 40 * d * (hash(i) - 0.5);
    g.save(); g.translate(x, y); g.rotate(d * 6 * (hash(i * 3) - 0.5));
    if (i % 3) poly([[-18, -10], [16, -18], [10, 14], [-12, 16]], 'rgba(200,235,250,0.9)'); else rect(-22, -12, 44, 24, '#a8423a');
    g.restore();
  }
}
// the hook's card
export function card(x, y, s, kind, t) {
  g.save(); g.translate(x, y); g.scale(s, s); g.rotate(0.04 * Math.sin(t * 2 + x));
  rrect(-140 + 8, -180 + 10, 280, 360, 30, 'rgba(0,0,0,0.25)'); rrect(-140, -180, 280, 360, 30, '#fff3d6');
  if (kind === 'door') { rect(-70, -130, 140, 260, '#7a5236'); rect(-56, -116, 112, 246, '#5a3a22'); g.save(); g.translate(56, -116); g.scale(0.5, 1); rect(-112, 0, 112, 246, '#b07a4a'); g.restore(); ell(-6, 40, 18, 18, '#f2c19b'); rect(-20, 56, 30, 70, '#f2782f'); }
  else if (kind === 'table') { rect(-110, -10, 220, 18, '#8a5a32'); rect(-100, 8, 14, 110, '#7a4e2a'); rect(86, 8, 14, 110, '#7a4e2a'); ell(-10, 70, 22, 22, '#f2c19b'); rect(-40, 80, 60, 40, '#f2782f'); for (let i = 0; i < 3; i++) rect(-60 + i * 50, -80 - i * 20, 30, 40, ['#d9433b', '#3a6aa8', '#e0a030'][i]); }
  else { rect(-110, -150, 220, 220, '#d8c8b0'); for (let i = 0; i < 4; i++) rect(-90 + (i % 2) * 110, -130 + Math.floor(i / 2) * 100, 70, 70, '#9fd3ea'); for (let i = 0; i < 6; i++) poly([[-80 + i * 34, 90 + (i % 2) * 20], [-66 + i * 34, 80], [-60 + i * 34, 100]], 'rgba(150,200,230,0.95)'); ell(60, 120, 18, 18, '#f2c19b'); }
  g.restore();
}
