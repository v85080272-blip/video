// Inside the boat: one long compartment in side view. The curved wall of the pressure hull behind, ribs, pipes and
// cable runs overhead, red emergency lamps, the deck plates with the bilge under them. Along it: the control console
// with dead screens and the periscope, the blow panel with the big red hand wheel («ПРОДУВАНИЕ»), the emergency locker
// with the absorbent cans, two bunks, the ladder up to the escape hatch. Units like the flat in the earlier episodes:
// deck at y = 0, the hunter about 370 tall.
import { g, ell, limb, rect, rrect, poly, fill, smoothPath, polyPath, rrPath, inside } from './flat.js';
import { lerp, clamp, hash, noise, TAU, rgba, mix, bump } from './lib.js';
import { label } from './hud.js';
import { FONTS } from './type.js';

export const DECK = 0, CEIL = -800;
export const WHEEL = [-430, -215], WHEEL_R = 66;
export const PANEL = { x0: -620, x1: -260, y0: -580, y1: -130 };
export const LOCKER = { x0: 110, x1: 370, y0: -600, y1: -150 };
export const BUNK = { x0: 560, x1: 1080, low: -150, up: -430 };
export const LADDER = { x: 1440, w: 84 };
export const RIB = 460, LAMPS = [-1240, -700, -140, 340, 820, 1300, 1800];
export const HATCH = { x0: 1360, x1: 1530 };
const C = { wall: '#2b3445', wallHi: '#334056', wallSh: '#1d2431', rib: '#3a4559', ribHi: '#4b5870', steel: '#59677c', steelHi: '#7a8aa3', steelSh: '#3c475a',
  deck: '#4b5568', deckHi: '#64708a', bilge: '#0f131b', pipe: '#5b6b82', pipeHi: '#8a9bb6', copper: '#8a5a38', copperHi: '#b77b4e', dark: '#10141c', red: '#d63a2c', redHi: '#ff6a55', yellow: '#f2c230' };

// the shell: hull steel over the ceiling, the curved wall, ribs, overhead pipes and cables, the deck and the bilge
export function shell(t, st = {}) {
  const X0 = -2600, X1 = 2800;
  rect(X0, CEIL - 900, X1 - X0, 900, '#141922');
  rect(X0, CEIL, X1 - X0, -CEIL, C.wall);
  rect(X0, CEIL, X1 - X0, 110, C.wallSh); rect(X0, CEIL + 110, X1 - X0, 70, '#252d3b');
  rect(X0, -330, X1 - X0, 120, C.wallHi); rect(X0, -150, X1 - X0, 150, '#252d3b');
  // cable runs on the wall
  for (const [y, w] of [[-560, 10], [-540, 8], [-520, 12]]) limb([[X0, y], [X1, y]], w, '#161b25', false);
  for (let x = X0 + 100; x < X1; x += 300) rect(x, -578, 14, 70, '#3a4559');
  // ribs
  for (let x = -2300; x < X1; x += 460) {
    rect(x - 23, CEIL, 46, -CEIL, C.rib); rect(x - 23, CEIL, 9, -CEIL, C.ribHi);
    for (let y = CEIL + 60; y < -40; y += 110) ell(x + 6, y, 5, 5, C.wallSh);
  }
  // overhead: a big air line, a copper line, flanges and a small red valve now and then
  limb([[X0, CEIL + 50], [X1, CEIL + 50]], 54, C.pipe, false); limb([[X0, CEIL + 36], [X1, CEIL + 36]], 12, C.pipeHi, false);
  limb([[X0, CEIL + 118], [X1, CEIL + 118]], 30, C.copper, false); limb([[X0, CEIL + 110], [X1, CEIL + 110]], 8, C.copperHi, false);
  for (let x = X0 + 150; x < X1; x += 330) { rect(x, CEIL + 18, 22, 64, C.steelSh); rect(x + 150, CEIL + 98, 16, 40, '#5e3b24'); }
  for (let x = -2000; x < X1; x += 990) { g.lineWidth = 7; g.strokeStyle = C.red; g.beginPath(); g.arc(x, CEIL + 160, 24, 0, TAU); g.stroke(); limb([[x, CEIL + 132], [x, CEIL + 160]], 7, C.red, false); }
  // the lamps (their glow is drawn after the darkness, by lampGlow)
  for (const x of LAMPS) { rrect(x - 40, CEIL + 150, 80, 34, 10, '#262b36'); ell(x, CEIL + 186, 30, 14, st.lit === false ? '#4a2422' : '#ff4a3a'); }
  // the deck and the bilge
  rect(X0, DECK, X1 - X0, 700, C.bilge);
  for (let x = X0; x < X1; x += 260) { rect(x, DECK + 34, 20, 300, '#1a202b'); }
  limb([[X0, DECK + 150], [X1, DECK + 150]], 40, '#232b39', false);
  rect(X0, DECK, X1 - X0, 34, C.deck); rect(X0, DECK, X1 - X0, 7, C.deckHi);
  for (let x = X0; x < X1; x += 120) rect(x, DECK + 7, 4, 27, '#3a4356');
}
export function lampGlow(t, cam, toScreen, k = 1) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  for (const x of LAMPS) {
    const [sx, sy] = toScreen(cam, [x, CEIL + 186]), fl = 0.85 + 0.15 * noise(t * 7 + x, 2);
    const gr = g.createRadialGradient(sx, sy, 0, sx, sy, 160 * cam.z);
    gr.addColorStop(0, rgba('#ff5a40', 0.55 * k * fl)); gr.addColorStop(1, rgba('#ff5a40', 0));
    g.fillStyle = gr; g.beginPath(); g.arc(sx, sy, 160 * cam.z, 0, TAU); g.fill();
  }
}

// the control console and the periscope; power 0…1 lights the screens
export function console_(t, st = {}) {
  const pw = clamp(st.power ?? 0);
  fill(polyPath([[-1560, DECK], [-1560, -400], [-1520, -470], [-960, -470], [-930, -400], [-930, DECK]]), '#353f50');
  fill(polyPath([[-1560, -400], [-1520, -470], [-960, -470], [-930, -400]]), '#45516a');
  for (let i = 0; i < 3; i++) {
    const x = -1530 + i * 190;
    rrect(x, -720, 160, 200, 12, '#20262f');
    rrect(x + 12, -708, 136, 176, 8, mix('#0c1016', '#1f7a5a', pw));
    if (pw > 0.05) for (let k = 0; k < 4; k++) rect(x + 26, -680 + k * 36, 60 + 40 * hash(i * 9 + k), 8, rgba('#8dffcf', 0.6 * pw));
    limb([[x + 30, -700], [x + 120, -560]], 10, 'rgba(255,255,255,0.05)', false);
  }
  for (let i = 0; i < 9; i++) { const x = -1500 + i * 60; rect(x, -430, 18, 26, '#1a1f29'); rect(x + 4, -440 + (i % 3) * 6, 10, 14, i % 4 === 0 ? C.red : '#9aa6b8'); }
  for (let i = 0; i < 3; i++) { const x = -1460 + i * 190; ell(x, -230, 50, 50, '#20262f'); ell(x, -230, 40, 40, '#d9dee6'); limb([[x, -230], [x - 26, -218 + 6 * i]], 5, '#20262f', false); }
  // the periscope
  rect(-850, CEIL, 60, 470, C.steel); rect(-850, CEIL, 14, 470, C.steelHi);
  rrect(-880, CEIL + 460, 120, 110, 14, C.steelSh); rrect(-900, CEIL + 500, 40, 40, 10, '#20262f');
  limb([[-760, CEIL + 520], [-700, CEIL + 520]], 18, '#20262f', false); limb([[-880, CEIL + 520], [-940, CEIL + 520]], 18, '#20262f', false);
}

// the blow panel: plate, label, two pipes up into the air line, a pressure dial and the hand wheel (angle wheel)
export function panel(t, st = {}) {
  const { x0, x1, y0, y1 } = PANEL;
  limb([[x0 + 60, y0], [x0 + 60, CEIL + 50]], 26, C.pipe, false); limb([[x1 - 60, y0], [x1 - 60, CEIL + 50]], 26, C.pipe, false);
  rrect(x0, y0, x1 - x0, y1 - y0, 18, '#3a4558'); rrect(x0 + 10, y0 + 10, x1 - x0 - 20, y1 - y0 - 20, 12, '#323c4d');
  rrect(x0 + 40, y0 + 22, x1 - x0 - 80, 50, 8, C.yellow);
  label('ПРОДУВАНИЕ', (x0 + x1) / 2, y0 + 58, 34, '#1a1a1a', { shadow: false, stroke: false });
  for (let i = 0; i < 7; i++) poly([[x0 + 30 + i * 46, y1 - 30], [x0 + 52 + i * 46, y1 - 30], [x0 + 38 + i * 46, y1 - 10], [x0 + 16 + i * 46, y1 - 10]], i % 2 ? C.yellow : '#1a1a1a');
  // the pressure dial: its needle drops while the air goes out
  const dp = [x1 - 70, y0 + 130], nd = lerp(-2.4, -0.7, clamp(st.air ?? 1));
  ell(dp[0], dp[1], 44, 44, '#20262f'); ell(dp[0], dp[1], 36, 36, '#e6e9ee');
  limb([dp, [dp[0] + Math.cos(nd) * 28, dp[1] + Math.sin(nd) * 28]], 5, C.red, false);
  // the shaft and the wheel
  ell(WHEEL[0], WHEEL[1], 30, 30, '#20262f');
  wheel(WHEEL[0], WHEEL[1], WHEEL_R, st.wheel ?? 0);
}
export function wheel(x, y, r, a) {
  g.save(); g.translate(x, y); g.rotate(a);
  for (let i = 0; i < 5; i++) { const b = i * TAU / 5; limb([[0, 0], [Math.cos(b) * r, Math.sin(b) * r]], r * 0.16, '#a92a20', false); }
  g.lineWidth = r * 0.24; g.strokeStyle = '#a92a20'; g.beginPath(); g.arc(4, 5, r, 0, TAU); g.stroke();
  g.strokeStyle = C.red; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke();
  g.lineWidth = r * 0.07; g.strokeStyle = C.redHi; g.beginPath(); g.arc(0, 0, r - r * 0.05, -2.6, -1.2); g.stroke();
  for (let i = 0; i < 10; i++) { const b = i * TAU / 10; ell(Math.cos(b) * r, Math.sin(b) * r, r * 0.07, r * 0.07, '#a92a20'); }
  ell(0, 0, r * 0.26, r * 0.26, '#c8ccd4'); ell(0, 0, r * 0.12, r * 0.12, '#5a6170');
  g.restore();
}

// the emergency locker, door open: shelves of yellow absorbent cans; taken = how many are gone
export function locker(t, st = {}) {
  const { x0, x1, y0, y1 } = LOCKER;
  rrect(x0, y0, x1 - x0, y1 - y0, 10, '#1a1f28');
  for (let i = 0; i < 14; i++) { const u = i / 14; poly([[x0 + u * (x1 - x0), y0], [x0 + (u + 1 / 28) * (x1 - x0), y0], [x0 + (u + 1 / 28) * (x1 - x0), y0 + 18], [x0 + u * (x1 - x0), y0 + 18]], i % 2 ? C.yellow : '#1a1a1a'); }
  for (const y of [-420, -250]) rect(x0 + 12, y, x1 - x0 - 24, 12, '#3a4356');
  let n = 0;
  for (const [y, k] of [[-250, 3], [-420, 3]]) for (let i = 0; i < k; i++) {
    n++; if (n <= (st.taken ?? 0)) continue;
    can(x0 + 50 + i * 76, y, 0.9);
  }
  // the door swung open to the left
  poly([[x0, y0], [x0 - 110, y0 + 40], [x0 - 110, y1 - 40], [x0, y1]], '#46516a');
  poly([[x0 - 12, y0 + 10], [x0 - 98, y0 + 46], [x0 - 98, y1 - 46], [x0 - 12, y1 - 10]], '#3a4558');
  rrect(x0 - 70, (y0 + y1) / 2 - 40, 30, 50, 6, '#ffffff', 0.85);
  { const cx = x0 - 55, cy = (y0 + y1) / 2 - 15; limb([[cx - 9, cy], [cx + 9, cy]], 5, C.red, false); limb([[cx, cy - 9], [cx, cy + 9]], 5, C.red, false); }
}
// one absorbent can standing on its base (x, y): yellow with a black band; tilt for pouring
export function can(x, y, s = 1, tilt = 0, open = false) {
  g.save(); g.translate(x, y); g.rotate(tilt); g.scale(s, s);
  rrect(-30, -130, 60, 130, 10, C.yellow); rect(-30, -96, 60, 40, '#1d1d1d'); rect(-30, -130, 14, 130, '#ffe07a');
  label('CO₂', 0, -66, 24, C.yellow, { shadow: false, stroke: false });
  if (open) ell(0, -130, 30, 9, '#e9ecef'); else rect(-34, -140, 68, 14, '#9aa6b8');
  g.restore();
}

// the bunks: posts, two boards with mattresses, a pillow, a curtain on the upper one
export function bunks(t, st = {}) {
  const { x0, x1, low, up } = BUNK;
  rect(x0 - 14, up - 220, 28, -up + 220, C.steelSh); rect(x1 - 14, up - 220, 28, -up + 220, C.steelSh);
  for (const y of [low, up]) {
    rect(x0, y, x1 - x0, 26, C.steel); rect(x0, y, x1 - x0, 7, C.steelHi);
    rrect(x0 + 10, y - 48, x1 - x0 - 20, 50, 16, '#4f6386');
    rrect(x1 - 160, y - 86, 140, 46, 20, '#d9dde6');
  }
  rrect(x0 + 20, low + 40, x1 - x0 - 40, -low - 60, 10, '#323c4d');
  for (let i = 0; i < 2; i++) rect(x0 + 50 + i * 250, low + 80, 160, 12, '#1d2431');
  // the curtain of the upper bunk, gathered at the left
  for (let i = 0; i < 6; i++) limb([[x0 + 20 + i * 18, up - 210], [x0 + 26 + i * 18 + 6 * Math.sin(t * 0.8 + i), up - 60]], 20, i % 2 ? '#2f5b4f' : '#3a6b5d', false);
  rect(x0 - 10, up - 222, x1 - x0 + 20, 10, C.steelHi);
}
// the blanket over the lying hunter: from x0 (his feet) to x1 (his chest), its top at y
export function blanket(t, x0, x1, y, breathe = 0) {
  const b = 6 * breathe;
  const pts = [[x0 - 30, BUNK.low - 40], [x0 - 34, y + 18], [x0 + 10, y - 26], [x0 + 70, y - 8], [lerp(x0, x1, 0.45), y + 8], [x1 - 60, y - 6 - b], [x1, y - 10 - b], [x1 + 12, BUNK.low - 40]];
  const p = smoothPath(pts);
  fill(p, '#8a4a3a');
  inside(p, () => { rect(x0 - 60, y + 26, x1 - x0 + 120, 16, '#a85f4a'); rect(x1 - 40, y - 40, 60, 200, '#6e3a2e'); });
}

// the ladder up to the escape trunk; open 0…1 swings the hatch up and lets the sea light in
export function ladder(t, st = {}) {
  const { x, w } = LADDER, { x0, x1 } = HATCH, open = clamp(st.open ?? 0);
  // the trunk above the ceiling
  rect(x0, CEIL - 700, x1 - x0, 700, '#1c222d'); rect(x0, CEIL - 700, 18, 700, '#2a3240'); rect(x1 - 18, CEIL - 700, 18, 700, '#2a3240');
  if (open > 0.01) {
    const gr = g.createLinearGradient(0, CEIL - 700, 0, CEIL + 400);
    gr.addColorStop(0, rgba('#7fd6ff', 0.9 * open)); gr.addColorStop(1, rgba('#3aa0e0', 0));
    g.fillStyle = gr; g.fillRect(x0 + 18, CEIL - 700, x1 - x0 - 36, 1100);
    for (let i = 0; i < 12; i++) { const u = (t * 0.9 + i / 12) % 1, bx = x0 + 40 + hash(i * 3.3) * (x1 - x0 - 80); ell(bx + 10 * Math.sin(t * 4 + i), CEIL + 300 - u * 1000, 8 + 10 * hash(i), 8 + 10 * hash(i), rgba('#e6f8ff', 0.7 * open * bump(u))); }
  }
  // the hatch ring in the ceiling and its lid on the hinge at x1
  rect(x0 - 30, CEIL - 10, x1 - x0 + 60, 30, C.steelSh);
  g.save(); g.translate(x1, CEIL); g.rotate(-open * 1.7);
  rrect(-(x1 - x0), -22, x1 - x0, 30, 8, C.steelHi);
  g.lineWidth = 8; g.strokeStyle = C.red; g.beginPath(); g.arc(-(x1 - x0) / 2, 18, 30, 0, Math.PI); g.stroke();
  g.restore();
  // rails and rungs
  rect(x - w / 2 - 8, CEIL, 16, -CEIL, C.steelHi); rect(x + w / 2 - 8, CEIL, 16, -CEIL, C.steelHi);
  for (let y = -70; y > CEIL; y -= 86) rect(x - w / 2, y, w, 12, C.steel);
}

// the absorbent powder on the deck: from xa to xb, k 0…1 how much has landed
export function powder(t, xa, xb, k) {
  if (k <= 0.01 || xb - xa < 20) return;
  const pts = [];
  for (let x = xa; x <= xb; x += 18) { const u = (x - xa) / (xb - xa), h = 16 * k * (0.55 + 0.45 * noise(x * 0.05, 9)) * Math.sin(Math.PI * clamp(u * 1.1)); pts.push([x, DECK - Math.max(2, h)]); }
  fill(smoothPath([...pts, [xb, DECK + 2], [xa, DECK + 2]], true), '#e9ecef');
  for (let i = 0; i < 18; i++) { const x = lerp(xa, xb, hash(i * 2.7)); ell(x, DECK - 4 - 6 * hash(i * 5.1), 4, 3, '#ffffff', 0, k); }
}
