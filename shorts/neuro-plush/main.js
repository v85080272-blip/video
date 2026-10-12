// «Ты думаешь или зависла?» — котёнок Плюш и робот Нейро: зачем нейросети уровень рассуждения.
// Кадр — чистая функция времени t; тайминги реплик и кадров берутся из story.json (tts.py + layout.py).
import { THREE, W, H, clamp, lerp, seg, ss, eio, eo, back, spring, bump, V, vlerp, hash, vn, renderer, scene, camera } from './core.js';
import { SEAT_Y, key } from './lights.js';
import { updateRoom, poseVacuum, VAC_Z, RADIATOR, WIN, radiatorGlow, BOX_A, BOX_B } from './room.js';
import { slider, icons, map, big, cost, drawSlider, drawIcons, drawMap, drawBig, drawCost, place } from './holo.js';
import { cx, txt, inOut, words, subtitles, finish } from './ui.js';
import { neuro } from './neuro.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const { plush } = await import(new URLSearchParams(location.search).get('plush') || './plush.js');   // ?plush=./stub-plush.js — заглушка для отладки
const ST = await (await fetch('story.json')).json();
const FPS = ST.fps, SH = ST.shots, LN = Object.fromEntries(ST.lines.map(l => [l.id, l]));
window.DUR = ST.dur;
const SHOTS = Object.keys(SH);
const shotOf = t => { let cur = 'S1'; for (const k of SHOTS) if (t >= SH[k]) cur = k; return cur; };
const L0 = id => LN[id].t0, L1 = id => LN[id].t0 + LN[id].d, LD = id => LN[id].d;
const wordAt = (id, i) => words(LN[id])[i].s;   // начало i-го слова реплики
const ramp = (t, a, b, c, d) => seg(t, a, b) * (1 - seg(t, c, d));   // 0 → 1 → 0

// ——— ключевые моменты ———
const EV = {
  cut1: 2.1, holoOn: 5.0,
  push: L1('p1') + .25, gaze: L1('p1') + 1.0,
  uiFocus: L0('n1') + LD('n1') * .3, slideUp: wordAt('n1', 6) - .1,
  earsDown: L1('n1') + .15,
  cover: L1('n2') + .08, sly: L0('p3'), uncover: L1('n3') + .25,
  simple: wordAt('n4', 1) - .15, complex: wordAt('n4', 7) - .15,
  pathEnd: L0('p4') - .15, beep1: L1('p4') + .1, vacEnd: L1('p4') + .55,
  rA: L0('n5') + LD('n5') * .12, rB: L0('n5') + LD('n5') * .34, rC: L0('n5') + LD('n5') * .6,
  maxPush: SH.S8 + .25, bigOn: L0('n6') + .4, beep2: L1('n6') + 1.05,
  clock: wordAt('n7', 5) - .1, res: wordAt('n7', 7) - .1, check: wordAt('n7', 13) - .1, notice: L1('n7') + .65,
  touch: SH.S10 + .15, climb: L1('p6') + .25, circle: L1('p6') + 1.35, lieDown: L1('p6') + 2.4,
  ready: L0('n8'), noticeCat: L1('n8') + .15, radLook: L1('p7') + .25, radCut: L1('p7') + .55, radBack: L1('p7') + 1.25,
  petStart: L1('p8') + .2,
};
window.EV = EV;

// ——— постобработка ———
const composer = new EffectComposer(renderer);
composer.setPixelRatio(1); composer.setSize(W, H);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), .35, .5, .9));
composer.addPass(new OutputPass());

function speech(who, t) {
  for (const L of ST.lines) {
    if (L.who !== who || !L.env || !L.env.length) continue;
    const i = Math.floor((t - L.t0) * FPS);
    if (i >= 0 && i < L.env.length) { const a = L.env[i], b = L.env[i + 1] ?? 0, k = (t - L.t0) * FPS - i; return clamp(lerp(a, b, k) * 1.15, 0, 1.2); }
  }
  return 0;
}
const blinkAt = (t, seed) => { const p = 2.8 + hash(seed) * 1.6, ph = (t + hash(seed + 3) * 3) % p; return ph < .12 ? Math.sin(ph / .12 * Math.PI) : 0; };
const speaking = (t, id) => t >= L0(id) - .05 && t <= L1(id) + .1;

// ——— места ———
const CAT_SEAT = V(-.2, SEAT_Y, .08), CAT_ROT = .3, CAT_X0 = -.3;
const NEU_POS = V(.17, SEAT_Y, .04), NEU_ROT = -.2;
const SL_POS = V(.0, .565, .33);          // голограмма с ползунком у правой руки Нейро
const MAP_POS = V(.08, .6, .5), MAP_POS_UP = V(-.13, 1.1, .25);
const ICON_POS = V(-.02, 1.21, .2), COST_POS = V(-.02, 1.21, .2), BIG_POS = V(-.02, 1.5, -.18);
const knobWorld = lv => slider.m.localToWorld(V(lerp(-.3 / 2 + 80 / 640 * .3, .3 / 2 - 80 / 640 * .3, clamp(lv / 2)), -.15 / 2 + (320 - 222) / 320 * .15, .01));
neuro.group.position.copy(NEU_POS); neuro.group.rotation.y = NEU_ROT;

// взгляд/поворот головы на точку мира для персонажа (локальные координаты группы)
function aim(g, pW, headY) { g.updateMatrixWorld(true); const d = g.worldToLocal(pW.clone()); const yaw = Math.atan2(d.x, d.z), pitch = Math.atan2(d.y - headY, Math.hypot(d.x, d.z)); return { yaw, pitch }; }
const catAim = (pW, amt = 1) => { const a = aim(plush.group, pW, .22); return { headTurn: clamp(a.yaw * .7 * amt, -.9, .9), nod: clamp(-a.pitch * .6 * amt, -.5, .5), look: [clamp(a.yaw * .9, -1, 1), clamp(a.pitch * 1.2, -1, 1)] }; };
const neuAim = (pW, amt = 1) => { const a = aim(neuro.group, pW, .48); return { headTurn: clamp(a.yaw * .65 * amt, -.9, .9), nod: clamp(-a.pitch * .6 * amt, -.5, .5), look: [clamp(a.yaw * .9, -1, 1), clamp(a.pitch * 1.2, -1, 1)] }; };
const mix = (a, b, k) => { const o = { ...a }; for (const key in b) { const av = a[key], bv = b[key]; if (Array.isArray(bv)) o[key] = [lerp((av || [0, 0])[0], bv[0], k), lerp((av || [0, 0])[1], bv[1], k)]; else if (typeof bv === 'number') o[key] = lerp(av || 0, bv, k); else o[key] = k > .5 ? bv : av; } return o; };

// ——— пылесос: ездит туда-сюда по линии, в нужные моменты пищит ———
function vacState(t) {
  const P = 11, ph = (t + .25) / P, k = ph - Math.floor(ph), dir = k < .5 ? 1 : -1, u = k < .5 ? k * 2 : 2 - k * 2;
  const x = lerp(-1.55, 1.45, ss(u)), beep = (t > EV.beep1 && t < EV.beep1 + .45) || (t > EV.beep2 && t < EV.beep2 + .45) ? 1 : 0;
  return { x, heading: dir > 0 ? 0 : Math.PI, beep };
}

// ——— позы ———
function poses(t) {
  const s = shotOf(t), pk = speech('P', t), nk = speech('N', t);
  const headN = neuro.headWorld(), sliderW = SL_POS.clone(), mapW = MAP_POS.clone(), radW = V(RADIATOR.x, .5, RADIATOR.z), winW = V(WIN.x, WIN.y, WIN.z);
  // базовые позы
  let c = { talk: pk, blink: blinkAt(t, 1), tailSwish: .5, ...catAim(headN, .6) };
  let n = { talk: nk, blink: blinkAt(t, 2), ...neuAim(plush.headWorld(), .7), soft: .3 };
  // положение кота: сиденье → придвинулся → колени Нейро
  let cpos = CAT_SEAT.clone(), crot = CAT_ROT;
  const scootK = eio(seg(t, 4.9, 5.55)); cpos.x = lerp(CAT_X0, CAT_SEAT.x, scootK);

  if (s === 'S1') {
    const tuck = seg(t, 2.25, 2.8), lookRain = ramp(t, 2.85, 3.15, 3.65, 3.9), lookRad = ramp(t, 3.7, 3.95, 4.4, 4.7);
    c = mix(c, { tuck: tuck * (1 - .6 * seg(t, 4.1, 4.4)), shiver: ramp(t, 2.3, 2.6, 4.1, 4.4), ...catAim(winW) }, Math.max(lookRain, .3 * tuck));
    if (lookRad > 0) c = mix(c, { ...catAim(radW), earPerk: 1 }, lookRad);
    c.rub = ramp(t, 4.15, 4.35, 5.0, 5.2); c.scoot = bump(t, 4.95, 5.5); c.lean = .4 * bump(t, 4.9, 5.6);
    if (t > 5.4) c = mix(c, { ...catAim(sliderW), wide: .5, earPerk: 1 }, seg(t, 5.4, 5.8));
    n = mix(n, { ...neuAim(winW, .5), soft: .6 }, 1 - seg(t, 4.9, 5.4));
    n.handR = { k: seg(t, EV.holoOn - .4, EV.holoOn), at: [-.19, .14, .29] };
    if (t > 5.4) n = mix(n, neuAim(plush.headWorld()), seg(t, 5.4, 5.8));
  }
  if (s === 'S2') {
    c = mix(c, { ...catAim(sliderW), earPerk: .7, mouthO: .2 }, speaking(t, 'p1') ? .5 : 0);
    if (t > L0('p1') + LD('p1') * .5 && t < EV.push - .3) c = mix(c, catAim(headN), .8);   // «насколько ты умная?» — смотрит на неё
    const reach = ramp(t, EV.push - .35, EV.push, EV.gaze - .1, EV.gaze + .25);
    if (reach > 0) c.reach = { k: reach, at: plush.group.worldToLocal(knobWorld(lerp(0, 2, eo(seg(t, EV.push, EV.push + .5))))).toArray() };
    if (t > EV.push - .4 && t < EV.gaze) c = mix(c, catAim(sliderW), .9);
    if (t > EV.gaze) { c = mix(c, { ...catAim(headN.clone().add(V(0, .12, 0))), wide: .9, earPerk: 1, lean: .5, mouthO: .4 }, seg(t, EV.gaze, EV.gaze + .3)); c.blink = 0; }
    n = mix(n, { ...neuAim(plush.headWorld()), soft: .5, smile: .3 }, 1);
    n.handR = { k: 1, at: [-.19, .14, .29] };
    if (t > EV.gaze + .2) n = mix(n, { puzzled: .5 }, seg(t, EV.gaze + .2, EV.gaze + .6));
  }
  if (s === 'S3') {
    n = mix(n, { smile: .35, soft: .4, explain: speaking(t, 'n1') && t < EV.uiFocus ? .6 : 0 }, 1);
    if (t > EV.uiFocus) { n = mix(n, { ...neuAim(sliderW, .8), smile: .3 }, seg(t, EV.uiFocus, EV.uiFocus + .3)); n.handR = { k: 1, at: [-.12, .13, .3] }; }
    else n.handR = { k: .6, at: [-.19, .14, .29] };
    c = mix(c, catAim(t > EV.uiFocus ? sliderW : headN), 1);
    if (t > EV.uiFocus) c.wide = .4;
    if (t > EV.earsDown) { c = mix(c, { ...catAim(headN.clone().add(V(0, .12, 0))), earDown: 1, pout: .7, lid: .25 }, seg(t, EV.earsDown, EV.earsDown + .45)); }
  }
  if (s === 'S4') {
    c = mix(c, { earDown: .3 * (1 - seg(t, SH.S4, SH.S4 + .5)), squint: .2 }, 1);
    c.coverEar = eo(seg(t, EV.cover, EV.cover + .35)) * (1 - ss(seg(t, EV.uncover, EV.uncover + 1.0)));
    if (t > EV.sly - .2) c = mix(c, { smile: .6, squint: .35, headTilt: .15 }, seg(t, EV.sly - .2, EV.sly + .1) * (1 - seg(t, EV.uncover - .2, EV.uncover)));
    if (t > EV.uncover) c = mix(c, { squint: 1, smile: 0, pout: .4, headTilt: -.08, earDown: .2 }, seg(t, EV.uncover, EV.uncover + .6));
    n = mix(n, { soft: .3, smile: speaking(t, 'n3') ? .25 : .15 }, 1);
  }
  if (s === 'S5') {
    n = mix(n, { explain: speaking(t, 'n4') ? .8 : 0, smile: .3 }, 1);
    n.handR = { k: .3, at: [-.12, .13, .3] };
    if (t > EV.simple && t < EV.complex) n = mix(n, neuAim(ICON_POS.clone().add(V(-.06, 0, 0))), .6);
    if (t > EV.complex) n = mix(n, neuAim(ICON_POS.clone().add(V(.06, 0, 0))), .6 * (1 - seg(t, L1('n4') - .3, L1('n4'))));
    c = mix(c, catAim(t > EV.simple ? ICON_POS : headN), .9);
    if (t > L1('n4')) c = mix(c, { ...catAim(radW), earPerk: 1, tuck: .3 }, seg(t, L1('n4'), L1('n4') + .4));
  }
  if (s === 'S6') {
    c = mix(c, { ...catAim(radW), tuck: .4, shiver: speaking(t, 'p4') && t < wordAt('p4', 2) ? 1 : .3 }, 1);
    if (t > wordAt('p4', 2) - .1 && t < L1('p4')) c = mix(c, { ...catAim(headN), proud: .8, tuck: 0, shiver: 0, squint: .2 }, seg(t, wordAt('p4', 2) - .1, wordAt('p4', 2) + .2));
    const fl = ramp(t, EV.beep1 + .12, EV.beep1 + .2, EV.beep1 + .6, EV.beep1 + .9);
    if (t > EV.beep1) c = mix(c, { flinch: fl, earBack: fl, wide: fl, ...catAim(V(.2, .2, 3)) }, fl);
    if (t > EV.beep1 + .65) c = mix(c, { groom: 1, closed: .7, earBack: 0, flinch: 0 }, seg(t, EV.beep1 + .65, EV.beep1 + .95));
    n = mix(n, { ...neuAim(plush.headWorld()), soft: .4 }, 1);
  }
  if (s === 'S7') {
    n = mix(n, { ...neuAim(mapW), think: ramp(t, EV.rA - .2, EV.rA, L1('n5') - .3, L1('n5')) * .5, explain: speaking(t, 'n5') ? .4 : 0 }, 1);
    if (t < EV.rA) n = mix(n, neuAim(plush.headWorld()), 1 - seg(t, SH.S7, EV.rA));
    n.point = ramp(t, EV.rA, EV.rA + .3, EV.rC + 1.4, EV.rC + 1.8) * .7;
    c = mix(c, { ...catAim(mapW), proud: seg(t, EV.rB, EV.rB + .4), squint: .45 * seg(t, EV.rB, EV.rB + .4) }, 1);
  }
  if (s === 'S8') {
    const reach = ramp(t, SH.S8 - .05, EV.maxPush, EV.maxPush + .6, EV.maxPush + .9);
    if (reach > 0) c.reach = { k: reach, at: plush.group.worldToLocal(knobWorld(lerp(.5, 2, eo(seg(t, EV.maxPush, EV.maxPush + .35))))).toArray() };
    c = mix(c, { ...catAim(sliderW), proud: .5 }, 1 - seg(t, EV.maxPush + .5, EV.maxPush + .8));
    if (t > EV.maxPush + .5) c = mix(c, { ...catAim(headN), smile: 1, happy: speaking(t, 'p5') ? 0 : .3, proud: 1 }, seg(t, EV.maxPush + .5, EV.maxPush + .8));
    if (t > EV.bigOn) c = mix(c, { ...catAim(BIG_POS), wide: .8, smile: .8, earPerk: 1 }, seg(t, EV.bigOn, EV.bigOn + .4));
    const fl = ramp(t, EV.beep2 + .12, EV.beep2 + .2, EV.beep2 + .7, EV.beep2 + 1.0);
    if (t > EV.beep2) c = mix(c, { flinch: fl, earBack: fl, wide: fl, smile: 0 }, fl);
    if (t > EV.beep2 + .8) c = mix(c, { ...catAim(BIG_POS), proud: .6, smile: .3 }, seg(t, EV.beep2 + .8, EV.beep2 + 1.1));
    n = mix(n, { ...neuAim(plush.headWorld()), smile: .3, soft: .4 }, 1);
    n.handR = { k: .4, at: [-.12, .13, .3] };
    if (t > EV.bigOn) n = mix(n, { ...neuAim(BIG_POS), think: .8 }, seg(t, EV.bigOn, EV.bigOn + .4));
  }
  if (s === 'S9') {
    n = mix(n, { ...neuAim(mapW), think: .4, explain: speaking(t, 'n7') ? .35 : 0 }, 1);
    if (t > EV.check - .2) n.point = ramp(t, EV.check - .2, EV.check + .1, L1('n7'), L1('n7') + .3) * .4;
    // скучает: оглядывается, вздыхает, замечает тёплую руку
    const sweep = Math.sin((t - SH.S9) * .9) * .7;
    c = mix(c, { headTurn: sweep, look: [sweep, .2], lid: .45, earDown: .25, pout: .3, tailSwish: 1 }, seg(t, SH.S9 + .5, SH.S9 + 1.2));
    if (t > EV.notice) { const hand = neuro.handWorld('R'); c = mix(c, { ...catAim(hand), lid: 0, wide: .7, earPerk: 1, earDown: 0, lean: .4 }, seg(t, EV.notice, EV.notice + .35)); }
  }
  if (s === 'S10') {
    n = mix(n, { ...neuAim(mapW), think: .7 }, 1);
    n.warm = seg(t, EV.touch + .3, EV.touch + .9) * .85;
    const tch = ramp(t, EV.touch, EV.touch + .35, EV.climb - .1, EV.climb + .1);
    if (tch > 0) { const side = neuro.group.localToWorld(V(-.13, .12, .03)); c.reach = { k: tch, at: plush.group.worldToLocal(side).toArray(), side: 'L' }; }
    c = mix(c, { ...catAim(neuro.group.localToWorld(V(-.1, .15, .05))), wide: seg(t, EV.touch + .35, EV.touch + .6), smile: seg(t, EV.touch + .4, EV.touch + .8), earPerk: 1, blush: .5 }, 1);
    if (speaking(t, 'p6')) c = mix(c, { happy: .7, wide: 0 }, seg(t, L0('p6') + .3, L0('p6') + .6));
    // забирается на колени, круг, ложится
    const lapW = neuro.group.localToWorld(neuro.lapLocal.clone());
    const cl = seg(t, EV.climb, EV.circle), ck = eio(cl);
    if (t > EV.climb) {
      const p = vlerp(CAT_SEAT, lapW, ck); p.y += Math.sin(cl * Math.PI) * .16; cpos = p;
      crot = lerp(CAT_ROT, CAT_ROT + .5, ck); c.scoot = bump(t, EV.climb, EV.circle); c.lean = .6 * bump(t, EV.climb, EV.circle);
      c = mix(c, { ...catAim(lapW), happy: 0, wide: .3 }, 1);
    }
    if (t > EV.circle) { const k = eio(seg(t, EV.circle, EV.lieDown)); crot = CAT_ROT + .5 + k * Math.PI * 2; c.scoot = .5 * Math.abs(Math.sin(k * Math.PI * 3)); cpos = lapW.clone(); }
    if (t > EV.lieDown) { c = mix(c, { lie: 1, closed: 1, happy: 0, smile: .6, purr: 1, earPerk: 0, tailSwish: .2 }, eio(seg(t, EV.lieDown, EV.lieDown + .7))); crot = CAT_ROT + .5 + Math.PI * 2 - .5 * seg(t, EV.lieDown, EV.lieDown + .7); }
    if (t > EV.climb + .4) n.hold = seg(t, EV.lieDown - .3, EV.lieDown + .5) * .8;
  }
  if (t >= SH.S11) {
    // кот на коленях до конца
    const lapW = neuro.group.localToWorld(neuro.lapLocal.clone());
    cpos = lapW; crot = CAT_ROT + Math.PI * 2;
    c = { ...c, lie: 1, closed: 1, smile: .5, purr: 1, earPerk: 0, tailSwish: .2, talk: pk, blink: 0, headTurn: 0, nod: 0, look: [0, 0] };
    if (speaking(t, 'p7') || speaking(t, 'p8')) c = mix(c, { lid: .85, closed: 0 }, .9);
    n.hold = .8; n.warm = .85;
  }
  if (s === 'S11') {
    n = mix(n, { ...neuAim(mapW, .5), present: ramp(t, EV.ready - .1, EV.ready + .25, EV.noticeCat, EV.noticeCat + .3), happy: speaking(t, 'n8') && t < wordAt('n8', 1) ? .9 : 0, smile: .7, hold: 0 }, 1);
    if (t > EV.noticeCat) n = mix(n, { ...neuAim(cpos.clone().add(V(0, .08, 0))), glitch: ramp(t, EV.noticeCat + .25, EV.noticeCat + .35, EV.noticeCat + .7, EV.noticeCat + .8), wide: .8, smile: 0, puzzled: .4, hold: .6 }, seg(t, EV.noticeCat, EV.noticeCat + .35));
    if (t > EV.radLook) n = mix(n, { ...neuAim(radW), puzzled: .9, wide: .3 }, seg(t, EV.radLook, EV.radLook + .3) * (1 - seg(t, EV.radBack, EV.radBack + .35)));
    if (t > EV.radBack) n = mix(n, { ...neuAim(cpos.clone().add(V(0, .08, 0))), puzzled: .9 }, seg(t, EV.radBack, EV.radBack + .35));
  }
  if (s === 'S12' || s === 'END') {
    n = mix(n, { ...neuAim(cpos.clone().add(V(0, .08, 0))), puzzled: speaking(t, 'n9') ? .7 : .3, hold: .7 }, 1);
    if (t > EV.petStart) n = mix(n, { soft: 1, smile: .9, puzzled: 0, pet: 1, hold: .4 }, seg(t, EV.petStart, EV.petStart + .5));
    if (t > EV.petStart + .3) c = mix(c, { closed: 1, lid: 0, smile: .8 }, seg(t, EV.petStart + .3, EV.petStart + .7));
  }
  plush.group.position.copy(cpos); plush.group.rotation.y = crot;
  plush.pose(t, c); neuro.pose(t, n);
  plush.group.updateMatrixWorld(true); neuro.group.updateMatrixWorld(true);
  return { c, n };
}

// ——— голограммы ———
function holograms(t) {
  const s = shotOf(t);
  // ползунок: появляется в конце S1, живёт до S10
  let lv = 0, dots = 0, title = 0, sk = seg(t, EV.holoOn, EV.holoOn + .35) * (1 - seg(t, SH.S10 - .3, SH.S10)), sz = 1, pos = SL_POS.clone(), push = 0;
  if (t > EV.push) lv = 2 * eo(seg(t, EV.push, EV.push + .5));
  if (t > EV.uiFocus) { lv = lerp(2, 0, eio(seg(t, EV.uiFocus, EV.uiFocus + .4))); lv = lerp(lv, 2, eio(seg(t, EV.slideUp, EV.slideUp + 1.6))); dots = seg(t, EV.uiFocus + .2, EV.uiFocus + .5); }
  if (t > L0('n1') + .2) title = seg(t, L0('n1') + .2, L0('n1') + .5);
  // S5: интерфейс становится компактным
  if (t > SH.S5) { pos = vlerp(SL_POS, SL_POS.clone().add(V(.02, -.03, .02)), seg(t, SH.S5, SH.S5 + .4)); sz = lerp(1, .72, eio(seg(t, SH.S5, SH.S5 + .5))); dots *= 1 - seg(t, SH.S5, SH.S5 + .3); lv = 1; }
  if (t > SH.S8 - .2) { lv = lerp(.5, 2, eo(seg(t, EV.maxPush, EV.maxPush + .35))); push = bump(t, EV.maxPush + .3, EV.maxPush + .7); sz = lerp(.72, 1, seg(t, SH.S8 - .2, SH.S8)) * (1 - seg(t, EV.bigOn, EV.bigOn + .4) * .25); dots = seg(t, EV.maxPush + .3, EV.maxPush + .6); }
  if (t > SH.S9) { sk *= 1 - seg(t, SH.S9, SH.S9 + .3); }
  if (s === 'S4') sk *= 1 - seg(t, SH.S4, SH.S4 + .3) * (1 - seg(t, SH.S5 - .3, SH.S5));
  if (s === 'S6' || s === 'S7') sk *= 1 - seg(t, SH.S6, SH.S6 + .3) * (1 - seg(t, SH.S8 - .4, SH.S8 - .1));
  drawSlider(t, { lv, dots, title, push }); place(slider, pos, sk, camera, 0, 1, sz);
  // значки «простой / сложная»
  const ik = seg(t, EV.simple - .2, EV.simple + .1) * (1 - seg(t, SH.S6 - .25, SH.S6));
  if (ik > 0) { drawIcons(t, { l: seg(t, EV.simple, EV.simple + .5), r: seg(t, EV.complex, EV.complex + .9) }); }
  place(icons, ICON_POS, ik, camera, 0, ik, 1.4);
  // карта
  const vs = vacState(t);
  let mk = 0, st = { vacX: vs.x, vacBeep: vs.beep };
  if (s === 'S7') { mk = seg(t, SH.S7, SH.S7 + .4); st.routes = { A: seg(t, EV.rA, EV.rA + .8), B: seg(t, EV.rB, EV.rB + .8), C: seg(t, EV.rC, EV.rC + 1.1) }; st.marks = { A: seg(t, EV.rA + .8, EV.rA + 1.0), B: seg(t, EV.rB + .8, EV.rB + 1.0), C: seg(t, EV.rC + 1.1, EV.rC + 1.4) }; }
  if (s === 'S8') mk = 1 - seg(t, SH.S8 - .05, SH.S8 + .1);
  if (s === 'S9' || s === 'S10') { mk = seg(t, SH.S9 - .1, SH.S9 + .3); st.routes = { A: 1, B: 1, C: 1 }; st.marks = { A: 1, B: 1, C: 1 }; st.dim = { A: 1, B: 1 }; st.scout = ((t - SH.S9) * .12) % 1; }
  if (s === 'S11') {
    mk = 1; st.routes = { A: 0, B: 0, C: 1 }; st.marks = { C: 1 }; st.frozen = t > EV.ready;
    const frozenT = Math.min(t, EV.noticeCat + .3); st.scout = clamp((frozenT - EV.ready) / 3.6); st.vacX = vacState(frozenT).x;
    mk *= 1 - seg(t, EV.radCut - .05, EV.radCut) * 0;   // остаётся висеть, но замирает
    if (t > EV.noticeCat + .3) st.catOnSofa = false;
    mk *= 1 - seg(t, SH.S12 - .4, SH.S12);
  }
  let mpos = MAP_POS, msc = 1, mtilt = -.35;
  if (s === 'S7') msc = 1.02;
  if (s === 'S9') msc = 1.05;
  if (s === 'S9') mk *= 1 - seg(t, EV.notice - .1, EV.notice + .15);
  if (s === 'S10') mk = 0;
  if (s === 'S11' || s === 'S12') { mpos = MAP_POS_UP; msc = .62; mtilt = 0; }
  if (mk > 0) drawMap(s === 'S11' && t > EV.noticeCat + .3 ? EV.noticeCat + .3 : t, st, s === 'S11' && t > EV.noticeCat + .3 ? .75 + .25 * Math.sin(t * 30) * (t < EV.noticeCat + .7 ? 1 : 0) : 1);
  place(map, mpos, mk, camera, mtilt, mk, msc);
  // большая схема
  const bk = seg(t, EV.bigOn, EV.bigOn + .5) * (1 - seg(t, SH.S9 - .3, SH.S9));
  if (bk > 0) drawBig(t, { grow: seg(t, EV.bigOn + .2, EV.beep2 + .9), scout: clamp((t - EV.bigOn - .4) / 2.6), vacX: vs.x, vacBeep: vs.beep });
  place(big, BIG_POS, bk, camera, 0, bk);
  // время, ресурсы, проверка
  const ck = seg(t, EV.clock - .2, EV.clock + .1) * (1 - seg(t, SH.S10 + .4, SH.S10 + .8));
  if (ck > 0) drawCost(t, { clock: seg(t, EV.clock, EV.clock + .4), res: seg(t, EV.res, EV.res + .4), check: seg(t, EV.check, EV.check + .4) });
  place(cost, COST_POS, ck, camera, 0, ck, 1.35);
}

// ——— камера ———
// ключи: [время, позиция, точка взгляда, fov]; между ключами — плавная интерполяция
function track(t, keys) {
  if (t <= keys[0][0]) return keys[0];
  for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) { const a = keys[i - 1], b = keys[i], k = eio(seg(t, a[0], b[0])); return [t, vlerp(a[1], b[1], k), vlerp(a[2], b[2], k), lerp(a[3], b[3], k)]; }
  return keys[keys.length - 1];
}
const P2 = { pos: V(-.02, .84, 2.15), look: V(-.02, .74, .05) };     // общий двуплан спереди
function camKeys(t) {
  const s = shotOf(t);
  const catH = () => plush.headWorld(), neuH = () => neuro.headWorld();
  if (s === 'S1') {
    if (t < EV.cut1) return track(t, [[0, V(.32, 1.42, 3.55), V(.36, 1.55, 4.6), 34], [EV.cut1, V(.3, 1.12, 3.3), V(.35, .78, 4.55), 38]]);
    return track(t, [[EV.cut1, V(.85, 1.42, 3.85), V(-.12, .6, .1), 36], [5.2, V(.15, 1.0, 2.85), V(-.03, .74, .06), 35], [SH.S2, V(.06, .97, 2.7), V(-.02, .76, .06), 35]]);
  }
  if (s === 'S2') {
    if (t < EV.push - .45) return track(t, [[SH.S2, V(-.02, .97, 2.7), V(-.02, .77, .06), 35], [EV.push - .45, V(-.05, .93, 2.35), V(-.05, .74, .1), 35]]);
    if (t < EV.gaze) return track(t, [[EV.push - .45, V(-.04, .8, 1.62), V(-.05, .64, .15), 34], [EV.gaze, V(-.04, .79, 1.5), V(-.05, .64, .15), 34]]);
    return track(t, [[EV.gaze, V(-.02, .97, 2.5), V(.0, .8, .06), 35], [SH.S3, V(-.02, .98, 2.4), V(.0, .81, .06), 35]]);
  }
  if (s === 'S3') {
    const h = neuH();
    if (t < EV.uiFocus) return track(t, [[SH.S3, h.clone().add(V(-.18, .02, 1.0)), h.clone().add(V(-.02, -.06, 0)), 34], [EV.uiFocus, h.clone().add(V(-.2, 0, .9)), h.clone().add(V(-.02, -.07, 0)), 34]]);
    if (t < EV.earsDown - .1) return track(t, [[EV.uiFocus, SL_POS.clone().add(V(-.05, .17, 1.2)), SL_POS.clone().add(V(0, .07, 0)), 35], [EV.earsDown - .1, SL_POS.clone().add(V(-.03, .19, 1.3)), SL_POS.clone().add(V(0, .09, 0)), 35]]);
    return track(t, [[EV.earsDown - .1, V(-.02, .96, 2.6), V(-.02, .78, .06), 35], [SH.S4, V(-.02, .96, 2.45), V(-.02, .78, .06), 35]]);
  }
  if (s === 'S4') { const h = CAT_SEAT.clone().add(V(0, .22, .02)); return track(t, [[SH.S4, h.clone().add(V(.2, .07, .86)), h.clone().add(V(.02, .02, 0)), 34], [SH.S5, h.clone().add(V(.18, .07, .76)), h.clone().add(V(.02, .02, 0)), 34]]); }
  if (s === 'S5') return track(t, [[SH.S5, V(-.02, 1.0, 2.75), V(-.02, .86, .06), 36], [L1('n4'), V(-.02, .98, 2.55), V(-.02, .84, .06), 36], [SH.S6, V(-.12, .76, 1.2), V(-.16, .66, .08), 34]]);
  if (s === 'S6') {
    if (t < EV.pathEnd) return track(t, [[SH.S6, V(-.2, 1.35, .75), V(.0, .05, 2.8), 44], [EV.pathEnd, V(-.12, 1.2, 1.15), V(.15, .12, 3.4), 44]]);
    if (t > EV.beep1 && t < EV.vacEnd) { const v = vacState(t); return [t, V(v.x - .55, .22, VAC_Z - .7), V(v.x, .07, VAC_Z), 40]; }
    { const h = CAT_SEAT.clone().add(V(0, .22, .02)); return track(t, [[EV.pathEnd, h.clone().add(V(.16, .06, .9)), h.clone().add(V(.02, -.03, 0)), 34], [SH.S7, h.clone().add(V(.14, .06, .8)), h.clone().add(V(.02, -.03, 0)), 34]]); }
  }
  if (s === 'S7') return track(t, [[SH.S7, V(.04, 1.12, 2.35), V(.02, .78, .1), 36], [EV.rC, V(.0, 1.15, 2.2), V(.0, .74, .2), 36], [SH.S8, V(-.02, 1.15, 2.15), V(.0, .73, .2), 36]]);
  if (s === 'S8') {
    if (t < EV.maxPush + .55) { const sp = SL_POS.clone().add(V(.02, -.03, .02)); return track(t, [[SH.S8, sp.clone().add(V(-.1, .08, .66)), sp.clone().add(V(-.03, .01, 0)), 32], [EV.maxPush + .55, sp.clone().add(V(-.02, .07, .6)), sp.clone().add(V(.05, .01, 0)), 32]]); }
    if (t < EV.bigOn) { const h = CAT_SEAT.clone().add(V(0, .22, .02)); return track(t, [[EV.maxPush + .55, h.clone().add(V(.18, .05, .8)), h.clone().add(V(.03, -.02, 0)), 34], [EV.bigOn, h.clone().add(V(.16, .05, .72)), h.clone().add(V(.03, -.02, 0)), 34]]); }
    return track(t, [[EV.bigOn, V(-.02, .95, 1.9), V(-.02, .9, .0), 38], [EV.bigOn + 1.2, V(-.02, 1.05, 2.75), V(-.02, 1.1, -.05), 40], [SH.S9, V(-.02, 1.05, 2.85), V(-.02, 1.1, -.05), 40]]);
  }
  if (s === 'S9') {
    if (t < EV.notice) return track(t, [[SH.S9, V(-.02, 1.08, 2.6), V(-.02, .86, .1), 36], [EV.notice, V(-.02, 1.05, 2.45), V(-.02, .84, .1), 36]]);
    return track(t, [[EV.notice, V(.3, .8, 1.08), V(-.1, .65, .1), 33], [SH.S10, V(.36, .75, .9), V(-.11, .64, .1), 32]]);
  }
  if (s === 'S10') {
    if (t < EV.climb) return track(t, [[SH.S10, V(.36, .75, .9), V(-.11, .64, .1), 32], [EV.climb, V(.32, .74, .82), V(-.09, .64, .1), 32]]);
    return track(t, [[EV.climb, V(-.1, .9, 1.72), V(-.02, .72, .08), 35], [EV.circle, V(-.06, .9, 1.62), V(.08, .72, .08), 35], [SH.S11, V(-.04, .9, 1.55), V(.1, .72, .08), 35]]);
  }
  if (s === 'S11') {
    if (t > EV.radCut && t < EV.radBack) return track(t, [[EV.radCut, V(.15, .72, 1.6), V(RADIATOR.x, .5, RADIATOR.z), 30], [EV.radBack, V(.16, .72, 1.75), V(RADIATOR.x, .5, RADIATOR.z), 28]]);
    return track(t, [[SH.S11, V(.0, 1.02, 2.2), V(.04, .82, .1), 35], [EV.noticeCat, V(.02, .98, 1.95), V(.06, .8, .1), 35], [SH.S12, V(.03, .96, 1.8), V(.08, .78, .1), 34]]);
  }
  // S12 и финал: близко на обоих, потом лёгкий отъезд
  return track(t, [[SH.S12, V(.03, .95, 1.5), V(.12, .74, .1), 34], [EV.petStart, V(.03, .95, 1.42), V(.12, .74, .1), 34], [ST.dur, V(-.02, 1.05, 2.3), V(.08, .8, .1), 35]]);
}
const shake = (t, a, f = 22) => V(vn(t * f + 1) * a, vn(t * f + 9) * a, vn(t * f + 17) * a * .5);
function cam(t) {
  const [, P, L, fov] = camKeys(t);
  camera.fov = fov; camera.updateProjectionMatrix();
  let jolt = 0;
  if (t > EV.beep1 + .1 && t < EV.beep1 + .5) jolt = .006;
  if (t > EV.beep2 + .1 && t < EV.beep2 + .5) jolt = .006;
  if (t > EV.maxPush + .3 && t < EV.maxPush + .6) jolt = .004;
  camera.position.copy(P).add(shake(t, jolt)).add(V(vn(t * .45) * .004, vn(t * .38 + 5) * .003, 0));   // «ручная» камера
  camera.lookAt(L);
}

// ——— проекция ———
const proj = p => { const v = p.clone().project(camera); return { x: (v.x + 1) / 2 * W, y: (1 - v.y) / 2 * H, z: v.z }; };

// ——— 2D-слой ———
function overlay(t) {
  finish(t, { vig: .5, warm: .1 });
  const s = shotOf(t);
  // название на дожде
  if (t < EV.cut1 + .1) {
    let a = inOut(t, .25, EV.cut1, .3, .15); txt('ТЫ ДУМАЕШЬ', W / 2, 560 + a.y, { size: 104, font: 'Unbounded', fill: '#ffffff', lw: 22, scale: a.k, alpha: a.a });
    a = inOut(t, .55, EV.cut1, .3, .15); txt('ИЛИ ЗАВИСЛА?', W / 2, 700 + a.y, { size: 96, font: 'Unbounded', fill: '#8fe3ff', lw: 22, scale: a.k, alpha: a.a, rot: -.03 });
  }
  // «БИП!» пылесоса
  for (const b of [EV.beep1, EV.beep2]) if (t > b && t < b + .7) {
    const vp = shotOf(t) === 'S6' && t < EV.vacEnd ? { x: W * .55, y: H * .42 } : { x: W * .76, y: H * .2 };
    txt('БИП!', vp.x, vp.y, { size: 110, font: 'Unbounded', fill: '#ff5c7a', lw: 22, scale: back(seg(t, b, b + .18)) * (1 + .05 * Math.sin(t * 40)), alpha: 1 - seg(t, b + .5, b + .7), rot: -.1 });
  }
  // мурчание
  if (t > EV.lieDown && t < SH.S11 + .5) { const p = proj(plush.headWorld()); txt('мрр', p.x + 110, p.y - 120 - Math.sin(t * 2) * 10, { size: 54, fill: '#ffc46b', lw: 12, alpha: ramp(t, EV.lieDown + .3, EV.lieDown + .6, SH.S11 + .2, SH.S11 + .5), rot: .1 }); }
  // финальная надпись
  if (t > SH.END - .2) {
    let a = inOut(t, SH.END, ST.dur + 1, .35);
    txt('ВЫБИРАЙ', W / 2, 330 + a.y, { size: 96, font: 'Unbounded', fill: '#fff', lw: 22, scale: a.k, alpha: a.a });
    a = inOut(t, SH.END + .25, ST.dur + 1, .35); txt('УРОВЕНЬ РАССУЖДЕНИЯ', W / 2, 450 + a.y, { size: 50, font: 'Unbounded', fill: '#8fe3ff', lw: 18, scale: a.k, alpha: a.a });
    a = inOut(t, SH.END + .5, ST.dur + 1, .35); txt('ПОД ЗАДАЧУ', W / 2, 560 + a.y, { size: 96, font: 'Unbounded', fill: '#ffc46b', lw: 22, scale: a.k, alpha: a.a, rot: -.02 });
  }
  subtitles(t, ST.lines, 1520, { P: '#ffc46b', N: '#8fe3ff' });
}

// ——— сборка кадра ———
function scene3D(t) {
  updateRoom(t);
  const v = vacState(t); poseVacuum(t, v.x, VAC_Z, v.heading, v.beep);
  radiatorGlow.intensity = .05 + .01 * Math.sin(t * 2);
  // позы читают мировые матрицы друг друга (лапа к ручке ползунка, к боку Нейро; камера к головам),
  // поэтому два прохода: кадр не зависит от предыдущего (куски рендерятся параллельно и вразнобой)
  for (let i = 0; i < 2; i++) { cam(t); holograms(t); poses(t); scene.updateMatrixWorld(true); }
  cam(t); holograms(t);
  composer.render();
}
function renderAt(t) {
  cx.filter = 'saturate(1.12) contrast(1.05)';
  scene3D(t); cx.drawImage(renderer.domElement, 0, 0);
  cx.filter = 'none';
  overlay(t);
}
window.renderAt = renderAt;
window.frameJPEG = (t, q = .93) => { renderAt(t); return document.getElementById('out').toDataURL('image/jpeg', q); };
renderAt(0);
window.ready = true;
