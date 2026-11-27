// The places and things of «Правда или миф», №3 «Гроза» in flat shapes, straight in screen space: a bright summer
// meadow under a storm coming in (o.dark: how far the cloud has covered the sky), a lone tree, lightning bolts, the ground
// current spreading from a strike, a tall TV tower, a small house, a hard-topped car with the current running round its
// metal body, and the hook's cards (a tree with a bolt, the tower, the car).
import { lerp, clamp, TAU, hash } from './lib.js';
import { g, ell, limb, rect, rrect, fill, poly, smoothPath, polyPath, rrPath } from './flat.js';

function grad(stops, y0 = 0, y1 = 1920) { const gr = g.createLinearGradient(0, y0, 0, y1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); g.fillStyle = gr; g.fillRect(0, y0, 1080, y1 - y0); }
const mixc = (a, b, k) => { const p = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16)); const A = p(a), B = p(b); return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], k))).join(',')})`; };

// the meadow; o.dark 0…1 the storm cloud over the sky; o.flash 0…1 a lightning flash over everything
export function meadow(t, y = 1250, o = {}) {
  const d = clamp(o.dark ?? 0.2);
  grad([[0, mixc('#7ec4ee', '#4a5a72', d)], [1, mixc('#dff1fa', '#9aa8b8', d)]], 0, y);
  if (d < 0.6) { ell(840, 230, 70, 70, `rgba(255,251,230,${1 - d * 1.5})`); }
  // the storm cloud rolling in from the left
  const cx = lerp(-200, 700, d);
  for (let i = 0; i < 9; i++) ell(cx - 520 + i * 120, 150 + 60 * Math.sin(i * 1.7) + 20 * Math.sin(t * 0.6 + i), 220, 120, i % 2 ? '#4a5266' : '#5a6378');
  for (let i = 0; i < 7; i++) ell(cx - 480 + i * 140, 280 + 30 * Math.sin(i * 2.3), 180, 70, '#3c4458');
  fill(smoothPath([[-60, y - 100], [260, y - 220], [560, y - 140], [860, y - 240], [1140, y - 120], [1140, y + 20], [-60, y + 20]]), mixc('#9fd27a', '#6a8a5a', d));
  grad([[0, mixc('#8cc86a', '#5f8250', d)], [1, mixc('#5fa046', '#3f6a36', d)]], y, 1920);
  for (let i = 0; i < 40; i++) { const x = 1080 * hash(i * 1.9), yy = y + 40 + 640 * hash(i * 2.7); limb([[x, yy], [x - 6, yy - 22], [x + 2, yy - 30]], 4, mixc('#4f8a3a', '#355a2a', d), false); }
  if (o.rain) for (let i = 0; i < 70; i++) { const x = (1080 * hash(i * 3.1) + t * 200) % 1180 - 50, yy = (1920 * hash(i * 1.3) + t * 1400) % 1920; limb([[x, yy], [x - 10, yy + 40]], 3, 'rgba(220,235,255,0.55)', false); }
  if ((o.flash ?? 0) > 0) { g.fillStyle = `rgba(255,255,255,${0.6 * o.flash})`; g.fillRect(0, 0, 1080, 1920); }
}
export function tree(x, y, s, t, burn = 0) {
  g.save(); g.translate(x, y); g.scale(s, s);
  limb([[0, 0], [-6, -180], [4, -330]], 46, burn > 0.5 ? '#3a2a1e' : '#6a4a2e', true);
  limb([[0, -200], [-90, -290]], 18, '#6a4a2e', false); limb([[2, -250], [80, -330]], 16, '#6a4a2e', false);
  for (const [cx, cy, r] of [[0, -420, 150], [-120, -340, 110], [120, -350, 110], [-40, -500, 110], [70, -480, 100]]) ell(cx + 6 * Math.sin(t * 2 + cx), cy, r, r * 0.85, burn > 0.5 ? '#2f4a2a' : '#3f8a3a');
  g.restore();
}
// a lightning bolt from (x0, y0) to (x1, y1): a jagged white core with a blue glow; seed varies the zigzag
export function bolt(x0, y0, x1, y1, k = 1, seed = 1) {
  if (k <= 0.01) return;
  const pts = [[x0, y0]]; const n = 9;
  for (let i = 1; i < n; i++) { const u = i / n; pts.push([lerp(x0, x1, u) + 70 * (hash(seed * 7 + i) - 0.5), lerp(y0, y1, u)]); }
  pts.push([x1, y1]);
  g.save(); g.globalAlpha = k; limb(pts, 28, 'rgba(140,180,255,0.45)', false); limb(pts, 9, '#ffffff', false);
  limb([pts[4], [pts[4][0] + 90, pts[4][1] + 80], [pts[4][0] + 130, pts[4][1] + 170]], 4, '#ffffff', false); g.restore();
}
// the current spreading out over the ground from where it struck
export function groundCurrent(x, y, k, t) {
  if (k <= 0.01) return;
  g.save(); g.globalAlpha = 1 - k * 0.6;
  for (let j = 0; j < 8; j++) { const a = (j / 8) * TAU, L = 380 * k; const pts = [[x, y]]; for (let i = 1; i <= 5; i++) pts.push([x + Math.cos(a) * L * i / 5 + 14 * Math.sin(t * 30 + i + j), y + Math.sin(a) * L * 0.25 * i / 5]); limb(pts, 6, '#fff27a', false); }
  g.restore();
}
export function tower(x, y, s) {
  g.save(); g.translate(x, y); g.scale(s, s);
  poly([[-70, 0], [-26, -520], [26, -520], [70, 0]], '#d9dde4'); poly([[-70, 0], [-26, -520], [0, -520], [0, 0]], '#c3c8d2');
  rrect(-60, -620, 120, 100, 20, '#e8eaee'); for (let i = 0; i < 6; i++) rect(-50 + i * 18, -600, 10, 60, '#6aa2d8');
  limb([[0, -620], [0, -1050]], 22, '#d9dde4', false); limb([[0, -1050], [0, -1150]], 8, '#c3c8d2', false);
  for (let i = 0; i < 6; i++) rect(-14, -700 - i * 60, 28, 18, i % 2 ? '#d9433b' : '#ffffff');
  g.restore();
}
export function house(x, y, s) {
  g.save(); g.translate(x, y); g.scale(s, s);
  rect(-160, -220, 320, 220, '#e8d2a8'); poly([[-190, -220], [0, -360], [190, -220]], '#a8423a');
  rect(-40, -130, 80, 130, '#6a4a2e'); rect(-130, -170, 70, 60, '#9fd3ea'); rect(60, -170, 70, 60, '#9fd3ea');
  g.restore();
}
// a hard-topped car seen from the side; o.glow 0…1: the current running round the metal body; o.who: someone inside
export function car(x, y, s, t, o = {}) {
  g.save(); g.translate(x, y); g.scale(s, s);
  const body = smoothPath([[-260, -40], [-250, -120], [-150, -130], [-90, -220], [120, -220], [190, -130], [260, -110], [270, -40]]);
  fill(body, '#d9433b');
  fill(polyPath([[-80, -200], [10, -200], [10, -135], [-130, -135]]), '#9fd3ea'); fill(polyPath([[30, -200], [110, -200], [165, -135], [30, -135]]), '#9fd3ea');
  if (o.who) { ell(-30, -165, 26, 26, '#f2c19b'); ell(-30, -186, 30, 16, '#7a5a3a'); }
  if (o.dog) { ell(80, -160, 22, 20, '#f4efe6'); poly([[66, -176], [72, -200], [80, -178]], '#8f877c'); poly([[86, -178], [94, -200], [98, -174]], '#8f877c'); ell(98, -156, 5, 5, '#17162f'); }
  for (const wx of [-160, 170]) { ell(wx, -30, 52, 52, '#22252e'); ell(wx, -30, 22, 22, '#9aa2b0'); }
  if ((o.glow ?? 0) > 0.01) {
    g.save(); g.globalAlpha = o.glow; g.lineWidth = 12; g.strokeStyle = '#fff27a'; g.shadowColor = '#fff27a'; g.shadowBlur = 30; g.stroke(body); g.restore();
    for (const wx of [-160, 170]) { g.save(); g.globalAlpha = o.glow; limb([[wx, 20], [wx - 40, 60], [wx + 30, 90]], 6, '#fff27a', false); g.restore(); }
  }
  g.restore();
}
// the hook's card
export function card(x, y, s, kind, t) {
  g.save(); g.translate(x, y); g.scale(s, s); g.rotate(0.04 * Math.sin(t * 2 + x));
  rrect(-140 + 8, -180 + 10, 280, 360, 30, 'rgba(0,0,0,0.25)'); rrect(-140, -180, 280, 360, 30, '#fff3d6');
  if (kind === 'tree') { tree(0, 150, 0.42, t); bolt(-90, -170, 0, -40, 1, 3); }
  else if (kind === 'tower') { tower(0, 160, 0.27); bolt(80, -175, 0, -150, 1, 5); bolt(-90, -175, 0, -150, 0.7, 8); }
  else car(0, 90, 0.48, t, { glow: 0.8, who: true });
  g.restore();
}
