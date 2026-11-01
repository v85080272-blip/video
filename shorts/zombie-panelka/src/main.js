// «Зомби в панельке», серия 1: the shot list on the narration's word times, camera moves, shakes, flashes and
// the overlays (subtitles, countdown, step slams, end card). init(timing, valyaEnv) once, then frame(t) draws
// one 1080×1920 frame into the shared context; cues() lists the sound effects on the same anchors.
import { createCanvas } from '@napi-rs/canvas';
import { g, W, H, setLight, vignette, glow, softShadow, solid, ellPath, rrPath, line, px, vgrad } from './draw.js';
import { TAU, clamp, lerp, inv, ease, spring, bump, keys, noise, hash, rgba } from './lib.js';
import { drawHero } from './hero.js';
import { drawCat } from './cat.js';
import { exterior, winRect, OUR } from './sets/exterior.js';
import { livingRoom, hall, cabinet, kitchen, pot, bathroom, waterStream, bottle, darken, lightSwitch, wallpaper } from './sets/interior.js';
import { phone, lockCloseup, latchCloseup, sleeveHand, parquet, bagTop, item, BAG, cutaway, CUT, route, peephole, endCard as doorGap } from './sets/special.js';
import { subtitles, groupWords, title, slam, hud, endCard, SUB } from './text.js';

let T, ENV, A, SHOTS, SUBS, VSUBS, SHAKES, PUNCHES, BEEPS, tNow = 0;

// —— anchors ——
const norm = s => s.toLowerCase().replace(/ё/g, 'е').replace(/[^а-яa-z0-9-]/g, '');
function word(id, txt, n = 0) {
  const ws = id === 'valya' ? T.valya.words : T.lines[id].words;
  let k = 0;
  for (const w of ws) if (norm(w.w) === norm(txt)) { if (k === n) return w; k++; }
  throw new Error(`no word «${txt}» #${n} in ${id}`);
}
const S = id => T.lines[id].start, E = id => T.lines[id].start + T.lines[id].dur;

export function init(timing, env) {
  T = timing; ENV = env;
  const ws = (id, w, n) => word(id, w, n).s, we = (id, w, n) => word(id, w, n).e;
  A = {
    title: S('L1'), floors: ws('L2', 'на'), nine: ws('L2', 'девятом'), catJump: ws('L3', 'с'), meow: we('L3', 'котом') + 0.02,
    alert: S('L4') - 0.12, ten: ws('L4', 'десять'), house: ws('L4', 'во'), off: ws('L4', 'погаснет'), svet: ws('L4', 'свет'),
    timer: ws('L5', 'время'), go: ws('L5', 'пошло'),
    s1: S('L6'), s1w: ws('L6', 'дверь'),
    key1: ws('L7', 'ключ') + 0.05, latch: ws('L7', 'задвижку') + 0.32, push0: ws('L7', 'придвинь'), thud: we('L7', 'шкаф') - 0.04,
    s2: S('L8'), s2w: ws('L8', 'стань'),
    curt: ws('L9', 'задёрни') + 0.12, click: ws('L9', 'выключи') + 0.36, silent: ws('L9', 'беззвучный') + 0.12,
    potPush: E('L9') + 0.3, clang: S('L10') - 0.95, innocent: we('L10', 'котом') + 0.05,
    s3: S('L11'), s3w: ws('L11', 'вода'),
    pots: ws('L12', 'кастрюли'), bottles: ws('L12', 'бутылки'), dip: ws('L12', 'без'), pumps: ws('L12', 'встанут'), dry: ws('L12', 'и'),
    s4: S('L13'), s4w: ws('L13', 'тревожный'),
    torch: ws('L14', 'фонарик'), aid: ws('L14', 'аптечка'), power: ws('L14', 'пауэрбанк'), food: ws('L14', 'еда'), three: ws('L14', 'три'),
    catIn: we('L15', 'кот') + 0.05,     // after the word: the whoosh and the thump buried a hushed «И кот»
    s5: S('L16'), s5w: ws('L16', 'путь'),
    lift: ws('L17', 'лифт'), trap: ws('L17', 'ловушка'), below: ws('L17', 'внизу'), they: ws('L17', 'зомби'),
    exit: ws('L18', 'твой'), roof: ws('L18', 'крыше'), next: ws('L18', 'соседний'), exitEnd: we('L18', 'подъезд'),
    gasnet: ws('L19', 'гаснет'), torchOn: ws('L19', 'ты') - 0.04, uspel: ws('L19', 'успел'),
    i: S('L20'), scratch: ws('L20', 'скребётся'),
    vStart: T.valya.start, vBaba: ws('valya', 'баба'), vEnd: T.valya.words[T.valya.words.length - 1].e,
    black: T.black, ask: S('L21'),
  };
  A.black1 = A.gasnet - 0.36;                          // the power dies just before «гаснет»
  A.zero = A.black1 - 0.27;                            // 00:00
  BEEPS = [A.zero - 2.7, A.zero - 1.8, A.zero - 0.9, A.zero];
  A.clockStart = A.go + 0.36;
  A.reveal = A.vEnd + 0.05;
  A.hiss = A.reveal + 1.05;
  A.peepEnd = A.hiss + 0.62;
  A.fright = E('L20') - 0.3;
  A.approach = E('L20') + 0.42;
  A.scratches = [A.i + 0.42, A.i + 0.78, A.scratch - 0.1, A.scratch + 0.25, A.scratch + 0.62, A.scratch + 1.25, A.scratch + 1.6,
    A.scratch + 2.3, A.scratch + 2.65, A.scratch + 3.4, A.scratch + 3.7];
  A.figure = we('valya', 'Валя') + 0.1;                // the bulb flickers and someone stands on the stairs (after her name, so the sting doesn't hide it)
  A.vLull = we('valya', 'Внучок') + 0.08;              // the music box starts after her first word

  SHOTS = [
    [0, shTitle], [S('L2') - 0.1, shFloors], [S('L3') - 0.08, shCat], [S('L4') - 0.07, shPhone], [A.house, shPower],
    [S('L5') - 0.05, shTimer], [S('L6') - 0.04, shSlam1], [S('L7') - 0.04, shLock], [ws('L7', 'на', 1) - 0.05, shLatch],
    [ws('L7', 'придвинь') - 0.05, shPush], [S('L8') - 0.04, shSlam2], [S('L9') - 0.05, shCurtains],
    [ws('L9', 'выключи') - 0.1, shSwitch], [ws('L9', 'телефон') - 0.1, shSilent], [E('L9') + 0.12, shPot],
    [S('L10') - 0.06, shInnocent], [S('L11') - 0.04, shSlam3], [S('L12') - 0.05, shBath], [S('L13') - 0.04, shSlam4],
    [S('L14') - 0.05, shBag], [S('L16') - 0.04, shSlam5], [S('L17') - 0.04, shCut], [A.exitEnd + 0.1, shCountdown],
    [A.black1, shDark], [S('L20') - 0.04, shDoorBeam], [A.scratch - 0.04, shGap], [A.fright, shFright],
    [A.approach, shApproach], [A.vStart - 0.05, shPeep], [A.reveal, shStain], [A.hiss, shCatHiss], [A.peepEnd, shPeepEnd],
    [A.black, shEnd], [T.total + 1, null],
  ];

  // subtitles: every narration line except the title, the step slams and the closing question
  SUBS = [];
  for (const [id, l] of Object.entries(T.lines)) if (!['L1', 'L6', 'L8', 'L11', 'L13', 'L16', 'L21'].includes(id)) SUBS.push(...groupWords(l.words));
  VSUBS = [[0], [1], [2, 3], [4, 5], [6, 7], [8, 9]].map(ix => ix.map(i => T.valya.words[i]));

  // camera kicks: [time, pixels, seconds] and zoom punches: [time, amount]
  SHAKES = [[A.title, 22, 0.55], [A.s1, 20, 0.4], [A.s2, 20, 0.4], [A.s3, 20, 0.4], [A.s4, 20, 0.4], [A.s5, 20, 0.4],
    [A.thud, 18, 0.4], [A.clang, 30, 0.55], [A.trap, 10, 0.3], [A.they, 16, 0.6], [A.black1, 10, 0.35],
    [A.scratch, 7, 0.35], [A.figure, 12, 0.3], [A.hiss, 14, 0.35], [A.ask, 6, 0.3]];
  PUNCHES = [[A.title, 0.07], [A.nine, 0.05], [A.meow, 0.03], [A.ten, 0.05], [A.off, 0.04], [A.timer, 0.04], [A.go, 0.05],
    [A.s1w, 0.05], [A.key1, 0.03], [A.key1 + 0.26, 0.03], [A.latch, 0.04], [A.s2w, 0.05], [A.curt, 0.03], [A.click, 0.04],
    [A.silent, 0.04], [A.s3w, 0.05], [A.pots, 0.03], [A.bottles, 0.03], [A.s4w, 0.05], [A.torch + 0.28, 0.03],
    [A.aid + 0.28, 0.03], [A.power + 0.28, 0.03], [A.food + 0.28, 0.03], [A.three + 0.4, 0.04], [A.catIn + 0.08, 0.05],
    [A.s5w, 0.05], [A.lift, 0.03], [A.trap, 0.05], [A.roof, 0.03], [A.next, 0.03], ...BEEPS.map(b => [b, 0.03]),
    [A.torchOn, 0.04], [A.ask, 0.05]];
}

export function duration() { return T.total; }

// —— camera ——
function kick(t) {
  let x = 0, y = 0, r = 0;
  for (const [t0, a, d] of SHAKES) {
    const k = (t - t0) / d;
    if (k < 0 || k > 1) continue;
    const e = a * (1 - k) * (1 - k);
    x += noise(t * 38, t0 * 3) * e; y += noise(t * 41, t0 * 7 + 1) * e; r += noise(t * 23, t0 * 5 + 2) * e * 0.0016;
  }
  let p = 0;
  for (const [t0, a] of PUNCHES) if (t >= t0 && t < t0 + 0.6) p += a * Math.exp(-(t - t0) * 9) * (1 - (t - t0) / 0.6);
  return [x, y, r, p];
}
function cam(cx, cy, z, rot = 0) {
  const [x, y, r, p] = kick(tNow);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.translate(W / 2 + x, H / 2 + y); g.rotate(rot + r); g.scale(z * (1 + p), z * (1 + p)); g.translate(-cx, -cy);
}
const here = (x, y) => { const m = g.getTransform(); return [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]; };
const zoomNow = () => { const m = g.getTransform(); return Math.hypot(m.a, m.b); };

// —— helpers ——
function flash(t, t0, d, color = '#ffffff', a = 0.6) {
  const k = (t - t0) / d;
  if (k < 0 || k > 1) return;
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = a * (1 - k); g.fillStyle = color; g.fillRect(0, 0, W, H); g.restore();
}
const blinkAt = (t, times, d = 0.17) => times.reduce((m, ti) => Math.max(m, bump((t - ti) / d)), 0);
function pop(t, t0, x, y, fn, freq = 2.4) {
  const k = spring(t - t0, freq, 6.5);
  if (t < t0 || k <= 0.01) return;
  g.save(); g.translate(x, y); g.scale(k, k); fn(); g.restore();
}
function dust(t, t0, x, y, n = 9, spread = 260) {
  const age = t - t0;
  if (age < 0 || age > 1.2) return;
  for (let i = 0; i < n; i++) {
    const a = (i / (n - 1) - 0.5) * Math.PI * 0.9, sp = 0.6 + hash(i * 3.3) * 0.6;
    const dx = Math.sin(a) * spread * sp * ease.out(clamp(age * 1.6)), dy = -Math.abs(Math.cos(a)) * 60 * ease.out(clamp(age * 2)) - age * 40;
    const r = 40 + age * 90 * sp;
    g.save(); g.globalAlpha = 0.45 * (1 - age / 1.2);
    const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
    gr.addColorStop(0, 'rgba(210,200,185,.9)'); gr.addColorStop(1, 'rgba(210,200,185,0)');
    g.fillStyle = gr; g.fillRect(x + dx - r, y + dy - r, r * 2, r * 2); g.restore();
  }
}
// a dark layer over the frame with soft holes of light (screen coordinates)
const fxCanvas = createCanvas(W, H), fx = fxCanvas.getContext('2d');
function darkness(color, a, holes = []) {
  fx.setTransform(1, 0, 0, 1, 0, 0); fx.globalCompositeOperation = 'source-over'; fx.clearRect(0, 0, W, H);
  fx.fillStyle = rgba(color, a); fx.fillRect(0, 0, W, H);
  fx.globalCompositeOperation = 'destination-out';
  for (const h of holes) {            // absolute coordinates: Skia drops parts of a destination-out fill under translate()
    const sx = h.sx ?? 1, sy = h.sy ?? 1;
    fx.setTransform(sx, 0, 0, sy, h.x * (1 - sx), h.y * (1 - sy));
    const gr = fx.createRadialGradient(h.x, h.y, h.r * (h.core ?? 0.35), h.x, h.y, h.r);
    gr.addColorStop(0, `rgba(0,0,0,${h.a ?? 1})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    fx.fillStyle = gr; fx.fillRect(h.x - h.r, h.y - h.r, h.r * 2, h.r * 2);
  }
  fx.setTransform(1, 0, 0, 1, 0, 0);
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(fxCanvas, 0, 0); g.restore();
}
function screenGlow(x, y, r, color, a) { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); glow(x, y, r, color, a); g.restore(); }

// the story clock: 10:00 runs down fast, the last three seconds tick in real time with beeps
function clock(t) {
  if (t < A.clockStart) return 600;
  const tb = BEEPS[0];
  if (t < tb) return Math.floor(lerp(600, 3, (t - A.clockStart) / (tb - A.clockStart)));
  return Math.max(0, Math.ceil(3 - (t - tb) / 0.9 - 1e-6));
}
function powerAt(t) {
  for (const [a, b] of [[A.off, A.off + 0.14], [A.off + 0.22, A.off + 0.27], [A.svet, A.svet + 0.18], [A.svet + 0.24, A.svet + 0.28]]) if (t >= a && t < b) return 0;
  return 1;
}

// Батон's head peeking out of the backpack over the hero's shoulder (drawn in the hero's local space)
let CAT_EYES = null;
function catOnBack(o = {}) {
  return () => {
    const x = 128, y = -412, s = o.s ?? 0.44;
    drawCat({ x, y, s, view: 'head', ears: o.ears ?? 0, puff: o.puff ?? 0, mouth: o.mouth ?? 'w', pupil: o.pupil ?? 1,
      lookX: o.lookX ?? -0.3, lookY: o.lookY ?? 0, blink: o.blink ?? 0, smug: o.smug ?? 0, tilt: o.tilt ?? 0.1 });
    CAT_EYES = [here(x - 50 * s, y - 28 * s), here(x + 50 * s, y - 28 * s), zoomNow() * s];
  };
}
function catEyesGlow(a, blink = 0) {
  if (!CAT_EYES || a <= 0) return;
  const [e1, e2, k] = CAT_EYES;
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  for (const [x, y] of [e1, e2]) {
    glow(x, y, 70 * k, '#c6ff5a', 0.55 * a);
    g.fillStyle = `rgba(220,255,140,${a})`; g.beginPath(); g.ellipse(x, y, 22 * k, 26 * k * (1 - blink * 0.9), 0, 0, TAU); g.fill();
    g.fillStyle = `rgba(20,30,10,${a})`; g.beginPath(); g.ellipse(x, y, 7 * k, 22 * k * (1 - blink * 0.9), 0, 0, TAU); g.fill();
  }
  g.restore();
}
// a small torch in the hero's hand, pointing along the forearm
const torchProp = on => side => {
  g.save(); g.rotate(-side * 0.2);
  solid(rrPath(-14, 10, 28, 70, 8), '#2d3240', [-14, 10, 28, 70], { lw: 4.5 });
  solid(rrPath(-20, 72, 40, 26, 6), '#3c4254', [-20, 72, 40, 26], { lw: 4.5 });
  if (on) glow(0, 100, 90, '#fff2c8', 0.8);
  g.restore();
};

// —— frame ——
export function frame(t) {
  tNow = t;
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  let i = 0; while (i < SHOTS.length - 2 && t >= SHOTS[i + 1][0]) i++;
  const [t0, fn] = SHOTS[i], t1 = SHOTS[i + 1][0];
  g.save();
  const r = fn(t, t - t0, t1 - t0) || {};
  g.restore();
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  // countdown
  if (t >= A.timer && t < A.black1) {
    if (r.hudBig) hud(t, clock(t), 1, { x: 540 - 150 * 2.5, y: 1240, scale: 2.5 + 0.25 * BEEPS.reduce((m, b) => Math.max(m, bump((t - b) / 0.25)), 0) });
    else if (r.hud !== false) {
      const u = ease.inOut(inv(A.go, A.go + 0.36, t));
      const big = { x: 540 - 150 * 2.4, y: 1290, s: 2.4 }, small = { x: 66, y: 176, s: 1 };
      const pulse = BEEPS.reduce((m, b) => Math.max(m, bump((t - b) / 0.25)), 0);
      const appear = spring(t - A.timer, 2.2, 7);
      hud(t, clock(t), clamp((t - A.timer) / 0.08), { x: lerp(big.x, small.x, u), y: lerp(big.y, small.y, u), scale: lerp(big.s * (t < A.go ? appear : 1), small.s, u) * (1 + 0.18 * pulse) });
    }
  }
  if (r.sub !== false) subtitles(t, SUBS, { y: r.sub ?? SUB.y });
  if (r.vsub) subtitles(t, VSUBS, { y: r.vsub, size: 84, color: '#ffe3c2', hold: 0.4 });
}

// ═══════════════════════════ shots ═══════════════════════════
const NIGHT = { x: -0.5, y: 0.6, rim: '#ff8a4a', rimA: 0.35 };
const LAMP = { x: 0.7, y: -0.6, rim: '#ffbf7a', rimA: 0.4 };
const HALL = { x: -0.6, y: -0.6, rim: '#ffd9a0', rimA: 0.35 };
const MOON = { x: -0.6, y: -0.7, rim: '#a8c8ff', rimA: 0.5 };
const TORCH = { x: 0.15, y: 1, rim: '#ffe2a8', rimA: 0.55, shadowA: 0.45 };

function shTitle(t, lt, d) {
  setLight(NIGHT);
  cam(540, 990 - 50 * ease.inOut(lt / d), lerp(1.0, 1.1, ease.inOut(lt / d)));
  exterior(t + 1.3, {});
  vignette(0.55);
  const fade = 1 - inv(d - 0.2, d, lt);
  title(t, 'ЗОМБИ-', A.title, { y: 330, size: 250, maxW: 1000, fade });
  title(t, 'АПОКАЛИПСИС', A.title + 0.12, { y: 500, size: 150, maxW: 1000, fade, color: '#c6f07a' });
  flash(t, A.title, 0.14, '#ffffff', 0.45);
  return { sub: false };
}

function shFloors(t, lt, d) {
  setLight(NIGHT);
  const [wx, wy, ww, wh] = winRect(OUR.floor, OUR.col);
  const t0 = t - lt;
  const c = keys([[0, [540, 940, 1.1]], [A.nine + 0.3 - t0, [430, 700, 1.5]], [d, [wx + ww / 2, wy + wh / 2 + 4, 4.4]]], lt);
  cam(c[0], c[1], c[2]);
  exterior(t + 1.3, {});
  // floors count up our column, 1 → 9
  const tags = [];
  for (let f = 1; f <= 9; f++) {
    const tf = A.floors - 0.08 + (f - 1) * ((A.nine + 0.2 - A.floors) / 8), age = t - tf;
    if (age < 0) continue;
    const [x, y, w, h] = winRect(f, OUR.col), fl = Math.exp(-age * 4);
    g.save(); g.strokeStyle = rgba('#ffe27a', Math.min(1, 0.9 * fl + (f === 9 ? 0.85 : 0.25))); g.lineWidth = px(f === 9 ? 7 : 5);
    g.strokeRect(x - 7, y - 7, w + 14, h + 14); g.restore();
    glow(x + w / 2, y + h / 2, 80, '#ffd27a', 0.55 * fl + (f === 9 ? 0.3 + 0.15 * Math.sin(t * 9) : 0));
    tags.push([f, here(x - 30, y + h / 2), age]);
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  const fade = 1 - inv(A.nine + 0.45, A.nine + 0.75, t);
  for (const [f, [sx, sy], age] of tags) {
    const big = f === 9, k = spring(age, 2.4, 7) * (big ? 1.5 : 1);
    g.save(); g.globalAlpha = big ? 1 - inv(d - 0.25 + (t - lt), d + (t - lt), t) : fade * (0.55 + 0.45 * Math.exp(-age * 3));
    if (g.globalAlpha <= 0) { g.restore(); continue; }
    g.translate(sx - (big ? 26 : 0), sy); g.scale(k, k);
    g.font = '700 46px Oswald'; g.textAlign = 'right'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    g.lineWidth = 10; g.strokeStyle = '#120d18'; g.strokeText(String(f), 0, 0);
    g.fillStyle = big ? '#ffd23f' : '#ffffff'; g.fillText(String(f), 0, 0);
    g.restore();
  }
  vignette(0.5);
  return {};
}

function shCat(t, lt, d) {
  setLight(LAMP);
  cam(540, 1010, 1.06 + 0.05 * lt / d);
  const r = livingRoom(t, { curtains: 0 });
  const jt = t - (A.catJump - 0.14);
  if (jt > 0) {
    const u = ease.out(clamp(jt / 0.3));
    const x = lerp(1080, 690, u), y = lerp(1560, r.sill + 4, u) - Math.sin(Math.PI * u) * 300;
    const meow = t > A.meow - 0.03 && t < A.meow + 0.45;
    drawCat({ x, y, s: 0.55, view: 'sit', squash: 1 - 0.22 * bump(clamp((jt - 0.3) / 0.25)), mouth: meow ? 'meow' : 'w',
      ears: meow ? -0.5 : 0, tailT: t, lookX: -0.4, lookY: 0.2, blink: blinkAt(t, [A.meow + 0.75]), tilt: meow ? -0.12 : 0.05 });
  }
  const happy = t > A.meow + 0.1;
  drawHero({ x: 430, y: 1720, s: 1.45, mouth: happy ? 'smile' : 'worry', browL: happy ? 0.15 : 0.6, browR: happy ? 0.15 : 0.6,
    lookX: jt > 0.1 ? 0.65 : 0.1, lookY: jt > 0.1 ? -0.45 : -0.1, tilt: happy ? 0.08 : 0.03, breathe: Math.sin(t * 2),
    blink: blinkAt(t, [A.catJump - 0.35]) });
  vignette(0.5);
  return {};
}

function shPhone(t, lt, d) {
  setLight({ x: -0.6, y: -0.7, rim: '#ffd9a0', rimA: 0.35 });
  cam(540, 1000, 1.0 + 0.07 * ease.inOut(lt / d), -0.02);
  vgrad(-400, -300, 1880, 2520, [[0, '#1f2438'], [1, '#0c0e19']]);
  glow(540, 950, 1000, '#ff3b3b', 0.2 * (0.6 + 0.4 * Math.sin(t * 13)));
  phone(t, { mode: 'alert', k: Math.max(0, t - A.alert), buzz: t < A.alert + 0.9 ? 1 : t > A.ten && t < A.ten + 0.3 ? 0.6 : 0, x: 540, y: 1050 });
  sleeveHand(700, 1400, -2.3, 'open', 1.2);
  vignette(0.5);
  return {};
}

function shPower(t, lt, d) {
  setLight(NIGHT);
  cam(560, 930, 1.32 - 0.1 * ease.inOut(lt / d));
  const p = powerAt(t);
  exterior(t + 1.3, { power: p });
  if (!p) darken('#20243a', 0.35);
  vignette(0.55);
  return {};
}

function shTimer(t, lt, d) {
  setLight(LAMP);
  cam(450, 1090, 2.0 + 0.18 * ease.inOut(lt / d));
  livingRoom(t, { curtains: 0 });
  drawCat({ x: 690, y: 1058, s: 0.55, view: 'sit', tailT: t, lookX: -0.6, lookY: 0.3 });
  const set = t > A.go;
  drawHero({ x: 430, y: 1720, s: 1.45, mouth: set ? 'grit' : 'flat', browL: set ? -0.75 : -0.3, browR: set ? -0.75 : -0.3,
    lookX: 0, lookY: 0.05, breathe: Math.sin(t * 2), blink: blinkAt(t, [A.timer - 0.05]) });
  vignette(0.55);
  return {};
}

// step slams over a darkened view of the step's place
function slamShot(bg, num, word, key, colors) {
  return (t, lt, d) => {
    g.save(); bg(t); g.restore();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = 'rgba(5,7,12,.64)'; g.fillRect(0, 0, W, H);
    vignette(0.6);
    slam(t, num, word, A[key], d + 0.5, { wordAt: A[key + 'w'], colors });
    flash(t, A[key], 0.12, '#ffffff', 0.5);
    return { sub: false };
  };
}
const shSlam1 = slamShot(t => { setLight(HALL); cam(540, 940, 1.02); hall(t, { bolt: 0 }); }, '1', 'ДВЕРЬ', 's1', ['#c6ff7a', '#54b82c']);
const shSlam2 = slamShot(t => { setLight(LAMP); cam(540, 900, 1.02); livingRoom(t, { curtains: 0 }); }, '2', 'СТАНЬ НЕВИДИМЫМ', 's2', ['#e8c4ff', '#9a5ce0']);
const shSlam3 = slamShot(t => { setLight({ x: 0.2, y: -0.9, rim: '#e0f4ff', rimA: 0.45 }); cam(540, 960, 1.02); bathroom(t, { water: 0.1 }); }, '3', 'ВОДА', 's3', ['#c4ecff', '#2f93e6']);
const shSlam4 = slamShot(t => { setLight(HALL); cam(540, 1000, 1.02); parquet(-300, -200, 1680, 2320); bagTop(t); }, '4', 'ТРЕВОЖНЫЙ РЮКЗАК', 's4', ['#ffdc9a', '#f07a1e']);
const shSlam5 = slamShot(t => { cam(540, 1040, 1.02); cutaway(t, {}); }, '5', 'ПУТЬ ОТХОДА', 's5', ['#ffb0a0', '#e0402e']);

function shLock(t, lt, d) {
  setLight(HALL);
  cam(540, 960, 1.0 + 0.07 * lt / d);
  const turns = ease.inOut(inv(A.key1 - 0.2, A.key1, t)) + ease.inOut(inv(A.key1 + 0.08, A.key1 + 0.26, t));
  lockCloseup(t, turns);
  return {};
}

function shLatch(t, lt, d) {
  setLight(HALL);
  cam(540, 960, 1.0 + 0.06 * lt / d);
  latchCloseup(t, inv(A.latch - 0.24, A.latch, t));
  return {};
}

function shPush(t, lt, d) {
  setLight(HALL);
  cam(620, 1170, 1.1);
  hall(t, { bolt: 1 });
  const u = ease.inOut(inv(A.push0 + 0.05, A.thud, t));
  const cx = lerp(880, 540, u), base = 1560, top = base - 540 * 0.95;
  dust(t, A.thud, cx - 150, base, 9, 300);
  cabinet(cx, base, 0.95);
  const hop = t > A.thud ? bump(clamp((t - A.thud) / 0.32)) * 70 : 0;
  const ride = t < A.thud ? Math.sin(t * 22) * 4 * (u > 0 && u < 1 ? 1 : 0) : 0;
  drawCat({ x: cx + 20, y: top - hop + ride, s: 0.6, view: 'sit', smug: t > A.thud + 0.3 ? 0.6 : 0.35, tailT: t, lookX: t > A.thud + 0.3 ? 0.2 : 0.5,
    squash: 1 - 0.2 * bump(clamp((t - A.thud - 0.32) / 0.2)), ears: t > A.thud && t < A.thud + 0.3 ? -0.5 : 0 });
  const pushing = t < A.thud + 0.15;
  const hx = cx + 190 * 0.95 + 120;
  if (pushing) {
    drawHero({ x: hx, y: 1740, s: 1.3, face: -1, lean: 0.3, mouth: 'grit', browL: -0.6, browR: -0.6, sweat: 0.4 + 0.4 * Math.sin(t * 3),
      armR: { sh: 1.5, el: 0.15 }, armL: { sh: -0.55, el: 1.0 }, legL: { hip: 0.5, knee: -0.15 }, legR: { hip: -0.05, knee: 0.25 },
      bob: Math.sin(t * 16) * 5, lookX: 0.6 });
  } else {
    const w = inv(A.thud + 0.2, A.thud + 0.5, t);
    drawHero({ x: hx + 30, y: 1740, s: 1.3, face: -1, mouth: 'smile', browL: 0.2, browR: 0.2, sweat: 1 - w,
      armR: { sh: lerp(1.5, 3.05, ease.out(w)), el: lerp(0.15, 0.7, ease.out(w)) }, armL: { sh: 0.2, el: 0.1 },
      lookX: -0.2, lookY: -0.2, blink: blinkAt(t, [A.thud + 0.75]), breathe: Math.sin(t * 5) * 0.6 });
  }
  vignette(0.5);
  return {};
}

function shCurtains(t, lt, d) {
  setLight(LAMP);
  cam(540, 820, 1.18 + 0.06 * lt / d);
  const k = ease.out(inv(A.curt, A.curt + 0.42, t));
  livingRoom(t, { curtains: k });
  // two hands pulling the curtains together
  const cw = lerp(150, 380, k), lx = 130 + cw, rx = 950 - cw, hy = 640;
  sleeveHand(lx - 10, hy, -1.15, 'fist', 0.62, 2000);   // long sleeves: your own arms, coming from below the frame
  sleeveHand(rx + 10, hy, -2.0, 'fist', 0.62, 2000);
  vignette(0.5);
  return {};
}

function shSwitch(t, lt, d) {
  setLight(LAMP);
  cam(870, 930, 2.6 + 0.15 * lt / d);
  wallpaper(-300, -200, 1680, 1720, '#5e6a74', '#e9d9b0');
  glow(1100, 700, 700, '#ffb35c', 0.25);
  const on = t < A.click ? 1 : 0;
  lightSwitch(870, 900, 1, on);
  const reach = ease.out(inv(A.click - 0.32, A.click - 0.02, t)) - ease.inOut(inv(A.click + 0.15, A.click + 0.5, t)) * 0.7;
  sleeveHand(882, 900 - 22 + 52 + lerp(380, 0, reach), -1.7, 'point', 0.42, 1400);
  if (!on) {
    const fl = t < A.click + 0.1 ? 0.5 : 1;
    darken('#121a36', 0.86 * fl);
    glow(700, 600, 700, '#7f9fff', 0.12);
  }
  vignette(0.55);
  return {};
}

function shSilent(t, lt, d) {
  setLight({ x: -0.6, y: -0.7, rim: '#9fc3ff', rimA: 0.35 });
  cam(540, 1060, 1.0 + 0.05 * lt / d);
  vgrad(-400, -300, 1880, 2520, [[0, '#121626'], [1, '#06070d']]);
  const s = ease.inOut(inv(A.silent - 0.12, A.silent + 0.12, t));
  glow(540, 1000, 900, '#6f8cff', 0.2);
  phone(t, { mode: 'silent', silent: s, x: 540, y: 1000 });
  const tx = 540 + lerp(-45, 45, s) + 21, ty = 1000 + 345 - lerp(-45, 45, s) * 0.06;
  const press = ease.out(inv(A.silent - 0.4, A.silent - 0.12, t));
  sleeveHand(tx, ty + 120 + lerp(300, 0, press), -1.75, 'point', 1.0, 900);
  vignette(0.6);
  return {};
}

function shPot(t, lt, d) {
  setLight(MOON);
  cam(560, 1100, 1.02);
  const k = kitchen(t);
  const [fx, fy] = k.fridgeTop;
  const tPush = A.potPush, tFall = A.clang - 0.3, tClang = A.clang;
  // the pot slides, falls and bounces; the lid flies off
  let px0 = fx - 90, py0 = fy, rot = 0;
  if (t > tPush) px0 = lerp(fx - 90, fx - 215, ease.in(inv(tPush, tFall, t)));
  if (t > tFall) { const u = inv(tFall, tClang, t); py0 = lerp(fy, 1660, u * u); rot = -u * 2.4; px0 -= u * 70; }
  if (t > tClang) { const b = clamp((t - tClang) / 0.3); py0 = 1660 - bump(b) * 70; rot = -2.4 - b * 0.7; px0 -= b * 40; }
  pot(px0, py0, 0.8, rot, '#c9cdd6', t < tClang);
  if (t > tClang) {
    const u = clamp((t - tClang) / 0.6);
    g.save(); g.translate(lerp(px0, 980, u), 1640 - Math.sin(Math.PI * u) * 340 + u * 40); g.rotate(u * 9);
    solid(ellPath(0, 0, 70, 14), '#b9bec8', [-70, -14, 140, 28], { lw: 4.5, hiA: 0.3 }); g.restore();
    dust(t, tClang, px0, 1660, 5, 160);
  }
  // Батон on the fridge, paw on the pot
  const paw = t < tPush ? ease.out(inv(tPush - 0.3, tPush, t)) * 0.55 : lerp(0.55, 1.0, inv(tPush, tPush + 0.1, t)) * (1 - inv(tFall, tFall + 0.3, t));
  drawCat({ x: fx + 70, y: fy, s: 0.6, view: 'side', face: -1, paw, tailT: t, lookX: t > tClang ? 0.4 : -0.3, lookY: t > tFall ? 0.6 : 0.1 });
  // the hero jumps out of his skin
  const jt = t - tClang, jump = jt > 0 ? bump(clamp(jt / 0.45)) * 170 : 0, scared = jt > 0 && jt < 0.75;
  drawHero({ x: 300, y: 1800 - jump, s: 1.3, mouth: scared ? 'open' : 'flat', mouthOpen: 0.9, hairUp: scared ? 1 : jt > 0 ? 0.3 : 0,
    pupil: scared ? 0.5 : 1, eyeScale: scared ? 1.15 : 1, browL: scared ? 1 : jt > 0 ? -0.8 : 0.35, browR: scared ? 1 : jt > 0 ? -0.8 : 0.35,
    lookX: 0.6, lookY: -0.55, armL: scared ? { sh: 2.6, el: 0.4 } : { sh: 0.25, el: 0.2 }, armR: scared ? { sh: 2.6, el: 0.4 } : { sh: 0.25, el: 0.2 },
    legL: scared ? { hip: 0.4, knee: 0.6 } : {}, legR: scared ? { hip: 0.4, knee: 0.6 } : {}, sweat: 0.6, shadow: 0.35 * (1 - jump / 250) });
  darken('#2a3a6a', 0.55);
  glow(290, 420, 380, '#9fb8ff', 0.12);
  vignette(0.6);
  return {};
}

function shInnocent(t, lt, d) {
  setLight(MOON);
  const k = kitchen(t);
  const [fx, fy] = k.fridgeTop;
  cam(fx + 40, fy - 120, 2.45 + 0.25 * ease.inOut(lt / d));
  kitchen(t);
  drawCat({ x: fx + 40, y: fy, s: 0.6, view: 'sit', pupil: 1.5, lookX: 0, lookY: 0.15, tilt: 0.1 + 0.06 * Math.sin(t * 2.2), tailT: t,
    blink: bump(inv(A.innocent, A.innocent + 0.45, t)) });
  darken('#2a3a6a', 0.42);
  glow(fx + 40, fy - 130, 300, '#ffffff', 0.07);
  vignette(0.6);
  return {};
}

function shBath(t, lt, d) {
  setLight({ x: 0.2, y: -0.9, rim: '#e0f4ff', rimA: 0.45 });
  const t0 = t - lt, sp = [810, 882];
  const c = keys([[0, [540, 990, 1.0]], [A.dry - 0.15 - t0, [540, 980, 1.07]], [A.dry + 0.45 - t0, [sp[0] - 60, sp[1] + 150, 2.0]], [d, [sp[0] - 60, sp[1] + 140, 2.15]]], lt);
  cam(c[0], c[1], c[2]);
  const lvl = lerp(0.12, 0.92, inv(t0, A.pumps, t));
  const b = bathroom(t, { water: lvl });
  const flow = t < A.pumps ? 1 : t < A.dry + 0.1 ? lerp(1, 0.32, inv(A.pumps, A.dry + 0.1, t)) : t < A.dry + 0.85 ? 0.2 : 0;
  waterStream(t, b.spout[0], b.spout[1], b.surface, flow);
  pop(t, A.pots, 300, 1720, () => pot(0, 0, 1));
  pop(t, A.pots + 0.16, 455, 1780, () => pot(0, 0, 0.72, 0, '#d8a24a'));
  for (let i = 0; i < 4; i++) pop(t, A.bottles + i * 0.11, 610 + i * 92, 1720, () => bottle(0, 0, 0.9, 1));
  // Батон tests the water
  const up = ease.out(inv(A.dip, A.dip + 0.2, t)), down = ease.in(inv(A.dip + 0.2, A.dip + 0.34, t)), shake = inv(A.dip + 0.38, A.dip + 0.42, t) * (1 - inv(A.dip + 0.95, A.dip + 1.05, t));
  const paw = clamp(up * 0.85 - down * 0.5 + shake * (0.25 + 0.15 * Math.sin(t * 46)));
  const yuck = t > A.dip + 0.36 && t < A.dip + 1.3;
  drawCat({ x: 260, y: b.rim + 30, s: 0.62, view: 'sit', paw, ears: yuck ? 0.85 : t > A.dry ? 0.4 : 0, tailT: t, mouth: yuck && t < A.dip + 0.8 ? 'hiss' : 'w',
    lookX: t > A.pumps ? 0.8 : 0.4, lookY: t > A.pumps ? -0.7 : 0.3, puff: yuck ? 0.3 : 0 });
  if (t > A.dip + 0.34 && t < A.dip + 1.1) for (let i = 0; i < 6; i++) {
    const a = (t - A.dip - 0.34) * 2.2 + i * 0.37, k = (a % 1);
    g.fillStyle = 'rgba(200,236,255,.9)'; g.beginPath(); g.ellipse(330 + Math.sin(i * 2.1) * 70 * k, 960 - 120 * k + 260 * k * k, 7, 10, 0, 0, TAU); g.fill();
  }
  vignette(0.45);
  return {};
}

const ITEMS = () => [
  ['torch', A.torch, [-260, 420], -1.2, 0.5], ['aid', A.aid, [1340, 380], 1.0, -0.2], ['power', A.power, [-260, 1700], -0.8, 0.3],
  ['grechka', A.food, [1340, 1820], 0.9, -0.1], ['can', A.three - 0.04, [540, -260], 0.6, 0.1], ['can', A.three + 0.08, [-260, 1000], -0.9, -0.2],
  ['can', A.three + 0.2, [1340, 1000], 1.1, 0.3]];
function shBag(t, lt, d) {
  setLight(HALL);
  cam(540, 1000, 1.0 + 0.05 * lt / d, -0.015);
  parquet(-300, -200, 1680, 2320);
  const its = ITEMS(), mouth = [BAG.x, BAG.y - 50];
  let sq = 0;
  for (const [, t0] of its) sq = Math.max(sq, bump(clamp((t - t0 - 0.28) / 0.25)));
  sq = Math.max(sq, bump(clamp((t - A.catIn - 0.06) / 0.3)) * 1.6);
  g.save(); g.translate(BAG.x, BAG.y); g.scale(1 + 0.045 * sq, 1 - 0.045 * sq); g.translate(-BAG.x, -BAG.y);
  bagTop(t);
  g.restore();
  // what has landed stays in the bag, the cat squeezes in on top
  const PILE = { torch: [[460, 985, 0.6, 0.62]], aid: [[645, 975, -0.35, 0.6]], power: [[470, 1150, 0.25, 0.6]], grechka: [[635, 1140, -0.15, 0.55]],
    can: [[545, 1060, 0.1, 0.55], [415, 1075, -0.3, 0.5], [680, 1060, 0.4, 0.5]] };
  g.save(); g.clip(rrPath(BAG.x - 220, BAG.y - 230, 440, 360, 110));
  const used = {};
  for (const [id, t0] of its) {
    const k = used[id] = (used[id] ?? -1) + 1;
    if (t > t0 + 0.28) { const [x, y, r, s] = PILE[id][k]; item(id, x, y, r, s * (1 + 0.15 * bump(clamp((t - t0 - 0.28) / 0.2)))); }
  }
  g.restore();
  // the cat drops in, then its head pops out
  const ct = t - (A.catIn - 0.24);
  if (ct > 0 && ct < 0.3) {
    const u = ease.in(clamp(ct / 0.3));
    g.save(); g.translate(mouth[0], lerp(-320, mouth[1], u)); g.rotate(Math.PI / 2); g.scale(lerp(1.4, 0.75, u), lerp(1.4, 0.75, u));
    drawCat({ x: 0, y: 0, s: 1, view: 'top', walk: ct * 3, tailT: t }); g.restore();
  } else if (ct >= 0.3) {
    const k = spring(ct - 0.3, 2.2, 6);
    const bleh = t > A.catIn + 0.65 && t < A.catIn + 1.2;
    drawCat({ x: BAG.x, y: BAG.y + 60 - 80 * k, s: 0.9, view: 'head', smug: bleh ? 0 : 0.5, tongue: bleh ? 0.8 : 0, lookX: bleh ? 0 : Math.sin((ct - 0.3) * 2.5) * 0.6,
      tilt: 0.12 * Math.sin((ct - 0.3) * 2), ears: ct < 0.5 ? -0.5 : 0 });
  }
  // items fly in on their words
  for (const [id, t0, from, r0, r1] of its) {
    const u = (t - t0 + 0.12) / 0.4;
    if (u < 0 || u > 1) continue;
    const e = ease.inOut(u), s = (id === 'can' ? 0.9 : 1.05) * (1 + 0.45 * Math.sin(Math.PI * u)) * lerp(1, 0.4, e);
    item(id, lerp(from[0], mouth[0], e), lerp(from[1], mouth[1], e), lerp(r0, r1, e), s);
  }
  glow(540, 900, 900, '#ffd9a0', 0.12);
  vignette(0.5);
  return {};
}

function shCut(t, lt, d) {
  setLight(NIGHT);
  const t0 = t - lt, fh = (CUT.bottom - CUT.top) / CUT.floors, cabY = CUT.bottom - 4.5 * fh - fh * 0.5, shaftX = CUT.x0 + 210;
  const c = keys([[0, [540, 1040, 1.0]], [A.lift + 0.15 - t0, [shaftX + 120, cabY + 60, 1.32]], [A.trap + 0.4 - t0, [shaftX + 140, cabY + 80, 1.38]],
    [A.below + 0.35 - t0, [540, 1180, 1.06]], [A.exit + 0.1 - t0, [540, 1180, 1.06]], [A.exit + 0.7 - t0, [520, 640, 1.2]], [d, [520, 630, 1.24]]], lt);
  cam(c[0], c[1], c[2]);
  const r = cutaway(t, { liftTrap: inv(A.trap - 0.08, A.trap + 0.12, t), danger: ease.out(inv(A.below - 0.05, A.they + 0.45, t)) });
  // a red cross over the lift
  if (t > A.trap) {
    const k = spring(t - A.trap, 2.4, 6), cx = shaftX + 35, cy = cabY + fh * 0.45;
    g.save(); g.translate(cx, cy); g.scale(k, k);
    for (const sd of [-1, 1]) line([[-70, -70 * sd], [70, 70 * sd]], 16, '#ff3b3b');
    g.restore();
    glow(cx, cy, 140, '#ff3b3b', 0.35);
  }
  // the way out: up the stairs, over the roof, into the next entrance
  if (t > A.exit) {
    const pts = [r.home, [r.stairs[0] + 60, r.home[1]], [r.stairs[0] + 60, r.top - 40], [r.stairs[1] + 60, r.top - 40], [r.stairs[1] + 60, r.home[1] + 40]];
    const head = route(pts, ease.inOut(inv(A.exit + 0.15, A.exitEnd - 0.1, t)), t);
    drawHero({ x: head[0], y: head[1] + 16, s: 0.11, mouth: 'grit', backpack: 1, browL: -0.6, browR: -0.6, shadow: 0, bob: Math.abs(Math.sin(t * 14)) * -20 });
  }
  vignette(0.45);
  return {};
}

function shCountdown(t, lt, d) {
  setLight(HALL);
  cam(540, 1200, 1.12 + 0.12 * ease.in(lt / d));
  hall(t, { bolt: 1, switch: false });
  cabinet(540, 1560, 0.95);
  drawHero({ x: 540, y: 1860, s: 1.25, backpack: 1, cat: catOnBack({ ears: 0.3, lookX: -0.4, lookY: -0.3 }), mouth: 'worry', sweat: 1,
    browL: 0.75, browR: 0.75, lookX: 0, lookY: -0.6, pupil: 0.8, breathe: Math.sin(t * 7) * 0.8, armL: { sh: 0.35, el: 0.6 }, armR: { sh: 0.35, el: 0.6 },
    handL: 'fist', handR: 'fist' });
  const fl = t > A.zero ? (Math.sin(t * 70) > 0 ? 0.25 : 0.75) : 0;
  darken('#1a2033', 0.3 + fl);
  vignette(0.6);
  return { hudBig: true };
}

function shDark(t, lt, d) {
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  const on = t > A.torchOn;
  setLight(TORCH);
  cam(540, 1250, 1.45);
  hall(t, { bolt: 1, switch: false });
  cabinet(540, 1560, 0.95);
  const relief = inv(A.uspel, A.uspel + 0.3, t);
  drawHero({ x: 540, y: 1860, s: 1.25, backpack: 1, cat: catOnBack({ ears: 0.2, lookX: 0.2, lookY: 0.2, blink: blinkAt(t, [A.black1 + 0.75]) }),
    mouth: relief > 0.5 ? 'smile' : on ? 'o' : 'worry', mouthOpen: 0.3, sweat: 1 - relief, browL: lerp(0.7, 0.1, relief), browR: lerp(0.7, 0.1, relief),
    lookX: 0, lookY: lerp(-0.2, 0, relief), pupil: on ? 1 : 0.8, armR: { sh: 0.75, el: 1.35 }, handR: 'fist', propR: torchProp(on),
    armL: { sh: 0.2, el: 0.2 }, breathe: Math.sin(t * 3) * 0.7, tilt: relief * 0.06 });
  if (!on) {
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    catEyesGlow(inv(A.black1 + 0.35, A.black1 + 0.5, t), blinkAt(t, [A.black1 + 0.75]));
    return { sub: 1450 };
  }
  const k = clamp((t - A.torchOn) / 0.06);
  darkness('#020308', 1 - 0.1 * k, [{ x: 560, y: 1000, r: 620 * k, core: 0.25, sx: 1, sy: 1.1 }, { x: 640, y: 1500, r: 360 * k }]);
  screenGlow(640, 1420, 300, '#ffd98a', 0.35 * k);
  catEyesGlow(0.35);
  return { sub: 470 };
}

function shDoorBeam(t, lt, d) {
  setLight({ x: 0.2, y: 0.3, rim: '#ffe2a8', rimA: 0.45 });
  cam(540, 900, 1.12 + 0.06 * lt / d);
  const shake = A.scratches.reduce((m, s) => Math.max(m, bump((t - s) / 0.3)), 0);
  hall(t, { bolt: 1, doorShake: shake, switch: false });
  cabinet(540, 1560, 0.95);
  const [bx, by] = here(540 + noise(t * 1.3, 2) * 50, 780 + noise(t * 1.1, 5) * 40);
  darkness('#020309', 0.94, [{ x: bx, y: by, r: 470, core: 0.3, sy: 1.2 }]);
  screenGlow(bx, by, 380, '#ffdf9a', 0.16);
  // dust in the beam
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  for (let i = 0; i < 26; i++) {
    const a = hash(i * 1.7) * TAU, rr = hash(i * 3.1) * 400, yy = (by + Math.sin(a) * rr + t * 22 * (0.5 + hash(i))) % H;
    g.fillStyle = `rgba(255,236,200,${0.25 * (1 - rr / 400)})`; g.fillRect(bx + Math.cos(a) * rr * 0.8, yy, 3, 3);
  }
  g.restore();
  vignette(0.7);
  return {};
}

function shGap(t, lt, d) {
  cam(540, 1400, 1.5 + 0.12 * lt / d);
  doorGap(t, { step: Math.sin(t * 7) * 30 });
  // claws scraping in the light
  const sc = A.scratches.reduce((m, s) => Math.max(m, bump((t - s) / 0.32)), 0);
  for (let i = 0; i < 4; i++) {
    const x = 610 + i * 22 + Math.sin(t * 26 + i) * 10 * sc;
    line([[x, 1366], [x + 6 * sc, 1384]], 7, `rgba(3,3,5,${0.4 + 0.6 * sc})`);
  }
  vignette(0.6);
  return {};
}

function shFright(t, lt, d) {
  setLight(TORCH);
  cam(560, 1180, 1.95 + 0.25 * ease.out(lt / d));
  hall(t, { bolt: 1, switch: false });
  drawHero({ x: 540, y: 1860, s: 1.25, backpack: 1, cat: catOnBack({ ears: 1, puff: 1, mouth: 'hiss', pupil: 0.45, lookX: -0.6, lookY: 0.2, tilt: -0.1 }),
    mouth: 'worry', hairUp: 1, pupil: 0.45, eyeScale: 1.12, browL: 1, browR: 1, sweat: 1, lookX: 0.3, lookY: -0.1,
    armR: { sh: 0.75, el: 1.35 }, handR: 'fist', propR: torchProp(true), armL: { sh: 0.2, el: 0.2 }, bob: Math.sin(t * 60) * 2 });
  darkness('#020308', 0.9, [{ x: 560, y: 900, r: 760, core: 0.3, sy: 1.1 }]);
  catEyesGlow(0.25);
  return {};
}

function shApproach(t, lt, d) {
  setLight(TORCH);
  const k = ease.inOut(clamp(lt / (d - 0.5))), zt = ease.in(inv(d - 0.62, d, lt));
  const s = lerp(1.15, 2.1, k), hx = 540, hy = 1900 + 420 * k;
  const face = [hx + 10 * s, hy - 470 * s], eye = [hx + 48 * s, hy - 458 * s];
  cam(lerp(face[0], eye[0], zt), lerp(face[1] + 60, eye[1], zt), lerp(1, 10, zt * zt));
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); vgrad(0, 0, W, H, [[0, '#0b0d14'], [1, '#05060a']]); g.restore();
  wallpaper(-600, -400, 2280, 3200, '#55705f', '#e8e0c0', 2);
  const gulp = bump(inv(A.approach + 0.9, A.approach + 1.25, t));
  drawHero({ x: hx, y: hy, s, backpack: 1, cat: catOnBack({ ears: 0.9, puff: 0.6, pupil: 0.5, lookX: 0.1 }), mouth: gulp > 0.2 ? 'o' : 'worry', mouthOpen: 0.2,
    hairUp: 0.4, pupil: 0.7 + 0.3 * zt, eyeScale: 1.05 + 0.1 * zt, browL: 0.8, browR: 0.8, sweat: 1, lookX: 0, lookY: 0,
    armR: { sh: 0.75, el: 1.35 }, handR: 'fist', propR: torchProp(true), armL: { sh: 0.2, el: 0.2 }, blink: blinkAt(t, [A.approach + 0.5]), shadow: 0 });
  const [fxp, fyp] = here(face[0], face[1]);
  darkness('#020308', 0.93, [{ x: fxp, y: fyp, r: 330 * s * zoomNow(), core: 0.3, sy: 1.15 }]);
  catEyesGlow(0.3);
  return {};
}

const envAt = lt => { const i = lt * 30; if (i < 0 || i >= ENV.length - 1) return 0; const j = Math.floor(i); return lerp(ENV[j], ENV[j + 1], i - j); };
function flickerAt(t) {
  for (const [a, b] of [[A.vStart + 2.9, A.vStart + 3.0], [A.vStart + 3.08, A.vStart + 3.12], [A.figure - 0.12, A.figure], [A.figure + 0.2, A.figure + 0.32]]) if (t >= a && t < b) return 0.15;
  return 1;
}
function shPeep(t, lt, d) {
  setLight({ x: 0.2, y: -0.8, rim: '#ffd9a0', rimA: 0.35 });
  const talk = envAt(t - A.vStart), fl = flickerAt(t);
  const figure = t >= A.figure && t < A.figure + 0.2 ? 1 : 0;
  peephole(t, { talk, stain: 0.3, figure, flicker: figure ? 1.4 : fl, blink: blinkAt(t, [A.vStart + 4.6, A.vStart + 7.4], 0.2),
    tilt: 0.05 * Math.sin(t * 1.3) + (t > A.vBaba ? 0.05 : 0), scale: lerp(0.95, 1.06, lt / d), dy: -40 });
  return { sub: false, vsub: 1700 };
}
function shStain(t, lt, d) {
  setLight({ x: 0.2, y: -0.8, rim: '#ffd9a0', rimA: 0.35 });
  const k = ease.inOut(clamp(lt / (d * 0.7)));
  peephole(t, { talk: 0, stain: lerp(0.3, 1.0, ease.inOut(clamp(lt / (d * 0.8)))), drip: inv(d * 0.5, d, lt), flicker: 0.7,
    focus: [lerp(550, 332, k), lerp(550, 886, k), lerp(1, 2.5, k)], scale: lerp(1.06, 1.16, k), dy: -40 });
  return { sub: false };
}
function shCatHiss(t, lt, d) {
  setLight(TORCH);
  g.setTransform(1, 0, 0, 1, 0, 0); vgrad(0, 0, W, H, [[0, '#0d0b10'], [1, '#050407']]);
  cam(540, 960, 1.0 + 0.1 * lt / d);
  glow(540, 1300, 600, '#ffcf8a', 0.18);
  drawCat({ x: 540, y: 1240, s: 1.75, view: 'head', ears: 1, puff: 1, mouth: 'hiss', pupil: 0.42, lookX: 0, lookY: 0, tilt: -0.08 + Math.sin(t * 50) * 0.01 });
  darkness('#020308', 0.8, [{ x: 540, y: 1100, r: 720, core: 0.35 }]);
  return { sub: false };
}
function shPeepEnd(t, lt, d) {
  setLight({ x: 0.2, y: -0.8, rim: '#ffd9a0', rimA: 0.35 });
  peephole(t, { talk: 0, stain: 1, flicker: lt < 0.12 ? 1 : 0, eyes: inv(0.15, 0.35, lt), creepy: ease.inOut(inv(0.2, 0.6, lt)),
    tilt: lerp(0, 0.3, ease.inOut(inv(0.35, d, lt))), focus: [lerp(550, 520, lt / d), 560, lerp(1, 1.15, ease.inOut(lt / d))], scale: 1.04, dy: -40 });
  return { sub: false };
}

function shEnd(t, lt, d) {
  cam(540, 1100, 1.0);
  doorGap(t, { step: Math.sin(t * 2.3) * 40 });
  endCard(t, A.ask);
  return { sub: false };
}

// ═══════════════════════════ sound cues ═══════════════════════════
// [time, name, gain dB] — synthesised by tools/mix.py
export function cues() {
  const c = [];
  const add = (t, n, db = 0, extra = {}) => c.push({ t: +t.toFixed(3), n, db, ...extra });
  add(0, 'amb_city', -4, { dur: S('L3') - 0.08 });
  add(A.title, 'boom', 0); add(A.title + 0.02, 'groan', -10);
  add(S('L2') - 0.1, 'whoosh_up', -6);
  for (let f = 1; f <= 9; f++) add(A.floors - 0.08 + (f - 1) * ((A.nine + 0.2 - A.floors) / 8), 'blip', -14, { pitch: f });
  add(S('L3') - 0.08, 'amb_room', -8, { dur: S('L4') - S('L3') });
  add(A.catJump - 0.14, 'whoosh', -12); add(A.catJump + 0.16, 'land_soft', -10); add(A.meow - 0.03, 'meow', -3);
  add(A.alert, 'alert', -4); add(A.alert, 'buzz', -6, { dur: 0.9 });
  add(A.house, 'amb_city', -8, { dur: S('L5') - A.house });
  add(A.off, 'power_dip', -6); add(A.svet, 'power_dip', -8);
  add(A.timer, 'tick_big', -4); add(A.go, 'whoosh', -10);
  for (const k of ['s1', 's2', 's3', 's4', 's5']) { add(A[k], 'slam', -1); add(A[k + 'w'], 'whoosh_short', -12); }
  add(A.key1 - 0.02, 'key', -4); add(A.key1 + 0.24, 'key', -4); add(A.latch, 'latch', -4);
  add(A.push0 + 0.05, 'scrape', -6, { dur: A.thud - A.push0 - 0.05 }); add(A.thud, 'thud', -1);
  add(A.curt, 'swish', -6); add(A.click, 'switch', -4); add(A.click + 0.02, 'power_off_small', -12);
  add(A.silent - 0.02, 'toggle', -6);
  add(A.potPush, 'scrape_short', -12); add(A.clang, 'clang', 0); add(A.clang + 0.32, 'clang_small', -8);
  add(A.innocent + 0.1, 'mrr', -8);
  add(S('L12') - 0.05, 'water', -10, { dur: A.dry + 0.15 - S('L12') }); add(A.dry + 0.15, 'sputter', -10);
  add(A.pots, 'clunk', -8); add(A.pots + 0.16, 'clunk', -10);
  for (let i = 0; i < 4; i++) add(A.bottles + i * 0.11, 'pop', -12, { pitch: i });
  add(A.dip + 0.32, 'splash', -10); add(A.dip + 0.4, 'hiss_small', -12);
  for (const [, t0] of ITEMS()) { add(t0 - 0.12, 'whoosh_short', -14); add(t0 + 0.28, 'drop', -8); }
  add(A.catIn - 0.24, 'whoosh', -10); add(A.catIn + 0.06, 'thump_bag', -6); add(A.catIn + 0.35, 'mrr', -8);
  add(A.lift, 'ui', -10); add(A.trap, 'error', -11); add(E('L17'), 'horde', -6, { dur: A.exitEnd - E('L17') });   // roars after «Внизу — зомби», not over it
  add(A.exit + 0.15, 'route', -14, { dur: A.exitEnd - A.exit - 0.25 });
  for (const b of BEEPS.slice(0, 3)) add(b, 'beep', -8);
  add(BEEPS[3], 'beep_long', -6);
  add(A.black1, 'power_down', -5);
  add(A.torchOn, 'click', -4);
  for (const s of A.scratches) add(s, 'scratch', -6);
  add(A.scratch, 'door_rattle', -10);
  add(A.fright, 'hiss', -6); add(A.fright, 'sting_small', -10);
  add(A.approach, 'heartbeat', -8, { dur: A.vStart + 0.3 - A.approach });
  add(A.vStart - 0.45, 'whoosh_in', -10);
  add(A.vStart - 0.05, 'amb_stairs', -16, { dur: A.black - A.vStart });
  add(A.figure - 0.12, 'zap', -10); add(A.figure, 'sting', -6);
  add(A.reveal, 'heartbeat', -6, { dur: A.hiss - A.reveal });
  add(A.hiss, 'hiss', -2); add(A.peepEnd + 0.15, 'sting_big', -3);
  add(A.black, 'cut', 0);
  add(A.ask - 0.05, 'hit_end', -4);
  for (let k = 0; k < 4; k++) add(A.ask + 1.0 + k * 0.85, 'scratch', -16);
  return c;
}
export function anchors() { return A; }
export function shotList() { return SHOTS.map(([t, f]) => [+t.toFixed(3), f ? f.name : 'end']); }
