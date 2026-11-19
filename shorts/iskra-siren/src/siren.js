// «Приключения Искры» №5: her flat in the evening — the wall, the floor, a window onto the dusk street with the siren
// on its pole (gas.js street and siren, drawn small inside the window), the TV on its cabinet with a radio beside it;
// the screen: off, «ВНИМАНИЕ ВСЕМ!», the message, «ВНИМАНИЕ, ПРОВЕРКА». And the lift: steel doors sliding open on a lit
// cabin with a stranger in a dark coat and a hood.
import { lerp, clamp, TAU, hash, ease } from './lib.js';
import { g, ell, limb, rect, rrect, fill, poly, polyPath, rrPath, smoothPath, texArea } from './flat.js';
import { text, FONTS, INK } from './type.js';
import { street, siren } from './gas.js';

export const WIN = { x0: 560, x1: 1020, y0: 190, y1: 760 };
export const TV = { x: 300, y: 650, w: 420, h: 260 };

function screen(t, mode, k) {                             // the TV picture; k 0…1 how far it is switched on
  const { x, y, w, h } = TV;
  fill(rrPath(x - w / 2, y - h / 2, w, h, 10), '#0d0f14');
  if (k <= 0.01) return;
  g.save(); g.beginPath(); g.rect(x - w / 2 + 10, y - h / 2 + 10, w - 20, h - 20); g.clip(); g.globalAlpha = k;
  if (mode === 'alert') {
    const bl = Math.floor(t * 3) % 2;
    rect(x - w / 2, y - h / 2, w, h, bl ? '#c62828' : '#a31f1f');
    text('ВНИМАНИЕ', x, y - 18, 54, '#ffffff', { fam: FONTS.block, shadow: false });
    text('ВСЕМ!', x, y + 46, 54, '#ffd23f', { fam: FONTS.block, shadow: false });
  } else if (mode === 'news') {
    rect(x - w / 2, y - h / 2, w, h, '#1f3d6b');
    ell(x - 80, y - 10, 46, 52, '#f0c8a0'); fill(smoothPath([[x - 150, y + 130], [x - 130, y + 40], [x - 30, y + 40], [x - 10, y + 130]]), '#2b2f3a');
    fill(smoothPath([[x - 128, y - 30], [x - 110, y - 64], [x - 50, y - 64], [x - 34, y - 30], [x - 80, y - 44]]), '#4a3020');
    rect(x - w / 2 + 10, y + 60, w - 20, 50, '#c62828'); text('СООБЩЕНИЕ МЧС', x, y + 98, 34, '#ffffff', { fam: FONTS.cond, shadow: false });
    for (let i = 0; i < 3; i++) rect(x + 10, y - 60 + i * 30, 160 - 30 * i, 12, '#9fc0e6');
  } else if (mode === 'check') {
    rect(x - w / 2, y - h / 2, w, h, '#2f8f4e');
    text('ВНИМАНИЕ,', x, y - 18, 50, '#ffffff', { fam: FONTS.block, shadow: false });
    text('ПРОВЕРКА', x, y + 44, 54, '#ffd23f', { fam: FONTS.block, shadow: false });
  }
  g.globalAlpha = 0.08 * k; for (let yy = y - h / 2; yy < y + h / 2; yy += 6) rect(x - w / 2, yy, w, 2, '#ffffff');
  g.restore();
}
// the flat at dusk; o.tv 0…1 on, o.mode the picture, o.waves the siren's rings, o.radio 0…1 its sound lines
export function room(t, o = {}) {
  const wp = polyPath([[0, 0], [1080, 0], [1080, 1180], [0, 1180]]); fill(wp, '#e6d7bd'); texArea(wp, 'plaster', 0.8, 0.45);
  for (let i = 0; i < 14; i++) rect(i * 80 + 30, 0, 6, 1180, 'rgba(160,120,80,0.10)');
  const fl = polyPath([[0, 1180], [1080, 1180], [1080, 1920], [0, 1920]]); fill(fl, '#9c7048'); texArea(fl, 'planks', 0.8, 0.6);
  rect(0, 1170, 1080, 18, '#7a5638');
  // the window: the dusk street with the siren, small
  rect(WIN.x0 - 26, WIN.y0 - 26, WIN.x1 - WIN.x0 + 52, WIN.y1 - WIN.y0 + 52, '#f4f1ea');
  g.save(); g.beginPath(); g.rect(WIN.x0, WIN.y0, WIN.x1 - WIN.x0, WIN.y1 - WIN.y0); g.clip();
  g.translate(WIN.x0 - 40, WIN.y0 - 30); g.scale(0.5, 0.5);
  street(t, { dusk: 1 }); siren(560, 1520, t, o.waves ?? 0);      // low in the window, under the hook titles
  g.restore();
  rect((WIN.x0 + WIN.x1) / 2 - 8, WIN.y0, 16, WIN.y1 - WIN.y0, '#f4f1ea'); rect(WIN.x0, (WIN.y0 + WIN.y1) / 2 - 8, WIN.x1 - WIN.x0, 16, '#f4f1ea');
  rect(WIN.x0 - 40, WIN.y1 + 26, WIN.x1 - WIN.x0 + 80, 28, '#ece7dc');
  // curtains
  for (const [cx, dir] of [[WIN.x0 - 40, 1], [WIN.x1 + 40, -1]]) fill(smoothPath([[cx, WIN.y0 - 60], [cx + dir * 90, WIN.y0 - 60], [cx + dir * 70, WIN.y1 + 120], [cx, WIN.y1 + 140]]), '#b0503c');
  // the cabinet, the TV, the radio
  const cab = rrPath(60, 820, 520, 200, 10); fill(cab, '#6b4a33'); texArea(cab, 'planks', 0.6, 0.5);
  rect(70, 1020, 30, 60, '#4c3322'); rect(540, 1020, 30, 60, '#4c3322');
  rect(TV.x - 30, TV.y + TV.h / 2, 60, 40, '#22252c'); rect(TV.x - 90, TV.y + TV.h / 2 + 36, 180, 14, '#22252c');
  fill(rrPath(TV.x - TV.w / 2 - 14, TV.y - TV.h / 2 - 14, TV.w + 28, TV.h + 28, 16), '#22252c');
  screen(t, o.mode ?? 'alert', clamp(o.tv ?? 0));
  rrect(470, 740, 100, 80, 12, '#3b3f48'); ell(500, 782, 22, 22, '#20232a'); rect(530, 760, 30, 8, '#c9a36a'); limb([[560, 742], [590, 660]], 4, '#9aa0a8');
  const rk = o.radio ?? 0;
  if (rk > 0.01) { g.save(); g.lineWidth = 6; g.strokeStyle = '#ffd23f'; for (let i = 0; i < 3; i++) { const ph = ((t * 1.3 + i / 3) % 1); g.globalAlpha = rk * (1 - ph); g.beginPath(); g.arc(520, 780, 50 + ph * 90, -0.9, 0.4); g.stroke(); } g.restore(); }
  if (o.dim) { g.save(); g.globalAlpha = o.dim; rect(0, 0, 1080, 1920, '#0b0f1a'); g.restore(); }
}
// a phone with a message arriving; k 0…1 shown, slide 0…1 the notice sliding in
export function smsPhone(x, y, k, slide, t) {
  if (k <= 0.01) return;
  g.save(); g.translate(x, y); g.scale(k, k); g.rotate(-0.05);
  rrect(-170, -320, 340, 640, 44, '#1f2433'); rrect(-150, -290, 300, 580, 26, '#2b3c5c');
  text('21:14', 0, -200, 64, '#ffffff', { fam: FONTS.cond, shadow: false });
  const s = ease.out(clamp(slide));
  g.save(); g.translate(0, lerp(-420, -60, s)); g.globalAlpha = clamp(s * 2);
  fill(rrPath(-140, -70, 280, 170, 22), '#f4f2ec');
  rrect(-122, -52, 44, 44, 10, '#c62828'); text('!', -100, -16, 40, '#ffffff', { fam: FONTS.block, shadow: false });
  text('МЧС', -40, -18, 32, INK, { fam: FONTS.cond, shadow: false, align: 'left' });
  text('ВНИМАНИЕ ВСЕМ!', 0, 36, 32, '#c62828', { fam: FONTS.cond, shadow: false });
  text('Слушайте сообщение', 0, 76, 26, '#555', { fam: FONTS.cond, shadow: false });
  g.restore();
  g.restore();
}
// the lift on a landing: steel doors slide open (open 0…1) on a lit cabin with a stranger in a dark hooded coat
export function lift(t, o = {}) {
  const open = clamp(o.open ?? 0);
  rect(0, 0, 1080, 1920, '#dcd5c3');
  const low = polyPath([[0, 760], [1080, 760], [1080, 1500], [0, 1500]]); fill(low, '#4f7f5a'); texArea(low, 'concrete', 0.8, 0.45);
  const fl = polyPath([[0, 1340], [1080, 1340], [1080, 1920], [0, 1920]]); fill(fl, '#8a7a66'); texArea(fl, 'concrete', 0.6, 0.5);
  const x0 = 290, x1 = 790, y0 = 360, y1 = 1340;
  rect(x0 - 40, y0 - 40, x1 - x0 + 80, y1 - y0 + 40, '#9aa0a6');
  // the cabin inside
  const cab = g.createLinearGradient(0, y0, 0, y1); cab.addColorStop(0, '#fff3d0'); cab.addColorStop(1, '#c9b68a'); g.fillStyle = cab; g.fillRect(x0, y0, x1 - x0, y1 - y0);
  rect(x0, y1 - 40, x1 - x0, 40, '#6b5a44');
  // the stranger: a dark coat with a raised collar, a cap pulled low, the face in shadow, one hand holding the door
  const cx = (x0 + x1) / 2 + 40, sway = 4 * Math.sin(t * 1.5);
  fill(smoothPath([[cx - 150, y1 - 40], [cx - 130, y1 - 520], [cx - 70, y1 - 620], [cx + 70, y1 - 620], [cx + 130, y1 - 520], [cx + 150, y1 - 40]]), '#2b2f38');
  poly([[cx - 80, y1 - 620], [cx - 40, y1 - 690], [cx, y1 - 640], [cx + 40, y1 - 690], [cx + 80, y1 - 620]], '#23262e');
  ell(cx + sway, y1 - 720, 54, 64, '#8a6a52'); ell(cx + sway, y1 - 700, 50, 40, '#6e523e');
  fill(smoothPath([[cx - 62 + sway, y1 - 750], [cx - 50 + sway, y1 - 800], [cx + 50 + sway, y1 - 800], [cx + 62 + sway, y1 - 750]]), '#1f2228');
  rect(cx - 80 + sway, y1 - 756, 160, 16, '#1f2228');
  if (o.eyes) { ell(cx - 18 + sway, y1 - 722, 6, 4, '#ffffff', 0, o.eyes); ell(cx + 18 + sway, y1 - 722, 6, 4, '#ffffff', 0, o.eyes); }
  limb([[cx - 120, y1 - 540], [cx - 190, y1 - 470], [x0 + 10, y1 - 470]], 34, '#2b2f38');
  // the doors slide apart
  const half = (x1 - x0) / 2, gap = half * ease.inOut(open);
  for (const [dx, dir] of [[x0, -1], [x0 + half, 1]]) {
    const xx = dx + dir * gap, w = half;
    const dp = rrPath(xx, y0, w, y1 - y0, 2); fill(dp, '#b9bec4'); texArea(dp, 'rust', 0.7, 0.18);
    rect(xx + (dir < 0 ? w - 6 : 0), y0, 6, y1 - y0, '#8d9298');
  }
  g.save(); g.beginPath(); g.rect(0, 0, x0 - 40, 1920); g.rect(x1 + 40, 0, 1080 - x1 - 40, 1920); g.clip(); g.restore();
  // cover the doors sliding past the frame with the wall again
  rect(0, y0 - 40, x0 - 40, y1 - y0 + 40, '#dcd5c3'); rect(x1 + 40, y0 - 40, 1080 - x1 - 40, y1 - y0 + 40, '#dcd5c3');
  const lowL = polyPath([[0, 760], [x0 - 40, 760], [x0 - 40, y1], [0, y1]]); fill(lowL, '#4f7f5a'); texArea(lowL, 'concrete', 0.8, 0.45);
  const lowR = polyPath([[x1 + 40, 760], [1080, 760], [1080, y1], [x1 + 40, y1]]); fill(lowR, '#4f7f5a'); texArea(lowR, 'concrete', 0.8, 0.45);
  rect(0, 752, x0 - 40, 12, '#3a5f43'); rect(x1 + 40, 752, 1080 - x1 - 40, 12, '#3a5f43');
  // the call panel and the floor display
  rrect(x1 + 70, 820, 70, 120, 10, '#c9ced4'); ell(x1 + 105, 880, 18, 18, '#e8a33a');
  rrect(x0 + 170, y0 - 120, 160, 70, 10, '#1d1f24'); text('▼ 9', x0 + 250, y0 - 68, 44, '#ff5a3a', { fam: FONTS.mono, shadow: false });
}
