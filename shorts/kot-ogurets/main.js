// «Кот и огурец» — 3D-мультик по мему. 1080×1920, кадр — чистая функция времени t.
// Монтажные приёмы: крючок-текст с первой секунды, удары камеры, вжух-панорама, замедление и стоп-кадр,
// размытие в движении (подкадры), субтитры по словам, цветокор + зерно + виньетка.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const W = 1080, H = 1920;
const ST = await (await fetch('story.json')).json();
const SH = ST.shots, EV = ST.ev, FPS = ST.fps;
window.DUR = ST.dur;

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const ss = k => k * k * (3 - 2 * k);
const eio = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
const eo = k => 1 - Math.pow(1 - k, 3);
const ei = k => k * k * k;
const back = k => { const c = 2.2; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
const spring = k => k <= 0 ? 0 : 1 - Math.exp(-7 * k) * Math.cos(11 * k);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const vlerp = (a, b, k) => a.clone().lerp(b, k);
const hash = n => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };
const vn = x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i), hash(i + 1), u) * 2 - 1; };
const shotOf = t => { let cur = 'A'; for (const [k, v] of Object.entries(SH)) if (t >= v) cur = k; return cur; };
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// время анимации: во время стоп-кадра почти стоит
function animT(t) {
  const a = EV.freeze0, b = EV.freeze1, slow = .06;
  if (t < a) return t;
  if (t < b) return a + (t - a) * slow;
  return a + (b - a) * slow + (t - b);
}

// ——— рендер ———
const gl = document.createElement('canvas'); gl.width = W; gl.height = H;
const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x2a1c2e);
const camera = new THREE.PerspectiveCamera(36, W / H, .05, 100);
scene.add(camera);

const key = new THREE.DirectionalLight(0xffc98a, 3.6); key.position.set(-3.5, 4.5, 3); key.castShadow = true;
key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -.0005; key.shadow.normalBias = .02;
Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4.5, bottom: -1, near: .5, far: 20 });
scene.add(key);
scene.add(new THREE.HemisphereLight(0xbfd8ff, 0x8a5a3a, 1.1));
const rim = new THREE.DirectionalLight(0x9fd0ff, 2.2); rim.position.set(3, 3, -4); scene.add(rim);
const lamp = new THREE.PointLight(0xffb36b, 6, 6, 1.6); lamp.position.set(.6, 2.6, .8); scene.add(lamp);

// ——— кухня ———
const canvasTex = (w, h, draw, rep = [1, 1]) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); t.anisotropy = 8; return t; };
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .5, ...o });
function box(w, h, d, mat, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; scene.add(m); return m; }
{
  const tiles = canvasTex(256, 256, (x, w, h) => { for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { x.fillStyle = (i + j) % 2 ? '#f3e6cf' : '#d9634f'; x.fillRect(i * 128, j * 128, 128, 128); } x.strokeStyle = 'rgba(0,0,0,.12)'; x.lineWidth = 4; x.strokeRect(0, 0, 256, 256); }, [12, 12]);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshStandardMaterial({ map: tiles, roughness: .35, metalness: .05 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const wallT = canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#ffe9c4'; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(230,160,110,.25)'; for (let i = 0; i < 8; i++) x.fillRect(i * 32 + 12, 0, 8, h); }, [6, 2]);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(14, 6), new THREE.MeshStandardMaterial({ map: wallT, roughness: .9 })); wall.position.set(0, 3, -1.75); wall.receiveShadow = true; scene.add(wall);
  const wallL = wall.clone(); wallL.rotation.y = Math.PI / 2; wallL.position.set(-4.5, 3, 3); scene.add(wallL);
  // шкафчики
  const mint = M(0x5fc7b0, { roughness: .4 }), wood = M(0xc98b52, { roughness: .6 }), knob = M(0xffd56a, { metalness: .6, roughness: .25 });
  for (let i = 0; i < 4; i++) { box(.95, .85, .7, mint, -3.2 + i * 1, .44, -1.38); box(.08, .08, .06, knob, -3.2 + i * 1 + .3, .7, -1.0); }
  box(4.2, .08, .78, wood, -1.7, .9, -1.36);
  for (let i = 0; i < 3; i++) { box(.95, .75, .45, mint, -3.2 + i * 1, 2.35, -1.5); box(.06, .14, .05, knob, -3.2 + i * 1 + .32, 2.1, -1.26); }
  // холодильник
  const fr = M(0xf7f3ee, { roughness: .25 });
  const fridge = box(1.1, 2.6, 1.0, fr, 2.5, 1.3, -.9);
  box(.06, .5, .06, M(0xb8b8b8, { metalness: .7, roughness: .2 }), 2.05, 1.7, -.38);
  box(1.08, .02, .02, M(0xd0ccc6), 2.5, 1.7, -.39);
  const magnet = ['#ff5d8f', '#ffd23f', '#4fb7ff']; magnet.forEach((c, i) => box(.12, .12, .03, M(c), 2.3 + i * .18, 2.0 - i * .12, -.39));
  // окно с закатом
  const sky = canvasTex(256, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#5b4bd6'); g.addColorStop(.55, '#ff7a6b'); g.addColorStop(1, '#ffcf6b'); x.fillStyle = g; x.fillRect(0, 0, w, h); x.fillStyle = '#ffe7a6'; x.beginPath(); x.arc(w * .62, h * .78, 34, 0, 7); x.fill(); x.fillStyle = '#2e2a5a'; for (let i = 0; i < 9; i++) x.fillRect(i * 30, h - 40 - hash(i) * 50, 26, 120); });
  const win = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0), new THREE.MeshBasicMaterial({ map: sky })); win.position.set(-1.6, 1.75, -1.74); scene.add(win);
  const frameM = M(0xffffff); [[0, .52, 1.7, .06], [0, -.52, 1.7, .06], [-.82, 0, .06, 1.1], [.82, 0, .06, 1.1], [0, 0, .04, 1.0]].forEach(([x, y, w, h]) => box(w, h, .06, frameM, -1.6 + x, 1.75 + y, -1.72));
  // миска
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(.3, .22, .16, 32, 1, true), M(0xff4f6d, { side: THREE.DoubleSide, roughness: .3 })); bowl.position.set(.8, .08, .66); bowl.castShadow = true; scene.add(bowl);
  const bot = new THREE.Mesh(new THREE.CircleGeometry(.22, 32), M(0xff4f6d)); bot.rotation.x = -Math.PI / 2; bot.position.set(.8, .005, .66); scene.add(bot);
  const kib = new THREE.InstancedMesh(new THREE.SphereGeometry(.035, 8, 6), M(0x9a5a2a), 40); const r = rng(3), m = new THREE.Matrix4();
  for (let i = 0; i < 40; i++) { const a = r() * 7, d = Math.sqrt(r()) * .22; m.makeTranslation(.8 + Math.cos(a) * d, .1 + r() * .03, .66 + Math.sin(a) * d); kib.setMatrixAt(i, m); } scene.add(kib);
  // коврик
  const rug = new THREE.Mesh(new THREE.CircleGeometry(1.2, 40), new THREE.MeshStandardMaterial({ map: canvasTex(128, 128, (x, w, h) => { for (let i = 8; i > 0; i--) { x.fillStyle = i % 2 ? '#6b8cff' : '#ffe08a'; x.beginPath(); x.arc(64, 64, i * 8, 0, 7); x.fill(); } }), roughness: 1 }));
  rug.rotation.x = -Math.PI / 2; rug.scale.set(1.4, 1, 1); rug.position.set(.2, .006, .3); rug.receiveShadow = true; scene.add(rug);
}

// ——— общие детали ———
const sph = (r, m, ws = 28, hs = 18) => { const o = new THREE.Mesh(new THREE.SphereGeometry(r, ws, hs), m); o.castShadow = true; return o; };
const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 12);
function setRod(o, a, b, r) { o.position.copy(a).add(b).multiplyScalar(.5); o.scale.set(r, Math.max(a.distanceTo(b), 1e-4), r); o.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize()); }
const rod = m => { const o = new THREE.Mesh(cylGeo, m); o.castShadow = true; return o; };
const mat = {
  white: M(0xffffff, { roughness: .2 }), pupil: M(0x0e0b12, { roughness: .1 }), mouth: M(0x5a1626, { roughness: .6 }), tongue: M(0xff6f86, { roughness: .4 }),
  pink: M(0xff9bb0, { roughness: .4 }), iris: M(0x8ad13a, { roughness: .2 }), irisO: M(0x6b3a1a, { roughness: .2 }),
  whisk: M(0xffffff, { roughness: .3 }), tear: new THREE.MeshPhysicalMaterial({ color: 0x9fdcff, roughness: .05, transmission: .3, transparent: true, opacity: .85 }),
  cuc: M(0x3f9a2c, { roughness: .35 }), cucB: M(0x2f7a22, { roughness: .4 }), cucEnd: M(0xd7ef9a, { roughness: .4 }), brow: M(0x1c3a12),
};
const furTex = canvasTex(512, 256, (x, w, h) => {
  x.fillStyle = '#f39a3d'; x.fillRect(0, 0, w, h); const r = rng(11);
  for (let i = 0; i < 14; i++) { const u = i / 14 * w + r() * 10; x.fillStyle = 'rgba(190,85,20,.75)'; x.beginPath(); x.moveTo(u, 0); x.bezierCurveTo(u + 18, h * .3, u - 18, h * .6, u + 6, h * .5); x.lineTo(u + 20, h * .45); x.bezierCurveTo(u + 10, h * .3, u + 30, h * .15, u + 22, 0); x.fill(); }
  for (let i = 0; i < 2500; i++) { x.fillStyle = `rgba(${r() < .5 ? '255,200,140' : '170,80,20'},${r() * .25})`; x.fillRect(r() * w, r() * h, 1, 4 + r() * 6); }
});
const fur = new THREE.MeshStandardMaterial({ map: furTex, roughness: .7 });
const furPlain = M(0xf39a3d, { roughness: .7 }), cream = M(0xfff1dc, { roughness: .7 });

function makeMouth(r) {
  const g = new THREE.Group();
  const hole = sph(r, mat.mouth); hole.scale.set(1, .5, .35); g.add(hole);
  const tg = sph(r * .55, mat.tongue, 16, 10); tg.scale.set(1.2, .6, .5); tg.position.set(0, -r * .28, r * .12); g.add(tg);
  const sm = new THREE.Mesh(new THREE.TorusGeometry(r * .8, r * .12, 8, 24, Math.PI * .8), mat.mouth); sm.rotation.z = Math.PI * 1.1; g.add(sm);
  const fangs = [-1, 1].map(s => { const f = new THREE.Mesh(new THREE.ConeGeometry(r * .13, r * .3, 8), mat.white); f.rotation.z = Math.PI; f.position.set(s * r * .45, r * .3, r * .2); g.add(f); return f; });
  g.userData = { hole, tg, sm, r, fangs };
  return g;
}
function setMouth(mo, { open = 0, wide = 1, smile = 1 }) {
  const { hole, tg, sm, r, fangs } = mo.userData;
  const shut = open < .06;
  hole.visible = tg.visible = !shut; sm.visible = shut; fangs.forEach(f => f.visible = !shut && open > .35);
  hole.scale.set(wide * (1 + open * .15), .16 + open * .95, .35);
  fangs.forEach((f, i) => f.position.set((i ? 1 : -1) * r * .45 * wide, r * (.12 + .45 * open), r * .25));
  tg.position.set(0, -r * (.15 + .45 * open), r * .12);
  sm.scale.set(wide, Math.abs(smile) + .001, 1); sm.rotation.z = smile >= 0 ? Math.PI * 1.1 : Math.PI * .1;
}
function makeEye(r, irisMat, slit = true) {
  const g = new THREE.Group();
  const w = sph(r, mat.white); w.scale.z = .6; g.add(w);
  const ir = sph(r * .6, irisMat, 24, 14); ir.scale.z = .45; ir.position.z = r * .3; g.add(ir);
  const p = sph(r * .5, mat.pupil, 18, 12); p.scale.z = .4; p.position.z = r * .5; ir.add(p);
  const hl = sph(r * .17, mat.white, 10, 8); hl.position.set(r * .16, r * .18, r * .78); ir.add(hl);
  const hl2 = sph(r * .08, mat.white, 8, 6); hl2.position.set(-r * .14, -r * .16, r * .78); ir.add(hl2);
  const lid = sph(r * 1.07, furPlain, 24, 12); g.add(lid);
  g.userData = { w, ir, p, lid, r, slit };
  return g;
}
function setEye(e, { look = [0, 0], open = 1, lid = 0, dil = 0, size = 1, lidMat }) {
  const { w, ir, p, r, slit } = e.userData;
  e.scale.setScalar(size);
  w.scale.y = Math.max(.06, open);
  ir.visible = open > .15; ir.position.set(look[0] * r * .35, look[1] * r * .3, r * .3);
  // зрачок: щель у кота, круглый от страха
  if (slit) p.scale.set(lerp(.28, 1.25, dil), lerp(1.3, 1.25, dil), .4); else p.scale.set(1, 1, .4);
  if (lidMat) e.userData.lid.material = lidMat;
  e.userData.lid.visible = lid > .02; e.userData.lid.scale.set(1.04, 1.04 * lid, .66); e.userData.lid.position.set(0, r * (1 - lid) * .95, .01);
}

// ——— кот Барсик ———
const cat = new THREE.Group(); scene.add(cat);
const catBody = new THREE.Group(); cat.add(catBody);
const torso = sph(1, fur, 40, 28); torso.scale.set(.62, .42, .42); torso.position.set(0, .5, 0); catBody.add(torso);
const belly = sph(1, cream, 28, 18); belly.scale.set(.42, .3, .33); belly.position.set(.16, .42, 0); catBody.add(belly);
const headG = new THREE.Group(); headG.position.set(.55, .82, 0); catBody.add(headG);
const headPivot = new THREE.Group(); headG.add(headPivot);
const headM = sph(1, fur, 40, 28); headM.scale.set(.37, .34, .39); headM.rotation.y = Math.PI / 2; headPivot.add(headM);
const face = new THREE.Group(); face.rotation.y = Math.PI / 2; headPivot.add(face);   // +z лица = +x мира
[-1, 1].forEach(s => { const m = sph(.13, cream); m.scale.set(1, .85, .8); m.position.set(s * .09, -.1, .3); face.add(m); });
const chin = sph(.09, cream); chin.position.set(0, -.2, .27); face.add(chin);
const nose = sph(.05, mat.pink); nose.scale.set(1.2, .8, .8); nose.position.set(0, -.03, .38); face.add(nose);
const catEyes = [-1, 1].map(s => { const e = makeEye(.13, mat.iris); e.position.set(s * .15, .09, .27); e.rotation.y = s * .25; face.add(e); return e; });
const catMouth = makeMouth(.09); catMouth.position.set(0, -.16, .35); face.add(catMouth);
const whisk = []; [-1, 1].forEach(s => [-.03, .02, .07].forEach((dy, i) => { const w = rod(mat.whisk); w.userData = { s, dy, i }; face.add(w); whisk.push(w); }));
const ears = [-1, 1].map(s => {
  const g = new THREE.Group(); g.position.set(s * .2, .25, -.02); face.add(g);
  const o = new THREE.Mesh(new THREE.ConeGeometry(.13, .28, 20), furPlain); o.position.y = .1; o.castShadow = true; g.add(o);
  const i = new THREE.Mesh(new THREE.ConeGeometry(.08, .2, 16), mat.pink); i.position.set(0, .08, .05); g.add(i);
  return { g, s };
});
const catBrows = [-1, 1].map(() => { const b = rod(M(0x9a4a12)); b.visible = false; face.add(b); return b; });
const legs = [[.3, .24], [.3, -.24], [-.3, .24], [-.3, -.24]].map(([x, z]) => { const l = rod(furPlain), p = sph(.085, cream, 16, 12); p.scale.set(1.2, .7, 1); catBody.add(l, p); return { l, p, x, z }; });
const tailMesh = new THREE.Mesh(new THREE.BufferGeometry(), furPlain); tailMesh.castShadow = true; catBody.add(tailMesh);
// шерсть дыбом: шипы по телу
const NP = 340, spikes = new THREE.InstancedMesh(new THREE.ConeGeometry(.035, .15, 6), furPlain, NP); spikes.castShadow = true; catBody.add(spikes);
const SPK = []; { const r = rng(5); for (let i = 0; i < NP; i++) { const d = V(r() * 2 - 1, r() * 1.4 - .3, r() * 2 - 1).normalize(); SPK.push({ d, ph: r() * 6, s: .7 + r() * .6 }); } }

// ——— огурец ———
const cuc = new THREE.Group(); scene.add(cuc);
const cucBody = new THREE.Group(); cuc.add(cucBody);
{
  const b = new THREE.Mesh(new THREE.CapsuleGeometry(.17, .85, 12, 28), mat.cuc); b.rotation.z = Math.PI / 2; b.castShadow = true; cucBody.add(b);
  const r = rng(8), bumps = new THREE.InstancedMesh(new THREE.SphereGeometry(.025, 8, 6), mat.cucB, 90), m = new THREE.Matrix4();
  for (let i = 0; i < 90; i++) { const x = (r() - .5) * .95, a = r() * 7; m.makeTranslation(x, Math.cos(a) * .165, Math.sin(a) * .165); bumps.setMatrixAt(i, m); } cucBody.add(bumps);
  for (let i = 0; i < 8; i++) { const s = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, .9, 4), mat.cucB); s.rotation.z = Math.PI / 2; const a = i / 8 * 7; s.position.set(0, Math.cos(a) * .168, Math.sin(a) * .168); cucBody.add(s); }
  const end = sph(.06, mat.cucEnd); end.position.set(.6, 0, 0); end.scale.set(.4, 1, 1); cucBody.add(end);
}
const cFace = new THREE.Group(); cFace.position.set(.18, .06, .15); cucBody.add(cFace);
const cEyes = [-1, 1].map(s => { const e = makeEye(.075, mat.irisO, false); e.position.set(s * .085, .04, .02); cFace.add(e); return e; });
const cMouth = makeMouth(.05); cMouth.position.set(0, -.07, .04); cFace.add(cMouth);
const cBrows = [-1, 1].map(() => { const b = rod(mat.brow); cFace.add(b); return b; });
const tear = sph(.025, mat.tear, 12, 8); tear.scale.set(1, 1.4, 1); cFace.add(tear);

// ——— постобработка ———
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), .32, .5, .86));
composer.addPass(new OutputPass());

// ——— речь ———
function speech(who, t) {
  for (const L of ST.lines) {
    if (L.who !== who || !L.env) continue;
    const i = Math.floor((t - L.t0) * FPS);
    if (i >= 0 && i < L.env.length) { const a = L.env[i], b = L.env[i + 1] ?? 0, k = (t - L.t0) * FPS - i; return clamp(lerp(a, b, k) * 1.2); }
  }
  return 0;
}

// ——— поза кота ———
const FRIDGE_TOP = V(2.45, 2.6, -.8), CAT_YAW = -.7;
function jumpPos(ta) {   // ta — анимационное время
  const a0 = V(0, 0, 0), apex = V(.85, 2.7, -.2);
  const t0 = EV.jump, t1 = EV.freeze0, t2 = animT(EV.land);
  if (ta < t0) return a0.clone();
  if (ta < t1) { const k = eo(seg(ta, t0, t1)); return V(lerp(0, apex.x, k), lerp(0, apex.y, k), lerp(0, apex.z, k)); }
  const k = seg(ta, t1, t2), kk = ei(k);
  return V(lerp(apex.x, FRIDGE_TOP.x, k), lerp(apex.y, FRIDGE_TOP.y, kk) + Math.sin(k * Math.PI) * .35 * (1 - k), lerp(apex.z, FRIDGE_TOP.z, k));
}
function poseCat(t) {
  const ta = animT(t), shot = shotOf(t);
  const inAir = t >= EV.jump && t < EV.land, after = t >= EV.land;
  let puff = 0, dil = 0, open = 1, lid = .15, look = [0, 0], eyeSize = 1, mouth = 0, smile = .6, earBack = 0, earTw = 0, brow = 0;
  cat.position.copy(after ? FRIDGE_TOP : jumpPos(ta)); cat.rotation.set(0, CAT_YAW, 0);
  catBody.position.set(0, 0, 0); catBody.rotation.set(0, 0, 0); catBody.scale.set(1, 1, 1);
  headPivot.rotation.set(0, 0, 0); headG.position.set(.55, .82, 0);
  // еда
  if (t < EV.stop) {
    const m = Math.max(0, Math.sin(t * 2 * Math.PI * 1.6));
    headG.position.set(.62, .6 - .06 * m, 0); headPivot.rotation.z = -.55 - .12 * m; lid = .45; look = [.2, -.6]; smile = .7;
    mouth = .25 * Math.max(0, Math.sin(t * 2 * Math.PI * 3.2)); catBody.rotation.z = -.08;
  } else if (t < EV.turn) {
    const k = ss(seg(t, EV.stop, EV.stop + .3));
    headG.position.set(lerp(.62, .55, k), lerp(.6, .82, k), 0); headPivot.rotation.z = lerp(-.55, -.1, k); catBody.rotation.z = -.08 * (1 - k);
    lid = lerp(.45, .1, k); earTw = Math.sin(seg(t, EV.ears, EV.ears + .35) * Math.PI * 4) * (t > EV.ears && t < EV.ears + .35 ? 1 : 0);
    look = [-.9 * ss(seg(t, EV.eyes, EV.eyes + .25)), 0]; brow = -.4 * ss(seg(t, EV.eyes, EV.eyes + .3));
  }
  // разворот
  if (t >= EV.turn && !after) {
    const k = eo(seg(t, EV.turn, EV.turn + .15));
    headPivot.rotation.y = -2.0 * k; look = [0, 0]; dil = ss(seg(t, EV.hit - .05, EV.hit + .1)); eyeSize = 1 + .35 * dil; lid = 0; earBack = dil;
    puff = spring(seg(t, EV.hit, EV.hit + .5)); brow = .7;
    if (t > EV.hit) mouth = .3;
  }
  // прыжок: лапы растопырены, пасть открыта
  if (inAir) {
    const k = seg(t, EV.jump, EV.jump + .2);
    headPivot.rotation.y = lerp(-2.0, -.4, k); cat.rotation.y = CAT_YAW - .6 * k; catBody.rotation.z = .25 * Math.sin(ta * 3) ; catBody.rotation.x = .15 * Math.sin(ta * 2.3);
    puff = 1; dil = 1; eyeSize = 1.45; lid = 0; earBack = 1; brow = .9;
    mouth = Math.max(.75, speech('C', t) * 1.1);
    catBody.scale.set(1 - .1 * Math.sin(k * Math.PI), 1 + .15 * Math.sin(k * Math.PI), 1);
  }
  if (after) {
    const k = seg(t, EV.land, EV.land + .25), tremble = (1 - seg(t, EV.land + 1, SH.H + .5)) * .02;
    catBody.scale.set(1 + .18 * Math.sin(k * Math.PI), 1 - .2 * Math.sin(k * Math.PI), 1);
    catBody.position.set(Math.sin(t * 60) * tremble, 0, 0);
    cat.rotation.y = -2.0;   // мордой к зрителю и огурцу
    headPivot.rotation.z = -.3; headPivot.rotation.y = 0;
    puff = 1 - .7 * ss(seg(t, SH.H, SH.H + 1.5)); dil = 1 - .8 * ss(seg(t, SH.G + 1, SH.H)); eyeSize = 1.3 - .3 * ss(seg(t, SH.H - .5, SH.H + .3)); earBack = puff;
    look = [-.2, -.6]; lid = 0; brow = .7;
    if (t > SH.H) { lid = .42; brow = -.6; look = [-.3, -.5]; mouth = speech('C', t); smile = -.4; }
  }
  // моргание
  if ([2.0, 4.2, 13.3, 16.9].some(b => t > b && t < b + .1)) open = .06;
  catEyes.forEach((e, i) => setEye(e, { look: [look[0] * (i ? 1 : 1), look[1]], open, lid, dil, size: eyeSize, lidMat: furPlain }));
  setMouth(catMouth, { open: mouth, wide: 1 + mouth * .4, smile });
  catBrows.forEach((b, i) => { const s = i ? 1 : -1; setRod(b, V(s * .23, .23 - brow * .02, .3), V(s * .08, .23 + brow * .05, .34), .017); });
  ears.forEach(({ g, s }) => { g.rotation.set(-earBack * .9, 0, s * (-.25 - earBack * .5) + earTw * .3 * s); });
  whisk.forEach(w => { const { s, dy, i } = w.userData; const sp = 1 + puff * .4; setRod(w, V(s * .14, -.08 + dy * .3, .34), V(s * .42 * sp, -.06 + dy * 2.2 * sp + puff * .05, .3), .006); });
  legs.forEach((L, i) => {
    const front = L.x > 0, sx = Math.sign(L.z);
    let hip = V(L.x, .42, L.z * .8), foot = V(L.x, .04, L.z);
    if (inAir) foot = V(L.x * 2.1, .2 + (front ? .15 : -.05), L.z * 2.1);
    if (after) foot = V(L.x * 1.3, .04, L.z * 1.15);
    if (t < EV.stop && front) foot.x += .04 * Math.sin(t * 6 + i);
    setRod(L.l, hip, foot, .075); L.p.position.copy(foot);
  });
  // хвост
  const tw = t < EV.stop ? Math.sin(t * 2.5) * .25 : 0, up = Math.max(puff, after ? .6 : 0);
  const pts = []; for (let i = 0; i <= 8; i++) { const k = i / 8; pts.push(V(-.55 - k * lerp(.45, .1, up), .55 + k * lerp(.35, .95, up) + Math.sin(k * 3) * .05, Math.sin(k * 2.2 + t * 3) * tw * k)); }
  const curve = new THREE.CatmullRomCurve3(pts); tailMesh.geometry.dispose();
  tailMesh.geometry = new THREE.TubeGeometry(curve, 24, .065 + up * .055, 10);
  // шипы шерсти
  const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  SPK.forEach((s, i) => {
    const p = V(s.d.x * .6, .5 + s.d.y * .4, s.d.z * .4);
    const sc = puff * s.s * (1 + .08 * Math.sin(t * 30 + s.ph));
    q.setFromUnitVectors(V(0, 1, 0), s.d); m.compose(p.add(s.d.clone().multiplyScalar(.04 * sc)), q, V(sc, sc, sc)); spikes.setMatrixAt(i, m);
  });
  spikes.instanceMatrix.needsUpdate = true; spikes.visible = puff > .01;
}

// ——— поза огурца ———
function poseCuc(t) {
  const k = eio(seg(t, EV.slide, EV.slide + 2.2));
  cuc.position.set(lerp(-3.6, -1.15, k), .17, lerp(-1.0, -.7, k)); cuc.rotation.set(0, .2, 0);
  cucBody.rotation.set(0, 0, 0);
  // глаза появляются
  const pop = t > EV.eyesPop ? back(seg(t, EV.eyesPop, EV.eyesPop + .3)) : 0;
  const lookUp = ss(seg(t, EV.eyesPop + .4, EV.eyesPop + 1));
  cuc.rotation.y = lerp(.2, .5, lookUp); cucBody.rotation.z = .18 * lookUp;
  const talk = speech('O', t);
  cEyes.forEach((e, i) => { setEye(e, { look: [.45 * lookUp, .55 * lookUp], open: t > 13.0 && t < 13.1 ? .06 : 1, lid: .25, size: pop, lidMat: mat.cuc }); e.visible = pop > .01; });
  cMouth.visible = pop > .01; setMouth(cMouth, { open: talk, smile: -.8 });
  cBrows.forEach((b, i) => { const s = i ? 1 : -1; b.visible = pop > .01; setRod(b, V(s * .14, .12, .05), V(s * .04, .155, .05), .009 * pop); });
  // слеза
  const tk = seg(t, EV.tear, EV.tear + 1.4); tear.visible = t > EV.tear && t < SH.H;
  tear.position.set(.1, .0 - tk * .14, .06); tear.scale.setScalar(ss(seg(t, EV.tear, EV.tear + .2)));
}

// ——— камера ———
function shake(t, a, f = 22) { return V(vn(t * f + 1) * a, vn(t * f + 9) * a, vn(t * f + 17) * a * .5); }
// кадр по цели: высота видимой области h, направление на камеру dir
function frame(T, h, dir, fov) { const d = h / 2 / Math.tan(fov * Math.PI / 360); return T.clone().add(dir.clone().normalize().multiplyScalar(d)); }
function poseCamera(t) {
  const shot = shotOf(t), ta = animT(t);
  let P, T, fov = 36, roll = 0, sh = .004, h = 2;
  const head = headG.getWorldPosition(V(0, 0, 0)), cp = cuc.position.clone();
  if (shot === 'A') { const k = seg(t, 0, SH.B); T = head.clone().lerp(V(.75, .3, .7), .35); h = lerp(1.9, 1.6, k); P = frame(T, h, V(.5, .3, 1), fov); }
  else if (shot === 'B') { const k = eio(seg(t, SH.B, SH.C)); T = V(lerp(-.1, -.3, k), .55, lerp(.1, -.2, k)); h = lerp(3.0, 2.5, k); P = frame(T, h, V(.55, .25, 1), fov); roll = .1 * k; }
  else if (shot === 'C') { const k = eio(seg(t, SH.C, SH.D)); T = head.clone().add(V(0, .02, 0)); h = lerp(1.35, 1.0, k); fov = 34; if (t > EV.beat1) h *= 1 - .12 * (1 - seg(t, EV.beat1, EV.beat1 + .2)); if (t > EV.beat2) h *= 1 - .12 * (1 - seg(t, EV.beat2, EV.beat2 + .2)); P = frame(T, h, V(.75, .15, 1), fov); roll = -.06; }
  else if (shot === 'D') {
    const k = eo(seg(t, EV.turn, EV.hit));
    T = vlerp(head, cp.clone().add(V(0, .12, 0)), k); h = lerp(.7, 1.1, k) * (1 - .25 * spring(seg(t, EV.hit, EV.hit + .35)));
    P = frame(T, h, vlerp(V(.75, .15, 1), V(.25, .35, 1), k), fov); roll = .12 * k; sh = .03 * (1 - seg(t, EV.hit, EV.hit + .4));
  }
  else if (shot === 'E') {
    const c = jumpPos(ta), fz = seg(t, EV.freeze0, EV.freeze0 + .2) * (1 - seg(t, EV.freeze1 - .1, EV.freeze1));
    const orbit = (ta - EV.jump) * .8 + (t > EV.freeze0 ? (Math.min(t, EV.freeze1) - EV.freeze0) * .3 : 0);
    T = c.clone().add(V(0, .6, 0)); h = lerp(2.8, 2.3, fz); P = frame(T, h, V(Math.sin(orbit) * .6 + .3, -.15, 1), fov);
    roll = .08 * Math.sin(orbit * 2); sh = t < EV.freeze0 ? .02 : .002;
  }
  else if (shot === 'F') {
    T = vlerp(jumpPos(ta).add(V(0, .6, 0)), FRIDGE_TOP.clone().add(V(0, .5, 0)), seg(t, EV.land - .2, EV.land)); h = 2.4;
    if (t > EV.land) { h *= 1 - .2 * spring(seg(t, EV.land, EV.land + .4)); sh = .035 * (1 - seg(t, EV.land, EV.land + .5)); }
    P = frame(T, h, V(-.3, -.12, 1), fov);
  }
  else if (shot === 'G') { const k = seg(t, SH.G, SH.H); T = cp.clone().add(V(.1, .1, 0)); h = lerp(1.0, .8, k); if (t > EV.eyesPop) h *= 1 - .15 * (1 - seg(t, EV.eyesPop, EV.eyesPop + .3)); P = frame(T, h, V(.25, .25, 1), fov); }
  else if (shot === 'H') { const k = seg(t, SH.H, SH.K); T = FRIDGE_TOP.clone().add(V(0, .75, .1)); h = lerp(2.0, 1.75, k); P = frame(T, h, V(-.45, -.3, 1), fov); roll = -.05; }
  else { const k = eio(seg(t, SH.K, ST.dur)); T = V(.75, 1.6, -.75); h = lerp(4.6, 5.0, k); P = frame(T, h, V(1, .5, .6), fov); }
  P.add(shake(t, sh)); camera.position.copy(P); camera.lookAt(T); camera.rotateZ(roll);
  camera.fov = fov; camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
}

// ——— 2D: монтажный слой ———
const out = document.getElementById('out'), cx = out.getContext('2d');
await document.fonts.load('900 60px Rubik', 'ЁёАаZ'); await document.fonts.load('900 60px Unbounded', 'ЁёАаZ');
const grain = [0, 1, 2, 3].map(s => { const c = document.createElement('canvas'); c.width = 540; c.height = 960; const x = c.getContext('2d'), d = x.createImageData(540, 960), r = rng(40 + s); for (let i = 0; i < d.data.length; i += 4) { const v = 128 + (r() - .5) * 160; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } x.putImageData(d, 0, 0); return c; });
function txt(text, x, y, { size = 64, font = 'Rubik', fill = '#fff', stroke = '#111', lw = 14, alpha = 1, scale = 1, rot = 0, align = 'center' } = {}) {
  if (alpha <= 0 || scale <= 0) return;
  cx.save(); cx.globalAlpha = clamp(alpha); cx.translate(x, y); cx.rotate(rot); cx.scale(scale, scale);
  cx.font = `900 ${size}px ${font}`; cx.textAlign = align; cx.textBaseline = 'middle'; cx.lineJoin = 'round';
  cx.strokeStyle = stroke; cx.lineWidth = lw; cx.strokeText(text, 0, 0);
  cx.shadowColor = 'rgba(0,0,0,.4)'; cx.shadowBlur = 14; cx.shadowOffsetY = 7; cx.fillStyle = fill; cx.fillText(text, 0, 0); cx.restore();
}
// появление: масштаб + подъём + прозрачность вместе, уход быстрее
const inOut = (t, a, b, din = .25, dout = .12) => ({ k: back(seg(t, a, a + din)), a: seg(t, a, a + din * .6) * (1 - seg(t, b - dout, b)), y: (1 - eo(seg(t, a, a + din))) * 40 });
function words(L) {   // время каждого слова по доле букв
  const ws = L.text.split(' '), tot = ws.reduce((s, w) => s + w.length, 0); let acc = 0;
  return ws.map(w => { const s = L.t0 + L.d * acc / tot; acc += w.length; return { w, s, e: L.t0 + L.d * acc / tot }; });
}
function overlay(t) {
  const shot = shotOf(t);
  // цветокор: тёплые света / холодные тени
  cx.save(); cx.globalCompositeOperation = 'soft-light'; cx.fillStyle = 'rgba(255,170,90,.18)'; cx.fillRect(0, 0, W, H); cx.restore();
  // стоп-кадр: обесцвеченный фон уже от камеры, здесь вспышка и рамка
  const fz = t >= EV.freeze0 && t < EV.freeze1;
  if (fz) {
    const k = seg(t, EV.freeze0, EV.freeze0 + .12);
    cx.save(); cx.globalCompositeOperation = 'overlay'; cx.fillStyle = `rgba(255,40,80,${.35 * k})`; cx.fillRect(0, 0, W, H); cx.restore();
  }
  // линии скорости в прыжке
  if ((t > EV.jump && t < EV.freeze0) || (t > EV.freeze1 && t < EV.land)) {
    cx.save(); cx.strokeStyle = 'rgba(255,255,255,.55)'; cx.lineCap = 'round';
    for (let i = 0; i < 26; i++) { const a = hash(i * 3.7) * Math.PI * 2, r0 = 520 + hash(i + Math.floor(t * 30)) * 200, len = 140 + hash(i * 9 + Math.floor(t * 30)) * 260; cx.lineWidth = 3 + hash(i) * 6; cx.beginPath(); cx.moveTo(W / 2 + Math.cos(a) * r0, H * .45 + Math.sin(a) * r0 * 1.4); cx.lineTo(W / 2 + Math.cos(a) * (r0 + len), H * .45 + Math.sin(a) * (r0 + len) * 1.4); cx.stroke(); }
    cx.restore();
  }
  // вспышки на ударах
  const flash = [[EV.hit, .55], [EV.freeze0, .7], [EV.land, .4], [EV.eyesPop, .25]].reduce((m, [a, s]) => Math.max(m, t >= a ? s * (1 - seg(t, a, a + .15)) : 0), 0);
  if (flash > 0) { cx.fillStyle = `rgba(255,255,255,${flash})`; cx.fillRect(0, 0, W, H); }
  // виньетка
  const g = cx.createRadialGradient(W / 2, H * .45, H * .22, W / 2, H * .5, H * .78); g.addColorStop(0, 'rgba(20,5,20,0)'); g.addColorStop(1, `rgba(20,5,20,${shot === 'C' || shot === 'B' ? .7 : .5})`); cx.fillStyle = g; cx.fillRect(0, 0, W, H);
  // зерно
  cx.save(); cx.globalAlpha = .07; cx.globalCompositeOperation = 'overlay'; cx.drawImage(grain[Math.floor(t * FPS) % 4], 0, 0, W, H); cx.restore();

  // крючок
  if (t < SH.B + .1) {
    const e = SH.B;
    let s = inOut(t, .05, e, .22); txt('НИКОГДА', W / 2, 300 + s.y, { size: 150, font: 'Unbounded', fill: '#ff3b5c', lw: 26, scale: s.k * (1 + .03 * Math.sin(t * 9)), alpha: s.a, rot: -.05 });
    s = inOut(t, .55, e, .22); txt('не клади огурец', W / 2, 440 + s.y, { size: 74, fill: '#fff', lw: 18, scale: s.k, alpha: s.a });
    s = inOut(t, .95, e, .22); txt('за котом', W / 2, 530 + s.y, { size: 74, fill: '#ffe14d', lw: 18, scale: s.k, alpha: s.a });
  }
  if (t > 3.0 && t < SH.C) {
    const full = 'он ещё не знает...', n = Math.floor(clamp((t - 3.0) / 1.1) * full.length);
    txt(full.slice(0, n), W / 2, 330, { size: 70, fill: '#fff', lw: 16, alpha: 1 - seg(t, SH.C - .12, SH.C) });
  }
  if (t > EV.beat1 && t < EV.turn) { const k = spring(seg(t, EV.beat1, EV.beat1 + .3)); txt('...', W / 2, 360, { size: 120, fill: '#fff', lw: 20, scale: k }); }
  // стоп-кадр: шкала страха
  if (fz) {
    const k = seg(t, EV.freeze0 + .05, EV.freeze0 + .75), v = Math.round(eo(k) * 100), over = t > EV.freeze0 + .9;
    const s = inOut(t, EV.freeze0, EV.freeze1, .2, .1);
    txt('УРОВЕНЬ СТРАХА', W / 2, 260 + s.y, { size: 74, font: 'Unbounded', fill: '#fff', lw: 18, scale: s.k, alpha: s.a });
    const bx = 150, by = 340, bw = W - 300, bh = 64;
    cx.save(); cx.globalAlpha = s.a; cx.fillStyle = 'rgba(0,0,0,.6)'; cx.strokeStyle = '#fff'; cx.lineWidth = 8;
    cx.beginPath(); cx.roundRect(bx, by, bw, bh, 32); cx.fill(); cx.stroke();
    const gr = cx.createLinearGradient(bx, 0, bx + bw, 0); gr.addColorStop(0, '#5cff7a'); gr.addColorStop(.5, '#ffe14d'); gr.addColorStop(1, '#ff3b5c');
    cx.fillStyle = gr; cx.beginPath(); cx.roundRect(bx + 8, by + 8, (bw - 16) * eo(k), bh - 16, 24); cx.fill(); cx.restore();
    txt(over ? '9000%' : v + '%', W / 2, 480, { size: over ? 150 : 120, font: 'Unbounded', fill: over ? '#ff3b5c' : '#ffe14d', lw: 24, alpha: s.a, scale: over ? back(seg(t, EV.freeze0 + .9, EV.freeze0 + 1.1)) : 1, rot: over ? -.06 : 0 });
  }
  // субтитры по словам (по 2 слова, текущее подсвечено)
  for (const L of ST.lines) {
    if (t < L.t0 - .05 || t > L.sub1) continue;
    const ws = words(L); let ci = ws.findIndex(w => t < w.e); if (ci < 0) ci = ws.length - 1;
    const g0 = ci - ci % 2, grp = ws.slice(g0, g0 + 2);
    const pop = back(seg(t, ws[g0].s - .05, ws[g0].s + .12)), a = 1 - seg(t, L.sub1 - .12, L.sub1);
    cx.font = '900 92px Rubik'; const widths = grp.map(w => cx.measureText(w.w).width), gap = 26, tw = widths.reduce((s, w) => s + w, 0) + gap * (grp.length - 1);
    let x = W / 2 - tw / 2;
    grp.forEach((w, i) => { const cur = g0 + i === ci; txt(w.w, x + widths[i] / 2, 1420, { size: 92, fill: cur ? (L.who === 'O' ? '#7dff6b' : '#ffe14d') : '#fff', lw: 22, scale: pop * (cur ? 1.08 : 1), alpha: a }); x += widths[i] + gap; });
  }
  // финал
  if (t >= SH.K) {
    let s = inOut(t, SH.K + .05, ST.dur + 1, .25); txt('А ТВОЙ КОТ', W / 2, 1000 + s.y, { size: 96, font: 'Unbounded', fill: '#fff', lw: 22, scale: s.k, alpha: s.a });
    s = inOut(t, SH.K + .3, ST.dur + 1, .25); txt('БОИТСЯ ОГУРЦОВ?', W / 2, 1120 + s.y, { size: 76, font: 'Unbounded', fill: '#7dff6b', lw: 20, scale: s.k, alpha: s.a, rot: -.03 + Math.sin(t * 3) * .015 });
    s = inOut(t, SH.K + .8, ST.dur + 1, .25); txt('Пиши в комментах ↓', W / 2, 1640 + Math.sin(t * 6) * 10, { size: 70, fill: '#ffe14d', lw: 18, scale: s.k, alpha: s.a });
  }
  const fade = seg(t, ST.dur - .2, ST.dur); if (fade > 0) { cx.fillStyle = `rgba(0,0,0,${fade})`; cx.fillRect(0, 0, W, H); }
}

function scene3D(t) { poseCat(t); poseCuc(t); poseCamera(t); composer.render(); }
// размытие в движении: усредняем подкадры на быстрых моментах
const blurWin = [[EV.turn, EV.hit + .1], [EV.jump, EV.freeze0], [EV.freeze1, EV.land + .1]];
function renderAt(t) {
  const fast = blurWin.some(([a, b]) => t >= a && t < b), N = fast ? 5 : 1, dt = 1 / FPS * .6;
  const fz = t >= EV.freeze0 && t < EV.freeze1;
  cx.filter = fz ? 'saturate(1.6) contrast(1.25) brightness(1.05)' : 'saturate(1.25) contrast(1.08)';
  for (let i = 0; i < N; i++) { scene3D(t - dt * (i / Math.max(1, N - 1) - .5) * (N > 1 ? 1 : 0)); cx.globalAlpha = 1 / (i + 1); cx.drawImage(gl, 0, 0); }
  cx.globalAlpha = 1; cx.filter = 'none';
  overlay(t);
}
window.renderAt = renderAt;
window.frameJPEG = (t, q = .93) => { renderAt(t); return out.toDataURL('image/jpeg', q); };
renderAt(0);
window.ready = true;
