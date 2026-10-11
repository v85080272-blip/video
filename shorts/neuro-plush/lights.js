// Свет гостиной: тёплый торшер слева (ключ, тени), холодное окно спереди, контровой сзади-справа, мягкий заполняющий.
import { THREE, scene, V } from './core.js';
export const SEAT_Y = .45;   // верх подушек дивана
export const lampPos = V(-1.25, 1.5, .25);
export const key = new THREE.SpotLight(0xffb066, 13, 0, .95, .85, 1.6);
key.position.copy(lampPos); key.target.position.set(.15, .55, .1); key.castShadow = true;
key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -.0003; key.shadow.normalBias = .015; key.shadow.radius = 6; key.shadow.camera.near = .2; key.shadow.camera.far = 8;
scene.add(key, key.target);
export const lampGlow = new THREE.PointLight(0xffa860, 2.2, 4, 1.8); lampGlow.position.copy(lampPos).add(V(0, .15, 0)); scene.add(lampGlow);
export const windowFill = new THREE.DirectionalLight(0x8aa8ff, .28); windowFill.position.set(.6, 1.6, 5); scene.add(windowFill);
export const faceFill = new THREE.DirectionalLight(0xffd6b5, .4); faceFill.position.set(-.4, 1.2, 4); scene.add(faceFill);
export const rim = new THREE.DirectionalLight(0xa9c6ff, 1.25); rim.position.set(1.6, 2.2, -1.4); scene.add(rim);
export const hemi = new THREE.HemisphereLight(0xffd8b8, 0x2a1c16, .2); scene.add(hemi);
