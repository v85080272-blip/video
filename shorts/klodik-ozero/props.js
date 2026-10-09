// Реквизит: удочки с поплавком, рыбы трёх размеров, камешки, всплески.
import * as THREE from 'three';
import { scene, M, sph, rod, setRod, V, mat } from './scene.js';

// удочка: удилище от рукояти к кончику, леска к поплавку
export function makeRod(len = 1.2, color = 0x8a5a2b) {
  const g = new THREE.Group(); scene.add(g);
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(.006, .016, 1, 8), M(color, { roughness: .5 })); stick.castShadow = true; g.add(stick);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, .14, 10), M(0x2a2a2a, { roughness: .7 })); g.add(grip);
  const reel = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .025, 16), M(0xd0d0d0, { metalness: .6, roughness: .3 })); reel.rotation.z = Math.PI / 2; g.add(reel);
  const line = rod(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .7 })); line.castShadow = false; scene.add(line);
  const bob = new THREE.Group(); scene.add(bob);
  const top = sph(.03, M(0xff3040, { roughness: .3 }), 14, 10); top.position.y = .012; bob.add(top);
  const bot = sph(.03, M(0xffffff, { roughness: .3 }), 14, 10); bot.position.y = -.012; bot.scale.y = .8; bob.add(bot);
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(.004, .004, .05, 6), M(0xff3040)); ant.position.y = .05; bob.add(ant);
  return { g, stick, grip, reel, line, bob, len };
}
// hand — точка рукояти, dir — направление удилища (мировые координаты), bobber — позиция поплавка
export function poseRod(r, hand, dir, bobber, bend = 0) {
  const d = dir.clone().normalize(), tip = hand.clone().add(d.clone().multiplyScalar(r.len)).add(V(0, -bend * r.len * .25, 0));
  setRod(r.stick, hand, tip, 1); r.stick.scale.x = r.stick.scale.z = 1;
  r.grip.position.copy(hand).add(d.clone().multiplyScalar(-.03)); r.grip.quaternion.copy(r.stick.quaternion);
  r.reel.position.copy(hand).add(d.clone().multiplyScalar(.08)).add(V(0, -.035, 0));
  if (bobber) { r.bob.visible = r.line.visible = true; r.bob.position.copy(bobber); setRod(r.line, tip, bobber.clone().add(V(0, .07, 0)), .0025); }
  else r.bob.visible = r.line.visible = false;
  return tip;
}

// рыба: тело-эллипсоид, хвост, плавник, глаз
export function makeFish(color = 0x6fb7ff, belly = 0xfff3d0) {
  const g = new THREE.Group(); scene.add(g);
  const body = sph(.1, M(color, { roughness: .35, metalness: .15 }), 28, 18); body.scale.set(1.6, 1, .6); g.add(body);
  const bel = sph(.085, M(belly, { roughness: .5 }), 20, 12); bel.scale.set(1.5, .7, .5); bel.position.y = -.025; g.add(bel);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(.08, .12, 4), M(color, { roughness: .4 })); tail.rotation.z = Math.PI / 2; tail.scale.z = .25; tail.position.x = -.19; g.add(tail);
  const fin = new THREE.Mesh(new THREE.ConeGeometry(.04, .08, 3), M(color, { roughness: .4 })); fin.position.set(0, .1, 0); fin.scale.z = .25; g.add(fin);
  [-1, 1].forEach(s => { const e = sph(.022, mat.white, 12, 8); e.position.set(.1, .025, s * .045); g.add(e); const p = sph(.012, mat.pupil, 10, 6); p.position.set(.11, .026, s * .058); g.add(p); });
  const lips = sph(.02, M(0xff8a9a, { roughness: .4 }), 10, 8); lips.position.set(.16, -.01, 0); lips.scale.set(.6, 1, 1.2); g.add(lips);
  g.userData = { tail, fin };
  return g;
}
export function wiggleFish(f, t, amt = 1) { f.userData.tail.rotation.y = Math.sin(t * 18) * .5 * amt; f.rotation.y += 0; }

// камешек для «блинчиков»
export function makeStone(s = 1) { const o = sph(.05 * s, M(0x8d8a86, { roughness: .9 }), 14, 10); o.scale.y = .35; scene.add(o); return o; }

// всплеск: кольцо брызг (капли летят вверх и падают)
export function makeSplash(n = 22, color = 0xdff4ff) {
  const g = new THREE.Group(); scene.add(g);
  const m = new THREE.MeshStandardMaterial({ color, roughness: .1, transparent: true, opacity: .85, emissive: 0x405060 });
  const drops = Array.from({ length: n }, (_, i) => { const d = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), m); g.add(d); return { d, a: i / n * Math.PI * 2 + Math.sin(i * 7.1) * .3, v: .9 + ((i * 37) % 10) / 10 * .9, s: .012 + ((i * 13) % 7) / 7 * .014 }; });
  const ring = new THREE.Mesh(new THREE.RingGeometry(.9, 1, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .6, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; g.add(ring);
  return { g, drops, ring, m };
}
// k — время с начала всплеска (с), size — масштаб
export function poseSplash(sp, at, k, size = 1) {
  sp.g.position.copy(at); const on = k >= 0 && k < 1.4; sp.g.visible = on; if (!on) return;
  sp.drops.forEach(({ d, a, v, s }) => { const r = k * .35 * v * size, y = (k * 2.2 * v - 4.9 * k * k) * size * .7; d.position.set(Math.cos(a) * r, Math.max(-.05, y), Math.sin(a) * r); d.scale.setScalar(s * size * (1 - k / 1.4)); d.visible = y > -.04; });
  sp.ring.scale.setScalar(.05 + k * .6 * size); sp.ring.material.opacity = .6 * (1 - k / 1.4);
}
