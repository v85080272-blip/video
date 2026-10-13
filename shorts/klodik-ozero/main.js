// «Клодик и котик у озера» — Клодик объясняет котику, какой уровень рассуждения (effort) брать под задачу.
// Кадр — чистая функция времени t; тайминги реплик и кадров берутся из story.json (tts.py + layout.py).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { W, H, clamp, lerp, seg, ss, eio, eo, back, spring, V, vlerp, hash, vn, rng, gl, renderer, scene, camera, water, sky, flies, kitten, klod, poseKitten, poseKlod, PIER_Y, M, sph, mat, setRod, rod, kitRig, klodRig } from './scene.js';
import { makeRod, poseRod, makeFish, wiggleFish, makeSplash, poseSplash } from './props.js';
import { cx, txt, inOut, subtitles, effortPanel, finish, LEVELS, LEVEL_RU, LEVEL_COL } from './ui.js';

const ST = await (await fetch('story.json')).json();
const FPS = ST.fps, SH = ST.shots, LN = Object.fromEntries(ST.lines.map(l => [l.id, l]));
window.DUR = ST.dur;
const SHOTS = Object.keys(SH);
const shotOf = t => { let cur = 'S1'; for (const k of SHOTS) if (t >= SH[k]) cur = k; return cur; };
const L0 = id => LN[id].t0, L1 = id => LN[id].t0 + LN[id].d;
const during = (t, a, b) => t >= a && t < b;

// ——— ключевые моменты ———
const EV = {
  pull: SH.S2 + .1, popAt: SH.S2 + .35,
  castLow: SH.S4 + .15, catchLow: SH.S4 + .95,
  castMed: SH.S5 + .1, catchMed: SH.S5 + .85,
  redSpike: L0('k9') + .5, raise: L0('k9') + 1.3, checks: L0('k10') + .1,
  stand: SH.S7 + .1, dive: L0('k12') - .15, surface: L1('k12') + .15,
  castPuddle: SH.S8 + .35, palm: L0('k13'), punch: L0('k14') - .02,
  jump: L0('c7') + LN.c7.d * .72, gears: L0('c8') + .9, deadpan: L0('k15') - .15,
};

// ——— постобработка ———
const composer = new EffectComposer(renderer);
composer.setPixelRatio(1); composer.setSize(W, H);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), .3, .5, .97));
composer.addPass(new OutputPass());

function speech(who, t) {
  for (const L of ST.lines) {
    if (L.who !== who || !L.env || !L.env.length) continue;
    const i = Math.floor((t - L.t0) * FPS);
    if (i >= 0 && i < L.env.length) { const a = L.env[i], b = L.env[i + 1] ?? 0, k = (t - L.t0) * FPS - i; return clamp(lerp(a, b, k) * 1.2); }
  }
  return 0;
}

// ——— ведёрко с рыбкой ———
const BUCKET = V(.0, PIER_Y, -.1);
{
  const g = new THREE.Group(); g.position.copy(BUCKET); scene.add(g);
  const m = new THREE.MeshStandardMaterial({ color: 0xa9bccb, metalness: .55, roughness: .35, side: THREE.DoubleSide });
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(.1, .08, .15, 28, 1, true), m); wall.position.y = .075; wall.castShadow = true; g.add(wall);
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(.08, 24), m); bottom.rotation.x = -Math.PI / 2; bottom.position.y = .004; g.add(bottom);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(.1, .007, 8, 32), m); rim.rotation.x = Math.PI / 2; rim.position.y = .15; g.add(rim);
  const wv = new THREE.Mesh(new THREE.CircleGeometry(.096, 28), M(0x3d9fd6, { roughness: .1, emissive: 0x0c3048 })); wv.rotation.x = -Math.PI / 2; wv.position.y = .12; g.add(wv);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(.1, .005, 6, 24, Math.PI), m); handle.position.y = .15; handle.rotation.y = .5; g.add(handle);
}
const goldfish = makeFish(0xff8a2a, 0xffe2b0); goldfish.scale.setScalar(.42);

// ——— лужа на мостках ———
const PUDDLE = V(-1.02, PIER_Y + .004, -.05);
const puddle = new THREE.Mesh(new THREE.CircleGeometry(.17, 32), new THREE.MeshStandardMaterial({ color: 0x8fc4e8, roughness: .05, metalness: .3, emissive: 0x4a6f90, emissiveIntensity: .5 }));
puddle.rotation.x = -Math.PI / 2; puddle.scale.set(1.4, 1, 1); puddle.position.copy(PUDDLE); scene.add(puddle);

// ——— башня мыслей над Клодиком ———
const tower = new THREE.Group(); scene.add(tower);
const bubM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .3, emissive: 0x9a8aa0, emissiveIntensity: .35 });
const gearM = M(0xffc94a, { metalness: .7, roughness: .3 });
function makeGear(r, teeth = 8) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.TorusGeometry(r, r * .28, 8, 24), gearM));
  for (let i = 0; i < teeth; i++) { const a = i / teeth * Math.PI * 2, tt = new THREE.Mesh(new THREE.BoxGeometry(r * .42, r * .45, r * .35), gearM); tt.position.set(Math.cos(a) * r * 1.3, Math.sin(a) * r * 1.3, 0); tt.rotation.z = a; g.add(tt); }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * .32, r * .32, r * .4, 12), gearM); hub.rotation.x = Math.PI / 2; g.add(hub);
  g.traverse(o => o.castShadow = true); scene.add(g); return g;
}
const TB = [[0, 0, .03], [.035, .08, .045], [-.02, .19, .07], [.05, .36, .12], [-.06, .58, .14], [.06, .82, .15], [-.04, 1.06, .16]];
const bubbles = TB.map(([x, y, r]) => { const b = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), bubM); b.castShadow = true; b.userData = { x, y, r }; tower.add(b); return b; });
const tGears = [[.19, .46, .065], [-.2, .7, .06], [.19, .95, .055], [-.13, 1.25, .05]].map(([x, y, r]) => { const g = makeGear(r); scene.remove(g); g.position.set(x, y, .06); tower.add(g); return g; });
const TOWER_AT = V(.37, PIER_Y + .58, .04);

// ——— глаза-спиральки ———
const spiralTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.beginPath(); x.arc(64, 64, 61, 0, 7); x.fill();
  x.strokeStyle = '#1a1210'; x.lineWidth = 8; x.lineCap = 'round'; x.beginPath();
  for (let a = 0; a < 6 * Math.PI; a += .08) { const r = 4 + a * 3; x.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); } x.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const spirals = [-1, 1].map(s => { const m = new THREE.Mesh(new THREE.CircleGeometry(.07, 32), new THREE.MeshBasicMaterial({ map: spiralTex, transparent: true })); m.position.set(s * .11, .36, .187); klodRig.kd.add(m); return m; });

// ——— удочки: стойка за спинами ———
const RODS = [
  { lv: 'low', len: .6, col: 0x55d16a, th: 1 }, { lv: 'medium', len: .85, col: 0x4aa3ff, th: .85 },
  { lv: 'high', len: 1.05, col: 0xff5050, th: 1 }, { lv: 'xhigh', len: 1.3, col: 0xffa040, th: 1.2 }, { lv: 'max', len: 1.75, col: 0x9b5cff, th: 1.6 },
];
RODS.forEach((r, i) => { r.rod = makeRod(r.len, r.col); r.rod.thick = r.th; r.rackHand = V([-.95, -.65, 0, .65, .92][i], PIER_Y + .03, -.52); r.rackDir = V(-(i - 2) * .03, 1, -.2); });
{
  const wm = M(0x7a4e2c, { roughness: .8 });
  const rail = new THREE.Mesh(new THREE.BoxGeometry(1.9, .05, .06), wm); rail.position.set(0, PIER_Y + .2, -.56); rail.castShadow = true; scene.add(rail);
  [-.95, .95].forEach(x => { const p = new THREE.Mesh(new THREE.BoxGeometry(.06, .22, .06), wm); p.position.set(x, PIER_Y + .1, -.56); p.castShadow = true; scene.add(p); });
}
// подставка для большой удочки
const STAND_TOP = V(.85, PIER_Y + .32, .08);
const stand = new THREE.Group(); scene.add(stand);
{ const sm = M(0x5a3a22, { roughness: .9 }); [[-.12, -.02], [.12, -.02], [0, .12]].forEach(([x, z]) => { const r = rod(sm); setRod(r, STAND_TOP, V(STAND_TOP.x + x, PIER_Y, STAND_TOP.z + z - .06), .012); stand.add(r); }); }
const P_LOW = V(1.0, .01, .85), P_MED = V(.32, .01, 1.45), P_MAX = V(.05, .01, 3.0);

// ——— рыбы ———
const minnow = makeFish(0xa8e6cf, 0xffffff); minnow.scale.setScalar(.32);
const perch = makeFish(0x8fbf3a, 0xf3f0c0); perch.scale.setScalar(.75);
const puffer = new THREE.Group(); scene.add(puffer);
const SPIKES = []; let RED = 0, SKIP = -1;
{
  const body = sph(.1, M(0xffd84a, { roughness: .45 }), 32, 22); puffer.add(body);
  const bel = sph(.09, M(0xfff4c8, { roughness: .6 }), 24, 16); bel.position.set(0, -.025, .02); bel.scale.set(1, .8, .9); puffer.add(bel);
  [-1, 1].forEach(s => { const e = sph(.026, mat.white, 14, 10); e.position.set(s * .045, .035, .085); puffer.add(e); const p = sph(.014, mat.pupil, 10, 8); p.position.set(s * .047, .036, .108); puffer.add(p); });
  const lips = sph(.018, M(0xff8a7a), 12, 8); lips.position.set(0, -.015, .1); lips.scale.set(1.2, .8, .8); puffer.add(lips);
  const spM = M(0xe0a020, { roughness: .5 }), cone = new THREE.ConeGeometry(.012, .05, 8);
  const N = 22;
  for (let i = 0; i < N; i++) {   // точки по сфере (спираль Фибоначчи), кроме морды
    const y = 1 - (i + .5) / N * 2, r = Math.sqrt(1 - y * y), a = i * 2.39996;
    const n = V(Math.cos(a) * r, y, Math.sin(a) * r);
    if (n.z > .75 && Math.abs(n.y) < .5) continue;
    const c = new THREE.Mesh(cone, spM); c.position.copy(n.clone().multiplyScalar(.105)); c.quaternion.setFromUnitVectors(V(0, 1, 0), n); c.castShadow = true; puffer.add(c);
    SPIKES.push({ n, c });
  }
  let best = -9; SPIKES.forEach((sp, i) => { const d = sp.n.dot(V(-.45, .55, .7).normalize()); if (d > best) { best = d; RED = i; } });
  best = -9; SPIKES.forEach((sp, i) => { const d = sp.n.dot(V(.55, -.35, .75).normalize()); if (i !== RED && d > best) { best = d; SKIP = i; } });   // одну колючку оставляем без галочки: проверок больше, но не все
}
// лупа
const loupe = new THREE.Group(); scene.add(loupe);
{
  const rimL = new THREE.Mesh(new THREE.TorusGeometry(.065, .009, 10, 32), M(0x333333, { metalness: .6, roughness: .3 })); loupe.add(rimL);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(.062, 32), new THREE.MeshStandardMaterial({ color: 0xcfefff, transparent: true, opacity: .25, roughness: 0, metalness: .2 })); loupe.add(glass);
  const hdl = new THREE.Mesh(new THREE.CylinderGeometry(.012, .014, .1, 10), M(0x7a3a1a)); hdl.position.set(0, -.115, 0); loupe.add(hdl);
}
// всплески
const spLow = makeSplash(16), spMed = makeSplash(20), spDive = makeSplash(26), spPud = makeSplash(12), spJump = makeSplash(14);

// ——— подводный мир ———
const under = new THREE.Group(); scene.add(under);
const CHEST = V(.1, -2.9, 3.5);
const chestLight = new THREE.PointLight(0xffc14a, 0, 3.2, 1.5); chestLight.position.copy(CHEST).add(V(0, .45, .3)); under.add(chestLight);
{
  const fl = new THREE.PlaneGeometry(26, 26, 40, 40); fl.rotateX(-Math.PI / 2);
  { const p = fl.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, Math.sin(p.getX(i) * 1.3) * Math.cos(p.getZ(i) * 1.1) * .08); fl.computeVertexNormals(); }
  const floor = new THREE.Mesh(fl, M(0xc9b27a, { roughness: 1 })); floor.position.set(0, -3, 4); floor.receiveShadow = true; under.add(floor);
  const r = rng(77);
  for (let i = 0; i < 26; i++) { const s = .1 + r() * .35, o = sph(s, M(new THREE.Color().setHSL(.08, .1, .3 + r() * .2), { roughness: .9, flatShading: true }), 7, 5); o.position.set(CHEST.x + (r() - .5) * 6, -3 + s * .3, CHEST.z + (r() - .3) * 5); o.scale.y = .6; under.add(o); }
  const weedM = M(0x3f8f4a, { roughness: .7 });
  for (let i = 0; i < 40; i++) { const h = .4 + r() * 1.2, w = new THREE.Mesh(new THREE.CylinderGeometry(.012, .02, h, 5), weedM); w.position.set(CHEST.x + (r() - .5) * 5, -3 + h / 2, CHEST.z + (r() - .3) * 4); w.userData.ph = r() * 7; w.userData.h = h; under.add(w); }
  // сундук
  const ch = new THREE.Group(); ch.position.copy(CHEST); ch.rotation.y = -.4; under.add(ch);
  const wood = M(0x6b3e1f, { roughness: .8 }), gold = new THREE.MeshStandardMaterial({ color: 0xffc94a, metalness: .8, roughness: .25, emissive: 0x6a4200, emissiveIntensity: .6 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(.6, .32, .4), wood); base.position.y = .16; ch.add(base);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(.2, .2, .6, 20, 1, false, 0, Math.PI), wood); lid.rotation.z = Math.PI / 2; lid.rotation.y = Math.PI / 2; lid.position.y = .32; lid.rotation.order = 'YZX'; ch.add(lid);
  [-.2, .2].forEach(x => { const b = new THREE.Mesh(new THREE.BoxGeometry(.05, .33, .42), gold); b.position.set(x, .165, 0); ch.add(b); });
  const lock = new THREE.Mesh(new THREE.BoxGeometry(.1, .12, .04), gold); lock.position.set(0, .3, .21); ch.add(lock);
  const shackle = new THREE.Mesh(new THREE.TorusGeometry(.035, .01, 8, 16, Math.PI), gold); shackle.position.set(0, .36, .21); ch.add(shackle);
  under.userData.lockPos = CHEST.clone().add(V(0, .36, .2));
}
const surf = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshBasicMaterial({ color: 0x9fe8f2, transparent: true, opacity: .85, fog: false, side: THREE.BackSide }));
surf.rotation.x = -Math.PI / 2; surf.position.y = -.004; under.add(surf);
const uBubbles = Array.from({ length: 24 }, (_, i) => { const b = new THREE.Mesh(new THREE.SphereGeometry(.015 + hash(i) * .02, 10, 8), new THREE.MeshStandardMaterial({ color: 0xe8fbff, transparent: true, opacity: .6, roughness: 0 })); under.add(b); return b; });
const underLine = rod(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .9, fog: false })); under.add(underLine);
const airFog = scene.fog, waterFog = new THREE.Fog(0x1f7488, .3, 7.5), waterBg = new THREE.Color(0x1f7488);

// ——— шестерёнки над котиком в финале ———
const kGears = [0, 1, 2].map(i => makeGear(.05 - i * .006));

// ——— позы персонажей ———
const blinkAt = (t, seed) => { const p = 2.6 + hash(seed) * 1.4, ph = (t + hash(seed + 3) * 3) % p; return ph < .11; };
function poses(t) {
  const s = shotOf(t), ck = speech('C', t), kk = speech('K', t);
  const k = { talk: ck, blink: blinkAt(t, 1), look: [.6, 0], headTurn: .25 };
  const c = { talk: kk, blink: blinkAt(t, 2), look: [-.4, 0] };
  if (s === 'S1') {
    Object.assign(k, { look: [.9, .15], headTurn: .4, tilt: -.08, ear: 1, earBack: .2, pawUp: .35 + .25 * Math.sin(t * 9) });
    Object.assign(c, { tilt: Math.sin(t * 3) * .06, look: [0, .3] });
  }
  if (s === 'S2') {
    const pull = seg(t, EV.pull - .15, EV.pull + .2) * (1 - seg(t, EV.pull + .7, EV.pull + 1));
    Object.assign(k, { pawUp: pull, look: [.7, pull * .6], tilt: t > L0('c2') - .1 && t < L1('c2') + .3 ? .22 : .05, headTurn: .35 });
    c.hop = Math.max(0, Math.sin(seg(t, EV.popAt + .4, EV.popAt + .8) * Math.PI)) * .6;
    if (t > EV.popAt + .3 && t < EV.popAt + .45) c.blink = true;
  }
  if (s === 'S3') {
    Object.assign(k, { lookUp: .5, look: [0, .7], happy: t > L0('k5') ? .8 : 0, headTurn: -.1 });
    Object.assign(c, { wave: t > L0('k5') && t < L1('k5'), look: [-.5, .3], happy: t > L1('k5') ? .6 : 0 });
  }
  if (s === 'S4') {
    const caught = t > EV.catchLow + .45;
    Object.assign(k, { paws2: seg(t, EV.catchLow + .1, EV.catchLow + .4) * .75, look: caught ? [.1, -.8] : [.8, 0], nod: caught ? .3 : 0, headTurn: caught ? .05 : .35, happy: t > L0('c3') - .1 ? .7 : 0, surprise: caught && t < EV.catchLow + .9 ? .6 : 0 });
    Object.assign(c, { look: [.4, -.2], happy: t > L1('k6') ? .5 : 0 });
  }
  if (s === 'S5') {
    Object.assign(k, { look: [.7, .2], tilt: t > L0('c4') && t < L1('c4') + .2 ? .2 : 0, headTurn: .3 });
    Object.assign(c, { look: [-.5, 0], happy: t > L0('k8') && t < L0('k8') + .7 ? .8 : 0, hop: t > L0('k8') && t < L0('k8') + .4 ? Math.sin(seg(t, L0('k8'), L0('k8') + .4) * Math.PI) * .5 : 0 });
  }
  if (s === 'S6') {
    Object.assign(k, { look: [.8, .1], headTurn: .4, surprise: t > EV.checks ? .2 : 0 });
    Object.assign(c, { look: [-.6, .2], tilt: t > EV.redSpike && t < EV.raise ? -.1 : 0 });
  }
  if (s === 'S7') {
    const asleep = t > L0('k12') + .3;
    Object.assign(k, { blink: asleep || k.blink, lid: asleep ? .9 : 0, tilt: asleep ? .28 : 0, nod: asleep ? .22 : 0, ear: 0, look: [.3, .4], swing: asleep ? .2 : 1 });
    Object.assign(c, { look: [0, .4], hop: t < EV.stand + .5 ? Math.sin(seg(t, EV.stand, EV.stand + .5) * Math.PI) * .4 : 0, blush: .4 });
  }
  if (s === 'S8') {
    const ang = t > L0('c6') - .1 && t < L1('c6') + .2;
    Object.assign(k, { paws2: .75, turn: -.35, headTurn: ang ? .5 : -.25, look: ang ? [.8, 0] : [-.8, -.5], earBack: ang ? .7 : 0, nod: ang ? 0 : .15 });
    Object.assign(c, { look: [-.7, -.1], happy: t > EV.punch + .2 ? .8 : 0, hop: t > EV.punch && t < EV.punch + .5 ? Math.sin(seg(t, EV.punch, EV.punch + .5) * Math.PI) * .5 : 0 });
  }
  if (s === 'S9' || s === 'END') {
    const peek = t < L0('c8') - .2;
    Object.assign(k, peek ? { headTurn: .55, nod: .35, look: [.5, -.8], happy: t > EV.jump - .1 && t < L1('c7') + .3 ? .8 : 0 } : { headTurn: .3, lookUp: .45, look: [.4, .7], lid: t > EV.gears - .3 ? .35 : 0, tilt: .18 });
    Object.assign(c, { look: [-.8, 0], turn: .15 });
  }
  if (s === 'END') { Object.assign(k, { headTurn: .05, lookUp: 0, look: [0, 0], lid: 0, happy: .7, tilt: .1, pawUp: .8 + .2 * Math.sin(t * 10) }); Object.assign(c, { look: [0, 0], happy: .7, turn: .15, wave: true, hop: Math.max(0, Math.sin((t - SH.END) * 5)) * .25 }); }
  poseKitten(t, k); poseKlod(t, c);
  // глаза Клодика: спиральки в начале, «усталые» в финале
  const spin = t < EV.popAt + .25;
  spirals.forEach((m, i) => { m.visible = spin; m.rotation.z = t * 9 * (i ? 1 : -1); });
  klodRig.kdEyes.forEach(e => { e.visible = !spin; if (t > EV.deadpan && s === 'S9') e.scale.y *= .42; });
  // ладонь к лицу
  const palm = seg(t, EV.palm, EV.palm + .2) * (1 - seg(t, EV.punch - .1, EV.punch + .1));
  if (palm > 0) { const a = klodRig.kdArms[1].g; a.position.lerp(V(.13, .37, .2), palm); a.rotation.z = lerp(a.rotation.z, .3, palm); }
  // рука с удочкой чуть поднята
  if (['S4', 'S5', 'S6'].includes(s)) { const a = klodRig.kdArms[1].g; a.rotation.z = -.05 + Math.sin(t * 2) * .03; }
  kitten.updateMatrixWorld(true); klod.updateMatrixWorld(true);
}

// ——— удочки по времени ———
const handKlod = () => klodRig.kdArms[1].g.localToWorld(V(.07, 0, .05));
const handKit = () => { const a = new THREE.Vector3(), b = new THREE.Vector3(); kitRig.kPaws[0].p.getWorldPosition(a); kitRig.kPaws[1].p.getWorldPosition(b); return a.add(b).multiplyScalar(.5); };
function cast(tip, P, t, a, b) { const k = seg(t, a, b); if (k <= 0) return null; const p = vlerp(tip, P, eo(k)); p.y += Math.sin(k * Math.PI) * .35; return p; }
const floatY = t => .01 + Math.sin(t * 3) * .006;
let rodTips = [];
function poseRods(t) {
  const s = shotOf(t);
  RODS.forEach((r, i) => {
    let hand = r.rackHand, dir = r.rackDir, bob = null, bend = 0;
    if (i === 0 && s === 'S4') {
      hand = handKlod(); dir = V(.65, .7, .45);
      const tip = hand.clone().add(dir.clone().normalize().multiplyScalar(r.len));
      bob = cast(tip, P_LOW, t, EV.castLow, EV.castLow + .4);
      if (bob && t > EV.castLow + .4) { bob = P_LOW.clone(); bob.y = floatY(t) - (t > EV.catchLow - .2 && t < EV.catchLow + .1 ? .04 : 0); }
      bend = t > EV.catchLow - .1 && t < EV.catchLow + .3 ? .6 : 0;
    }
    if (i === 1 && s === 'S5') {
      hand = handKlod(); dir = V(-.15, .9, 1);
      const tip = hand.clone().add(dir.clone().normalize().multiplyScalar(r.len));
      bob = cast(tip, P_MED, t, EV.castMed, EV.castMed + .4);
      if (bob && t > EV.castMed + .4) { bob = P_MED.clone(); bob.y = floatY(t); }
      if (t > EV.catchMed) { const k = eo(seg(t, EV.catchMed, EV.catchMed + .45)); const hang = tip.clone().add(V(Math.sin(t * 2.3) * .04, -.32, 0)); bob = vlerp(P_MED, hang, k); bob.y += Math.sin(k * Math.PI) * .25; }
      bend = t > EV.catchMed - .05 && t < EV.catchMed + .5 ? .8 : .25 * seg(t, EV.catchMed, EV.catchMed + .3);
    }
    if (i === 2 && s === 'S6') {
      hand = handKlod(); dir = V(-.35, .75, .6);
      const tip = hand.clone().add(dir.clone().normalize().multiplyScalar(r.len));
      bob = tip.clone().add(V(Math.sin(t * 1.7) * .02, -.3, 0)); bend = .3;
    }
    if (i === 4 && s === 'S7') {
      const k = back(seg(t, EV.stand, EV.stand + .35));
      hand = vlerp(r.rackHand, STAND_TOP, k); dir = vlerp(r.rackDir, V(0, .7, 1), k);
      const tip = hand.clone().add(dir.clone().normalize().multiplyScalar(r.len));
      bob = cast(tip, P_MAX, t, EV.stand + .35, EV.stand + .9);
      if (bob && t > EV.stand + .9) { bob = P_MAX.clone(); bob.y = floatY(t); }
      bend = .15;
    }
    if (i === 4 && s === 'S8') {
      hand = handKit(); dir = V(-.85, .45, .2);
      const tip = hand.clone().add(dir.clone().normalize().multiplyScalar(r.len));
      bob = cast(tip, PUDDLE.clone().add(V(0, .01, 0)), t, EV.castPuddle, EV.castPuddle + .5);
      if (bob && t > EV.castPuddle + .5) { bob = PUDDLE.clone(); bob.y += .012; }
      bend = .45 + Math.sin(t * 7) * .04;
    }
    rodTips[i] = poseRod(r.rod, hand, dir, bob, bend);
    r.bob = bob;
  });
  stand.visible = s === 'S7';
}

// ——— реквизит по времени ———
function poseProps(t) {
  const s = shotOf(t);
  // рыбка в ведре
  const jk = seg(t, EV.jump, EV.jump + .55);
  goldfish.position.copy(BUCKET).add(V(0, .13 + Math.sin(t * 2.2) * .008 + Math.sin(jk * Math.PI) * .42, 0));
  goldfish.rotation.set(0, -Math.PI / 2 + .3, 1.25 - jk * 2.5 * (jk > 0 && jk < 1 ? 1 : 0)); wiggleFish(goldfish, t, .6);
  poseSplash(spJump, BUCKET.clone().add(V(0, .12, 0)), t - EV.jump - .45, .5);
  // башня мыслей
  const ta = TOWER_AT.clone(); tower.position.copy(ta); tower.rotation.set(0, -.3, Math.sin(t * 2.4) * .07);
  const onT = t < EV.popAt + .6;
  tower.visible = onT;
  bubbles.forEach((b, i) => {
    const grow = spring(seg(t, .05 + i * .12, .45 + i * .12)), popT = EV.popAt + (bubbles.length - 1 - i) * .055;
    const pk = seg(t, popT, popT + .07), sc = grow * (1 + .25 * Math.sin(pk * Math.PI)) * (pk >= 1 ? 0 : 1);
    b.scale.setScalar(Math.max(1e-4, sc * (1 + Math.sin(t * 5 + i) * .03))); b.position.set(b.userData.x + Math.sin(t * 2 + i) * .015 * i, b.userData.y, 0);
  });
  tGears.forEach((g, i) => {
    const grow = back(seg(t, .3 + i * .2, .6 + i * .2)), stop = seg(t, EV.popAt - .1, EV.popAt + .2), gone = seg(t, EV.popAt + .25, EV.popAt + .35);
    g.scale.setScalar(Math.max(1e-4, grow * (1 - gone))); g.rotation.z = (i % 2 ? -1 : 1) * (Math.min(t, EV.popAt + .2) * 4 - stop * .3);
  });
  // спрятать то, что не в кадре
  minnow.visible = s === 'S4' && t > EV.catchLow - .05;
  if (minnow.visible) {
    const k = seg(t, EV.catchLow, EV.catchLow + .5), land = handKit().add(V(0, .05, .02));
    const p = vlerp(P_LOW, land, eo(k)); p.y += Math.sin(k * Math.PI) * .45; minnow.position.copy(p);
    minnow.rotation.set(0, Math.PI / 2 + .6, k < 1 ? -1 + k * 7 : .2 + Math.sin(t * 6) * .1); wiggleFish(minnow, t, 1.4);
  }
  poseSplash(spLow, P_LOW, t - EV.catchLow, .7);
  perch.visible = s === 'S5' && t > EV.catchMed - .05;
  if (perch.visible) { const b = RODS[1].bob; perch.position.copy(b).add(V(0, -.14, 0)); perch.rotation.set(0, -.4, -Math.PI / 2 + Math.sin(t * 5) * .15); wiggleFish(perch, t, 1.2); }
  poseSplash(spMed, P_MED, t - EV.catchMed, 1);
  puffer.visible = s === 'S6';
  if (puffer.visible) {
    const b = RODS[2].bob; puffer.position.copy(b).add(V(0, -.12, 0)); puffer.rotation.set(Math.sin(t * 1.3) * .1, -.25 + Math.sin(t * .9) * .25, Math.sin(t * 1.7) * .08);
    puffer.scale.setScalar(1 + .06 * Math.sin(t * 3));
    // лупа скользит по колючкам
    const lk = seg(t, SH.S6 + .2, EV.checks + 2.2);
    loupe.visible = lk > 0 && lk < 1;
    const a = lk * Math.PI * 3; loupe.scale.setScalar(.75); loupe.position.copy(puffer.position).add(V(.05 + Math.cos(a) * .16, .02 + Math.sin(a * 1.3) * .1, .2)); loupe.rotation.set(0, Math.cos(a) * .3, .4);
  } else loupe.visible = false;
  // подводный мир
  spDive.g.visible = false;
}
function poseUnder(t) {
  under.visible = camera.position.y < .02;
  if (under.visible) {
    chestLight.intensity = 4 + Math.sin(t * 5) * .8;
    under.children.forEach(o => { if (o.userData.h) o.rotation.z = Math.sin(t * 1.4 + o.userData.ph) * .15; });
    uBubbles.forEach((b, i) => { const ph = (t * .5 + hash(i)) % 1; b.position.set(CHEST.x + (hash(i + 4) - .5) * .6 + Math.sin(t * 3 + i) * .03, -2.6 + ph * 2.6, CHEST.z + (hash(i + 9) - .5) * .4); });
    setRod(underLine, P_MAX.clone().add(V(0, -.01, 0)), under.userData.lockPos, .006);
  }
}
function poseLate(t) {
  const s = shotOf(t);
  poseSplash(spPud, PUDDLE, t - EV.castPuddle - .5, .45);
  // шестерёнки над котиком
  kGears.forEach((g, i) => {
    const a = EV.gears + i * .3, k = back(seg(t, a, a + .3)), on = s === 'S9' && t > a;
    g.visible = on; if (!on) return;
    g.position.copy(kitten.position).add(V(-.12 + i * .13, .98 + (i % 2) * .08, .05)); g.scale.setScalar(Math.max(1e-4, k)); g.rotation.set(0, .2, t * (3 + i) * (i % 2 ? -1 : 1));
  });
}

// ——— камера ———
function frame(T, h, dir, fov) { const d = h / 2 / Math.tan(fov * Math.PI / 360); return T.clone().add(dir.clone().normalize().multiplyScalar(d)); }
const shake = (t, a, f = 22) => V(vn(t * f + 1) * a, vn(t * f + 9) * a, vn(t * f + 17) * a * .5);
function cam(t) {
  const s = shotOf(t); let T, h, dir, fov = 36, look = null, P = null;
  let off = .1;   // сверху всегда текст: персонажи чуть ниже центра
  if (s === 'S1') { const k = eio(seg(t, 0, SH.S2)); T = V(.04, PIER_Y + .8, 0); h = lerp(2.75, 2.4, k); dir = V(.1, -.03, 1); off = 0; }
  else if (s === 'S2') { const k = eio(seg(t, SH.S2, SH.S3)); T = V(.02, PIER_Y + .5, 0); h = lerp(2.35, 2.6, k); dir = V(lerp(-.1, .1, k), .2, 1); }
  else if (s === 'S3') { const k = eio(seg(t, SH.S3, SH.S4)); T = V(0, PIER_Y + .75, -.25); h = lerp(3.3, 3.7, k); dir = V(lerp(-.3, .25, k), lerp(.25, .45, k), 1); fov = 38; }
  else if (s === 'S4') {
    const k = eio(seg(t, EV.catchLow + .05, EV.catchLow + .5));
    T = vlerp(V(.5, PIER_Y + .32, .45), V(.2, PIER_Y + .45, .2), k); h = lerp(1.55, 2.4, k); dir = V(lerp(.3, .1, k), .22, 1); off = .14;
    if (t < EV.catchLow) { const pk = seg(t, EV.catchLow - .25, EV.catchLow); h *= 1 - .12 * eo(pk); }
  }
  else if (s === 'S5') { const k = eio(seg(t, SH.S5, SH.S6)); T = V(.16, PIER_Y + .5, .3); h = lerp(2.45, 2.25, k); dir = V(.18, .16, 1); off = .13; }
  else if (s === 'S6') { const k = eio(seg(t, SH.S6, SH.S7)); T = (puffer.position.clone()).add(V(-.04, .02, 0)); h = lerp(.95, .8, k); dir = V(lerp(-.35, -.1, k), .1, 1); fov = 34; off = .14; }
  else if (s === 'S7') {
    if (t < EV.dive) { const k = eio(seg(t, SH.S7, EV.dive)); T = V(.2, PIER_Y + .35, .7); h = lerp(2.8, 3.9, k); dir = V(lerp(.35, .45, k), lerp(.35, .8, k), 1); fov = 40; off = .15; }
    else if (t < EV.surface) {
      const k = eio(seg(t, EV.dive, EV.dive + 1.1)), k2 = seg(t, EV.dive + 1.1, EV.surface);
      P = vlerp(V(CHEST.x + 1.3, 1.1, CHEST.z + 3.0), V(CHEST.x + 1.25, -2.0, CHEST.z + 2.5), k).add(V(-.1 * k2, -.05 * k2, -.25 * k2));
      look = vlerp(P_MAX, CHEST.clone().add(V(0, .3, 0)), ss(k)); fov = 42;
    }
    else { T = V(0, PIER_Y + .4, 0); h = 2.1; dir = V(.15, .22, 1); off = .08; }
  }
  else if (s === 'S8') {
    if (t < EV.palm) { T = V(-.55, PIER_Y + .42, -.05); h = 2.35; dir = V(.05, .38, 1); }
    else if (t < EV.punch) { const k = eio(seg(t, EV.palm, EV.punch)); T = V(.3, PIER_Y + .38, .04); h = lerp(1.3, 1.2, k); dir = V(-.25, .14, 1); }
    else { const k = eo(seg(t, EV.punch, EV.punch + .18)); T = V(.37, PIER_Y + .34, .04); h = lerp(1.25, 1.0, k); dir = V(-.12, .12, 1); off = .13; }
  }
  else if (s === 'S9') {
    if (t < EV.deadpan) { const k = eio(seg(t, SH.S9, EV.deadpan)); T = V(-.16, PIER_Y + .5, -.02); h = lerp(1.65, 1.5, k); dir = V(.22, .26, 1); }
    else { const k = eio(seg(t, EV.deadpan, SH.END)); T = V(.36, PIER_Y + .36, .04); h = lerp(1.2, 1.0, k); dir = V(-.4, .12, 1); off = .13; }
  }
  else { const k = eio(seg(t, SH.END, ST.dur)); T = V(.02, PIER_Y + .45, 0); h = lerp(2.7, 2.95, k); dir = V(lerp(-.08, .08, k), .22, 1); fov = 38; off = .02; }
  camera.fov = fov; camera.updateProjectionMatrix();
  if (!P) { T = T.clone().add(V(0, h * off, 0)); P = frame(T, h, dir, fov); }
  let jolt = 0;
  if (t > EV.punch && t < EV.punch + .4) jolt = .02 * (1 - seg(t, EV.punch, EV.punch + .4));
  if (t > EV.catchLow && t < EV.catchLow + .3) jolt = .008;
  camera.position.copy(P).add(shake(t, jolt).add(V(vn(t * .5) * .006, vn(t * .4 + 5) * .004, 0)));
  camera.lookAt(look || T);
  // под водой — туман и цвет воды
  const uw = camera.position.y < 0;
  scene.fog = uw ? waterFog : airFog; scene.background = uw ? waterBg : null; sky.visible = !uw;
  renderer.toneMappingExposure = s === 'END' ? .9 : 1;
}

// ——— проекция точки на экран ———
const proj = p => { const v = p.clone().project(camera); return { x: (v.x + 1) / 2 * W, y: (1 - v.y) / 2 * H, z: v.z }; };
function tag(text, x, y, col, a, k) {
  if (a <= 0) return;
  cx.save(); cx.globalAlpha = clamp(a); cx.translate(x, y); cx.scale(k, k);
  cx.font = 'bold 40px "DejaVu Sans Mono"'; const w = cx.measureText(text).width + 36;
  cx.fillStyle = 'rgba(28,24,22,.88)'; cx.beginPath(); cx.roundRect(-w / 2, -32, w, 64, 20); cx.fill(); cx.strokeStyle = col; cx.lineWidth = 5; cx.stroke();
  cx.fillStyle = col; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(text, 0, 2); cx.restore();
}
function sparkle(x, y, k, col = '255,230,120') {
  if (k <= 0 || k >= 1) return;
  cx.save(); cx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, r = 20 + k * 90; cx.fillStyle = `rgba(${col},${1 - k})`; cx.beginPath(); cx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, 9 * (1 - k) + 2, 0, 7); cx.fill(); }
  cx.restore();
}

// ——— 2D-слой ———
const LEVEL_DESC = {
  low: ['идея · набросок · имя рыбке', 'быстро · проверяешь ты'],
  medium: ['обычная работа, задача ясна', 'по умолчанию у моделей 5.5'],
  high: ['баги и проверки', 'что-то упущено? подними уровень'],
  max: ['самое трудное, без тебя', 'дороже · может перемудрить'],
};
function levelCard(t, lv, a, b, pos) {
  const s = inOut(t, a, b, .3, .15); if (s.a <= 0) return;
  effortPanel(t, { x: 170, y: 70, w: W - 340, pos, alpha: s.a, scale: .8 + .1 * s.k, typed: 1 });
  const lvNow = lv === 'high' ? LEVELS[Math.round(pos)] : lv;
  txt(LEVEL_RU[lvNow], W / 2, 440 + s.y, { size: lvNow === 'max' ? 104 : 112, font: 'Unbounded', fill: LEVEL_COL[lvNow], lw: 24, scale: s.k, alpha: s.a, rot: -.02 });
  const d = LEVEL_DESC[lv];
  const a2 = lv === 'high' ? EV.raise + .3 : a + .25, s2 = inOut(t, a2, b, .3, .15), s3 = inOut(t, a2 + .25, b, .3, .15);
  txt(d[0], W / 2, 540 + s2.y, { size: 56, fill: '#fff', lw: 16, scale: s2.k, alpha: s2.a });
  if (lv === 'medium') { const s4 = inOut(t, L0('k8') + .5, b, .3, .15); txt(d[1], W / 2, 612 + s4.y, { size: 52, fill: '#ffe14d', lw: 15, scale: s4.k, alpha: s4.a }); }
  else txt(d[1], W / 2, 612 + s3.y, { size: 52, fill: '#ffe14d', lw: 15, scale: s3.k, alpha: s3.a });
  if (lv === 'max') { const s5 = inOut(t, a + .9, b, .3, .15); txt('xhigh — глубже, чем high, но дороже', W / 2, 680 + s5.y, { size: 34, font: '"DejaVu Sans Mono"', weight: 'bold', fill: LEVEL_COL.xhigh, lw: 10, scale: s5.k, alpha: s5.a }); }
}
function overlay(t) {
  const s = shotOf(t), uw = camera.position.y < 0;
  if (uw) {   // лучи сквозь воду
    cx.save(); cx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 6; i++) { const x = W * (.1 + i * .17) + Math.sin(t * .7 + i) * 40, g = cx.createLinearGradient(x, 0, x - 200, H); g.addColorStop(0, 'rgba(180,255,255,.22)'); g.addColorStop(1, 'rgba(180,255,255,0)'); cx.fillStyle = g; cx.beginPath(); cx.moveTo(x - 40, 0); cx.lineTo(x + 50, 0); cx.lineTo(x - 150, H); cx.lineTo(x - 330, H); cx.fill(); }
    cx.restore();
  }
  // вспышка при нырке
  const dk = seg(t, EV.dive + .45, EV.dive + .75); if (dk > 0 && dk < 1) { cx.fillStyle = `rgba(220,250,255,${Math.sin(dk * Math.PI) * .8})`; cx.fillRect(0, 0, W, H); }
  finish(t, { vig: uw ? .65 : .45, warm: uw ? .04 : .15 });

  // S1: крючок
  if (s === 'S1') {
    let a = inOut(t, .05, SH.S2, .25); txt('ИМЯ ДЛЯ РЫБКИ', W / 2, 200 + a.y, { size: 84, font: 'Unbounded', fill: '#fff', lw: 20, scale: a.k, alpha: a.a });
    a = inOut(t, .35, SH.S2, .25); txt('НА MAX', W / 2, 330 + a.y, { size: 150, font: 'Unbounded', fill: '#ff5c7a', lw: 28, scale: a.k * (1 + .03 * Math.sin(t * 10)), alpha: a.a, rot: -.04 });
    a = inOut(t, .8, SH.S2, .25); txt('(рассуждает на максимуме)', W / 2, 440 + a.y, { size: 46, fill: '#ffe14d', lw: 12, scale: a.k, alpha: a.a });
    const top = proj(TOWER_AT.clone().add(V(-.04, 1.28, 0)));
    tag('MAX', top.x, Math.max(560, top.y - 50), '#ff5c7a', seg(t, 1.0, 1.2), back(seg(t, 1.0, 1.3)) * (1 + .05 * Math.sin(t * 12)));
    const n = 40 + Math.min(7, Math.floor(seg(t, L0('k1'), L1('k1')) * 8));
    if (t > L0('k1') - .4) { const p = proj(TOWER_AT.clone().add(V(.35, .3, 0))); tag('вариант ' + n, Math.min(W - 190, p.x + 60), p.y, '#ffe14d', seg(t, L0('k1') - .4, L0('k1') - .2), 1); }
  }
  // S2: котик двигает ползунок
  if (s === 'S2') {
    const pos = lerp(4, 1, eio(seg(t, EV.pull, EV.pull + .55)));
    const a = inOut(t, SH.S2, SH.S3, .25, .15);
    effortPanel(t, { pos, alpha: a.a, scale: .9 + .1 * a.k, note: t > EV.pull + .55 ? (t > L0('k3') ? 'уровень рассуждения' : 'СРЕДНИЙ') : '' });
    bubbles.forEach((b, i) => { const pt = EV.popAt + (bubbles.length - 1 - i) * .055; const p = proj(tower.localToWorld(b.position.clone())); sparkle(p.x, p.y, seg(t, pt, pt + .45)); });
  }
  // S3: удочки и подписи
  if (s === 'S3') {
    let a = inOut(t, L0('k4') - .1, SH.S4, .25); txt('РЫБА = ЗАДАЧА', W / 2, 220 + a.y, { size: 92, font: 'Unbounded', fill: '#fff', lw: 22, scale: a.k, alpha: a.a });
    a = inOut(t, L0('k5') - .1, SH.S4, .25); txt('УДОЧКА = УРОВЕНЬ', W / 2, 340 + a.y, { size: 70, font: 'Unbounded', fill: '#ffe14d', lw: 22, scale: a.k, alpha: a.a });
    RODS.forEach((r, i) => { const p = proj(rodTips[i]); const at = SH.S3 + .25 + i * .16; tag(r.lv, p.x, p.y - 46, LEVEL_COL[r.lv], seg(t, at, at + .12) * (1 - seg(t, SH.S4 - .1, SH.S4)), back(seg(t, at, at + .3))); });
  }
  // карточки уровней
  if (s === 'S4') levelCard(t, 'low', SH.S4 + .05, SH.S5, 0);
  if (s === 'S5') levelCard(t, 'medium', SH.S5 + .05, SH.S6, 1);
  if (s === 'S6') {
    levelCard(t, 'high', SH.S6 + .05, SH.S7, lerp(1, 2, eio(seg(t, EV.raise, EV.raise + .45))));
    // проверка колючек
    const c = puffer.position, camDir = camera.position.clone().sub(c).normalize();
    SPIKES.forEach((sp, i) => {
      const n = sp.n.clone().applyQuaternion(puffer.quaternion); if (n.dot(camDir) < .15) return;
      const p = proj(c.clone().add(n.multiplyScalar(.17 * puffer.scale.x)));
      const red = i === RED;
      const at = EV.checks + (red ? 2.0 : (i % 9) * .17);
      if (red && t > EV.redSpike && t < at) { if (Math.floor(t * 5) % 2 === 0) { cx.fillStyle = '#ff3b5c'; cx.beginPath(); cx.arc(p.x, p.y, 30, 0, 7); cx.fill(); txt('✕', p.x, p.y + 2, { size: 40, font: 'DejaVu Sans', fill: '#fff', lw: 0 }); } }
      if (t > at && i !== SKIP) { const k = back(seg(t, at, at + .25)); cx.save(); cx.translate(p.x, p.y); cx.scale(k, k); cx.fillStyle = '#2ecc71'; cx.beginPath(); cx.arc(0, 0, 26, 0, 7); cx.fill(); cx.strokeStyle = '#fff'; cx.lineWidth = 7; cx.lineCap = 'round'; cx.beginPath(); cx.moveTo(-11, 1); cx.lineTo(-3, 10); cx.lineTo(13, -9); cx.stroke(); cx.restore(); }
    });
  }
  if (s === 'S7') {
    levelCard(t, 'max', SH.S7 + .05, EV.surface + .1, lerp(2, 4, eio(seg(t, SH.S7 + .1, SH.S7 + .6))));
    if (t > L0('k12') + .4) { const p = proj(kitten.position.clone().add(V(.15, .95, 0))); ['z', 'Z', 'Z'].forEach((z, i) => { const ph = (t * .7 + i / 3) % 1; txt(z, p.x + ph * 60 + i * 20, p.y - ph * 160, { size: 50 + i * 14, fill: '#fff', lw: 10, alpha: Math.sin(ph * Math.PI) }); }); }
  }
  if (s === 'S8' && t > EV.punch) {
    const a = inOut(t, EV.punch + .05, SH.S9, .25);
    txt('ВЫШЕ УРОВЕНЬ', W / 2, 230 + a.y, { size: 86, font: 'Unbounded', fill: '#fff', lw: 22, scale: a.k, alpha: a.a });
    txt('≠ ВЕРНЫЙ ПОДХОД', W / 2, 350 + a.y, { size: 80, font: 'Unbounded', fill: '#ff5c7a', lw: 22, scale: a.k, alpha: a.a, rot: -.02 });
  }
  if (s === 'S8' && t > EV.castPuddle + .5 && t < EV.palm) { const p = proj(PUDDLE); const a = seg(t, L0('c6') + .3, L0('c6') + .5); txt('лужа = не тот подход', Math.max(330, p.x), p.y - 90, { size: 52, fill: '#bfe8ff', lw: 14, alpha: a }); }
  if (s === 'S9') {
    if (t > EV.jump + .2 && t < EV.jump + 1.1) { const p = proj(BUCKET.clone().add(V(0, .5, 0))); txt('БУЛЬК', p.x, p.y - 40, { size: 70, font: 'Unbounded', fill: '#ffb03b', lw: 18, scale: back(seg(t, EV.jump + .2, EV.jump + .45)), alpha: 1 - seg(t, EV.jump + .9, EV.jump + 1.1), rot: .08 }); sparkle(p.x, p.y, seg(t, EV.jump + .2, EV.jump + .7)); }
    if (t > EV.deadpan + .3) { const a = inOut(t, EV.deadpan + .3, SH.END, .25); txt('НЕ УВЕРЕН?', W / 2, 230 + a.y, { size: 86, font: 'Unbounded', fill: '#fff', lw: 22, scale: a.k, alpha: a.a }); txt('ОСТАВЬ ПО УМОЛЧАНИЮ', W / 2, 340 + a.y, { size: 54, font: 'Unbounded', fill: '#7dff9a', lw: 18, scale: a.k, alpha: a.a }); const b = inOut(t, EV.deadpan + 1.0, SH.END, .25); txt('сбросить: /effort auto', W / 2, 425 + b.y, { size: 40, font: '"DejaVu Sans Mono"', weight: 'bold', fill: '#fff', lw: 10, scale: b.k, alpha: b.a }); }
  }
  // финальная карточка
  if (s === 'END') {
    const e = SH.END;
    let a = inOut(t, e + .05, ST.dur + 1, .3); txt('А ТЫ КАКУЮ', W / 2, 330 + a.y, { size: 92, font: 'Unbounded', fill: '#fff', lw: 22, scale: a.k, alpha: a.a });
    a = inOut(t, e + .3, ST.dur + 1, .3); txt('УДОЧКУ БЕРЁШЬ?', W / 2, 450 + a.y, { size: 84, font: 'Unbounded', fill: '#ffe14d', lw: 24, scale: a.k, alpha: a.a, rot: -.03 + Math.sin(t * 3) * .012 });
    LEVELS.forEach((l, i) => { const at = e + .6 + i * .12; tag(l, W / 2 + (i - 2) * 190, 1560, LEVEL_COL[l], seg(t, at, at + .1), back(seg(t, at, at + .3))); });
    a = inOut(t, e + 1.3, ST.dur + 1, .3); txt('Пиши в комменты ↓', W / 2, 1700 + Math.sin(t * 6) * 10, { size: 70, fill: '#fff', lw: 18, scale: a.k, alpha: a.a });
  }
  subtitles(t, ST.lines, 1450, { C: '#ffe14d', K: '#ffb08a' });
  const fade = seg(t, ST.dur - .25, ST.dur); if (fade > 0) { cx.fillStyle = `rgba(0,0,0,${fade})`; cx.fillRect(0, 0, W, H); }
}

// ——— сборка кадра ———
function scene3D(t) {
  water.material.uniforms.time.value = t; flies.update(t);
  poses(t); poseRods(t); poseProps(t); cam(t); poseUnder(t); poseLate(t);
  composer.render();
}
const blurWin = [[EV.catchLow + .05, EV.catchLow + .5], [EV.dive + .2, EV.dive + 1.0], [EV.punch, EV.punch + .2]];
function renderAt(t) {
  const fast = blurWin.some(([a, b]) => t >= a && t < b), N = fast ? 4 : 1, dt = 1 / FPS * .6;
  cx.filter = 'saturate(1.22) contrast(1.06)';
  for (let i = 0; i < N; i++) { scene3D(N > 1 ? t - dt * (i / (N - 1) - .5) : t); cx.globalAlpha = 1 / (i + 1); cx.drawImage(gl, 0, 0); }
  cx.globalAlpha = 1; cx.filter = 'none';
  scene3D.last = t;
  overlay(t);
}
window.renderAt = renderAt;
window.frameJPEG = (t, q = .93) => { renderAt(t); return document.getElementById('out').toDataURL('image/jpeg', q); };
renderAt(0);
window.ready = true;
