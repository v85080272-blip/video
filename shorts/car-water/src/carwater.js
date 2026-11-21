// «Машина упала в воду, ты внутри»: a river with its far bank and the near bank (right), the river surface at y = 0, a car
// in side view floating and sinking nose-down, its windows (the driver seen through the front one), the glass sliding down,
// the water rising inside, the pressure arrows on the door, the headlights under water.
import { lerp, clamp, ease, hash, noise, TAU } from './lib.js';
import { g, ell, limb, rect, rrect, poly, fill, smoothPath, polyPath, rrPath } from './flat.js';

export const BANK_X = 760;                                 // where the near bank begins (right)
// the river scene behind the car: sky, far bank with trees, the bank on the right; the water drawn later (in front)
export function riverBack(t) {
  const sky = g.createLinearGradient(0, -2600, 0, 0); sky.addColorStop(0, '#9fbcd6'); sky.addColorStop(1, '#e3edf3'); g.fillStyle = sky; g.fillRect(-3000, -3000, 6000, 3100);
  fill(smoothPath([[-3000, -60], [-1800, -160], [-900, -120], [0, -180], [900, -130], [3000, -170], [3000, 0], [-3000, 0]]), '#7d9a72');
  for (let i = 0; i < 16; i++) { const x = -2800 + i * 380 + 80 * hash(i), y = -150 - 60 * hash(i * 3); ell(x, y - 120, 120, 140, '#5f7f55'); rect(x - 10, y - 20, 20, 40, '#5d4632'); }
  // the near bank: grass and reeds on the right
  fill(polyPath([[BANK_X, 0], [BANK_X + 140, -110], [3000, -140], [3000, 2000], [BANK_X - 100, 2000]]), '#6f8f4a');
  for (let i = 0; i < 14; i++) { const x = BANK_X + 40 + i * 30; limb([[x, -40 - 30 * hash(i)], [x + 10 * Math.sin(t + i), -170 - 60 * hash(i * 2)]], 6, '#55703a'); }
}
// the river: a surface line with ripples, the body of water below (alpha so the car shows through), rings where it splashes
export function river(t, o = {}) {
  const x0 = -3000, x1 = BANK_X + 60;
  g.beginPath(); g.moveTo(x0, 2000);
  for (let x = x0; x <= x1; x += 40) g.lineTo(x, 8 * Math.sin(x * 0.01 - t * 2) + 4 * noise(x * 0.02 + t, 1));
  g.lineTo(x1 + 200, 2000); g.closePath();
  const gr = g.createLinearGradient(0, 0, 0, 1400); gr.addColorStop(0, 'rgba(70,120,140,0.62)'); gr.addColorStop(1, 'rgba(20,45,60,0.92)');
  g.fillStyle = gr; g.fill();
  g.save(); g.lineWidth = 5; g.strokeStyle = 'rgba(230,240,245,0.8)'; g.beginPath();
  for (let x = x0; x <= x1; x += 40) { const y = 8 * Math.sin(x * 0.01 - t * 2) + 4 * noise(x * 0.02 + t, 1); x === x0 ? g.moveTo(x, y) : g.lineTo(x, y); }
  g.stroke(); g.restore();
  if (o.splash > 0.01) for (let i = 0; i < 4; i++) { const ph = (t * 0.9 + i / 4) % 1; g.save(); g.globalAlpha = o.splash * (1 - ph); g.lineWidth = 6; g.strokeStyle = '#eef6fa'; g.beginPath(); g.ellipse(o.sx ?? 0, 4, 200 + 600 * ph, 20 + 40 * ph, 0, 0, TAU); g.stroke(); g.restore(); }
}
// the car body as a path with its two windows cut out (local coords: length 900, the wheels' bottom at y = 60)
const OUTER = [[-450, -20], [-452, -150], [-320, -185], [-230, -340], [215, -340], [320, -190], [455, -160], [455, -20]];
const WIN_R = [[-250, -318], [-20, -318], [-20, -195], [-300, -195]];
const WIN_F = [[0, -318], [200, -318], [285, -195], [0, -195]];
export const SEAT = [100, -140];                            // where the driver sits (local)
export function carFrame(x, y, a, s, fn) { g.save(); g.translate(x, y); g.rotate(a); g.scale(s, s); fn(); g.restore(); }
// the car: o.glass 0…1 how far the front window is down, o.inside 0…1 the water level inside (0 empty, 1 full), o.lights 0…1
export function car(t, o = {}) {
  const body = polyPath(OUTER); const hole = (p) => { body.moveTo(...p[0]); for (const q of p.slice(1)) body.lineTo(...q); body.closePath(); };
  hole(WIN_R); hole(WIN_F);
  g.save(); g.fillStyle = '#c94a3a'; g.fill(body, 'evenodd'); g.restore();
  rect(-452, -110, 907, 12, '#a43b2e'); limb([[-10, -190], [-10, -30]], 4, '#8f3428'); rrect(30, -110, 60, 14, 6, '#e6e6e6');
  // the glass: the front pane slides down into the door
  const gl = clamp(o.glass ?? 0);
  g.save(); g.globalAlpha = 0.35; fill(polyPath(WIN_R), '#cfe6f2');
  const top = lerp(-318, -195, gl); if (gl < 0.98) fill(polyPath([[0, top], [200 + 85 * (top + 318) / 123, top], [285, -195], [0, -195]]), '#cfe6f2'); g.restore();
  // the water inside: it rises in the windows
  const inside = clamp(o.inside ?? 0);
  if (inside > 0.01) { const wy = lerp(-195, -318, inside); g.save(); g.globalAlpha = 0.6; for (const w of [WIN_R, WIN_F]) { g.save(); g.clip(polyPath(w)); rect(-460, wy, 920, 200, '#3f7e98'); g.restore(); } g.restore(); }
  for (const wx of [-280, 290]) { ell(wx, 0, 66, 66, '#2b2f38'); ell(wx, 0, 28, 28, '#9aa3ad'); }
  // the headlights: a lamp at the front and a beam
  ell(448, -120, 12, 22, o.lights ? '#fff6c8' : '#e9e2c8');
  if (o.lights > 0.01) { g.save(); g.globalAlpha = 0.5 * o.lights; const gr = g.createLinearGradient(450, 0, 1300, 0); gr.addColorStop(0, 'rgba(255,246,200,0.9)'); gr.addColorStop(1, 'rgba(255,246,200,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(450, -130); g.lineTo(1300, -330); g.lineTo(1300, 120); g.closePath(); g.fill(); g.restore(); }
}
// the arrows of water pressing on the door from outside (local coords), k 0…1
export function pressure(t, k) {
  if (k <= 0.01) return;
  g.save(); g.globalAlpha = k;
  for (let i = 0; i < 4; i++) { const y = -170 + i * 45, ph = (t * 2 + i * 0.25) % 1, x = -40 - 240 + 60 * ph; limb([[x - 120, y], [x, y]], 12, '#2f6fd0', false); poly([[x + 30, y], [x - 6, y - 22], [x - 6, y + 22]], '#2f6fd0'); }
  g.restore();
}
// a swimmer: head and arms above the water at (x, 0)
export function swimmer(t, x, s = 1) {
  const ph = t * 5;
  g.save(); g.translate(x, 0); g.scale(s, s);
  limb([[-20, -10], [-60 + 30 * Math.sin(ph), -70 + 30 * Math.cos(ph)]], 22, '#f0c8a0'); limb([[20, -10], [60 - 30 * Math.sin(ph), -70 - 30 * Math.cos(ph)]], 22, '#f0c8a0');
  ell(0, -40, 34, 38, '#f0c8a0'); ell(-4, -66, 32, 18, '#5b3a22'); fill(smoothPath([[-30, -36], [-20, -6], [20, -6], [30, -36], [0, -20]]), '#5b3a22');
  g.restore();
}
// the headlights seen through the water (drawn after the river, in the car's frame): a bright lamp and a cone of light
export function beam(t, k) {
  if (k <= 0.01) return;
  g.save(); g.globalCompositeOperation = 'lighter';
  const fl = 0.9 + 0.1 * Math.sin(t * 9);
  g.globalAlpha = 0.55 * k * fl;
  const gr = g.createLinearGradient(450, 0, 1500, 0); gr.addColorStop(0, 'rgba(255,240,170,0.95)'); gr.addColorStop(1, 'rgba(255,240,170,0)');
  g.fillStyle = gr; g.beginPath(); g.moveTo(450, -135); g.lineTo(1500, -420); g.lineTo(1500, 200); g.closePath(); g.fill();
  g.globalAlpha = k * fl;
  const r = g.createRadialGradient(450, -120, 0, 450, -120, 120); r.addColorStop(0, 'rgba(255,250,210,1)'); r.addColorStop(1, 'rgba(255,250,210,0)');
  g.fillStyle = r; g.fillRect(330, -240, 240, 240);
  g.restore();
}
