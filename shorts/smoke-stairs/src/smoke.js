// «Дым в подъезде, ты дома»: smoke (puffs, wisps under a door, a layer under the ceiling), the far room with its window,
// the block's facade with our balcony and the stairwell windows smoking, the floor-plan card, the back of a hand.
// World units as in landing.js / the hall: the floor at y = 0, up is negative.
import { lerp, clamp, ease, hash, noise, TAU } from './lib.js';
import { g, ell, limb, rect, rrect, poly, fill, smoothPath, polyPath, rrPath } from './flat.js';
import { text, FONTS, INK } from './type.js';

const SMOKE = ['#6d6f78', '#7c7e86', '#5f6169', '#8a8c93'];
// one soft grey puff
export function puff(x, y, r, a, c = 0) {
  if (a <= 0.01 || r <= 1) return;
  const col = SMOKE[c % SMOKE.length];
  const gr = g.createRadialGradient(x, y, r * 0.1, x, y, r);
  gr.addColorStop(0, hexA(col, 0.9 * a)); gr.addColorStop(0.6, hexA(col, 0.55 * a)); gr.addColorStop(1, hexA(col, 0));
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
}
function hexA(h, a) { const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${clamp(a)})`; }

// wisps curling in through the gaps of a door (x0…x1, top…0): under it and along its top edge; k 0…1 how much
export function doorWisps(t, x0, x1, top, k) {
  if (k <= 0.01) return;
  for (let i = 0; i < 14; i++) {
    const ph = (t * 0.35 + hash(i * 3.1)) % 1, sx = lerp(x0, x1, hash(i * 7.7));
    const x = sx + 260 * ph * (hash(i) - 0.4) + 40 * noise(t * 0.8 + i, 1), y = -8 - 340 * ph;
    puff(x, y, 40 + 150 * ph, k * (1 - ph) * (1 - ph) * 0.5, i);
  }
  for (let i = 0; i < 8; i++) {
    const ph = (t * 0.3 + hash(i * 5.3)) % 1, x = lerp(x0, x1, hash(i * 2.9)) + 40 * noise(t + i, 2);
    puff(x, top - 10 - 60 * ph, 30 + 70 * ph, k * (1 - ph) * 0.35, i + 1);
  }
}
// a smoky haze over an area, with puffs drifting up; k 0…1
export function haze(t, x0, x1, y0, y1, k, n = 26) {
  if (k <= 0.01) return;
  g.save(); g.globalAlpha = 0.28 * k; rect(x0, y0, x1 - x0, y1 - y0, '#55575f'); g.restore();
  for (let i = 0; i < n; i++) {
    const ph = (t * 0.12 + hash(i * 4.3)) % 1, x = lerp(x0, x1, hash(i * 1.7)) + 60 * noise(t * 0.5 + i, 3);
    puff(x, lerp(y1, y0, ph), 100 + 100 * hash(i * 9.1), k * 0.45 * Math.sin(ph * Math.PI), i);
  }
}
// the smoke under the ceiling, its lower edge at y = bottom, waving
export function ceilingSmoke(t, x0, x1, ceil, bottom, k) {
  if (k <= 0.01) return;
  const pts = [[x0, ceil]];
  for (let x = x0; x <= x1; x += 60) pts.push([x, bottom + 26 * Math.sin(x * 0.012 + t * 1.3) + 14 * noise(x * 0.01 + t * 0.4, 5)]);
  pts.push([x1, ceil]);
  const gr = g.createLinearGradient(0, ceil, 0, bottom + 40); gr.addColorStop(0, `rgba(70,72,80,${0.92 * k})`); gr.addColorStop(1, `rgba(110,112,120,${0.55 * k})`);
  g.fillStyle = gr; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fill();
  for (let i = 0; i < 12; i++) { const x = lerp(x0, x1, (i + 0.5) / 12) + 40 * noise(t * 0.6 + i, 6); puff(x, bottom - 10, 70 + 30 * hash(i), k * 0.7, i); }
}
// a warm orange flicker of fire behind a door's gaps (x0…x1, top…0)
export function fireGlow(t, x0, x1, top, k) {
  if (k <= 0.01) return;
  const fl = 0.75 + 0.25 * noise(t * 9, 7);
  const gr = g.createLinearGradient(0, 0, 0, -160); gr.addColorStop(0, `rgba(255,140,40,${0.7 * k * fl})`); gr.addColorStop(1, 'rgba(255,140,40,0)');
  g.fillStyle = gr; g.fillRect(x0 - 60, -160, x1 - x0 + 120, 170);
  limb([[x0, -2], [x1, -2]], 6, `rgba(255,190,90,${k * fl})`, false);
  limb([[x0 - 4, top], [x0 - 4, 0]], 4, `rgba(255,170,70,${0.7 * k * fl})`, false);
}

// —— the far room: wallpaper, the door to the hall (left), the window over the sofa (right) ——
export const ROOM2 = { door: { x0: -440, x1: -270, top: -560 }, win: { x0: 150, x1: 420, y0: -600, y1: -300 }, ceil: -760 };
export function farRoom(t, o = {}) {
  const R = ROOM2;
  rect(-1100, R.ceil, 2200, -R.ceil, '#cfe0e6');
  for (let x = -1080; x < 1100; x += 70) rect(x, R.ceil, 4, -R.ceil, 'rgba(90,120,140,0.12)');
  rect(-1100, R.ceil - 60, 2200, 60, '#e8eef0'); rect(-1100, -24, 2200, 24, '#b7c9d0'); rect(-1100, 0, 2200, 700, '#9a7350');
  for (let i = 0; i < 30; i++) rect(-1100 + i * 80, 0, 3, 700, 'rgba(0,0,0,0.12)');
  // the door to the hall, shut
  const D = R.door;
  rect(D.x0 - 16, D.top - 16, D.x1 - D.x0 + 32, -D.top + 16, '#f2efe6');
  rrect(D.x0, D.top, D.x1 - D.x0, -D.top, 4, '#e1d6c0'); rrect(D.x0 + 20, D.top + 30, D.x1 - D.x0 - 40, 220, 6, '#d4c8ae'); rrect(D.x0 + 20, D.top + 290, D.x1 - D.x0 - 40, 220, 6, '#d4c8ae');
  ell(D.x1 - 26, -280, 10, 10, '#b9a27a');
  // the window: the dusk outside, the sill
  const Wn = R.win;
  rect(Wn.x0 - 16, Wn.y0 - 16, Wn.x1 - Wn.x0 + 32, Wn.y1 - Wn.y0 + 32, '#f4f1ea');
  const sky = g.createLinearGradient(0, Wn.y0, 0, Wn.y1); sky.addColorStop(0, '#34466e'); sky.addColorStop(1, '#e49a6a'); g.fillStyle = sky; g.fillRect(Wn.x0, Wn.y0, Wn.x1 - Wn.x0, Wn.y1 - Wn.y0);
  for (let i = 0; i < 4; i++) rect(Wn.x0 + 10 + i * 70, Wn.y1 - 90 - 50 * hash(i + 3), 56, 100, '#2b3350');
  rect((Wn.x0 + Wn.x1) / 2 - 6, Wn.y0, 12, Wn.y1 - Wn.y0, '#f4f1ea');
  rect(Wn.x0 - 30, Wn.y1 + 16, Wn.x1 - Wn.x0 + 60, 22, '#ebe6dc');
  // the sofa under the window
  rrect(120, -230, 340, 150, 30, '#5f7fa8'); rrect(110, -150, 360, 120, 24, '#6e8fb8'); rect(140, -30, 20, 30, '#3b3f48'); rect(420, -30, 20, 30, '#3b3f48');
  // smoke in the gaps of the door, then under the ceiling
  doorWisps(t, D.x0, D.x1, D.top, o.wisps ?? 0);
  ceilingSmoke(t, -1100, 1100, R.ceil - 60, lerp(R.ceil - 60, -300, clamp(o.smoke ?? 0)), clamp((o.smoke ?? 0) * 3));
}

// —— outside: the panel block's facade with our balcony at y = 0 (x −330…330); the stairwell windows on the right
// smoke; o.door 0…1 the balcony door open; floors above and below ——
const FL = 640;                                        // one floor in world units here
export function facade(t, o = {}) {
  const sky = g.createLinearGradient(0, -2000, 0, 1200); sky.addColorStop(0, '#26355a'); sky.addColorStop(1, '#c97e5e'); g.fillStyle = sky; g.fillRect(-2000, -2400, 4000, 4000);
  rect(-1300, -2200, 2600, 3600, '#c9c3b5');
  for (let f = -3; f <= 2; f++) {
    const y = f * FL;
    rect(-1300, y + 40, 2600, 8, 'rgba(0,0,0,0.12)');
    // the neighbours' windows on the left
    for (const wx of [-900, -620]) { rect(wx - 100, y - 470, 200, 270, '#f4f1ea'); rect(wx - 88, y - 458, 176, 246, hash(f * 3 + wx) > 0.5 ? '#ffd98a' : '#3d4a63'); rect(wx - 4, y - 458, 8, 246, '#f4f1ea'); }
    // the balconies in our column (ours at f = 0)
    if (f !== 0) { rect(-330, y - 150, 660, 150, '#9fb3c4'); rect(-340, y - 4, 680, 44, '#8f8a80'); rect(-120, y - 470, 180, 320, '#3d4a63'); }
    // the stairwell: narrow windows between the floors, smoke and an orange glow in them
    const sy = y - 360;
    rect(450, sy - 160, 170, 260, '#f4f1ea');
    const glow = f >= -1 && f <= 1 ? 0.6 + 0.4 * noise(t * 6 + f, 4) : 0.2;
    rect(462, sy - 148, 146, 236, `rgb(${Math.round(lerp(60, 230, glow))},${Math.round(lerp(64, 120, glow))},${Math.round(lerp(80, 50, glow))})`);
  }
  // smoke pouring out of the stairwell and up the wall
  for (let i = 0; i < 26; i++) {
    const ph = (t * 0.18 + hash(i * 2.3)) % 1, f = (i % 3) - 1, x = 535 + 160 * ph * (hash(i) - 0.2) + 40 * noise(t + i, 8), y = f * FL - 400 - 900 * ph;
    puff(x, y, 90 + 200 * ph, 0.8 * (1 - ph * 0.8), i);
  }
  // our balcony: the door (open k), the window
  const dk = clamp(o.door ?? 0);
  rect(-140, -490, 220, 490, '#f4f1ea'); rect(-124, -474, 188, 474, '#2a2f3d');
  const lw = 188 * (1 - 0.8 * dk);
  fill(rrPath(-124, -474, lw, 474, 2), 'rgba(170,200,220,0.85)'); g.lineWidth = 10; g.strokeStyle = '#f4f1ea'; g.stroke(rrPath(-119, -469, lw - 10, 464, 2));
  rect(100, -490, 220, 290, '#f4f1ea'); rect(114, -476, 192, 262, '#3d4a63');
  if (o.smokeIn) { g.save(); g.beginPath(); g.rect(-124, -474, 188, 474); g.clip(); haze(t, -124, 64, -474, 0, o.smokeIn * dk, 6); g.restore(); }
}
// the balcony's front: the railing panel and the slab, drawn over him
export function railing() {
  rect(-330, -170, 660, 170, '#a9bccc'); for (let i = 0; i < 6; i++) rect(-320 + i * 110, -170, 6, 170, 'rgba(0,0,0,0.08)');
  rect(-340, -180, 680, 16, '#7f93a4');
  rect(-340, -4, 680, 44, '#8f8a80');
}

// —— cards in screen space ——
// the plan of the flat: the front door (smoke coming in), the hall, the kitchen, the far room; he goes to the far room
// and shuts its door; k 0…1 shown, p 0…1 the walk, shut 0…1 the far door
export function planCard(t, cx, cy, k, p, shut) {
  if (k <= 0.01) return;
  g.save(); g.translate(cx, cy); g.scale(k, k); g.rotate(-0.02);
  const w = 760, h = 620;
  g.save(); g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 26; g.shadowOffsetY = 10; rrect(-w / 2, -h / 2, w, h, 22, '#0f1626'); g.restore();
  g.lineWidth = 3; g.strokeStyle = 'rgba(140,196,255,0.25)';
  for (let x = -w / 2 + 40; x < w / 2; x += 40) { g.beginPath(); g.moveTo(x, -h / 2 + 10); g.lineTo(x, h / 2 - 10); g.stroke(); }
  for (let y = -h / 2 + 40; y < h / 2; y += 40) { g.beginPath(); g.moveTo(-w / 2 + 10, y); g.lineTo(w / 2 - 10, y); g.stroke(); }
  const L = (pts, c = '#8cc4ff', wd = 10) => { g.lineWidth = wd; g.strokeStyle = c; g.lineCap = 'round'; g.beginPath(); pts.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.stroke(); };
  // the outer walls with the front door gap at the bottom left; the hall; the kitchen (bottom right); the far room (top)
  L([[-300, 250], [-300, -250], [300, -250], [300, 250], [-130, 250]]); L([[-230, 250], [-300, 250]]);
  L([[-300, 0], [-60, 0]]); L([[30, 0], [300, 0]]); L([[100, 0], [100, 250]]);
  text('ПРИХОЖАЯ', -150, 150, 30, '#8cc4ff', { fam: FONTS.cond, shadow: false });
  text('КУХНЯ', 200, 150, 30, '#8cc4ff', { fam: FONTS.cond, shadow: false });
  text('ДАЛЬНЯЯ', 0, -150, 40, '#3ddc84', { fam: FONTS.cond, shadow: false }); text('КОМНАТА', 0, -105, 40, '#3ddc84', { fam: FONTS.cond, shadow: false });
  // the smoke at the front door
  for (let i = 0; i < 6; i++) { const ph = (t * 0.6 + i / 6) % 1; puff(-180 + 30 * Math.sin(i), 300 - 90 * ph, 22 + 30 * ph, 0.9 * (1 - ph), i); }
  text('ДЫМ', -180, 300, 30, '#e53935', { fam: FONTS.cond, shadow: false });
  // the far room's door: a leaf swinging shut over the gap −60…30
  const a = lerp(-1.2, 0, ease.inOut(clamp(shut)));
  L([[30, 0], [30 + Math.cos(Math.PI + a) * 90, Math.sin(Math.PI + a) * 90]], shut > 0.95 ? '#3ddc84' : '#ffd23f', 10);
  // the walk: dots from the hall to the far room
  const path = [[-180, 120], [-15, 40], [-15, -40], [0, -60]];
  const n = 10;
  for (let i = 0; i <= n; i++) { const u = i / n; if (u > p) break; const q = along(path, u); ell(q[0], q[1], 7, 7, '#ffd23f'); }
  const q = along(path, clamp(p)); ell(q[0], q[1] - 26, 22, 22, '#ffd23f'); poly([[q[0] - 14, q[1] - 14], [q[0] + 14, q[1] - 14], [q[0], q[1] + 6]], '#ffd23f'); ell(q[0], q[1] - 26, 9, 9, '#0f1626');
  g.restore();
}
function along(pts, u) {
  const seg = []; let tot = 0;
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(d); tot += d; }
  let d = u * tot;
  for (let i = 0; i < seg.length; i++) { if (d <= seg[i]) { const v = d / seg[i]; return [lerp(pts[i][0], pts[i + 1][0], v), lerp(pts[i][1], pts[i + 1][1], v)]; } d -= seg[i]; }
  return pts[pts.length - 1];
}
// the back of a right hand, fingers up, coming in from the bottom right to (x, y); k 0…1 how far in; the striped sleeve
export function backOfHand(x, y, k, s = 1) {
  if (k <= 0.01) return;
  const px = lerp(x + 520, x, ease.out(clamp(k))), py = lerp(y + 700, y, ease.out(clamp(k)));
  g.save(); g.translate(px, py); g.scale(s, s); g.rotate(-0.25);
  const skin = '#e9b48c', sh = '#c98f6e';
  // the forearm and the vest's sleeve
  limb([[40, 170], [120, 760]], 150, skin, false);
  const sl = polyPath([[-38, 470], [168, 444], [210, 980], [10, 1000]]);
  g.save(); g.clip(sl); fill(sl, '#f4f4f4');
  for (let i = 0; i < 7; i++) limb([[-80, 500 + i * 70], [280, 470 + i * 70]], 22, '#1f3b73', false); g.restore();
  // the back of the hand: knuckles, the four fingers, the thumb to the left
  fill(rrPath(-110, -40, 230, 240, 70), skin);
  for (let i = 0; i < 4; i++) { const fx = -82 + i * 56, len = [150, 175, 165, 130][i]; fill(rrPath(fx - 24, -40 - len, 50, len + 40, 25), skin); limb([[fx, -40 - len + 38], [fx + 1, -40 - len + 62]], 4, sh, false); ell(fx, -40 - len + 22, 14, 10, '#f3cdb0'); }
  limb([[-100, 120], [-170, 40], [-190, -30]], 54, skin, false);
  for (let i = 0; i < 4; i++) ell(-82 + i * 56, -36, 16, 9, sh, 0, 0.6);
  for (let i = 0; i < 3; i++) limb([[-70 + i * 56, 20], [-50 + i * 50, 130]], 4, 'rgba(160,100,70,0.35)', false);
  g.restore();
}
