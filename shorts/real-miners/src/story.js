// The people and things of «69 дней под землёй» in flat shapes, drawn straight in screen space (y down, px at s = 1):
// the miners (a hard hat with a lamp, an orange overall with reflective bands, dust on the face; the foreman in a white
// hat), a crowd of them in the refuge, the mountain in section (the desert on top, the ramp spiralling down, the refuge at
// 700 m), the tunnel, the drill bit with the note taped to it, the «paloma» tubes, the rescue capsule in the colours of the
// Chilean flag, the camp on the surface with its flags and the winch tower, and the food: tuna, milk, a biscuit.
import { lerp, clamp, TAU, hash } from './lib.js';
import { g, ell, limb, rect, rrect, fill, poly, smoothPath, polyPath, inside } from './flat.js';

const INKC = '#2c2c34';
const SKINS = ['#d9a77f', '#c98f66', '#b97a52', '#e0b58e'];
const HATS = ['#f2c94c', '#f2c94c', '#ef8a2a', '#f2c94c', '#e9e4d6'];

function eyes(o, y, dx = 22) {
  const blink = o.shut || ((o.t ?? 0) + (o.seed ?? 0) * 0.37) % 3.3 < 0.12;
  for (const ex of [-dx, dx]) {
    if (blink) limb([[ex - 9, y], [ex + 9, y]], 4, INKC, false);
    else { ell(ex, y, 9, 11, '#ffffff'); ell(ex + 4 * (o.look ?? 0), y + 1 + 3 * (o.lookY ?? 0), 5, 6, INKC); }
  }
}

// a hard hat (dome, brim) with the lamp on its front; beam > 0 draws the light cone (in the facing direction, down a bit)
export function hardHat(c, lamp = true, beam = 0, aim = 0.25) {
  if (beam > 0) {
    g.save(); g.globalAlpha = beam; const gr = g.createLinearGradient(40, -640, 900, -640 + 900 * aim);
    gr.addColorStop(0, 'rgba(255,240,190,0.55)'); gr.addColorStop(1, 'rgba(255,240,190,0)'); g.fillStyle = gr;
    g.fill(polyPath([[60, -626], [900, -640 + 900 * aim - 260], [900, -640 + 900 * aim + 260]])); g.restore();
  }
  fill(smoothPath([[-70, -592], [-66, -650], [-30, -684], [30, -684], [66, -650], [70, -592]]), c);
  rrect(-88, -604, 176, 18, 9, c); limb([[-20, -682], [20, -682]], 10, 'rgba(255,255,255,0.35)', false);
  if (lamp) { rrect(36, -652, 34, 26, 8, '#3a3d44'); ell(62, -639, 10, 10, '#fff6d0'); }
}

// a miner, standing: origin at the feet, about 690 px tall at s = 1. o: x y s face t look lookY seed hat suit skin
// arm farArm (hand targets, body coords), walk ph, beam, cheer (both arms up), shades (dark glasses, after the rescue), dirt
export function drawMiner(o) {
  const s = o.s ?? 0.6, face = o.face ?? 1, ph = (o.ph ?? 0) * TAU, wk = clamp(o.walk ?? 0), sd = o.seed ?? 0;
  const skin = o.skin ?? SKINS[sd % SKINS.length], suit = o.suit ?? (sd % 3 === 2 ? '#2f4a7a' : '#e0742a'), hat = o.hat ?? HATS[sd % HATS.length];
  g.save(); g.translate(o.x, (o.y ?? 0) - wk * 8 * s * Math.abs(Math.sin(ph))); g.rotate(o.rot ?? 0); g.scale(s * face, s);
  for (const [i, sx] of [[0, -28], [1, 28]]) {
    const sw = wk * 32 * Math.sin(ph + i * Math.PI);
    limb([[sx * 0.6, -270], [sx + sw * 0.5, -140], [sx + sw, -24]], 40, suit); rect(sx + sw - 20, -110, 40, 12, '#d9e0e6');
    rrect(sx + sw - 24, -34, 60, 34, 10, '#2c241c');
  }
  const arm = (from, to) => { limb([from, [lerp(from[0], to[0], 0.5) + 12, lerp(from[1], to[1], 0.5) + 10], to], 32, suit); ell(to[0], to[1], 15, 15, skin); };
  const up = o.cheer ? clamp(o.cheer) : 0;
  arm([-58, -470], o.farArm ?? (up ? [-lerp(70, 130, up), lerp(-260, -760, up)] : [-70 - 20 * wk * Math.sin(ph), -270]));
  const body = [[-92, -262], [-98, -420], [-70, -500], [70, -500], [98, -420], [92, -262]];
  fill(smoothPath(body), suit);
  inside(smoothPath(body), () => { rect(-110, -380, 220, 16, '#d9e0e6'); rect(-36, -500, 16, 240, '#d9e0e6'); rect(20, -500, 16, 240, '#d9e0e6');
    if (o.dirt !== false) for (let i = 0; i < 9; i++) ell(-80 + 160 * hash(sd * 7 + i * 1.3), -480 + 210 * hash(sd * 3 + i * 2.1), 18, 10, 'rgba(70,50,30,0.25)'); });
  ell(0, -560, 64, 70, skin);
  ell(0, -520, 50, 34, 'rgba(60,40,30,0.25)');                                   // stubble
  if (o.dirt !== false) { ell(-34, -574, 16, 10, 'rgba(70,50,30,0.3)'); ell(30, -540, 12, 8, 'rgba(70,50,30,0.25)'); }
  if (o.shades) { rrect(-46, -580, 40, 24, 8, '#15171c'); rrect(6, -580, 40, 24, 8, '#15171c'); rect(-6, -574, 12, 5, '#15171c'); }
  else eyes(o, -568, 22);
  const sm = o.smile ?? 0.2;
  if (o.open) ell(0, -520, 12, 10 * o.open, '#5a2a2a'); else limb([[-14, -524], [0, -520 + 8 * sm], [14, -524]], 4, '#6a3a2a', false);
  hardHat(hat, o.lamp !== false, o.beam ?? 0, o.aim ?? 0.25);
  arm([58, -470], o.arm ?? (up ? [lerp(70, 130, up), lerp(-260, -760, up)] : [70 + 20 * wk * Math.sin(ph), -270]));
  g.restore();
}

// a miner sitting (on the floor or a bench): origin at the seat
export function drawMinerSit(o) {
  const s = o.s ?? 0.6, face = o.face ?? 1, sd = o.seed ?? 0;
  const skin = SKINS[sd % SKINS.length], suit = sd % 3 === 2 ? '#2f4a7a' : '#e0742a', hat = o.hat ?? HATS[sd % HATS.length];
  g.save(); g.translate(o.x, o.y); g.scale(s * face, s);
  for (const sx of [-26, 26]) { limb([[sx, 0], [sx + 120, 10], [sx + 120, 130]], 38, suit); rrect(sx + 96, 120, 60, 30, 10, '#2c241c'); }
  g.translate(0, 260);
  const body = [[-92, -262], [-98, -420], [-70, -500], [70, -500], [98, -420], [92, -262]];
  fill(smoothPath(body), suit); inside(smoothPath(body), () => rect(-110, -380, 220, 16, '#d9e0e6'));
  ell(0, -560, 64, 70, skin); ell(0, -520, 50, 34, 'rgba(60,40,30,0.25)'); eyes(o, -568, 22);
  limb([[-14, -524], [0, -520 + 8 * (o.smile ?? 0.1)], [14, -524]], 4, '#6a3a2a', false);
  hardHat(hat, true, o.beam ?? 0, o.aim ?? 0.35);
  limb([[58, -470], [110, -330], [130, -270]], 32, suit); ell(130, -266, 15, 15, skin);
  g.restore();
}

// the crowd in the refuge: rows of miners (the back row first), n of them inside the box x0 y0 w h (y0 = where the back
// row stands); lit 0…1 switches the lamp beams on one by one; cheer 0…1 lifts the arms. Returns the lamps [x, y, on].
export function crowd(x0, y0, w, h, n, t, o = {}) {
  const rows = o.rows ?? 4, per = Math.ceil(n / rows), lamps = [];
  let k = 0;
  for (let r = 0; r < rows; r++) {
    const y = y0 + r * h / Math.max(1, rows - 1), s = (o.s ?? 0.16) * (0.82 + 0.3 * r / Math.max(1, rows - 1));
    for (let i = 0; i < per && k < n; i++, k++) {
      const x = x0 + (i + 0.5 + 0.35 * (r % 2) - 0.17) * w / per + 12 * s * (hash(k * 3.1) - 0.5) * 10;
      const on = (o.lit ?? 1) * n > (k * 13) % n, fc = hash(k * 5.3) > 0.5 ? 1 : -1;
      const ch = o.cheer ? clamp(o.cheer * 1.6 - hash(k * 2.7) * 0.6) * (0.75 + 0.25 * Math.sin(t * 9 + k)) : 0;
      drawMiner({ x, y, s, seed: k, t, face: fc, look: hash(k) - 0.5, beam: on ? 0.16 * (o.beam ?? 1) : 0, cheer: ch, smile: o.cheer ? 0.9 : 0.1, open: o.cheer ? 0.6 : 0 });
      lamps.push([x + fc * 62 * s, y - 639 * s, on]);
    }
  }
  return lamps;
}

// the mountain in section, in world px (surface at y = 330, the refuge at REF): sky, the desert, the strata, the ramp
export const REF = [640, 1560], SURF = 330;
export function mountain(t, o = {}) {
  const gr = g.createLinearGradient(0, -400, 0, SURF); gr.addColorStop(0, o.night ? '#121a30' : '#7fb3e0'); gr.addColorStop(1, o.night ? '#2a2c40' : '#f2d6a8');
  g.fillStyle = gr; g.fillRect(-2000, -1200, 5000, SURF + 1200);
  const lay = ['#c49a64', '#a87c4c', '#8f6a42', '#76563a', '#5e4632', '#4a382a', '#3a2c22'];
  for (let i = 0; i < lay.length; i++) {
    const y = SURF + i * 230 - 20;
    fill(smoothPath([[-2000, y + 30 * Math.sin(i)], [0, y + 20 * Math.sin(i + 1)], [540, y - 30 + 25 * Math.sin(i * 2)], [1080, y + 20], [3000, y + 40], [3000, 4000], [-2000, 4000]]), lay[i]);
  }
  for (let i = 0; i < 90; i++) ell(-200 + 1500 * hash(i * 1.7), SURF + 80 + 2100 * hash(i * 2.9), 14 + 30 * hash(i), 8 + 14 * hash(i + 3), 'rgba(0,0,0,0.12)');
  // the desert top: dunes, the hill, the mine mouth at x = 180
  fill(smoothPath([[-2000, SURF + 10], [-200, SURF - 10], [120, SURF - 60], [300, SURF - 120], [520, SURF - 140], [760, SURF - 90], [1000, SURF - 20], [3000, SURF + 10], [3000, SURF + 60], [-2000, SURF + 60]]), '#d9b57e');
  rrect(150, SURF - 52, 70, 50, 20, '#2a2018');
  // the ramp: a zigzag down from the mouth to the refuge (the real one is ~5 km of switchbacks)
  const ramp = [[185, SURF - 20], [880, SURF + 160], [260, SURF + 350], [900, SURF + 540], [280, SURF + 730], [920, SURF + 920], [300, SURF + 1100], [REF[0], REF[1]]];
  limb(ramp, 16, o.rampColor ?? '#2a2018', false);
  // the refuge: a small lit box
  rrect(REF[0] - 46, REF[1] - 22, 92, 40, 6, o.refuge ?? '#2a2018');
  if (o.lit) { g.save(); g.globalAlpha = o.lit; ell(REF[0], REF[1] - 2, 60, 26, 'rgba(255,220,140,0.55)'); for (let i = 0; i < 9; i++) ell(REF[0] - 36 + i * 9, REF[1] - 4 + 4 * (i % 2), 2.6, 2.6, '#fff4c8'); g.restore(); }
  if (o.block) {                                  // the collapse: a red-brown plug across the ramp above them
    g.save(); g.globalAlpha = o.block; fill(smoothPath([[260, SURF + 1030], [420, SURF + 990], [560, SURF + 1060], [520, SURF + 1180], [330, SURF + 1170]]), '#8a3a2a');
    for (let i = 0; i < 7; i++) ell(300 + 40 * i, SURF + 1080 + 30 * Math.sin(i * 2), 16, 12, '#6a2a1e'); g.restore();
  }
  return ramp;
}

// the tunnel seen from inside: rock walls closing to a vanishing point, a dirt road, the lamps
export function tunnel(t, o = {}) {
  const vx = 540 + (o.vx ?? 0), vy = o.vy ?? 820;
  g.fillStyle = '#16110d'; g.fillRect(0, 0, 1080, 1920);
  for (let i = 9; i >= 0; i--) {
    const k = Math.pow(0.72, i), w = 1300 * k, h = 1500 * k, c = ['#5a4636', '#4e3c2e', '#433427', '#382c21', '#2e241b'][Math.min(4, i >> 1)];
    fill(smoothPath([[vx - w / 2, vy + h * 0.6], [vx - w * 0.52, vy - h * 0.1], [vx - w * 0.36, vy - h * 0.5], [vx, vy - h * 0.62], [vx + w * 0.36, vy - h * 0.5], [vx + w * 0.52, vy - h * 0.1], [vx + w / 2, vy + h * 0.6]]), c);
    for (let j = 0; j < 6; j++) ell(vx + w * (hash(i * 7 + j) - 0.5), vy - h * 0.4 * hash(i * 3 + j * 2), 40 * k, 24 * k, 'rgba(0,0,0,0.18)');
  }
  fill(polyPath([[vx - 40, vy + 20], [vx + 40, vy + 20], [900, 1920], [180, 1920]]), '#3a2e24');
  for (let i = 0; i < 6; i++) { const k = Math.pow(0.7, i), y = vy - 900 * k; ell(vx, y, 26 * k + 4, 14 * k + 3, `rgba(255,230,170,${0.9 - i * 0.12})`); }
}

// falling rocks and dust (the collapse); u 0…1 since it began
export function rockfall(t, u, x0 = 0, x1 = 1080) {
  if (u <= 0) return;
  for (let i = 0; i < 40; i++) {
    const d = (u * 1.6 - hash(i * 3.3) * 0.6); if (d <= 0) continue;
    const x = lerp(x0, x1, hash(i * 1.9)), y = -100 + d * d * 2600, r = 18 + 50 * hash(i * 4.1);
    if (y > 1980) continue;
    g.save(); g.translate(x, y); g.rotate(d * 6 * (hash(i) - 0.5)); fill(polyPath([[-r, -r * 0.6], [-r * 0.2, -r], [r, -r * 0.4], [r * 0.7, r * 0.7], [-r * 0.6, r * 0.8]]), i % 3 ? '#6a5442' : '#4e3c2e'); g.restore();
  }
  g.save(); g.globalAlpha = clamp(u * 1.4) * 0.8; const gr = g.createLinearGradient(0, 0, 0, 1920);
  gr.addColorStop(0, 'rgba(160,130,100,0.2)'); gr.addColorStop(0.5, 'rgba(150,120,90,0.75)'); gr.addColorStop(1, 'rgba(120,95,70,0.9)'); g.fillStyle = gr; g.fillRect(0, 0, 1080, 1920);
  for (let i = 0; i < 14; i++) ell(1080 * hash(i * 2.2) + 80 * Math.sin(t + i), 400 + 1300 * hash(i * 5.1), 260, 160, 'rgba(170,140,110,0.35)');
  g.restore();
}

// the drill rod and its hammer bit, pointing down; origin at the bit's tip. note: the paper taped on (with the words)
export function drillBit(x, y, s, o = {}) {
  g.save(); g.translate(x, y); g.scale(s, s); g.rotate(o.rot ?? 0);
  rect(-34, -1400, 68, 1300, '#7a828c'); rect(-34, -1400, 20, 1300, 'rgba(255,255,255,0.18)');
  for (let i = 0; i < 6; i++) rect(-36, -1300 + i * 220, 72, 14, '#5a6068');
  fill(smoothPath([[-70, -160], [70, -160], [80, -60], [40, 0], [-40, 0], [-80, -60]]), '#8a9098');
  for (let i = 0; i < 5; i++) ell(-48 + i * 24, -18, 9, 9, '#c9cfd8');
  if (o.paint) { rect(-36, -420, 72, 160, o.paint); }                            // the miners daubed it red too
  if (o.note) {
    g.save(); g.translate(0, -620); g.rotate(-0.06);
    rect(-150, -110, 300, 220, '#f6f1e2'); for (let i = 0; i < 6; i++) rect(-150, -100 + i * 36, 300, 2, 'rgba(80,110,180,0.25)');
    rect(-170, -20, 340, 40, 'rgba(210,200,160,0.85)');                               // the tape
    const lines = o.note; g.fillStyle = '#c0262d'; g.textAlign = 'center';
    lines.forEach((l, i) => { g.save(); g.translate(0, -60 + i * 50); g.transform(1, 0, -0.18, 1, 0, 0); g.font = `700 ${l.size ?? 34}px Oswald`; g.fillText(l.s, 0, 0); g.restore(); });
    g.restore();
  }
  g.restore();
}

// a «paloma»: the long orange tube they sent down the narrow hole; origin at its centre
export function paloma(x, y, s, rot = 0) {
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
  rrect(-34, -300, 68, 600, 30, '#ef8a2a'); rect(-34, -300, 16, 600, 'rgba(255,255,255,0.25)');
  rect(-38, -230, 76, 16, '#c9cfd8'); rect(-38, 214, 76, 16, '#c9cfd8'); ell(0, -300, 34, 14, '#3a3d44');
  g.restore();
}

// the rescue capsule: a tall white cylinder banded red and blue, a cage window, the roof cone and the cable
export function capsule(x, y, s, o = {}) {
  g.save(); g.translate(x, y); g.scale(s, s);
  if (o.cable !== false) limb([[0, -470], [0, -5000]], 6, '#3a3d44', false);
  poly([[-70, -400], [0, -470], [70, -400]], '#c9cfd8');
  rrect(-74, -400, 148, 760, 20, '#f4f4f0');
  rect(-74, -330, 148, 40, '#d52b1e'); rect(-74, -280, 148, 30, '#0039a6');
  rect(-74, 250, 148, 40, '#d52b1e'); rect(-74, 300, 148, 30, '#0039a6');
  rrect(-50, -230, 100, 440, 14, 'rgba(30,40,60,0.85)'); for (let i = 1; i < 6; i++) rect(-50, -230 + i * 73, 100, 6, '#c9cfd8');
  if (o.face) { g.save(); g.translate(0, -60); g.scale(0.42, 0.42); hardHat(o.hat ?? '#f2c94c', true); ell(0, -560, 64, 70, '#d9a77f'); g.restore(); }
  rect(-80, 340, 160, 24, '#9aa0aa');
  g.restore();
}

// the Chilean flag on a pole, waving; origin at the pole's foot
export function flagCL(x, y, s, t) {
  g.save(); g.translate(x, y); g.scale(s, s);
  rect(-5, -420, 10, 420, '#c9cfd8');
  const wv = (u, v) => [u * 260, -420 + v * 170 + 14 * Math.sin(t * 4 + u * 5)];
  const P = (pts, c) => fill(polyPath(pts.map(([u, v]) => wv(u, v))), c);
  P([[0, 0], [1, 0], [1, 0.5], [0, 0.5]], '#ffffff'); P([[0, 0.5], [1, 0.5], [1, 1], [0, 1]], '#d52b1e'); P([[0, 0], [0.34, 0], [0.34, 0.5], [0, 0.5]], '#0039a6');
  const c = wv(0.17, 0.25); g.save(); g.translate(c[0], c[1]); g.fillStyle = '#ffffff'; g.beginPath();
  for (let i = 0; i < 10; i++) { const r = i % 2 ? 9 : 22, a = -Math.PI / 2 + i * Math.PI / 5; g.lineTo(r * Math.cos(a), r * Math.sin(a)); } g.fill(); g.restore();
  g.restore();
}

// the camp on the surface: dunes, tents, flags, the drill rig; y0 = the ground line
export function camp(t, y0, o = {}) {
  const gr = g.createLinearGradient(0, y0 - 900, 0, y0); gr.addColorStop(0, o.night ? '#0f1630' : '#78aee0'); gr.addColorStop(1, o.night ? '#2c2c46' : '#f4dcae');
  g.fillStyle = gr; g.fillRect(0, y0 - 1200, 1080, 1200);
  if (o.night) for (let i = 0; i < 40; i++) ell(1080 * hash(i * 1.3), y0 - 1100 + 700 * hash(i * 2.7), 2, 2, '#ffffff', 0, 0.5 + 0.5 * Math.sin(t * 2 + i));
  fill(smoothPath([[-100, y0 - 140], [200, y0 - 230], [420, y0 - 190], [700, y0 - 260], [1000, y0 - 180], [1200, y0 - 150], [1200, y0 + 400], [-100, y0 + 400]]), o.night ? '#5a4a3a' : '#c9a066');
  rect(0, y0, 1080, 700, o.night ? '#6a5642' : '#d9b57e');
  if (o.rig !== false) {                           // the drill rig: a lattice mast, the platform
    const rx = o.rigX ?? 760;
    poly([[rx - 70, y0], [rx - 18, y0 - 520], [rx + 18, y0 - 520], [rx + 70, y0]], 'rgba(0,0,0,0)');
    for (const [a, b] of [[[rx - 70, y0], [rx - 16, y0 - 520]], [[rx + 70, y0], [rx + 16, y0 - 520]]]) limb([a, b], 12, '#d0a020', false);
    for (let i = 0; i < 8; i++) { const y = y0 - 60 - i * 60, w = lerp(66, 18, (i + 1) / 9); limb([[rx - w, y], [rx + w, y - 50]], 6, '#d0a020', false); limb([[rx + w, y], [rx - w, y - 50]], 6, '#d0a020', false); }
    rect(rx - 120, y0 - 60, 240, 60, '#5a6068'); rect(rx - 100, y0 - 100, 90, 40, '#d0a020');
  }
  for (let i = 0; i < (o.tents ?? 5); i++) { const tx = 60 + i * 120, c = ['#3a6ab8', '#c94a3b', '#2f8f4e', '#e9e4d6', '#ef8a2a'][i % 5];
    poly([[tx - 60, y0 + 30], [tx, y0 - 60], [tx + 60, y0 + 30]], c); poly([[tx - 12, y0 + 30], [tx, y0 - 20], [tx + 12, y0 + 30]], 'rgba(0,0,0,0.35)'); }
  for (let i = 0; i < (o.flags ?? 3); i++) flagCL(90 + i * 230, y0 + 60, 0.55, t + i);
}

// the food: a tuna can, a spoon, a glass of milk, half a biscuit
export function tuna(x, y, s) {
  g.save(); g.translate(x, y); g.scale(s, s);
  ell(0, 40, 130, 40, '#9aa0aa'); rect(-130, -40, 260, 80, '#c9cfd8'); ell(0, -40, 130, 40, '#e6e9ee'); ell(0, -40, 110, 30, '#c79a6a');
  rect(-130, -20, 260, 40, '#2f6fd6'); g.restore();
}
export function spoon(x, y, s, rot = 0, full = 1) {
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
  rrect(-10, 0, 20, 220, 10, '#c9cfd8'); ell(0, -50, 48, 64, '#c9cfd8'); if (full) ell(0, -54, 36, 48, '#c79a6a'); g.restore();
}
export function milk(x, y, s, level = 0.25) {
  g.save(); g.translate(x, y); g.scale(s, s);
  const glass = polyPath([[-70, -200], [70, -200], [58, 100], [-58, 100]]);
  inside(glass, () => rect(-80, 100 - 300 * level, 160, 300 * level, '#f8f6ee'));
  g.lineWidth = 8; g.strokeStyle = 'rgba(220,235,245,0.9)'; g.stroke(glass); g.restore();
}
export function biscuit(x, y, s) {
  g.save(); g.translate(x, y); g.scale(s, s);
  fill(polyPath([[-70, -50], [40, -50], [10, -10], [40, 20], [0, 50], [-70, 50]]), '#d9a75a');
  for (let i = 0; i < 6; i++) ell(-50 + 18 * (i % 3), -20 + 30 * Math.floor(i / 3), 5, 5, '#a8783a'); g.restore();
}
