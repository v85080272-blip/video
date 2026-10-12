// ПЛЮШ — маленький рыжий котёнок с пушистой shell-шерстью.
// export const plush = { group, pose(t, k), headWorld(), pawWorld(side) }
// Локальные координаты: начало — точка на сиденье под тазом, лицом к +Z, +X — левый бок котёнка (к Нейро).
// Дополнительно (вне контракта, необязательно): reach.side 'L'|'R' (по умолчанию 'R', как в контракте),
// pawWorld('reach') — лапа, которая сейчас тянется; k.smirk (−1..1) — кривая ухмылка; rig.setShells(n | 'auto').
import { THREE, scene, V, clamp, lerp, ss, rng } from './core.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// ———————————————————————— шерсть: общие параметры и материалы ————————————————————————
const SHELLS = 16;
const FU = {
  uShells: { value: SHELLS }, uDensity: { value: 680 }, uFurScale: { value: 1 }, uR0: { value: .68 },
  uGrav: { value: .45 }, uComb: { value: 1.4 }, uWrap: { value: .5 }, uBlush: { value: 0 },
  uAmb: { value: new THREE.Color(.5, .4, .34) }, uSheen: { value: .5 }, uBaseDark: { value: .6 },
  uBlushCol: { value: new THREE.Color(0xff6f86) }, uFurTex: { value: null },
  uBald: { value: new THREE.Vector2(1, 1) },   // «лысина» вокруг глаза снизу/сверху: 1 — открыт (кожа голая), .62 — закрыт, меньше — бровь над опущенным веком
  uLidFur: { value: 1 },       // шерсть на веках (гаснет, когда глаз ушёл под кожу)
  uHole: { value: new THREE.Vector4(0, 0, 0, 0) },   // отверстие рта: полуширина, полувысота, верх, сдвиг центра вниз
  uMouthInv: { value: new THREE.Matrix4() },         // голова → координаты рта
};
// 3D-текстура прядей: 16³ ячеек (одна прядь в ячейке, случайная точка), в каждом текселе — расстояние до
// ближайшей оси пряди (поиск по 27 соседям, бесшовно по кругу) и случайное число этой пряди. Одна трилинейная
// выборка в шейдере заменяет поиск соседних ячеек: пряди круглые, случайные, без «сетки».
FU.uFurTex.value = (() => {
  const N = 80, Cn = 16, per = N / Cn, r = rng(20261011), P = new Float32Array(Cn ** 3 * 4);
  for (let i = 0; i < P.length; i++) P[i] = r();
  const data = new Uint8Array(N ** 3 * 2), w = c => ((c % Cn) + Cn) % Cn;
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const px = (x + .5) / per, py = (y + .5) / per, pz = (z + .5) / per, cx = Math.floor(px), cy = Math.floor(py), cz = Math.floor(pz);
    let best = 9, id = 0;
    for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const X = cx + dx, Y = cy + dy, Z = cz + dz, k = (w(X) + w(Y) * Cn + w(Z) * Cn * Cn) * 4;
      const ex = X + P[k] - px, ey = Y + P[k + 1] - py, ez = Z + P[k + 2] - pz, d = ex * ex + ey * ey + ez * ez;
      if (d < best) { best = d; id = P[k + 3]; }
    }
    const i = (x + y * N + z * N * N) * 2; data[i] = Math.min(Math.sqrt(best), 1) * 255; data[i + 1] = id * 255;
  }
  const t = new THREE.Data3DTexture(data, N, N, N);
  t.format = THREE.RGFormat; t.type = THREE.UnsignedByteType; t.minFilter = t.magFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = t.wrapR = THREE.RepeatWrapping; t.unpackAlignment = 1; t.needsUpdate = true;
  return t;
})();

// Шерсть: основа («кожа» и нижние слои; отбрасывает тень) + оболочки InstancedMesh, номер оболочки = gl_InstanceID
// (0 — самая внешняя). Пряди считаются по исходным (до сдвига) координатам furPos (их масштаб = густота меша).
// Освещение шерсти считается в вершинах (диффуз с «wrap», тень ключевого света по 4 выборкам, мягкий ободок) —
// во фрагменте остаётся только проверка пряди и цвет: так шерсть укладывается в бюджет на SwiftShader.
// furAux: x — румянец, y — «лысина» вокруг глаза (0..1), z — полоска (не осветлять кончики), w — зона рта (дырка).
function furCompile(s) {
  Object.assign(s.uniforms, FU);
  s.vertexShader = s.vertexShader.replace('#include <common>', `#include <common>
#include <packing>
#include <lights_pars_begin>
#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
#endif
attribute vec3 furPos; attribute float furLen; attribute vec3 furComb; attribute vec4 furAux;
uniform float uShells, uFurScale, uGrav, uComb, uWrap, uDensity, uBlush, uSheen, uBaseDark, uLidFur; uniform vec3 uAmb, uBlushCol; uniform vec2 uBald;
uniform mat4 uMouthInv;
varying vec3 vFurUV; varying vec4 vFurHLD; varying vec3 vFurA; varying vec3 vFurB; varying vec2 vMouthQ;
#ifdef FUR_BASE
varying vec3 vFurShift;
#endif
float furWrapL(float x) { return max((x + uWrap) / (1. + uWrap), 0.); }`)
    .replace('#include <project_vertex>', `#include <project_vertex>
  #ifdef FUR_BASE
  float furH = 0.;
  #else
  float furH = (uShells - float(gl_InstanceID)) / uShells;
  #endif
  // вокруг открытого глаза кожа голая; у закрытого шерсть отрастает (короче), поверхность без шва
  float fL = furLen * uFurScale * (1. - furAux.y * mix(uBald.x, uBald.y, smoothstep(-.004, .009, position.y)));
  #ifdef FUR_LID
  fL *= uLidFur;
  #endif
  vFurUV = furPos * (uDensity / 16.);
  vMouthQ = furAux.w > .5 ? (uMouthInv * vec4(position, 1.)).xy : vec2(9.);
  vec3 fN = normalize(transformedNormal);
  float facing = dot(fN, normalize(-mvPosition.xyz));
  #ifdef FUR_BASE
  // сдвиг прядей вдоль поверхности (причёсанность + сила тяжести) в координатах объекта, в долях плитки текстуры
  vec3 gO = (vec4(0., -1., 0., 0.) * modelMatrix).xyz; gO -= objectNormal * dot(gO, objectNormal);
  vFurShift = (furComb * uComb + gO * uGrav) * (fL * uDensity / 16.);
  #else
  vec3 fC = (modelViewMatrix * vec4(furComb, 0.)).xyz;
  vec3 fG = (viewMatrix * vec4(0., -1., 0., 0.)).xyz;
  mvPosition.xyz += fN * (fL * furH) + (fC * uComb + fG * uGrav) * (fL * furH * furH);
  gl_Position = projectionMatrix * mvPosition;
  #endif`)
    .replace('#include <shadowmap_vertex>', `#include <shadowmap_vertex>
  {
    vec3 gp = mvPosition.xyz;
    vec3 irr = uAmb + ambientLightColor;
    #if NUM_DIR_LIGHTS > 0
    for (int i = 0; i < NUM_DIR_LIGHTS; i++) irr += directionalLights[i].color * furWrapL(dot(fN, directionalLights[i].direction));
    #endif
    #if NUM_POINT_LIGHTS > 0
    for (int i = 0; i < NUM_POINT_LIGHTS; i++) { vec3 lv = pointLights[i].position - gp; float dl = length(lv);
      irr += pointLights[i].color * getDistanceAttenuation(dl, pointLights[i].distance, pointLights[i].decay) * furWrapL(dot(fN, lv / dl)); }
    #endif
    #if NUM_SPOT_LIGHTS > 0
    for (int i = 0; i < NUM_SPOT_LIGHTS; i++) { vec3 lv = spotLights[i].position - gp; float dl = length(lv); vec3 L = lv / dl;
      float sh = 1.;
      #if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
      if (i == 0 && receiveShadow) {
        vec3 c = vSpotLightCoord[0].xyz / vSpotLightCoord[0].w; c.z += spotLightShadows[0].shadowBias;
        if (c.x > 0. && c.x < 1. && c.y > 0. && c.y < 1. && c.z < 1.) {
          vec2 ts = 1.8 / spotLightShadows[0].shadowMapSize;
          sh = .25 * (step(c.z, unpackRGBAToDepth(texture(spotShadowMap[0], c.xy + vec2(-ts.x, -ts.y * .4))))
            + step(c.z, unpackRGBAToDepth(texture(spotShadowMap[0], c.xy + vec2(ts.x, ts.y * .4))))
            + step(c.z, unpackRGBAToDepth(texture(spotShadowMap[0], c.xy + vec2(-ts.x * .4, ts.y))))
            + step(c.z, unpackRGBAToDepth(texture(spotShadowMap[0], c.xy + vec2(ts.x * .4, -ts.y)))));
        }
      }
      #endif
      irr += spotLights[i].color * sh * getSpotAttenuation(spotLights[i].coneCos, spotLights[i].penumbraCos, dot(L, spotLights[i].direction))
        * getDistanceAttenuation(dl, spotLights[i].distance, spotLights[i].decay) * furWrapL(dot(fN, L)); }
    #endif
    #if NUM_HEMI_LIGHTS > 0
    for (int i = 0; i < NUM_HEMI_LIGHTS; i++) irr += getHemisphereLightIrradiance(hemisphereLights[i], fN);
    #endif
    vec3 alb = color.rgb;
    alb = mix(alb, alb * uBlushCol * 1.12, uBlush * furAux.x * .62);
    vFurA = alb * irr * RECIPROCAL_PI;
    float lum = dot(alb, vec3(.3, .55, .15));
    vFurB = alb * (pow(1. - saturate(facing), 2.5) * uSheen * (1. - .6 * smoothstep(.55, .85, lum)));   // белая шерсть — без «свечения»
    float dark = mix(uBaseDark, .8, smoothstep(.35, .85, lum));   // светлая шерсть — мягче
    vFurHLD = vec4(furH, fL, dark, .28 * (1. - furAux.z));
  }`);
  const fs = s.fragmentShader, mi = fs.indexOf('void main() {');
  s.fragmentShader = fs.slice(0, mi) + `
uniform float uR0; uniform highp sampler3D uFurTex; uniform vec4 uHole;
varying vec3 vFurUV; varying vec4 vFurHLD; varying vec3 vFurA; varying vec3 vFurB; varying vec2 vMouthQ;
#ifdef FUR_BASE
varying vec3 vFurShift;
#endif
void main() {
  // открытый рот — настоящая дырка в коже головы (полость за ней видна только через неё)
  float lip = 0.;
  if (uHole.x > 0. && vMouthQ.x < 8.) {
    vec2 q = vMouthQ; float dy = q.y - (uHole.z - uHole.w);
    float e = q.x * q.x / (uHole.x * uHole.x) + dy * dy / (uHole.y * uHole.y);
    if (e < 1. && q.y < uHole.z) discard;
    lip = (1. - smoothstep(1., 1.6, e)) * step(q.y, uHole.z + .0003);
  }
  #ifdef FUR_BASE
  // основа: вид нижних слоёв сверху — самая высокая из прядей, проходящих над точкой (с учётом их наклона)
  float fh = 0., fid = .5;
  for (int i = 0; i < 3; i++) {
    float h = .62 - .22 * float(i);
    vec2 tx = texture(uFurTex, vFurUV - vFurShift * (h * h)).rg;
    float rr = tx.x / uR0;
    float hx = h / (.5 + .5 * tx.y);
    if (fh == 0. && rr * rr < 1. - hx * hx) { fh = h; fid = tx.y; }
  }
  float furry = smoothstep(.0004, .002, vFurHLD.y);
  fh *= furry;
  float k = mix(1., mix(vFurHLD.z, 1., smoothstep(0., .7, fh)) * (.92 + .16 * fid), furry);
  #else
  if (vFurHLD.y < .0006) discard;
  vec2 tx = texture(uFurTex, vFurUV).rg;
  float fh = vFurHLD.x, fid = tx.y, rr = tx.x / uR0;
  float fx = fh / (.5 + .5 * fid);
  if (rr * rr > 1. - fx * fx) discard;   // радиус пряди сужается к кончику: r = r0 * sqrt(1 - (h / len)²) — кончики не рассыпаются в точки
  float k = mix(vFurHLD.z, 1., smoothstep(0., .7, fh)) * (.92 + .16 * fid);
  #endif
  k *= 1. + vFurHLD.w * smoothstep(.5, 1., fh);       // кончики светлее (кроме полосок)
  vec3 col = vFurA * k + vFurB * fh;
  col = mix(col, vec3(.07, .025, .03), lip * .8);    // край губы
  // мягкий потолок яркости ниже порога bloom (0.9): шерсть не светится ореолом
  float L = dot(col, vec3(.2126, .7152, .0722));
  if (L > .66) col *= (.66 + .2 * (1. - exp((.66 - L) / .2))) / L;
  gl_FragColor = vec4(col, 1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
}
const furMat = (base, lid) => {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9 });
  m.defines = {}; if (base) m.defines.FUR_BASE = ''; if (lid) m.defines.FUR_LID = '';
  m.onBeforeCompile = furCompile; m.customProgramCacheKey = () => 'plushFur' + (base ? 'B' : 'S') + (lid ? 'L' : '');
  return m;
};
const furBaseMat = furMat(true, false), furShellMat = furMat(false, false), lidBaseMat = furMat(true, true), lidShellMat = furMat(false, true);

// меш с шерстью: основа (тень, «кожа») + оболочки
const allShells = [], lidShells = [];
let shellLimit = SHELLS, shellAuto = true, lidShellsOn = true;
function applyShells(n) { shellLimit = n; FU.uShells.value = Math.max(n, 1); allShells.forEach(m => { m.count = n; m.visible = n > 0 && (lidShellsOn || !m.userData.lid); }); }
// число оболочек вручную (n) или по размеру головы в кадре ('auto' / null — по умолчанию)
function setShells(n) { if (n == null || n === 'auto') shellAuto = true; else { shellAuto = false; lidShellsOn = true; applyShells(n); } }
// Оболочки разбиты на участки: перед кадром (onBeforeRender) участок, целиком отвёрнутый от камеры, не рисуется
// (count = 0). Отброшенный во фрагменте пиксель в SwiftShader стоит столько же, сколько нарисованный, поэтому
// экономить можно только не растеризуя ненужное.
const _cw = new THREE.Vector3(), _nw = new THREE.Vector3(), _nm = new THREE.Matrix3(), _cd = new THREE.Vector3();
function patchBeforeRender(renderer, scene, camera) {
  const u = this.userData;
  _cw.copy(u.c).applyMatrix4(this.matrixWorld);
  _nw.copy(u.n).applyMatrix3(_nm.getNormalMatrix(this.matrixWorld)).normalize();
  const f = _nw.dot(_cd.copy(camera.position).sub(_cw).normalize());
  const ang = Math.acos(clamp(f, -1, 1));
  this.count = Math.cos(Math.max(ang - u.spread, 0)) < -.2 ? 0 : shellLimit;   // с запасом на разброс нормалей участка
}
function splitPatches(geo, K) {
  const idx = geo.index.array, P = geo.attributes.position, Nn = geo.attributes.normal;
  geo.computeBoundingBox(); const ctr = geo.boundingBox.getCenter(new THREE.Vector3());
  const dirs = []; for (let i = 0; i < K; i++) { const y = 1 - 2 * (i + .5) / K, r = Math.sqrt(1 - y * y), a = i * 2.39996; dirs.push(V(Math.cos(a) * r, y, Math.sin(a) * r)); }
  const tris = dirs.map(() => []), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let t = 0; t < idx.length; t += 3) {
    a.fromBufferAttribute(P, idx[t]); b.fromBufferAttribute(P, idx[t + 1]); c.fromBufferAttribute(P, idx[t + 2]);
    const d = a.add(b).add(c).multiplyScalar(1 / 3).sub(ctr).normalize();
    let bi = 0, bd = -2; dirs.forEach((q, i) => { const x = q.dot(d); if (x > bd) { bd = x; bi = i; } });
    tris[bi].push(idx[t], idx[t + 1], idx[t + 2]);
  }
  const names = Object.keys(geo.attributes), mnames = Object.keys(geo.morphAttributes);
  return tris.filter(tl => tl.length).map(tl => {
    const map = new Map(), order = [];
    const ni = tl.map(v => { if (!map.has(v)) { map.set(v, order.length); order.push(v); } return map.get(v); });
    const g = new THREE.BufferGeometry(); g.setIndex(ni);
    const copy = src => { const it = src.itemSize, arr = new Float32Array(order.length * it); order.forEach((v, i) => { for (let k = 0; k < it; k++) arr[i * it + k] = src.array[v * it + k]; }); return new THREE.BufferAttribute(arr, it); };
    names.forEach(n => g.setAttribute(n, copy(geo.attributes[n])));
    mnames.forEach(n => { g.morphAttributes[n] = geo.morphAttributes[n].map(copy); }); g.morphTargetsRelative = geo.morphTargetsRelative;
    const cc = new THREE.Vector3(), nn = new THREE.Vector3(), t = new THREE.Vector3();
    order.forEach(v => { cc.add(t.fromBufferAttribute(P, v)); nn.add(t.fromBufferAttribute(Nn, v)); });
    cc.multiplyScalar(1 / order.length); nn.normalize();
    let spread = 0; order.forEach(v => { spread = Math.max(spread, Math.acos(clamp(nn.dot(t.fromBufferAttribute(Nn, v)), -1, 1))); });
    g.computeBoundingSphere(); g.boundingSphere.radius += .035;
    return { g, c: cc, n: nn, spread };
  });
}
function furry(geo, parent, patches = 0, lid = false) {
  const base = new THREE.Mesh(geo, lid ? lidBaseMat : furBaseMat); base.castShadow = base.receiveShadow = true;
  const parts = patches ? splitPatches(geo, patches) : [{ g: geo }];
  base.userData.shells = parts.map(pp => {
    const shells = new THREE.InstancedMesh(pp.g, lid ? lidShellMat : furShellMat, SHELLS); shells.castShadow = false; shells.receiveShadow = true;
    if (base.morphTargetInfluences) shells.morphTargetInfluences = base.morphTargetInfluences;   // общий массив весов морфов
    if (patches) { shells.userData = { c: pp.c, n: pp.n, spread: pp.spread }; shells.onBeforeRender = patchBeforeRender; }
    shells.userData.lid = lid;
    base.add(shells); allShells.push(shells); if (lid) lidShells.push(shells);
    return shells;
  });
  parent.add(base);
  return base;
}

// ———————————————————————— помощники ————————————————————————
const nrm = (x, y, z) => new THREE.Vector3(x, y, z).normalize();
const C = h => new THREE.Color(h);
const sm = (a, b, x) => ss(clamp((x - a) / (b - a)));
const gauss = (x, w) => Math.exp(-(x * x) / (w * w));
const PAL = {
  ginger: C(0xe8893a), gingerL: C(0xf3a95f), stripe: C(0x93401a), stripeL: C(0xb5551c),
  cream: C(0xf6e2c6), white: C(0xf6ebde), pink: C(0xf2a0aa),
};
const AUX0 = [0, 0, 0, 0];
// вершинные атрибуты шерсти из функции fn(p, n, i) → { c: Color, len, comb: Vector3, combW, aux: [4] }
// dens — густота прядей этого меша (масштаб координат узора)
function setFurAttrs(geo, fn, dens = 1) {
  const P = geo.attributes.position, Nn = geo.attributes.normal, n = P.count;
  const col = new Float32Array(n * 3), len = new Float32Array(n), comb = new Float32Array(n * 3), aux = new Float32Array(n * 4);
  const p = new THREE.Vector3(), q = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    p.fromBufferAttribute(P, i); q.fromBufferAttribute(Nn, i);
    const r = fn(p, q, i);
    col[i * 3] = r.c.r; col[i * 3 + 1] = r.c.g; col[i * 3 + 2] = r.c.b; len[i] = r.len; aux.set(r.aux || AUX0, i * 4);
    const cb = r.comb || V(0, -1, 0); const t = cb.clone().addScaledVector(q, -cb.dot(q)); if (t.lengthSq() > 1e-8) t.normalize();
    t.multiplyScalar(r.combW ?? 1);
    comb[i * 3] = t.x; comb[i * 3 + 1] = t.y; comb[i * 3 + 2] = t.z;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('furLen', new THREE.BufferAttribute(len, 1));
  geo.setAttribute('furComb', new THREE.BufferAttribute(comb, 3));
  geo.setAttribute('furAux', new THREE.BufferAttribute(aux, 4));
  const fp = P.clone(); for (let i = 0; i < fp.array.length; i++) fp.array[i] *= dens;
  geo.setAttribute('furPos', fp);
  return geo;
}
// деформированная икосфера: shape(dir) → точка
function blob(detail, shape) {
  let g = new THREE.IcosahedronGeometry(1, detail); g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = mergeVertices(g);
  const P = g.attributes.position, d = new THREE.Vector3(), dirs = new Float32Array(P.count * 3);
  for (let i = 0; i < P.count; i++) { d.fromBufferAttribute(P, i).normalize(); dirs.set([d.x, d.y, d.z], i * 3); const q = shape(d); P.setXYZ(i, q.x, q.y, q.z); }
  g.computeVertexNormals(); g.userData.dirs = dirs;
  return g;
}
const bumpTo = (p, d, c, sig, amp) => p.addScaledVector(d, amp * Math.exp((d.dot(c) - 1) / sig));
const bumpW = (d, c, sig) => Math.exp((d.dot(c) - 1) / sig);

// ———————————————————————— трубка с шерстью (лапы, хвост): геометрия по кривой каждый кадр ————————————————————————
class FurTube {
  constructor({ nB = 22, nC = 4, nR = 14, radius, restLen, attr, combW = 1, dens = 1 }) {
    Object.assign(this, { nB, nC, nR, radius, restLen, combW });
    const rings = []; // { kind: 0 cap-start / 1 body / 2 cap-end, a | u }
    for (let k = 0; k < nC; k++) rings.push({ kind: 0, a: Math.PI / 2 * k / nC });
    for (let j = 0; j <= nB; j++) rings.push({ kind: 1, u: j / nB });
    for (let k = nC - 1; k >= 0; k--) rings.push({ kind: 2, a: Math.PI / 2 * k / nC });
    this.rings = rings;
    const nV = rings.length * nR, pos = new Float32Array(nV * 3), nor = new Float32Array(nV * 3), rest = new Float32Array(nV * 3);
    const idx = [];
    for (let r = 0; r < rings.length - 1; r++) for (let i = 0; i < nR; i++) {
      const a = r * nR + i, b = r * nR + (i + 1) % nR, c = (r + 1) * nR + i, d = (r + 1) * nR + (i + 1) % nR;
      idx.push(a, b, c, b, d, c);
    }
    const g = new THREE.BufferGeometry(); g.setIndex(idx);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    // исходная (прямая) трубка вдоль +Y: координаты для узора прядей и для цветов
    const r0 = radius(0), r1 = radius(1);
    const col = new Float32Array(nV * 3), len = new Float32Array(nV), aux = new Float32Array(nV * 4);
    rings.forEach((rg, ri) => {
      for (let i = 0; i < nR; i++) {
        const th = i / nR * Math.PI * 2, cx = Math.cos(th), sz = Math.sin(th);
        let y, rr, u;
        if (rg.kind === 0) { y = -r0 * Math.cos(rg.a); rr = r0 * Math.sin(rg.a); u = 0; }
        else if (rg.kind === 2) { y = restLen + r1 * Math.cos(rg.a); rr = r1 * Math.sin(rg.a); u = 1; }
        else { u = rg.u; y = u * restLen; rr = radius(u); }
        const vi = ri * nR + i;
        rest.set([cx * rr * dens, y * dens, sz * rr * dens], vi * 3);
        const a = attr(u, th, rg.kind !== 1 ? (rg.kind === 0 ? -1 : 1) * Math.cos(rg.a) : 0);
        col.set([a.c.r, a.c.g, a.c.b], vi * 3); len[vi] = a.len; aux.set(a.aux || AUX0, vi * 4);
      }
    });
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('furLen', new THREE.BufferAttribute(len, 1));
    g.setAttribute('furComb', new THREE.BufferAttribute(new Float32Array(nV * 3), 3));
    g.setAttribute('furAux', new THREE.BufferAttribute(aux, 4));
    g.setAttribute('furPos', new THREE.BufferAttribute(rest, 3));
    g.boundingSphere = new THREE.Sphere(V(0, 0, 0), 10);
    this.geo = g;
    this.curve = new THREE.CatmullRomCurve3([V(0, 0, 0), V(0, 1, 0)], false, 'centripetal');
    this.P = []; this.T = []; this.N = [];
    for (let j = 0; j <= nB; j++) { this.P.push(V(0, 0, 0)); this.T.push(V(0, 1, 0)); this.N.push(V(1, 0, 0)); }
  }
  // pts — точки кривой в координатах родителя, ref — желаемое направление θ=0 (перпендикуляр к началу)
  update(pts, ref) {
    const { nB, nR, rings, radius, curve, P, T, N, combW } = this;
    curve.points = pts; curve.updateArcLengths();
    for (let j = 0; j <= nB; j++) { curve.getPointAt(j / nB, P[j]); curve.getTangentAt(j / nB, T[j]); }
    N[0].copy(ref).addScaledVector(T[0], -ref.dot(T[0])).normalize();
    const q = new THREE.Quaternion();
    for (let j = 1; j <= nB; j++) { q.setFromUnitVectors(T[j - 1], T[j]); N[j].copy(N[j - 1]).applyQuaternion(q); N[j].addScaledVector(T[j], -N[j].dot(T[j])).normalize(); }
    const pos = this.geo.attributes.position.array, nor = this.geo.attributes.normal.array, cmb = this.geo.attributes.furComb.array;
    const B = new THREE.Vector3(), rad = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
    const r0 = radius(0), r1 = radius(1);
    rings.forEach((rg, ri) => {
      let j, rr, tilt = 0, ctr;
      if (rg.kind === 0) { j = 0; rr = r0 * Math.sin(rg.a); ctr = c.copy(P[0]).addScaledVector(T[0], -r0 * Math.cos(rg.a)); tilt = -1; }
      else if (rg.kind === 2) { j = nB; rr = r1 * Math.sin(rg.a); ctr = c.copy(P[nB]).addScaledVector(T[nB], r1 * Math.cos(rg.a)); tilt = 1; }
      else { j = Math.round(rg.u * nB); rr = radius(rg.u); ctr = c.copy(P[j]); }
      B.crossVectors(T[j], N[j]);
      for (let i = 0; i < nR; i++) {
        const th = i / nR * Math.PI * 2;
        rad.copy(N[j]).multiplyScalar(Math.cos(th)).addScaledVector(B, Math.sin(th));
        const vi = (ri * nR + i) * 3;
        pos[vi] = ctr.x + rad.x * rr; pos[vi + 1] = ctr.y + rad.y * rr; pos[vi + 2] = ctr.z + rad.z * rr;
        if (tilt) { const sa = Math.sin(rg.a), ca = Math.cos(rg.a); n.copy(rad).multiplyScalar(sa).addScaledVector(T[j], tilt * ca); }
        else n.copy(rad);
        nor[vi] = n.x; nor[vi + 1] = n.y; nor[vi + 2] = n.z;
        cmb[vi] = T[j].x * combW; cmb[vi + 1] = T[j].y * combW; cmb[vi + 2] = T[j].z * combW;
      }
    });
    this.geo.attributes.position.needsUpdate = this.geo.attributes.normal.needsUpdate = this.geo.attributes.furComb.needsUpdate = true;
  }
  end() { return this.P[this.nB]; }
}

// ———————————————————————— сборка ————————————————————————
const group = new THREE.Group(); group.name = 'plush'; scene.add(group);
const body = new THREE.Group(); body.rotation.order = 'YXZ'; group.add(body);   // рысканье тела снаружи: наклон — вдоль своего «вперёд»
const neck = new THREE.Group(); neck.position.set(0, .146, .006); body.add(neck);
const head = new THREE.Group(); head.position.set(0, .063, .012); neck.add(head);

// ——— тело ———
const bodyGeo = blob(16, d => {
  const wb = 1 + .2 * Math.max(0, -d.y) - .1 * Math.max(0, d.y);
  const p = V(d.x * .069 * wb, d.y * .077, d.z * .063 * wb);
  bumpTo(p, d, nrm(0, .25, 1), .06, .009);              // грудка
  bumpTo(p, d, nrm(.78, -.5, -.18), .07, .014);         // «бёдра»
  bumpTo(p, d, nrm(-.78, -.5, -.18), .07, .014);
  bumpTo(p, d, nrm(0, -.45, 1), .07, .005);             // животик
  p.y += .074; p.z -= .008;
  if (p.y < .012) p.y = .012 - (.012 - p.y) * .3;     // сидит на подушке — низ приплюснут
  return p;
});
// морф «грудь колесом» (proud)
{
  const P = bodyGeo.attributes.position, dirs = bodyGeo.userData.dirs, mp = new Float32Array(P.count * 3), d = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) {
    d.fromArray(dirs, i * 3);
    const w = bumpW(d, nrm(0, .3, 1), .12), wt = bumpW(d, nrm(0, .75, .65), .08);
    mp.set([d.x * .006 * w, .004 * w + .003 * wt, .009 * w + .002 * wt], i * 3);
  }
  bodyGeo.morphAttributes.position = [new THREE.BufferAttribute(mp, 3)]; bodyGeo.morphTargetsRelative = true;
}
setFurAttrs(bodyGeo, (p, n) => {
  const phi = Math.atan2(p.x, p.z), ap = Math.abs(phi);   // 0 — спереди, ±π — спина
  const front = sm(.8, .4, ap) * sm(-.2, .3, n.z + .2);
  const bib = clamp(front + sm(.11, .15, p.y) * sm(1.1, .6, ap));   // белая грудка сливается с горлом
  // табби: широкие полосы поперёк спины (по высоте вдоль позвоночника), сходят по бокам вниз-вперёд
  const sp = (p.y + .012 * (Math.PI - ap) ** 2 + .005 * Math.sin(phi * 5 + p.y * 40)) * 150 + .5 * Math.sin(phi * 3);
  const thr = .02 + .3 * (.5 + .5 * Math.sin(p.y * 37 + phi * 2.3)) * sm(2.6, 1.6, ap);   // ширина полос гуляет, к бокам тоньше
  const stripe = sm(thr, thr + .35, Math.sin(sp)) * sm(.7, 1.3, ap) * sm(.018, .045, p.y) * (1 - bib);
  const spine = gauss(p.x, .014) * sm(-.02, -.05, p.z) * sm(.03, .07, p.y);
  let c = PAL.ginger.clone().lerp(PAL.gingerL, sm(.1, -.1, p.y - .08) * .3);
  const stM = clamp(stripe + spine * .9);
  c.lerp(PAL.stripe, stM);
  c.lerp(PAL.white, bib);
  const len = (.015 + .006 * front * sm(.07, .13, p.y)) * sm(.0, .03, p.y) + .002;
  // грудка причёсана вниз сильнее: пряди лежат, а не смотрят в камеру точками
  return { c, len, comb: V(0, -1, -.35).add(V(p.x, 0, p.z).multiplyScalar(2)), combW: 1 + .35 * bib, aux: [0, 0, stM, 0] };
}, 1.2);
const bodyMesh = furry(bodyGeo, body, 72);

// ——— голова ———
const HR = { x: .088, y: .075, z: .079 };
const EYE_DIR = s => nrm(s * .42, .02, .9);
const CHEEK = s => nrm(s * .8, -.38, .45);
function headShape(d) {
  const p = V(d.x * HR.x, d.y * HR.y, d.z * HR.z);
  if (d.z < 0) p.multiplyScalar(1 + .05 * d.z);
  bumpTo(p, d, CHEEK(1), .14, .011); bumpTo(p, d, CHEEK(-1), .14, .011);
  bumpTo(p, d, nrm(0, -.36, 1), .045, .008);           // мордочка
  bumpTo(p, d, nrm(.2, -.36, 1), .02, .0045);          // подушечки усов
  bumpTo(p, d, nrm(-.2, -.36, 1), .02, .0045);
  bumpTo(p, d, nrm(0, -.72, .7), .03, .002);           // подбородок
  bumpTo(p, d, EYE_DIR(1), .03, -.005); bumpTo(p, d, EYE_DIR(-1), .03, -.005);
  bumpTo(p, d, nrm(0, .55, .85), .12, .003);           // лобик
  return p;
}
const headSurf = d => headShape(d.clone().normalize());
// закрытый глаз: впадина глазницы заполняется (морф), глаз уходит под кожу
const fillAmt = d => .0082 * (bumpW(d, EYE_DIR(1), .028) + bumpW(d, EYE_DIR(-1), .028));
const headClosed = d => { const q = d.clone().normalize(); return headShape(q).addScaledVector(q, fillAmt(q)); };

// глаза: сплюснутые вдоль взгляда (не торчат шариками), утоплены в глазницу
const RE = .028, EZ = .62, EDEPTH = .41, ESC = 1.05, ESINK = .36;
const EF = [1, -1].map(s => {
  const dir = EYE_DIR(s), surf = headSurf(dir), fwd = nrm(dir.x * .55, dir.y, dir.z);
  const o = new THREE.Object3D(); o.position.copy(surf).addScaledVector(fwd, -RE * EDEPTH); o.lookAt(o.position.clone().add(fwd));
  o.scale.set(ESC, ESC, ESC * EZ); o.updateMatrix();
  return { s, dir, surf, fwd, pos: o.position.clone(), quat: o.quaternion.clone(), inv: o.matrix.clone().invert() };
});
// примерное расстояние (м) от точки головы до поверхности глазного яблока (снаружи > 0)
const _ep = new THREE.Vector3();
const eyeDist = p => Math.min(...EF.map(f => (_ep.copy(p).applyMatrix4(f.inv).length() / RE - 1) * RE * ESC * .8));

const NOSE_DIR = nrm(0, -.19, 1);
const MOUTH_DIR = nrm(0, -.33, 1);
// шерсть головы: цвет, длина, «лысина» вокруг глаз (отдельно, она гаснет у закрытых глаз), причёсанность
function headFur(d, p = headShape(d)) {
  const a = Math.atan2(d.y, d.z);                       // по сагиттали: 0 — спереди, π/2 — макушка
  const u = Math.atan2(Math.abs(d.x), d.z), v = Math.asin(clamp(d.y, -1, 1));
  let c = PAL.ginger.clone();
  c.lerp(PAL.gingerL, sm(0, -.5, d.y) * .55);
  // «M» и полоски на лбу, уходящие через макушку к затылку (шире и темнее, чем было)
  const band = (x0, w, a0, a1) => gauss(d.x - x0, w) * sm(a0, a0 + .12, a) * (1 - sm(a1 - .2, a1, a));
  const sx = .16 + .1 * sm(.35, 1.1, a);
  let st = band(0, .066, .36, 2.75) + band(sx, .058, .32, 2.5) + band(-sx, .058, .32, 2.5) + band(.085, .036, .48, .85) + band(-.085, .036, .48, .85);
  st += band(.3 + .08 * sm(.4, 1.3, a), .05, .68, 2.3) + band(-.3 - .08 * sm(.4, 1.3, a), .05, .68, 2.3);
  // затылок: поперечные полосы к шее
  st += sm(2.2, 2.5, a) * sm(.4, .5, Math.sin(-d.y * 26 + 1.5)) * sm(-.85, -.4, d.z) * sm(.9, .6, Math.abs(d.x));
  // «тушь»: две полоски от внешнего угла глаза на щёку
  st += gauss(v - (-.02 - .25 * (u - .75)), .045) * sm(.7, .82, u) * (1 - sm(1.25, 1.45, u));
  st += .9 * gauss(v - (-.2 - .2 * (u - .8)), .04) * sm(.85, .95, u) * (1 - sm(1.3, 1.5, u));
  // светлее вокруг глаз
  const eA = Math.max(d.dot(EYE_DIR(1)), d.dot(EYE_DIR(-1)));
  const stM = clamp(st) * (1 - sm(.93, .975, eA));
  c.lerp(PAL.stripe, stM * .92);
  c.lerp(PAL.gingerL, sm(.9, .97, eA) * .7);
  // белая мордочка, подбородок и горлышко
  const muz = sm(.86, .93, d.dot(nrm(0, -.45, .9))) + sm(.88, .94, d.dot(nrm(.17, -.38, .92))) + sm(.88, .94, d.dot(nrm(-.17, -.38, .92)));
  const throat = sm(-.5, -.75, d.y) * sm(-.35, .15, d.z);
  const white = clamp(muz + throat);
  c.lerp(PAL.white, white);
  // длина шерсти
  let len = .011 - .002 * sm(.3, .8, d.y) * sm(0, .5, d.z);
  len += .008 * sm(.82, .97, Math.max(d.dot(CHEEK(1)), d.dot(CHEEK(-1))));        // пушистые щёки
  len = lerp(len, .005, sm(.84, .93, d.dot(nrm(0, -.38, .93))));                   // мордочка — короткая
  len = lerp(len, .0008, sm(.982, .994, d.dot(NOSE_DIR)));                         // нос
  len = lerp(len, .0016, sm(.968, .985, d.dot(nrm(0, -.43, 1))));                  // рот — почти без шерсти
  len = lerp(len, .016, sm(-.5, -.78, d.y) * sm(-.35, .2, d.z));                   // горло и низ щёк — «жабо» поверх груди
  const nape = sm(-.15, -.6, d.y) * sm(.15, -.45, d.z);
  len = lerp(len, .0155, nape);                                                    // загривок — длинный, ложится на спину
  const bald = 1 - sm(.0008, .0042, eyeDist(p));                                   // вокруг открытого глаза — без шерсти
  const blush = sm(.875, .975, Math.max(d.dot(nrm(.58, -.24, .78)), d.dot(nrm(-.58, -.24, .78))));
  let comb = p.clone().sub(V(0, -.016, .095)).normalize().add(V(0, -.2, -.6)).normalize();
  const down = sm(-.35, -.7, d.y);
  comb.lerp(V(0, -1, .5).normalize(), down);                                     // горло и низ щёк — вниз и вперёд
  comb.lerp(V(0, -1, -.6).normalize(), nape * (1 - down) * .8);                   // загривок — вниз и назад
  const mouthZone = d.dot(MOUTH_DIR) > .93 ? 1 : 0;
  return { c, len, comb, combW: 1 + .3 * down, aux: [blush, bald, stM, mouthZone], bald };
}
const headGeo = blob(21, d => headShape(d));
// морфы головы: 0 — челюсть, 1 — заполнение глазниц (закрытые глаза), 2/3 — улыбка левой/правой стороной, 4 — надутые губы
const MORPH = { jaw: 0, fill: 1, smileL: 2, smileR: 3, pout: 4 };
{
  const P = headGeo.attributes.position, dirs = headGeo.userData.dirs, n = P.count, d = new THREE.Vector3();
  const A = [0, 1, 2, 3, 4].map(() => new Float32Array(n * 3));
  for (let i = 0; i < n; i++) {
    d.fromArray(dirs, i * 3);
    // челюсть: подбородок и нижняя часть мордочки опускаются (и чуть назад)
    const w = sm(-.3, -.48, d.y) * sm(.3, .75, d.z) * sm(.55, .2, Math.abs(d.x)) * (1 - sm(-.8, -.95, d.y));
    A[0].set([0, -.016 * w, -.0035 * w], i * 3);
    const f = fillAmt(d); A[1].set([d.x * f, d.y * f, d.z * f], i * 3);
    [1, -1].forEach((s, si) => {
      const corner = bumpW(d, nrm(s * .2, -.42, .89), .01), cheek = bumpW(d, nrm(s * .52, -.24, .82), .03), low = bumpW(d, nrm(s * .4, -.2, .9), .012);
      A[2 + si].set([s * (.0007 * corner + .0009 * cheek), .0026 * corner + .0017 * cheek + .0017 * low, -.0008 * corner + .0008 * cheek], i * 3);
    });
    const muzz = bumpW(d, nrm(0, -.36, 1), .02), lipL = bumpW(d, nrm(0, -.5, .87), .012);
    const cor = bumpW(d, nrm(.2, -.42, .9), .01) + bumpW(d, nrm(-.2, -.42, .9), .01);
    A[4].set([-d.x * .004 * cor, .0006 * lipL - .0012 * cor, .002 * muzz + .0024 * lipL], i * 3);
  }
  headGeo.morphAttributes.position = A.map(a => new THREE.BufferAttribute(a, 3)); headGeo.morphTargetsRelative = true;
}
setFurAttrs(headGeo, (p, n, i) => headFur(V().fromArray(headGeo.userData.dirs, i * 3), p), 1.35);
const headMesh = furry(headGeo, head, 110);

// ——— глаза ———
const eyeU = { uPupil: { value: .36 }, uIrisIn: { value: C(0xf0a22c) }, uIrisOut: { value: C(0x86b33c) }, uIrisDark: { value: C(0x4a3410) } };
const eyeMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: .3, clearcoat: 1, clearcoatRoughness: .03 });
eyeMat.onBeforeCompile = s => {
  Object.assign(s.uniforms, eyeU);
  s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vEyeP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvEyeP = position;');
  s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vEyeP; uniform float uPupil; uniform vec3 uIrisIn, uIrisOut, uIrisDark;`).replace('#include <color_fragment>', `#include <color_fragment>
  { vec3 e = normalize(vEyeP); float r = e.z > 0. ? length(e.xy) : 2. - length(e.xy);
    float aw = fwidth(r) * 1.2 + .004;
    float IR = .86, PR = uPupil;
    float ang = atan(e.y, e.x);
    float t = clamp((r - PR) / (IR - PR), 0., 1.);
    vec3 iris = mix(uIrisIn, uIrisOut, smoothstep(.15, .85, t));
    float fib = sin(ang * 41. + sin(ang * 7.) * 3.) * .5 + sin(ang * 23. - 1.3) * .5;
    iris *= 1. + .16 * fib * (1. - t * .5);
    iris = mix(iris, uIrisDark, smoothstep(.72, 1., t) * .85);           // тёмный ободок
    iris = mix(iris, uIrisIn * 1.25, (1. - smoothstep(0., .18, t)) * .5); // светлый ободок у зрачка
    iris *= .72 + .28 * smoothstep(.65, -.2, e.y);                       // тень от века сверху
    vec3 sclera = vec3(.9, .84, .76) * (.78 + .22 * smoothstep(.5, -.5, e.y));
    vec3 col = mix(iris, sclera, smoothstep(IR - aw, IR + aw, r));
    col = mix(vec3(.012, .01, .012), col, smoothstep(PR - aw, PR + aw, r));
    diffuseColor.rgb = col; }`);
};
eyeMat.customProgramCacheKey = () => 'plushEye';
const hlMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.15, 2.0) });
// веки — полусферы с короткой (≤2 мм) шерстью в цвет шерсти вокруг глаза; у края шерсть сходит на нет
function lidGeo(r, upper) {
  let g = new THREE.SphereGeometry(r, 26, 6, 0, Math.PI * 2, upper ? 0 : Math.PI / 2, Math.PI / 2);
  g.deleteAttribute('uv'); g.deleteAttribute('normal'); g = mergeVertices(g); g.computeVertexNormals();
  return setFurAttrs(g, p => {
    const k = Math.abs(p.y) / r;
    const c = upper ? PAL.ginger.clone().lerp(PAL.gingerL, .5) : PAL.gingerL.clone().lerp(PAL.cream, .5);
    // короткая (≤2.4 мм): веко — гладкая кожа под «бровью» из шерсти головы, отросшей над опущенным веком
    return { c, len: upper ? lerp(.0012, .0024, sm(.12, .7, k)) * sm(.0, .12, k) : lerp(.001, .002, sm(.15, .7, k)) * sm(0, .12, k), comb: V(0, upper ? 1 : -1, -.6), combW: .8 };
  }, 1.35);
}
const lashMat = new THREE.MeshStandardMaterial({ color: 0x3a1c10, roughness: .6 });
// линия сомкнутых век на коже головы: «‿» (спит) и «∩» (счастлив) — одна трубка с морфом между формами
function closedLashGeo(f) {
  const s = f.s, dir = f.dir, R0 = f.surf.length();
  const tx = V(1, 0, 0).addScaledVector(dir, -dir.x).normalize(), ty = V().crossVectors(dir, tx).normalize();
  const N = 22, TS = 36, RS = 6;
  const make = kind => {
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const uu = i / N * 2 - 1, x = uu * .0205 + s * .0012;
      const y = kind ? .0032 - .0092 * uu * uu : -.0036 + .0046 * uu * uu - .0014 * uu * s;
      const dd = dir.clone().multiplyScalar(R0).addScaledVector(tx, x).addScaledVector(ty, y).normalize();
      const p = headClosed(dd);
      const e = .002, px = headClosed(dd.clone().addScaledVector(tx, e)), py = headClosed(dd.clone().addScaledVector(ty, e));
      const nn = px.sub(p).cross(py.sub(p)).normalize(); if (nn.dot(dd) < 0) nn.negate();
      const hf = headFur(dd), lenC = hf.len * (1 - hf.bald * .62);
      pts.push(p.addScaledVector(nn, lenC * .62 + .0005));
    }
    const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), TS, .00115, RS, false), P = g.attributes.position;
    // сужение к уголкам
    const crv = new THREE.CatmullRomCurve3(pts), c = new THREE.Vector3(), q = new THREE.Vector3();
    for (let k = 0; k < P.count; k++) { const j = Math.floor(k / (RS + 1)) / TS; crv.getPointAt(j, c); q.fromBufferAttribute(P, k).sub(c).multiplyScalar(.3 + .7 * Math.pow(Math.sin(Math.PI * j), .6)).add(c); P.setXYZ(k, q.x, q.y, q.z); }
    return g;
  };
  const g0 = make(0), g1 = make(1), d = g1.attributes.position.clone();
  for (let i = 0; i < d.array.length; i++) d.array[i] -= g0.attributes.position.array[i];
  g0.morphAttributes.position = [d]; g0.morphTargetsRelative = true;
  return g0;
}
const eyes = EF.map(f => {   // s=+1 левый глаз котёнка (+X), s=−1 правый
  const s = f.s;
  const g = new THREE.Group(); g.position.copy(f.pos); g.quaternion.copy(f.quat); head.add(g);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(RE, 40, 28), eyeMat); g.add(ball);
  const hl1 = new THREE.Mesh(new THREE.SphereGeometry(RE * .2, 16, 10), hlMat), hl2 = new THREE.Mesh(new THREE.SphereGeometry(RE * .09, 12, 8), hlMat);
  const place = (m, d) => { m.position.copy(d).normalize().multiplyScalar(RE * .99); m.lookAt(0, 0, 0); m.scale.z = .2; g.add(m); };
  place(hl1, V(-.36 * s - .05, .42, .83)); place(hl2, V(.28 * s + .05, -.32, .9));
  // веки: полусферы чуть больше глаза; верхнее (шапочка вокруг +Y), нижнее (вокруг −Y)
  const lidPivot = new THREE.Group(); g.add(lidPivot);
  const upP = new THREE.Group(), loP = new THREE.Group(); lidPivot.add(upP, loP);
  const up = furry(lidGeo(RE * 1.06, true), upP, 0, true), lo = furry(lidGeo(RE * 1.045, false), loP, 0, true);
  up.castShadow = lo.castShadow = false;
  const lashU = new THREE.Mesh(new THREE.TorusGeometry(RE * 1.06, RE * .036, 6, 56), lashMat); lashU.rotation.x = Math.PI / 2; up.add(lashU);
  const lashL = new THREE.Mesh(new THREE.TorusGeometry(RE * 1.045, RE * .02, 6, 56), lashMat); lashL.rotation.x = Math.PI / 2; lo.add(lashL);
  const shut = new THREE.Mesh(closedLashGeo(f), lashMat); shut.visible = false; head.add(shut);
  return { s, f, g, ball, up, lo, upP, loP, hl: [hl1, hl2], lashU, lashL, shut };
});

// ——— нос, рот, усы ———
const pinkMat = new THREE.MeshStandardMaterial({ color: 0xe9808f, roughness: .35 });
const mouthLineMat = new THREE.MeshStandardMaterial({ color: 0x4a2224, roughness: .6 });
const mouthInMat = new THREE.MeshStandardMaterial({ color: 0x5a1820, roughness: .85, side: THREE.BackSide });
const tongueMat = new THREE.MeshStandardMaterial({ color: 0xff7d92, roughness: .45 });
const toothMat = new THREE.MeshStandardMaterial({ color: 0xfaf6ee, roughness: .3 });
const NOSE_POS = headSurf(NOSE_DIR).addScaledVector(NOSE_DIR, .0018);
const nose = (() => {
  const g = new THREE.SphereGeometry(.0075, 24, 16), P = g.attributes.position;
  for (let i = 0; i < P.count; i++) { let x = P.getX(i), y = P.getY(i), z = P.getZ(i); x *= 1.35 * (1 + .55 * y / .0075) ; y *= .78; z *= .75; if (y > 0) z -= y * .25; P.setXYZ(i, x, y, z); }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, pinkMat); m.position.copy(NOSE_POS);
  m.lookAt(m.position.clone().add(nrm(0, .25, 1))); head.add(m); return m;
})();
// рот: группа на поверхности мордочки под носом; открытый рот — дырка в коже (шейдер шерсти) + полость за ней
const MOUTH_POS = headSurf(MOUTH_DIR).addScaledVector(MOUTH_DIR, .0012);
const mouth = new THREE.Group(); mouth.position.copy(MOUTH_POS); head.add(mouth);
mouth.lookAt(mouth.position.clone().add(nrm(0, -.15, 1)));
mouth.updateMatrix(); FU.uMouthInv.value.copy(mouth.matrix).invert();
const MOUTH_Q = mouth.quaternion.clone(), _qz = new THREE.Quaternion();
const mR = .0042;
const philtrum = new THREE.Mesh(new THREE.CylinderGeometry(.00075, .00075, 1, 6), mouthLineMat); mouth.add(philtrum);
const omega = [1, -1].map(s => {
  const arc = new THREE.Mesh(new THREE.TorusGeometry(mR, .00078, 6, 18, Math.PI), mouthLineMat);
  const pv = new THREE.Group(); pv.add(arc); mouth.add(pv); arc.rotation.z = Math.PI; arc.position.x = s * mR;
  return { s, pv, arc };
});
// полость рта — внутренняя сторона (BackSide) эллипсоида за дыркой: видна только сквозь неё
const cavity = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), mouthInMat); mouth.add(cavity);
const tongue = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), tongueMat); mouth.add(tongue);
const fangs = [1, -1].map(s => { const f = new THREE.Mesh(new THREE.ConeGeometry(.0011, .0028, 8), toothMat); f.rotation.x = Math.PI; mouth.add(f); return { s, f }; });
// усы
const whiskMat = new THREE.MeshStandardMaterial({ color: 0xfff8ee, roughness: .4, emissive: 0x2a2620 });
const whiskers = new THREE.Group(); head.add(whiskers);
[1, -1].forEach(s => [[.012, .3], [0, 0], [-.01, -.32]].forEach(([dy, ang], i) => {
  const root = headSurf(nrm(s * .26, -.33 + dy * 4, .95)).add(V(0, 0, -.002));
  const dir = V(s * Math.cos(ang * .4), Math.sin(ang * .4) * .55 - .05, .32).normalize();
  const L = .062 - i * .004;
  const p1 = root.clone().addScaledVector(dir, L * .5).add(V(0, .004, .006)), p2 = root.clone().addScaledVector(dir, L).add(V(0, -.006 + dy * .3, -.004));
  const crv = new THREE.QuadraticBezierCurve3(root, p1, p2);
  const tg = new THREE.TubeGeometry(crv, 14, .00055, 4, false);
  const P = tg.attributes.position;    // сужение к кончику
  for (let k = 0; k < P.count; k++) { const seg = Math.floor(k / 5) / 14; const c = crv.getPoint(seg); const v = V().fromBufferAttribute(P, k); v.sub(c).multiplyScalar(1 - .75 * seg).add(c); P.setXYZ(k, v.x, v.y, v.z); }
  const w = new THREE.Mesh(tg, whiskMat); whiskers.add(w);
}));

// ——— уши ———
// ухо: «чашечка» — выпуклая спинка, вогнутый перед (розовый внутри, светлые кисточки у основания), кончик назад
const EAR_H = .064, EAR_NU = 26, EAR_NV = 12;
function earGeo() {
  const pos = [], idx = [], info = [];
  for (let j = 0; j <= EAR_NV; j++) {
    const v = j / EAR_NV;
    const w = .029 * Math.pow(1 - v, .9) + .0025 * Math.sin(v * Math.PI);
    const dB = .011 * Math.pow(1 - v, .7) + .0012, dF = .0068 * Math.pow(1 - v, .85);
    const zOff = -.009 * v * v;
    for (let i = 0; i < EAR_NU; i++) {
      const a = i / EAR_NU * Math.PI * 2, sa = Math.sin(a);
      pos.push(Math.cos(a) * w, v * EAR_H, (sa >= 0 ? -dB * sa : dF * sa) + zOff);
      info.push(v, sa);
    }
  }
  for (let j = 0; j < EAR_NV; j++) for (let i = 0; i < EAR_NU; i++) { const a = j * EAR_NU + i, b = j * EAR_NU + (i + 1) % EAR_NU, c = a + EAR_NU, d = b + EAR_NU; idx.push(a, b, c, b, d, c); }
  const tip = pos.length / 3; pos.push(0, EAR_H + .0015, -.0095); info.push(1, 0);
  for (let i = 0; i < EAR_NU; i++) idx.push(EAR_NV * EAR_NU + i, EAR_NV * EAR_NU + (i + 1) % EAR_NU, tip);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  g.userData.info = info;
  return g;
}
const earPink = C(0xeea2ad);
const ears = [1, -1].map(s => {
  const dir = nrm(s * .56, .8, -.08);
  const pv = new THREE.Group(); pv.position.copy(headSurf(dir)).addScaledVector(dir, -.008); head.add(pv);
  const base = new THREE.Group(); base.rotation.set(-.08, s * .32, -s * .3); pv.add(base);
  const g = earGeo(), info = g.userData.info;
  setFurAttrs(g, (p, n, i) => {
    const v = info[i * 2], sa = info[i * 2 + 1];
    let c = PAL.ginger.clone().lerp(PAL.stripeL, sm(.55, .95, v) * .55), len;
    if (sa >= 0) len = (.0013 * sm(1, .75, v) + .0005) * lerp(.25, 1, sm(0, .45, sa));   // спинка: бархат, к ободку — почти гладко (без «пилы»)
    else {
      const inner = sm(.04, .34, -sa) * sm(.97, .78, v);                    // внутренняя часть чашечки — голая розовая, переход без полосы
      const tuft = sm(.3, .03, v) * sm(.3, .7, -sa);                        // мягкие кисточки только у самого основания
      c.lerp(earPink, inner).lerp(PAL.cream, tuft * .8);
      len = .0004 * (1 - inner) + .0055 * tuft;
    }
    return { c, len, comb: V(0, 1, .3), aux: AUX0 };
  }, 2.1);
  const outer = furry(g, base);
  return { s, pv, base, outer };
});

// ——— лапы и хвост ———
const legFront = s => new FurTube({ nB: 18, nC: 3, nR: 12, restLen: .115, dens: 1.1,
  radius: u => .0155 - .0025 * sm(.1, .55, u) + .0042 * sm(.62, .9, u) - .0012 * sm(.92, 1, u),
  attr: (u, th) => {
    const sk = Math.pow(.5 + .5 * Math.sin(u * 30 - 1), 4) * sm(.55, .3, u) * sm(.5, -.5, Math.cos(th)) * .7;
    let c = PAL.ginger.clone().lerp(PAL.stripe, sk);
    c.lerp(PAL.gingerL, sm(-.2, .6, Math.cos(th)) * .3);
    c.lerp(PAL.white, sm(.76, .84, u));
    return { c, len: lerp(.008, .0042, sm(.7, .9, u)), aux: [0, 0, sk, 0] };
  } });
const legHind = s => new FurTube({ nB: 12, nC: 3, nR: 12, restLen: .085, dens: 1.1,
  radius: u => .016 - .004 * sm(.2, .6, u) + .002 * sm(.65, .95, u),
  attr: u => ({ c: PAL.ginger.clone().lerp(PAL.white, sm(.62, .74, u)), len: lerp(.011, .0045, sm(.5, .85, u)) }) });
const legs = {
  FL: legFront(1), FR: legFront(-1), HL: legHind(1), HR: legHind(-1),
};
// хвост: 5 широких тёмных колец (~40%), кончик тёмный; почти не причёсан вдоль — кольца не размазываются
const tail = new FurTube({ nB: 26, nC: 3, nR: 12, restLen: .2, combW: .3,
  radius: u => .0115 - .0045 * u * u,
  attr: (u, th, cap) => {
    const ring = clamp(sm(.08, .42, Math.sin(u * Math.PI * 2 * 4.6 - .9)) * sm(.05, .14, u) + sm(.9, .97, u) + Math.max(0, cap));
    return { c: PAL.ginger.clone().lerp(PAL.stripe, ring * .95), len: .016 * (1 - .4 * sm(.75, 1, u)) * (1 - .6 * Math.max(0, cap)), aux: [0, 0, ring, 0] };
  } });
const tubeMeshes = {};
for (const [n, tb] of Object.entries({ ...legs, tail })) { tubeMeshes[n] = furry(tb.geo, group); tubeMeshes[n].frustumCulled = false; tubeMeshes[n].userData.shells.forEach(m => m.frustumCulled = false); }

// ——— уровень детализации шерсти: перед кадром (первым объектом) по размеру головы в кадре ———
const lodProbe = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(9), 3)),
  new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, depthTest: false }));
lodProbe.frustumCulled = false; lodProbe.renderOrder = -1e6; group.add(lodProbe);
const _hw = new THREE.Vector3();
lodProbe.onBeforeRender = (r, s, cam) => {
  if (!shellAuto || !cam.isPerspectiveCamera) return;
  head.getWorldPosition(_hw);
  const frac = .1 / Math.max(_hw.distanceTo(cam.position) * Math.tan(cam.fov * Math.PI / 360) / cam.zoom, 1e-3);   // доля высоты кадра под голову
  const n = frac > .3 ? 16 : frac > .13 ? 12 : 8;
  const lidOn = frac > .2;
  if (n !== shellLimit || lidOn !== lidShellsOn) { lidShellsOn = lidOn; applyShells(n); }
};

// ———————————————————————— поза ————————————————————————
const tmpM = new THREE.Matrix4();
const bodyPt = (x, y, z) => V(x, y, z).applyMatrix4(body.matrix);  // точка тела → координаты группы
function ik2(S, T, l1, l2, hint, maxStretch = 1.3) {
  const d = T.clone().sub(S); let L = d.length(); const dir = d.clone().normalize();
  const s = clamp(L / ((l1 + l2) * .98), 1, maxStretch); const a = l1 * s, b = l2 * s;
  L = Math.min(L, (a + b) * .985);
  const x = (a * a - b * b + L * L) / (2 * L), h = Math.sqrt(Math.max(0, a * a - x * x));
  const perp = hint.clone().addScaledVector(dir, -hint.dot(dir)).normalize();
  return { E: S.clone().addScaledVector(dir, x).addScaledVector(perp, h), W: S.clone().addScaledVector(dir, L) };
}
const headPos = V(0, 0, 0), paws = { L: V(), R: V() };
let reachSide = 'R';
const L1 = .056, L2 = .05, SHOULDER = s => V(s * .029, .118, .026);
const num = (v, d = 0) => (typeof v === 'number' && isFinite(v) ? v : d);

function pose(t, k = {}) {
  const K = (n, d = 0) => num(k[n], d);
  const talk = K('talk'), smile = K('smile'), mouthO = clamp(K('mouthO')), pout = clamp(K('pout'));
  const look = Array.isArray(k.look) ? [num(k.look[0]), num(k.look[1])] : [0, 0];
  const blink = K('blink'), lidK = clamp(K('lid')), squint = clamp(K('squint')), wide = K('wide'), happy = K('happy'), closed = K('closed');
  const earDown = K('earDown'), earBack = K('earBack'), earPerk = K('earPerk'), earTwitch = K('earTwitch');
  const tuck = K('tuck'), shiver = K('shiver'), rub = K('rub'), cover = clamp(K('coverEar')), groom = clamp(K('groom')), flinch = K('flinch'), proud = K('proud');
  const lean = K('lean'), scoot = K('scoot'), lie = K('lie'), purr = K('purr'), tailUp = K('tailUp'), tailSwish = K('tailSwish'), blush = K('blush');
  const reach = k.reach && typeof k.reach === 'object' ? k.reach : null, rk = clamp(num(reach?.k));
  const rAt = reach && Array.isArray(reach.at) ? V(num(reach.at[0]), num(reach.at[1], .1), num(reach.at[2], .25)) : V(0, .1, .25);
  const rSide = reach?.side === 'L' ? 'L' : 'R', rs = rSide === 'L' ? 1 : -1;   // по контракту тянется правая лапа
  reachSide = rSide;
  const cSide = k.coverSide === 'L' ? 'L' : 'R', cs = cSide === 'L' ? 1 : -1;
  const rkS = ss(rk), g8 = ss(groom), c8 = ss(cover);

  // ——— шерсть ———
  FU.uFurScale.value = 1 + .55 * flinch + .08 * tuck;
  FU.uGrav.value = .5 * (1 - .8 * flinch); FU.uComb.value = .8 * (1 - .7 * flinch);
  FU.uBlush.value = blush;
  bodyMesh.morphTargetInfluences[0] = clamp(proud);

  // ——— тело ———
  const breath = Math.sin(t * 2.3) * (1 + purr * .5);
  const shv = shiver * (Math.sin(t * 57) * .6 + Math.sin(t * 83 + 1) * .4);
  const hop = scoot * Math.abs(Math.sin(t * 9)) * .022 + flinch * .028;
  // тянется всем телом: разворот к цели, наклон вперёд, сдвиг к цели (лапа сама дотягивает с запасом ≤ 1.2)
  let rYaw = 0, rPitch = 0, rRoll = 0;
  const rShift = V(0, 0, 0);
  if (rk > 0) {
    rYaw = clamp(Math.atan2(rAt.x + rs * .03, Math.max(rAt.z, .03)), -1.15, 1.15) * .78;   // к цели сбоку разворачивается сильнее
    const S0 = SHOULDER(rs).applyAxisAngle(V(0, 1, 0), rYaw);
    const need0 = rAt.distanceTo(S0) - (L1 + L2) * 1.05;
    rPitch = .5 * sm(0, .14, need0);
    const lat = rAt.clone().sub(S0).applyAxisAngle(V(0, 1, 0), -rYaw).x;
    rRoll = -clamp(lat / .25, -1, 1) * .16;
  }
  body.position.set(shv * .0018, hop - tuck * .004 + .022 * rPitch * rkS, -proud * .004);
  body.rotation.set(-proud * .12 + tuck * .1 + groom * .06 + rPitch * rkS, rYaw * rkS, -lean * .25 + rRoll * rkS + shv * .02 + cover * cs * .05);
  const sY = 1 + breath * .008 - tuck * .06 + flinch * .05 + purr * .004 * Math.sin(t * 46);
  body.scale.set(1 / Math.sqrt(sY) + tuck * .03, sY, 1 / Math.sqrt(sY) + tuck * .03);
  // лёжа: тело ложится на живот (поворот вперёд), голова на лапах
  if (lie > 0) {
    const L = ss(lie);
    body.rotation.x = lerp(body.rotation.x, 1.42, L);
    body.position.y += .05 * L; body.position.z -= .07 * L;
  }
  body.updateMatrix();
  if (rk > 0) {   // недостающее расстояние — сдвиг тела к цели по горизонтали
    const Sg = bodyPt(...SHOULDER(rs).toArray());
    const need = rAt.distanceTo(Sg) - (L1 + L2) * 1.08;
    if (need > 0) {
      rShift.set(rAt.x - Sg.x, 0, rAt.z - Sg.z).normalize().multiplyScalar(Math.min(need, .2) * rkS);
      body.position.add(rShift); body.updateMatrix();
    }
  }

  // ——— голова ———
  const turnLook = clamp(look[0]) * .12, nodLook = -clamp(look[1]) * .08;   // глаза поворачиваются меньше — помогает голова
  const headTurn = K('headTurn') + turnLook - groom * .25 - rYaw * rkS * .85;
  const headTilt = K('headTilt') - c8 * cs * .5 + g8 * .25;
  const nod = K('nod') + nodLook + tuck * .22 + g8 * .22 - proud * .05 + lidK * .1, lookUp = K('lookUp') + proud * .45;
  neck.position.set(0, .146 - tuck * .012, .006 + tuck * .006);
  neck.rotation.set(-lerp(0, 1.42, ss(lie)) + body.rotation.x * (1 - ss(lie)) * -.6 + nod * .45 - lookUp * .4 + shv * .02 - talk * .03 + flinch * -.08,
    headTurn * (1 - lie * .5), headTilt * .7 + Math.sin(t * 1.1) * .02 - body.rotation.z * .5);
  if (lie > 0) { neck.position.y -= .03 * ss(lie); neck.rotation.x += .25 * ss(lie); }
  head.scale.setScalar(1 + flinch * .03);

  // ——— глаза ———
  const pupil = .36 + .1 * wide - .12 * flinch - .05 * squint + .04 * happy;
  eyeU.uPupil.value = clamp(pupil, .18, .55);
  // закрытие: веки смыкаются; почти закрытый глаз уходит под кожу, глазница заполняется, шерсть отрастает поверх,
  // остаётся только линия века «‿» / «∩» — без «подушечек» на месте глаз
  const cl = clamp(closed), hp = clamp(happy * 1.3), bl = clamp(blink);   // «^^» наступает раньше: happy .7 уже читается как радость
  const cEff = Math.max(cl, hp, bl);
  const sinkK = sm(.6, .94, cEff), furBack = sm(.66, .96, cEff);
  headMesh.morphTargetInfluences[MORPH.fill] = sinkK;
  const openU = -.8 - .05 * wide - .05 * flinch;        // угол верхнего века (открыто): край века на верхнем краю радужки
  const openL = .95 + .1 * wide + .06 * flinch;
  const sleepy = clamp(lidK * .85 + squint * .62 + g8 * .55 + proud * .22);
  const lowRise = clamp(squint * .5 + clamp(smile) * .3 + lidK * .22 + g8 * .2);
  // опущенное веко: глаз чуть глубже, шерсть вокруг смыкается с веком, на веке шерсть как на голове
  const bB = lerp(1, .62, furBack);
  let uA = lerp(openU, .34, sleepy), lA = lerp(openL, .3, lowRise);
  uA = lerp(uA, lA - .02, bl);
  uA = lerp(uA, -.1, cl); lA = lerp(lA, -.12, cl);
  uA = lerp(uA, -.25, hp); lA = lerp(lA, -.27, hp);
  // шерсть над веком смыкается по тому, насколько веко реально опущено (сонливость, моргание, закрывание) — без «купола»
  const dropU = Math.max(sleepy, clamp((uA - openU) / (.34 - openU)));
  FU.uBald.value.set(bB * (1 - .22 * sm(.15, .8, Math.max(dropU * .8, lowRise)) * (1 - furBack)), bB * (1 - .72 * sm(.08, .75, dropU) * (1 - furBack)));
  FU.uLidFur.value = 1 - furBack;
  // ухмылка: кривая улыбка + один глаз прищурен сильнее (сама собой при прищуре с улыбкой — «хитрый» взгляд)
  const smirk = clamp(K('smirk') + Math.min(1, squint * 2.5) * clamp(smile) * .7, -1, 1);
  const sc = 1 + .06 * wide + .08 * flinch;
  eyes.forEach(e => {
    const sq = clamp(smirk * e.s * .25);   // глаз на стороне поднятого уголка рта прищурен сильнее
    e.upP.rotation.set(lerp(uA, lA - .05, sq * (1 - cEff)), 0, 0); e.loP.rotation.set(lerp(lA, lA - .15, sq * (1 - cEff)), 0, 0);
    // наклон век: прищур — внутренние уголки ниже; грусть и сонливость — внешние ниже
    const tilt = (squint * .35 - earDown * .3 - lidK * .24 + proud * .1) * e.s;
    e.up.rotation.set(0, 0, tilt); e.lo.rotation.set(0, 0, -tilt * .3);
    e.ball.rotation.set(-look[1] * .26, look[0] * .3, 0);
    e.g.scale.set(ESC * sc, ESC * sc, ESC * EZ * sc);
    e.g.position.copy(e.f.pos).addScaledVector(e.f.fwd, -RE * (ESINK * sinkK + .06 * sleepy * (1 - sinkK)));
    const lidsOn = sinkK < .97;
    e.up.visible = e.lo.visible = lidsOn;
    e.hl.forEach(m => { m.visible = lA - uA > .55 && sinkK < .5; });
    e.shut.visible = sinkK > .5;
    e.shut.morphTargetInfluences[0] = hp / Math.max(hp + cl + bl * .5, 1e-4);
  });

  // ——— рот ———
  const open = clamp(clamp(talk / 1.2) * (1 - mouthO * .3) + mouthO * .35 + flinch * .12 + g8 * .12);
  const kO = clamp(mouthO * 1.6);
  headMesh.morphTargetInfluences[MORPH.jaw] = clamp(open * .95 * (1 - .45 * kO));
  const smL = clamp(smile * (1 + .8 * smirk)), smR = clamp(smile * (1 - .8 * smirk));
  headMesh.morphTargetInfluences[MORPH.smileL] = smL; headMesh.morphTargetInfluences[MORPH.smileR] = smR;
  headMesh.morphTargetInfluences[MORPH.pout] = pout;
  mouth.position.copy(MOUTH_POS).add(V(0, .0004 * (smL + smR) - .0004 * pout, .0021 * pout));
  mouth.quaternion.copy(MOUTH_Q).multiply(_qz.setFromAxisAngle(V(0, 0, 1), (smL - smR) * .16));   // кривая ухмылка — линия рта наклонена
  nose.position.copy(NOSE_POS).add(V(0, 0, .0012 * pout));
  philtrum.position.set(0, .0055, .0002); philtrum.scale.set(1, .0035, 1);
  omega.forEach(({ s, pv, arc }) => {
    const smS = s > 0 ? smL : smR;
    pv.position.set(0, .0038 + pout * .0005, 0);
    pv.rotation.set(0, 0, s * (.45 * smS - .55 * pout) * (1 - .6 * kO));
    arc.scale.set((1 + smS * .15 - pout * .2) * (1 - .25 * kO), 1 + smS * .1, 1);
  });
  // дырка: «D» (верх по линии ω) или круглое «о»; ниже нижний край уходит вместе с челюстью (морф)
  const top = .0002;
  const hw0 = .0072 + .0032 * clamp(talk) + .0014 * clamp(smile) - .0016 * pout, hh0 = .0011 + .0044 * open;
  const hw = lerp(hw0, .0036, kO), hh = lerp(hh0, .0036, kO), cyO = lerp(0, .0034, kO);
  const isOpen = open > .02;
  FU.uHole.value.set(isOpen ? hw : 0, hh, top, cyO);
  const drop = .016 * headMesh.morphTargetInfluences[MORPH.jaw] * .45;   // насколько ушёл нижний край
  const depth = hh + cyO + drop;
  cavity.visible = tongue.visible = isOpen;
  cavity.scale.set(hw * 1.15 + .0025, depth * .62 + .003, .0065); cavity.position.set(0, top - depth * .5, -.0062);
  tongue.scale.set(hw * .55 + .0008, .0024, .0045); tongue.position.set(0, top - depth * .8, -.0068); tongue.visible = open > .12;
  fangs.forEach(({ s, f }) => { f.visible = open > .28 && kO < .5; f.position.set(s * hw * .52, top - .0011, -.0019); });
  tongue.rotation.set(0, 0, 0);
  if (groom > .25) {   // язычок высовывается сбоку и лижет лапу (в такт с лапой)
    const lk = .5 + .5 * Math.sin(t * 7 - .6), gk = sm(.25, .6, groom);
    tongue.visible = true;
    tongue.scale.set(.004, .0076 * gk, .0024); tongue.rotation.set(-.6, 0, -.45);
    tongue.position.set(-.0026 - .0012 * lk, top - .005 - .001 * lk, lerp(-.004, .0055 + .0012 * lk, gk));
  }
  whiskers.rotation.set(-talk * .05 + Math.sin(t * 1.7) * .01 - smile * .05, 0, 0);

  // ——— уши ———
  const tw = earTwitch * Math.pow(Math.max(0, Math.sin(t * 2.3)), 16) * Math.sin(t * 38);
  ears.forEach(({ s, base }) => {
    const down = earDown + (cover * (s === cs ? 1.1 : 0)) + tuck * .3 + lie * .25 + lidK * .2;
    // испуг: уши «самолётиком» — разворот наружу и вниз, лишь немного назад (спереди ухо остаётся видно)
    const bk = clamp(earBack + flinch * .9 + shiver * .1);
    const cv = s === cs ? c8 : 0;   // закрываемое лапой ухо прижато ниже и назад — целиком под подушечкой
    base.rotation.set(-.08 - .16 * bk + earPerk * .12 + down * .25 - .55 * cv, s * (.32 + .3 * bk - earPerk * .1 + .3 * cv),
      -s * Math.min(.3 + down * .8 + .52 * bk - earPerk * .15, 1.55) + tw * .25);
    base.scale.setScalar(1 + earPerk * .05);
  });

  body.updateMatrix(); neck.updateMatrix(); head.updateMatrix();
  group.updateMatrixWorld(true);
  const toLocal = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const inGroup = m => tmpM.multiplyMatrices(toLocal, m.matrixWorld);
  headPos.setFromMatrixPosition(inGroup(head));

  // ——— передние лапы ———
  const bodyRot = new THREE.Matrix3().setFromMatrix4(body.matrix);
  // опоры (задние лапы, опорная передняя, хвост) поворачиваются и сдвигаются вместе с телом, когда оно тянется
  const yawB = rYaw * rkS, _Y = V(0, 1, 0);
  const follow = p => (rk > 0 ? p.applyAxisAngle(_Y, yawB).add(rShift) : p);
  ['L', 'R'].forEach(side => {
    const s = side === 'L' ? 1 : -1, tb = legs['F' + side];
    let S = bodyPt(...SHOULDER(s).toArray());
    // по умолчанию: лапка стоит перед собой
    let paw = V(s * .03 + shv * .001, .03, .072 + flinch * -.01);
    let toe = V(0, -.012, .016);  // от запястья к кончику лапы
    const hint = V(s * .3, -.2, -1);  // куда смотрит локоть (в осях тела)
    let stretch = 1.12;
    const L = ss(lie);
    if (L > 0) { paw.lerp(V(s * .03, .03, .14), L); }
    if (tuck > 0) { paw.lerp(V(s * .022, .03, .045), tuck); toe.lerp(V(0, -.012, .008), tuck); }
    if (proud > 0) paw.lerp(V(s * .028, .03, .068), proud);
    if (rub > 0) {
      const ph = Math.sin(t * 9 + (s > 0 ? 0 : Math.PI));
      paw.lerp(V(s * .011 + ph * .006, .105 + ph * .006 * s, .085), rub);
      toe.lerp(V(-s * .008, .012, .006), rub); hint.lerp(V(s, -.6, -.2), rub);
    }
    if (groom > 0 && s === -1) {
      // умывается: подушечка лапы сбоку мордочки, повёрнута ко рту; лапа ходит вверх-вниз по щеке, язык лижет её
      const lick = Math.sin(t * 7);
      const hm = inGroup(head), mp = mouth.position;
      const pad = V(-.012 - .002 * lick, mp.y - .029 + lick * .003, mp.z + .012).applyMatrix4(hm);   // кончик лапы под ртом: язык виден над ней
      const toward = V(.006, .014 + lick * .002, -.003).transformDirection(hm).multiplyScalar(.015);
      paw.lerp(pad.addScaledVector(toward, -.6), g8); toe.lerp(toward, g8); hint.lerp(V(-.7, -1, .1), g8);
      S.lerp(bodyPt(s * .03, .124, .03), g8);
    }
    if (cover > 0 && s === cs) {
      // подушечка лапы сверху на прижатом ухе (заходит на силуэт головы), локоть вниз-вперёд, плечо приподнято
      const em = inGroup(ears[cs === 1 ? 0 : 1].base);
      const ep = V(0, EAR_H * .52, .004).applyMatrix4(em), out = ep.clone().sub(headPos).normalize();
      const tgt = ep.addScaledVector(out, .008);
      const over = headPos.clone().sub(tgt).normalize().multiplyScalar(.014);
      paw.lerp(tgt.addScaledVector(over, -.4), c8); toe.lerp(over, c8);
      S.lerp(bodyPt(s * .046, .163, .03), c8); hint.lerp(V(s * .9, -.5, .45), c8); stretch = lerp(stretch, 1.25, c8);   // локоть в сторону — лапа видна снаружи щеки
    }
    if (rk > 0 && s === rs) {
      const dir = rAt.clone().sub(S).normalize();
      S.addScaledVector(dir, .016 * rkS);
      paw.lerp(rAt.clone().addScaledVector(dir, -.012), rkS);
      toe.lerp(dir.clone().multiplyScalar(.016), rkS); hint.lerp(V(s * .4, -1, -.2), rkS);
      stretch = lerp(stretch, 1.2, rkS);
    } else if (rk > 0) {
      follow(paw.add(V(0, 0, .03 * rPitch * rkS)));   // опорная лапа переступает вместе с телом
    }
    const { E, W } = ik2(S, paw, L1, L2, hint.applyMatrix3(bodyRot).normalize(), stretch);
    const T = W.clone().add(toe);
    tb.update([S.clone().add(V(0, .02, -.01).applyMatrix3(bodyRot)), S, E, W, T], V(0, 0, 1));
    paws[side].copy(T);
  });
  // ——— задние лапы ———
  ['L', 'R'].forEach(side => {
    const s = side === 'L' ? 1 : -1, tb = legs['H' + side];
    const hip = bodyPt(s * .043, .05, -.012), hock = bodyPt(s * .05, .016, -.01);
    let foot = V(s * .052, .014, .052);
    const L = ss(lie);
    if (L > 0) foot.lerp(bodyPt(s * .05, .01, .03), L);
    if (tuck > 0) foot.lerp(V(s * .048, .014, .035), tuck);
    if (rk > 0) { follow(foot); hock.y = Math.max(hock.y, .02 + .02 * rPitch * rkS); }   // задние лапы переступают, корпус приподнят
    tb.update([hip, hock, foot.clone().add(V(0, 0, -.015)), foot], V(0, 1, 0));
  });
  // ——— хвост ———
  {
    const base = bodyPt(0, .03, -.062), ph = t * (1 + tailSwish * 3);
    const sw = Math.sin(ph) * (.25 + tailSwish * .6);
    const rest = [base, bodyPt(.02, .012, -.095), follow(V(.075 + sw * .01, .012, -.085)), follow(V(.105 + sw * .015, .013, -.02)), follow(V(.09 + sw * .03, .015, .05 + sw * .01))];
    // поднятый хвост: за спиной и с наклоном вбок «вопросиком» — спереди виден рядом с головой, кончик загнут
    const up = [base, bodyPt(.014, .06, -.1), bodyPt(.052 + sw * .006, .122, -.116), bodyPt(.096 + sw * .012, .172, -.108), bodyPt(.112 + sw * .02, .218, -.084)];
    const tuckP = [base, bodyPt(.03, .012, -.08), follow(V(.07, .012, -.03)), follow(V(.06, .012, .04)), follow(V(.01, .014, .07))];
    const lieP = [base, V(.05, .07, -.09), V(.085, .03, -.03), V(.085, .02, .05), V(.04 + sw * .01, .02, .1)];
    const tu = clamp(tailUp + flinch * .8 + proud * .6);
    const pts = rest.map((p, i) => {
      const q = p.clone().lerp(up[i], ss(tu));
      if (tuck > 0) q.lerp(tuckP[i], tuck);
      if (lie > 0) q.lerp(lieP[i], ss(lie));
      return q;
    });
    tail.update(pts, V(0, 1, 0));
  }
  group.updateMatrixWorld(true);
}

export const plush = {
  group, pose,
  headWorld: () => head.localToWorld(V(0, 0, 0)),
  // side: 'L' | 'R'; 'reach' — лапа, которая тянется (по умолчанию правая)
  pawWorld: (side = 'R') => { group.updateMatrixWorld(true); const s = side === 'reach' ? reachSide : side === 'L' ? 'L' : 'R'; return group.localToWorld(paws[s].clone()); },
  // для отладки/настройки
  rig: { setShells, body, neck, head, eyes, ears, mouth, legs, tail, FU, headMesh, bodyMesh, MORPH },
};
pose(0, {});
