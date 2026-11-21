// The people and places of «Дети в затопленной пещере» in flat shapes, straight in screen space (y down, px at s = 1):
// the boys of the football team (red jerseys with numbers, a headlamp or not), the coach, the cave (rock walls, the low
// roof, stalactites, the muddy ledge), the flood water (murky, rising), the drip from the rock, the jungle mountain with
// the cave mouth and the boys' bikes left at it, the cave divers (black wetsuits, masks, headlamps, tanks), the sleeping
// boy in a full-face mask carried along the guide line, the ambulances outside.
import { lerp, clamp, TAU, hash } from './lib.js';
import { g, ell, limb, rect, rrect, fill, poly, smoothPath, polyPath, inside } from './flat.js';

const INKC = '#2c2c34';
const SKINS = ['#c98f66', '#b97a52', '#d9a77f', '#a86d48'];
const HAIR = '#1e1a18';

function eyes(o, y, dx = 22) {
  if (o.sleep) { for (const ex of [-dx, dx]) limb([[ex - 10, y], [ex, y + 5], [ex + 10, y]], 4, INKC, false); return; }
  const blink = o.shut || ((o.t ?? 0) + (o.seed ?? 0) * 0.37) % 3.3 < 0.12;
  for (const ex of [-dx, dx]) {
    if (blink) limb([[ex - 9, y], [ex + 9, y]], 4, INKC, false);
    else { ell(ex, y, 9, 11, '#ffffff'); ell(ex + 4 * (o.look ?? 0), y + 1 + 3 * (o.lookY ?? 0), 5, 6, INKC); }
  }
}

// a boy of the team: origin at the feet, ~560 px tall at s = 1. o: x y s face t seed look lookY smile open walk ph
// sit (on the ledge), arm / farArm (hand targets), lamp (a headlamp lit), cup (both hands cupped up at the drip), mud
export function drawBoy(o) {
  const s = o.s ?? 0.5, face = o.face ?? 1, ph = (o.ph ?? 0) * TAU, wk = clamp(o.walk ?? 0), sd = o.seed ?? 0, sit = clamp(o.sit ?? 0);
  const skin = SKINS[sd % SKINS.length], shirt = o.shirt ?? '#d7263d', shorts_ = o.shorts ?? '#1d1f2a';
  g.save(); g.translate(o.x, (o.y ?? 0) - wk * 6 * s * Math.abs(Math.sin(ph))); g.scale(s * face, s);
  if (sit > 0) {                                     // sitting on the ledge: the knees up, the arms round them
    for (const sx of [-18, 18]) { limb([[sx, -200], [sx + 70, -250], [sx + 80, -120]], 30, skin); ell(sx + 86, -112, 22, 12, '#f2f2f2'); }
    g.translate(0, 140);
  } else {
    for (const [i, sx] of [[0, -20], [1, 20]]) {
      const sw = wk * 28 * Math.sin(ph + i * Math.PI);
      limb([[sx * 0.6, -220], [sx + sw * 0.5, -120], [sx + sw, -20]], 26, skin); rrect(sx + sw - 18, -28, 44, 26, 10, '#f2f2f2');
    }
  }
  const arm = (from, to) => { limb([from, [lerp(from[0], to[0], 0.5) + 10, lerp(from[1], to[1], 0.5) + 8], to], 24, shirt); ell(to[0], to[1], 13, 13, skin); };
  arm([-52, -410], o.farArm ?? (o.cup ? [-14, -470] : sit ? [40, -270] : [-62 - 18 * wk * Math.sin(ph), -250]));
  fill(smoothPath([[-66, -240], [-74, -360], [-58, -440], [58, -440], [74, -360], [66, -240]]), shorts_);
  const shirtP = smoothPath([[-70, -300], [-78, -380], [-60, -446], [60, -446], [78, -380], [70, -300]]);
  fill(shirtP, shirt); inside(shirtP, () => { rect(-80, -446, 160, 14, 'rgba(255,255,255,0.85)');
    if (o.mud) for (let i = 0; i < 6; i++) ell(-50 + 100 * hash(sd + i * 1.7), -420 + 110 * hash(sd * 3 + i), 16, 9, 'rgba(90,70,40,0.35)'); });
  g.save(); g.scale(1, 1); g.fillStyle = 'rgba(255,255,255,0.9)'; g.font = '700 54px Oswald'; g.textAlign = 'center'; g.fillText(String(o.num ?? (sd % 12) + 2), 0, -350); g.restore();
  ell(0, -500, 58, 62, skin);
  fill(smoothPath([[-60, -500], [-62, -548], [-30, -572], [26, -574], [60, -548], [62, -505], [40, -536], [0, -546], [-44, -532]]), HAIR);
  eyes(o, -502, 21);
  if (o.open) ell(0, -466, 11, 9 * o.open, '#5a2a2a'); else limb([[-12, -468], [0, -464 + 7 * (o.smile ?? 0.2)], [12, -468]], 4, '#6a3a2a', false);
  if (o.lamp) { rect(-62, -540, 124, 12, '#2a2d36'); rrect(-18, -556, 36, 26, 7, '#3a3d44'); ell(0, -543, 10, 10, '#fff6d0'); }
  arm([52, -410], o.arm ?? (o.cup ? [14, -470] : sit ? [-30, -280] : [62 + 18 * wk * Math.sin(ph), -250]));
  if (o.cup) { ell(0, -476, 34, 16, skin); }
  g.restore();
}

// the coach: older, a dark blue training top, a cap; same rig as the boys
export function drawCoach(o) { drawBoy({ ...o, shirt: '#24406e', shorts: '#16192a', num: '', s: (o.s ?? 0.5) * 1.12 }); }

// the cave: dark rock all round with a lit ledge; roof y0, floor y1 (screen), lit 0…1 (their lamps)
export function caveWalls(t, o = {}) {
  const gr = g.createLinearGradient(0, 0, 0, 1920); gr.addColorStop(0, '#120f0d'); gr.addColorStop(0.5, '#231c17'); gr.addColorStop(1, '#0d0b09');
  g.fillStyle = gr; g.fillRect(0, 0, 1080, 1920);
  const r0 = o.roof ?? 520;
  fill(smoothPath([[-40, -40], [1120, -40], [1120, r0 - 60], [900, r0 + 20], [700, r0 - 30], [480, r0 + 30], [260, r0 - 20], [-40, r0 + 40]]), '#2e2620');
  for (let i = 0; i < 14; i++) {                    // stalactites
    const x = 40 + i * 76 + 20 * hash(i), h = 40 + 110 * hash(i * 3.1), y = r0 - 20 + 30 * Math.sin(i * 1.3);
    fill(polyPath([[x - 18, y], [x + 18, y], [x + 2, y + h]]), i % 2 ? '#3a3029' : '#2a221c');
  }
  for (let i = 0; i < 40; i++) ell(1080 * hash(i * 1.7), r0 - 200 * hash(i * 2.9) - 40, 30 + 30 * hash(i), 18, 'rgba(0,0,0,0.25)');
}
// the muddy ledge they sat on for nine days, at y (top), spanning x0…x1
export function ledge(y, x0 = 60, x1 = 1020) {
  fill(smoothPath([[x0 - 60, y + 260], [x0, y + 30], [x0 + 200, y - 10], [(x0 + x1) / 2, y - 24], [x1 - 160, y], [x1, y + 40], [x1 + 60, y + 280]]), '#5a4630');
  for (let i = 0; i < 16; i++) ell(lerp(x0, x1, hash(i * 2.3)), y + 30 + 60 * hash(i * 1.1), 40, 10, 'rgba(40,28,16,0.35)');
}
// flood water from y down: murky brown, the surface rippling, a little light on it
export function water(t, y, o = {}) {
  const gr = g.createLinearGradient(0, y, 0, 1920); gr.addColorStop(0, o.clear ? 'rgba(40,90,110,0.9)' : 'rgba(92,74,44,0.92)'); gr.addColorStop(1, o.clear ? 'rgba(10,30,40,0.98)' : 'rgba(40,30,18,0.98)');
  g.fillStyle = gr; g.fillRect(0, y, 1080, 1920 - y);
  for (let i = 0; i < 12; i++) { const sh = (t * 40 + i * 130) % 1300 - 100; limb([[sh, y + 6 + i * 3], [sh + 90, y + 6 + i * 3]], 3, 'rgba(255,240,200,0.25)', false); }
  limb([[0, y], [1080, y]], 4, 'rgba(255,240,200,0.35)', false);
}
// a cave diver: black wetsuit, a mask, a headlamp beam, tanks on the back; swimming (horizontal) or up (vertical);
// origin at the chest, facing right. beam 0…1
export function diver(x, y, s, o = {}) {
  g.save(); g.translate(x, y); g.rotate(o.rot ?? 0); g.scale(s * (o.face ?? 1), s);
  if (o.beam) { g.save(); g.globalAlpha = o.beam; const gr = g.createLinearGradient(140, -40, 900, -40); gr.addColorStop(0, 'rgba(255,245,210,0.55)'); gr.addColorStop(1, 'rgba(255,245,210,0)');
    g.fillStyle = gr; g.fill(polyPath([[150, -50], [900, -260], [900, 180]])); g.restore(); }
  rrect(-170, -80, 120, 50, 22, '#6a7684'); rrect(-160, -40, 110, 46, 22, '#5a6674');                 // the tanks
  fill(smoothPath([[-150, -40], [-60, -70], [80, -60], [120, -20], [80, 30], [-60, 30], [-150, 10]]), '#15171c');
  const k = Math.sin((o.t ?? 0) * 6);
  for (const [dy, a] of [[-10, k], [20, -k]]) { limb([[-150, dy], [-260, dy + 30 * a], [-330, dy + 10 * a]], 26, '#15171c'); fill(polyPath([[-330, dy - 10 + 10 * a], [-420, dy - 40 + 14 * a], [-420, dy + 40 + 14 * a], [-330, dy + 30 + 10 * a]]), '#2a5fb0'); }
  limb([[60, -40], [150, -90], [200, -70]], 24, '#15171c');
  ell(150, -40, 50, 46, '#15171c'); rrect(150, -64, 56, 40, 12, '#9fd3e6'); rrect(150, -64, 56, 40, 12, 'rgba(255,255,255,0.15)');
  rect(120, -96, 60, 14, '#2a2d36'); ell(186, -90, 10, 10, '#fff6d0');
  g.restore();
}
// the sleeping boy in a full-face mask, strapped, carried by a diver along the line; origin at his chest
export function carried(x, y, s, t) {
  g.save(); g.translate(x, y); g.scale(s, s);
  fill(smoothPath([[-120, -40], [80, -50], [110, 0], [80, 40], [-120, 30]]), '#d7263d');
  limb([[-120, -10], [-260, 0], [-330, 6]], 26, '#c98f66'); limb([[-120, 14], [-250, 26], [-320, 34]], 26, '#b97a52');
  ell(150, -4, 52, 50, '#c98f66'); fill(smoothPath([[118, -50], [190, -52], [205, 0], [190, 50], [118, 48], [100, 0]]), 'rgba(160,210,230,0.75)');
  limb([[140, -16], [152, -10], [164, -16]], 4, INKC, false); limb([[170, -16], [182, -10], [194, -16]], 4, INKC, false);
  rect(100, -60, 30, 120, '#2a2d36'); limb([[-80, -40], [-80, 40]], 8, '#ffd23f', false); limb([[20, -45], [20, 40]], 8, '#ffd23f', false);
  g.restore();
}
// bubbles rising from (x, y)
export function bubbles(t, x, y, n = 8, spread = 40) {
  for (let i = 0; i < n; i++) { const u = (t * 0.7 + i / n) % 1; ell(x + spread * Math.sin(i * 2.1 + t * 3) * u, y - u * 420, 6 + 6 * hash(i), 6 + 6 * hash(i), 'rgba(220,240,255,0.55)'); }
}
// the jungle mountain with the cave mouth; rain 0…1
export function mountainMouth(t, o = {}) {
  const gr = g.createLinearGradient(0, 0, 0, 1920); gr.addColorStop(0, o.rain ? '#4a5560' : '#8fc3e8'); gr.addColorStop(1, o.rain ? '#2c3a34' : '#cfe6c8');
  g.fillStyle = gr; g.fillRect(0, 0, 1080, 1920);
  fill(smoothPath([[-100, 1500], [80, 700], [300, 420], [560, 300], [820, 460], [1000, 760], [1180, 1500]]), '#2f5a36');
  for (let i = 0; i < 40; i++) ell(1080 * hash(i * 1.9), 480 + 900 * hash(i * 2.7), 70 + 40 * hash(i), 50, i % 2 ? '#3f7244' : '#28502f');
  fill(smoothPath([[330, 1500], [360, 1190], [460, 1080], [600, 1070], [720, 1180], [760, 1500]]), '#5a4a38');
  fill(smoothPath([[400, 1500], [420, 1240], [500, 1150], [600, 1146], [680, 1240], [700, 1500]]), '#0b0908');
  rect(0, 1500, 1080, 420, '#4a3c2a');
}
// a bike lying at the cave mouth
export function bike(x, y, s, rot = 0) {
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
  g.lineWidth = 10; g.strokeStyle = '#1d1f2a'; for (const dx of [-70, 70]) { g.beginPath(); g.arc(dx, 0, 48, 0, TAU); g.stroke(); }
  limb([[-70, 0], [-10, -60], [50, -60], [70, 0]], 10, '#d7263d', false); limb([[-10, -60], [0, 0], [-70, 0]], 10, '#d7263d', false);
  limb([[50, -60], [60, -90], [80, -90]], 8, '#1d1f2a', false); g.restore();
}
// rain over everything; k 0…1
export function rain(t, k) {
  if (k <= 0) return;
  g.save(); g.lineCap = 'round';
  for (let i = 0; i < Math.round(240 * k); i++) {
    const sp = 2400 + 800 * hash(i * 3.1), len = 50 + 60 * hash(i * 5.7), x0 = 1080 * hash(i * 1.7) + 200 * hash(i * 9.1);
    const y = ((t * sp + 2000 * hash(i * 2.3)) % 2200) - 150, x = x0 - 0.15 * y;
    g.strokeStyle = `rgba(200,212,235,${0.25 + 0.25 * hash(i * 4.4)})`; g.lineWidth = 2 + 2 * hash(i * 6.6);
    g.beginPath(); g.moveTo(x, y); g.lineTo(x - 0.15 * len, y + len); g.stroke();
  }
  g.restore();
}
// an ambulance, side on
export function ambulance(x, y, s, t) {
  g.save(); g.translate(x, y); g.scale(s, s);
  rrect(-220, -200, 440, 180, 20, '#f4f4f0'); rect(-220, -110, 440, 26, '#d52b1e'); rrect(110, -190, 90, 70, 10, '#9fd3e6');
  for (const dx of [-140, 130]) { ell(dx, -10, 42, 42, '#1d1f2a'); ell(dx, -10, 16, 16, '#9aa0aa'); }
  rect(-20, -170, 40, 60, '#d52b1e'); rect(-50, -150, 100, 20, '#d52b1e');
  ell(-160, -214, 18, 12, ((t * 3) % 1) < 0.5 ? '#2a6fe0' : '#d52b1e');
  g.restore();
}
