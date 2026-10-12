// НЕЙРО — маленький милый робот-ИИ (женский персонаж) для «Ты думаешь или зависла?».
// Перламутровый корпус, тёмное стекло лица с глазами на CanvasTexture (emissiveMap), ручки-варежки, короткие ножки.
// Экспорт: neuro = { group, pose(t, k), handWorld(side), headWorld(), lapLocal }. Всё в pose — чистая функция (t, k).
import { THREE, scene, V, sph, setRod, clamp, lerp, hash } from './core.js';

const TAU = Math.PI * 2;
const sstep = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const nrm = (x, y, z) => V(x, y, z).normalize();

// ——— материалы ———
// warm: тёплое свечение «изнутри» — гауссианы вокруг груди, коленей и места, где котёнок трогает бок (uTouch)
// sheen: дешёвый «перламутр» — к краям диффуз уходит в лавандовый/мятный, плюс слабый холодный ободок
const warmU = {
  uWarm: { value: 0 }, uChestK: { value: 0 }, uTouchK: { value: 0 }, uWarmCol: { value: new THREE.Color(1, .33, .06) },
  uChest: { value: V(0, -9, 0) }, uLapL: { value: V(0, -9, 0) }, uLapR: { value: V(0, -9, 0) }, uTouch: { value: V(0, -9, 0) },
};
function decorate(m, warm, sheen) {
  m.onBeforeCompile = sh => {
    let head = '', col = '', nor = '', em = '';
    if (warm) {
      Object.assign(sh.uniforms, warmU);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWarmP;')
        .replace('#include <project_vertex>', '#include <project_vertex>\n\tvWarmP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      head += 'varying vec3 vWarmP; uniform float uWarm, uChestK, uTouchK; uniform vec3 uChest, uLapL, uLapR, uTouch, uWarmCol;\n';
      col += `
	vec3 wc = vWarmP - uChest, w1 = vWarmP - uLapL, w2 = vWarmP - uLapR, wt = vWarmP - uTouch;
	float warmG = uWarm * (uChestK * exp(-(wc.x * wc.x / .02 + dot(wc.yz, wc.yz) / .0095)) + .8 * (exp(-dot(w1, w1) / .0032) + exp(-dot(w2, w2) / .0032)));
	float touchG = uTouchK * exp(-dot(wt, wt) / .0042);
	diffuseColor.rgb *= mix(vec3(1.), vec3(1., .54, .28), clamp(warmG, 0., 1.) * .92) * mix(vec3(1.), vec3(1., .36, .11), clamp(touchG, 0., 1.) * .95);   // свет сквозь «пластик»`;
      em += '\n\ttotalEmissiveRadiance += uWarmCol * (uWarm * .12 + warmG * 1.45 + touchG * .95);';
    }
    if (sheen) {
      nor += `
	{ float pv = 1. - clamp(dot(normal, normalize(vViewPosition)), 0., 1.), pf = pv * pv;
	  vec3 tint = mix(vec3(.94, .9, 1.07), vec3(.88, 1.04, 1.), smoothstep(.3, .85, pv));
	  diffuseColor.rgb *= mix(vec3(1.), tint, clamp(pf * 1.6, 0., 1.)); }`;
      em += `
	{ float pv = 1. - clamp(dot(normal, normalize(vViewPosition)), 0., 1.); totalEmissiveRadiance += vec3(.42, .52, .75) * pow(pv, 4.) * .05; }`;
    }
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + head)
      .replace('#include <color_fragment>', '#include <color_fragment>' + col)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>' + nor)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>' + em);
  };
  m.customProgramCacheKey = () => 'neuro' + (warm ? 'W' : '') + (sheen ? 'S' : '');
  return m;
}
const PEARL = 0xe9e4dc, env = scene.environment;
// лак (clearcoat) только на шлеме — он несёт глянец на крупных планах; остальное — MeshStandard (дешевле на SwiftShader)
const shellM = decorate(new THREE.MeshPhysicalMaterial({ color: PEARL, roughness: .36, metalness: 0, clearcoat: 1, clearcoatRoughness: .12 }), false, true);
const pearl = decorate(new THREE.MeshStandardMaterial({ color: PEARL, roughness: .27, metalness: 0, envMap: env, envMapIntensity: .32 }), true, true);
const joint = new THREE.MeshStandardMaterial({ color: 0xbcc1c9, roughness: .32, metalness: .45, envMap: env, envMapIntensity: .5 });
const cuffM = new THREE.MeshStandardMaterial({ color: 0x9da3ac, roughness: .3, metalness: .5, envMap: env, envMapIntensity: .5 });
const bootM = new THREE.MeshStandardMaterial({ color: 0xbdb6ad, roughness: .38, metalness: .05, envMap: env, envMapIntensity: .3 });
const soleM = new THREE.MeshStandardMaterial({ color: 0x8c9199, roughness: .55, metalness: .1 });
const ringM = new THREE.MeshStandardMaterial({ color: 0x0c1a24, emissive: 0x5fd8ff, emissiveIntensity: .8, roughness: .3 });
const chestM = new THREE.MeshStandardMaterial({ color: 0xf2efe9, roughness: .2, emissive: 0xff8a3a, emissiveIntensity: 0, envMap: env, envMapIntensity: .5 });
const chestC0 = new THREE.Color(0xeeebe6), chestC1 = new THREE.Color(0x6a2c0c);

const mesh = (geo, m, sh = true) => { const o = new THREE.Mesh(geo, m); o.castShadow = sh; o.receiveShadow = true; return o; };
const small = o => { o.castShadow = false; return o; };   // мелочь без тени

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
  const g = new THREE.SphereGeometry(1, 64, 44), P = g.attributes.position, N = g.attributes.normal, d = V(0, 0, 0);
  for (let i = 0; i < P.count; i++) {
    d.set(P.getX(i), P.getY(i), P.getZ(i)).normalize();
    const p = headPt(d), n = headNrm(p); P.setXYZ(i, p.x, p.y, p.z); N.setXYZ(i, n.x, n.y, n.z);
  }
  head.add(mesh(g, shellM));
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
// стекло — MeshStandard (на SwiftShader заметно дешевле Physical при том же виде: гладкий тёмный глянец + отражения)
const glass = new THREE.MeshStandardMaterial({
  color: 0x05080e, roughness: .06, metalness: 0,
  emissive: 0xffffff, emissiveMap: faceTex, emissiveIntensity: 1.55, envMap: env, envMapIntensity: .5,
});
const visor = mesh(visorGeo(.0016, .0055), glass, false); head.add(visor);
// мягкий блик на стекле (мультяшное отражение окна)
{
  const hl = document.createElement('canvas'); hl.width = 512; hl.height = 256; const x = hl.getContext('2d');
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
  head.add(small(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 280, .0042, 10, true), joint)));
}
// «ушки»-диски с подсветкой
[-1, 1].forEach(s => {
  const p = headPt(nrm(s, .02, -.08)), n = headNrm(p), g = new THREE.Group();
  g.position.copy(p).addScaledVector(n, -.004); g.quaternion.setFromUnitVectors(V(0, 0, 1), n); head.add(g);
  const base = mesh(new THREE.CylinderGeometry(.047, .052, .02, 48), joint); base.rotation.x = Math.PI / 2; g.add(base);
  const ring = mesh(new THREE.TorusGeometry(.036, .0052, 12, 64), ringM, false); ring.position.z = .0105; g.add(ring);
  const cap = small(sph(.029, shellM, 32, 18)); cap.scale.z = .42; cap.position.z = .011; g.add(cap);
});
// шея
{ const n = mesh(new THREE.CylinderGeometry(.026, .032, .05, 24), joint); n.position.set(0, .222, -.004); torso.add(n); }

// ——— корпус: яйцо (шире книзу), грудной «огонёк» ———
const EGG = { yc: .1, hy: .123, R: .104, egg: .17, zs: .86 };
const eggR = y => { const c = clamp((EGG.yc - y) / EGG.hy, -1, 1), s = Math.sqrt(1 - c * c); return EGG.R * s * (1 + EGG.egg * c); };
{
  const pts = []; for (let i = 0; i <= 40; i++) { const th = i / 40 * Math.PI, c = Math.cos(th); pts.push(new THREE.Vector2(Math.max(1e-4, EGG.R * Math.sin(th) * (1 + EGG.egg * c)), EGG.yc - EGG.hy * c)); }
  const o = mesh(new THREE.LatheGeometry(pts, 56, Math.PI), pearl); o.scale.z = EGG.zs; torso.add(o);
  // шов-«воротник», утоплен в корпус (радиус яйца на этой высоте ≈ .036)
  const col = small(mesh(new THREE.TorusGeometry(.039, .006, 10, 40), joint)); col.rotation.x = Math.PI / 2; col.position.set(0, .212, -.002); col.scale.set(1, EGG.zs, 1); torso.add(col);
}
const chestY = .128, chestZ = eggR(chestY) * EGG.zs;
{ // «сердечко»-огонёк на груди, по нормали к корпусу
  const dr = (eggR(chestY + .002) - eggR(chestY - .002)) / .004, n = nrm(0, -EGG.zs * dr, 1), g = new THREE.Group();
  g.position.set(0, chestY, chestZ); g.quaternion.setFromUnitVectors(V(0, 0, 1), n); torso.add(g);
  const l = mesh(new THREE.SphereGeometry(.019, 32, 16), chestM, false); l.scale.z = .32; l.position.z = .0005; g.add(l);
  const r = mesh(new THREE.TorusGeometry(.0205, .0034, 10, 40), joint, false); r.position.z = .0012; g.add(r);
}
// (отдельного тёплого прожектора нет: включение/выключение источника пересобирает шейдеры всей сцены;
//  тепло — эмиссия корпуса + bloom)

// ——— таз и ноги ———
{ const p = sph(1, pearl, 40, 24); p.scale.set(.098, .062, .088); p.position.set(0, .06, .004); root.add(p); }
const tapGeo = new THREE.CylinderGeometry(1, .82, 1, 20);   // верх (b) шире низа (a)
const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 20);
function limb(m, tapered = false, shadow = true) {
  const g = new THREE.Group(), c = mesh(tapered ? tapGeo : cylGeo, m, shadow), s1 = sph(1, m, 20, 14), s2 = sph(1, m, 20, 14);
  s1.castShadow = s2.castShadow = shadow;
  g.add(c, s1, s2); return { g, c, s1, s2 };
}
function setL(L, a, b, ra, rb = ra) {
  setRod(L.c, a, b, 1); L.c.scale.set(rb, Math.max(a.distanceTo(b), 1e-4), rb);
  L.s1.position.copy(a); L.s1.scale.setScalar(ra); L.s2.position.copy(b); L.s2.scale.setScalar(rb);
}
const legs = [-1, 1].map(sx => {
  const thigh = limb(pearl), shin = limb(pearl, true), knee = sph(.036, joint, 24, 16);
  // ботинок: вытянут вперёд, носок чуть вверх; тёплый серый с тёмной подошвой и перламутровой манжетой
  const foot = new THREE.Group(), boot = sph(1, bootM, 32, 20), sole = sph(1, soleM, 28, 14), cuffB = mesh(new THREE.CylinderGeometry(.033, .031, .02, 28), pearl);
  boot.scale.set(.037, .039, .058); boot.position.set(0, .004, .03);
  sole.scale.set(.033, .011, .054); sole.position.set(0, -.027, .032);
  cuffB.rotation.x = Math.PI / 2; cuffB.position.set(0, .002, -.004);
  foot.add(boot, sole, cuffB); root.add(thigh.g, shin.g, knee, foot);
  return { sx, thigh, shin, knee, foot };
});
export const lapLocal = V(0, .074, .152);

// ——— руки ———
const L1 = .104, L2 = .102, PALM = .039, STRETCH = 1.14;   // мультяшное растяжение руки до +14%, когда точка далеко
const arms = [-1, 1].map(sx => {
  const up = limb(pearl), fore = limb(pearl, true), sh = sph(.025, joint, 28, 18), el = sph(.023, joint, 24, 16);
  const cuff = small(mesh(new THREE.CylinderGeometry(.0295, .0295, .016, 28), cuffM));   // серый браслет, заметно толще предплечья
  const hand = new THREE.Group(), ts = -sx;   // ts: сторона большого пальца в локальных X кисти
  const mitt = sph(1, pearl, 32, 20);
  // большой палец — короткая пухлая «долька» варежки: основание утоплено, отведён на ~42° от оси и чуть к ладони
  const thumb = small(sph(1, pearl, 20, 14)); thumb.scale.set(.0105, .0175, .0098);
  thumb.position.set(ts * .027, .02, .005); thumb.rotation.set(.25, 0, -ts * .73);
  const index = limb(pearl, true, false);
  hand.add(mitt, thumb, index.g);
  group.add(up.g, fore.g, sh, el, cuff, hand);
  return { sx, up, fore, sh, el, cuff, hand, mitt, index, ts, palm: V(0, 0, 0) };
});

// ——— лицо: рисование на холсте ———
const EX = 94, EY = FH * .44, EW = 62, EH = 82, MY = FH * .8;
const CYAN = '#46ccff';
let scanPat = null;
function pillPath(c, x, y, w, h) { const r = Math.min(w, h) * .47; c.beginPath(); c.roundRect(x - w / 2, y - h / 2, w, h, r); }
// глаз: x,y,w,h; верхнее веко top (доля h), slant (+ внутренний край ниже), curve (выпуклость века вниз);
// нижнее «веко»-круг bot (доля h), botR (радиус в долях w); hole — дырка в центре (доля радиуса, глаз → кольцо); alpha
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
  if (e.hole > .01) {
    c.beginPath(); c.rect(x - w * 2, yT - 60, w * 4, h + 120); c.ellipse(x, y, e.hole * w / 2, e.hole * h / 2, 0, 0, TAU); c.clip('evenodd');
  }
  const gr = c.createRadialGradient(x - w * .08, y - h * .12, 0, x, y, Math.max(w, h) * .62);
  gr.addColorStop(0, '#bff3ff'); gr.addColorStop(.4, '#52d0ff'); gr.addColorStop(1, '#1b94ff');
  c.globalAlpha = e.alpha; c.fillStyle = gr; pillPath(c, x, y, w, h); c.fill();
  if (e.spark > .02 && h > 18) {   // блики-искорки
    c.globalAlpha = e.alpha * e.spark; c.fillStyle = '#ffffff';
    const r1 = Math.min(w, h) * .14 * e.sparkS;
    c.beginPath(); c.arc(x + w * .17, y - h * .2, r1, 0, TAU); c.fill();
    c.beginPath(); c.arc(x - w * .16, y + h * .17, r1 * .45, 0, TAU); c.fill();
    if (e.spark3 > .02) { c.globalAlpha = e.alpha * e.spark * e.spark3; c.beginPath(); c.arc(x + w * .27, y + h * .04, r1 * .32, 0, TAU); c.fill(); }
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
// «думает»: яркая бегущая дуга (хвост-комета) по кольцу глаза + светлая головка; sy — сплющивание при моргании
function drawSpinner(c, x, y, R, lw, t, a, sy) {
  const ang0 = t * 5.3, span = 4.5, N = 20;
  c.save(); c.translate(x, y); c.scale(1, sy); c.lineCap = 'round';
  for (let i = 0; i < N; i++) {
    const u = i / N, a0 = ang0 - span * (1 - u), a1 = ang0 - span * (1 - (i + 1) / N) + .03;
    c.globalAlpha = a * (.1 + .9 * Math.pow(u, 1.3)); c.strokeStyle = u > .55 ? '#effeff' : '#8ae6ff'; c.lineWidth = lw * (.55 + .6 * u);
    c.beginPath(); c.arc(0, 0, R, a0, a1); c.stroke();
  }
  c.globalAlpha = a; c.fillStyle = '#f4feff';
  c.beginPath(); c.arc(Math.cos(ang0) * R, Math.sin(ang0) * R, lw * .72, 0, TAU); c.fill();
  c.restore(); c.globalAlpha = 1;
}
function drawFace(t, f) {
  const c = lc; c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.clearRect(0, 0, FW, FH);
  const [lx, ly] = f.look;
  const tm = sstep(.03, .33, f.think) * (1 - f.glitch);   // уже при think ≈ .3 глаза полностью «индикаторы вычислений»
  const RR = 26 + f.wide * 3, LW = 11;
  // глаза
  for (const s of [-1, 1]) {
    const pers = 1 + s * lx * .07;
    const e = { x: FW / 2 + s * EX + lx * 30, y: EY - ly * 18, w: EW * pers, h: EH * pers, top: 0, slant: 0, curve: 0, bot: 0, botR: .9, alpha: 1, spark: 1, sparkS: 1, spark3: 0, lash: 1, hole: 0 };
    e.w *= 1 + f.wide * .4 + f.happy * .14; e.h *= 1 + f.wide * .35 - f.happy * .06 - f.soft * .04;
    e.bot = Math.max(f.smile * .13, f.soft * .34, f.squint * .2);
    // нежно: верхнее веко без перекоса, дугой по форме глаза (подрезает только уголки), снизу «улыбка» щёк, глаза чуть ниже
    e.top = f.squint * .42 + f.soft * .17; e.slant = f.squint * .05; e.curve = -f.soft * .4 - f.squint * .08; e.y += f.soft * 4;
    // недоумение: левый на холсте (правый у неё) приподнят и округлён, второй прищурен
    if (s < 0) { e.y -= 13 * f.puzzled; e.h *= 1 + .12 * f.puzzled; e.top *= 1 - f.puzzled; }
    else { e.y += 4 * f.puzzled; e.h *= 1 - .06 * f.puzzled; e.top = lerp(e.top, .38, f.puzzled); e.slant = lerp(e.slant, -.04, f.puzzled); e.curve = lerp(e.curve, -.1, f.puzzled); }
    e.botR = lerp(lerp(lerp(.9, 1.5, f.squint), .75, f.soft), .56, f.happy); e.bot = lerp(e.bot, .8, f.happy);
    e.top *= 1 - f.wide; e.bot *= 1 - f.wide;
    // глюк: глаза-полоски
    e.h = lerp(e.h, 9, f.glitch); e.w = lerp(e.w, e.w * 1.3, f.glitch); e.top *= 1 - f.glitch; e.bot *= 1 - f.glitch;
    e.spark = (1 - f.happy) * (1 - f.glitch) * sstep(.25, .6, 1 - f.blink) * (1 - f.squint * .5); e.sparkS = 1 + f.wide * .35 + f.soft * .15; e.spark3 = f.wide;
    e.lash = (1 - f.glitch);
    // думает: глаз округляется и становится кольцом-дорожкой, по которому бежит яркая дуга
    if (tm > 0) {
      const D = 2 * RR + LW;
      e.w = lerp(e.w, D, tm); e.h = lerp(e.h, D, tm); e.y = lerp(e.y, EY - ly * 18, tm);
      e.top *= 1 - tm; e.bot *= 1 - tm; e.hole = tm * (RR - LW / 2) / (RR + LW / 2);
      e.spark *= 1 - tm; e.lash *= 1 - tm * .5; e.alpha = 1 - tm * .62;
    }
    const D0 = e.h;
    e.h = Math.max(5.5, e.h * (1 - f.blink * .94));
    drawEye(c, e, s);
    if (tm > .02) drawSpinner(c, e.x, e.y, e.w / 4 * (1 + e.hole), LW, t, sstep(.25, .8, tm), e.h / D0);   // по середине кольца
  }
  // рот
  const mx = FW / 2 + lx * 16, my = MY - ly * 9;
  if (tm < .98) {
    const mw = 50 + f.smile * 12 + f.happy * 8 + f.soft * 2 - f.wide * 18 * (1 - f.talk * .6) + f.talk * 6 * Math.sin(t * 7.3) * Math.sin(t * 3.1),
      open = f.talk * 20 + f.wide * 8 * (1 - f.talk * .5),
      dep = (3 + f.smile * 7.5 + f.happy * 6.5 + f.soft * 3 - f.squint * 2 - f.puzzled * 3.5 - f.glitch * 3) * 1.15 - f.wide * 6 * (1 - f.talk * .5),
      lift = f.squint * 5 + f.puzzled * 4;   // асимметрия: ухмылка
    const Lx = mx - mw / 2, Ly = my + lift * .2, Rx = mx + mw / 2, Ry = my - lift;
    c.save(); c.globalAlpha = (1 - f.glitch * .3) * (1 - tm); c.strokeStyle = CYAN; c.lineWidth = 6.5; c.lineJoin = c.lineCap = 'round';
    c.beginPath(); c.moveTo(Lx, Ly);
    c.quadraticCurveTo(mx, (Ly + Ry) / 2 + dep * 2, Rx, Ry);
    if (open > .6) {
      c.quadraticCurveTo(mx, (Ly + Ry) / 2 + (dep + open) * 2, Lx, Ly); c.closePath();
      const yTop = (Ly + Ry) / 2 + dep, yBot = (Ly + Ry) / 2 + dep + open * 1.2;
      const gr = c.createLinearGradient(0, yTop, 0, yBot + 2); gr.addColorStop(0, 'rgba(18,70,120,.95)'); gr.addColorStop(1, 'rgba(90,215,255,.95)');
      c.fillStyle = gr; c.fill();
    }
    c.stroke(); c.restore();
  }
  if (tm > .02) {   // «…»: три прыгающие точки; когда говорит, средняя раскрывается как рот
    const tk = clamp(f.talk / 1.1);
    c.save(); c.globalAlpha = tm * (1 - f.glitch * .3); c.fillStyle = '#9ff0ff';
    for (let i = -1; i <= 1; i++) {
      const b = Math.pow(Math.max(0, Math.sin(t * 6.2 - (i + 1) * 1.05)), 2) * 8 * (1 - tk * .8);
      const rx = 6.2 + (i === 0 ? tk * 4 : -tk * 1.2), ry = 6.2 + (i === 0 ? tk * 11 : -tk * 1.2);
      c.beginPath(); c.ellipse(mx + i * 20, my + 2 - b + (i === 0 ? tk * 4 : 0), rx, ry, 0, 0, TAU); c.fill();
    }
    c.restore();
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
// двухзвенная IK; если точка дальше длины руки — рука мультяшно тянется (до STRETCH), сохраняя лёгкий изгиб
function ik(S, Wt, pole) {
  const d = Wt.clone().sub(S), dist = d.length(), s = clamp(dist / ((L1 + L2) * .97), 1, STRETCH), l1 = L1 * s, l2 = L2 * s;
  const len = clamp(dist, .03, (l1 + l2) * .985); d.normalize();
  const W = S.clone().addScaledVector(d, len);
  const a = (l1 * l1 - l2 * l2 + len * len) / (2 * len), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const p = pole.clone().addScaledVector(d, -pole.dot(d)); if (p.lengthSq() < 1e-8) p.set(0, -1, 0); p.normalize();
  return { W, E: S.clone().addScaledVector(d, a).addScaledVector(p, h) };
}
const _m4 = new THREE.Matrix4(), _x = V(0, 0, 0), _z = V(0, 0, 0);
function setHand(A, W, F, N, ext, fist) {
  const f = F.clone().normalize(); _z.copy(N).addScaledVector(f, -N.dot(f)); if (_z.lengthSq() < 1e-6) _z.set(0, 0, 1); _z.normalize();
  _x.crossVectors(f, _z).normalize(); _z.crossVectors(_x, f);
  _m4.makeBasis(_x, f, _z); A.hand.quaternion.setFromRotationMatrix(_m4); A.hand.position.copy(W);
  // варежка: раскрытая — шире и площе; при указании сжимается в «кулачок», вытягивается указательный
  A.mitt.scale.set(lerp(.034, .03, fist), lerp(.041, .029, fist), lerp(.0165, .022, fist)); A.mitt.position.set(0, lerp(.039, .032, fist), lerp(0, .003, fist));
  A.index.g.visible = ext > .02;   // трансформ обновляется всегда (чистая функция и для скрытого пальца)
  setL(A.index, V(A.ts * .011, .046 + .044 * ext, -.006), V(A.ts * .012, .044, -.005), .0076, .0101);   // от кончика к основанию (сужается к кончику)
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
const _e = new THREE.Euler(), _q0 = new THREE.Quaternion(), _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
// котёнок на коленях (как его кладёт main.js: lapLocal, поворот +0.5 рад относительно Нейро): центр головы и оси
const CAT_YAW = .5, catB = V(-Math.sin(CAT_YAW), 0, -Math.cos(CAT_YAW)), catA = V(Math.cos(CAT_YAW), 0, -Math.sin(CAT_YAW));   // назад к хвосту, к его левому боку
const catHead = lapLocal.clone().add(V(.033, .12, .062));
const VISOR_DOWN = .22;   // сильнее вниз стекло не наклоняется: остальное «досматривают» глаза на стекле

function pose(t, k = {}) {
  const g = n => +(k[n] || 0);
  const talk = g('talk'), smile = g('smile'), happy = g('happy'), wide = g('wide'), squint = g('squint'), soft = g('soft'), puzzled = g('puzzled'), think = g('think');
  const glitch = g('glitch'), warm = clamp(g('warm')), blush = g('blush');
  const explain = g('explain'), point = g('point'), present = g('present'), hold = g('hold'), pet = g('pet');
  const look = k.look || [0, 0];
  const hR = k.handR, hRk = hR ? clamp(+(hR.k ?? 1)) : 0, hRat = hR && hR.at ? V(...hR.at) : V(-.25, .25, .25);
  // своё моргание — только если интеграция не передаёт blink сама (или autoBlink: 0)
  const blink = clamp(Math.max(g('blink'), k.autoBlink === 0 || 'blink' in k ? 0 : autoBlink(t) * (1 - happy) * (1 - think) * (1 - glitch)));
  const live = 1 - glitch * .9, br = Math.sin(t * 1.65);
  const gj = glitch * (hash(Math.floor(t * 13) * 3.1) - .5);

  // корпус
  root.position.set(0, 0, 0);
  const holdLean = hold * .1 + pet * .06;
  const yaw0 = clamp(+(k.turn || 0), -.8, .8) - point * .12 + vn1(t * .21) * .02 * live;
  const pitch0 = br * .012 * live + holdLean - present * .04 + explain * .02 * Math.sin(t * 2.1);
  const roll0 = vn1(t * .17 + 5) * .015 * live;
  // дотянуться правой рукой до hR.at: поворот корпуса влево (правое плечо вперёд), наклон вперёд не больше ~20°
  // и вбок; остаток добирает мультяшное растяжение руки (ik)
  let ry = 0, rp = 0, rr = 0;
  torso.scale.set(1 + br * .004 * live, 1 + br * .006 * live, 1 + br * .004 * live);
  if (hRk > 0) {
    const dR = hRat.clone().sub(V(-.09, .25, 0)); ry = clamp(dR.z * 1.3, 0, .42) * sstep(.12, .28, dR.length());
    for (let it = 0; it < 6; it++) {
      torso.rotation.set(pitch0 + rp, yaw0 + ry, roll0 + rr, 'YXZ'); torso.updateMatrix(); root.updateMatrix();
      const S = shoulderLocal(-1).applyMatrix4(_TM.multiplyMatrices(root.matrix, torso.matrix));
      const F = hRat.clone().sub(S).normalize().add(V(0, .25, 0)).normalize(), Wt = hRat.clone().addScaledVector(F, -PALM);
      const d = Wt.clone().sub(S), short = d.length() - (L1 + L2) * 1.07; if (short <= 0) break; d.normalize();
      rp = Math.min(.36, rp + short * Math.max(.25, d.z - d.y * .5) / .15); rr = clamp(rr - short * d.x / .15, -.26, .26);
    }
  }
  torso.rotation.set(pitch0 + hRk * rp, yaw0 + hRk * ry, roll0 + hRk * rr, 'YXZ');
  // голова: держит лицо к зрителю, пока корпус тянется к ползунку или склоняется над котёнком
  const hTalk = talk * .025 * Math.sin(t * 9.1) * Math.sin(t * 2.3);
  const bp = pitch0 - holdLean * .5 + hRk * rp * .15, by = yaw0 + hRk * ry * .5, bz = roll0 + hRk * rr * .2;   // «база» головы
  let hp = +(k.nod || 0) - look[1] * .07 + hTalk + vn1(t * .3 + 2) * .02 * live - happy * .03 + gj * .06;
  let lookY = look[1];
  { const tot = bp + hp; if (tot > VISOR_DOWN) { const ex = (tot - VISOR_DOWN) * .8; hp -= ex; lookY -= ex * 2.6; } }
  const hy = +(k.headTurn || 0) + look[0] * .1 + vn1(t * .23 + 7) * .03 * live + gj * .08;
  const hz = +(k.headTilt || 0) + puzzled * .13 + happy * .05 * Math.sin(t * 2.4) + soft * .05 + vn1(t * .19 + 11) * .025 * live;
  _q0.setFromEuler(torso.rotation).invert();
  _q1.setFromEuler(_e.set(bp, by, bz, 'YXZ')); _q2.setFromEuler(_e.set(hp, hy, hz, 'YXZ'));
  headPiv.quaternion.copy(_q0).multiply(_q1).multiply(_q2);

  // лицо
  drawFace(t, { look: [look[0], clamp(lookY, -1.4, 1.2)], talk, smile, happy, wide, squint, soft, puzzled, think, glitch, blink: Math.min(1, blink), blush });
  glass.emissiveIntensity = 1.55 * (1 - glitch * .4 * (hash(Math.floor(t * 20)) > .6 ? 1 : 0));
  ringM.emissiveIntensity = .7 + sstep(.03, .33, think) * (1.3 + 1.1 * Math.sin(t * 8)) + glitch * (hash(Math.floor(t * 17) + 3) > .5 ? 1.2 : -.6);
  // тепло: сначала бок под лапкой котёнка (uTouch), грудь — чуть позже (uChestK)
  const wch = sstep(.25, .85, warm);
  chestM.emissiveIntensity = wch * (2 + .25 * Math.sin(t * 2.2));
  chestM.emissive.setRGB(1, .2, .025); chestM.color.copy(chestC0).lerp(chestC1, wch);
  warmU.uWarm.value = warm * (1 + .06 * Math.sin(t * 2.2)); warmU.uChestK.value = wch;
  warmU.uTouchK.value = sstep(0, .4, warm) * (1 - sstep(0, .6, hold)) * 1.1 * (1 + .08 * Math.sin(t * 3.1));

  // ноги: вытянуты по сиденью, лёгкое покачивание стоп
  const sw = (k.swing ?? 1) * (1 - hold * .7) * live;
  legs.forEach((L, i) => {
    const lift = (.5 + .5 * Math.sin(t * 1.9 + i * Math.PI)) * .12 * sw;
    const hip = V(L.sx * .052, .046, .02);
    const kneeP = hip.clone().add(V(L.sx * .01, Math.sin(lift) * .115, Math.cos(lift) * .115));
    const ank = kneeP.clone().add(V(L.sx * .008, Math.sin(lift * .7) * .1, Math.cos(lift * .7) * .1));
    setL(L.thigh, hip, kneeP, .037, .034); setL(L.shin, kneeP, ank, .026, .029); L.knee.position.copy(kneeP);
    L.foot.position.copy(ank); L.foot.rotation.set(-lift * .5 - .3, L.sx * (.2 + .12 * Math.sin(t * 1.3 + i * 2) * sw), L.sx * .06);
  });

  // руки
  root.updateMatrix(); torso.updateMatrix(); _TM.multiplyMatrices(root.matrix, torso.matrix); _TR.extractRotation(_TM);
  const tp = (x, y, z) => V(x, y, z).applyMatrix4(_TM), td = (x, y, z) => V(x, y, z).applyMatrix4(_TR).normalize();
  const lap = lapLocal;
  arms.forEach((A, i) => {
    const sx = A.sx, S = shoulderLocal(sx).applyMatrix4(_TM);
    // покой: ладони на внешней стороне бёдер (варежки отдельно от коленей в силуэте)
    let st = { P: V(sx * .094, .09 + .002 * br, .088), F: nrm(sx * .18, -.3, 1), N: nrm(-sx * .6, -1, .05), O: nrm(sx * .7, -.4, -1), ext: 0, fist: 0 };
    if (explain > 0) {   // открытые ладони к собеседнику, покачиваются «показать ↔ ладонью вверх»
      const ph = t * 2.5 + i * 1.9, op = .5 + .5 * Math.sin(ph * .8 + i);
      st = mixP(st, {
        P: tp(sx * (.13 + .02 * Math.sin(ph * .7)), .13 + .028 * Math.sin(ph), .15 + .02 * Math.sin(ph * 1.3)),
        F: td(sx * lerp(.6, .45, op), lerp(.42, .1, op), lerp(.62, .9, op)), N: td(-sx * lerp(.35, .2, op), lerp(-.1, .95, op), lerp(1, -.05, op)),
        O: nrm(sx * .8, -1, -.35), ext: 0, fist: 0,
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
    if (hold > 0) {   // ладони на боках котёнка ниже линии головы: правая — на его правом боку, левая — на левом
      st = mixP(st, sx < 0
        ? { P: lap.clone().add(V(-.112, .066, .012)), F: nrm(.22, -.5, 1), N: nrm(1, .2, .05), O: nrm(-1, -.5, -.35), ext: 0, fist: 0 }
        : { P: lap.clone().add(V(.122, .074, -.012)), F: nrm(-.2, -.5, 1), N: nrm(-1, .15, .1), O: nrm(1, -.5, -.4), ext: 0, fist: 0 }, hold);
    }
    if (pet > 0 && sx > 0) {
      // левая гладит: от макушки за ушками назад по шее (~8 см), в конце запястье приподнимается, возврат по воздуху
      const cyc = ((t * 2.4 / TAU) % 1 + 1) % 1, u = cyc < .6 ? sstep(0, 1, cyc / .6) : 1 - sstep(0, 1, (cyc - .6) / .4);
      const lift = cyc < .52 ? 0 : Math.pow(Math.sin(Math.PI * (cyc - .52) / .48), 2);
      const P = catHead.clone().addScaledVector(catB, lerp(-.03, .1, u)).addScaledVector(catA, .006);
      P.y += lerp(.09, .062, u) - .004 * Math.sin(Math.PI * u) + lift * .028;
      const F = catB.clone().multiplyScalar(-.85).add(V(0, -.32 + lift * .7, 0)).normalize();
      st = mixP(st, { P, F, N: nrm(-catB.x * .2, -1, -catB.z * .2), O: nrm(1, -.6, -.5), ext: 0, fist: .1 }, pet);
    }
    if (hRk > 0 && sx < 0) {
      const dir = hRat.clone().sub(S).normalize();
      st = mixP(st, { P: hRat.clone(), F: dir.clone().add(V(0, .25, 0)).normalize(), N: nrm(.1, -1, .25), O: nrm(-.8, -1, -.3), ext: .85, fist: .85 }, hRk);
    }
    const { W, E } = ik(S, st.P.clone().addScaledVector(st.F, -PALM), st.O);
    A.sh.position.copy(S); A.el.position.copy(E);
    const wd = W.clone().sub(E).normalize();
    setL(A.up, S, E, .022, .022); setL(A.fore, E, W, .022, .0262);
    A.cuff.position.copy(W).addScaledVector(wd, .003); A.cuff.quaternion.setFromUnitVectors(V(0, 1, 0), wd);
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
  warmU.uTouch.value.copy(group.localToWorld(_c.set(-.112, .128, .035)));   // правый бок/локоть, куда тянется котёнок в S10
}
{ const prev = scene.onBeforeRender; scene.onBeforeRender = function (...a) { if (prev) prev.apply(this, a); updWarm(); }; }

function handWorld(side = 'R') { group.updateMatrixWorld(true); const A = arms[side === 'L' ? 1 : 0]; return group.localToWorld(A.palm.clone()); }
function headWorld() { group.updateMatrixWorld(true); return head.localToWorld(V(0, 0, 0)); }

// порядок отрисовки: three сортирует непрозрачное сначала по id материала, и фон (создан раньше) шейдится целиком, а потом
// перекрывается Нейро. Рисуем Нейро раньше (стекло — самым первым), чтобы ранний z-тест отсекал скрытые пиксели фона.
group.traverse(o => { if (o.isMesh && !o.material.transparent) o.renderOrder = o === visor ? -3 : -2; });

pose(0, {});
export const neuro = { group, pose, handWorld, headWorld, lapLocal };
