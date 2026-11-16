// The places of «Правда или миф», №13 «Прилетели инопланетяне» in flat shapes, straight in screen space; each subject
// sits near x = 540 so that a 352-px column shows it. An American suburb at night (a deep blue sky with stars, far house
// roofs, lawns, a street); a flying saucer with a ring of lights and a green beam; helicopters with a searchlight; a small
// quadcopter; a green laser line; a two-storey house with a porch and lit windows; cards: a fine, a prison term, a phone
// with the emergency alert, rumours from social media crossed out, the «no drones» ring.
import { lerp, clamp, TAU, hash } from './lib.js';
import { g, ell, limb, rect, rrect, fill, poly, smoothPath, texArea, rrPath } from './flat.js';
import { text, FONTS, INK } from './type.js';
export { walker } from './ice.js';

export const FLOOR = 1000;
function grad(stops, y0, y1, x0 = -400, x1 = 1480) { const gr = g.createLinearGradient(0, y0, 0, y1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); g.fillStyle = gr; g.fillRect(x0, y0, x1 - x0, y1 - y0); }

// the night suburb
export function night(t, o = {}) {
  grad([[0, '#0a1230'], [1, '#2b3b6b']], 0, FLOOR - 60);
  for (let i = 0; i < 70; i++) { const x = hash(i) * 1500 - 200, y = hash(i + 7) * (FLOOR - 300); const k = 0.5 + 0.5 * Math.sin(t * 2 + i); ell(x, y, 2.5 + 2 * hash(i + 3), 2.5 + 2 * hash(i + 3), '#ffffff', 0, 0.35 + 0.5 * k); }
  for (let i = 0; i < 8; i++) {                                                               // far roofs and trees
    const x = -260 + i * 220, w = 180, h = 90 + 40 * hash(i + 4), y = FLOOR - 70;
    rect(x, y - h, w, h, '#1a2240'); poly([[x - 14, y - h], [x + w / 2, y - h - 70], [x + w + 14, y - h]], '#151c36');
    if (hash(i + 11) > 0.4) rect(x + 40, y - h + 30, 34, 30, '#ffd27a');
    ell(x + w + 30, y - 110, 50, 90, '#121a32');
  }
  rect(-400, FLOOR - 70, 1880, 90, '#1f3a2a');                                                 // lawns
  grad([[0, '#2c2f38'], [1, '#1b1d24']], FLOOR + 20, 1920);                                    // the street
  texArea(rrPath(-400, FLOOR + 20, 1880, 1900, 0), 'asphalt', 0.7, 0.75);
  for (let i = 0; i < 8; i++) rect(-300 + i * 220, FLOOR + 160, 110, 12, '#e8d38a');
  rect(-400, FLOOR + 10, 1880, 14, '#8a8f99');                                                 // the kerb
}
// the saucer: centre (x, y), s scale; o.beam 0…1 the green beam down to the ground
export function saucer(x, y, s, t, o = {}) {
  const beam = clamp(o.beam ?? 0), bob = 8 * Math.sin(t * 1.6);
  if (beam > 0.01) { g.save(); g.globalAlpha = 0.35 * beam; const gr = g.createLinearGradient(0, y, 0, FLOOR); gr.addColorStop(0, 'rgba(140,255,170,1)'); gr.addColorStop(1, 'rgba(140,255,170,0.15)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(x - 60 * s, y + 30 * s + bob); g.lineTo(x + 60 * s, y + 30 * s + bob); g.lineTo(x + 220 * s, FLOOR + 40); g.lineTo(x - 220 * s, FLOOR + 40); g.closePath(); g.fill(); g.restore(); }
  g.save(); g.translate(x, y + bob); g.scale(s, s);
  g.save(); g.globalAlpha = 0.25; ell(0, 10, 260, 90, '#9fffc0'); g.restore();
  ell(0, -40, 80, 62, '#7fe0ff'); ell(-24, -60, 26, 16, 'rgba(255,255,255,0.7)');                // the glass dome
  ell(0, 0, 200, 46, '#b9c3d1'); ell(0, -8, 190, 30, '#dfe6ee'); ell(0, 22, 120, 18, '#6f7a8a');
  for (let i = 0; i < 9; i++) { const a = i / 9 * TAU + t * 1.5, px = Math.cos(a) * 170, on = Math.sin(a) > -0.2; if (on) ell(px, 10 + Math.sin(a) * 8, 14, 10, ['#ff5a5a', '#ffd23f', '#5affa0'][i % 3]); }
  g.restore();
}
// a helicopter, facing left, centre (x, y); o.light 0…1 a searchlight to (lx, ly); o.wobble 0…1 (the pilot blinded)
export function heli(x, y, s, t, o = {}) {
  const wob = clamp(o.wobble ?? 0), lt = clamp(o.light ?? 0);
  const rx = x + 40 * wob * Math.sin(t * 9), ry = y + 20 * wob * Math.sin(t * 7), rot = 0.18 * wob * Math.sin(t * 6);
  if (lt > 0.01) { g.save(); g.globalAlpha = 0.28 * lt; const lx = o.lx ?? x - 100, ly = o.ly ?? FLOOR;
    g.fillStyle = '#fff6c8'; g.beginPath(); g.moveTo(rx - 60 * s, ry + 40 * s); g.lineTo(lx - 120, ly + 20); g.lineTo(lx + 120, ly + 20); g.closePath(); g.fill();
    ell(lx, ly + 10, 130, 26, '#fff6c8'); g.restore(); }
  g.save(); g.translate(rx, ry); g.rotate(rot); g.scale(s, s);
  rect(60, -18, 200, 20, '#20242c'); poly([[250, -18], [290, -70], [300, -70], [280, 2]], '#20242c');            // the tail
  ell(290, -38, 30, 30, 'rgba(160,170,190,0.35)');                                                                // the tail rotor
  ell(0, 0, 110, 62, '#2a2f3a'); ell(-52, -8, 50, 38, '#9fd3ff'); ell(-62, -18, 18, 10, 'rgba(255,255,255,0.6)');  // body, cockpit
  rect(-80, 58, 180, 8, '#20242c'); rect(-50, 40, 8, 22, '#20242c'); rect(60, 40, 8, 22, '#20242c');               // skids
  rect(-6, -78, 12, 22, '#20242c'); g.save(); g.globalAlpha = 0.55; ell(0, -82, 250, 9 + 3 * Math.sin(t * 40), '#aab4c6'); g.restore();   // rotor blur
  ell(-96, 30, 12, 12, '#fff3c4'); if (Math.sin(t * 8) > 0.3) ell(100, -40, 8, 8, '#ff3b30');
  g.restore();
  return { cockpit: [rx - 52 * s, ry - 8 * s] };
}
// a small quadcopter, centre (x, y)
export function drone(x, y, s, t) {
  g.save(); g.translate(x, y + 4 * Math.sin(t * 5)); g.scale(s, s);
  limb([[-50, -6], [50, -6]], 8, '#3a3f4a', false); rrect(-26, -16, 52, 24, 8, '#d9dee6'); ell(0, 10, 10, 8, '#2a2f3a');
  for (const px of [-56, 56]) { rect(px - 3, -22, 6, 16, '#3a3f4a'); g.save(); g.globalAlpha = 0.55; ell(px, -24, 34, 5 + 2 * Math.sin(t * 50 + px), '#c8d0dc'); g.restore(); }
  ell(-22, -4, 4, 4, Math.sin(t * 6) > 0 ? '#ff3b30' : '#661510'); ell(22, -4, 4, 4, '#3bff7a');
  g.restore();
}
// the green laser from (x0, y0) to (x1, y1)
export function laser(x0, y0, x1, y1, k, t) {
  if (k <= 0.01) return;
  const ex = lerp(x0, x1, k), ey = lerp(y0, y1, k);
  g.save(); g.lineCap = 'round';
  g.globalAlpha = 0.35; g.strokeStyle = '#7dff7a'; g.lineWidth = 16; g.beginPath(); g.moveTo(x0, y0); g.lineTo(ex, ey); g.stroke();
  g.globalAlpha = 1; g.strokeStyle = '#d8ffd0'; g.lineWidth = 4; g.beginPath(); g.moveTo(x0, y0); g.lineTo(ex, ey); g.stroke();
  if (k >= 1) { g.globalAlpha = 0.6 + 0.3 * Math.sin(t * 30); ell(x1, y1, 46, 46, '#b9ff9a'); }
  g.restore();
}
// the house: its middle at x; o.lit 0…1 the window; o.phone 0…1 someone at the window with a phone
export function house(x, t, o = {}) {
  const w = 560, top = 520;
  poly([[x - w / 2 - 30, top], [x, top - 170], [x + w / 2 + 30, top]], '#3d2f2a');
  rect(x - w / 2, top, w, FLOOR - 60 - top, '#e9e4d8'); for (let r = 0; r < 12; r++) rect(x - w / 2, top + 14 + r * 34, w, 3, '#cfc8b8');
  const lit = clamp(o.lit ?? 1);
  for (const [wx, wy] of [[-170, 70], [110, 70], [-170, 260]]) { rect(x + wx, top + wy, 90, 110, lit > 0 ? '#ffd88a' : '#2b3550'); rect(x + wx + 42, top + wy, 6, 110, '#ffffff'); rect(x + wx, top + wy + 52, 90, 6, '#ffffff'); }
  rect(x + 40, top + 230, 120, 190, '#7a3b2a'); ell(x + 140, top + 330, 7, 7, '#ffd23f');                                    // the door
  rect(x - w / 2 - 20, top + 210, w + 40, 16, '#bfb6a3'); for (const px of [-260, -60, 240]) rect(x + px, top + 226, 14, 194, '#f2eee6');  // the porch
  rect(x - 30, FLOOR - 80, 260, 20, '#9a9285');
  const ph = clamp(o.phone ?? 0);
  if (ph > 0.01) {                                                                             // the silhouette in the right upper window, the phone's glow
    g.save(); g.globalAlpha = ph; ell(x + 155, top + 120, 22, 26, '#3a2a22'); rrect(x + 130, top + 144, 50, 40, 12, '#3a2a22');
    ell(x + 170, top + 140, 14, 10, '#bfe6ff'); g.restore();
  }
}
// a card: the fine
export function ticket(x, y, k) {
  if (k <= 0.01) return;
  g.save(); g.translate(x, y); g.rotate(-0.06); g.scale(k, k);
  rrect(-170 + 8, -110 + 10, 340, 220, 16, INK); rrect(-170, -110, 340, 220, 16, '#ffffff');
  rect(-170, -110, 340, 50, '#e53935'); text('ШТРАФ', 0, -72, 40, '#ffffff', { fam: FONTS.block, shadow: false });
  text('$$$$$', 0, 30, 80, '#2f8f4e', { fam: FONTS.block, shadow: false });
  text('ДЕСЯТКИ ТЫСЯЧ', 0, 86, 30, INK, { fam: FONTS.cond, shadow: false });
  g.restore();
}
// a card: prison — bars and «ДО 5 ЛЕТ»
export function prison(x, y, k) {
  if (k <= 0.01) return;
  g.save(); g.translate(x, y); g.rotate(0.05); g.scale(k, k);
  rrect(-160 + 8, -120 + 10, 320, 240, 16, INK); rrect(-160, -120, 320, 240, 16, '#3a3f4a');
  for (let i = 0; i < 6; i++) rect(-130 + i * 52, -110, 12, 160, '#b9c0cc');
  rect(-150, -110, 300, 12, '#b9c0cc'); rect(-150, 40, 300, 12, '#b9c0cc');
  text('ДО 5 ЛЕТ', 0, 100, 44, '#ffd23f', { fam: FONTS.block, shadow: false });
  g.restore();
}
// the phone with the emergency alert; pulse: the vibration
export function phoneAlert(x, y, k, t, pulse = 0) {
  if (k <= 0.01) return;
  const sh = pulse * 4 * Math.sin(t * 60);
  g.save(); g.translate(x + sh, y); g.scale(k, k);
  rrect(-120 + 8, -220 + 10, 240, 440, 34, INK); rrect(-120, -220, 240, 440, 34, '#1d2230'); rect(-104, -190, 208, 380, '#0f1a2e');
  rrect(-96, -160, 192, 150, 14, '#ffffff'); rect(-96, -160, 192, 44, '#e53935');
  text('! ТРЕВОГА', 0, -128, 26, '#ffffff', { fam: FONTS.cond, shadow: false });
  text('СИДИТЕ ДОМА', 0, -78, 26, INK, { fam: FONTS.cond, shadow: false });
  text('СЛЕДИТЕ', 0, -46, 24, '#555b66', { fam: FONTS.cond, shadow: false });
  text('ЗА НОВОСТЯМИ', 0, -20, 24, '#555b66', { fam: FONTS.cond, shadow: false });
  if (pulse > 0.01) { g.globalAlpha = pulse; g.lineWidth = 7; g.strokeStyle = '#ffd23f'; for (const s of [-1, 1]) for (let i = 1; i <= 2; i++) { g.beginPath(); g.arc(0, 0, 150 + i * 30, s > 0 ? -0.5 : Math.PI - 0.5, s > 0 ? 0.5 : Math.PI + 0.5); g.stroke(); } }
  g.restore();
}
// rumours from social media; cross 0…1 the red cross over them
export function rumours(x, y, k, cross, t) {
  if (k <= 0.01) return;
  const B = [['НЛО ВЕЗДЕ!!!', -150, -90, -0.08], ['ВСЕ БЕГИТЕ!', 120, -10, 0.06], ['ЭТО КОНЕЦ?!', -110, 80, 0.04]];
  B.forEach(([s, dx, dy, r], i) => {
    const kk = clamp(k * 3 - i); if (kk <= 0.01) return;
    g.save(); g.translate(x + dx, y + dy + 4 * Math.sin(t * 3 + i)); g.rotate(r); g.scale(kk, kk);
    rrect(-150 + 6, -40 + 6, 300, 80, 20, INK); rrect(-150, -40, 300, 80, 20, '#ffffff'); poly([[-60, 38], [-30, 38], [-70, 70]], '#ffffff');
    text(s, 0, 14, 36, '#3b5998', { fam: FONTS.cond, shadow: false }); g.restore();
  });
  if (cross > 0.01) { g.save(); g.globalAlpha = cross; g.lineCap = 'round'; g.lineWidth = 22; g.strokeStyle = '#e53935'; g.beginPath(); g.moveTo(x - 260, y - 150); g.lineTo(x - 260 + 520 * cross, y - 150 + 300 * cross); g.stroke(); g.restore(); }
}
// the «no drones» ring in the sky
export function noDrones(x, y, r, k, t) {
  if (k <= 0.01) return;
  g.save(); g.globalAlpha = k; g.setLineDash([22, 16]); g.lineDashOffset = -t * 40; g.lineWidth = 10; g.strokeStyle = '#ff4d4d';
  g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke(); g.setLineDash([]);
  rrect(x - 190, y + r - 30, 380, 60, 14, '#ff4d4d'); text('ДРОНЫ ЗАПРЕЩЕНЫ', x, y + r + 12, 34, '#ffffff', { fam: FONTS.cond, shadow: false });
  g.restore();
}
