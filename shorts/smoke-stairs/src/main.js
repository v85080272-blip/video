// «Дым в подъезде, ты дома» (2D «ты»-ролик, the narrator of «Свет погас» and «Облако хлора»): the whole short as pure
// functions of time t. The owner, 20.11: «Облако хлора» — «ты» at home, a technogenic danger, the question from frame 0 —
// took 1.2K in under a day; «делай и го выкладывать больше роликов». Based on «Звонок в дверь» (the hall, the door from
// inside, the landing, the hunter at home with the dog). The neighbours are on fire, the stairwell is full of smoke: not
// down the stairs (the smoke is toxic, the hot air burns the lungs) → call 101/112, the address and the floor → shut the
// front door, go to the far room → smoke coming in: a wet cloth to the face, lower to the floor → cut off: the balcony,
// the door shut behind, call for help → the secret: the back of the hand on a door — warm, don't open. Facts: script.json.
import fs from 'node:fs';
import { lerp, clamp, ease, spring, bump, hash, noise, TAU, mix, rgba } from './lib.js';
import { g, W, H, ell, limb, rect, rrect, poly, fill, smoothPath, polyPath, rrPath, inside, MONO } from './flat.js';
import { view, toScreen } from './camera.js';
import * as Hd from './hud.js';
import * as Ld from './landing.js';
import * as Sm from './smoke.js';
import { flames } from './apt.js';
import { drawHunter, framesOf } from './hunter.js';
import { drawDog } from './dog.js';
import { text, measure, FONTS, INK } from './type.js';

// —— the narration: line starts, ends and word starts (A.L2w5 = word 5 of line L2; dashes count as words) ——
const VOICE = (() => { try { return JSON.parse(fs.readFileSync(new URL('../build/words.json', import.meta.url))); } catch { return null; } })();
const SCRIPT = JSON.parse(fs.readFileSync(new URL('../voice/script.json', import.meta.url)));
const LN = id => VOICE?.lines.find(l => l.id === id);
const FB = {};
{ let t = 0.12; for (const l of SCRIPT.lines) { const n = l.text.split(/\s+/).length; t += l.after ?? 0; FB[l.id] = [t, t + n * 0.38, n]; t += n * 0.38; } }
const LAST = SCRIPT.lines[SCRIPT.lines.length - 1].id;
export const DUR = VOICE?.dur ?? FB[LAST][1] + 0.6;
const A = {};
for (const id of Object.keys(FB)) {
  const ws = LN(id)?.words, n = ws ? ws.length : FB[id][2];
  A[id] = LN(id)?.at ?? FB[id][0]; A[id + 'e'] = LN(id)?.end ?? FB[id][1];
  for (let i = 0; i < Math.max(n, FB[id][2]) + 2; i++) A[id + 'w' + i] = ws ? ws[Math.min(i, n - 1)].s : lerp(FB[id][0], FB[id][1], i / FB[id][2]);
}
const SUBS = VOICE ? VOICE.lines.flatMap(l => Hd.phrases(l.words, 6, 24, Array.isArray(l.sub) ? l.sub : null)) : [];
const DANGER = Hd.NIGHT.danger, GOLD = Hd.NIGHT.gold, OK = Hd.NIGHT.ok, WARM = Hd.NIGHT.warm;
const HOT = { ПОЖАР: DANGER, ДЫМУ: DANGER, ВНИЗ: DANGER, НЕЛЬЗЯ: DANGER, ЯДОВИТЫЙ: DANGER, ЛЁГКИЕ: DANGER, ЗВОНИ: OK, ОДИН: OK,
  ДВЕНАДЦАТЬ: OK, АДРЕС: OK, ЭТАЖ: OK, ДВЕРЬ: OK, ДАЛЬНЮЮ: OK, ТКАНЬ: OK, ПОЛУ: OK, БАЛКОН: OK, ПОМОЩЬ: OK, СЕКРЕТ: GOLD,
  ТЫЛЬНОЙ: GOLD, ЛАДОНИ: GOLD, ТЁПЛАЯ: DANGER, ОГОНЬ: DANGER, ПОДПИСЫВАЙСЯ: GOLD };

// —— the shots ——
const T = {
  cover: 0.05,
  peep: A.L0w7 - 0.06,               // «подъезд в дыму»: the fish-eye on the smoky landing
  c1: A.L1 - 0.06,                   // «бежать вниз… Нельзя»: the hall, his hand on the lock
  nope: A.L1w7,
  c2: A.L2 - 0.06,                   // step 1: the phone
  c3: A.L3 - 0.06,                   // step 2: the lock, the plan
  lock: A.L3w2,
  plan: A.L3w6 - 0.1,
  c4: A.L4 - 0.06,                   // step 3: the far room, the smoke under the ceiling, the rag, down
  rag: A.L4w5,
  low: A.L4w11,
  c5: A.L5 - 0.06,                   // cut off: the balcony from outside
  shut: A.L5w5,
  help: A.L5w10,
  c6: A.L6 - 0.06,                   // the secret: the door close, the back of the hand
  touch: A.L6w7,
  c7: A.L7 - 0.06,                   // warm — don't open
  sub: A.L7w8,
};
export const CUTS = [T.cover, T.peep, T.c1, T.c2, T.c3, T.c4, T.c5, T.c6];
export const SNAPS = [];
// the score (tools/music.py) reads the door episode's marks: ring/peep (the hook), c1/two (the landing; a stab), c2 (a short
// lift), c3…c6 (the steps), dial (three taps), growl (an ominous figure), end (the warm close)
export const MARKS = { ...T, A, ring: 0.3, two: T.nope - 0.5, c2: T.c2 - 0.3, c3: T.c2, c4: T.c3, c5: T.c4, dial: A.L2w2, c6: T.c6, growl: T.c7, end: T.sub - 0.1 };
const seg = (a, b, t, e = ease.inOut) => e(clamp((t - a) / (b - a)));
const sp = (t, t0, f = 2.4, d = 7) => (t <= t0 ? 0 : spring(t - t0, f, d));
const S = 0.6, LEG = 137, DS = 0.7;
const scene = t => (t < T.cover ? 'cover' : t < T.peep ? 'hall' : t < T.c1 ? 'peep' : t < T.c4 ? 'hall' : t < T.c5 ? 'room' : t < T.c6 ? 'out' : 'door');

// —— the camera ——
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
const SHOTS = [];
const shot = (t0, keys) => SHOTS.push({ t0, keys });
shot(T.cover, [[T.cover, -90, -330, 1.25], [T.peep, -60, -320, 1.36]]);
shot(T.peep, [[T.peep, 0, -330, 1.0], [T.c1, 0, -330, 1.05]]);
shot(T.c1, [[T.c1, -110, -320, 1.3], [T.nope, -60, -320, 1.42], [T.c2, -60, -320, 1.44]]);
shot(T.c2, [[T.c2, -200, -330, 1.45], [T.c3, -190, -330, 1.5]]);
shot(T.c3, [[T.c3, -60, -330, 1.3], [T.c4, -60, -330, 1.33]]);
shot(T.c4, [[T.c4, -20, -210, 1.45], [T.low, -20, -180, 1.52], [T.c5, -30, -160, 1.58]]);
shot(T.c5, [[T.c5, 90, -260, 1.15], [T.c6, 80, -270, 1.22]]);
shot(T.c6, [[T.c6, 0, -330, 1.75], [T.c7, 20, -330, 1.95], [DUR, 20, -330, 2.0]]);
export function camAt(t) {
  let sh = SHOTS[0];
  for (const s of SHOTS) if (t >= s.t0) sh = s;
  const [x, y, z] = hermite(sh.keys, t);
  let dx = 0, dy = 0;
  for (const [t0, a] of [[T.nope, 6], [T.lock, 4]]) if (t >= t0 && t < t0 + 0.5) { const e = Math.exp(-(t - t0) * 8); dx += a * e * noise(t * 40, 1); dy += a * e * noise(t * 37, 2); }
  return { x, y, z, lens: 1, tx: 0, ty: 0, dx, dy, r: 0 };
}

// —— the people ——
const blinkAt = t => { const u = (t + 0.4) % 3.3; return u < 0.14 ? bump(u / 0.14) : 0; };
const dblink = t => { const u = (t + 1.7) % 2.9; return u < 0.12 ? bump(u / 0.12) : 0; };
const base = (t, extra = {}) => ({ s: S, face: 1, lean: 0.04, headTilt: 0.04, brow: 0, pop: 0, lid: 0.25, blink: blinkAt(t), look: [0.5, 0], mouth: 0, jacket: false, boots: false, pack: false, hat: false, ...extra });
function stand(o, x, y = 0) { const k = (o.s ?? S) / S; o.hip = [x, y - LEG * k]; o.feet = { near: [x - 12 * k, y], far: [x + 16 * k, y] }; return o; }
const shoulder = o => framesOf(o).T.p([-14, -192]);
const dogSit = (t, x, o = {}) => ({ x, y: 0, s: DS, face: 1, sit: 1, look: 0.3, t, blink: dblink(t), ears: 1, ...o });

// the hall inside the flat: the door's inner face with the chain, a coat rack; t-dependent: chain on, door ajar on it
const HALL = { door: { x0: -140, x1: 140, top: -580 } };
function hallScene(t, o = {}) {  // + o.wisps the smoke in the gaps, o.heat the door warm
  const D = HALL.door;
  rect(-1100, -760, 2200, 760, '#e9dcc0');
  for (let y = -720; y < 0; y += 80) for (let x = -1080 + ((y / 80) % 2) * 40; x < 1100; x += 80) ell(x, y, 5, 5, '#d8c6a0');
  rect(-1100, -30, 2200, 30, '#dccba8'); rect(-1100, 0, 2200, 700, '#a9876a'); for (let i = 0; i < 28; i++) rect(-1100 + i * 80, 0, 3, 700, 'rgba(0,0,0,0.08)');
  // the coat rack with his jacket and hat
  rect(-640, -560, 260, 16, '#9d6c43'); for (let i = 0; i < 4; i++) ell(-610 + i * 70, -540, 10, 10, '#7a5434');
  fill(smoothPath([[-600, -540], [-520, -540], [-500, -300], [-620, -300]]), '#d9762b'); ell(-440, -560, 50, 34, '#a8794a');
  // the door from inside: light leatherette, the chain, the locks' thumb-turns, the peephole
  rect(D.x0 - 22, D.top - 22, D.x1 - D.x0 + 44, -D.top + 22, '#3e3a3a');
  const gap = o.gap ?? 0;
  if (gap > 0.5) { rect(D.x1 - gap, D.top, gap, -D.top, '#d9d0bc'); }
  rrect(D.x0, D.top, D.x1 - D.x0 - gap, -D.top, 6, '#c9b08a');
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) rrect(D.x0 + 26 + j * 120, D.top + 30 + i * 136, 100, 116, 10, '#bea47e');
  ell(0, -430, 12, 12, '#2c2c34'); ell(0, -430, 7, 7, o.peepLit ? '#ffe7a8' : '#4a5064');
  for (const [lx, ly] of Ld.LOCKS) { rrect(lx - gap - 14, ly - 18, 28, 36, 8, '#c9d0d6'); rect(lx - gap - 2, ly - 14, 4, 28, '#3a3f4a'); }
  // the chain: its track on the frame, the links to the door
  rect(D.x1 + 4, -470, 14, 60, '#9aa3ad');
  const on = o.chain ?? 0;
  if (on > 0.01) { const end = [lerp(D.x1 + 10, D.x1 - 40 - gap, on), -440]; const from = [D.x1 - 40 - gap, -440]; for (let i = 0; i <= 6; i++) { const u = i / 6, sag = gap > 0.5 ? 0 : 14 * bump(u); ell(lerp(from[0], end[0] + 50 * (1 - on), u), lerp(from[1], end[1], u) + sag, 7, 5, '#c9d0d6'); } }
  else limb([[D.x1 - 40, -440], [D.x1 - 30, -380], [D.x1 - 20, -330]], 5, '#c9d0d6');
}


// the smoke and the heat on our door, drawn after the hall
function hallSmoke(t, o = {}) {
  const D = HALL.door;
  if (o.heat > 0.01) {
    const fl = 0.8 + 0.2 * noise(t * 5, 9);
    g.save(); g.globalAlpha = 0.45 * o.heat * fl; rrect(D.x0, D.top, D.x1 - D.x0, -D.top, 6, '#ff7a2a'); g.restore();
    g.save(); g.lineWidth = 5; g.strokeStyle = `rgba(255,200,140,${0.5 * o.heat})`;
    for (let i = 0; i < 5; i++) { const x = D.x0 + 40 + i * 50, ph = (t * 0.8 + i * 0.2) % 1; g.beginPath(); for (let k = 0; k < 8; k++) { const y = -60 - k * 60 - ph * 60; const xx = x + 10 * Math.sin(k * 1.3 + t * 6 + i); k ? g.lineTo(xx, y) : g.moveTo(xx, y); } g.stroke(); }
    g.restore();
    Sm.fireGlow(t, D.x0, D.x1, D.top, o.heat);
  }
  Sm.doorWisps(t, D.x0, D.x1, D.top, o.wisps ?? 0);
}

export function actorsAt(t) {
  const sc = scene(t);
  if (sc === 'hall') {
    // —— the hook: he turns to the door, smoke curling in under it ——
    if (t < T.peep) {
      const o = stand(base(t, { look: [0.9, 0.1], brow: 0.7, pop: 0.4, headTilt: -0.06 }), -260);
      return { h: o, d: dogSit(t, -560, { ears: 1, look: 0.6 }), hall: { wisps: 0.6 } };
    }
    // —— «бежать вниз»: his hand to the lock; «Нельзя»: back ——
    if (t < T.c2) {
      const reach = seg(A.L1w3 - 0.4, A.L1w3, t) * (1 - seg(T.nope, T.nope + 0.35, t));
      const o = stand(base(t, { look: [0.8, -0.1], brow: 0.5, lean: 0.06 + 0.08 * reach }), lerp(-260, -190, seg(T.c1, A.L1w3, t)));
      const sh = shoulder(o);
      o.hands = { near: { p: [lerp(sh[0] + 40, Ld.LOCKS[0][0] - 10, reach), lerp(sh[1] + 80, Ld.LOCKS[0][1], reach)], shape: 'grip' } };
      if (t > T.nope) { o.brow = 0.9; o.pop = 0.6; o.lean = -0.04; o.look = [0.6, 0]; }
      return { h: o, d: dogSit(t, -560, { ears: 1, look: 0.5 }), hall: { wisps: 0.8, chain: 0 } };
    }
    // —— step 1: on the phone ——
    if (t < T.c3) {
      const o = stand(base(t, { look: [0.6, 0.3], brow: 0.4, headTilt: 0.12 }), -270);
      const sh = shoulder(o);
      o.hands = { near: { p: [sh[0] + 30, sh[1] - 60], shape: 'grip' } };
      o.prop = { kind: 'phone', p: [sh[0] + 28, sh[1] - 90] };
      if (t > A.L2w8 - 0.1) o.mouth = 0.3 + 0.2 * Math.abs(Math.sin(t * 12));
      return { h: o, d: dogSit(t, -560), hall: { wisps: 0.85 } };
    }
    // —— step 2: the locks turned; then away from the door ——
    const turn = seg(T.lock - 0.35, T.lock, t) * (1 - seg(T.lock + 0.5, T.lock + 0.8, t));
    const away = seg(T.plan - 0.2, T.plan + 0.8, t);
    const o = stand(base(t, { look: [0.8, -0.1], brow: 0.4, face: away > 0.3 ? -1 : 1 }), lerp(-190, -520, away));
    const sh = shoulder(o);
    if (turn > 0.01) o.hands = { near: { p: [lerp(sh[0] + 40, Ld.LOCKS[0][0] - 10, turn), lerp(sh[1] + 80, Ld.LOCKS[0][1] + 6 * Math.sin(t * 20), turn)], shape: 'grip' } };
    return { h: o, d: dogSit(t, lerp(-560, -760, away), { face: away > 0.3 ? -1 : 1 }), hall: { wisps: 0.9 }, locked: t > T.lock };
  }
  if (sc === 'room') {
    // —— step 3: the far room; the smoke comes down; the wet rag to his face; down, nearer the floor ——
    const up = seg(T.rag - 0.2, T.rag + 0.3, t), low = seg(T.low - 0.1, T.low + 0.6, t);
    const o = base(t, { look: [0.4, -0.6 * (1 - up)], brow: 0.5, lean: 0.05 + 0.35 * low });
    const x = -60, k = 1;
    o.hip = [x, -LEG * k + 120 * low]; o.feet = { near: [x - 40 * low - 12, 0], far: [x + 50 * low + 16, 0] };
    const F = framesOf(o), mouth = F.H.p([-60, 30]), sh = F.T.p([-14, -192]);
    const p = [lerp(sh[0] + 40, mouth[0] + 30, up), lerp(sh[1] + 60, mouth[1] + 10, up)];
    o.hands = { near: { p: [p[0] - 10, p[1] + 20], shape: 'grip' }, far: { p: [p[0] + 30, p[1] + 26], shape: 'grip' } };
    o.prop = { kind: 'rag', p }; o.mouth = 0; o.lid = 0.25 + 0.2 * up;
    return { h: o, d: { x: 330, y: 0, s: DS, face: -1, sit: 1, look: 0.2, t, blink: dblink(t), ears: 0.6, rot: 0.0 } };
  }
  if (sc === 'out') {
    // —— the balcony: he comes out, shuts the door behind, waves a towel and shouts ——
    const o = stand(base(t, { s: 0.6, face: 1, look: [0.6, -0.3], brow: 0.6 }), lerp(-60, 20, seg(T.c5, A.L5w4, t)));
    const sh = shoulder(o), wave = seg(T.help - 0.2, T.help + 0.1, t);
    if (t < T.help - 0.2) {
      const back = seg(T.shut - 0.3, T.shut + 0.2, t) * (1 - seg(T.shut + 0.4, T.shut + 0.7, t));
      o.hands = { near: { p: [lerp(sh[0] + 30, -60, back), lerp(sh[1] + 90, -300, back)], shape: 'grip' } };
      if (back > 0.3) { o.face = -1; o.look = [-0.6, 0]; }
    } else {
      const sw = Math.sin((t - T.help) * 9);
      o.hands = { near: { p: [sh[0] + 30 + 60 * sw * wave, sh[1] - 200 * wave], shape: 'grip' } };
      o.prop = { kind: 'towel', p: o.hands.near.p, sw };
      o.mouth = 0.6; o.brow = 0.9; o.look = [0.3, -0.6];
    }
    return { h: o, d: { x: 230, y: 0, s: DS * 0.9, face: -1, sit: 1, look: 0.4, t, blink: dblink(t), ears: 1 }, door: 1 - seg(T.shut - 0.1, T.shut + 0.4, t) };
  }
  return {};
}
function hunterDraw(t, o) {
  o = { ...o };
  const p = o.prop;
  if (p?.kind === 'phone') o.propNear = () => { g.save(); g.translate(p.p[0], p.p[1]); g.rotate(0.2); rrect(-16, -30, 32, 60, 7, '#24232f'); rrect(-12, -25, 24, 48, 4, '#9fd8ff'); g.restore(); };
  if (p?.kind === 'rag') o.propNear = () => {                      // a wet rag: pale cloth, darker wet patches, drips
    rrect(p.p[0] - 50, p.p[1] - 34, 100, 68, 16, '#dfe9f0'); ell(p.p[0] - 12, p.p[1] + 4, 30, 18, '#b9cdda', 0, 0.8);
    for (let i = 0; i < 3; i++) { const ph = ((t * 1.5 + i / 3) % 1); ell(p.p[0] - 30 + i * 30, p.p[1] + 40 + ph * 60, 4, 7, '#9fd0ee', 0, 1 - ph); }
  };
  if (p?.kind === 'towel') o.propNear = () => {                    // a white towel flapping from his raised hand
    const [x, y] = p.p, f = p.sw;
    fill(smoothPath([[x, y - 10], [x + 70 + 40 * f, y - 60 - 20 * f], [x + 150 + 60 * f, y - 30 + 30 * f], [x + 120 + 40 * f, y + 60], [x + 40, y + 40]]), '#f7f7f2');
    limb([[x + 20, y + 5], [x + 110 + 40 * f, y - 20 + 20 * f]], 4, '#d8d8d0');
  };
  return drawHunter(o);
}

// —— frame ——
export function init() { Hd.initHud(); }
export function frame(t) {
  const sc = scene(t);
  if (sc === 'cover') { coverFrame(t); Hd.finish(t); return; }
  const cam = camAt(t);
  if (sc === 'peep') peepFrame(t);
  else if (sc === 'room') roomFrame(t, cam);
  else if (sc === 'out') outFrame(t, cam);
  else hallFrame(t, cam);
  overlays(t, cam);
  Hd.karaoke(t, SUBS, HOT);
  Hd.finish(t, 1);
}
function hallFrame(t, cam) {
  const a = actorsAt(t), sc = scene(t);
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#20232e'; g.fillRect(0, 0, W, H);
  view(cam, 1);
  hallScene(t, a.hall ?? {});
  const heat = sc === 'door' ? seg(T.c7 - 0.1, T.c7 + 0.6, t) : 0;
  hallSmoke(t, { wisps: sc === 'door' ? 0.9 : (a.hall?.wisps ?? 0.6), heat });
  if (a.d) drawDog(a.d);
  if (a.h) hunterDraw(t, a.h);
  if (sc === 'door') { g.setTransform(1, 0, 0, 1, 0, 0); Sm.backOfHand(560, 860, seg(T.touch - 0.5, T.touch, t) * (1 - seg(A.L7w3, A.L7w3 + 0.4, t, ease.in)), 1.1); }
}
function roomFrame(t, cam) {
  const a = actorsAt(t);
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#20232e'; g.fillRect(0, 0, W, H);
  view(cam, 1);
  const smoke = seg(A.L4w1 - 0.2, A.L4w4 + 0.4, t, x => x);
  Sm.farRoom(t, { wisps: 0.8, smoke: 0.25 + 0.5 * smoke });
  if (a.d) drawDog(a.d);
  if (a.h) hunterDraw(t, a.h);
}
function outFrame(t, cam) {
  const a = actorsAt(t);
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#26355a'; g.fillRect(0, 0, W, H);
  view(cam, 1);
  Sm.facade(t, { door: a.door, smokeIn: 0.8 });
  if (a.d) drawDog(a.d);
  if (a.h) hunterDraw(t, a.h);
  Sm.railing();
}
// the view through the peephole: the landing full of smoke, the glow of fire under the neighbour's door
function peepFrame(t) {
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#05060a'; g.fillRect(0, 0, W, H);
  const cx = 540, cy = 1000, r = 450;
  g.save(); g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.clip();
  const cam = { x: 360, y: -330, z: 0.95, lens: 1, tx: 0, ty: cy - 960, dx: 0, dy: 0, r: 0 };
  view(cam, 1);
  Ld.drawLanding(t, { dark: true });
  const N = Ld.NDOOR;
  Sm.fireGlow(t, N.x0, N.x1, N.top, 1);
  flames((N.x0 + N.x1) / 2, 0, N.x1 - N.x0 - 40, 80, t, 0.9);
  Sm.doorWisps(t, N.x0, N.x1, N.top, 1);
  Sm.haze(t, -1100, 1100, -760, 140, 0.75 + 0.25 * seg(T.peep, T.c1, t));
  g.setTransform(1, 0, 0, 1, 0, 0);
  const gr = g.createRadialGradient(cx, cy, r * 0.55, cx, cy, r); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.85)');
  g.fillStyle = gr; g.fillRect(cx - r, cy - r, 2 * r, 2 * r);
  g.restore();
  g.lineWidth = 18; g.strokeStyle = '#1c1e26'; g.beginPath(); g.arc(cx, cy, r + 6, 0, TAU); g.stroke();
}

// —— everything over the picture ——
function overlays(t, cam) {
  const S2 = p => toScreen(cam, p);
  const scr = () => g.setTransform(1, 0, 0, 1, 0, 0);
  scr();
  if (t < A.L1 + 0.1) questionTitle(t);
  // «бежать вниз… Нельзя»
  Hd.ribbon(t, A.L1w3 - 0.05, T.nope - 0.1, 'ВНИЗ ПО ЛЕСТНИЦЕ?', { y: 1560, size: 76 });
  if (t >= T.c1 && t < T.c2) { const b = S2([Ld.LOCKS[0][0], Ld.LOCKS[0][1]]); Hd.redX(b[0], b[1], 110, sp(t, T.nope + 0.02, 2.6, 8) * (1 - seg(T.c2 - 0.25, T.c2, t))); }
  Hd.plaque(t, A.L1w8 - 0.05, T.c2 - 0.1, 540, 560, { icon: 'x', title: 'ДЫМ ЯДОВИТ', sub: 'горячий воздух обжигает лёгкие', color: DANGER, size: 50 });
  // step 1
  Hd.stepHeader(t, 1, 'ЗВОНИ 101 ИЛИ 112', A.L2 + 0.02, A.L2e - 0.05);
  if (t >= T.c2 && t < T.c3) dialCard(t, 760, 700);
  Hd.plaque(t, A.L2w8 - 0.05, T.c3 - 0.1, 540, 1040, { icon: 'house', title: 'АДРЕС И ЭТАЖ', color: OK, size: 48 });
  // step 2
  Hd.stepHeader(t, 2, 'ЗАКРОЙ ДВЕРЬ', A.L3 + 0.02, A.L3e - 0.05);
  if (t >= T.c3 && t < T.c4) {
    const kp = clamp(sp(t, T.plan, 2.4, 8)) * (1 - seg(T.c4 - 0.25, T.c4 - 0.02, t));
    Sm.planCard(t, 540, 720, kp, seg(T.plan + 0.2, A.L3w9 + 0.2, t, x => x), seg(A.L3w9 + 0.1, A.L3w9 + 0.6, t));
  }
  // step 3
  Hd.stepHeader(t, 3, 'МОКРАЯ ТКАНЬ', A.L4 + 0.02, A.L4e - 0.05);
  Hd.plaque(t, T.low - 0.05, T.c5 - 0.1, 540, 560, { icon: 'check', title: 'У ПОЛА ДЫМА МЕНЬШЕ', color: OK, size: 46 });
  // cut off: the balcony
  Hd.plaque(t, A.L5w2 - 0.05, T.shut - 0.15, 540, 330, { icon: 'check', title: 'НА БАЛКОН', color: OK, size: 50 });
  Hd.plaque(t, T.shut - 0.05, T.help - 0.15, 540, 330, { icon: 'check', title: 'ДВЕРЬ ЗА СОБОЙ — ЗАКРОЙ', color: OK, size: 46 });
  Hd.plaque(t, T.help - 0.05, T.c6 - 0.1, 540, 330, { icon: 'check', title: 'ЗОВИ НА ПОМОЩЬ', color: OK, size: 50 });
  if (t >= T.c5 && t < T.c6) { const h = actorsAt(t).h; if (h) { const p = S2([h.hip[0] - 120, h.hip[1] - 330]); speech(t, T.help + 0.05, T.c6 - 0.1, p[0], p[1], '«ПОМОГИТЕ! МЫ ЗДЕСЬ!»'); } }
  // the secret
  Hd.plaque(t, A.L6 + 0.02, T.c7 - 0.1, 540, 300, { icon: 'check', title: 'СЕКРЕТ', color: GOLD, size: 54 });
  Hd.plaque(t, A.L6w9 - 0.05, T.c7 - 0.1, 540, 1500, { icon: 'check', title: 'ТЫЛЬНОЙ СТОРОНОЙ ЛАДОНИ', color: GOLD, size: 44 });
  Hd.plaque(t, A.L7 - 0.02, DUR + 1, 540, 1500, { icon: 'flame', title: 'ТЁПЛАЯ — ЗА НЕЙ ОГОНЬ', color: DANGER, size: 46 });
  if (t >= T.c7) { const b = S2([Ld.HANDLE[0], Ld.HANDLE[1]]); Hd.redX(b[0], b[1], 120, sp(t, A.L7w3, 2.6, 8)); }
  Hd.endCard(t, T.sub - 0.05, 0, 330);
}
// the hook: «ЧТО ДЕЛАТЬ,» from the first frame, then the question word by word
function questionTitle(t) {
  const k1 = sp(t, 0.02, 2.6, 7), k2 = sp(t, A.L0w2 - 0.05, 2.4, 7), k3 = sp(t, A.L0w7 - 0.05, 2.4, 7);
  const out = seg(A.L1 - 0.15, A.L1 + 0.1, t);
  if (k1 > 0.01) { g.save(); g.setTransform(1, 0, 0, 1, 540, 300); g.scale(k1 * (1 - out), k1 * (1 - out)); g.rotate(-0.03); text('ЧТО ДЕЛАТЬ,', 0, 0, 120, '#fff3d6'); g.restore(); }
  const plq = (y, str, k, size, c = '#ffd23f') => {
    if (k <= 0.01) return;
    const w = measure(str, size, FONTS.cond) + 70, h = size * 1.45;
    g.save(); g.setTransform(1, 0, 0, 1, 540, y); g.rotate(-0.03); g.scale(k * (1 - out), k * (1 - out));
    rect(-w / 2 + 10, -h / 2 + 12, w, h, INK); rect(-w / 2, -h / 2, w, h, c);
    text(str, 0, size * 0.36, size, INK, { fam: FONTS.cond, shadow: false });
    g.restore();
  };
  plq(440, 'ЕСЛИ У СОСЕДЕЙ ПОЖАР', k2, 74, '#ff8a3d');
  plq(560, 'И ПОДЪЕЗД В ДЫМУ?', k3, 80, '#ffd23f');
}
function speech(t, t0, t1, x, y, str) {
  if (t < t0 || t > t1 + 0.2) return;
  const k = clamp(sp(t, t0, 2.6, 8)) * (1 - clamp((t - t1) / 0.2));
  if (k <= 0.01) return;
  const size = 40, w = measure(str, size, FONTS.cond) + 60, h = 90;
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(clamp(x, w / 2 + 20, W - w / 2 - 20), y); g.scale(k, k); g.globalAlpha = clamp(k * 2);
  g.save(); g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 20; g.shadowOffsetY = 6; rrect(-w / 2, -h / 2, w, h, 24, '#fff8e6'); poly([[-w / 2 + 50, h / 2 - 2], [-w / 2 + 90, h / 2 - 2], [-w / 2 + 30, h / 2 + 34]], '#fff8e6'); g.restore();
  text(str, 0, 14, size, INK, { fam: FONTS.cond, shadow: false });
  g.restore();
}
function dialCard(t, cx, cy) {
  const k = clamp(sp(t, A.L2w2 - 0.1, 2.4, 8)) * (1 - seg(T.c3 - 0.25, T.c3 - 0.02, t));
  if (k <= 0.01) return;
  const w = 360, h = 560;
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(cx, cy); g.scale(lerp(0.9, 1, k), lerp(0.9, 1, k)); g.globalAlpha = clamp(k * 2);
  g.save(); g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 40; g.shadowOffsetY = 14; rrect(-w / 2, -h / 2, w, h, 46, '#1b1e29'); g.restore();
  rrect(-w / 2 + 16, -h / 2 + 16, w - 32, h - 32, 34, '#16233a');
  const num = t < A.L2w5 - 0.05 ? '101' : '112', t0 = t < A.L2w5 - 0.05 ? A.L2w2 : A.L2w5, n = Math.min(3, Math.floor((t - t0) / 0.15) + 1);
  Hd.label(num.slice(0, Math.max(1, n)), 0, -120, 96, '#ffffff', { shadow: false, stroke: false });
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) ell(-90 + c * 90, -10 + r * 80, 30, 30, 'rgba(255,255,255,0.12)');
  ell(0, 220, 40, 40, '#2f8f4e');
  g.restore();
}

// —— the cover: the fish-eye on the smoky landing; the question and the ban ——
function fitText(str, x, y, size, maxW, color, o = {}) { const w = measure(str, size, o.fam); text(str, x, y, size * Math.min(1, maxW / w), color, o); }
function coverFrame(t) {
  peepFrame(T.peep + 1.2);
  g.setTransform(1, 0, 0, 1, 0, 0);
  const grd = g.createLinearGradient(0, 0, 0, 640); grd.addColorStop(0, 'rgba(0,0,0,0.75)'); grd.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = grd; g.fillRect(0, 0, W, 640);
  g.save(); g.translate(540, 200); g.rotate(-0.03); rect(-170 + 6, -34 + 7, 340, 68, INK); rect(-170, -34, 340, 68, '#ff4d4d'); g.restore();
  text('КАК ВЫЖИТЬ', 540, 218, 50, '#fff3d6', { fam: FONTS.cond, shadow: false, rot: -0.03 });
  fitText('ДЫМ В ПОДЪЕЗДЕ?', 540, 380, 130, 980, '#ffd23f', { rot: -0.03 });
  fitText('НЕ ВЫХОДИ!', 540, 530, 130, 960, '#ff5a4a', { rot: -0.03 });
}

// how far things move on screen around t (for the number of motion-blur sub-frames)
export function motion(t, h = 1 / 240) {
  if (t < T.cover) return 0;
  let t0 = t - h, t1 = t + h;
  for (const c of [...CUTS, ...SNAPS]) { if (t >= c && t0 < c) { t0 = c; t1 = c + 2 * h; } else if (t < c && t1 >= c) { t1 = c - 1e-6; t0 = t1 - 2 * h; } }
  const pts = tt => {
    const cam = camAt(tt), { h: o, d } = actorsAt(tt), out = [];
    if (o) out.push(...[o.hip, [o.hip[0], o.hip[1] - 200 * S], o.hands?.near?.p].filter(Boolean).map(p => toScreen(cam, p)));
    if (d) out.push(toScreen(cam, [d.x, d.y - 150 * DS]));
    out.push(toScreen(cam, [cam.x, cam.y - 400]), toScreen(cam, [cam.x + 300, cam.y + 400]));
    return out;
  };
  const a = pts(t0), b = pts(t1), on = ([x, y]) => x > -200 && x < W + 200 && y > -200 && y < H + 200;
  let m = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (on(a[i]) || on(b[i])) m = Math.max(m, Math.hypot(a[i][0] - b[i][0], a[i][1] - b[i][1]));
  return Math.min(m * (0.5 / (2 * h * 60)), 40);
}

// sound cues for the mix (seconds, name, level dB, pan −1…1); the mixer holds each under the narrator
export function cues() {
  const c = [];
  const add = (t, name, db = 0, pan = 0, extra = {}) => c.push({ t, name, db, pan, ...extra });
  add(0.05, 'amb_flat', -22, 0, { dur: T.c5 - 0.1 });
  add(0.1, 'fire', -26, -0.3, { dur: T.c4 });
  add(T.peep, 'whoosh_in', -14, 0);
  add(T.c1, 'whoosh', -12, 0);
  add(A.L1w3 - 0.05, 'ribbon', -8, 0);
  add(T.nope, 'stamp', -8, 0);
  add(T.c2, 'whoosh', -12, 0);
  for (let i = 0; i < 3; i++) add(A.L2w2 + i * 0.15, 'click', -10, 0.1);
  for (let i = 0; i < 3; i++) add(A.L2w5 + i * 0.15, 'click', -10, 0.1);
  add(T.c3, 'whoosh', -12, 0);
  add(T.lock, 'click', -6, 0.2); add(T.lock + 0.25, 'click', -8, 0.2);
  add(T.plan, 'paper', -10, 0, { dur: 0.4 });
  add(A.L3w9 + 0.3, 'blip', -10, 0);
  add(T.c4, 'whoosh_in', -14, 0);
  add(T.rag, 'pour', -16, 0, { dur: 0.5 });
  add(T.c5, 'whoosh', -12, 0);
  add(T.c5, 'city', -20, 0, { dur: T.c6 - T.c5 });
  add(T.c5, 'fire', -18, 0.5, { dur: T.c6 - T.c5 });
  add(T.shut + 0.2, 'click', -6, -0.1);
  add(T.c6, 'whoosh_in', -14, 0);
  add(T.c6, 'fire', -22, 0, { dur: DUR - T.c6 });
  add(T.c7, 'fire_whoosh', -14, 0);
  add(A.L7w3, 'stamp', -8, 0);
  for (const t0 of [A.L2, A.L3, A.L4]) add(t0 + 0.04, 'pop_word', -8, 0);
  add(A.L6 + 0.04, 'pop_word', -6, 0);
  add(T.sub, 'pop_word', -6, 0);
  return c.sort((a, b) => a.t - b.t);
}
