// Сцена «Клодик и котик у озера»: закат, озеро с отражениями, мостик, камыши, кувшинки, светлячки.
// Экспортирует сцену, камеру, персонажей и функции позы; таймлайн живёт в main.js.
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const W = 1080, H = 1920;
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const seg = (t, a, b) => clamp((t - a) / (b - a));
export const ss = k => k * k * (3 - 2 * k);
export const eio = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
export const eo = k => 1 - Math.pow(1 - k, 3);
export const back = k => { const c = 2.2; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
export const spring = k => k <= 0 ? 0 : 1 - Math.exp(-7 * k) * Math.cos(11 * k);
export const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const vlerp = (a, b, k) => a.clone().lerp(b, k);
export const hash = n => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };
export const vn = x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i), hash(i + 1), u) * 2 - 1; };
export function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

export const gl = document.createElement('canvas'); gl.width = W; gl.height = H;
export const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
export const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xffb98a, 30, 140);
export const camera = new THREE.PerspectiveCamera(36, W / H, .05, 400);
scene.add(camera);

// ——— небо: золотой час ———
export const SUN_DIR = V(.08, .07, 1).normalize();
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { sun: { value: SUN_DIR }, time: { value: 0 } },
  vertexShader: 'varying vec3 vd; void main(){ vd = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: `varying vec3 vd; uniform vec3 sun; uniform float time;
    float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5); }
    float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
    void main(){
      float y = vd.y;
      vec3 top = vec3(.18,.22,.55), mid = vec3(.98,.55,.42), low = vec3(1.,.78,.45);
      vec3 c = mix(low, mid, smoothstep(0., .18, y)); c = mix(c, top, smoothstep(.15, .7, y));
      float s = max(dot(vd, sun), 0.);
      c += vec3(1.,.6,.3) * pow(s, 6.) * .7 + vec3(1.,.85,.6) * pow(s, 60.) * 1.2 + vec3(1.,.95,.8) * smoothstep(.9985, .9992, s) * 6.;
      // облака-полоски, подсвеченные снизу
      vec2 p = vd.xz / max(vd.y + .08, .02);
      float cl = smoothstep(.55, .85, n(p * vec2(.6, 2.2) + vec2(time * .01, 0.)) * n(p * 1.3 + 3.)*1.6);
      c = mix(c, vec3(1.,.62,.55) * (1. + pow(s, 3.)), cl * smoothstep(.02, .12, y) * (1. - smoothstep(.35, .6, y)) * .8);
      c *= mix(1., .55, smoothstep(-.02, -.2, y));
      gl_FragColor = vec4(c, 1.); }`
});
scene.add(new THREE.Mesh(new THREE.SphereGeometry(300, 48, 24), skyMat));

// ——— свет ———
const sun = new THREE.DirectionalLight(0xffb070, 3.2);
sun.position.copy(SUN_DIR).multiplyScalar(20).add(V(0, 3, 0)); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -.0004; sun.shadow.normalBias = .02;
Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 50 });
scene.add(sun, sun.target);
scene.add(new THREE.HemisphereLight(0x9fb6ff, 0x5a3a2a, 1.25));
const fill = new THREE.DirectionalLight(0xffd2b0, 1.5); fill.position.set(-2, 3, 6); scene.add(fill);   // тёплый свет на лица со стороны воды
const fill2 = new THREE.DirectionalLight(0xc8b8ff, .9); fill2.position.set(3, 2, -5); scene.add(fill2);
export const lantern = new THREE.PointLight(0xffc070, 3, 4, 1.8); lantern.position.set(.95, 1.25, -.25); scene.add(lantern);

// ——— вода с отражениями ———
const WaterShader = {
  name: 'Water',
  uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null }, time: { value: 0 }, sun: { value: SUN_DIR }, ripple: { value: 0 }, rippleAt: { value: new THREE.Vector2() } },
  vertexShader: `uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vW;
    void main(){ vUv = textureMatrix * vec4(position,1.); vW = (modelMatrix*vec4(position,1.)).xyz; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform vec3 color; uniform sampler2D tDiffuse; uniform float time; uniform vec3 sun; uniform float ripple; uniform vec2 rippleAt;
    varying vec4 vUv; varying vec3 vW;
    vec2 wave(vec2 p){ vec2 g = vec2(0.);
      g += vec2(.8,.6)*cos(dot(p, vec2(.8,.6))*1.7 + time*1.1)*.5;
      g += vec2(-.5,.9)*cos(dot(p, vec2(-.5,.9))*2.9 + time*1.6)*.3;
      g += vec2(.95,-.3)*cos(dot(p, vec2(.95,-.3))*5.3 + time*2.3)*.18;
      g += vec2(.2,.98)*cos(dot(p, vec2(.2,.98))*9.1 + time*3.1)*.1;
      float d = length(p - rippleAt); g += normalize(p - rippleAt + 1e-4) * cos(d*14. - ripple*9.) * exp(-d*1.2) * exp(-ripple*.6) * step(.01, ripple) * step(d, ripple*1.6) * .9;
      return g; }
    void main(){
      vec2 g = wave(vW.xz) * .08;
      vec3 N = normalize(vec3(-g.x, 1., -g.y));
      vec3 V = normalize(cameraPosition - vW);
      vec4 uv = vUv; uv.xy += g * 2.2 * uv.w;
      vec3 refl = texture2DProj(tDiffuse, uv).rgb;
      float fr = .12 + .88 * pow(1. - max(dot(N, V), 0.), 4.);
      vec3 deep = vec3(.09,.25,.3) + vec3(.35,.18,.1) * .3;
      vec3 c = mix(deep, refl, clamp(.45 + fr, 0., 1.));
      vec3 R = reflect(-V, N);
      float sp = pow(max(dot(R, sun), 0.), 220.);
      c += vec3(1.,.75,.45) * sp * 7.;
      float dist = length(vW.xz); c = mix(c, refl, smoothstep(10., 60., dist) * .6);
      gl_FragColor = vec4(c, 1.); }`
};
export const water = new Reflector(new THREE.PlaneGeometry(400, 400), { textureWidth: 540, textureHeight: 960, clipBias: .003, shader: WaterShader, multisample: 0, color: 0xffffff });
water.rotation.x = -Math.PI / 2; scene.add(water);

// ——— берег, деревья, горы ———
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .55, ...o });
const canvasTex = (w, h, draw, rep = [1, 1]) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); t.anisotropy = 8; return t; };
export const PIER_Y = .62;
{
  const r = rng(4), m = new THREE.Matrix4(), col = new THREE.Color();
  // берег за мостиком
  const shoreGeo = new THREE.PlaneGeometry(120, 40, 60, 20); shoreGeo.rotateX(-Math.PI / 2);
  { const p = shoreGeo.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, .25 + Math.max(0, (-z - 18)) * .02 + .3 * Math.sin(x * .3) * Math.cos(z * .4)); } shoreGeo.computeVertexNormals(); }
  const shore = new THREE.Mesh(shoreGeo, M(0x4f8a35, { roughness: 1 })); shore.position.set(0, 0, -26); shore.receiveShadow = true; scene.add(shore);
  // деревья: кроны-облака
  const blobGeo = new THREE.IcosahedronGeometry(1, 3);
  { const p = blobGeo.attributes.position; for (let i = 0; i < p.count; i++) { const v = V(p.getX(i), p.getY(i), p.getZ(i)); const k = 1 + .1 * Math.sin(v.x * 6 + v.y * 4) * Math.cos(v.z * 5); p.setXYZ(i, v.x * k, v.y * k, v.z * k); } blobGeo.computeVertexNormals(); }
  const blobs = new THREE.InstancedMesh(blobGeo, M(0xffffff, { roughness: .8, flatShading: true }), 900);
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(.25, .4, 1, 7), M(0x4a2e1c, { roughness: .9 }), 100);
  let nb = 0, nt = 0;
  for (let i = 0; i < 90; i++) {
    const x = (r() - .5) * 90, z = -9 - r() * 26 - (Math.abs(x) < 4 ? 4 : 0), h = 4 + r() * 6, cr = 1.6 + r() * 1.8;
    m.compose(V(x, .3 + h / 2, z), new THREE.Quaternion(), V(1, h, 1)); trunks.setMatrixAt(nt++, m);
    for (let k = 0; k < 6; k++) { const s = cr * (.55 + r() * .5); m.compose(V(x + (r() - .5) * cr * 1.3, .3 + h + (r() - .4) * cr * 1.1, z + (r() - .5) * cr), new THREE.Quaternion(), V(s, s * .9, s)); col.setHSL((95 + r() * 40) / 360, .45, .2 + r() * .12); blobs.setColorAt(nb, col); blobs.setMatrixAt(nb++, m); }
  }
  // берега по бокам озера
  for (let side of [-1, 1]) for (let i = 0; i < 40; i++) {
    const z = -6 + i * 3 + r() * 2, x = side * (14 + r() * 8 + i * .4), h = 3 + r() * 5, cr = 1.5 + r() * 1.6;
    m.compose(V(x, .3 + h / 2, z), new THREE.Quaternion(), V(1, h, 1)); trunks.setMatrixAt(nt++ % 100, m);
    for (let k = 0; k < 5; k++) { const s = cr * (.55 + r() * .5); m.compose(V(x + (r() - .5) * cr, .3 + h + (r() - .4) * cr, z + (r() - .5) * cr), new THREE.Quaternion(), V(s, s * .9, s)); col.setHSL((95 + r() * 40) / 360, .4, .18 + r() * .1); if (nb < 900) { blobs.setColorAt(nb, col); blobs.setMatrixAt(nb++, m); } }
    const g = new THREE.Mesh(new THREE.BoxGeometry(6, .6, 3.2), M(0x3f7a2c, { roughness: 1 })); g.position.set(x, .1, z); scene.add(g);
  }
  for (let i = 0; i < 110; i++) { const x = (r() - .5) * 60, z = -8.5 - r() * 4 - (Math.abs(x) < 1.6 ? 1.5 : 0), s = .7 + r() * 1.1; m.compose(V(x, .25 + s * .35, z), new THREE.Quaternion(), V(s * 1.3, s * .8, s)); col.setHSL((80 + r() * 50) / 360, .5, .22 + r() * .14); if (nb < 900) { blobs.setColorAt(nb, col); blobs.setMatrixAt(nb++, m); } }
  blobs.count = nb; trunks.count = Math.min(nt, 100); blobs.castShadow = false; scene.add(blobs, trunks);
  // горы на горизонте
  const mt = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 5), M(0x6a4a7a, { roughness: 1, flatShading: true }));
  for (let i = 0; i < 14; i++) { const o = mt.clone(); o.material = M(new THREE.Color().setHSL(.78 - r() * .06, .25, .32 + r() * .1), { roughness: 1, flatShading: true }); o.position.set((i - 7) * 18 + r() * 10, 0, 150 + r() * 30); o.scale.set(14 + r() * 12, 16 + r() * 22, 12); o.rotation.y = r() * 3; scene.add(o); }
  // камыши
  const reed = new THREE.InstancedMesh(new THREE.CylinderGeometry(.012, .018, 1, 5), M(0x5f8a2a), 500);
  const cat = new THREE.InstancedMesh(new THREE.CapsuleGeometry(.035, .14, 4, 8), M(0x6b3a1e, { roughness: .8 }), 160);
  let nr = 0, nc = 0;
  for (let cl = 0; cl < 9; cl++) {
    const cx = [-2.6, -3.4, 2.4, 3.3, -5, 5.2, -1.9, 1.7, -6.4][cl], cz = [-.8, .6, -1.2, .4, -2, -1.5, -2.6, -2.8, 0][cl];
    for (let i = 0; i < 50; i++) { const h = .9 + r() * .9, x = cx + (r() - .5) * 1.1, z = cz + (r() - .5) * 1.1; m.compose(V(x, h / 2 - .1, z), new THREE.Quaternion().setFromEuler(new THREE.Euler((r() - .5) * .25, 0, (r() - .5) * .25)), V(1, h, 1)); reed.setMatrixAt(nr++, m); if (r() < .33 && nc < 160) { m.compose(V(x, h - .05, z), new THREE.Quaternion(), V(1, 1, 1)); cat.setMatrixAt(nc++, m); } }
  }
  reed.count = nr; cat.count = nc; scene.add(reed, cat); reed.userData.sway = true;
  // кувшинки
  const pad = new THREE.CircleGeometry(.28, 24, .3, Math.PI * 2 - .6); pad.rotateX(-Math.PI / 2);
  const pads = new THREE.InstancedMesh(pad, M(0x3f9a3a, { roughness: .5 }), 60);
  const flower = new THREE.InstancedMesh(new THREE.ConeGeometry(.07, .09, 7), M(0xff9ac0, { roughness: .4, emissive: 0x401020 }), 20);
  let nf = 0;
  for (let i = 0; i < 60; i++) { const a = r() * 7, d = 1.6 + r() * 7, x = Math.sin(a) * d * 1.3, z = 2 + Math.cos(a) * d * .6 + r() * 3; const s = .6 + r() * .9; m.compose(V(x, .01, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r() * 7, 0)), V(s, 1, s)); pads.setMatrixAt(i, m); if (r() < .3 && nf < 20) { m.compose(V(x, .05, z), new THREE.Quaternion(), V(s, s, s)); flower.setMatrixAt(nf++, m); } }
  flower.count = nf; scene.add(pads, flower);
}
// ——— мостик ———
{
  const wood = canvasTex(256, 64, (x, w, h) => { x.fillStyle = '#9a6a42'; x.fillRect(0, 0, w, h); const r = rng(9); for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(${60 + r() * 40},${35 + r() * 20},20,${.2 + r() * .3})`; x.fillRect(0, r() * h, w, 1 + r() * 2); } });
  const wm = new THREE.MeshStandardMaterial({ map: wood, roughness: .75 });
  for (let i = 0; i < 26; i++) { const b = new THREE.Mesh(new RoundedBoxGeometry(2.4, .07, .3, 2, .02), wm); b.position.set(0, PIER_Y - .035, .05 - i * .33); b.rotation.z = (hash(i) - .5) * .02; b.castShadow = b.receiveShadow = true; scene.add(b); }
  const post = M(0x5a3a22, { roughness: .9 });
  for (let i = 0; i < 4; i++) for (const sx of [-1.15, 1.15]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.09, .1, 2.2, 10), post); p.position.set(sx, PIER_Y - 1, -.05 - i * 2.6); p.castShadow = true; scene.add(p); }
  // фонарик на столбике
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.04, .05, .7, 8), post); pole.position.set(1.05, PIER_Y + .35, -.2); scene.add(pole);
  const lamp = new THREE.Mesh(new RoundedBoxGeometry(.18, .24, .18, 2, .03), new THREE.MeshStandardMaterial({ color: 0xffe0a0, emissive: 0xffb050, emissiveIntensity: 2.2, roughness: .3 })); lamp.position.set(1.05, PIER_Y + .82, -.2); scene.add(lamp);
}

// ——— светлячки и пыльца ———
export const flies = (() => {
  const N = 90, r = rng(12), pos = new Float32Array(N * 3), D = [];
  for (let i = 0; i < N; i++) D.push({ x: (r() - .5) * 9, y: .3 + r() * 2.4, z: -3 + r() * 6, ph: r() * 7, sp: .3 + r() * .5 });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,200,1)'); gr.addColorStop(.25, 'rgba(255,230,120,.8)'); gr.addColorStop(1, 'rgba(255,200,80,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  const p = new THREE.Points(g, new THREE.PointsMaterial({ map: new THREE.CanvasTexture(c), size: .09, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  p.frustumCulled = false; scene.add(p);
  return { update(t) { D.forEach((d, i) => { pos[i * 3] = d.x + Math.sin(t * d.sp + d.ph) * .4; pos[i * 3 + 1] = d.y + Math.sin(t * d.sp * 1.3 + d.ph * 2) * .25; pos[i * 3 + 2] = d.z + Math.cos(t * d.sp * .8 + d.ph) * .4; }); g.attributes.position.needsUpdate = true; p.material.opacity = .6 + .4 * Math.sin(t * 3); } };
})();

// ——— детали персонажей ———
const sph = (r, m, ws = 28, hs = 18) => { const o = new THREE.Mesh(new THREE.SphereGeometry(r, ws, hs), m); o.castShadow = true; return o; };
const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 12);
export function setRod(o, a, b, r) { o.position.copy(a).add(b).multiplyScalar(.5); o.scale.set(r, Math.max(a.distanceTo(b), 1e-4), r); o.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize()); }
const rod = m => { const o = new THREE.Mesh(cylGeo, m); o.castShadow = true; return o; };
const mat = {
  white: M(0xffffff, { roughness: .2, emissive: 0x606060 }), pupil: M(0x0e0b12, { roughness: .1 }), mouth: M(0x5a1626, { roughness: .6 }), tongue: M(0xff7f96, { roughness: .4 }),
  pink: M(0xffa0b4, { roughness: .4 }), iris: M(0x3fa8ff, { roughness: .15 }), whisk: M(0xffffff, { roughness: .3 }),
  blush: new THREE.MeshBasicMaterial({ color: 0xff8fa0, transparent: true, opacity: .5, depthWrite: false }),
};
function makeMouth(r) {
  const g = new THREE.Group();
  const hole = sph(r, mat.mouth); hole.scale.set(1, .5, .35); g.add(hole);
  const tg = sph(r * .55, mat.tongue, 16, 10); tg.scale.set(1.2, .6, .5); tg.position.set(0, -r * .28, r * .12); g.add(tg);
  const sm = new THREE.Group(); g.add(sm);   // «ω» — кошачий ротик
  [-1, 1].forEach(s => { const a = new THREE.Mesh(new THREE.TorusGeometry(r * .42, r * .1, 8, 20, Math.PI), mat.mouth); a.rotation.z = Math.PI; a.position.x = s * r * .42; sm.add(a); });
  g.userData = { hole, tg, sm, r };
  return g;
}
function setMouth(mo, open = 0) {
  const { hole, tg, sm } = mo.userData;
  const shut = open < .07; hole.visible = tg.visible = !shut; sm.visible = shut;
  hole.scale.set(1 + open * .1, .2 + open * .9, .35); tg.position.y = -mo.userData.r * (.12 + .4 * open);
}
function makeEye(r, irisMat, lidMat) {
  const g = new THREE.Group();
  const w = sph(r, mat.white); w.scale.z = .6; g.add(w);
  const ir = sph(r * .66, irisMat, 24, 14); ir.scale.z = .45; ir.position.z = r * .3; g.add(ir);
  const p = sph(r * .42, mat.pupil, 18, 12); p.scale.z = .4; p.position.z = r * .5; ir.add(p);
  const hl = sph(r * .2, mat.white, 10, 8); hl.position.set(r * .18, r * .2, r * .8); ir.add(hl);
  const hl2 = sph(r * .1, mat.white, 8, 6); hl2.position.set(-r * .16, -r * .17, r * .8); ir.add(hl2);
  const lid = sph(r * 1.07, lidMat, 24, 12); g.add(lid);
  g.userData = { w, ir, lid, r };
  return g;
}
function setEye(e, { look = [0, 0], open = 1, lid = 0, happy = 0 }) {
  const { w, ir, r } = e.userData;
  w.scale.y = Math.max(.06, open * (1 - happy * .85)); ir.visible = open > .15 && happy < .6;
  ir.position.set(look[0] * r * .35, look[1] * r * .3, r * .3);
  e.userData.lid.visible = lid > .02; e.userData.lid.scale.set(1.04, 1.04 * lid, .66); e.userData.lid.position.set(0, r * (1 - lid) * .95, .01);
}

// ——— Котик ———
const furC = M(0xfff1e0, { roughness: .75 }), furP = M(0xffc79a, { roughness: .75 });
const kitTex = canvasTex(512, 256, (x, w, h) => { x.fillStyle = '#fff1e0'; x.fillRect(0, 0, w, h); const r = rng(3); for (let i = 0; i < 9; i++) { const u = (.35 + i * .035) * w; x.fillStyle = 'rgba(255,170,110,.65)'; x.beginPath(); x.ellipse(u, h * .1, 6, h * .1, 0, 0, 7); x.fill(); } for (let i = 0; i < 3000; i++) { x.fillStyle = `rgba(${r() < .5 ? '255,255,255' : '230,190,150'},${r() * .25})`; x.fillRect(r() * w, r() * h, 1, 3 + r() * 5); } });
const furHead = new THREE.MeshStandardMaterial({ map: kitTex, roughness: .75 });
export const kitten = new THREE.Group(); scene.add(kitten);
const kBody = new THREE.Group(); kitten.add(kBody);
{
  const torso = sph(1, furC, 36, 24); torso.scale.set(.27, .3, .24); torso.position.y = .25; kBody.add(torso);
  const chest = sph(1, M(0xffffff, { roughness: .8 }), 24, 16); chest.scale.set(.18, .2, .12); chest.position.set(0, .3, .16); kBody.add(chest);
  for (let i = 0; i < 9; i++) { const f = sph(.06, M(0xffffff, { roughness: .9 }), 10, 8); f.position.set((i % 3 - 1) * .07, .38 - Math.floor(i / 3) * .06, .2); f.scale.z = .6; kBody.add(f); }
}
export const kHead = new THREE.Group(); kHead.position.set(0, .62, .02); kBody.add(kHead);
{
  const hm = sph(1, furHead, 40, 28); hm.scale.set(.3, .27, .27); hm.rotation.y = -Math.PI / 2; kHead.add(hm);
  [-1, 1].forEach(s => { const c = sph(.13, furC, 16, 12); c.position.set(s * .2, -.08, .05); c.scale.set(1, .8, .9); kHead.add(c); });
  [-1, 1].forEach(s => { const m = sph(.075, M(0xffffff, { roughness: .8 })); m.position.set(s * .055, -.08, .22); m.scale.set(1, .8, .8); kHead.add(m); });
  const nose = sph(.03, mat.pink); nose.scale.set(1.3, .8, .8); nose.position.set(0, -.035, .27); kHead.add(nose);
}
const kEyes = [-1, 1].map(s => { const e = makeEye(.09, mat.iris, furC); e.position.set(s * .11, .035, .228); e.rotation.y = s * .18; kHead.add(e); return e; });
const kMouth = makeMouth(.05); kMouth.position.set(0, -.12, .25); kHead.add(kMouth);
const kBlush = [-1, 1].map(s => { const b = new THREE.Mesh(new THREE.CircleGeometry(.04, 16), mat.blush); b.position.set(s * .17, -.07, .2); b.rotation.y = s * .5; kHead.add(b); return b; });
const kEars = [-1, 1].map(s => { const g = new THREE.Group(); g.position.set(s * .16, .18, -.02); kHead.add(g); const o = new THREE.Mesh(new THREE.ConeGeometry(.085, .17, 20), furP); o.position.y = .06; o.castShadow = true; g.add(o); const i = new THREE.Mesh(new THREE.ConeGeometry(.05, .12, 16), mat.pink); i.position.set(0, .05, .035); g.add(i); return { g, s }; });
const kWhisk = []; [-1, 1].forEach(s => [-.02, .02].forEach(dy => { const w = rod(mat.whisk); w.userData = { s, dy }; kHead.add(w); kWhisk.push(w); }));
const kPaws = [-1, 1].map(s => { const l = rod(furC), p = sph(.05, M(0xffffff, { roughness: .8 }), 14, 10); kBody.add(l, p); return { l, p, s }; });
const kLegs = [-1, 1].map(s => { const l = rod(furC), p = sph(.055, M(0xffffff, { roughness: .8 }), 14, 10); kBody.add(l, p); return { l, p, s }; });
const kTail = new THREE.Mesh(new THREE.BufferGeometry(), furP); kTail.castShadow = true; kBody.add(kTail);
export const kProp = new THREE.Group(); kBody.add(kProp);   // предмет в лапах

// ——— Клодик ———
export const CLAUDE = 0xd97757;
const clMat = new THREE.MeshStandardMaterial({ color: CLAUDE, roughness: .45, emissive: 0x3a1408, emissiveIntensity: .35 });
const clDark = M(0x1a1210, { roughness: .3 });
export const klod = new THREE.Group(); scene.add(klod);
const kd = new THREE.Group(); klod.add(kd);
const kdBody = new THREE.Mesh(new RoundedBoxGeometry(.56, .44, .36, 4, .09), clMat); kdBody.position.y = .3; kdBody.castShadow = true; kd.add(kdBody);
const kdEyes = [-1, 1].map(s => { const e = new THREE.Mesh(new RoundedBoxGeometry(.065, .14, .03, 2, .02), clDark); e.position.set(s * .11, .36, .185); kd.add(e); const h = new THREE.Mesh(new THREE.BoxGeometry(.02, .035, .01), mat.white); h.position.set(.012, .035, .016); e.add(h); return e; });
const kdBlush = [-1, 1].map(s => { const b = new THREE.Mesh(new THREE.CircleGeometry(.035, 16), mat.blush); b.position.set(s * .2, .27, .182); kd.add(b); return b; });
const kdArms = [-1, 1].map(s => { const g = new THREE.Group(); g.position.set(s * .28, .3, 0); kd.add(g); const a = new THREE.Mesh(new RoundedBoxGeometry(.12, .1, .12, 2, .035), clMat); a.position.x = s * .05; a.castShadow = true; g.add(a); return { g, s }; });
const kdLegs = [-.17, -.06, .06, .17].map(x => { const g = new THREE.Group(); g.position.set(x, .09, .15); kd.add(g); const l = new THREE.Mesh(new RoundedBoxGeometry(.07, .17, .07, 2, .02), clMat); l.position.y = -.08; l.castShadow = true; g.add(l); return { l: g, x }; });
export const klProp = new THREE.Group(); kd.add(klProp);

// ——— позы ———
// k: { talk, look:[x,y], happy, lid, blink, ear, tilt, nod, pawUp, swing, surprise }
export function poseKitten(t, k = {}) {
  const talk = k.talk || 0, bob = Math.sin(t * 1.6) * .006;
  kitten.position.set(-.34, PIER_Y, .02); kitten.rotation.set(0, .28 + (k.turn || 0), 0);
  kBody.position.y = bob; kBody.rotation.set(0, 0, 0);
  kHead.rotation.set(-(k.nod || 0) - talk * .06 + (k.lookUp || 0) * -.25, (k.headTurn || 0), (k.tilt || 0) + Math.sin(t * 1.1) * .03);
  kHead.scale.setScalar(1 + (k.surprise || 0) * .06);
  kEyes.forEach((e, i) => setEye(e, { look: k.look || [0, 0], open: k.blink ? .06 : 1 + (k.surprise || 0) * .2, lid: k.lid ?? 0, happy: k.happy || 0 }));
  kEyes.forEach(e => e.scale.setScalar(1 + (k.surprise || 0) * .25));
  setMouth(kMouth, talk * 1.05 + (k.surprise || 0) * .5);
  kBlush.forEach(b => b.material.opacity = .45 + (k.blush || 0) * .4);
  kEars.forEach(({ g, s }) => g.rotation.set(-(k.earBack || 0) * .8, 0, s * (-.18 + (k.ear || 0) * .25 * Math.sin(t * 20))));
  kWhisk.forEach(w => { const { s, dy } = w.userData; setRod(w, V(s * .08, -.07 + dy, .24), V(s * .3, -.04 + dy * 2.5, .2), .004); });
  const pawUp = k.pawUp || 0;
  kPaws.forEach(({ l, p, s }, i) => {
    const up = (i === 1 ? pawUp : 0);
    const a = V(s * .12, .3, .12), b = vlerp(V(s * .1, .02, .2), V(s * .18, .55, .3), up);
    setRod(l, a, b, .045); p.position.copy(b);
  });
  const sw = k.swing ?? 1;
  kLegs.forEach(({ l, p, s }, i) => { const ph = Math.sin(t * 2.4 + i * Math.PI) * .12 * sw; const a = V(s * .13, .08, .1), b = V(s * .14, -.22, .3 + ph); setRod(l, a, b, .05); p.position.copy(b); });
  const pts = []; for (let i = 0; i <= 8; i++) { const q = i / 8; pts.push(V(-.05 - q * .3 + Math.sin(t * 1.4 + q * 3) * .04 * q, .06 + Math.sin(q * 2.6) * .25, -.18 - q * .12)); }
  kTail.geometry.dispose(); kTail.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, .045, 8);
}
export function poseKlod(t, k = {}) {
  const talk = k.talk || 0;
  klod.position.set(.37, PIER_Y, .04); klod.rotation.set(0, -.3 + (k.turn || 0), 0);
  const sq = talk * .06 * Math.abs(Math.sin(t * 18)), hop = k.hop || 0;
  kd.position.y = Math.sin(t * 1.5) * .006 + hop * .12; kd.scale.set(1 + sq * .6, 1 - sq + hop * .05, 1 + sq * .6);
  kd.rotation.set(0, 0, (k.tilt || 0) + Math.sin(t * 1.2) * .02);
  const bl = k.blink ? .1 : 1, hap = k.happy || 0;
  kdEyes.forEach((e, i) => { e.scale.set(1, bl * (1 - hap * .55), 1); e.position.set((i ? 1 : -1) * .11 + (k.look?.[0] || 0) * .025, .36 + (k.look?.[1] || 0) * .02, .185); e.rotation.z = hap * (i ? -.35 : .35); });
  kdBlush.forEach(b => b.material.opacity = .35 + (k.blush || 0) * .4);
  kdArms.forEach(({ g, s }, i) => {
    const gest = (i === 1 ? (k.point || 0) : 0);
    g.rotation.set(0, 0, s * (-.2 + talk * .25 * Math.sin(t * 6 + i)) + (i === 1 ? -gest * 1.2 : 0) + (k.wave && i === 0 ? Math.sin(t * 12) * .5 - .9 : 0));
  });
  kdLegs.forEach(({ l }, i) => { l.rotation.x = -.15 + Math.sin(t * 2.2 + i * 1.7) * .3 * (k.swing ?? 1); });
}
export { mat, M, sph, rod, makeEye, setEye };
