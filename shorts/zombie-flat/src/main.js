// «Правило №6»: the whole short as pure functions of time t (seconds), so any frame or motion-blur sub-frame can be drawn
// in any order. 120 BPM, a beat is 0.5 s: footsteps, licks, letters, the hit and the cut sit on beats (STORYBOARD.md).
import { createCanvas } from '@napi-rs/canvas';
import { lerp, clamp, ease, spring, bump, hash, noise, TAU } from './lib.js';
import { g, setCtx, W, H, MONO, ell, limb, fill, polyPath, frame as frameOf } from './flat.js';
import { view, toScreen } from './camera.js';
import * as S from './set.js';
import { drawCat } from './cat.js';
import { drawZombie, drawArm } from './zombie.js';
import { text, stamp, bubble, measure, FONTS } from './type.js';

export const DUR = 22.5;
const HALF = S.HALF_Y, FL = S.FLOOR, CAT_X = 450, CAT_S = 0.8;
const seg = (a, b, t, e = ease.inOut) => e(clamp((t - a) / (b - a)));
const sp = (t, t0, f = 2.4, d = 7) => (t <= t0 ? 0 : spring(t - t0, f, d));

// —— the zombie's feet: each plant lands on a beat; the foot swings in during the time before it ——
const PL = { near: [{ t: -9, p: [2085, HALF] }], far: [{ t: -9, p: [2035, HALF] }] };
const ORDER = [];
function plant(t, foot, p, swing = 0.4, lift = 44) { PL[foot].push({ t, p, swing, lift }); ORDER.push({ t, foot, p }); }
// shuffling along the half-landing past the moon window
[[0.5, 'near', 1965], [1.0, 'far', 1875], [1.5, 'near', 1785], [2.0, 'far', 1695], [2.5, 'near', 1605]].forEach(([t, f, x]) => plant(t, f, [x, HALF]));
// a beat's pause at the window to sniff the air, then up flight 1, a tread a beat, onto the landing next to the cat
for (let k = 7, i = 0; k >= 1; k--, i++) plant(3.5 + 0.5 * i, i % 2 ? 'near' : 'far', S.tread(k));
plant(7.0, 'near', [735, FL]); plant(7.5, 'far', [665, FL]);
// the recoil: two quick steps back to the top of the stairs
plant(11.1, 'near', S.tread(1), 0.1, 30); plant(11.2, 'far', [762, FL], 0.1, 24);
// the run down: a tread every 0.11 s, along the half-landing past the lost arm, down flight 2 and away
const RUN = [];
{
  let t = 13.0, foot = 'far';
  const spots = [2, 3, 4, 5, 6, 7].map(k => S.tread(k));
  spots.push([1550, HALF], [1670, HALF], [1785, HALF], [1900, HALF], [2020, HALF], [2140, HALF]);
  for (let k = 9; k < 16; k++) spots.push(S.tread(k));
  spots.push([3010, S.LOW_Y], [3120, S.LOW_Y], [3230, S.LOW_Y]);
  for (const p of spots) { plant(t, foot, p, 0.1, 26); RUN.push(t); t += 0.115; foot = foot === 'far' ? 'near' : 'far'; }
}
ORDER.sort((a, b) => a.t - b.t);

function footAt(foot, t) {
  const L = PL[foot];
  let i = 0; while (i + 1 < L.length && L[i + 1].t <= t) i++;
  const cur = L[i], nx = L[i + 1];
  if (!nx || t < nx.t - nx.swing) return cur.p;
  const u = clamp((t - (nx.t - nx.swing)) / nx.swing), e = ease.inOut(u);
  const lift = nx.lift + Math.max(0, cur.p[1] - nx.p[1]) * 0.7;
  return [lerp(cur.p[0], nx.p[0], e), lerp(cur.p[1], nx.p[1], e) - lift * Math.sin(Math.PI * u)];
}
const faceAt = t => (t < 12.86 ? -1 : 1);
// where the hip settles after each plant: over the feet, the lower foot's height minus the leg
const STANCE = (() => {
  const st = [], last = { near: PL.near[0].p, far: PL.far[0].p };
  const mk = t => { const fx = faceAt(t); return [(last.near[0] + last.far[0]) / 2 + 14 * fx, Math.max(last.near[1], last.far[1]) - 250]; };
  st.push({ t: -9, h: mk(-9) });
  for (const o of ORDER) { last[o.foot] = o.p; st.push({ t: o.t, h: mk(o.t) }); }
  return st;
})();
function hipAt(t) {
  let i = 0; while (i + 1 < STANCE.length && STANCE[i + 1].t <= t) i++;
  const a = STANCE[i], b = STANCE[i + 1];
  let h = a.h;
  if (b) { const d = Math.min(0.42, b.t - a.t), u = seg(b.t - d, b.t, t); h = [lerp(a.h[0], b.h[0], u), lerp(a.h[1], b.h[1], u)]; }
  const dip = 10 * bump((t - a.t) / 0.24);
  return [h[0], h[1] + dip];
}

// —— the lost arm: pops off at 11.15, bounces down flight 1, rests on the half-landing, gets picked up on the run ——
const ARM_T = 11.15, GRAB_T = 13.95;
const HOPS = [[11.6, [1030, FL + 3 * S.SH - 15], 250], [11.9, [1330, FL + 6 * S.SH - 15], 95], [12.18, [1640, HALF - 15], 70]];
let ARM0 = null;                                    // shoulder position and angle at the moment it pops (filled in init)
function armAt(t) {
  if (t < ARM_T || !ARM0) return null;
  const spin = a => 17 * (1 - Math.exp(-(a) * 1.4)) / 1.4;
  let prev = [ARM0.p, ARM_T];
  for (const [tt, p, peak] of HOPS) {
    if (t < tt) {
      const u = (t - prev[1]) / (tt - prev[1]);
      return { p: [lerp(prev[0][0], p[0], u), lerp(prev[0][1], p[1], u) - peak * 4 * u * (1 - u)], a: ARM0.a + spin(t - ARM_T), rest: 0 };
    }
    prev = [p, tt];
  }
  const aLand = ARM0.a + spin(12.18 - ARM_T), aRest = Math.round((aLand - 0.15) / Math.PI) * Math.PI + 0.15;
  const u = seg(12.18, 12.5, t, ease.out);
  return { p: [lerp(1640, 1725, u), HALF - 15 + 3 * bump(u)], a: lerp(aLand, aRest, u), rest: u };
}
function drawLostArm(F, rest = 0) { drawArm(F, { aU: 0, aF: lerp(-0.25, 0.04, rest), aH: lerp(-0.8, 0.25, rest), sleeve: 0.45, cut: true }); }

// —— the zombie's acting ——
export function zombieAt(t) {
  const face = faceAt(t), feet = { near: footAt('near', t), far: footAt('far', t) };
  let [hx, hy] = hipAt(t);
  const walk = Math.sin(TAU * (t - 0.25));
  let lean = 0.28 + 0.035 * walk, tilt = 0.1 + 0.04 * walk, jaw = 0.12, pop = 0, hair = 0, lid = 0.4, look = [-0.9, 0.2], drool = 0;
  let raiseN = 0.06 + 0.07 * Math.sin(TAU * t), raiseF = 0.14 + 0.07 * Math.sin(TAU * t + 1.3), claw = 0;
  jaw += 0.4 * bump((t - 1.1) / 0.7) + 0.35 * bump((t - 5.1) / 0.6) + 0.45 * bump((t - 7.5) / 0.7);
  if (t >= 2.5 && t < 3.6) {                                  // stops at the window and sniffs towards the landing
    const k = seg(2.55, 2.85, t) * (1 - seg(3.25, 3.55, t));
    lean = lerp(lean, 0.12, k); tilt = lerp(tilt, -0.32, k) + 0.04 * Math.sin(TAU * t * 6) * k;
    jaw = Math.max(jaw, 0.55 * bump((t - 2.7) / 0.6)); look = [-0.7, lerp(0.2, -0.7, k)];
    raiseN -= 0.1 * k; raiseF -= 0.1 * k;
  }
  if (t >= 7.5 && t < 11) {                                   // looms over the cat
    const k = seg(7.5, 8.4, t), still = t >= 10 ? 0 : 1;
    lean = 0.28 + 0.16 * k + 0.02 * Math.sin(TAU * t * 0.5) * still;
    hx -= 18 * k; hy += 10 * k;
    tilt = lerp(0.12, 0.3, seg(7.6, 8.3, t)) + 0.06 * seg(10.45, 10.7, t);
    raiseN = lerp(raiseN, 0.3, seg(7.8, 8.4, t)) + 0.03 * Math.sin(TAU * t * 0.7) * still;
    raiseF = lerp(raiseF, 0.4, seg(7.9, 8.5, t)) + 0.03 * Math.sin(TAU * t * 0.7 + 1) * still;
    claw = seg(7.9, 8.5, t);
    jaw = Math.max(jaw, lerp(0.12, 0.85, seg(8.3, 8.65, t, ease.outBack)));
    look = [lerp(-0.9, -0.5, seg(7.6, 8.1, t)), lerp(0.2, 0.85, seg(7.6, 8.1, t))];
    drool = t < 9.25 ? seg(8.7, 9.25, t, ease.inQuad) : 0.25 + 0.2 * Math.exp(-(t - 9.25) * 5) * Math.cos((t - 9.25) * 30);
  }
  if (t >= 11) {                                               // the cat puffs up: he recoils and loses an arm
    const k = sp(t, 11, 2.2, 6);
    lean = lerp(0.44, -0.3, k); tilt = lerp(0.36, -0.32, k); jaw = lerp(0.85, 1.15, sp(t, 11, 3, 6)); pop = sp(t, 11, 3, 6); hair = sp(t, 11, 2.6, 5);
    lid = 0; look = [0, 0]; raiseF = lerp(0.4, 1.55, k); raiseN = lerp(0.3, 1.7, k); claw = 1 - k;
    hy -= 34 * bump((t - 11) / 0.2);
    if (t > 11.5) {
      const tr = noise(t * 11, 4);
      lean = -0.2 + 0.05 * tr; tilt = -0.2 + 0.05 * noise(t * 9, 8); jaw = lerp(1.0, 0.7, seg(11.5, 12.0, t)) + 0.08 * noise(t * 13, 2);
      pop = 0.85 + 0.15 * Math.max(0, noise(t * 7, 3)); raiseF = 1.4 + 0.12 * tr; hx += 3 * noise(t * 31, 6); hy += 2 * noise(t * 29, 9);
      // a double take at the torn shoulder, then at the cat
      look = t < 12.0 ? [0, 0.1] : t < 12.4 ? [0.75, 0.75] : [-0.8, 0.2];
      if (t > 12.0 && t < 12.45) tilt = -0.2 + 0.22 * seg(12.0, 12.15, t) * (1 - seg(12.3, 12.45, t));
      pop = t > 12.4 ? 1.1 : pop;
    }
    if (t >= 12.55 && t < 12.86) { const u = seg(12.55, 12.86, t); lean = lerp(lean, 0.1, u); hy += 14 * u; }
  }
  if (t >= 12.86) {                                            // runs
    const r = TAU * (t - 12.86) * 4.35;
    lean = 0.5 + 0.05 * Math.sin(r * 2); tilt = -0.05 + 0.05 * Math.sin(r * 2); jaw = 0.95 + 0.12 * Math.sin(r * 1.5); pop = 0.9; hair = 1; lid = 0;
    look = [-0.9, 0]; raiseF = 1.5 + 0.45 * Math.sin(r); raiseN = 0;
    lean += 0.42 * bump((t - (GRAB_T - 0.12)) / 0.24);       // scoops up the arm without stopping
  }
  const arm = (raise, ph, shade) => {
    const aU = Math.PI + lean + raise;
    return { aU, aF: aU - 0.15 + 0.5 * claw * (shade ? 0.8 : 1) - (t > 11 ? 0.3 : 0), aH: aU - 0.75 + 1.05 * claw + (t > 11 && t < 12.86 ? 0.6 : 0) };
  };
  return {
    hip: [hx, hy], feet, face, lean, headTilt: tilt, jaw, pop, hairUp: hair, lid, look, drool,
    arms: { near: arm(raiseN, 0, false), far: arm(raiseF, 1.3, true) }, armOff: t >= ARM_T,
    carry: t >= GRAB_T ? fa => {
      const sw = Math.sin(TAU * (t - GRAB_T) * 4.35);
      drawLostArm(frameOf(fa.hand[0], fa.hand[1], -Math.PI / 2 + (face === 1 ? -0.9 : 0.9) + 0.35 * sw, 1, 1), 0.2);
    } : null,
  };
}

// —— Батон ——
function catAt(t) {
  const o = { x: CAT_X, y: FL, s: CAT_S, face: 1, t, turn: 0.55, look: [0.3, 0], pupil: 1, tilt: 0, squash: 1 + 0.012 * Math.sin(TAU * t / 1.7) };
  const twitch = tt => 0.35 * bump((t - tt) / 0.22);
  o.swish = 0.22; o.swishPh = t * 0.45;
  if (t < 10) {                                                // licks a paw, one lick a beat, deaf to the stairs
    const k = 1 - seg(9.55, 9.85, t);
    o.lick = k; o.lickPh = (t - 0.25) / 0.5; o.blink = k > 0.5 ? 1 : seg(9.7, 9.85, t) > 0.5 ? 0 : 1;
    o.tongue = k * Math.max(0, Math.sin(TAU * o.lickPh) - 0.2) / 0.8;
    o.ears = twitch(4.0) + twitch(6.0) + twitch(9.5);
    if (t > 9.7) { o.blink = 1 - seg(9.7, 9.9, t); o.look = [0.6, 0.1]; }
  } else if (t < 11) {                                         // silence: looks up slowly, tail thumps once, pupils narrow
    const up = seg(10.1, 10.6, t);
    o.tilt = -0.42 * up; o.look = [lerp(0.6, 0.55, up), lerp(0.1, -0.95, up)]; o.turn = lerp(0.55, 0.68, up);
    o.thump = bump((t - 10.36) / 0.28) * (t < 10.5 ? 1 : 1);
    o.swish = 0;
    o.pupil = lerp(1, 0.08, seg(10.62, 10.78, t));
    o.ears = 0.6 * seg(10.8, 11, t); o.squash = lerp(1, 0.86, seg(10.8, 11, t, ease.inQuad));
  } else if (t < 16) {                                         // PUFF
    const k = sp(t, 11, 2.6, 7), f = clamp((t - 11) / 0.07);
    o.pose = k; o.fur = f; o.mouth = 'hiss'; o.hiss = lerp(0, 1, sp(t, 11, 3, 8)) * lerp(1, 0.65, seg(11.9, 12.4, t)) + 0.05 * noise(t * 20, 1);
    o.ears = 1; o.pupil = 0.05; o.turn = 0.85; o.tilt = lerp(-0.42, -0.05, sp(t, 11, 2.5, 7)); o.look = [0.7, -0.4];
    o.squash = lerp(0.86, 1, sp(t, 11, 3, 6)); o.swish = 0;
    o.x = CAT_X + 2.5 * noise(t * 37, 3); o.y = FL;
  } else {                                                     // S7–S8: deflates, licks smugly, fixes a letter, looks at us
    const de = seg(16.0, 16.45, t, ease.inOut);
    o.pose = 1 - de; o.fur = 1 - seg(16.0, 16.35, t); o.mouth = de < 0.6 ? 'hiss' : 'w'; o.hiss = 0.6 * (1 - de) * 1.6;
    o.ears = 1 - de; o.pupil = lerp(0.05, 1, seg(16.2, 16.5, t)); o.turn = lerp(0.85, 0.55, de);
    const lk = seg(16.8, 17.05, t) * (1 - seg(18.25, 18.4, t)) + seg(22.05, 22.5, t);
    o.lick = lk; o.lickPh = (t - 0.25) / 0.5; o.tongue = lk * Math.max(0, Math.sin(TAU * o.lickPh) - 0.2) / 0.8;
    o.blink = lk > 0.5 ? 1 : 0;
    if (t > 18.25 && t < 19.5) {                               // the А falls by its tail: a glance, a flick, smug
      o.turn = lerp(0.55, 0.2, seg(18.25, 18.4, t)); o.look = [-0.9, lerp(0.2, -0.8, seg(18.75, 19.0, t))];
      o.thump = 0; o.swish = 1.3 * bump((t - 18.55) / 0.3); o.swishPh = (t - 18.55) / 0.3 * 0.9;
      if (t > 19.0) { o.blink = 0.45; o.mouth = 'smile'; o.turn = lerp(0.2, 0.45, seg(19.0, 19.3, t)); o.look = [0.2, 0]; }
    }
    if (t >= 19.5) {                                           // looks into the camera, a slow blink, a smile
      const tc = seg(19.55, 20.1, t);
      o.turn = lerp(0.45, 0, tc) + 0.55 * seg(22.0, 22.4, t); o.look = [0, 0.05]; o.tilt = 0.06 * tc - 0.06 * seg(22.0, 22.4, t);
      o.blink = seg(20.5, 20.85, t) * (1 - seg(21.0, 21.35, t)) + 0.2 * tc * (1 - seg(20.5, 20.6, t));
      o.mouth = t > 21.3 && t < 22.1 ? 'smile' : 'w';
      if (t > 22.05) o.blink = lk > 0.5 ? 1 : o.blink;
    }
  }
  return o;
}

// —— camera: smooth keys (non-uniform Catmull-Rom), a spring at the hit, a cut on the door slam ——
function hermite(keys, t) {
  if (t <= keys[0][0]) return keys[0].slice(1);
  const n = keys.length;
  if (t >= keys[n - 1][0]) return keys[n - 1].slice(1);
  let i = 0; while (keys[i + 1][0] < t) i++;
  const k0 = keys[i], k1 = keys[i + 1], h = k1[0] - k0[0], u = (t - k0[0]) / h;
  const tan = j => {
    if (j === 0 || j === n - 1) return keys[j].slice(1).map(() => 0);
    const a = keys[j - 1], b = keys[j + 1];
    return a.slice(1).map((v, c) => (b[c + 1] - v) / (b[0] - a[0]));
  };
  const m0 = tan(i), m1 = tan(i + 1), u2 = u * u, u3 = u2 * u;
  return k0.slice(1).map((p0, c) => (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * h * m0[c] + (-2 * u3 + 3 * u2) * k1[c + 1] + (u3 - u2) * h * m1[c]);
}
let CAM_A = null;
export function camAt(t) {
  let x, y, z, r = 0, dx = 0, dy = 0;
  if (t < 11) [x, y, z] = hermite(CAM_A, t);
  else if (t < 16) {
    const from = hermite(CAM_A, 11), k = sp(t, 11, 1.5, 5.5);
    const to = hermite([[11, 530, 990, 0.95], [12.6, 555, 1000, 1.0], [13.1, 525, 1012, 1.0], [13.55, 1290, 1585, 0.9], [14.05, 1660, 1730, 0.9], [14.7, 1900, 1790, 0.9], [16, 1925, 1775, 0.92]], t);
    const w = clamp((t - 11) / 0.6);
    [x, y, z] = to.map((v, i) => lerp(lerp(from[i], v, k), v, ease.inOut(w)));
    const e = Math.exp(-(t - 11) * 5.5);
    dx = 26 * e * noise(t * 45, 1); dy = 20 * e * noise(t * 41, 2); r = -0.035 * e * Math.sin((t - 11) * 30);
    r += -0.03 * bump((t - 13.1) / 0.6);
  } else {
    [x, y, z] = hermite([[16, 280, 1006, 1.32], [19.5, 292, 1012, 1.35], [20.15, 455, 1084, 1.55], [22.0, 456, 1078, 1.58], [22.5, 450, 1000, 1.25]], t);
    const e1 = Math.exp(-(t - 16) * 9), e2 = t > 16.5 ? Math.exp(-(t - 16.5) * 10) : 0;
    dy = 14 * e1 * Math.sin((t - 16) * 50) + 16 * e2 * Math.sin((t - 16.5) * 46);
  }
  return { x, y, z, r, dx, dy };
}

// —— shadows on the wall: each character again in one colour, scaled up and leaning left from its feet ——
function zombieShadow(t, zb) {
  const climb = seg(3.5, 7.5, t, x => x);
  let ky = lerp(2.2, 1.55, climb), sh = lerp(0.8, 0.5, climb);
  if (t >= 7.5) { ky = lerp(1.55, 1.65, seg(7.5, 8.5, t)); sh = 0.5; }
  if (t >= 11) { const k = sp(t, 11, 2, 6); ky = lerp(1.65, 1.15, k); sh = lerp(0.5, 0.35, k); }
  if (t >= 12.86) { ky = 1.35; sh = 0.75; }
  const a = [(zb.feet.near[0] + zb.feet.far[0]) / 2, Math.max(zb.feet.near[1], zb.feet.far[1])];
  return { a, kx: 1.4, ky, sh };
}
function catShadow(t) {
  let k = 0;
  if (t >= 11 && t < 16) k = sp(t, 11, 1.8, 5);
  else if (t >= 16) k = 1 - seg(16.0, 16.45, t);
  return { a: [CAT_X, FL], kx: lerp(1.12, 1.6, k), ky: lerp(1.35, 3.0, k), sh: lerp(0.42, 0.16, k) };
}

// —— lettering timings ——
const CAP = [['БАТОН', 0.0], ['СТЕРЕЖЁТ', 0.25], ['ДВЕРЬ', 0.5]];
const ZAVEDI = 'ЗАВЕДИ', KOTA = 'КОТА';
const LETTER_T = [17.0, 17.125, 17.25, 17.375, 17.5, 17.625, 17.875, 18.0, 18.125, 18.25];
const T_STAMP = 16.5, T_A_FALL = 18.35, T_A_FLOOR = 18.5, T_A_KICK = 18.75, T_A_SNAP = 19.0;
export const MARKS = { T_STAMP, LETTER_T, T_A_FLOOR, T_A_KICK, T_A_SNAP, ARM_T, GRAB_T, RUN };

// the S1 caption on the wall over the door: pops in word by word, shivers under the shadow, then runs away
function caption(t) {
  if (t > 2.6) return;
  const flee = w => (t > 1.9 + 0.06 * w ? -1500 * Math.pow(t - 1.9 - 0.06 * w, 2) * 2.2 : 0);
  const shiver = 7 * seg(1.25, 1.85, t);
  const j = (i, ax) => shiver * noise(t * 34 + i * 7.3, ax);
  const pop = t0 => (t0 === 0 ? lerp(0.7, 1, sp(t, 0, 2.6, 7)) : sp(t, t0, 2.6, 7));
  const k0 = pop(0);
  text('БАТОН', 470 + flee(0) + j(0, 1), 560 + j(0, 2), 128 * k0, '#ff8a3d', { rot: -0.04 + 0.02 * noise(t * 30, 5) * shiver / 7 });
  const w1 = measure('СТЕРЕЖЁТ', 70, FONTS.cond), w2 = measure('ДВЕРЬ', 70, FONTS.cond), gap = 24, x0 = 470 - (w1 + gap + w2) / 2;
  for (const [w, cx, i] of [['СТЕРЕЖЁТ', x0 + w1 / 2, 1], ['ДВЕРЬ', x0 + w1 + gap + w2 / 2, 2]]) {
    const k = pop(CAP[i][1]);
    if (k > 0.01) text(w, cx + flee(i) + j(i, 3), 655 + j(i, 4), 70 * k, '#fff3d6', { fam: FONTS.cond });
  }
}
// S7: the stamp, then ЗАВЕДИ and КОТА letter by letter, the А misses, falls, the tail sends it back
const LETTER_X = (() => { const xs = []; for (let i = 0; i < 6; i++) xs.push(-28 + i * 86); for (let i = 0; i < 4; i++) xs.push(-12 + i * 110); return xs; })();
function rule(t) {
  if (t < 16.3 || t > 20.3) return;
  // in the last shot everything flies up and away to make room for the question
  const away = i => { const u = clamp((t - 19.55 - 0.05 * i) / 0.38); return [-1400 * u * u, 1 - u * u]; };
  const sk = sp(t, T_STAMP, 2.2, 8), [sy0, sa0] = away(0), a = clamp((t - T_STAMP) / 0.05) * sa0;
  if (t >= T_STAMP) stamp('ПРАВИЛО №6', 228, 590 + sy0, 78, { k: lerp(2.2, 1, sk), rot: -0.05, a });
  for (let i = 0; i < 10; i++) {
    const t0 = LETTER_T[i];
    if (t < t0 - 0.12) continue;
    const isA = i === 9, big = i >= 6, ch = big ? KOTA[i - 6] : ZAVEDI[i];
    const x = big ? LETTER_X[i] + 6 : LETTER_X[i] + 40, y = big ? 985 : 790, size = big ? 150 : 112;
    let px = x, py = y, rot = 0;
    const fall = clamp((t - (t0 - 0.12)) / 0.12);
    py = lerp(y - 170, y, fall * fall) + (t > t0 ? -18 * Math.exp(-(t - t0) * 9) * Math.sin((t - t0) * 30) : 0);
    if (isA && t >= t0) {                                       // lands crooked, tips over, drops to the floor by the cat
      rot = 0.38 * seg(t0, t0 + 0.06, t, ease.outBack);
      if (t >= T_A_FALL) {
        const u = clamp((t - T_A_FALL) / (T_A_FLOOR - T_A_FALL));
        px = lerp(x, 318, u); py = lerp(y, FL - 4, u * u); rot = lerp(0.38, 1.25, u);
      }
      if (t >= T_A_FLOOR) { px = 318; py = FL - 4 - 10 * bump((t - T_A_FLOOR) / 0.12); rot = 1.25 + 0.06 * bump((t - T_A_FLOOR) / 0.12); }
      if (t >= T_A_KICK) {                                      // flicked by the tail back into its place
        const u = clamp((t - T_A_KICK) / (T_A_SNAP - T_A_KICK));
        px = lerp(318, x, ease.out(u)); py = lerp(FL - 4, y, u) - 260 * 4 * u * (1 - u); rot = lerp(1.25, -TAU, ease.out(u));
      }
      if (t >= T_A_SNAP) { px = x; py = y; rot = 0.12 * Math.exp(-(t - T_A_SNAP) * 8) * Math.sin((t - T_A_SNAP) * 40); }
    }
    const [ay, aa] = away(big ? 2 : 1);
    text(ch, px, py + ay, size, big ? '#ff8a3d' : '#fff3d6', { rot, a: Math.min(1, fall * 1.6) * aa, sy: t > t0 && t < t0 + 0.15 ? 1 - 0.18 * bump((t - t0) / 0.15) : 1 });
  }
}
// screen-space lettering of the last shot: the question, a comment bubble, the series name
function question(t) {
  if (t < 19.9) return;
  const out = 1 - seg(22.05, 22.35, t);
  const k1 = sp(t, 20.0, 2.4, 7), k2 = sp(t, 20.25, 2.4, 7);
  g.setTransform(1, 0, 0, 1, 0, 0);
  text('А ТВОЙ КОТ', 510, 400, 104 * k1, '#fff3d6', { fam: FONTS.cond, a: out });
  text('БЫ СПРАВИЛСЯ?', 510, 520, 104 * k2, '#ff8a3d', { fam: FONTS.cond, a: out });
  const kb = sp(t, 20.75, 2.6, 6) * (1 + 0.12 * bump((t - 21.25) / 0.2) + 0.12 * bump((t - 21.75) / 0.2));
  bubble(510, 650, 46, { k: kb, a: out, dots: t * 1.5 });
  const kl = sp(t, 20.5, 2.4, 8);
  if (kl > 0.01) {
    const hw = measure('ЗОМБИ В ПАНЕЛЬКЕ', 38, FONTS.cond) / 2 + 22;
    g.save(); g.globalAlpha = out; g.translate(510, 268); g.scale(kl, kl);
    fill(polyPath([[-hw, -26], [hw, -26], [hw, 26], [-hw, 26]]), '#ff4d4d');
    g.restore();
    text('ЗОМБИ В ПАНЕЛЬКЕ', 510, 282, 38 * kl, '#fff3d6', { fam: FONTS.cond, a: out, shadow: false });
  }
}
// «Ш-Ш-Ш!» bursting from the cat's mouth
function hissWord(t, mouth) {
  if (t < 11 || t > 12.6 || !mouth) return;
  const k = sp(t, 11, 2.8, 6) * (1 - seg(12.2, 12.55, t, ease.inQuad));
  const jx = 5 * noise(t * 40, 1), jy = 5 * noise(t * 43, 2);
  text('Ш-Ш-Ш!', CAT_X + 40 + jx, FL - 520 + jy, 104 * k, '#ff4d4d', { rot: -0.12 });
}
// the hit: flat white arcs around the cat
function shock(t, c) {
  const u = (t - 11) / 0.38;
  if (u <= 0 || u >= 1) return;
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI * (0.08 + 0.84 * i / 8), r0 = 210 + 160 * ease.out(u), r1 = r0 + 70 * (1 - u);
    const p0 = [c[0] + Math.cos(a) * r0, c[1] + Math.sin(a) * r0 * 0.9], p1 = [c[0] + Math.cos(a) * r1, c[1] + Math.sin(a) * r1 * 0.9];
    limb([p0, p1], 13 * (1 - u), i % 2 ? '#fff3d6' : '#ff4d4d', false);
  }
}
// a drop of drool falls and splashes by the cat
function droolDrop(t) {
  if (t < 9.25 || t > 9.9 || !DROP0) return;
  if (t < 9.5) {
    const u = (t - 9.25) / 0.25;
    const y = lerp(DROP0[1] + 70 * 0.8, FL - 8, u * u);
    ell(DROP0[0], y, 8, 11, '#c9f0d8');
  } else {
    const u = (t - 9.5) / 0.4;
    for (const s of [-1, 1]) ell(DROP0[0] + s * 30 * ease.out(u), FL - 8 - 30 * Math.sin(Math.PI * Math.min(1, u * 1.4)), 6 * (1 - u), 6 * (1 - u), '#c9f0d8');
    ell(DROP0[0], FL - 3, 22 * ease.out(u), 5, '#c9f0d8', 0, 1 - u);
  }
}
function dust(t, t0, x, y, n = 5, w = 70) {
  const u = (t - t0) / 0.45;
  if (u <= 0 || u >= 1) return;
  for (let i = 0; i < n; i++) {
    const s = i / (n - 1) - 0.5, r = 14 + 22 * ease.out(u) * (0.6 + hash(i * 3.1) * 0.6);
    ell(x + s * w * (0.6 + 1.4 * ease.out(u)), y - 12 - 30 * ease.out(u) * (0.5 + hash(i * 1.7)), r, r, '#4b519a', 0, 0.8 * (1 - u));
  }
}

// the lamp over the stairs flickers when the cat hisses
const lampAt = t => (t > 11 && t < 11.24 && Math.floor((t - 11) * 25) % 2 === 0 ? 0 : 1);

// —— frame ——
let main = null, shadowCtx = null, shadowCv = null, scratch = null, DROP0 = null;
export function init(ctx) {
  main = ctx;
  shadowCv = createCanvas(W, H); shadowCtx = shadowCv.getContext('2d');
  scratch = createCanvas(W, H).getContext('2d');
  // camera keys of the first half: the reveal follows the zombie's hip up the flight with a short lag
  const f = tt => { const [hx, hy] = hipAt(tt); return [hx - 110, hy - 70]; };
  CAM_A = [[0, 450, 1000, 1.25], [1.9, 525, 1065, 1.2], [2.55, 1330, 1545, 0.95], [3.4, 1335, 1520, 1.0]];
  for (const tt of [4.4, 5.4, 6.4]) { const [x, y] = f(tt - 0.25); CAM_A.push([tt, x, y, lerp(1.0, 1.04, (tt - 3.4) / 3)]); }
  CAM_A.push([7.6, 600, 1110, 1.06], [10.0, 545, 1150, 1.3], [10.95, 482, 1205, 1.72], [11, 482, 1205, 1.72]);
  // anchors needed before they are drawn: where the arm pops off and where the drool drop falls from
  setCtx(scratch);
  const z1 = zombieAt(ARM_T - 1e-3), a1 = drawZombie({ ...z1, armOff: false });
  ARM0 = { p: a1.nearShoulder, a: Math.atan2(a1.nearHand[1] - a1.nearShoulder[1], a1.nearHand[0] - a1.nearShoulder[0]) };
  DROP0 = drawZombie(zombieAt(9.25)).mouth;
  setCtx(main);
}

export function frame(t) {
  const cam = camAt(t), zb = zombieAt(t), ct = catAt(t);
  view(cam);
  S.drawWall();
  g.save(); g.clip(S.windowPath()); view(cam, S.FAR); S.drawFar(); g.restore();
  view(cam);
  S.drawWindowFrame(); S.drawDoor(); S.drawDetails(t, lampAt(t));
  caption(t); rule(t);

  // shadows: silhouettes into their own layer, laid over the wall at one strength
  setCtx(shadowCtx); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
  MONO.on = true;
  const zs = zombieShadow(t, zb), cs = catShadow(t);
  for (const [s, draw] of [[zs, () => { drawZombie(zb); const la = armAt(t); if (la && t < GRAB_T) drawLostArm(frameOf(la.p[0], la.p[1], la.a, 1), la.rest); }], [cs, () => drawCat(ct)]]) {
    view(cam); g.translate(s.a[0], s.a[1]); g.transform(s.kx, 0, s.sh * s.ky, s.ky, 0, 0); g.translate(-s.a[0], -s.a[1]);
    draw();
  }
  MONO.on = false;
  setCtx(main);
  g.save(); view(cam); g.clip(S.wallClip()); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 0.42; g.drawImage(shadowCv, 0, 0); g.restore();

  view(cam);
  S.drawRailing(); S.drawFloors();
  droolDrop(t);
  const za = drawZombie(zb);
  const la = armAt(t);
  if (la && t < GRAB_T) drawLostArm(frameOf(la.p[0], la.p[1], la.a, 1), la.rest);
  for (const [tt, x, y] of [[11.6, 1030, FL + 3 * S.SH], [11.9, 1330, FL + 6 * S.SH], [12.18, 1640, HALF], [T_A_FLOOR, 318, FL]]) dust(t, tt, x, y);
  const ca = drawCat(ct);
  shock(t, [CAT_X - 10, FL - 170]);
  hissWord(t, ca.mouth);
  view(cam, S.NEAR); S.drawNear();
  question(t);
  // the hit flashes the frame once
  const fl = t >= 11 ? 0.3 * Math.exp(-(t - 11) * 22) : 0;
  if (fl > 0.01) { g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = fl; g.fillStyle = '#fff3d6'; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
  return { cam, za, ca };
}

// how far things move on screen around t (for the number of motion-blur sub-frames)
export function motion(t, h = 1 / 240) {
  const pts = tt => {
    const cam = camAt(tt), zb = zombieAt(tt), la = armAt(tt);
    const w = [zb.hip, [zb.hip[0] - 120 * (zb.face === 1 ? -1 : 1), zb.hip[1] - 300], zb.feet.near, zb.feet.far, [CAT_X, FL - 200], [CAT_X - 160, FL - 420 * clamp(catAt(tt).pose ?? 0)]];
    if (la) w.push(la.p);
    const out = w.map(p => toScreen(cam, p));
    out.push(toScreen(cam, [cam.x, cam.y - 700]), toScreen(cam, [cam.x + 400, cam.y + 700]));
    return out;
  };
  const a = pts(t - h), b = pts(t + h);
  let m = 0;
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.hypot(a[i][0] - b[i][0], a[i][1] - b[i][1]));
  if (t > 1.85 && t < 2.6) m = Math.max(m, 1500 * 2.2 * 2 * (t - 1.9) * 2 * h * 1.25);    // the caption running away
  return m;
}

// sound cues for the mix (seconds, name, level dB, pan -1…1)
export function cues() {
  const c = [];
  const add = (t, name, db = 0, pan = 0, extra = {}) => c.push({ t, name, db, pan, ...extra });
  for (const o of ORDER) {
    if (o.t < 0) continue;
    const run = o.t >= 12.9, near = o.t >= 6.9 && o.t < 11.5;
    add(o.t, run ? 'step_run' : 'step', run ? -7 : near ? -3 : lerp(-14, -5, clamp(o.t / 6)), run ? clamp((o.p[0] - 1200) / 1500, -0.8, 0.8) : clamp((o.p[0] - 900) / 1500, -0.6, 0.7));
  }
  add(1.1, 'groan', -12, 0.6); add(2.7, 'sniff', -10, 0.4); add(5.1, 'groan', -9, 0.3); add(7.5, 'groan', -6, 0.2); add(8.3, 'groan_big', -4, 0.15);
  add(0.0, 'pop_word', -12, 0); add(0.25, 'pop_word', -13, -0.1); add(0.5, 'pop_word', -13, 0.15);
  add(1.95, 'whoosh_short', -10, -0.4);
  add(9.5, 'drip', -6, -0.05);
  add(10.5, 'tail_thump', -4, -0.15);
  add(11.0, 'hiss', 0, -0.1);
  add(ARM_T, 'pop', -4, 0.2);
  for (const [tt] of HOPS) add(tt, 'clack', -8, 0.45);
  add(13.1, 'whoosh', -6, 0.3);
  add(GRAB_T, 'grab', -8, 0.4);
  add(16.0, 'slam', -3, 0.3);
  add(16.0, 'deflate', -9, 0);
  add(T_STAMP, 'stamp', -4, 0);
  LETTER_T.forEach((tt, i) => add(tt, 'tok', -9, (i % 5 - 2) * 0.1, { pitch: i }));
  add(T_A_FLOOR, 'thud_small', -8, -0.2); add(T_A_KICK - 0.15, 'swish', -10, -0.1); add(T_A_SNAP, 'ding', -9, 0);
  add(19.55, 'whoosh_short', -11, 0.2); add(19.6, 'purr', -12, 0, { dur: 2.8 });
  add(20.6, 'blink', -14, 0); add(20.75, 'pop_ui', -11, 0);
  return c.sort((a, b) => a.t - b.t);
}
