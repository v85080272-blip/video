// ПЛЮШ — маленький рыжий котёнок с пушистой shell-шерстью.
// export const plush = { group, pose(t, k), headWorld(), pawWorld(side) }
// Локальные координаты: начало — точка на сиденье под тазом, лицом к +Z, +X — левый бок котёнка (к Нейро).
import { THREE, scene, V, clamp, lerp, ss, vn } from './core.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// ———————————————————————— шерсть: общие параметры и материалы ————————————————————————
const SHELLS = 16;
const FU = {
  uShells: { value: SHELLS }, uDensity: { value: 470 }, uFurScale: { value: 1 },
  uGrav: { value: .5 }, uComb: { value: .8 }, uWrap: { value: .5 }, uBlush: { value: 0 },
  uAmb: { value: new THREE.Color(.33, .27, .25) }, uSheen: { value: .5 }, uBaseDark: { value: .42 },
  uBlushCol: { value: new THREE.Color(0xff6f86) },
};

// Шерсть: основа («кожа», корни; отбрасывает тень) + оболочки InstancedMesh, номер оболочки = gl_InstanceID
// (0 — самая внешняя). Пряди — 3D-хэш по ячейкам ~2 мм в исходных (до сдвига) координатах объекта.
// Освещение шерсти считается в вершинах (диффуз с «wrap», тень ключевого света по 4 выборкам, мягкий ободок) —
// во фрагменте остаётся только проверка пряди и цвет: так шерсть укладывается в бюджет на SwiftShader.
const FV = globalThis.PLUSH_FV ?? 0;   // вариант для замеров
function furCompile(s) {
  Object.assign(s.uniforms, FU);
  s.vertexShader = s.vertexShader.replace('#include <common>', `#include <common>
#include <packing>
#include <lights_pars_begin>
#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
#endif
attribute vec3 furPos; attribute float furLen; attribute vec3 furComb; attribute float furAux;
uniform float uShells, uFurScale, uGrav, uComb, uWrap; uniform vec3 uAmb;
varying vec3 vFurPos; varying float vFurH; varying float vFurL; varying float vFurAux; varying vec3 vFurIrr; varying float vFurRim;
float furWrapL(float x) { return max((x + uWrap) / (1. + uWrap), 0.); }`)
    .replace('#include <project_vertex>', `#include <project_vertex>
  #ifdef FUR_BASE
  float furH = 0.;
  #else
  float furH = (uShells - float(gl_InstanceID)) / uShells;
  #endif
  float fL = furLen * uFurScale;
  vFurH = furH; vFurL = fL; vFurPos = furPos; vFurAux = furAux;
  vec3 fN = normalize(transformedNormal);
  #ifndef FUR_BASE
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
    vFurIrr = irr;
    vFurRim = pow(1. - saturate(dot(fN, normalize(-gp))), 2.5);
  }`);
  s.fragmentShader = '#undef USE_ENVMAP\n#define FV ' + FV + '\n' + s.fragmentShader.replace('#include <common>', `#include <common>
uniform float uDensity, uBlush, uSheen, uBaseDark; uniform vec3 uBlushCol;
varying vec3 vFurPos; varying float vFurH; varying float vFurL; varying float vFurAux; varying vec3 vFurIrr; varying float vFurRim;
vec4 furHash(vec3 c) {
  uvec3 v = uvec3(ivec3(c) + 65536);
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  uint w = (v.x ^ (v.y >> 7u) ^ (v.z << 5u)) * 747796405u;
  return vec4(vec3(v >> 8u), float(w >> 8u)) * (1. / 16777216.);
}
// расстояние до ближайшей пряди в долях её радиуса на текущей высоте + случайное число пряди
vec2 furStrand() {
  vec3 q = vFurPos * uDensity; vec3 c0 = floor(q);
  #if FV == 1
  return vec2(fract(q.x + q.y + q.z) * 1.6, .5);
  #endif
  vec3 f = q - c0; vec3 sg = step(.5, f) * 2. - 1.;
  float px = clamp(length(fwidth(q)) * .7, 0., 1.);   // ячейка мельче ~1.5 пикселя — пряди толще (без мерцания вдали)
  float best = 9., rnd = 0.;
  #if FV == 2
  for (int i = 0; i < 1; i++) {
  #else
  for (int i = 0; i < 4; i++) {
  #endif
    vec3 c = c0 + (i == 1 ? vec3(sg.x, 0., 0.) : i == 2 ? vec3(0., sg.y, 0.) : i == 3 ? vec3(0., 0., sg.z) : vec3(0.));
    vec4 r = furHash(c);
    vec3 p = c + .5 + (r.xyz - .5) * .45;
    float len = .5 + .5 * r.w;
    float kk = vFurH / len;
    float rad = (.5 + .25 * px) * sqrt(max(1. - kk, 0.));
    float d = kk >= 1. ? 9. : length(q - p) / max(rad, 1e-4);
    if (d < best) { best = d; rnd = fract(r.x * 7.31 + r.w); }
  }
  return vec2(best, rnd);
}`)
    .replace('void main() {', `void main() {
  #ifdef FUR_BASE
  vec2 fs = vec2(.5, .5);
  #else
  if (vFurL < .0006) discard;
  #if FV == 3
  vec2 fs = vec2(.5, .5);
  #else
  vec2 fs = furStrand();
  if (fs.x > 1.) discard;
  #endif
  #endif`)
    .replace('#include <color_fragment>', `#include <color_fragment>
  float fh = vFurH;
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * uBlushCol * 1.2, uBlush * vFurAux * .55);
  #ifdef FUR_BASE
  diffuseColor.rgb *= uBaseDark;
  #else
  diffuseColor.rgb *= mix(.42, 1., smoothstep(0., .8, fh)) * (.9 + .2 * fs.y) * (1. - .2 * fs.x * fs.x);
  diffuseColor.rgb = mix(diffuseColor.rgb, min(diffuseColor.rgb * 1.25 + .035, vec3(1.)), smoothstep(.5, 1., fh) * .6);
  #endif`)
    .replace('#include <lights_fragment_begin>', `
  reflectedLight.directDiffuse = vFurIrr * BRDF_Lambert(diffuseColor.rgb);
  totalEmissiveRadiance += diffuseColor.rgb * (vFurRim * uSheen * fh);`)
    .replace('#include <lights_fragment_maps>', '').replace('#include <lights_fragment_end>', '');
}
const furBaseMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95 });
furBaseMat.defines = { FUR_BASE: '' };
furBaseMat.onBeforeCompile = furCompile; furBaseMat.customProgramCacheKey = () => 'plushFurBase' + FV;
const furShellMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9 });
furShellMat.onBeforeCompile = furCompile; furShellMat.customProgramCacheKey = () => 'plushFurShell' + FV;

// меш с шерстью: основа (тень, «кожа») + оболочки
const allShells = [];
function setShells(n) { FU.uShells.value = n; allShells.forEach(m => { m.count = n; m.visible = n > 0; }); }
function furry(geo, parent) {
  const base = new THREE.Mesh(geo, furBaseMat); base.castShadow = base.receiveShadow = true;
  const shells = new THREE.InstancedMesh(geo, furShellMat, SHELLS); shells.castShadow = false; shells.receiveShadow = true;
  if (base.morphTargetInfluences) shells.morphTargetInfluences = base.morphTargetInfluences;   // общий массив весов морфов
  base.add(shells); parent.add(base);
  base.userData.shells = shells; allShells.push(shells);
  return base;
}

// ———————————————————————— помощники ————————————————————————
const nrm = (x, y, z) => new THREE.Vector3(x, y, z).normalize();
const C = h => new THREE.Color(h);
const sm = (a, b, x) => ss(clamp((x - a) / (b - a)));
const gauss = (x, w) => Math.exp(-(x * x) / (w * w));
const PAL = {
  ginger: C(0xe8893a), gingerL: C(0xf3a95f), stripe: C(0xb3581c), stripeD: C(0x99461a),
  cream: C(0xf6e2c6), white: C(0xf8f0e4), pink: C(0xf2a0aa),
};
// вершинные атрибуты шерсти из функции fn(p, n, i) → { c: Color, len, comb: Vector3, aux }
function setFurAttrs(geo, fn, furPos) {
  const P = geo.attributes.position, Nn = geo.attributes.normal, n = P.count;
  const col = new Float32Array(n * 3), len = new Float32Array(n), comb = new Float32Array(n * 3), aux = new Float32Array(n);
  const p = new THREE.Vector3(), q = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    p.fromBufferAttribute(P, i); q.fromBufferAttribute(Nn, i);
    const r = fn(p, q, i);
    col[i * 3] = r.c.r; col[i * 3 + 1] = r.c.g; col[i * 3 + 2] = r.c.b; len[i] = r.len; aux[i] = r.aux || 0;
    const cb = r.comb || V(0, -1, 0); const t = cb.clone().addScaledVector(q, -cb.dot(q)); if (t.lengthSq() > 1e-8) t.normalize();
    comb[i * 3] = t.x; comb[i * 3 + 1] = t.y; comb[i * 3 + 2] = t.z;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('furLen', new THREE.BufferAttribute(len, 1));
  geo.setAttribute('furComb', new THREE.BufferAttribute(comb, 3));
  geo.setAttribute('furAux', new THREE.BufferAttribute(aux, 1));
  geo.setAttribute('furPos', furPos || P.clone());
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

// ———————————————————————— трубка с шерстью (лапы, хвост): геометрия по кривой каждый кадр ————————————————————————
class FurTube {
  constructor({ nB = 22, nC = 4, nR = 14, radius, restLen, attr }) {
    Object.assign(this, { nB, nC, nR, radius, restLen });
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
    const col = new Float32Array(nV * 3), len = new Float32Array(nV), aux = new Float32Array(nV);
    rings.forEach((rg, ri) => {
      for (let i = 0; i < nR; i++) {
        const th = i / nR * Math.PI * 2, cx = Math.cos(th), sz = Math.sin(th);
        let y, rr, u;
        if (rg.kind === 0) { y = -r0 * Math.cos(rg.a); rr = r0 * Math.sin(rg.a); u = 0; }
        else if (rg.kind === 2) { y = restLen + r1 * Math.cos(rg.a); rr = r1 * Math.sin(rg.a); u = 1; }
        else { u = rg.u; y = u * restLen; rr = radius(u); }
        const vi = ri * nR + i;
        rest.set([cx * rr, y, sz * rr], vi * 3);
        const a = attr(u, th, rg.kind !== 1 ? (rg.kind === 0 ? -1 : 1) * Math.cos(rg.a) : 0);
        col.set([a.c.r, a.c.g, a.c.b], vi * 3); len[vi] = a.len; aux[vi] = a.aux || 0;
      }
    });
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('furLen', new THREE.BufferAttribute(len, 1));
    g.setAttribute('furComb', new THREE.BufferAttribute(new Float32Array(nV * 3), 3));
    g.setAttribute('furAux', new THREE.BufferAttribute(aux, 1));
    g.setAttribute('furPos', new THREE.BufferAttribute(rest, 3));
    g.boundingSphere = new THREE.Sphere(V(0, 0, 0), 10);
    this.geo = g;
    this.curve = new THREE.CatmullRomCurve3([V(0, 0, 0), V(0, 1, 0)], false, 'centripetal');
    this.P = []; this.T = []; this.N = [];
    for (let j = 0; j <= nB; j++) { this.P.push(V(0, 0, 0)); this.T.push(V(0, 1, 0)); this.N.push(V(1, 0, 0)); }
  }
  // pts — точки кривой в координатах родителя, ref — желаемое направление θ=0 (перпендикуляр к началу)
  update(pts, ref) {
    const { nB, nR, rings, radius, curve, P, T, N } = this;
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
        cmb[vi] = T[j].x; cmb[vi + 1] = T[j].y; cmb[vi + 2] = T[j].z;
      }
    });
    this.geo.attributes.position.needsUpdate = this.geo.attributes.normal.needsUpdate = this.geo.attributes.furComb.needsUpdate = true;
  }
  end() { return this.P[this.nB]; }
}

// ———————————————————————— сборка ————————————————————————
const group = new THREE.Group(); group.name = 'plush'; scene.add(group);
const body = new THREE.Group(); group.add(body);
const neck = new THREE.Group(); neck.position.set(0, .152, .004); body.add(neck);
const head = new THREE.Group(); head.position.set(0, .063, .012); neck.add(head);

// ——— тело ———
const bodyGeo = blob(24, d => {
  const wb = 1 + .2 * Math.max(0, -d.y) - .1 * Math.max(0, d.y);
  const p = V(d.x * .066 * wb, d.y * .082, d.z * .06 * wb);
  bumpTo(p, d, nrm(0, .25, 1), .06, .009);              // грудка
  bumpTo(p, d, nrm(.78, -.5, -.18), .07, .014);         // «бёдра»
  bumpTo(p, d, nrm(-.78, -.5, -.18), .07, .014);
  bumpTo(p, d, nrm(0, -.45, 1), .07, .005);             // животик
  p.y += .079; p.z -= .008;
  if (p.y < .012) p.y = .012 - (.012 - p.y) * .3;     // сидит на подушке — низ приплюснут
  return p;
});
setFurAttrs(bodyGeo, (p, n) => {
  const phi = Math.atan2(p.x, p.z);                     // 0 — спереди
  const front = sm(.95, .45, Math.abs(phi)) * sm(-.2, .3, n.z + .2);
  // полоски поперёк спины (по высоте вдоль позвоночника), только на спине и боках
  const sp = (p.y - .04 * Math.max(0, -p.z) / .06) * 70 + .6 * Math.sin(phi * 3);
  const stripe = Math.pow(.5 + .5 * Math.sin(sp), 3) * sm(1.15, 1.9, Math.abs(phi)) * sm(.02, .05, p.y);
  const spine = gauss(p.x, .009) * sm(-.02, -.05, p.z) * sm(.03, .07, p.y);
  let c = PAL.ginger.clone().lerp(PAL.gingerL, sm(.1, -.1, p.y - .08) * .3);
  c.lerp(PAL.stripe, clamp(stripe * .85 + spine * .8));
  c.lerp(PAL.white, front);
  const len = (.015 + .006 * front * sm(.07, .13, p.y)) * sm(.0, .03, p.y) + .002;
  return { c, len, comb: V(0, -1, -.35).add(V(p.x, 0, p.z).multiplyScalar(2)), aux: 0 };
});
const bodyMesh = furry(bodyGeo, body);

// ——— голова ———
const HR = { x: .088, y: .075, z: .079 };
const EYE_DIR = s => nrm(s * .42, .02, .9);
const CHEEK = s => nrm(s * .8, -.38, .45);
function headShape(d, jaw = 0) {
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
const headGeo = blob(28, d => headShape(d));
// морф «челюсть»: подбородок и нижняя часть мордочки опускаются
{
  const P = headGeo.attributes.position, dirs = headGeo.userData.dirs, mp = new Float32Array(P.count * 3), d = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) {
    d.fromArray(dirs, i * 3);
    const w = sm(-.3, -.48, d.y) * sm(.3, .75, d.z) * sm(.55, .2, Math.abs(d.x)) * (1 - sm(-.8, -.95, d.y));
    mp.set([0, -.0085 * w, -.0025 * w], i * 3);
  }
  headGeo.morphAttributes.position = [new THREE.BufferAttribute(mp, 3)]; headGeo.morphTargetsRelative = true;
}
const NOSE_ROOT = V(0, -.008, .07);
setFurAttrs(headGeo, (p, n, i) => {
  const d = V().fromArray(headGeo.userData.dirs, i * 3);
  const a = Math.atan2(d.y, d.z);                       // по сагиттали: 0 — спереди, π/2 — макушка
  const u = Math.atan2(Math.abs(d.x), d.z), v = Math.asin(clamp(d.y, -1, 1));
  let c = PAL.ginger.clone();
  c.lerp(PAL.gingerL, sm(0, -.5, d.y) * .55);
  // «M» и полоски на лбу, уходящие через макушку к затылку
  const band = (x0, w, a0, a1) => gauss(d.x - x0, w) * sm(a0, a0 + .12, a) * (1 - sm(a1 - .2, a1, a));
  const sx = .16 + .1 * sm(.35, 1.1, a);
  let st = band(0, .045, .38, 2.7) + band(sx, .04, .34, 2.4) + band(-sx, .04, .34, 2.4) + .8 * band(.085, .025, .5, .85) + .8 * band(-.085, .025, .5, .85);
  st += .9 * band(.3 + .08 * sm(.4, 1.3, a), .035, .7, 2.2) + .9 * band(-.3 - .08 * sm(.4, 1.3, a), .035, .7, 2.2);
  // «тушь»: две полоски от внешнего угла глаза на щёку
  st += gauss(v - (-.02 - .25 * (u - .75)), .035) * sm(.7, .82, u) * (1 - sm(1.25, 1.45, u));
  st += .8 * gauss(v - (-.2 - .2 * (u - .8)), .03) * sm(.85, .95, u) * (1 - sm(1.3, 1.5, u));
  c.lerp(PAL.stripe, clamp(st) * .9);
  // светлее вокруг глаз
  const eA = Math.max(d.dot(EYE_DIR(1)), d.dot(EYE_DIR(-1)));
  c.lerp(PAL.gingerL, sm(.9, .97, eA) * .7);
  // белая мордочка, подбородок и горлышко
  const muz = sm(.86, .93, d.dot(nrm(0, -.45, .9))) + sm(.88, .94, d.dot(nrm(.17, -.38, .92))) + sm(.88, .94, d.dot(nrm(-.17, -.38, .92)));
  const white = clamp(muz + sm(-.55, -.78, d.y) * sm(-.3, .2, d.z));
  c.lerp(PAL.white, white);
  // длина шерсти
  let len = .011 - .002 * sm(.3, .8, d.y) * sm(0, .5, d.z);
  len += .008 * sm(.82, .97, Math.max(d.dot(CHEEK(1)), d.dot(CHEEK(-1))));        // пушистые щёки
  len = lerp(len, .0035, sm(.84, .93, d.dot(nrm(0, -.38, .93))));                  // мордочка — короткая
  len = lerp(len, .0012, sm(.955, .985, d.dot(nrm(0, -.2, 1))));                   // нос
  len *= sm(.955, .91, eA);                                                         // вокруг глаз — без шерсти
  len = lerp(len, .006, sm(-.6, -.8, d.y) * sm(-.2, .3, d.z));                      // подбородок/горло
  const blush = sm(.88, .97, Math.max(d.dot(nrm(.62, -.25, .75)), d.dot(nrm(-.62, -.25, .75))));
  const comb = p.clone().sub(NOSE_ROOT).add(V(0, -.03, -.02));
  return { c, len, comb, aux: blush };
});
const headMesh = furry(headGeo, head);
const headSurf = d => headShape(d.clone().normalize());

// ——— глаза ———
const RE = .0245;
const eyeU = { uPupil: { value: .36 }, uIrisIn: { value: C(0xf0a22c) }, uIrisOut: { value: C(0x86b33c) }, uIrisDark: { value: C(0x4a3410) } };
const eyeMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: .3, clearcoat: 1, clearcoatRoughness: .03 });
eyeMat.onBeforeCompile = s => {
  Object.assign(s.uniforms, eyeU);
  s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vEyeP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvEyeP = position;');
  s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vEyeP; uniform float uPupil; uniform vec3 uIrisIn, uIrisOut, uIrisDark;`).replace('#include <color_fragment>', `#include <color_fragment>
  { vec3 e = normalize(vEyeP); float r = e.z > 0. ? length(e.xy) : 2. - length(e.xy);
    float aw = fwidth(r) * 1.2 + .004;
    float IR = .8, PR = uPupil;
    float ang = atan(e.y, e.x);
    float t = clamp((r - PR) / (IR - PR), 0., 1.);
    vec3 iris = mix(uIrisIn, uIrisOut, smoothstep(.15, .85, t));
    float fib = sin(ang * 41. + sin(ang * 7.) * 3.) * .5 + sin(ang * 23. - 1.3) * .5;
    iris *= 1. + .16 * fib * (1. - t * .5);
    iris = mix(iris, uIrisDark, smoothstep(.72, 1., t) * .85);           // тёмный ободок
    iris = mix(iris, uIrisIn * 1.25, (1. - smoothstep(0., .18, t)) * .5); // светлый ободок у зрачка
    iris *= .72 + .28 * smoothstep(.65, -.2, e.y);                       // тень от века сверху
    vec3 sclera = vec3(.88, .85, .8) * (.8 + .2 * smoothstep(.5, -.5, e.y));
    vec3 col = mix(iris, sclera, smoothstep(IR - aw, IR + aw, r));
    col = mix(vec3(.012, .01, .012), col, smoothstep(PR - aw, PR + aw, r));
    diffuseColor.rgb = col; }`);
};
eyeMat.customProgramCacheKey = () => 'plushEye';
const hlMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.15, 2.0) });
const lidMat = new THREE.MeshStandardMaterial({ color: PAL.ginger.clone().lerp(PAL.gingerL, .5), roughness: .85 });
const lidLowMat = new THREE.MeshStandardMaterial({ color: PAL.gingerL.clone().lerp(PAL.cream, .3), roughness: .85 });
const lashMat = new THREE.MeshStandardMaterial({ color: 0x3a1c10, roughness: .6 });
const eyes = [1, -1].map(s => {   // s=+1 левый глаз котёнка (+X), s=−1 правый
  const dir = EYE_DIR(s), surf = headSurf(dir);
  const g = new THREE.Group(); g.position.copy(surf).addScaledVector(dir, -RE * .5); head.add(g);
  g.lookAt(g.position.clone().add(nrm(dir.x * .55, dir.y, dir.z)));
  // g смотрит +Z после lookAt? lookAt у Object3D (не камера) направляет +Z на цель
  const ball = new THREE.Mesh(new THREE.SphereGeometry(RE, 40, 28), eyeMat); g.add(ball);
  const hl1 = new THREE.Mesh(new THREE.SphereGeometry(RE * .2, 16, 10), hlMat), hl2 = new THREE.Mesh(new THREE.SphereGeometry(RE * .09, 12, 8), hlMat);
  const place = (m, d) => { m.position.copy(d).normalize().multiplyScalar(RE * 1.0); m.lookAt(0, 0, 0); m.scale.z = .25; g.add(m); };
  place(hl1, V(-.36 * s - .05, .42, .83)); place(hl2, V(.28 * s + .05, -.32, .9));
  // веки: полусферы чуть больше глаза; верхнее (шапочка вокруг +Y), нижнее (вокруг −Y)
  const lidPivot = new THREE.Group(); g.add(lidPivot);
  const up = new THREE.Mesh(new THREE.SphereGeometry(RE * 1.07, 36, 12, 0, Math.PI * 2, 0, Math.PI / 2), lidMat);
  const lo = new THREE.Mesh(new THREE.SphereGeometry(RE * 1.055, 36, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), lidLowMat);
  const lashU = new THREE.Mesh(new THREE.TorusGeometry(RE * 1.07, RE * .055, 6, 56), lashMat); lashU.rotation.x = Math.PI / 2; up.add(lashU);
  const lashL = new THREE.Mesh(new THREE.TorusGeometry(RE * 1.055, RE * .03, 6, 56), lashMat); lashL.rotation.x = Math.PI / 2; lo.add(lashL);
  const upP = new THREE.Group(), loP = new THREE.Group(); upP.add(up); loP.add(lo); lidPivot.add(upP, loP);
  return { s, g, ball, up, lo, upP, loP, hl: [hl1, hl2] };
});

// ——— нос, рот, усы ———
const pinkMat = new THREE.MeshStandardMaterial({ color: 0xe9808f, roughness: .35 });
const mouthLineMat = new THREE.MeshStandardMaterial({ color: 0x4a2224, roughness: .6 });
const mouthInMat = new THREE.MeshStandardMaterial({ color: 0x4a1218, roughness: .8 });
const tongueMat = new THREE.MeshStandardMaterial({ color: 0xff7d92, roughness: .45 });
const toothMat = new THREE.MeshStandardMaterial({ color: 0xfaf6ee, roughness: .3 });
const NOSE_DIR = nrm(0, -.19, 1);
const nose = (() => {
  const g = new THREE.SphereGeometry(.0075, 24, 16), P = g.attributes.position;
  for (let i = 0; i < P.count; i++) { let x = P.getX(i), y = P.getY(i), z = P.getZ(i); x *= 1.35 * (1 + .55 * y / .0075) ; y *= .78; z *= .75; if (y > 0) z -= y * .25; P.setXYZ(i, x, y, z); }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, pinkMat); m.position.copy(headSurf(NOSE_DIR)).addScaledVector(NOSE_DIR, .0018);
  m.lookAt(m.position.clone().add(nrm(0, .25, 1))); head.add(m); return m;
})();
// рот: группа на поверхности мордочки под носом
const MOUTH_DIR = nrm(0, -.33, 1);
const mouth = new THREE.Group(); mouth.position.copy(headSurf(MOUTH_DIR)).addScaledVector(MOUTH_DIR, .0012); head.add(mouth);
mouth.lookAt(mouth.position.clone().add(nrm(0, -.15, 1)));
const mR = .0042;
const philtrum = new THREE.Mesh(new THREE.CylinderGeometry(.00075, .00075, 1, 6), mouthLineMat); mouth.add(philtrum);
const omega = [1, -1].map(s => {
  const arc = new THREE.Mesh(new THREE.TorusGeometry(mR, .00078, 6, 18, Math.PI), mouthLineMat);
  const pv = new THREE.Group(); pv.add(arc); mouth.add(pv); arc.rotation.z = Math.PI; arc.position.x = s * mR;
  return { s, pv, arc };
});
const cavity = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 14), mouthInMat); mouth.add(cavity);
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
function earGeo() {
  const nu = 28, nv = 14, pos = [], idx = [];
  for (let j = 0; j <= nv; j++) {
    const v = j / nv, w = .028 * Math.pow(1 - v, .85) * (1 - .15 * v) + .0025 * Math.sin(v * Math.PI), dd = .0105 * Math.pow(1 - v, .8) + .0015, y = v * .06;
    for (let i = 0; i < nu; i++) {
      const a = i / nu * Math.PI * 2; let x = Math.cos(a) * w, z = Math.sin(a) * dd;
      if (z > 0) z *= .35;               // перед почти плоский (там розовая вставка)
      pos.push(x, y - .004 * (1 - Math.abs(Math.cos(a))) * (1 - v), z - .006 * v * v);
    }
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * nu + i, b = j * nu + (i + 1) % nu, c = a + nu, d = b + nu; idx.push(a, c, b, b, c, d); }
  const tip = pos.length / 3; pos.push(0, .061, -.006);
  for (let i = 0; i < nu; i++) idx.push(nv * nu + i, tip, nv * nu + (i + 1) % nu);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
const ears = [1, -1].map(s => {
  const dir = nrm(s * .56, .8, -.08);
  const pv = new THREE.Group(); pv.position.copy(headSurf(dir)).addScaledVector(dir, -.008); head.add(pv);
  const base = new THREE.Group(); base.rotation.set(-.08, s * .32, -s * .3); pv.add(base);
  const g = earGeo();
  setFurAttrs(g, (p, n) => {
    const back = sm(.1, -.5, n.z);
    let c = PAL.ginger.clone().lerp(PAL.stripe, sm(.035, .058, p.y) * .45);
    return { c, len: (.0045 * back + .0012) * sm(.062, .045, p.y), comb: V(0, 1, 0), aux: 0 };
  });
  const outer = furry(g, base);
  const inner = new THREE.Mesh(new THREE.ConeGeometry(.019, .047, 20, 1, false), pinkMat);
  inner.scale.set(1, 1, .28); inner.position.set(0, .024, .0018); inner.rotation.x = -.06; base.add(inner);
  // светлые «кисточки» внутри уха
  return { s, pv, base, outer, inner };
});

// ——— лапы и хвост ———
const legFront = s => new FurTube({ nB: 20, nC: 4, nR: 14, restLen: .115,
  radius: u => .0155 - .0025 * sm(.1, .55, u) + .0042 * sm(.62, .9, u) - .0012 * sm(.92, 1, u),
  attr: (u, th) => {
    let c = PAL.ginger.clone().lerp(PAL.stripe, Math.pow(.5 + .5 * Math.sin(u * 30 - 1), 4) * sm(.55, .3, u) * sm(.5, -.5, Math.cos(th)) * .6);
    c.lerp(PAL.gingerL, sm(-.2, .6, Math.cos(th)) * .3);
    c.lerp(PAL.white, sm(.66, .76, u));
    return { c, len: lerp(.009, .0055, sm(.6, .9, u)) };
  } });
const legHind = s => new FurTube({ nB: 14, nC: 4, nR: 14, restLen: .085,
  radius: u => .016 - .004 * sm(.2, .6, u) + .002 * sm(.65, .95, u),
  attr: u => ({ c: PAL.ginger.clone().lerp(PAL.white, sm(.55, .7, u)), len: lerp(.011, .006, sm(.5, .9, u)) }) });
const legs = {
  FL: legFront(1), FR: legFront(-1), HL: legHind(1), HR: legHind(-1),
};
const tail = new FurTube({ nB: 30, nC: 4, nR: 14, restLen: .2,
  radius: u => .012 - .002 * u,
  attr: u => {
    const ring = Math.pow(.5 + .5 * Math.sin(u * 2 * Math.PI * 5.2 + .5), 3);
    return { c: PAL.ginger.clone().lerp(PAL.stripe, clamp(ring * .85 + sm(.85, 1, u) * .6)), len: .018 * (1 - .25 * sm(.9, 1, u)) };
  } });
const tubeMeshes = {};
for (const [n, tb] of Object.entries({ ...legs, tail })) { tubeMeshes[n] = furry(tb.geo, group); tubeMeshes[n].frustumCulled = false; tubeMeshes[n].userData.shells.frustumCulled = false; }

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

function pose(t, k = {}) {
  const K = (n, d = 0) => (k[n] ?? d);
  const talk = K('talk'), smile = K('smile'), mouthO = K('mouthO'), pout = K('pout');
  const look = k.look || [0, 0], blink = K('blink'), lidK = K('lid'), squint = K('squint'), wide = K('wide'), happy = K('happy'), closed = K('closed');
  const earDown = K('earDown'), earBack = K('earBack'), earPerk = K('earPerk'), earTwitch = K('earTwitch');
  const tuck = K('tuck'), shiver = K('shiver'), rub = K('rub'), cover = K('coverEar'), groom = K('groom'), flinch = K('flinch'), proud = K('proud');
  const lean = K('lean'), scoot = K('scoot'), lie = K('lie'), purr = K('purr'), tailUp = K('tailUp'), tailSwish = K('tailSwish', .5), blush = K('blush');
  const reach = k.reach || { k: 0, at: [.3, .12, .1] }, rk = reach.k || 0, rAt = V(...(reach.at || [.3, .12, .1]));
  const rSide = reach.side || (rAt.x >= 0 ? 'L' : 'R'), rs = rSide === 'L' ? 1 : -1;
  const cSide = k.coverSide || 'R', cs = cSide === 'L' ? 1 : -1;

  // ——— шерсть ———
  FU.uFurScale.value = 1 + .55 * flinch + .08 * tuck;
  FU.uGrav.value = .5 * (1 - .8 * flinch); FU.uComb.value = .8 * (1 - .7 * flinch);
  FU.uBlush.value = blush;

  // ——— тело ———
  const breath = Math.sin(t * 2.3) * (1 + purr * .5);
  const shv = shiver * (Math.sin(t * 57) * .6 + Math.sin(t * 83 + 1) * .4);
  const hop = scoot * Math.abs(Math.sin(t * 9)) * .022 + flinch * .028;
  body.position.set(shv * .0018 + rk * rs * .03, hop - tuck * .004, rk * .02 - proud * .004);
  body.rotation.set(-proud * .14 + tuck * .1 + groom * .06 + rk * .12, rk * rs * .5, -lean * .25 - rk * rs * .32 + shv * .02);
  const sY = 1 + breath * .008 - tuck * .06 + flinch * .05 + purr * .004 * Math.sin(t * 46);
  body.scale.set(1 / Math.sqrt(sY) + tuck * .03, sY, 1 / Math.sqrt(sY) + tuck * .03);
  // лёжа: тело ложится на живот (поворот вперёд), голова на лапах
  if (lie > 0) {
    const L = ss(lie);
    body.rotation.x = lerp(body.rotation.x, 1.42, L);
    body.position.y += .05 * L; body.position.z -= .07 * L;
  }
  body.updateMatrix();

  // ——— голова ———
  const headTurn = K('headTurn') + rk * rs * .25, headTilt = K('headTilt') + cover * cs * .4 + groom * -.2;
  const nod = K('nod') + tuck * .22 + groom * .3 - proud * .05 + rk * -.05, lookUp = K('lookUp') + proud * .22;
  neck.position.set(0, .152 - tuck * .012, .004 + tuck * .006);
  neck.rotation.set(-lerp(0, 1.42, ss(lie)) + body.rotation.x * (1 - ss(lie)) * -.6 + nod * .45 - lookUp * .4 + shv * .02 - talk * .03 + flinch * -.08,
    headTurn * (1 - lie * .5), headTilt * .7 + Math.sin(t * 1.1) * .02);
  if (lie > 0) { neck.position.y -= .03 * ss(lie); neck.position.z += .0 * ss(lie); neck.rotation.x += .25 * ss(lie); }
  head.scale.setScalar(1 + flinch * .03);

  // глаза
  const pupil = .36 + .1 * wide - .12 * flinch - .05 * squint + .04 * happy;
  eyeU.uPupil.value = clamp(pupil, .18, .55);
  const openU = -1.05 - .25 * wide - .2 * flinch;     // угол верхнего века (открыто)
  const openL = .95 + .15 * wide + .1 * flinch;
  const sleepy = clamp(lidK * .55 + squint * .45 + groom * .4);
  let uA = lerp(openU, .25, sleepy), lA = lerp(openL, .55, squint * .7);
  // закрытия: blink (до нижнего века), closed («‿»), happy («^^»)
  uA = lerp(uA, lA - .02, clamp(blink));
  const cl = clamp(closed), hp = clamp(happy);
  uA = lerp(uA, .32, cl); lA = lerp(lA, .3, cl);
  uA = lerp(uA, -.38, hp); lA = lerp(lA, -.36, hp);
  eyes.forEach(e => {
    e.upP.rotation.set(uA, 0, 0); e.loP.rotation.set(lA, 0, 0);
    // наклон век: прищур — внутренние уголки ниже; грусть — внешние ниже
    const tilt = (squint * .35 - earDown * .3 + proud * .1) * e.s;
    e.up.rotation.set(0, 0, tilt); e.lo.rotation.set(0, 0, -tilt * .3);
    e.ball.rotation.set(-look[1] * .32, look[0] * .38, 0);
    e.g.scale.setScalar(1 + .07 * wide + .09 * flinch);
  });

  // рот
  const open = clamp(talk / 1.2, 0, 1) * (1 - mouthO * .3) + mouthO * .35 + flinch * .12;
  headMesh.morphTargetInfluences[0] = clamp(open * .9 + groom * .15);
  const sm_ = smile - pout * .6;
  philtrum.position.set(0, .0055, .0002); philtrum.scale.set(1, .0035, 1);
  omega.forEach(({ s, pv, arc }) => {
    pv.position.set(0, .0038 + pout * .0005, 0);
    pv.rotation.set(0, 0, -s * (sm_ * .35));
    arc.scale.set(1 + sm_ * .2 - pout * .25, 1 + sm_ * .1, 1);
  });
  const w = .0075 + .004 * clamp(talk) + .003 * smile - .003 * mouthO - .002 * pout, h = .0015 + .0105 * open;
  cavity.visible = tongue.visible = open > .02;
  cavity.scale.set(w, h * .5, .004); cavity.position.set(0, .0005 - h * .5, -.001);
  tongue.scale.set(w * .62, Math.max(h * .2, .001), .0035); tongue.position.set(0, -h * .78 + .0004, .0006 + groom * .003);
  fangs.forEach(({ s, f }) => { f.visible = open > .25; f.position.set(s * w * .5, -.0009, .0016); });
  if (groom > .3) { tongue.visible = true; tongue.scale.set(.0035, .0045 * groom, .002); tongue.position.set(0, -.006 - .002 * Math.sin(t * 9), .003); }
  whiskers.rotation.set(-talk * .05 + Math.sin(t * 1.7) * .01 - smile * .04, 0, 0);

  // уши
  const tw = earTwitch * Math.pow(Math.max(0, Math.sin(t * 2.3)), 16) * Math.sin(t * 38);
  ears.forEach(({ s, base }) => {
    const down = earDown + (cover * (s === cs ? .7 : 0)) + tuck * .3 + lie * .25;
    const bk = earBack + flinch * .9 + shiver * .1;
    base.rotation.set(-.08 - bk * .7 + earPerk * .12 + down * .25, s * (.32 + bk * .4 - earPerk * .1), -s * (.3 + down * .8 + bk * .25 - earPerk * .15) + tw * .25);
    base.scale.setScalar(1 + earPerk * .05);
  });

  body.updateMatrix(); neck.updateMatrix(); head.updateMatrix();
  group.updateMatrixWorld(true);
  const toLocal = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const headInGroup = m => V().setFromMatrixPosition(tmpM.multiplyMatrices(toLocal, m.matrixWorld));
  headPos.copy(headInGroup(head));

  // ——— передние лапы ———
  const L1 = .056, L2 = .05;
  ['L', 'R'].forEach(side => {
    const s = side === 'L' ? 1 : -1, tb = legs['F' + side];
    const S = bodyPt(s * .029, .118, .026);
    // по умолчанию: лапка стоит перед собой
    let paw = V(s * .03 + shv * .001, .03, .072 + flinch * -.01);
    let toe = V(0, -.012, .016);  // от запястья к кончику лапы
    const L = ss(lie);
    if (L > 0) { paw.lerp(V(s * .03, .03, .14), L); }
    if (tuck > 0) { paw.lerp(V(s * .022, .03, .045), tuck); toe.lerp(V(0, -.012, .008), tuck); }
    if (proud > 0) paw.lerp(V(s * .028, .03, .068), proud);
    if (rub > 0) {
      const ph = Math.sin(t * 9 + (s > 0 ? 0 : Math.PI));
      paw.lerp(V(s * .011 + ph * .006, .105 + ph * .006 * s, .085), rub);
      toe.lerp(V(-s * .008, .012, .006), rub);
    }
    if (groom > 0 && s === -1) {
      const mp = headInGroup(mouth).add(V(0, -.012 + Math.sin(t * 9) * .003, .016));
      paw.lerp(mp, groom); toe.lerp(V(.004, .012, -.006), groom);
    }
    if (cover > 0 && s === cs) {
      const ep = headInGroup(ears[cs === 1 ? 0 : 1].base).add(V(s * .004, .012, .01));
      paw.lerp(ep, cover); toe.lerp(V(-s * .01, .004, .012), cover);
    }
    if (rk > 0 && s === rs) {
      paw.lerp(rAt.clone().sub(rAt.clone().sub(S).normalize().multiplyScalar(.012)), ss(rk));
      toe.lerp(rAt.clone().sub(S).normalize().multiplyScalar(.016), ss(rk));
    }
    const hint = V(s * .3, -.2, -1).applyMatrix3(new THREE.Matrix3().setFromMatrix4(body.matrix)).normalize();
    const { E, W } = ik2(S, paw, L1, L2, hint, 1.55);
    const T = W.clone().add(toe);
    tb.update([S.clone().add(V(0, .02, -.01).applyMatrix3(new THREE.Matrix3().setFromMatrix4(body.matrix))), S, E, W, T], V(0, 0, 1));
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
    if (rk > 0) foot.add(V(rs * .02 * rk, 0, 0));
    tb.update([hip, hock, foot.clone().add(V(0, 0, -.015)), foot], V(0, 1, 0));
  });
  // ——— хвост ———
  {
    const base = bodyPt(0, .03, -.062), ph = t * (1 + tailSwish * 3);
    const sw = Math.sin(ph) * (.25 + tailSwish * .6);
    const rest = [base, bodyPt(.02, .012, -.095), V(.075 + sw * .01, .012, -.085), V(.105 + sw * .015, .013, -.02), V(.09 + sw * .03, .015, .05 + sw * .01)];
    const up = [base, bodyPt(0, .06, -.1), bodyPt(.005 + sw * .01, .14, -.115), bodyPt(.02 + sw * .03, .2, -.1), bodyPt(.05 + sw * .05, .215, -.07)];
    const tuckP = [base, bodyPt(.03, .012, -.08), V(.07, .012, -.03), V(.06, .012, .04), V(.01, .014, .07)];
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

const _v = new THREE.Vector3();
export const plush = {
  group, pose,
  headWorld: () => head.localToWorld(V(0, 0, 0)),
  pawWorld: (side = 'R') => group.localToWorld(paws[side === 'L' ? 'L' : 'R'].clone()),
  // для отладки/настройки
  rig: { setShells, body, neck, head, eyes, ears, mouth, legs, tail, FU, headMesh, bodyMesh },
};
pose(0, {});
