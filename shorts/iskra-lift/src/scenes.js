// The places of «Как выжить, если прилетели инопланетяне» (2D) in flat shapes, straight in screen space: the living room
// at night (a window with the saucer's green light, a curtain, a sofa, a lamp, the front door with a frosted pane), the
// phone on its charger with a power bank, the road closed by the police and the military with an ambulance going
// through, the kitchen table with water for three days, the evacuation road with the blue US sign, the knock at the door.
// The street, the saucer, the helicopters, the drone, the phone alert come from ufo.js.
import { lerp, clamp, TAU, hash } from './lib.js';
import { g, ell, limb, rect, rrect, fill, poly, smoothPath, texArea, rrPath } from './flat.js';
import { text, FONTS, INK } from './type.js';
import { saucer, heli, drone } from './ufo.js';

export const FLOOR = 1000;
function grad(stops, y0, y1, x0 = -400, x1 = 1480) { const gr = g.createLinearGradient(0, y0, 0, y1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); g.fillStyle = gr; g.fillRect(x0, y0, x1 - x0, y1 - y0); }

// —— the living room; o.door 0…1 the front door open; o.knock 0…1 the door shaking with «ТУК-ТУК»; o.shadow 0…1 the
// silhouette behind the frosted pane (two antennae, a soft green glow) ——
export function livingRoom(t, o = {}) {
  grad([[0, '#3b3550'], [1, '#2a2638']], 0, FLOOR);                                         // the wall in the lamp-light
  texArea(rrPath(-400, 0, 1880, FLOOR, 0), 'plaster', 0.7, 0.45);
  for (let i = 0; i < 9; i++) rect(-300 + i * 180, 0, 4, FLOOR, 'rgba(255,255,255,0.03)');
  grad([[0, '#5a4030'], [1, '#3a281d']], FLOOR, 1920);                                     // the floor
  texArea(rrPath(-400, FLOOR, 1880, 920, 0), 'floor', 0.8, 0.7);
  for (let i = 0; i < 10; i++) rect(-400 + i * 190, FLOOR, 5, 920, 'rgba(0,0,0,0.18)');
  rect(-400, FLOOR - 14, 1880, 18, '#d9d2c4');                                            // the skirting
  // the window on the left: the night, the saucer's green glow
  rrect(40, 220, 330, 420, 10, '#e8e2d6'); rect(60, 240, 290, 380, '#0d1838');
  g.save(); g.beginPath(); g.rect(60, 240, 290, 380); g.clip(); saucer(220, 360, 0.5, t, { beam: 0.6 }); g.restore();
  rect(200, 240, 10, 380, '#e8e2d6'); rect(60, 425, 290, 10, '#e8e2d6');
  g.save(); g.globalAlpha = 0.18; poly([[60, 620], [350, 620], [560, FLOOR + 60], [-160, FLOOR + 60]], '#9dffb8'); g.restore();   // the green light on the floor
  fill(smoothPath([[20, 200], [70, 200], [90, 640], [40, 700], [0, 640]]), '#7a3b4a');                                        // the curtain
  // the sofa, the lamp, the side table
  rrect(300, FLOOR - 190, 330, 120, 30, '#4f6b8a'); rrect(290, FLOOR - 250, 350, 80, 30, '#5d7c9e'); rrect(280, FLOOR - 200, 44, 140, 18, '#4f6b8a'); rrect(606, FLOOR - 200, 44, 140, 18, '#4f6b8a');
  rect(680, FLOOR - 180, 12, 170, '#3a3d44'); poly([[640, FLOOR - 180], [732, FLOOR - 180], [712, FLOOR - 250], [660, FLOOR - 250]], '#e8c48a');
  g.save(); g.globalAlpha = 0.16; ell(686, FLOOR - 200, 260, 220, '#ffe2a0'); g.restore();
  // the front door on the right
  const dx = 830, dy = 360, dw = 220, dh = FLOOR - 14 - dy, knock = clamp(o.knock ?? 0), sh = knock * 5 * Math.sin(t * 70) * (Math.sin(t * 9) > 0 ? 1 : 0);
  rect(dx - 16, dy - 16, dw + 32, dh + 16, '#e8e2d6');
  const op = clamp(o.door ?? 0);
  if (op > 0.01) { rect(dx, dy, dw, dh, '#0d1838'); rect(dx, FLOOR - 40, dw, 26, '#2c3a2c'); }
  g.save(); g.translate(dx + sh, dy); g.scale(1 - 0.85 * op, 1);
  rect(0, 0, dw, dh, '#6b3f2a'); rect(18, 20, dw - 36, 150, '#c9d6e6'); rect(18, 200, dw - 36, dh - 230, '#5a3422');
  const shd = clamp(o.shadow ?? 0);
  if (shd > 0.01) {                                                                       // behind the frosted pane
    g.save(); g.beginPath(); g.rect(18, 20, dw - 36, 150); g.clip(); g.globalAlpha = shd;
    ell(dw / 2, 150, 70, 90, 'rgba(90,255,150,0.35)'); ell(dw / 2, 120, 34, 40, '#3a4a5a'); rect(dw / 2 - 40, 150, 80, 60, '#3a4a5a');
    limb([[dw / 2 - 16, 86], [dw / 2 - 34, 40]], 6, '#3a4a5a', false); limb([[dw / 2 + 16, 86], [dw / 2 + 34, 40]], 6, '#3a4a5a', false);
    ell(dw / 2 - 34, 40, 9, 9, '#7dff9a'); ell(dw / 2 + 34, 40, 9, 9, '#7dff9a'); g.restore();
  }
  ell(dw - 30, dh * 0.55, 10, 10, '#ffd23f');
  g.restore();
  if (knock > 0.01 && Math.sin(t * 9) > 0) { g.save(); g.globalAlpha = knock; text('ТУК-ТУК', dx + dw / 2 - 40, dy - 50, 64, '#ffd23f', { fam: FONTS.block }); g.restore(); }
  return { window: [205, 430], door: [dx + dw / 2, dy + dh / 2] };
}

// —— the phone on its charger with a power bank: k 0…1 in, charge 0…1 the battery bars ——
export function charging(x, y, k, t, charge = 1) {
  if (k <= 0.01) return;
  g.save(); g.translate(x, y); g.scale(k, k);
  rrect(-330, 60, 660, 40, 14, '#6e5440');                                                 // the table edge
  rrect(-300 + 8, -20 + 8, 200, 90, 18, INK); rrect(-300, -20, 200, 90, 18, '#2f3640');   // the power bank
  for (let i = 0; i < 4; i++) rect(-276 + i * 40, 20, 30, 18, i < Math.round(4 * charge) ? '#5aff8a' : '#3a4450');
  g.lineCap = 'round'; g.lineWidth = 12; g.strokeStyle = '#e8e8e8'; g.beginPath(); g.moveTo(-100, 25); g.bezierCurveTo(-40, 25, -20, 120, 40, 110); g.stroke();
  rrect(40 + 8, -240 + 8, 220, 380, 32, INK); rrect(40, -240, 220, 380, 32, '#1d2230'); rect(56, -214, 188, 330, '#0f1a2e');
  const bh = 160 * charge; rrect(110, -160, 80, 200, 12, '#2a3446'); rrect(118, 32 - bh, 64, bh, 8, charge > 0.95 ? '#5aff8a' : '#ffd23f');
  poly([[160, -120], [134, -60], [156, -60], [142, -10], [176, -76], [154, -76]], '#ffffff');
  text(`${Math.round(100 * charge)}%`, 150, 92, 40, '#ffffff', { fam: FONTS.cond, shadow: false });
  g.restore();
}

// —— the closed road at night: a barrier with flashing lights, a military truck, an ambulance going through (amb 0…1) ——
export function roadBlock(t, o = {}) {
  grad([[0, '#0a1230'], [1, '#26355e']], 0, FLOOR - 120);
  for (let i = 0; i < 40; i++) ell(hash(i) * 1300 - 100, hash(i + 3) * (FLOOR - 300), 2.5, 2.5, '#ffffff', 0, 0.5);
  rect(-400, FLOOR - 140, 1880, 40, '#1b2a20');
  grad([[0, '#34373f'], [1, '#1b1d24']], FLOOR - 100, 1920);
  texArea(rrPath(-400, FLOOR - 100, 1880, 1020, 0), 'asphalt', 0.7, 0.75);
  for (let i = 0; i < 6; i++) rect(500 - 20 + 0, FLOOR - 60 + i * 140, 40, 80, '#e8d38a');           // the centre line, towards us
  const blink = Math.sin(t * 10) > 0;
  g.save(); g.globalAlpha = 0.25; ell(300, FLOOR - 180, 260, 160, blink ? '#ff3b30' : '#2f6bff'); ell(780, FLOOR - 180, 260, 160, blink ? '#2f6bff' : '#ff3b30'); g.restore();
  // the military truck on the right
  rect(640, FLOOR - 330, 300, 190, '#4b5a3a'); rect(940, FLOOR - 270, 140, 130, '#3e4b30'); rect(960, FLOOR - 250, 80, 60, '#9fc4dd');
  for (const wx of [700, 860, 1010]) { ell(wx, FLOOR - 130, 46, 46, '#1f2230'); ell(wx, FLOOR - 130, 18, 18, '#6b7280'); }
  // the barrier with the lights
  rect(80, FLOOR - 200, 24, 110, '#e8e8e8'); rect(560, FLOOR - 200, 24, 110, '#e8e8e8');
  for (let i = 0; i < 6; i++) rect(80 + i * 84, FLOOR - 210, 84, 34, i % 2 ? '#ffffff' : '#e53935');
  ell(92, FLOOR - 228, 16, 16, blink ? '#ff3b30' : '#661510'); ell(572, FLOOR - 228, 16, 16, blink ? '#661510' : '#2f6bff');
  const amb = clamp(o.amb ?? 0);
  if (amb > 0.01 && amb < 1) {                                                               // the ambulance passes left to right
    const ax = lerp(-500, 1500, amb);
    rrect(ax, FLOOR - 300, 360, 170, 16, '#f2f2f2'); rect(ax, FLOOR - 230, 360, 22, '#e53935'); rect(ax + 260, FLOOR - 280, 90, 60, '#9fc4dd');
    rect(ax + 130, FLOOR - 270, 60, 16, '#e53935'); rect(ax + 152, FLOOR - 292, 16, 60, '#e53935');
    ell(ax + 70, FLOOR - 130, 40, 40, '#1f2230'); ell(ax + 290, FLOOR - 130, 40, 40, '#1f2230');
    ell(ax + 180, FLOOR - 310, 22, 12, blink ? '#ff3b30' : '#2f6bff');
  }
}

// —— the kitchen table: n 0…3 water jugs have come (one a day), plus a torch, a first-aid box, cans ——
export function waterTable(t, n, extra = 0) {
  grad([[0, '#4a3f5a'], [1, '#33293f']], 0, FLOOR); texArea(rrPath(-400, 0, 1880, FLOOR, 0), 'plaster', 0.7, 0.45);
  grad([[0, '#6b4a33'], [1, '#4a3324']], FLOOR, 1920); texArea(rrPath(-400, FLOOR, 1880, 920, 0), 'floor', 0.8, 0.7);
  rect(-400, 700, 1880, 40, '#8a5a3a'); rect(-400, 740, 1880, 260, '#6b4a33');                     // the table
  for (let i = 0; i < 3; i++) {
    const k = clamp(n - i); if (k <= 0.01) continue;
    const x = 300 + i * 240, y = 700 - 20 * (1 - k);
    g.save(); g.globalAlpha = Math.min(1, k * 2); g.translate(x, y);
    rrect(-80, -300, 160, 300, 30, 'rgba(160,210,255,0.85)'); rrect(-80, -170, 160, 170, 30, 'rgba(80,160,240,0.9)');
    rrect(-28, -340, 56, 50, 10, '#2f6bff'); rrect(-60, -250, 120, 70, 12, '#ffffff');
    text('4 Л', 0, -202, 40, '#2f6bff', { fam: FONTS.block, shadow: false });
    rrect(-70, 20, 140, 54, 14, '#ffd23f'); text(`${i + 1} ДЕНЬ`, 0, 58, 32, INK, { fam: FONTS.cond, shadow: false });
    g.restore();
  }
  const e = clamp(extra);
  if (e > 0.01) {
    g.save(); g.globalAlpha = e;
    rrect(80, 610, 120, 90, 10, '#ffffff'); rect(124, 625, 32, 60, '#e53935'); rect(110, 640, 60, 30, '#e53935');   // the first-aid box
    rrect(880, 640, 150, 50, 20, '#2a2f3a'); ell(1030, 665, 30, 30, '#fff3c4');                                   // the torch
    g.restore();
  }
}

// —— the evacuation road: the blue US sign «EVACUATION ROUTE» with its arrow, the car going (go 0…1) ——
export function evacRoad(t, go = 0) {
  grad([[0, '#1a2a52'], [1, '#4a5f8f']], 0, FLOOR - 100);
  rect(-400, FLOOR - 130, 1880, 40, '#22382a');
  grad([[0, '#3a3d46'], [1, '#22252c']], FLOOR - 90, 1920);
  texArea(rrPath(-400, FLOOR - 90, 1880, 1010, 0), 'asphalt', 0.7, 0.75);
  for (let i = 0; i < 8; i++) rect(-300 + i * 220, FLOOR + 120, 110, 12, '#e8d38a');
  // the sign on its post
  rect(760, FLOOR - 400, 16, 310, '#9aa4b2');
  rrect(640, FLOOR - 600, 260, 200, 14, '#ffffff'); rrect(650, FLOOR - 590, 240, 180, 10, '#1d4fa3');
  text('EVACUATION', 770, FLOOR - 530, 32, '#ffffff', { fam: FONTS.cond, shadow: false }); text('ROUTE', 770, FLOOR - 492, 34, '#ffffff', { fam: FONTS.cond, shadow: false });
  limb([[700, FLOOR - 450], [830, FLOOR - 450]], 12, '#ffffff', false); poly([[830, FLOOR - 472], [866, FLOOR - 450], [830, FLOOR - 428]], '#ffffff');
  // the car, side view, going right
  const cx = lerp(160, 1300, go), cy = FLOOR + 60;
  g.save(); g.translate(cx, cy);
  rrect(-200, -120, 400, 80, 30, '#c0392b'); fill(smoothPath([[-120, -116], [-80, -190], [90, -190], [140, -116]]), '#c0392b');
  fill(smoothPath([[-104, -122], [-72, -176], [-6, -176], [-6, -122]]), '#9fc4dd'); fill(smoothPath([[8, -122], [8, -176], [78, -176], [120, -122]]), '#9fc4dd');
  ell(-120, -36, 40, 40, '#1f2230'); ell(120, -36, 40, 40, '#1f2230'); ell(-120, -36, 16, 16, '#9aa4b2'); ell(120, -36, 16, 16, '#9aa4b2');
  ell(196, -90, 14, 10, '#fff3c4'); g.save(); g.globalAlpha = 0.25; poly([[200, -96], [620, -170], [620, 0], [200, -80]], '#fff3c4'); g.restore();
  g.restore();
}
// a fuel gauge, full
export function gauge(x, y, k) {
  if (k <= 0.01) return;
  g.save(); g.translate(x, y); g.scale(k, k);
  ell(6, 8, 90, 90, INK); ell(0, 0, 90, 90, '#ffffff');
  g.lineWidth = 12; g.strokeStyle = '#e53935'; g.beginPath(); g.arc(0, 0, 70, Math.PI * 1.15, Math.PI * 1.35); g.stroke();
  g.strokeStyle = '#2f8f4e'; g.beginPath(); g.arc(0, 0, 70, Math.PI * 1.65, Math.PI * 1.85); g.stroke();
  limb([[0, 0], [Math.cos(Math.PI * 1.78) * 62, Math.sin(Math.PI * 1.78) * 62]], 10, INK, false); ell(0, 0, 12, 12, INK);
  text('E', -56, 40, 30, '#e53935', { fam: FONTS.block, shadow: false }); text('F', 56, 40, 30, '#2f8f4e', { fam: FONTS.block, shadow: false });
  rect(-26, 26, 52, 40, '#2a2f3a'); text('ПОЛНЫЙ', 0, 120, 30, '#ffffff', { fam: FONTS.cond });
  g.restore();
}
// a speech bubble
export function bubble(x, y, s, k, tail = -1) {
  if (k <= 0.01) return;
  g.save(); g.translate(x, y); g.scale(k, k);
  const w = s.length * 26 + 80;
  rrect(-w / 2 + 6, -50 + 6, w, 100, 30, INK); rrect(-w / 2, -50, w, 100, 30, '#ffffff'); poly([[tail * 40, 46], [tail * 80, 46], [tail * 110, 96]], '#ffffff');
  text(s, 0, 16, 44, INK, { fam: FONTS.cond, shadow: false });
  g.restore();
}
export { saucer, heli, drone };
