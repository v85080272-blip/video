// The places and people of «Операция спасения», №1 «Девочка и щенок в тайге», in flat shapes, straight in screen space:
// the summer taiga (larches, hills, grass taller than a man), the little girl (standing, walking, sitting in the grass),
// a helicopter, the searchers in a chain, the village with its fence, the tracker dogs on the puppy's trail, the statue
// «the girl and the dog».
import { lerp, clamp, TAU, hash } from './lib.js';
import { g, ell, limb, rect, rrect, fill, poly, smoothPath, polyPath, rrPath } from './flat.js';
import { text, FONTS, INK } from './type.js';

export const GROUND = 1240;
function grad(stops, y0 = 0, y1 = 1920, x0 = -400, x1 = 1480) { const gr = g.createLinearGradient(0, y0, 0, y1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); g.fillStyle = gr; g.fillRect(x0, y0, x1 - x0, y1 - y0); }
export function larch(x, y, h, c = '#3f7a4a', d = '#2f6a3c') {
  rect(x - h * 0.02, y - h, h * 0.04, h, '#6b4a2b');
  for (let i = 0; i < 7; i++) { const yy = y - h * 0.18 - i * h * 0.12, w = h * (0.34 - i * 0.04); poly([[x - w / 2, yy], [x + w / 2, yy], [x, yy - h * 0.2]], i % 2 ? c : d); }
}
// the summer taiga by day; o.scroll moves the near layers (a walk); o.dusk 0…1 a warmer, lower light
export function taiga(t, o = {}) {
  const sc = o.scroll ?? 0, dusk = o.dusk ?? 0;
  grad([[0, dusk ? '#f6b26b' : '#8fd0f2'], [0.55, dusk ? '#ffe0a8' : '#d6f0fb'], [1, '#eef7e4']], 0, GROUND);
  fill(smoothPath([[-400, GROUND - 260], [0, GROUND - 420], [380, GROUND - 330], [760, GROUND - 470], [1200, GROUND - 300], [1480, GROUND - 380], [1480, GROUND], [-400, GROUND]]), '#a9c8a0');
  for (let i = 0; i < 18; i++) larch((-200 + i * 95 - sc * 0.3) % 1600 - 100, GROUND - 120, 300 + 80 * hash(i), '#7fa98b', '#6e9a7b');
  for (let i = 0; i < 9; i++) larch((-150 + i * 170 - sc * 0.6 + 2000) % 1500 - 200, GROUND - 20, 560 + 140 * hash(i + 4));
  grad([[0, '#7fae4f'], [1, '#5b8a39']], GROUND, 1920);
}
// grass taller than a man: blades from y up to y - h, swaying; front grass drawn last hides what is behind it
export function grass(t, y, h, o = {}) {
  const n = o.n ?? 60, x0 = o.x0 ?? -60, x1 = o.x1 ?? 1140, c = o.color ?? '#6fa53d', c2 = o.color2 ?? '#88bf4f';
  for (let i = 0; i < n; i++) {
    const x = x0 + (x1 - x0) * (i + 0.5 * hash(i * 7)) / n, hh = h * (0.7 + 0.3 * hash(i + 3)), sw = 14 * Math.sin(t * 1.6 + i * 0.7);
    fill(smoothPath([[x - 9, y], [x - 4 + sw * 0.4, y - hh * 0.5], [x + sw, y - hh], [x + 4 + sw * 0.4, y - hh * 0.5], [x + 9, y]]), i % 3 ? c : c2);
  }
}
// the little girl, feet at (x, y), height ≈ 300·s: a light dress, two little tails; o.walk, o.sit, o.wave, o.color (a statue)
export function child(x, y, s, t, o = {}) {
  const C = o.color, skin = C ?? '#f6c9a8', dress = C ?? '#f48fb1', hair = C ? C : '#3b2a1e', dark = C ? '#5d3d1f' : INK;
  g.save(); g.translate(x, y); g.scale(s * (o.flip ? -1 : 1), s);
  if (o.sit) {
    fill(smoothPath([[-70, -10], [70, -10], [60, -150], [-60, -150]]), dress); ell(-40, -6, 46, 20, skin); ell(40, -6, 46, 20, skin);
  } else {
    const ph = o.walk ? Math.sin(t * 7) : 0;
    limb([[-16, -110], [-16 - 10 * ph, 0]], 18, skin, false); limb([[16, -110], [16 + 10 * ph, 0]], 18, skin, false);
    ell(-16 - 10 * ph, 0, 16, 9, dark); ell(16 + 10 * ph, 0, 16, 9, dark);
    fill(smoothPath([[-60, -100], [60, -100], [36, -230], [-36, -230]]), dress);
  }
  const by = o.sit ? -150 : -230;
  limb([[-30, by + 14], [-56, by + 90 + (o.sit ? -10 : 0)]], 15, skin, false);
  if (o.wave) limb([[30, by + 14], [70, by - 60 - 12 * Math.sin(t * 9)]], 15, skin, false); else limb([[30, by + 14], [56, by + 90]], 15, skin, false);
  ell(0, by - 52, 52, 56, skin);
  fill(smoothPath([[-56, by - 50], [-48, by - 100], [0, by - 116], [48, by - 100], [56, by - 50], [30, by - 84], [-30, by - 84]]), hair);
  ell(-60, by - 70, 16, 22, hair); ell(60, by - 70, 16, 22, hair);                        // the two little tails
  if (!C) { ell(-18, by - 48, 6, 8, INK); ell(18, by - 48, 6, 8, INK); limb([[-10, by - 22], [10, by - 22]], 4, '#a05a4a', false); }
  g.restore();
}
// a helicopter flying to the right; rotor spinning
export function helicopter(x, y, s, t) {
  g.save(); g.translate(x, y); g.scale(s, s);
  rrect(-120, -50, 200, 100, 50, '#e53935'); ell(40, -10, 52, 40, '#bfe3f5'); rect(-260, -20, 160, 26, '#e53935'); rect(-270, -60, 26, 70, '#c62828');
  limb([[-60, 54], [60, 54]], 8, '#37474f', false); limb([[-40, 50], [-46, 66]], 6, '#37474f', false); limb([[40, 50], [46, 66]], 6, '#37474f', false);
  rect(-8, -80, 16, 30, '#37474f');
  const r = Math.sin(t * 40); limb([[-200 * r, -84], [200 * r, -84]], 8, '#263238', false);
  g.restore();
}
// a searcher in an orange vest, feet at (x, y)
export function searcher(x, y, s, t, o = {}) {
  const ph = Math.sin(t * 6 + (o.ph ?? 0));
  g.save(); g.translate(x, y); g.scale(s * (o.flip ? -1 : 1), s);
  limb([[-10, -80], [-10 - 12 * ph, 0]], 16, '#37474f', false); limb([[10, -80], [10 + 12 * ph, 0]], 16, '#37474f', false);
  rrect(-30, -190, 60, 116, 16, '#ff7043'); rect(-30, -150, 60, 12, '#fff59d');
  ell(0, -215, 24, 24, '#f2c19b'); rrect(-26, -244, 52, 20, 8, '#1e88e5');
  limb([[26, -170], [44 + 10 * ph, -110]], 12, '#ff7043', false); limb([[-26, -170], [-44 - 10 * ph, -110]], 12, '#ff7043', false);
  g.restore();
}
// the village: wooden houses and a fence
export function village(t) {
  for (const [x, w, c] of [[60, 300, '#a1683a'], [430, 260, '#8d5a32'], [760, 320, '#a1683a']]) {
    rect(x, GROUND - 260, w, 260, c); poly([[x - 20, GROUND - 260], [x + w + 20, GROUND - 260], [x + w / 2, GROUND - 400]], '#5d4037');
    rrect(x + w / 2 - 50, GROUND - 200, 100, 80, 6, '#bfe3f5'); rect(x + w / 2 - 4, GROUND - 200, 8, 80, '#6d4c41');
  }
  for (let i = 0; i < 24; i++) rect(-20 + i * 48, GROUND - 90, 30, 110, '#c49a6c');
  rect(-20, GROUND - 70, 1200, 14, '#a1783f');
}
// paw prints along a path (the puppy's trail), k 0…1 how far it is drawn
export function trail(pts, k, color = '#5d4037') {
  const n = Math.floor(pts.length * k);
  for (let i = 0; i < n; i++) { const [x, y] = pts[i]; ell(x, y, 12, 9, color); ell(x - 10, y - 12, 4, 4, color); ell(x, y - 15, 4, 4, color); ell(x + 10, y - 12, 4, 4, color); }
}
// berries and a stream, what she lived on
export function berries(x, y, s = 1) {
  g.save(); g.translate(x, y); g.scale(s, s);
  for (const [dx, dy, r] of [[-60, -40, 70], [40, -60, 80], [0, 0, 80]]) ell(dx, dy, r, r * 0.7, '#3f7f45');
  for (let i = 0; i < 9; i++) ell(-70 + (i * 37) % 140, -70 + (i * 29) % 90, 12, 12, '#d62828');
  g.restore();
}
export function stream(t, y) {
  fill(smoothPath([[-100, y], [300, y - 20], [700, y + 10], [1180, y - 10], [1180, y + 70], [700, y + 90], [300, y + 60], [-100, y + 80]]), '#4fc3f7');
  for (let i = 0; i < 8; i++) { const x = (i * 150 + t * 60) % 1300 - 100; limb([[x, y + 30], [x + 60, y + 32]], 5, 'rgba(255,255,255,0.7)', false); }
}
// the statue «the girl and the dog»: bronze on a stone pedestal
export function statue(x, y, s, t) {
  rrect(x - 230 * s, y, 460 * s, 160 * s, 12, '#9e9e9e'); rect(x - 250 * s, y - 20 * s, 500 * s, 30 * s, '#bdbdbd');
  child(x - 40 * s, y - 20 * s, 1.15 * s, t, { color: '#a5743f', wave: false });
  g.save(); g.translate(x + 120 * s, y - 20 * s); g.scale(s, s);
  ell(0, -60, 80, 52, '#8d6234'); ell(70, -120, 42, 40, '#8d6234'); poly([[56, -150], [70, -196], [86, -150]], '#8d6234'); poly([[80, -150], [100, -192], [108, -146]], '#8d6234');
  limb([[-50, -30], [-50, 0]], 20, '#8d6234', false); limb([[40, -30], [40, 0]], 20, '#8d6234', false); limb([[-74, -70], [-120, -120]], 16, '#8d6234', false);
  g.restore();
  text('ДЕВОЧКА И СОБАКА', x, y + 100 * s, 34 * s, '#ffffff', { fam: FONTS.cond });
}
