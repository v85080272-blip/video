// «Последний лист» — 3D-мультик в мире из листьев. Вертикаль 1080×1920, детерминированный кадр по времени t.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const W = 1080, H = 1920;
const ST = await (await fetch('story.json')).json();
const SH = ST.shots, EV = ST.ev, FPS = ST.fps;
window.DUR = ST.dur;

// ——— утилиты ———
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const ss = k => k * k * (3 - 2 * k);
const eio = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
const eo = k => 1 - Math.pow(1 - k, 3);
const back = k => { const c = 1.9; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const vlerp = (a, b, k) => a.clone().lerp(b, k);
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const hash = n => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };
const vn = x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i), hash(i + 1), u) * 2 - 1; };
const shotOf = t => { let cur = 'A'; for (const [k, v] of Object.entries(SH)) if (t >= v) cur = k; return cur; };

// ——— ветер ———
function gustAmp(t) {
  let w = 0;
  for (const [a, b, amp] of ST.wind) w += amp * ss(seg(t, a - .15, a + .25)) * (1 - ss(seg(t, b - .7, b)));
  return w;
}
const wind = t => .12 + gustAmp(t) * (.8 + .2 * Math.sin(t * 9.3) + .1 * vn(t * 5));
const WT = []; { let acc = 0; for (let i = 0; i <= ST.dur * 120 + 240; i++) { WT.push(acc); acc += wind(i / 120) / 120; } }
const wint = t => { const x = clamp(t, 0, ST.dur + 1.9) * 120, i = Math.floor(x); return lerp(WT[i], WT[i + 1] ?? WT[i], x - i); };

// ——— рендер ———
const gl = document.createElement('canvas'); gl.width = W; gl.height = H; gl.id = 'gl';
const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x9fd6a0, 55, 190);
const camera = new THREE.PerspectiveCamera(38, W / H, .05, 400);
scene.add(camera);

// небо
{
  const g = new THREE.SphereGeometry(300, 32, 16);
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { sun: { value: V(.55, .45, -.7).normalize() } },
    vertexShader: 'varying vec3 vd; void main(){ vd = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `varying vec3 vd; uniform vec3 sun;
      void main(){ float h = clamp(vd.y*.5+.5,0.,1.);
        vec3 c = mix(vec3(.93,.98,.80), vec3(.36,.72,.98), smoothstep(.45,.95,h));
        c = mix(vec3(.55,.75,.45), c, smoothstep(.3,.5,h));
        float s = max(dot(vd, sun), 0.); c += vec3(1.,.85,.5)*(pow(s,8.)*.55 + pow(s,200.)*2.);
        gl_FragColor = vec4(c,1.); }`
  });
  scene.add(new THREE.Mesh(g, m));
}
// свет
const sun = new THREE.DirectionalLight(0xfff0cf, 3.9);
sun.position.set(6, 9, 7); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -.0004; sun.shadow.normalBias = .02;
Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: .5, far: 30 });
scene.add(sun); scene.add(sun.target);
scene.add(new THREE.HemisphereLight(0xcdeeff, 0x2f5a18, 1.0));
const rim = new THREE.DirectionalLight(0xbff2ff, 1.4); rim.position.set(-5, 3, -6); scene.add(rim);

// ——— листья: форма ———
function leafShape(w, h, teeth = 0) {
  const s = new THREE.Shape(); s.moveTo(0, 0);
  s.bezierCurveTo(w * .62, -h * .08, w * .62, -h * .62, 0, -h);
  s.bezierCurveTo(-w * .62, -h * .62, -w * .62, -h * .08, 0, 0);
  return s;
}
function bendLeaf(geo, w, h, fold, cup) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const ky = -y / h;
    p.setZ(i, z + fold * Math.abs(x) / w + cup * Math.pow(x / w * 2, 2) - .18 * h * Math.pow(ky - .45, 2));
  }
  geo.computeVertexNormals();
}
const leafGeo = (() => { const g = new THREE.ShapeGeometry(leafShape(.55, .95), 6); bendLeaf(g, .55, .95, .12, 0); g.translate(0, .48, 0); return g; })();

// ——— дерево ———
const bark = (() => {
  const c = document.createElement('canvas'); c.width = 256; c.height = 512; const x = c.getContext('2d');
  x.fillStyle = '#7a4b2a'; x.fillRect(0, 0, 256, 512); const r = rng(5);
  for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(${40 + r() * 40},${22 + r() * 20},${10},${.25 + r() * .3})`; x.fillRect(r() * 256, r() * 512, 3 + r() * 8, 30 + r() * 90); }
  for (let i = 0; i < 120; i++) { x.fillStyle = `rgba(190,140,90,${.15 + r() * .2})`; x.fillRect(r() * 256, r() * 512, 2 + r() * 4, 20 + r() * 60); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const barkMat = new THREE.MeshStandardMaterial({ map: bark, roughness: .9, color: 0xffffff });
function limb(a, b, r0, r1, mat = barkMat, seg = 12) {
  const len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1);
  const t = bark.clone(); t.repeat.set(1, len / 1.2); t.needsUpdate = true;
  const m = new THREE.Mesh(g, mat === barkMat ? new THREE.MeshStandardMaterial({ map: t, roughness: .9 }) : mat);
  m.position.copy(a).add(b).multiplyScalar(.5);
  m.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize());
  m.castShadow = m.receiveShadow = true; scene.add(m);
  const j = new THREE.Mesh(new THREE.SphereGeometry(r1, seg, 8), m.material); j.position.copy(b); scene.add(j);
  return m;
}
// ветка героев: из глубины кроны к краю
const B0 = V(-7, .2, 0), B1 = V(2.3, .72, 0), BR0 = .34, BR1 = .1;
const brAt = u => vlerp(B0, B1, u), brR = u => lerp(BR0, BR1, u);
const uOfX = x => (x - B0.x) / (B1.x - B0.x);
const TRUNK = V(-3, -14, -5), CROWN = V(-3, 1.5, -5), CR = V(10.5, 6, 6.5);
limb(TRUNK, V(-3, -3, -5), 1.3, .85);
limb(V(-3, -3.5, -5), B0, .7, BR0);
limb(B0, B1, BR0, BR1);
{ const r = rng(9); for (let i = 0; i < 14; i++) { const a = r() * Math.PI * 2, e = .1 + r() * .9; const end = CROWN.clone().add(V(Math.cos(a) * CR.x * .8, (e - .3) * CR.y * 1.1, Math.sin(a) * CR.z * .8)); if (end.z > -.5 && Math.abs(end.x) < 4) continue; limb(V(-3, -3 + r() * 2, -5), end, .45, .08, barkMat, 8); } }
// веточка Лёвы
const uTw = uOfX(.1), TW0 = brAt(uTw), GRIP = V(.16, .1, .1);
const twig = limb(TW0, GRIP, .07, .045);
const twigTip = new THREE.Mesh(new THREE.SphereGeometry(.05, 10, 8), twig.material); twigTip.position.copy(GRIP); scene.add(twigTip);

// крона: тысячи листьев
const NL = 9500;
const crownMat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: .62, metalness: 0 });
const crown = new THREE.InstancedMesh(leafGeo, crownMat, NL);
crown.receiveShadow = true;
const LF = [];
{
  const r = rng(21), col = new THREE.Color(), m = new THREE.Matrix4();
  let n = 0, guard = 0;
  while (n < NL && guard++ < 200000) {
    const d = V(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1); if (d.lengthSq() > 1 || d.lengthSq() < .01) continue;
    const k = Math.pow(d.length(), .55) / d.length(); d.multiplyScalar(k);
    const p = V(CROWN.x + d.x * CR.x, CROWN.y + d.y * CR.y, CROWN.z + d.z * CR.z);
    // свободный коридор у героев
    if (p.z > -1.4 && p.x > -3.4 && p.x < 2.4 && p.y > -2.6 && p.y < 2.4) continue;
    if (p.z > -.3 && p.x > -4.5 && p.x < 3 && p.y > -3.5 && p.y < 3.5) continue;
    const out = d.clone().normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), out.add(V(r() - .5, r() - .2, r() - .5).multiplyScalar(1.4)).normalize());
    q.multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), r() * Math.PI * 2));
    const s = .7 + r() * .55;
    const depth = d.length(), top = (d.y + 1) / 2;
    col.setHSL((88 + r() * 40) / 360, .55 + r() * .25, (.2 + .26 * depth + .1 * top) * (.85 + r() * .3));
    if (r() < .05) col.setHSL((62 + r() * 18) / 360, .75, .5);
    crown.setColorAt(n, col);
    LF.push({ p, q, s, ph: r() * 6.28, f: .6 + r() * .8 });
    m.compose(p, q, V(s, s, s)); crown.setMatrixAt(n, m); n++;
  }
  crown.count = n;
}
scene.add(crown);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = V(1, 1, 1);
function swayCrown(t) {
  const w = wind(t), wi = wint(t);
  for (let i = 0; i < crown.count; i++) {
    const L = LF[i];
    const a = (.06 + w * .5) * Math.sin(t * 3 * L.f + L.ph + wi * 4) + w * .25;
    _e.set(a * .8, a * .3, a * .6); _q.setFromEuler(_e).premultiply(L.q);
    _s.setScalar(L.s); _m.compose(L.p, _q, _s); crown.setMatrixAt(i, _m);
  }
  crown.instanceMatrix.needsUpdate = true;
}

// фон: земля, трава, деревья вокруг
{
  const g = new THREE.PlaneGeometry(600, 600); g.rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x5fae35, roughness: 1 })); ground.position.y = -14; scene.add(ground);
  const r = rng(33);
  const blobGeo = new THREE.IcosahedronGeometry(1, 3);
  { const p = blobGeo.attributes.position; for (let i = 0; i < p.count; i++) { const v = V(p.getX(i), p.getY(i), p.getZ(i)); const k = 1 + .12 * Math.sin(v.x * 7 + v.y * 5) * Math.cos(v.z * 6); p.setXYZ(i, v.x * k, v.y * k, v.z * k); } blobGeo.computeVertexNormals(); }
  const blobs = new THREE.InstancedMesh(blobGeo, new THREE.MeshStandardMaterial({ roughness: .85, flatShading: true }), 900);
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(.6, 1, 1, 8), new THREE.MeshStandardMaterial({ color: 0x6b4426, roughness: .9 }), 120);
  const col = new THREE.Color(), m = new THREE.Matrix4(); let nb = 0, nt = 0;
  for (let i = 0; i < 110; i++) {
    const a = r() * Math.PI * 2, d = 24 + r() * 90;
    const x = CROWN.x + Math.cos(a) * d, z = CROWN.z + Math.sin(a) * d;
    if (z > 8 && Math.abs(x - 4) < 18 && d < 40) continue;
    const h = 10 + r() * 14, cr = 4 + r() * 4;
    m.compose(V(x, -14 + h / 2, z), new THREE.Quaternion(), V(1, h, 1)); trunks.setMatrixAt(nt++, m);
    for (let k = 0; k < 7; k++) {
      const s = cr * (.5 + r() * .5);
      m.compose(V(x + (r() - .5) * cr * 1.4, -14 + h + (r() - .3) * cr, z + (r() - .5) * cr * 1.4), new THREE.Quaternion(), V(s, s * .85, s));
      col.setHSL((85 + r() * 40) / 360, .55, .3 + r() * .15); blobs.setColorAt(nb, col); blobs.setMatrixAt(nb++, m);
    }
  }
  blobs.count = nb; trunks.count = nt; scene.add(blobs, trunks);
  // трава и цветы
  const grass = new THREE.InstancedMesh(new THREE.ConeGeometry(.12, 1, 4), new THREE.MeshStandardMaterial({ roughness: 1 }), 4000);
  for (let i = 0; i < 4000; i++) {
    const x = CROWN.x + (r() - .5) * 90, z = CROWN.z + (r() - .3) * 80, s = .6 + r();
    m.compose(V(x, -14 + s / 2, z), new THREE.Quaternion().setFromEuler(new THREE.Euler((r() - .5) * .5, 0, (r() - .5) * .5)), V(s, s, s));
    col.setHSL((80 + r() * 40) / 360, .6, .3 + r() * .2); grass.setColorAt(i, col); grass.setMatrixAt(i, m);
  }
  scene.add(grass);
  const fl = new THREE.InstancedMesh(new THREE.SphereGeometry(.22, 8, 6), new THREE.MeshStandardMaterial({ roughness: .6, emissive: 0x221100 }), 600);
  const FC = [0xff5d8f, 0xffd23f, 0xffffff, 0xff8a3d, 0xb68cff];
  for (let i = 0; i < 600; i++) {
    m.compose(V(CROWN.x + (r() - .5) * 70, -13.4, CROWN.z + (r() - .3) * 60), new THREE.Quaternion(), V(1, .6, 1));
    fl.setColorAt(i, col.set(FC[i % 5])); fl.setMatrixAt(i, m);
  }
  scene.add(fl);
}

// ——— материалы персонажей ———
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .45, ...o });
const mat = {
  white: M(0xffffff, { roughness: .2 }), pupil: M(0x15101a, { roughness: .15 }), mouth: M(0x5a1626, { roughness: .6 }),
  tongue: M(0xff6f86), blush: new THREE.MeshBasicMaterial({ color: 0xff7a8a, transparent: true, opacity: 0, depthWrite: false }),
  brow: M(0x2a4a12), stem: M(0x7c9a2a), lev: M(0xffffff, { roughness: .5, vertexColors: true }), vein: M(0xd8f78a, { roughness: .5 }),
  cat: M(0x8be03c, { roughness: .4 }), cat2: M(0x6cc22c, { roughness: .4 }), spot: M(0xffd84a, { roughness: .35 }),
  feet: M(0x2f5a16), ant: M(0x3a6b1a), antTip: M(0xff8a2a, { roughness: .3 }), teeth: M(0xfffbe8, { roughness: .3 }),
};
const sph = (r, m, ws = 24, hs = 16) => { const o = new THREE.Mesh(new THREE.SphereGeometry(r, ws, hs), m); o.castShadow = true; return o; };
const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 10);
function setRod(o, a, b, r) { o.position.copy(a).add(b).multiplyScalar(.5); o.scale.set(r, Math.max(a.distanceTo(b), 1e-4), r); o.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize()); }
const rod = m => { const o = new THREE.Mesh(cylGeo, m); o.castShadow = true; return o; };

// лицо (общая сборка для Лёвы и Гоши)
function makeEye(r) {
  const g = new THREE.Group();
  const w = sph(r, mat.white); w.scale.z = .55; g.add(w);
  const p = sph(r * .5, mat.pupil, 16, 12); p.scale.z = .5; p.position.z = r * .42; g.add(p);
  const hl = sph(r * .16, mat.white, 10, 8); hl.position.set(r * .14, r * .2, r * .62); p.add(hl); hl.position.set(r * .15, r * .18, r * .2);
  const lidT = sph(r * 1.06, null, 24, 12); lidT.castShadow = false; g.add(lidT);
  const sq = new THREE.Group(); g.add(sq);   // зажмуренный глаз «>»
  for (const s of [1, -1]) { const o = rod(mat.pupil); setRod(o, V(-r * .7, s * r * .35, .02), V(r * .5, 0, .02), r * .13); sq.add(o); }
  g.userData = { w, p, lidT, sq, r };
  return g;
}
function setEye(e, { look = [0, 0], open = 1, lid = 0, squeeze = false, flip = 1, skin }) {
  const { w, p, lidT, sq, r } = e.userData;
  w.visible = p.visible = !squeeze; sq.visible = squeeze; sq.scale.x = flip;
  w.scale.y = Math.max(.08, open); p.scale.y = .5 * Math.max(.08, open) / 1 + .5 * (open > .3 ? 1 : open);
  p.position.set(look[0] * r * .45, look[1] * r * .4 * open, r * .42);
  lidT.material = skin; lidT.visible = lid > .02 && !squeeze;
  // верхнее веко: срезаем сферу поворотом и сжатием
  lidT.scale.set(1.04, 1.04 * lid, .62); lidT.position.set(0, r * (1 - lid) * .98, .01);
}
function makeMouth(r) {
  const g = new THREE.Group();
  const hole = sph(r, mat.mouth); hole.scale.set(1, .5, .35); g.add(hole);
  const tg = sph(r * .55, mat.tongue, 16, 10); tg.scale.set(1.2, .6, .5); tg.position.set(0, -r * .28, r * .12); g.add(tg);
  const sm = new THREE.Mesh(new THREE.TorusGeometry(r * .8, r * .1, 8, 24, Math.PI * .8), mat.mouth); sm.rotation.z = Math.PI * 1.1; g.add(sm);
  g.userData = { hole, tg, sm, r };
  return g;
}
function setMouth(mo, { open = 0, wide = 1, smile = 1, tongueOut = 0 }) {
  const { hole, tg, sm, r } = mo.userData;
  const shut = open < .06 && tongueOut < .05;
  hole.visible = tg.visible = !shut; sm.visible = shut;
  hole.scale.set(wide * (1 + open * .15), .16 + open * .95, .35);
  tg.position.set(0, -r * (.15 + .45 * open) - tongueOut * r * .45, r * (.12 + tongueOut * .25)); tg.scale.set(1.2, .6 + tongueOut * .5, .5);
  sm.scale.set(wide, smile, 1); sm.rotation.z = smile >= 0 ? Math.PI * 1.1 : Math.PI * .1; sm.scale.y = Math.abs(smile) + .001;
}

// ——— Лёва (лист) ———
const lev = new THREE.Group(); scene.add(lev);
const levBody = new THREE.Group(); lev.add(levBody);
const LW = 1.15, LH = 1.55;
{
  const g = new THREE.ExtrudeGeometry(leafShape(LW, LH), { depth: .02, bevelEnabled: true, bevelThickness: .07, bevelSize: .045, bevelSegments: 5, curveSegments: 28 });
  g.translate(0, -.12, -.045);
  const p = g.attributes.position, c = [], ca = new THREE.Color(0x3fae2a), cb = new THREE.Color(0xa6e640), cc = new THREE.Color();
  for (let i = 0; i < p.count; i++) { const k = clamp(-p.getY(i) / LH); cc.copy(ca).lerp(cb, Math.pow(k, .8)); cc.offsetHSL(0, 0, .05 * Math.abs(p.getX(i)) / LW); c.push(cc.r, cc.g, cc.b); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  bendLeaf(g, LW, LH, .06, -.1);
  const leaf = new THREE.Mesh(g, mat.lev); leaf.castShadow = true; leaf.receiveShadow = true; levBody.add(leaf);
  // прожилки
  const zf = z => z;
  const mid = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(0, -.12, .07), V(0, -.7, .1), V(0, -1.2, .07), V(0, -1.55, .03)]), 20, .022, 6), mat.vein); levBody.add(mid);
  for (const [y, s] of [[-.45, 1], [-.45, -1], [-.82, 1], [-.82, -1], [-1.17, 1], [-1.17, -1]]) {
    const v = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(0, y, .09), V(s * .22, y - .1, .08), V(s * .38 * (1.25 + y * .3), y - .26, .05)]), 10, .013, 5), mat.vein); levBody.add(v);
  }
  const stem = rod(mat.stem); setRod(stem, V(0, .02, 0), V(0, -.2, .02), .035); levBody.add(stem);
}
const levFace = new THREE.Group(); levFace.position.set(0, -.62, .13); levBody.add(levFace);
const levEyes = [makeEye(.15), makeEye(.15)]; levEyes[0].position.set(-.19, .02, 0); levEyes[1].position.set(.19, .02, 0); levFace.add(...levEyes);
const levMouth = makeMouth(.13); levMouth.position.set(0, -.3, 0); levFace.add(levMouth);
const levBrows = [rod(mat.brow), rod(mat.brow)]; levFace.add(...levBrows);
const levBlush = [0, 1].map(i => { const o = new THREE.Mesh(new THREE.CircleGeometry(.09, 20), mat.blush); o.position.set(i ? .33 : -.33, -.16, .02); levFace.add(o); return o; });
const levArms = [0, 1].map(() => ({ up: rod(mat.stem), lo: rod(mat.stem), el: sph(.035, mat.stem, 10, 8), hand: sph(.065, mat.stem, 14, 10) }));
levArms.forEach(a => lev.add(a.up, a.lo, a.el, a.hand));
const levLegs = [0, 1].map(() => ({ leg: rod(mat.stem), foot: sph(.06, mat.stem, 12, 8) }));
levLegs.forEach(a => levBody.add(a.leg, a.foot));

// ——— Гоша (гусеница) ———
const gosha = new THREE.Group(); scene.add(gosha);
const NS = 9, SP = .4;
const segs = [];
for (let i = 0; i < NS; i++) {
  const r = i === 0 ? .44 : lerp(.33, .22, (i - 1) / (NS - 2));
  const o = sph(r, i % 2 ? mat.cat2 : mat.cat, 28, 18); o.receiveShadow = true; gosha.add(o);
  const sp = []; if (i > 0) for (const s of [-1, 1]) { const d = sph(r * .22, mat.spot, 12, 8); o.add(d); d.position.set(s * r * .5, r * .72, r * .2); sp.push(d); }
  const ft = []; if (i > 0) for (const s of [-1, 1]) { const f = sph(r * .2, mat.feet, 10, 8); o.add(f); f.position.set(0, -r * .85, s * r * .55); ft.push(f); }
  segs.push({ o, r });
}
const head = segs[0].o;
const gFace = new THREE.Group(); head.add(gFace);
const gEyes = [makeEye(.16), makeEye(.16)]; gEyes[0].position.set(-.17, .14, .34); gEyes[1].position.set(.17, .14, .34); gFace.add(...gEyes);
gEyes.forEach((e, i) => { e.rotation.y = (i ? .22 : -.22); });
const gMouth = makeMouth(.15); gMouth.position.set(0, -.16, .4); gFace.add(gMouth);
const gTeeth = [0, 1].map(i => { const o = new THREE.Mesh(new THREE.BoxGeometry(.07, .07, .03), mat.teeth); o.position.set(i ? .045 : -.045, -.02, .05); gMouth.add(o); return o; });
const gBrows = [rod(mat.feet), rod(mat.feet)]; gFace.add(...gBrows);
const gAnt = [0, 1].map(i => { const a = rod(mat.ant), t = sph(.07, mat.antTip, 14, 10); head.add(a, t); return { a, t, s: i ? 1 : -1 }; });
const gTwig = rod(barkMat); gTwig.visible = false; gMouth.add(gTwig);
const gBlush = [0, 1].map(i => { const o = new THREE.Mesh(new THREE.CircleGeometry(.07, 16), new THREE.MeshBasicMaterial({ color: 0xff8a7a, transparent: true, opacity: .55, depthWrite: false })); o.position.set(i ? .3 : -.3, -.08, .32); o.rotation.y = i ? .6 : -.6; gFace.add(o); return o; });

// ——— летящие листья и пыльца (в пространстве камеры) ———
const NF = 110;
const flyMat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: .6 });
const fly = new THREE.InstancedMesh(leafGeo, flyMat, NF); camera.add(fly);
const FL = [];
{ const r = rng(77), col = new THREE.Color(); for (let i = 0; i < NF; i++) { const z = -(3.2 + Math.pow(r(), 1.2) * 18); FL.push({ x: r(), y: r(), z, sp: .7 + r() * .8, ph: r() * 6.3, s: .5 + r() * .5, fall: .15 + r() * .25 }); col.setHSL((r() < .2 ? 50 + r() * 15 : 85 + r() * 35) / 360, .7, .38 + r() * .18); fly.setColorAt(i, col); } }
const pollen = (() => {
  const N = 220, r = rng(88), pos = new Float32Array(N * 3), D = [];
  for (let i = 0; i < N; i++) D.push({ x: r(), y: r(), z: -(1 + r() * 14), ph: r() * 6.3 });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,250,210,1)'); gr.addColorStop(.35, 'rgba(255,230,150,.6)'); gr.addColorStop(1, 'rgba(255,220,120,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  const p = new THREE.Points(g, new THREE.PointsMaterial({ map: new THREE.CanvasTexture(c), size: .03, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  p.frustumCulled = false; camera.add(p); return { p, D, pos };
})();
// лучи солнца
const rays = (() => {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256; const x = c.getContext('2d');
  const gr = x.createLinearGradient(0, 0, 64, 0); gr.addColorStop(0, 'rgba(255,240,190,0)'); gr.addColorStop(.5, 'rgba(255,240,190,1)'); gr.addColorStop(1, 'rgba(255,240,190,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 256); const g2 = x.createLinearGradient(0, 0, 0, 256); g2.addColorStop(0, 'rgba(0,0,0,0)'); g2.addColorStop(.2, 'rgba(0,0,0,1)'); g2.addColorStop(1, 'rgba(0,0,0,0)');
  x.globalCompositeOperation = 'destination-in'; x.fillStyle = g2; x.fillRect(0, 0, 64, 256);
  const tex = new THREE.CanvasTexture(c), out = [];
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .14, fog: false }));
    m.renderOrder = 10; camera.add(m); out.push(m);
  }
  return out;
})();

// ——— постобработка ———
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), .38, .55, .82); composer.addPass(bloom);
composer.addPass(new OutputPass());

// ——— речь ———
function speech(who, t) {
  for (const L of ST.lines) {
    if (L.who !== who || !L.env) continue;
    const i = Math.floor((t - L.t0) * FPS);
    if (i >= 0 && i < L.env.length) { const a = L.env[i], b = L.env[i + 1] ?? 0, k = (t - L.t0) * FPS - i; return clamp(lerp(a, b, k) * 1.15); }
  }
  return 0;
}

// ——— анимация Лёвы ———
const flightStart = EV.rip;
function levFlight(t) {   // траектория после отрыва
  const k = t - flightStart;
  const wi = wint(t) - wint(flightStart);
  return V(GRIP.x + wi * 2.2 + Math.sin(k * 3) * .35 * k, GRIP.y - .6 + k * 1.6 + k * k * .25 + Math.sin(k * 4.2) * .3, GRIP.z + Math.sin(k * 1.7) * .9 - k * .8);
}
function poseLev(t) {
  const shot = shotOf(t), w = wind(t);
  const flying = t >= flightStart;
  levBody.rotation.set(0, 0, 0); levBody.position.set(0, 0, 0);
  let look = [0, 0], open = 1, lid = .1, squeeze = false, brow = 0, browY = 0, smile = .8, blush = 0, wide = 1;
  const talk = speech('L', t);
  if (!flying) {
    lev.position.copy(GRIP); lev.rotation.set(0, 0, 0);
    // раскачивание на ветке: тело качается вокруг рук
    const sw = (.05 + w * .35) * Math.sin(t * 7.5 + vn(t * 3) * 2) + w * .28;
    levBody.rotation.set(-w * .5 + Math.sin(t * 11) * w * .12, Math.sin(t * 5.3) * w * .3, sw);
    levBody.position.set(0, .02 * Math.sin(t * 2), 0);
    if (t < SH.D) { squeeze = true; brow = -.5; smile = -.6; wide = 1.2; }
    if (shot === 'D') { open = 1; look = [-.2, -.3]; lid = .38; blush = ss(seg(t, EV.blush, EV.blush + .5)); brow = .35; browY = .02; smile = .9; levBody.rotation.y += Math.sin(t * 2.4) * .12; }
    if (shot === 'E') { open = lerp(1, 1.25, seg(t, 12.2, 12.5)); look = [-.7, .55]; lid = 0; brow = .6; browY = .06; smile = -.7; blush = 1 - seg(t, 11.1, 11.6); levBody.position.x = Math.sin(t * 40) * .012 * seg(t, 12.2, 12.5); }
    if (shot === 'F' || t >= EV.rip - .1) { squeeze = false; open = 1.2; look = [.3, .6]; lid = 0; brow = .6; smile = .3; }
  } else {
    const p = levFlight(t); lev.position.copy(p);
    const k = t - flightStart;
    lev.rotation.set(Math.sin(k * 2.2) * .5, Math.sin(k * 1.3) * .6, Math.sin(k * 3.1) * .7 - .3);
    open = 1.15; look = [0, .3]; lid = 0; brow = .5; browY = .05; smile = 1; wide = 1.1;
    if (shot === 'K') { lev.rotation.set(Math.sin(t * 1.4) * .25, Math.sin(t * .9) * .4, Math.sin(t * 1.7) * .2); look = [0, 0]; brow = 0; browY = .08; smile = 1.5; wide = 1.3; }
  }
  // моргание
  const bl = [1.9, 6.1, 10.1, 17.3, 20.6].some(b => t > b && t < b + .12);
  if (bl && !squeeze) open = .08;
  levEyes.forEach((e, i) => setEye(e, { look, open, lid, squeeze, flip: i ? -1 : 1, skin: mat.lev }));
  levEyes.forEach(e => { e.userData.lidT.material = mat.cat; });
  levBrows.forEach((b, i) => { const s = i ? 1 : -1; setRod(b, V(s * .27, .2 + browY + (squeeze ? -.02 : 0) - brow * .04, .05), V(s * .11, .2 + browY + brow * .05 * (squeeze ? -1 : 1), .05), .026); });
  setMouth(levMouth, { open: talk * (t >= 13.5 ? 1.3 : 1) + (squeeze && talk < .05 ? 0 : 0), wide, smile: talk > .06 ? smile : smile });
  if (t < SH.D && talk < .06) setMouth(levMouth, { open: .18, wide: 1.25, smile: -.5 });   // стиснул зубы
  mat.blush.opacity = .65 * blush;
  // руки
  lev.updateMatrixWorld(true);
  levArms.forEach((a, i) => {
    const s = i ? 1 : -1;
    const sh = levBody.localToWorld(V(s * .4, -.62, .06)); lev.worldToLocal(sh);
    let hand;
    if (!flying) hand = V(s * .08, .02, .04);
    else { const k = t - flightStart; hand = V(s * (.75 + .1 * Math.sin(k * 9 + i)), -.35 + .35 * Math.sin(k * 8 + i * 2.5), .15); }
    const el = sh.clone().lerp(hand, .5).add(V(s * .16, -.05, .08));
    setRod(a.up, sh, el, .028); setRod(a.lo, el, hand, .028); a.el.position.copy(el); a.hand.position.copy(hand);
  });
  levLegs.forEach((a, i) => {
    const s = i ? 1 : -1, k = t * (flying ? 9 : 4) + i * 2;
    const hip = V(s * .17, -1.42, .04), ft = V(s * (.25 + .05 * Math.sin(k)), -1.78 + .06 * Math.sin(k * 1.3), .1 + .05 * Math.cos(k));
    setRod(a.leg, hip, ft, .028); a.foot.position.copy(ft);
  });
  lev.visible = true;
}

// ——— анимация Гоши ———
function branchTop(u, r) { const p = brAt(u); p.y += brR(u) + r * .85; return p; }
function polySample(pts, d) {   // точка на ломаной на расстоянии d
  for (let i = 0; i < pts.length - 1; i++) { const l = pts[i].distanceTo(pts[i + 1]); if (d <= l || i === pts.length - 2) return vlerp(pts[i], pts[i + 1], clamp(d / l)); d -= l; }
  return pts[pts.length - 1].clone();
}
function poseGosha(t) {
  const shot = shotOf(t);
  // голова по ветке
  const uStop = uOfX(-.62);
  let uH = lerp(uOfX(-3.6), uStop, eio(seg(t, SH.B - .4, SH.B + 2.2)));
  const crawling = t > SH.B - .4 && t < SH.B + 2.2;
  const anchor = branchTop(uH, .3);
  // куда тянется голова
  let H = anchor.clone().add(V(.15, .32, .1));
  let lean = 0;
  if (shot === 'E' || shot === 'F') {
    lean = eo(seg(t, EV.lunge, EV.lunge + .45));
    const pre = ss(seg(t, SH.E, SH.E + .8)) * .5;
    const tgt = V(GRIP.x - .05, GRIP.y + .02, GRIP.z + .25);   // веточка, где был Лёва
    H = vlerp(anchor.clone().add(V(.3, .45 + pre * .2, .25)), tgt, lean);
    if (t > EV.chomp + .25) H = vlerp(tgt, anchor.clone().add(V(.25, .35, .2)), ss(seg(t, EV.chomp + .25, EV.chomp + 1.3)));
  }
  if (shot === 'G' || shot === 'K') H = anchor.clone().add(V(.2, .38, .2));
  const ctrl = anchor.clone().add(V(-.1, .1, 0)).lerp(H, .4).add(V(0, .25 * (1 - lean), 0));
  const front = []; for (let i = 0; i <= 10; i++) { const k = i / 10, a = 1 - k; front.push(V(0, 0, 0).addScaledVector(H, a * a).addScaledVector(ctrl, 2 * a * k).addScaledVector(anchor, k * k)); }
  const backPts = []; for (let i = 1; i <= 8; i++) backPts.push(branchTop(uH - i * .06, .26));
  const pts = [...front, ...backPts];
  const phase = crawling ? (t - SH.B) * 2.4 : 0;
  for (let i = 0; i < NS; i++) {
    const d = i * SP * (i === 1 ? 1.15 : 1) + (i > 1 ? .06 : 0);
    const p = polySample(pts, d);
    if (i > 0) p.y += crawling ? .16 * Math.max(0, Math.sin(i * .9 - phase * 6.28)) : .015 * Math.sin(t * 3 + i);
    segs[i].o.position.copy(p);
    segs[i].o.scale.setScalar(1 + .03 * Math.sin(t * 2.2 - i * .7));
  }
  // голова смотрит
  const hd = segs[0].o, tgtLook = V(0, 0, 0);
  let lookAt = V(hd.position.x + .6, hd.position.y - .2, hd.position.z + 2.5);   // на зрителя/Лёву
  if (shot === 'B' || shot === 'C') lookAt = V(GRIP.x + 1, GRIP.y - 1.2, 3);
  if (shot === 'E' && t < EV.lunge) lookAt = V(GRIP.x + .4, GRIP.y - .8, 2.5);
  if (shot === 'G') { const k = t - SH.G; lookAt = V(hd.position.x + (k < 1.3 ? 1.5 : Math.sin((k - 1.3) * 2.2) * 2.5), hd.position.y + (k > 1.3 ? .4 : 0), hd.position.z + 2.5); }
  hd.lookAt(lookAt);
  hd.rotation.z += Math.sin(t * 1.7) * .06;
  // лицо
  const talk = speech('G', t);
  let lid = .45, look = [0, -.1], brow = -.3, smile = .9, tongueOut = 0, open = talk, wide = 1;
  if (shot === 'B' || shot === 'C') { lid = .5; smile = .9; look = [.1, -.2]; }
  if (shot === 'C' && t > EV.reveal + 1.6) { look = [.6, .2]; }
  if (shot === 'E') { lid = .3; brow = -.5; look = [.2, -.3]; tongueOut = ss(seg(t, EV.lick, EV.lick + .2)) * (1 - ss(seg(t, EV.lick + .45, EV.lick + .6))); open = Math.max(open, tongueOut * .5); if (t > EV.lunge) { open = 1.25 * (1 - ss(seg(t, EV.chomp - .05, EV.chomp + .05))); lid = 0; wide = 1.25; } }
  if (shot === 'F') { if (t > EV.chomp) { open = .15 + .25 * Math.max(0, Math.sin((t - EV.chomp) * 14)); lid = lerp(0, .55, seg(t, EV.chomp + .3, EV.chomp + .8)); look = [.5, .6]; brow = .4; } }
  if (shot === 'G') { lid = .4; brow = .1; open = talk > .05 ? talk : .12 + .22 * Math.max(0, Math.sin((t - SH.G) * 13)); look = [.1, 0]; }
  if (shot === 'K') { open = .12 + .2 * Math.max(0, Math.sin(t * 12)); }
  const bl = [4.4, 7.4, 11.9, 18.0].some(b => t > b && t < b + .12);
  gEyes.forEach((e, i) => setEye(e, { look, open: bl ? .08 : 1, lid, skin: mat.cat }));
  gBrows.forEach((b, i) => { const s = i ? 1 : -1; setRod(b, V(s * .32, .36 - brow * .03, .3), V(s * .08, .36 + brow * .05, .37), .022); });
  setMouth(gMouth, { open, wide, smile, tongueOut });
  gTeeth.forEach(o => o.visible = open > .3);
  gAnt.forEach(a => { const b = V(a.s * .16, .36, .05), tip = V(a.s * (.32 + .04 * Math.sin(t * 5 + a.s)), .78, -.1 + .05 * Math.sin(t * 4)); setRod(a.a, b, tip, .022); a.t.position.copy(tip); });
  // веточка в зубах
  const chew = t > EV.chomp + .05;
  gTwig.visible = chew; twig.visible = twigTip.visible = !chew;
  if (chew) { const len = t > EV.crunch2 ? .18 : t > EV.crunch1 ? .32 : .46; setRod(gTwig, V(-len / 2, 0, .02), V(len / 2, .02, .02), .045); }
}

// ——— камера ———
const camPos = V(0, 0, 0), camTgt = V(0, 0, 0);
function shake(t, amt) { return V(vn(t * 6 + 1) * amt, vn(t * 6 + 9) * amt, 0); }
function poseCamera(t) {
  const shot = shotOf(t), w = gustAmp(t);
  let fov = 38, P, T;
  if (shot === 'A') { const k = seg(t, 0, SH.B), fp = levFace.getWorldPosition(V(0, 0, 0)); T = V(lerp(.12, fp.x, .6), fp.y - .1, 0); P = V(T.x + .2, T.y + .1, 3.5 - k * .5); }
  else if (shot === 'B') { const k = seg(t, SH.B, SH.C); P = V(-.9 + k * .2, .15, 5.8 - k * .3); T = V(-.75 + k * .25, .15, 0); }
  else if (shot === 'C') {
    const k = eio(seg(t, SH.C + .15, SH.C + 1.9)), d = seg(t, SH.C + 1.9, SH.D);
    P = vlerp(V(-.7, -.05, 4.7), V(13 + d * 1.5, 3 + d, 40 + d * 1.5), k); T = vlerp(V(-.5, -.05, 0), V(-2.5, -1.5, -4), k); fov = lerp(38, 42, k);
  }
  else if (shot === 'D') { const k = seg(t, SH.D, SH.E); P = V(.3, -.62, 2.9 - k * .35); T = V(.12, -.62, 0); }
  else if (shot === 'E') { const k = seg(t, SH.E, EV.lunge), k2 = eo(seg(t, EV.lunge, EV.lunge + .4)); const hp = segs[0].o.position; T = V(hp.x - .05, hp.y - .35, 0); P = V(T.x + .35, T.y - .25, 3.3 - k * .4 - k2 * .4); }
  else if (shot === 'F') {
    const k = t - flightStart, lp = levFlight(Math.max(t, flightStart));
    const follow = ss(seg(t, EV.chomp + .3, EV.chomp + 1.4));
    P = vlerp(V(.1, -.2, 4), lp.clone().add(V(-1.5, -1.2, 4.5)), follow); T = vlerp(V(0, .1, 0), lp, follow);
  }
  else if (shot === 'G') { const k = seg(t, SH.G, SH.K), hp = segs[0].o.position; T = V(hp.x - .3, hp.y - .2, 0); P = V(T.x + .25, T.y + .1, 3.9 - k * .5); }
  else { const lp = levFlight(t); const k = seg(t, SH.K, ST.dur); P = lp.clone().add(V(-1.2 - k * 2, .6 + k * 1.5, 4.2 + k * 4)); T = lp.clone().add(V(0, -.6 - k * 1.2, 0)); }
  P.add(shake(t, .012 + w * .05)); T.add(shake(t + 40, .006 + w * .02));
  camera.position.copy(P); camera.lookAt(T); camera.fov = fov; camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  // тень вокруг героев
  const c = shot === 'K' || (shot === 'F' && t > EV.chomp + .6) ? lev.position.clone() : V(-.3, 0, 0);
  sun.target.position.copy(c); sun.position.copy(c).add(V(6, 9, 7));
}
function poseCameraSpace(t) {
  const halfH = z => -z * Math.tan(camera.fov * Math.PI / 360), wi = wint(t);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const wrap = (v, a) => ((v % a) + a) % a;
  for (let i = 0; i < NF; i++) {
    const L = FL[i], hh = halfH(L.z) * 1.15, hw = hh * W / H * 1.3;
    const x = wrap(L.x * 2 * hw + wi * 2.2 * L.sp / Math.max(.5, -L.z * .15) * 1.0, 2 * hw) - hw;
    const y = wrap(L.y * 2 * hh - t * L.fall - wi * .4 * L.sp + Math.sin(t * 1.5 + L.ph) * .2, 2 * hh) - hh;
    e.set(t * 1.1 * L.sp + L.ph + wi * 3, t * .7 + L.ph * 2, Math.sin(t * 2 + L.ph) * 1.2 + wi * 2); q.setFromEuler(e);
    const vis = i < 25 + 85 * clamp(gustAmp(t)) ? 1 : 0;
    const s = L.s * Math.max(.5, -L.z * .06) * vis;
    m.compose(V(x, y, L.z), q, V(s, s, s)); fly.setMatrixAt(i, m);
  }
  fly.instanceMatrix.needsUpdate = true;
  const { D, pos, p } = pollen;
  D.forEach((d, i) => {
    const hh = halfH(d.z), hw = hh * W / H;
    pos[i * 3] = wrap(d.x * 2 * hw + wi * .8 + Math.sin(t * .6 + d.ph) * .1, 2 * hw) - hw;
    pos[i * 3 + 1] = wrap(d.y * 2 * hh + t * .05 + Math.cos(t * .5 + d.ph) * .1, 2 * hh) - hh;
    pos[i * 3 + 2] = d.z;
  });
  p.geometry.attributes.position.needsUpdate = true;
  rays.forEach((r, i) => {
    const z = -30, hh = halfH(z);
    r.position.set(hh * .9 - i * hh * .22, hh * .25 - i * .4, z);
    r.rotation.z = .55 + i * .05 + Math.sin(t * .3 + i) * .02;
    r.scale.set(hh * (.12 + .05 * hash(i)), hh * 2.8, 1);
    r.material.opacity = (.09 + .06 * hash(i * 3)) * (.75 + .25 * Math.sin(t * .8 + i * 1.7));
  });
}

// ——— 2D: текст поверх ———
const out = document.getElementById('out'), cx = out.getContext('2d');
await document.fonts.load('900 60px Rubik', 'ЁёАа'); await document.fonts.load('900 60px Unbounded', 'ЁёАа'); await document.fonts.load('900 60px Unbounded', 'Aa');
function wrapLines(text, maxW) { const words = text.split(' '), lines = []; let cur = ''; for (const w of words) { const n = cur ? cur + ' ' + w : w; if (cx.measureText(n).width > maxW && cur) { lines.push(cur); cur = w; } else cur = n; } lines.push(cur); return lines; }
function outlined(text, x, y, { size = 64, font = 'Rubik', fill = '#fff', stroke = '#173b0d', lw = 14, align = 'center', alpha = 1, scale = 1, rot = 0 } = {}) {
  cx.save(); cx.globalAlpha = alpha; cx.translate(x, y); cx.rotate(rot); cx.scale(scale, scale);
  cx.font = `900 ${size}px ${font}`; cx.textAlign = align; cx.textBaseline = 'middle'; cx.lineJoin = 'round';
  cx.strokeStyle = stroke; cx.lineWidth = lw; cx.strokeText(text, 0, 0);
  cx.shadowColor = 'rgba(0,0,0,.35)'; cx.shadowBlur = 12; cx.shadowOffsetY = 6; cx.fillStyle = fill; cx.fillText(text, 0, 0);
  cx.restore();
}
function overlay(t) {
  // виньетка
  const g = cx.createRadialGradient(W / 2, H * .45, H * .25, W / 2, H * .5, H * .75);
  g.addColorStop(0, 'rgba(10,30,5,0)'); g.addColorStop(1, 'rgba(10,30,5,.45)'); cx.fillStyle = g; cx.fillRect(0, 0, W, H);
  // крючок
  if (t < SH.B) {
    const k = back(seg(t, .05, .4)), a = 1 - seg(t, SH.B - .35, SH.B);
    outlined('ПОСЛЕДНИЙ ЛИСТ', W / 2, 250, { size: 76, font: 'Unbounded', fill: '#ffe14d', lw: 20, scale: k, alpha: a, rot: -.04 });
    outlined('НА ДЕРЕВЕ', W / 2, 355, { size: 68, font: 'Unbounded', fill: '#ffffff', lw: 18, scale: back(seg(t, .3, .65)), alpha: a, rot: -.04 });
  }
  // разоблачение: стрелка на Лёву
  if (t > EV.reveal + 1.4 && t < SH.D) {
    const p = GRIP.clone().add(V(0, -.7, 0)).project(camera), x = (p.x * .5 + .5) * W, y = (-p.y * .5 + .5) * H;
    const a = seg(t, EV.reveal + 1.4, EV.reveal + 1.7), bob = Math.sin(t * 8) * 10;
    cx.save(); cx.globalAlpha = a; cx.strokeStyle = '#ffe14d'; cx.lineWidth = 12; cx.lineCap = 'round';
    cx.beginPath(); cx.arc(x, y, 60 + bob * .3, 0, Math.PI * 2); cx.stroke();
    cx.beginPath(); cx.moveTo(x + 230, y - 260 + bob); cx.lineTo(x + 80, y - 80); cx.stroke();
    cx.beginPath(); cx.moveTo(x + 80, y - 80); cx.lineTo(x + 140, y - 95); cx.moveTo(x + 80, y - 80); cx.lineTo(x + 95, y - 140); cx.stroke(); cx.restore();
    outlined('ЛЁВА', x + 260, y - 310 + bob, { size: 70, fill: '#ffe14d', alpha: a });
    outlined('«последний»', W / 2, 330, { size: 84, font: 'Unbounded', fill: '#fff', lw: 18, alpha: seg(t, EV.reveal + 2.2, EV.reveal + 2.5), scale: back(seg(t, EV.reveal + 2.2, EV.reveal + 2.55)) });
  }
  // субтитры
  for (const L of ST.lines) {
    const end = L.sub1;
    if (t < L.t0 - .1 || t > end) continue;
    const a = seg(t, L.t0 - .1, L.t0 + .05) * (1 - seg(t, end - .15, end)), k = back(seg(t, L.t0 - .1, L.t0 + .2));
    cx.font = '900 70px Rubik';
    const lines = wrapLines(L.text, 900);
    const y0 = 1500 - (lines.length - 1) * 42;
    lines.forEach((ln, i) => outlined(ln, W / 2, y0 + i * 84, { size: 70, fill: L.who === 'G' ? '#ffe55c' : '#ffffff', alpha: a, scale: k }));
    outlined(L.who === 'G' ? 'ГОША' : 'ЛЁВА', W / 2, y0 - 80, { size: 38, fill: L.who === 'G' ? '#b8ff6a' : '#8ff0a8', lw: 10, alpha: a });
  }
  // финал
  if (t >= SH.K) {
    const k = t - SH.K;
    outlined('КУДА УЛЕТИТ', W / 2, 330, { size: 90, font: 'Unbounded', fill: '#fff', lw: 20, scale: back(seg(k, .1, .45)) });
    outlined('ЛЁВА?', W / 2, 450, { size: 120, font: 'Unbounded', fill: '#ffe14d', lw: 24, scale: back(seg(k, .3, .65)), rot: -.03 + Math.sin(t * 3) * .02 });
    outlined('Пиши в комментах ↓', W / 2, 1560 + Math.sin(t * 5) * 8, { size: 66, fill: '#fff', alpha: seg(k, .8, 1.1), scale: back(seg(k, .8, 1.15)) });
  }
  // вспышка при разоблачении и отрыве
  const fl = Math.max(1 - seg(t, EV.reveal, EV.reveal + .25), 0) * (t >= EV.reveal ? .5 : 0) + (t >= EV.rip ? (1 - seg(t, EV.rip, EV.rip + .2)) * .35 : 0);
  if (fl > 0) { cx.fillStyle = `rgba(255,255,230,${fl})`; cx.fillRect(0, 0, W, H); }
  // затемнение в конце
  const fade = seg(t, ST.dur - .25, ST.dur); if (fade > 0) { cx.fillStyle = `rgba(0,0,0,${fade})`; cx.fillRect(0, 0, W, H); }
}

function renderAt(t) {
  poseLev(t); poseGosha(t); swayCrown(t); poseCamera(t); poseCameraSpace(t);
  composer.render();
  cx.filter = 'saturate(1.3) contrast(1.1)'; cx.drawImage(gl, 0, 0); cx.filter = 'none'; overlay(t);
}
window.renderAt = renderAt;
window.frameJPEG = (t, q = .93) => { renderAt(t); return out.toDataURL('image/jpeg', q); };
const qs = new URLSearchParams(location.search);
renderAt(parseFloat(qs.get('t') ?? '0'));
window.ready = true;
