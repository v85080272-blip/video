// The places and creatures of «Правда или миф» №1 in flat shapes, straight in screen space: the forest floor and a viper,
// the beach with the shallows and a jellyfish, the bog of quicksand; the cards of the hook (snake, jellyfish, sand).
import { lerp, clamp, TAU, hash } from './lib.js';
import { g, ell, limb, rect, rrect, fill, poly, smoothPath, polyPath } from './flat.js';

function grad(stops, y0 = 0, y1 = 1920) { const gr = g.createLinearGradient(0, y0, 0, y1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); g.fillStyle = gr; g.fillRect(0, y0, 1080, y1 - y0); }

// the forest: green light, trunks, ferns; the floor from y
export function forest(t, y = 1250) {
  grad([[0, '#9cc7a0'], [0.6, '#5f8f63'], [1, '#2f5a36']], 0, y);
  for (let i = 0; i < 9; i++) { const x = (i * 141 + 30) % 1140 - 30, w = 50 + 40 * hash(i); rect(x, 0, w, y, i % 2 ? '#4a3a2a' : '#5a4632'); }
  for (let i = 0; i < 22; i++) ell(1080 * hash(i * 1.9), 160 + 600 * hash(i * 2.3), 140, 90, i % 3 ? '#3f7a48' : '#2f6a3a');
  grad([[0, '#5a4a32'], [1, '#3a2f20']], y, 1920);
  for (let i = 0; i < 12; i++) { const x = 1080 * hash(i * 3.3), yy = y + 40 + 500 * hash(i * 1.1); for (let k = -2; k <= 2; k++) limb([[x, yy], [x + k * 40, yy - 90 + Math.abs(k) * 20]], 8, '#3f7a48', false); }
}
// a viper: a thick zigzag body with a darker pattern, the head up, the tongue flicking; coiled at (x, y)
export function snake(x, y, s, t, strike = 0) {
  g.save(); g.translate(x, y); g.scale(s, s);
  const pts = []; for (let i = 0; i <= 16; i++) { const u = i / 16; pts.push([-260 + 420 * u, 20 * Math.sin(u * 9 + t * 3) - 10 * u]); }
  const head = [lerp(170, 300, strike), lerp(-120, -60, strike)];
  pts.push([170, -40], head);
  limb(pts, 56, '#8a7a3a', true); limb(pts, 18, '#4a3e1c', true);
  g.save(); g.translate(head[0], head[1]); g.rotate(-0.3 + 0.3 * strike);
  fill(smoothPath([[-30, -34], [40, -30], [70, 0], [40, 30], [-30, 34], [-50, 0]]), '#8a7a3a');
  ell(30, -14, 8, 8, '#f2d84a'); ell(32, -14, 3, 6, '#17162f');
  if ((t * 4) % 1 < 0.5) limb([[68, 6], [100, 10], [112, 0]], 4, '#d9433b', false);
  g.restore(); g.restore();
}
// the beach: sky, sea, sand; the shallows line at y
export function beach(t, y = 1250) {
  grad([[0, '#8fd0f0'], [1, '#d9f0f8']], 0, 760);
  rect(0, 700, 1080, 80, '#2a8cb8'); for (let i = 0; i < 8; i++) limb([[(i * 170 + t * 30) % 1180 - 60, 720 + 8 * (i % 3)], [(i * 170 + t * 30) % 1180 + 40, 720 + 8 * (i % 3)]], 4, 'rgba(255,255,255,0.6)', false);
  grad([[0, '#3aa6cf'], [1, '#7ccbe3']], 760, y + 40);
  grad([[0, '#f0d9a0'], [1, '#d9bd7c']], y, 1920);
  for (let i = 0; i < 6; i++) { const yy = y - 10 + 6 * Math.sin(t * 2 + i); limb([[i * 200 - 40, yy], [i * 200 + 120, yy + 6]], 10, 'rgba(255,255,255,0.75)', false); }
}
// a jellyfish: a translucent pink dome and trailing tentacles; at (x, y)
export function jellyfish(x, y, s, t) {
  g.save(); g.translate(x, y); g.scale(s, s);
  for (let k = 0; k < 6; k++) { const pts = []; for (let i = 0; i <= 10; i++) pts.push([-60 + k * 24 + 14 * Math.sin(t * 3 + i * 0.6 + k), 20 + i * 26]); limb(pts, 6, 'rgba(240,120,170,0.75)', true); }
  fill(smoothPath([[-90, 20], [-80, -40], [-40, -76], [40, -76], [80, -40], [90, 20], [40, 30], [0, 20], [-40, 30]]), 'rgba(250,150,200,0.82)');
  ell(0, -20, 40, 26, 'rgba(255,220,240,0.6)'); g.restore();
}
// the bog of quicksand: a grey-brown flat with puddles, a few reeds; the surface at y
export function bog(t, y = 1150) {
  grad([[0, '#c9d6c0'], [1, '#9db394']], 0, y);
  for (let i = 0; i < 7; i++) ell(1080 * hash(i * 2.1), y - 40 - 120 * hash(i), 160, 60, '#7a9a6a');
  grad([[0, '#9a8460'], [1, '#6e5a3c']], y, 1920);
  for (let i = 0; i < 10; i++) ell(1080 * hash(i * 1.7), y + 60 + 600 * hash(i * 3.1), 90, 22, 'rgba(70,56,36,0.35)');
  for (let i = 0; i < 8; i++) { const x = 60 + i * 140; limb([[x, y + 20], [x + 6 + 6 * Math.sin(t + i), y - 140]], 6, '#6a7a4a', false); }
}
// the sand in front: covers what is below line y (the sinking body), with a ring of disturbed sand round x
export function sandOver(t, y, x, w = 260) {
  g.save(); g.beginPath(); g.rect(0, y, 1080, 1920 - y); g.clip();
  const gr = g.createLinearGradient(0, y, 0, 1920); gr.addColorStop(0, '#9a8460'); gr.addColorStop(1, '#6e5a3c'); g.fillStyle = gr; g.fillRect(0, y, 1080, 1920 - y);
  g.restore();
  for (let i = 0; i < 9; i++) ell(x - w / 2 + w * i / 8, y + 4 + 4 * Math.sin(t * 2 + i), 34, 10, '#8a744f');
}
// the hook's card: a rounded card with a symbol drawn in it and a question mark
export function card(x, y, s, kind, t, label) {
  g.save(); g.translate(x, y); g.scale(s, s); g.rotate(0.04 * Math.sin(t * 2 + x));
  rrect(-140 + 8, -180 + 10, 280, 360, 30, 'rgba(0,0,0,0.45)'); rrect(-140, -180, 280, 360, 30, '#fff3d6');
  if (kind === 'snake') snake(-20, 20, 0.42, t);
  else if (kind === 'jelly') jellyfish(0, -10, 0.9, t);
  else { ell(0, 40, 110, 40, '#9a8460'); limb([[-30, 20], [-30, -60]], 22, '#f2782f', false); ell(-30, -80, 26, 26, '#f2c19b'); limb([[10, 20], [40, -40]], 14, '#f2c19b', false); }
  g.restore();
}
