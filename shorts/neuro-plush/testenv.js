// Временная обстановка для проверки персонажей: пол, стена, простой диван и тот же свет, что в фильме.
import { THREE, scene, M, V } from './core.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { SEAT_Y } from './lights.js';
scene.background = new THREE.Color(0x2a1d18);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), M(0x6b4a33, { roughness: .8 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const wall = new THREE.Mesh(new THREE.PlaneGeometry(12, 5), M(0xc9a88a, { roughness: .95 })); wall.position.set(0, 2.5, -.75); wall.receiveShadow = true; scene.add(wall);
const sofaM = M(0x5d7f8f, { roughness: .9 });
const box = (w, h, d, x, y, z, r = .06) => { const o = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, r), sofaM); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; scene.add(o); return o; };
box(1.7, .3, .62, 0, .15 + .02, .02, .05);                 // основание
[-.4, .4].forEach(x => box(.8, .14, .6, x, SEAT_Y - .07, .04, .06));   // подушки сиденья, верх = SEAT_Y
box(1.7, .5, .2, 0, .62, -.3, .08);                       // спинка
[-.92, .92].forEach(x => box(.2, .34, .66, x, .45, .02, .08));   // подлокотники
