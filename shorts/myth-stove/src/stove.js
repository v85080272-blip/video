// The places of «Правда или миф», №12 «Печка и угарный газ» in flat shapes, straight in screen space; each subject sits
// near x = 540 so that a 352-px column shows it. A log house inside at night (log walls, a frosty window, a warm lamp); a
// white-washed brick stove with the firebox door (glowing coals, blue flames over them), the chimney with the damper that
// slides in; a grey cloud of carbon monoxide that comes out of the stove into the room; people at home (in home clothes),
// sniffing, holding their heads; a carbon-monoxide detector on the wall that beeps; the door open to the snowy yard.
import { lerp, clamp, TAU, hash } from './lib.js';
import { g, ell, limb, rect, rrect, fill, poly, smoothPath } from './flat.js';
import { text, FONTS, INK } from './type.js';
export { walker } from './ice.js';

export const FLOOR = 1000;
const LOG = '#b9814f', LOG_D = '#9a6638', PLASTER = '#f1ece2', PLASTER_D = '#d9d1c2', IRON = '#3a3d44';

// the room: o.out 0…1 the door at the right open to the snowy night
export function room(t, o = {}) {
  rect(-400, 0, 1880, FLOOR + 20, LOG);
  for (let r = 0; r < 12; r++) { const y = 40 + r * 82; rect(-400, y, 1880, 10, LOG_D); for (let i = 0; i < 6; i++) ell(-300 + i * 330 + 60 * (r % 2), y + 40, 14, 6, 'rgba(120,80,40,0.35)'); }
  rect(-400, FLOOR - 10, 1880, 1930 - FLOOR, '#8a5a34'); for (let i = 0; i < 12; i++) rect(-400 + i * 160, FLOOR - 10, 6, 920, '#7a4e2c');   // the floor boards
  // the window: night, frost, snow
  rrect(150, 170, 220, 260, 10, '#e6d6c0'); rect(166, 186, 188, 228, '#1d2c4c'); rect(256, 186, 8, 228, '#e6d6c0'); rect(166, 296, 188, 8, '#e6d6c0');
  for (let i = 0; i < 9; i++) ell(170 + 180 * hash(i), 190 + 220 * hash(i + 4), 4, 4, '#ffffff');
  fill(smoothPath([[166, 414], [200, 396], [260, 404], [320, 394], [354, 414]]), '#ffffff');
  // the lamp
  limb([[700, 0], [700, 120]], 4, '#3a3d44', false); poly([[650, 160], [750, 160], [720, 120], [680, 120]], '#c0392b');
  g.save(); g.globalAlpha = 0.18; ell(700, 200, 300, 240, '#ffe7a8'); g.restore(); ell(700, 166, 16, 12, '#fff3c4');
  const out = clamp(o.out ?? 0);
  if (out > 0) {                                                                                      // the door to the yard
    rect(930, 380, 230, FLOOR - 370, '#13203a'); for (let i = 0; i < 14; i++) ell(940 + 210 * hash(i + 2), 400 + (hash(i + 9) * 560 + t * 90) % 560, 5, 5, '#ffffff');
    rect(930, FLOOR - 60, 230, 50, '#eef4f9');
    g.save(); g.translate(930, 380); g.scale(1 - 0.85 * out, 1); rect(0, 0, 230, FLOOR - 370, '#6b4423'); rect(20, 20, 190, 260, '#7a5232'); rect(20, 320, 190, 260, '#7a5232'); g.restore();
  } else { rect(930, 380, 230, FLOOR - 370, '#6b4423'); rect(950, 400, 190, 260, '#7a5232'); rect(950, 700, 190, 260, '#7a5232'); ell(960, 690, 9, 9, '#ffd23f'); }
}

// the stove: its middle at x, floor at FLOOR. o.coals 0…1 the glow, o.blue 0…1 blue flames over the coals,
// o.damper 0…1 shut, o.hand 0…1 a hand at the damper. Returns the firebox door and the damper.
export function stove(x, t, o = {}) {
  const w = 360, top = 560;
  rect(x - w / 2, top, w, FLOOR - top, PLASTER); rect(x - w / 2, top, w, 18, PLASTER_D); rect(x - w / 2 - 20, FLOOR - 40, w + 40, 40, PLASTER_D);
  for (let r = 0; r < 6; r++) rect(x - w / 2, top + 60 + r * 100, w, 3, 'rgba(0,0,0,0.05)');
  rect(x - 70, 0, 140, top, PLASTER); rect(x - 70, 0, 8, top, PLASTER_D);                                 // the chimney
  // the damper: a slot in the chimney, an iron plate with a ring that slides in
  const dmp = clamp(o.damper ?? 0), dy = 440;
  rect(x - 76, dy - 6, 152, 12, IRON);
  rrect(x + 70 - 120 * dmp + 10, dy - 16, 130, 32, 6, '#555a63'); ell(x + 70 - 120 * dmp + 150, dy, 18, 18, 'rgba(0,0,0,0)');
  g.lineWidth = 7; g.strokeStyle = '#555a63'; g.beginPath(); g.arc(x + 70 - 120 * dmp + 158, dy, 16, 0, TAU); g.stroke();
  // the firebox door, open: the coals
  const fx = x, fy = 820, coals = clamp(o.coals ?? 1);
  rrect(fx - 110, fy - 80, 220, 160, 12, IRON); rect(fx - 90, fy - 60, 180, 120, '#1a0d08');
  for (let i = 0; i < 9; i++) ell(fx - 70 + 18 * i, fy + 36 - 10 * hash(i + 3), 22, 14, `rgba(255,${Math.round(80 + 80 * hash(i))},30,${0.4 + 0.6 * coals})`);
  g.save(); g.globalAlpha = 0.35 * coals; ell(fx, fy + 40, 160, 80, '#ff8a3a'); g.restore();
  const blue = clamp(o.blue ?? 0);
  if (blue > 0.01) for (let i = 0; i < 7; i++) {
    const bx = fx - 66 + 22 * i, h = (30 + 16 * Math.sin(t * 11 + i * 2)) * blue;
    g.save(); g.globalAlpha = 0.85 * blue; poly([[bx - 9, fy + 30], [bx + 9, fy + 30], [bx + 2 * Math.sin(t * 9 + i), fy + 30 - h]], '#4aa8ff'); g.restore();
  }
  return { door: [fx, fy], damper: [x + 70 - 120 * dmp + 158, dy] };
}
// the grey CO cloud filling the room from the stove: k 0…1
export function coCloud(x, y, k, t, label = true) {
  if (k <= 0.01) return;
  g.save(); g.globalAlpha = 0.6 * k;
  for (let i = 0; i < 14; i++) { const a = i / 14 * TAU, r = 60 + 260 * k * (0.5 + 0.5 * hash(i)); ell(x + Math.cos(a + t * 0.3) * r, y - 120 * k + Math.sin(a + t * 0.3) * r * 0.6, 70 + 30 * hash(i + 2), 54, '#7d8691'); }
  g.restore();
  if (label && k > 0.4) { g.save(); g.globalAlpha = Math.min(1, (k - 0.4) * 3); text('CO', x, y - 110 * k, 72, '#ffffff', { fam: FONTS.block }); g.restore(); }
}
// a dashed outline of the CO cloud — «you cannot see it»
export function coGhost(x, y, k, t) {
  if (k <= 0.01) return;
  g.save(); g.globalAlpha = k; g.setLineDash([16, 14]); g.lineWidth = 6; g.strokeStyle = 'rgba(255,255,255,0.8)';
  g.beginPath(); g.ellipse(x, y, 190 + 8 * Math.sin(t * 2), 120, 0, 0, TAU); g.stroke(); g.setLineDash([]);
  text('CO', x, y + 26, 72, 'rgba(255,255,255,0.85)', { fam: FONTS.block }); g.restore();
}
// sniffing lines in front of a nose (face right), and the crossed-out nose sign
export function sniff(x, y, k, t) {
  if (k <= 0.01) return;
  g.save(); g.globalAlpha = k; g.lineCap = 'round'; g.lineWidth = 5; g.strokeStyle = '#ffffff';
  for (let i = 0; i < 3; i++) { const u = (t * 1.6 + i / 3) % 1; g.beginPath(); g.moveTo(x + 70 - 50 * u, y - 20 + i * 20); g.quadraticCurveTo(x + 60 - 50 * u, y - 30 + i * 20, x + 40 - 50 * u, y - 18 + i * 20); g.stroke(); }
  g.restore();
}
export function noNose(x, y, k) {
  if (k <= 0.01) return;
  g.save(); g.translate(x, y); g.scale(k, k);
  ell(6, 8, 80, 80, INK); ell(0, 0, 80, 80, '#ffffff');
  fill(smoothPath([[-14, -42], [8, -10], [20, 26], [-6, 30], [-24, 22]]), '#f2c19b'); ell(-6, 26, 10, 6, '#c98d6a');
  g.lineWidth = 12; g.strokeStyle = '#e53935'; g.beginPath(); g.arc(0, 0, 70, 0, TAU); g.moveTo(-50, -50); g.lineTo(50, 50); g.stroke();
  g.restore();
}
// the CO detector on the wall at (x, y): on 0…1, beep 0…1 (red light and sound waves)
export function detector(x, y, on, beep, t) {
  if (on <= 0.01) return;
  g.save(); g.translate(x, y); g.scale(on, on);
  ell(4, 6, 70, 70, INK); ell(0, 0, 70, 70, '#ffffff'); ell(0, 0, 54, 54, '#eceff3');
  text('CO', 0, 16, 40, '#2a2d33', { fam: FONTS.block, shadow: false });
  const lit = beep > 0 && Math.sin(t * 16) > 0;
  ell(0, -38, 9, 9, lit ? '#ff3b30' : '#8a1c16');
  if (beep > 0.01) { g.globalAlpha = beep; g.lineWidth = 6; g.strokeStyle = '#ff3b30'; for (let i = 1; i <= 3; i++) { const r = 70 + i * 26 + 10 * ((t * 3) % 1); g.beginPath(); g.arc(0, 0, r, -0.7, 0.7); g.stroke(); g.beginPath(); g.arc(0, 0, r, Math.PI - 0.7, Math.PI + 0.7); g.stroke(); } }
  g.restore();
}
// «sick» signs over a head: a grey spiral (dizzy) and a lightning (headache)
export function sickMarks(x, y, k, t) {
  if (k <= 0.01) return;
  g.save(); g.globalAlpha = Math.min(1, k * 2); g.lineWidth = 6; g.strokeStyle = '#6b7280'; g.beginPath();
  for (let i = 0; i < 40; i++) { const a = i * 0.45 + t * 4, r = 4 + i * 1.1; const px = x - 50 + Math.cos(a) * r, py = y + Math.sin(a) * r * 0.6; i ? g.lineTo(px, py) : g.moveTo(px, py); }
  g.stroke();
  poly([[x + 50, y - 40], [x + 30, y], [x + 46, y], [x + 34, y + 36], [x + 64, y - 6], [x + 48, y - 6]], '#ffd23f');
  g.restore();
}
// a phone with «112» in a speech bubble
export function phone112(x, y, k) {
  if (k <= 0.01) return;
  g.save(); g.translate(x, y); g.scale(k, k);
  rrect(-120 + 8, -70 + 8, 240, 140, 30, INK); rrect(-120, -70, 240, 140, 30, '#ffffff'); poly([[-60, 66], [-20, 66], [-70, 110]], '#ffffff');
  rrect(-96, -46, 50, 92, 12, '#2a2d33'); rect(-88, -36, 34, 62, '#9fe3b0');
  text('112', 40, 26, 74, '#2f8f4e', { fam: FONTS.block, shadow: false });
  g.restore();
}
