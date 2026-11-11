// The places of «Правда или миф», №7 «Заблудился в лесу» in flat shapes, straight in screen space; each scene keeps its
// subject near x = 540 so that a 352-px column shows it. The forest by day (layers of firs, light through the trees),
// a big trunk with moss and a compass, a berry bush and a bird that pecks, a clearing with a «you are here» pin, a
// phone with 112, «АУ!» and the searchers' paths closing in.
import { lerp, clamp, TAU, hash } from './lib.js';
import { g, ell, limb, rect, rrect, fill, poly, smoothPath, polyPath, rrPath } from './flat.js';
import { text, FONTS, INK } from './type.js';

export const GROUND = 1180;
function grad(stops, y0 = 0, y1 = 1920, x0 = -400, x1 = 1480) { const gr = g.createLinearGradient(0, y0, 0, y1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); g.fillStyle = gr; g.fillRect(x0, y0, x1 - x0, y1 - y0); }
export function fir(x, y, h, c = '#2f6b45', d = '#245636') {
  const w = h * 0.42;
  rect(x - h * 0.03, y - h * 0.12, h * 0.06, h * 0.14, '#6b4a2b');
  for (let i = 0; i < 4; i++) { const y0 = y - h * 0.1 - i * h * 0.22, ww = w * (1 - i * 0.2); poly([[x - ww / 2, y0], [x + ww / 2, y0], [x, y0 - h * 0.34]], i % 2 ? c : d); }
}
// the forest by day; tint: a colour pushed over the far layers (each column its own)
export function forest(t, o = {}) {
  const tint = o.tint ?? '#cfe8c8';
  grad([[0, '#bfe3f2'], [0.5, tint], [1, '#e9f3d9']], 0, GROUND);
  for (let i = 0; i < 16; i++) fir(-300 + i * 110 + (i % 2) * 40, GROUND - 330, 260 + 40 * hash(i), '#8fb89a', '#7fa98b');
  for (let i = 0; i < 12; i++) fir(-340 + i * 150 + (i % 3) * 30, GROUND - 180, 380 + 60 * hash(i + 9), '#4f8a5f', '#3f7a50');
  g.save(); g.globalAlpha = 0.18;                                             // light through the trees
  for (let i = 0; i < 5; i++) { const x = -200 + i * 360 + 30 * Math.sin(t * 0.4 + i); poly([[x, 0], [x + 120, 0], [x + 420, GROUND], [x + 260, GROUND]], '#fffbe0'); }
  g.restore();
  grad([[0, '#7aa35c'], [1, '#5c8546']], GROUND, 1920);
  for (let i = 0; i < 26; i++) { const x = (i * 97) % 1400 - 160, y = GROUND + 30 + (i * 53) % 700; limb([[x, y], [x + 10, y - 26], [x + 20, y]], 5, '#4c7a3a'); }
}
// 1 — a big trunk with moss; spread 0…1: moss on every side; compass 0…1
export function mossTree(t, o = {}) {
  const x = 540, top = 120, w = 230;
  rect(x - w / 2, top, w, GROUND - top + 20, '#7a5634'); rect(x - w / 2, top, 30, GROUND - top + 20, '#8d6640'); rect(x + w / 2 - 40, top, 40, GROUND - top + 20, '#64452a');
  for (let i = 0; i < 14; i++) limb([[x - w / 2 + 20 + (i * 37) % (w - 40), top + 40 + i * 70], [x - w / 2 + 30 + (i * 37) % (w - 40), top + 90 + i * 70]], 5, '#5c3f24');
  const moss = (cx, cy, rx, ry, a) => { g.save(); g.globalAlpha = a; ell(cx, cy, rx, ry, '#4f9a3c'); for (let k = 0; k < 6; k++) ell(cx - rx * 0.6 + k * rx * 0.24, cy - ry * 0.4 + (k % 2) * ry * 0.5, rx * 0.3, ry * 0.35, '#6cb84f'); g.restore(); };
  moss(x - 70, 760, 70, 150, 1); moss(x - 80, 1020, 60, 110, 1);                         // the «north» side
  const s = o.spread ?? 0;
  if (s > 0) { moss(x + 70, 640, 66, 120, s); moss(x + 20, 900, 80, 90, s); moss(x + 60, 1080, 60, 80, s); moss(x - 30, 520, 50, 70, s); }
  ell(x - 260, GROUND + 60, 90, 22, '#4f9a3c'); ell(x + 230, GROUND + 50, 70, 18, '#4f9a3c');
  const c = o.compass ?? 0;
  if (c > 0) {                                                                       // a compass that spins
    g.save(); g.translate(x + 300, 420); g.scale(c, c);
    ell(0, 0, 90, 90, '#ffffff'); ell(0, 0, 78, 78, '#eef3f7'); text('С', 0, -46, 36, '#c62828', { fam: FONTS.block, shadow: false });
    g.rotate(o.spin ?? 0); poly([[0, -60], [14, 0], [-14, 0]], '#e53935'); poly([[0, 60], [14, 0], [-14, 0]], '#37474f'); ell(0, 0, 9, 9, '#263238');
    g.restore();
  }
  if (o.loop > 0) {                                                                  // walking in circles
    g.save(); g.globalAlpha = o.loop; g.setLineDash([18, 16]); g.lineWidth = 8; g.strokeStyle = '#ffd23f';
    g.beginPath(); g.ellipse(x, GROUND + 140, 330, 90, 0, 0, TAU * Math.min(1, o.loop * 1.2)); g.stroke(); g.setLineDash([]); g.restore();
  }
}
// 2 — a berry bush and a bird that pecks; poison 0…1 marks the berries
export function berryBush(t, o = {}) {
  const x = 540, y = GROUND + 20;
  for (const [dx, dy, r] of [[-170, -150, 150], [10, -230, 180], [180, -140, 150], [-60, -60, 170], [120, -50, 150]]) ell(x + dx, y + dy, r, r * 0.8, '#3f7f45');
  for (const [dx, dy, r] of [[-120, -200, 90], [60, -290, 100], [200, -180, 80]]) ell(x + dx, y + dy, r, r * 0.7, '#4f9a55');
  const B = [[-210, -190], [-150, -110], [-90, -250], [-20, -170], [40, -300], [90, -120], [150, -230], [210, -150], [-40, -60], [120, -60]];
  B.forEach(([dx, dy], i) => { for (let k = 0; k < 3; k++) { ell(x + dx + (k - 1) * 18, y + dy + (k % 2) * 12, 16, 16, '#d62828'); ell(x + dx + (k - 1) * 18 - 5, y + dy + (k % 2) * 12 - 5, 5, 5, '#ff8a80'); } });
  // the bird on a branch, pecking
  const bx = x + 150, by = y - 330, pk = Math.max(0, Math.sin(t * 7)) ** 3;
  limb([[bx - 120, by + 40], [bx + 90, by + 30]], 10, '#6b4a2b');
  g.save(); g.translate(bx, by); g.rotate(0.5 * pk);
  ell(0, 0, 46, 36, '#5b6b8c'); ell(10, 8, 30, 22, '#f2a65a'); ell(34, -26, 26, 24, '#5b6b8c'); ell(44, -30, 6, 6, '#ffffff'); ell(46, -30, 3, 3, INK);
  poly([[56, -26], [80, -20], [56, -16]], '#f9c74f'); poly([[-40, -6], [-80, -20], [-70, 10]], '#4a5876');
  g.restore();
  limb([[bx - 6, by + 34], [bx - 10, by + 40]], 4, '#f9c74f'); limb([[bx + 8, by + 34], [bx + 6, by + 40]], 4, '#f9c74f');
  const p = o.poison ?? 0;
  if (p > 0) {
    g.save(); g.globalAlpha = p;
    for (const [dx, dy] of [[-150, -110], [40, -300], [150, -230]]) {
      g.save(); g.translate(x + dx, y + dy - 50); ell(0, 0, 30, 28, '#ffffff'); ell(-10, -2, 8, 9, INK); ell(10, -2, 8, 9, INK); rect(-12, 16, 24, 10, '#ffffff'); limb([[-4, 16], [-4, 26]], 3, INK); limb([[4, 16], [4, 26]], 3, INK); g.restore();
    }
    g.restore();
  }
}
// 3 — a clearing: the pin «you are here», a phone with 112, «АУ!», the searchers' paths closing in
export function clearing(t, o = {}) {
  const x = 540, y = GROUND + 60;
  ell(x, y + 20, 300, 60, '#8dbb6a');
  fir(x - 280, y - 10, 420, '#3f7a50', '#2f6b45'); fir(x + 290, y, 380, '#3f7a50', '#2f6b45');
  const k = o.pin ?? 1, bob = 10 * Math.sin(t * 3);
  g.save(); g.translate(x, y - 250 + bob); g.scale(k, k);
  fill(smoothPath([[0, 120], [-70, 10], [-60, -50], [0, -90], [60, -50], [70, 10]]), '#e53935'); ell(0, -30, 32, 32, '#ffffff');
  g.restore();
  text('ТЫ ЗДЕСЬ', x, y - 400 + bob, 44, '#ffffff', { fam: FONTS.block });
  const ph = o.phone ?? 0;
  if (ph > 0) {
    g.save(); g.translate(x - 250, y - 560); g.scale(ph, ph); g.rotate(-0.12);
    rrect(-70, -120, 140, 240, 22, '#263238'); rrect(-58, -100, 116, 190, 10, '#4fc3f7');
    text('112', 0, 12, 52, '#ffffff', { fam: FONTS.block, shadow: false }); ell(0, 104, 9, 9, '#90a4ae');
    g.restore();
  }
  const au = o.au ?? 0;
  if (au > 0) {
    g.save(); g.translate(x + 230, y - 560); g.scale(au, au);
    fill(smoothPath([[-110, -60], [110, -60], [120, 40], [10, 50], [-30, 100], [-20, 50], [-110, 40]]), '#ffffff');
    text('АУ!', 0, 18, 72, '#c62828', { fam: FONTS.block, shadow: false });
    g.restore();
  }
  const s = o.search ?? 0;
  if (s > 0) {                                                                       // the searchers come from three sides
    g.save(); g.setLineDash([16, 14]); g.lineWidth = 8; g.strokeStyle = '#ffd23f';
    for (const [sx, sy] of [[x - 520, y - 120], [x + 520, y - 160], [x, y + 420]]) { g.beginPath(); g.moveTo(sx, sy); g.lineTo(lerp(sx, x, s), lerp(sy, y - 120, s)); g.stroke(); }
    g.setLineDash([]); g.restore();
    for (const [sx, sy] of [[x - 520, y - 120], [x + 520, y - 160], [x, y + 420]]) {
      const px = lerp(sx, x, s * 0.92), py = lerp(sy, y - 120, s * 0.92);
      ell(px, py - 30, 18, 18, '#ffcc80'); rrect(px - 20, py - 12, 40, 52, 10, '#ff7043');
    }
  }
}
