// НЕЙРО — маленький милый робот-ИИ (женский персонаж) для «Ты думаешь или зависла?».
// Перламутровый корпус, тёмное стекло лица с глазами на CanvasTexture (emissiveMap), ручки-варежки, короткие ножки.
// Экспорт: neuro = { group, pose(t, k), handWorld(side), headWorld(), lapLocal }. Всё в pose — чистая функция (t, k).
import { THREE, scene, V, sph, setRod, clamp, lerp, hash } from './core.js';

const TAU = Math.PI * 2;
const sstep = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const nrm = (x, y, z) => V(x, y, z).normalize();

// ——— материалы ———
// тёплое свечение «изнутри» (warm): эмиссия по расстоянию до груди и коленей, общая для корпуса/таза/бёдер
const warmU = { uWarm: { value: 0 }, uChest: { value: V(0, -9, 0) }, uLapL: { value: V(0, -9, 0) }, uLapR: { value: V(0, -9, 0) }, uWarmCol: { value: new THREE.Color(1, .33, .06) } };
function warmify(m) {
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, warmU);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWarmP;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n\tvWarmP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWarmP; uniform float uWarm; uniform vec3 uChest; uniform vec3 uLapL; uniform vec3 uLapR; uniform vec3 uWarmCol;')
      .replace('#include <color_fragment>', `#include <color_fragment>
	float dc = distance(vWarmP, uChest), d1 = distance(vWarmP, uLapL), d2 = distance(vWarmP, uLapR);
	float warmG = uWarm * (exp(-dc * dc / .0095) + .8 * (exp(-d1 * d1 / .0032) + exp(-d2 * d2 / .0032)));
	diffuseColor.rgb *= mix(vec3(1.), vec3(1., .54, .28), clamp(warmG, 0., 1.) * .92);   // свет сквозь «пластик»`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
	totalEmissiveRadiance += uWarmCol * (uWarm * .12 + warmG * 1.45);`);
  };
  m.customProgramCacheKey = () => 'neuroWarm';
  return m;
}
const pearlP = {
  color: 0xf4f0ea, roughness: .3, metalness: 0, clearcoat: 1, clearcoatRoughness: .12,
  sheen: .3, sheenRoughness: .35, sheenColor: new THREE.Color(0xdde4ff),   // лёгкий перламутровый отлив по краям
};
const pearl = new THREE.MeshPhysicalMaterial(pearlP);
const pearlW = warmify(new THREE.MeshPhysicalMaterial(pearlP));
const joint = new THREE.MeshPhysicalMaterial({ color: 0xbcc1c9, roughness: .34, metalness: .4, clearcoat: .5, clearcoatRoughness: .2 });
const soleM = new THREE.MeshPhysicalMaterial({ color: 0xc3c8d0, roughness: .5, metalness: .15 });
const ringM = new THREE.MeshStandardMaterial({ color: 0x0c1a24, emissive: 0x5fd8ff, emissiveIntensity: .8, roughness: .3 });
const chestM = new THREE.MeshPhysicalMaterial({ color: 0xf2efe9, roughness: .22, clearcoat: 1, clearcoatRoughness: .05, emissive: 0xff8a3a, emissiveIntensity: 0 });
const chestC0 = new THREE.Color(0xeeebe6), chestC1 = new THREE.Color(0x6a2c0c);

const mesh = (geo, m, sh = true) => { const o = new THREE.Mesh(geo, m); o.castShadow = sh; o.receiveShadow = true; return o; };

// ——— иерархия ———
const group = new THREE.Group(); group.name = 'neuro'; scene.add(group);
const root = new THREE.Group(); group.add(root);              // таз и ноги, лёгкое дыхание
const torso = new THREE.Group(); torso.position.set(0, .1, 0); root.add(torso);   // шарнир в талии
const headPiv = new THREE.Group(); headPiv.position.set(0, .232, -.004); torso.add(headPiv);
const head = new THREE.Group(); head.position.set(0, .143, .006); headPiv.add(head);   // центр головы

// ——— голова: суперэллипсоид (мягкий «шлем») ———
const HA = .168, HB = .142, HC = .152, HP = 2.45;
const sdist = (x, y, z) => Math.pow(Math.pow(Math.abs(x) / HA, HP) + Math.pow(Math.abs(y) / HB, HP) + Math.pow(Math.abs(z) / HC, HP), 1 / HP);
const headPt = d => d.clone().multiplyScalar(1 / sdist(d.x, d.y, d.z));
const headNrm = p => { const f = (v, a) => Math.sign(v) * Math.pow(Math.abs(v) / a, HP - 1) / a; return V(f(p.x, HA), f(p.y, HB), f(p.z, HC)).normalize(); };
{
  const g = new THREE.SphereGeometry(1, 80, 60), P = g.attributes.position, N = g.attributes.normal, d = V(0, 0, 0);
  for (let i = 0; i < P.count; i++) {
    d.set(P.getX(i), P.getY(i), P.getZ(i)).normalize();
    const p = headPt(d), n = headNrm(p); P.setXYZ(i, p.x, p.y, p.z); N.setXYZ(i, n.x, n.y, n.z);
  }
  head.add(mesh(g, pearl));
}
// стекло лица: скруглённый прямоугольник на поверхности шлема, слегка выпуклое
const VY = .96, VYC = -.016, VYH = .07, VQ = 4.2;   // полуширина по рысканью, центр и полувысота по Y
const visorPt = (s, t, off) => {   // строки холста = постоянная высота на шлеме (ровные верх/низ стекла)
  const y = VYC + t * VYH, rho = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(y) / HB, HP)), 1 / HP);
  const hx = Math.sin(s * VY), hz = Math.cos(s * VY), rh = rho / Math.pow(Math.pow(Math.abs(hx) / HA, HP) + Math.pow(Math.abs(hz) / HC, HP), 1 / HP);
  const p = V(hx * rh, y, hz * rh);
  return p.addScaledVector(headNrm(p), off);
};
const bound = th => { const c = Math.cos(th), s = Math.sin(th); return [Math.sign(c) * Math.pow(Math.abs(c), 2 / VQ), Math.sign(s) * Math.pow(Math.abs(s), 2 / VQ)]; };
function visorGeo(off0, bulge, R = 22, S = 112) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= R; i++) {
    const r = i / R;
    for (let j = 0; j < S; j++) {
      const [bs, bt] = bound(j / S * TAU), s = bs * r, t = bt * r, p = visorPt(s, t, off0 + bulge * (1 - r * r));
      pos.push(p.x, p.y, p.z); uv.push(s * .5 + .5, t * .5 + .5);
    }
  }
  for (let i = 0; i < R; i++) for (let j = 0; j < S; j++) {
    const a = i * S + j, b = i * S + (j + 1) % S, c = (i + 1) * S + j, d = (i + 1) * S + (j + 1) % S;
    if (i) idx.push(a, c, b); idx.push(b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}
// физические пропорции стекла → размер холста (квадратные пиксели)
const FW = 512, FH = (() => {
  let w = 0, h = 0;
  for (let i = 0; i < 64; i++) { w += visorPt(-1 + i / 32, 0, 0).distanceTo(visorPt(-1 + (i + 1) / 32, 0, 0)); h += visorPt(0, -1 + i / 32, 0).distanceTo(visorPt(0, -1 + (i + 1) / 32, 0)); }
  return Math.round(FW * h / w / 2) * 2;
})();
const faceCv = document.createElement('canvas'); faceCv.width = FW; faceCv.height = FH;
const fc = faceCv.getContext('2d');
const layer = document.createElement('canvas'); layer.width = FW; layer.height = FH;
const lc = layer.getContext('2d');
const tmp = document.createElement('canvas'); tmp.width = FW; tmp.height = FH;
const tc = tmp.getContext('2d');
const faceTex = new THREE.CanvasTexture(faceCv); faceTex.colorSpace = THREE.SRGBColorSpace; faceTex.anisotropy = 8;
const glass = new THREE.MeshPhysicalMaterial({
  color: 0x05080e, roughness: .1, metalness: 0, clearcoat: 1, clearcoatRoughness: .02,
  emissive: 0xffffff, emissiveMap: faceTex, emissiveIntensity: 1.55, envMap: scene.environment, envMapIntensity: .32,
});
const visor = mesh(visorGeo(.0016, .0055), glass, false); visor.renderOrder = -1; head.add(visor);   // рисуем раньше шлема: ранний z-тест отсекает скрытую часть оболочки
// мягкий блик на стекле (мультяшное отражение окна)
{
  const hl = document.createElement('canvas'); hl.width = 512; hl.height = 256; const x = hl.getContext('2d');
  // тонкая дуга-блик вдоль верхнего левого края и точка рядом
  x.filter = 'blur(2px)'; x.lineCap = 'round';
  const gr = x.createLinearGradient(40, 0, 300, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.25, 'rgba(255,255,255,.9)'); gr.addColorStop(.8, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.strokeStyle = gr; x.lineWidth = 9; x.beginPath(); x.moveTo(40, 64); x.quadraticCurveTo(90, 26, 300, 24); x.stroke();
  x.fillStyle = 'rgba(255,255,255,.75)'; x.beginPath(); x.ellipse(332, 24, 9, 5, 0, 0, TAU); x.fill();
  const t = new THREE.CanvasTexture(hl); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .4, toneMapped: false });
  const o = new THREE.Mesh(visor.geometry, m); o.scale.setScalar(1.006); o.renderOrder = 2; head.add(o);
}
// ободок стекла
{
  const pts = []; for (let j = 0; j < 140; j++) { const [s, t] = bound(j / 140 * TAU); pts.push(visorPt(s * 1.004, t * 1.004, .0012)); }
  head.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 280, .0042, 10, true), joint));
}
// «ушки»-диски с подсветкой
[-1, 1].forEach(s => {
  const p = headPt(nrm(s, .02, -.08)), n = headNrm(p), g = new THREE.Group();
  g.position.copy(p).addScaledVector(n, -.004); g.quaternion.setFromUnitVectors(V(0, 0, 1), n); head.add(g);
  const base = mesh(new THREE.CylinderGeometry(.047, .052, .02, 48), joint); base.rotation.x = Math.PI / 2; g.add(base);
  const ring = mesh(new THREE.TorusGeometry(.036, .0052, 12, 64), ringM, false); ring.position.z = .0105; g.add(ring);
  const cap = sph(.029, pearl, 32, 18); cap.scale.z = .42; cap.position.z = .011; g.add(cap);
});
// шея
{ const n = mesh(new THREE.CylinderGeometry(.026, .032, .05, 24), joint); n.position.set(0, .222, -.004); torso.add(n); }

// ——— корпус: яйцо (шире книзу), грудной «огонёк» ———
const EGG = { yc: .1, hy: .123, R: .104, egg: .17, zs: .86 };
const eggR = y => { const c = clamp((EGG.yc - y) / EGG.hy, -1, 1), s = Math.sqrt(1 - c * c); return EGG.R * s * (1 + EGG.egg * c); };
{
  const pts = []; for (let i = 0; i <= 40; i++) { const th = i / 40 * Math.PI, c = Math.cos(th); pts.push(new THREE.Vector2(Math.max(1e-4, EGG.R * Math.sin(th) * (1 + EGG.egg * c)), EGG.yc - EGG.hy * c)); }
  const o = mesh(new THREE.LatheGeometry(pts, 56, Math.PI), pearlW); o.scale.z = EGG.zs; torso.add(o);
  // мягкий шов-«воротник» и пояс
  const col = mesh(new THREE.TorusGeometry(.044, .006, 10, 40), joint); col.rotation.x = Math.PI / 2; col.position.set(0, .209, -.002); col.scale.set(1, EGG.zs, 1); torso.add(col);
}
const chestY = .128, chestZ = eggR(chestY) * EGG.zs;
{ // «сердечко»-огонёк на груди, по нормали к корпусу
  const dr = (eggR(chestY + .002) - eggR(chestY - .002)) / .004, n = nrm(0, -EGG.zs * dr, 1), g = new THREE.Group();
  g.position.set(0, chestY, chestZ); g.quaternion.setFromUnitVectors(V(0, 0, 1), n); torso.add(g);
  const l = mesh(new THREE.SphereGeometry(.019, 32, 16), chestM, false); l.scale.z = .32; l.position.z = .0005; g.add(l);
  const r = mesh(new THREE.TorusGeometry(.0205, .0034, 10, 40), joint, false); r.position.z = .0012; g.add(r);
}
// тёплый свет на котёнка у неё на коленях: прожектор вниз-вперёд (стекло лица вне конуса — без бликов на нём)
const warmLight = new THREE.SpotLight(0xff8c42, 0, .8, .95, .9, 2); warmLight.position.set(0, .1, .1); torso.add(warmLight);
warmLight.target.position.set(0, .03, .27); group.add(warmLight.target);

// ——— таз и ноги ———
{ const p = sph(1, pearlW, 40, 24); p.scale.set(.098, .062, .088); p.position.set(0, .06, .004); root.add(p); }
const tapGeo = new THREE.CylinderGeometry(1, .82, 1, 20);   // верх (b) шире низа (a)
function limb(m, tapered = false) {
  const g = new THREE.Group(), c = mesh(tapered ? tapGeo : new THREE.CylinderGeometry(1, 1, 1, 20), m), s1 = sph(1, m, 20, 14), s2 = sph(1, m, 20, 14);
  g.add(c, s1, s2); return { g, c, s1, s2 };
}
function setL(L, a, b, ra, rb = ra) {
  setRod(L.c, a, b, 1); L.c.scale.set(rb, Math.max(a.distanceTo(b), 1e-4), rb);
  L.s1.position.copy(a); L.s1.scale.setScalar(ra); L.s2.position.copy(b); L.s2.scale.setScalar(rb);
}
const legs = [-1, 1].map(sx => {
  const thigh = limb(pearlW), shin = limb(pearl, true), knee = sph(.031, joint, 24, 16);
  const foot = new THREE.Group(), boot = sph(1, pearl, 32, 20), sole = sph(1, soleM, 28, 16);
  boot.scale.set(.036, .047, .042); boot.position.set(0, .022, -.002); sole.scale.set(.028, .038, .008); sole.position.set(0, .022, .036);
  foot.add(boot, sole); root.add(thigh.g, shin.g, knee, foot);
  return { sx, thigh, shin, knee, foot };
});
export const lapLocal = V(0, .082, .135);

// ——— руки ———
const L1 = .104, L2 = .102, PALM = .034;
const arms = [-1, 1].map(sx => {
  const up = limb(pearl), fore = limb(pearl, true), sh = sph(.025, joint, 28, 18), el = sph(.023, joint, 24, 16);
  const cuff = mesh(new THREE.CylinderGeometry(.026, .026, .012, 28), joint);
  const hand = new THREE.Group(), ts = -sx;   // ts: сторона большого пальца в локальных X кисти
  const mitt = sph(1, pearl, 32, 20); mitt.scale.set(.03, .041, .019); mitt.position.set(0, .034, 0);
  const thumb = limb(pearl); setL(thumb, V(ts * .018, .018, .007), V(ts * .033, .04, .013), .0095);
  const index = limb(pearl);
  hand.add(mitt, thumb.g, index.g);
  group.add(up.g, fore.g, sh, el, cuff, hand);
  return { sx, up, fore, sh, el, cuff, hand, mitt, index, ts, palm: V(0, 0, 0) };
});

// ——— лицо: рисование на холсте ———
const EX = 94, EY = FH * .44, EW = 62, EH = 82, MY = FH * .8;
const CYAN = '#46ccff';
let scanPat = null;
function pillPath(c, x, y, w, h) { const r = Math.min(w, h) * .47; c.beginPath(); c.roundRect(x - w / 2, y - h / 2, w, h, r); }
// глаз: x,y,w,h; верхнее веко top (доля h), slant (+ внутренний край ниже), curve (выпуклость века вниз);
// нижнее «веко»-круг bot (доля h), botR (радиус в долях w); alpha
function drawEye(c, e, s) {
  const { x, y, w, h } = e, yT = y - h / 2, yB = y + h / 2;
  c.save();
  if (e.top > .002) {
    const ly = xx => yT + e.top * h + e.slant * (xx - x) * -s;
    c.beginPath(); c.moveTo(x - w, ly(x - w)); c.quadraticCurveTo(x, ly(x) + e.curve * h * .5, x + w, ly(x + w));
    c.lineTo(x + w, yB + 40); c.lineTo(x - w, yB + 40); c.closePath(); c.clip();
  }
  if (e.bot > .002) {
    const R = e.botR * w, cy = yB - e.bot * h + R;
    c.beginPath(); c.rect(x - w * 2, yT - 60, w * 4, h + 120); c.moveTo(x + R, cy); c.arc(x, cy, R, 0, TAU); c.clip('evenodd');
  }
  const gr = c.createRadialGradient(x - w * .08, y - h * .12, 0, x, y, Math.max(w, h) * .62);
  gr.addColorStop(0, '#bff3ff'); gr.addColorStop(.4, '#52d0ff'); gr.addColorStop(1, '#1b94ff');
  c.globalAlpha = e.alpha; c.fillStyle = gr; pillPath(c, x, y, w, h); c.fill();
  if (e.spark > .02 && h > 18) {   // блики-искорки
    c.globalAlpha = e.alpha * e.spark; c.fillStyle = '#ffffff';
    const r1 = Math.min(w, h) * .14 * e.sparkS;
    c.beginPath(); c.arc(x + w * .17, y - h * .2, r1, 0, TAU); c.fill();
    c.beginPath(); c.arc(x - w * .16, y + h * .17, r1 * .45, 0, TAU); c.fill();
  }
  c.restore();
  // реснички у внешнего верхнего края
  if (e.lash > .02) {
    const r = Math.min(w, h) * .47;
    const topAt = xx => {   // верх видимой части глаза над точкой xx
      const dx = Math.abs(xx - x), cx = w / 2 - r; let yy = yT;
      if (dx > cx) yy = yT + r - Math.sqrt(Math.max(0, r * r - (dx - cx) * (dx - cx)));
      if (e.top > .002) yy = Math.max(yy, yT + e.top * h + e.slant * (xx - x) * -s + e.curve * h * .5 * (1 - Math.pow((xx - x) / w, 2)) * .5);
      return yy;
    };
    c.save(); c.globalAlpha = e.alpha * e.lash; c.strokeStyle = '#5cd6ff'; c.lineCap = 'round'; c.lineWidth = 4.4;
    [[.3, .62, 11], [.43, .2, 10]].forEach(([fx, ang, len]) => {
      const bx = x + s * w * fx, by = topAt(bx) + 1.5;
      const dx = s * Math.cos(ang), dy = -Math.sin(ang) - .35;
      c.beginPath(); c.moveTo(bx, by); c.quadraticCurveTo(bx + dx * len * .55, by + dy * len * .4, bx + dx * len, by + dy * len * .75); c.stroke();
    });
    c.restore();
  }
}
function drawSpinner(c, x, y, R, t, a) {
  const head = t * 6.8;
  for (let i = 0; i < 8; i++) {
    const ang = i / 8 * TAU - Math.PI / 2, tr = (((head - ang) % TAU) + TAU) % TAU / TAU, b = Math.pow(1 - tr, 1.7);
    c.globalAlpha = a * (.28 + .72 * b); c.fillStyle = b > .8 ? '#d9fcff' : CYAN;
    c.beginPath(); c.arc(x + Math.cos(ang) * R, y + Math.sin(ang) * R, 4.4 + 3.6 * b, 0, TAU); c.fill();
  }
  c.globalAlpha = 1;
}
function drawFace(t, f) {
  const c = lc; c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.clearRect(0, 0, FW, FH);
  const [lx, ly] = f.look, eyesA = 1 - f.think;
  // глаза
  for (const s of [-1, 1]) {
    const pers = 1 + s * lx * .07;
    const e = { x: FW / 2 + s * EX + lx * 30, y: EY - ly * 18, w: EW * pers, h: EH * pers, top: 0, slant: 0, curve: 0, bot: 0, botR: .9, alpha: eyesA, spark: 1, sparkS: 1, lash: 1 };
    e.w *= 1 + f.wide * .26 + f.happy * .14; e.h *= 1 + f.wide * .18 - f.happy * .06 - f.soft * .06;
    e.bot = Math.max(f.smile * .13, f.soft * .25, f.squint * .2);
    e.top = f.squint * .42 + f.soft * .15; e.slant = f.squint * .05 - f.soft * .13; e.curve = f.soft * .25 - f.squint * .08;
    // недоумение: левый на холсте (правый у неё) приподнят и округлён, второй прищурен
    if (s < 0) { e.y -= 13 * f.puzzled; e.h *= 1 + .12 * f.puzzled; e.top *= 1 - f.puzzled; }
    else { e.y += 4 * f.puzzled; e.h *= 1 - .06 * f.puzzled; e.top = lerp(e.top, .38, f.puzzled); e.slant = lerp(e.slant, -.04, f.puzzled); e.curve = lerp(e.curve, -.1, f.puzzled); }
    e.botR = lerp(lerp(lerp(.9, 1.5, f.squint), .75, f.soft), .56, f.happy); e.bot = lerp(e.bot, .8, f.happy);
    e.top *= 1 - f.wide; e.bot *= 1 - f.wide * .7;
    // глюк: глаза-полоски
    e.h = lerp(e.h, 9, f.glitch); e.w = lerp(e.w, e.w * 1.3, f.glitch); e.top *= 1 - f.glitch; e.bot *= 1 - f.glitch;
    e.h = Math.max(5.5, e.h * (1 - f.blink * .94));
    e.spark = (1 - f.happy) * (1 - f.glitch) * sstep(.25, .6, 1 - f.blink) * (1 - f.squint * .5); e.sparkS = 1 + f.wide * .35 + f.soft * .15;
    e.lash = (1 - f.glitch);
    drawEye(c, e, s);
    if (f.think > .01) drawSpinner(c, e.x, EY - ly * 18, 25 + f.wide * 4, t, f.think);
  }
  // рот
  {
    const mw = 34 + f.smile * 12 + f.happy * 8 - f.think * 12 + f.soft * 2 + f.talk * 6 * Math.sin(t * 7.3) * Math.sin(t * 3.1),
      open = f.talk * 15 + f.wide * 5 * (1 - f.talk * .5),
      dep = 3 + f.smile * 7 + f.happy * 6 + f.soft * 3 - f.squint * 2 - f.puzzled * 3.5 - f.think * 3 - f.glitch * 3,
      lift = f.squint * 4.5 + f.puzzled * 3.5;   // асимметрия: ухмылка
    const mx = FW / 2 + lx * 16, my = MY - ly * 9;
    const Lx = mx - mw / 2, Ly = my + lift * .2, Rx = mx + mw / 2, Ry = my - lift;
    c.save(); c.globalAlpha = 1 - f.glitch * .3; c.strokeStyle = CYAN; c.fillStyle = CYAN; c.lineWidth = 5; c.lineJoin = c.lineCap = 'round';
    c.beginPath(); c.moveTo(Lx, Ly);
    c.quadraticCurveTo(mx, (Ly + Ry) / 2 + dep * 2, Rx, Ry);
    if (open > .6) { c.quadraticCurveTo(mx, (Ly + Ry) / 2 + (dep + open) * 2, Lx, Ly); c.closePath(); c.globalAlpha *= .9; c.fill(); }
    c.stroke(); c.restore();
  }
  // глюк: сдвиг полос, строки, пиксели
  if (f.glitch > .01) {
    tc.clearRect(0, 0, FW, FH); tc.drawImage(layer, 0, 0); c.clearRect(0, 0, FW, FH);
    const fr = Math.floor(t * 14), nb = 12, bh = FH / nb;
    for (let b = 0; b < nb; b++) {
      const h1 = hash(b * 13.1 + fr * 7.7), dx = (h1 - .5) * 70 * f.glitch * (hash(b * 3.3 + fr * 1.9) > .55 ? 1 : .15);
      c.drawImage(tmp, 0, b * bh, FW, bh, dx, b * bh, FW, bh);
    }
    c.globalAlpha = f.glitch;
    for (let i = 0; i < 9; i++) {
      const hx = hash(i * 5.1 + fr * 2.3), hy = hash(i * 9.7 + fr * 4.1);
      c.fillStyle = hash(i + fr) > .5 ? 'rgba(90,216,255,.9)' : 'rgba(255,90,200,.75)';
      c.fillRect(Math.floor(hx * FW / 8) * 8, Math.floor(hy * FH / 6) * 6, 8 + Math.floor(hash(i * 2.2 + fr) * 3) * 8, 6);
    }
    c.globalAlpha = 1;
  }
  // строки «экрана»
  if (!scanPat) { const p = document.createElement('canvas'); p.width = 1; p.height = 3; const px = p.getContext('2d'); px.fillStyle = 'rgba(0,0,0,1)'; px.fillRect(0, 2, 1, 1); scanPat = c.createPattern(p, 'repeat'); }
  c.globalCompositeOperation = 'destination-out'; c.globalAlpha = .16 + f.glitch * .45; c.fillStyle = scanPat; c.fillRect(0, 0, FW, FH);
  c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;

  // сборка: фон стекла, румянец, свечение, чёткий слой
  const m = fc; m.globalCompositeOperation = 'source-over'; m.globalAlpha = 1; m.filter = 'none';
  m.fillStyle = '#000'; m.fillRect(0, 0, FW, FH);
  const bl = .1 + f.blush * .75;
  for (const s of [-1, 1]) {
    const bx = FW / 2 + s * 132 + lx * 22, by = FH * .66 - ly * 12;
    const gr = m.createRadialGradient(bx, by, 0, bx, by, 44);
    gr.addColorStop(0, `rgba(255,120,175,${bl})`); gr.addColorStop(.55, `rgba(255,100,160,${bl * .45})`); gr.addColorStop(1, 'rgba(255,90,150,0)');
    m.save(); m.translate(bx, by); m.scale(1, .55); m.translate(-bx, -by); m.fillStyle = gr; m.fillRect(bx - 50, by - 50, 100, 100); m.restore();
    if (f.blush > .35) {   // штрихи смущения
      m.save(); m.globalAlpha = Math.min(1, (f.blush - .35) * 1.6) * .8; m.strokeStyle = '#ffb3d0'; m.lineWidth = 3.2; m.lineCap = 'round';
      for (let i = -1; i <= 1; i++) { m.beginPath(); m.moveTo(bx + i * 11 + 4, by - 7); m.lineTo(bx + i * 11 - 4, by + 7); m.stroke(); }
      m.restore();
    }
  }
  m.filter = 'blur(16px)'; m.globalAlpha = .45; m.drawImage(layer, 0, 0);
  m.filter = 'blur(5px)'; m.globalAlpha = .7; m.drawImage(layer, 0, 0);
  m.filter = 'none'; m.globalAlpha = 1; m.drawImage(layer, 0, 0);
  faceTex.needsUpdate = true;
}

// ——— IK и кисти ———
function ik(S, Wt, pole) {
  const d = Wt.clone().sub(S), len = clamp(d.length(), .03, L1 + L2 - .002); d.normalize();
  const W = S.clone().addScaledVector(d, len);
  const a = (L1 * L1 - L2 * L2 + len * len) / (2 * len), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  const p = pole.clone().addScaledVector(d, -pole.dot(d)); if (p.lengthSq() < 1e-8) p.set(0, -1, 0); p.normalize();
  return { W, E: S.clone().addScaledVector(d, a).addScaledVector(p, h) };
}
const _m4 = new THREE.Matrix4(), _x = V(0, 0, 0), _z = V(0, 0, 0);
function setHand(A, W, F, N, ext, fist) {
  const f = F.clone().normalize(); _z.copy(N).addScaledVector(f, -N.dot(f)); if (_z.lengthSq() < 1e-6) _z.set(0, 0, 1); _z.normalize();
  _x.crossVectors(f, _z).normalize(); _z.crossVectors(_x, f);
  _m4.makeBasis(_x, f, _z); A.hand.quaternion.setFromRotationMatrix(_m4); A.hand.position.copy(W);
  // варежка: при указании сжимается в «кулачок», вытягивается указательный
  A.mitt.scale.set(.03, lerp(.041, .029, fist), lerp(.019, .022, fist)); A.mitt.position.set(0, lerp(.034, .027, fist), lerp(0, .003, fist));
  A.index.g.visible = ext > .02;
  if (A.index.g.visible) setL(A.index, V(A.ts * .013, .04, -.002), V(A.ts * .013, .04 + .042 * ext, -.004), .0088);
  A.palm.copy(W).addScaledVector(f, PALM);
}
const mixP = (a, b, w) => {
  if (w <= 0) return a;
  return { P: a.P.clone().lerp(b.P, w), F: a.F.clone().lerp(b.F, w).normalize(), N: a.N.clone().lerp(b.N, w).normalize(), O: a.O.clone().lerp(b.O, w).normalize(), ext: lerp(a.ext, b.ext, w), fist: lerp(a.fist, b.fist, w) };
};

function autoBlink(t) {
  let b = 0;
  for (let n = Math.floor(t / 3.7) - 1; n <= Math.floor(t / 3.7); n++) {
    const st = n * 3.7 + hash(n * 1.37 + .5) * 2.2, u = (t - st) / .17;
    if (u > 0 && u < 1) b = Math.max(b, Math.sin(u * Math.PI));
    if (hash(n * 4.1) > .7) { const u2 = (t - st - .3) / .15; if (u2 > 0 && u2 < 1) b = Math.max(b, Math.sin(u2 * Math.PI)); }
  }
  return b;
}

const shoulderLocal = sx => V(sx * .088, .152, -.006);
const _TM = new THREE.Matrix4(), _TR = new THREE.Matrix4();

function pose(t, k = {}) {
  const g = n => +(k[n] || 0);
  const talk = g('talk'), smile = g('smile'), happy = g('happy'), wide = g('wide'), squint = g('squint'), soft = g('soft'), puzzled = g('puzzled'), think = g('think');
  const glitch = g('glitch'), warm = clamp(g('warm')), blush = g('blush');
  const explain = g('explain'), point = g('point'), present = g('present'), hold = g('hold'), pet = g('pet');
  const look = k.look || [0, 0];
  const hR = k.handR, hRk = hR ? clamp(+(hR.k ?? 1)) : 0, hRat = hR && hR.at ? V(...hR.at) : V(-.25, .25, .25);
  const blink = clamp(Math.max(g('blink'), k.autoBlink === 0 ? 0 : autoBlink(t) * (1 - happy) * (1 - think) * (1 - glitch)));
  const live = 1 - glitch * .9, br = Math.sin(t * 1.65);
  const gj = glitch * (hash(Math.floor(t * 13) * 3.1) - .5);

  // корпус
  root.position.set(0, 0, 0);
  const dR = hRat.clone().sub(V(-.09, .25, 0)), reach = hRk * sstep(.13, .3, dR.length());
  const yaw = clamp(+(k.turn || 0), -.8, .8) - point * .12 + reach * clamp(dR.z * .9, 0, .26) + vn1(t * .21) * .02 * live;   // правое плечо вперёд, к цели
  const pitch = br * .012 * live + (hold * .1 + pet * .06) + reach * clamp(dR.z * 1.3, -.2, .32) - present * .04 + explain * .02 * Math.sin(t * 2.1);
  const roll = -reach * clamp(dR.x * 1.5, -.3, .3) + vn1(t * .17 + 5) * .015 * live;
  torso.rotation.set(pitch, yaw, roll, 'YXZ');
  torso.scale.set(1 + br * .004 * live, 1 + br * .006 * live, 1 + br * .004 * live);
  // голова
  const hTalk = talk * .025 * Math.sin(t * 9.1) * Math.sin(t * 2.3);
  head.parent.rotation.set(
    +(k.nod || 0) - look[1] * .07 + hTalk + vn1(t * .3 + 2) * .02 * live - happy * .03 + gj * .06,
    +(k.headTurn || 0) + look[0] * .1 + vn1(t * .23 + 7) * .03 * live + gj * .08,
    +(k.headTilt || 0) + puzzled * .13 + happy * .05 * Math.sin(t * 2.4) + soft * .05 + vn1(t * .19 + 11) * .025 * live, 'YXZ');

  // лицо
  drawFace(t, { look, talk, smile, happy, wide, squint, soft, puzzled, think, glitch, blink: Math.min(1, blink), blush });
  glass.emissiveIntensity = 1.55 * (1 - glitch * .4 * (hash(Math.floor(t * 20)) > .6 ? 1 : 0));
  ringM.emissiveIntensity = .7 + think * (1.3 + 1.1 * Math.sin(t * 8)) + glitch * (hash(Math.floor(t * 17) + 3) > .5 ? 1.2 : -.6);
  chestM.emissiveIntensity = warm * (2 + .25 * Math.sin(t * 2.2));
  chestM.emissive.setRGB(1, .2, .025); chestM.color.copy(chestC0).lerp(chestC1, warm);
  warmLight.intensity = warm * .09;
  warmU.uWarm.value = warm * (1 + .06 * Math.sin(t * 2.2));

  // ноги: вытянуты по сиденью, лёгкое покачивание стоп
  const sw = (k.swing ?? 1) * (1 - hold * .7) * live;
  legs.forEach((L, i) => {
    const lift = (.5 + .5 * Math.sin(t * 1.9 + i * Math.PI)) * .12 * sw;
    const hip = V(L.sx * .052, .046, .02);
    const kneeP = hip.clone().add(V(L.sx * .01, Math.sin(lift) * .115, Math.cos(lift) * .115));
    const ank = kneeP.clone().add(V(L.sx * .008, Math.sin(lift * .7) * .1, Math.cos(lift * .7) * .1));
    setL(L.thigh, hip, kneeP, .037, .034); setL(L.shin, kneeP, ank, .029, .032); L.knee.position.copy(kneeP);
    L.foot.position.copy(ank); L.foot.rotation.set(-lift * .5 - .12, L.sx * (.18 + .12 * Math.sin(t * 1.3 + i * 2) * sw), L.sx * .06);
  });

  // руки
  root.updateMatrix(); torso.updateMatrix(); _TM.multiplyMatrices(root.matrix, torso.matrix); _TR.extractRotation(_TM);
  const tp = (x, y, z) => V(x, y, z).applyMatrix4(_TM), td = (x, y, z) => V(x, y, z).applyMatrix4(_TR).normalize();
  const lap = lapLocal;
  arms.forEach((A, i) => {
    const sx = A.sx, S = shoulderLocal(sx).applyMatrix4(_TM);
    let st = { P: V(sx * .078, .104 + .002 * br, .122), F: nrm(sx * .1, -.22, 1), N: V(sx * .15, -1, .1), O: nrm(sx * .45, -.4, -1), ext: 0, fist: 0 };
    if (explain > 0) {
      const ph = t * 2.5 + i * 1.9, op = .5 + .5 * Math.sin(ph * .8 + i);
      st = mixP(st, {
        P: tp(sx * (.125 + .02 * Math.sin(ph * .7)), .13 + .028 * Math.sin(ph), .15 + .02 * Math.sin(ph * 1.3)),
        F: td(sx * .45, .5, .75), N: td(-sx * lerp(.5, .9, op), lerp(.8, .3, op), .2), O: nrm(sx * .8, -1, -.35), ext: 0, fist: 0,
      }, explain);
    }
    if (present > 0) {
      const bob = .006 * Math.sin(t * 2.2 + i);
      st = mixP(st, { P: tp(sx * .17, .08 + bob, .165), F: td(sx * .5, .12, .85), N: td(-sx * .2, 1, .05), O: nrm(sx * .6, -1, -.4), ext: 0, fist: 0 }, present);
    }
    if (point > 0 && sx < 0) {
      const dir = nrm(-.5, .14, .86);
      st = mixP(st, { P: S.clone().addScaledVector(dir, .2 + PALM * .6), F: dir, N: nrm(.45, -.85, .1), O: nrm(-1, -.6, -.2), ext: 1, fist: 1 }, point);
    }
    if (hold > 0) {
      st = mixP(st, sx < 0
        ? { P: lap.clone().add(V(-.07, .07, .11)), F: nrm(.8, -.25, .45), N: nrm(.4, -.15, -.9), O: nrm(-1, -.5, -.2), ext: 0, fist: 0 }
        : { P: lap.clone().add(V(.1, .095, .02)), F: nrm(-.45, -.45, .75), N: nrm(-.85, -.45, 0), O: nrm(.55, -1, -.35), ext: 0, fist: 0 }, hold);
    }
    if (pet > 0 && sx > 0) {
      const ph = t * 2.3, u = .5 - .5 * Math.cos(ph), up = Math.max(0, Math.sin(ph)) * .014;
      st = mixP(st, { P: lap.clone().add(V(lerp(.06, -.01, u), .16 + up, lerp(-.04, .1, u))), F: nrm(-.35, -.18, 1), N: nrm(-.15, -1, .05), O: nrm(1, -.65, -.45), ext: 0, fist: .1 }, pet);
    }
    if (hRk > 0 && sx < 0) {
      const dir = hRat.clone().sub(S).normalize();
      st = mixP(st, { P: hRat.clone(), F: dir.clone().add(V(0, .25, 0)).normalize(), N: nrm(.1, -1, .25), O: nrm(-.8, -1, -.3), ext: .85, fist: .85 }, hRk);
    }
    const { W, E } = ik(S, st.P.clone().addScaledVector(st.F, -PALM), st.O);
    A.sh.position.copy(S); A.el.position.copy(E);
    setL(A.up, S, E, .022, .022); setL(A.fore, E, W, .022, .0265);
    A.cuff.position.copy(W); A.cuff.quaternion.setFromUnitVectors(V(0, 1, 0), W.clone().sub(E).normalize());
    setHand(A, W, st.F, st.N, st.ext, st.fist);
  });
  updWarm();
}
function vn1(x) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i), hash(i + 1), u) * 2 - 1; }

// мировые точки свечения (обновляются и в pose, и перед каждым рендером — на случай, если group двигают после pose)
const _c = V(0, 0, 0);
function updWarm() {
  group.updateMatrixWorld(true);
  warmU.uChest.value.copy(torso.localToWorld(_c.set(0, chestY, chestZ - .035)));
  warmU.uLapL.value.copy(group.localToWorld(_c.set(.062, .084, .15)));
  warmU.uLapR.value.copy(group.localToWorld(_c.set(-.062, .084, .15)));
}
{ const prev = scene.onBeforeRender; scene.onBeforeRender = function (...a) { if (prev) prev.apply(this, a); updWarm(); }; }

function handWorld(side = 'R') { group.updateMatrixWorld(true); const A = arms[side === 'L' ? 1 : 0]; return group.localToWorld(A.palm.clone()); }
function headWorld() { group.updateMatrixWorld(true); return head.localToWorld(V(0, 0, 0)); }

pose(0, {});
export const neuro = { group, pose, handWorld, headWorld, lapLocal };
