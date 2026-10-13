// Общая основа «Ты думаешь или зависла?»: рендерер, сцена, камера, помощники. Метры, Y вверх, пол y = 0.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export const W = 1080, H = 1920;
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const seg = (t, a, b) => clamp((t - a) / (b - a));
export const ss = k => k * k * (3 - 2 * k);
export const eio = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
export const eo = k => 1 - Math.pow(1 - k, 3);
export const back = k => { const c = 2.2; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
export const spring = k => k <= 0 ? 0 : 1 - Math.exp(-7 * k) * Math.cos(11 * k);
export const bump = (t, a, b) => Math.sin(seg(t, a, b) * Math.PI);   // 0 → 1 → 0 на отрезке
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
export const camera = new THREE.PerspectiveCamera(35, W / H, .03, 80);
scene.add(camera);
// мягкие отражения «студии» для PBR-материалов
{ const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), .04).texture; scene.environmentIntensity = .14; }

export const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .55, ...o });
export const canvasTex = (w, h, draw, rep = [1, 1]) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); t.anisotropy = 8; return t; };
export const sph = (r, m, ws = 32, hs = 22) => { const o = new THREE.Mesh(new THREE.SphereGeometry(r, ws, hs), m); o.castShadow = o.receiveShadow = true; return o; };
const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 14);
// цилиндр радиуса r от точки a до точки b (в координатах родителя)
export function setRod(o, a, b, r) { o.position.copy(a).add(b).multiplyScalar(.5); o.scale.set(r, Math.max(a.distanceTo(b), 1e-4), r); o.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize()); }
export const rod = m => { const o = new THREE.Mesh(cylGeo, m); o.castShadow = true; return o; };
// капсула от a до b: цилиндр + две сферы, для лап и рук
export function makeLimb(m, r) { const g = new THREE.Group(), c = rod(m), s1 = sph(1, m, 16, 12), s2 = sph(1, m, 16, 12); g.add(c, s1, s2); g.userData = { c, s1, s2, r }; return g; }
export function setLimb(g, a, b, r = g.userData.r) { const { c, s1, s2 } = g.userData; setRod(c, a, b, r); s1.position.copy(a); s2.position.copy(b); s1.scale.setScalar(r); s2.scale.setScalar(r); }
export { THREE };
