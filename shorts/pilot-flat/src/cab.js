// The cockpit, cut open from the side: the armoured door in the back wall (drawn face on, the cartoon way), Пурга's jump
// seat in front of it, the captain's seat, the yoke, the pedestal with the door lock switch, the instrument panel under
// the windshield, and the door camera's little screen on the panel. World units: the floor is at y = 0, the nose to +x.
import { lerp, clamp, ease, hash, noise, TAU, rgba, mix } from './lib.js';
import { g, W, H, ell, limb, rect, rrect, poly, fill, smoothPath, polyPath, rrPath, inside } from './flat.js';
import { view, toScreen, scaleOf } from './camera.js';
import { SKY, cloud, paw } from './sky.js';

export const CAB = {
  wall: '#3c4458', wallSh: '#2e3546', wallHi: '#4b556c', floor: '#262b38', panel: '#2b303c', panelHi: '#3a4150', glare: '#1b1f28',
  door: '#7b8798', doorSh: '#5f6a7b', doorHi: '#96a2b3', rivet: '#4b5566', seat: '#3f5a8a', seatSh: '#30476e', seatHi: '#5374aa',
  screen: '#0d1220', sky: '#3e7be0', ground: '#8a5a3a', magenta: '#ff4fd8', green: '#3ddc84', amber: '#ffb84d', red: '#ff4d4d',
};
export const DOOR = { x0: -620, x1: -360, top: -640 };
export const JUMP = { x: -230, y: -150 };                // the dog's jump seat (her floor point)
export const SEAT = { x: 60, hip: [92, -122], feet: [232, 0] };
export const LOCKSW = [268, -282];                       // the lock switch on the pedestal
export const MON = { x: 352, y: -560, w: 150, h: 112 };  // the door camera's screen (top left corner)
export const YOKE = [196, -262];
const WIND = [[430, -760], [660, -760], [880, -420], [560, -420]];

// the view through the windshield: the sky in flight (clouds sliding back), or the airfield on the ground
function outside(t, o) {
  const pts = WIND, p = polyPath(pts);
  inside(p, () => {
    const gr = g.createLinearGradient(0, -760, 0, -420);
    if (o.view === 'ground') { gr.addColorStop(0, '#7fb6e8'); gr.addColorStop(1, '#ffd9a8'); }
    else { gr.addColorStop(0, SKY.mid); gr.addColorStop(0.7, SKY.low); gr.addColorStop(1, SKY.hor); }
    g.fillStyle = gr; g.fillRect(400, -800, 520, 420);
    if (o.view === 'ground') {
      for (let i = 0; i < 9; i++) { const x = 420 + i * 60 + 20 * hash(i); poly([[x - 26, -470], [x, -560 - 30 * hash(i * 3)], [x + 26, -470]], '#2f5a4e'); }
      rect(400, -475, 520, 60, '#5d8a3e'); rect(400, -462, 520, 20, '#3a3d4a');
    } else {
      const sp = (t * 220) % 600;
      for (let i = -1; i < 3; i++) cloud(900 - sp + i * 600, -520 + 40 * Math.sin(i * 2.1), 320, 0.55);
      for (let i = 0; i < 6; i++) { const u = (t * 2.8 + i / 6) % 1; rect(900 - u * 600, -700 + 50 * i, 70, 3, rgba('#ffffff', 0.4 * Math.sin(Math.PI * u))); }
    }
    // a light glare on the glass
    poly([[470, -760], [520, -760], [640, -420], [590, -420]], 'rgba(255,255,255,0.10)');
  });
}

export function draw(t, o = {}) {
  // back wall, ceiling, floor
  rect(-1400, -1100, 2600, 1100, CAB.wall);
  rect(-1400, -1100, 2600, 300, CAB.wallSh);
  for (let x = -1400; x < 1200; x += 220) rect(x, -800, 8, 800, CAB.wallSh);
  rect(-1400, 0, 2600, 400, CAB.floor);
  rect(-1400, 0, 2600, 14, '#3a4152');
  // the overhead panel: rows of switches and little lights
  fill(polyPath([[-100, -800], [520, -800], [440, -720], [-100, -720]]), CAB.panel);
  for (let i = 0; i < 9; i++) for (let j = 0; j < 2; j++) { const x = -60 + i * 56 + j * 10, y = -780 + j * 32; rect(x, y, 30, 14, CAB.panelHi); ell(x + 15, y + 7, 4, 4, (i + j) % 4 === 0 ? CAB.amber : '#6b7489'); }
  // the nose: windshield frame, glass, the view, the glare shield and the panel
  fill(polyPath([[400, -800], [1200, -800], [1200, 0], [640, 0], [700, -300], [880, -400], [560, -400]]), CAB.wallSh);
  outside(t, o);
  limb([[430, -760], [560, -420]], 26, CAB.glare, false);
  limb([[660, -760], [880, -420]], 22, CAB.glare, false);
  fill(polyPath([[330, -430], [900, -430], [900, -380], [330, -390]]), CAB.glare);
  fill(polyPath([[340, -392], [880, -380], [820, -150], [380, -160]]), CAB.panel);
  screens(t, o);
  // the pedestal and the lock switch on it
  fill(polyPath([[220, -330], [380, -330], [430, 0], [200, 0]]), CAB.panel);
  rect(226, -328, 150, 8, CAB.panelHi);
  for (let i = 0; i < 3; i++) { rect(312 + i * 22, -230, 12, 70, '#1a1d26'); rect(312 + i * 22, -205 + 10 * Math.sin(i), 12, 16, '#c7d0dc'); }
  lockSwitch(o.lock ?? 0.5, o.lockLight ?? 0);
  // the door, the jump seat
  door(t, o);
  jumpSeat();
}
// the panel's displays: an attitude ball, a map with the magenta route, the engine dials, the door camera screen
function screens(t, o) {
  const roll = o.roll ?? 0.04 * Math.sin(t * 0.7), pitch = o.pitch ?? 0;
  rrect(440, -370, 120, 110, 8, CAB.screen);
  g.save(); g.beginPath(); g.rect(446, -364, 108, 98); g.clip(); g.translate(500, -315 + pitch * 60); g.rotate(roll);
  rect(-120, -120, 240, 120, CAB.sky); rect(-120, 0, 240, 120, CAB.ground); rect(-120, -2, 240, 4, '#ffffff'); g.restore();
  limb([[478, -315], [492, -315], [500, -305], [508, -315], [522, -315]], 5, CAB.amber, false);
  rrect(580, -370, 120, 110, 8, CAB.screen);
  g.save(); g.beginPath(); g.rect(586, -364, 108, 98); g.clip();
  g.lineWidth = 2; g.strokeStyle = '#4b5566'; for (let r = 30; r < 120; r += 30) { g.beginPath(); g.arc(640, -270, r, Math.PI, TAU); g.stroke(); }
  limb([[640, -280], [655, -320], [690, -360]], 4, CAB.magenta, false); poly([[633, -286], [647, -286], [640, -300]], '#ffffff');
  g.restore();
  for (let i = 0; i < 2; i++) { ell(730 + i * 50, -330, 20, 20, CAB.screen); limb([[730 + i * 50, -330], [730 + i * 50 + 14 * Math.cos(-0.6 + 0.2 * Math.sin(t * 2 + i)), -330 + 14 * Math.sin(-0.6)]], 3, CAB.green, false); }
  for (let i = 0; i < 6; i++) ell(450 + i * 40, -220, 7, 7, (i * 7 + Math.floor(t * 2)) % 5 === 0 ? CAB.amber : '#4b5566');
  // the door camera on its own arm at the top left of the panel, facing us
  limb([[MON.x + MON.w * 0.6, MON.y + MON.h], [MON.x + MON.w * 0.7, -420]], 14, CAB.glare, false);
  monitor(t, o);
}
// the door camera's screen: what stands outside the door, or nothing
export function monitor(t, o = {}, M = MON) {
  rrect(M.x - 10, M.y - 10, M.w + 20, M.h + 20, 10, '#14171f');
  const p = rrPath(M.x, M.y, M.w, M.h, 4);
  fill(p, '#26324a');
  inside(p, () => {
    rect(M.x, M.y + M.h * 0.62, M.w, M.h, '#3a4766');                          // the galley floor
    rect(M.x + M.w * 0.7, M.y, M.w * 0.3, M.h, '#2f3c58');                      // the galley wall
    if (o.cam) o.cam(M);                                                        // who stands there
    for (let y = M.y; y < M.y + M.h; y += 6) rect(M.x, y, M.w, 2, 'rgba(0,0,0,0.18)');   // scan lines
    rect(M.x, M.y, M.w, M.h, 'rgba(120,255,170,0.10)');
  });
  ell(M.x + 12, M.y + 12, 4, 4, (t % 1) < 0.5 ? CAB.red : '#5a2020');
  g.font = '700 14px MonoBold'; g.textAlign = 'left'; g.fillStyle = '#b8ffd0'; g.fillText('CAM 1', M.x + 22, M.y + 17);
}
// the lock switch: three positions ОТКР · НОРМ · ЗАКР; pos 0…1 (0.5 = НОРМ, 1 = ЗАКР); a green light when locked
export function lockSwitch(pos, light, x = LOCKSW[0], y = LOCKSW[1], s = 1) {
  rrect(x - 44 * s, y - 34 * s, 88 * s, 68 * s, 8 * s, '#1a1d26');
  rect(x - 30 * s, y - 4 * s, 60 * s, 8 * s, '#4b5566');
  const kx = x + lerp(-26, 26, pos) * s;
  limb([[x, y + 10 * s], [kx, y - 14 * s]], 9 * s, '#c7d0dc', false);
  ell(kx, y - 16 * s, 8 * s, 8 * s, '#ffffff');
  ell(x + 30 * s, y + 22 * s, 6 * s, 6 * s, light > 0.5 ? CAB.green : '#2a4a36');
  if (light > 0.5) ell(x + 30 * s, y + 22 * s, 16 * s, 16 * s, rgba(CAB.green, 0.35));
}
// the armoured door: heavy plates, rivets, a peephole camera, a handle, a red sign; it jumps a little at every knock
function door(t, o) {
  const sh = o.doorShake ?? 0, dx = sh * 10 * Math.sin(t * 90), { x0, x1, top } = DOOR;
  rect(x0 - 26, top - 26, x1 - x0 + 52, -top + 26, CAB.wallSh);
  g.save(); g.translate(dx, 0);
  rect(x0, top, x1 - x0, -top, CAB.door);
  rect(x0, top, 16, -top, CAB.doorHi); rect(x1 - 18, top, 18, -top, CAB.doorSh);
  for (const y of [top + 120, top + 330, -110]) { rect(x0 + 24, y, x1 - x0 - 48, 70, CAB.doorSh); for (let i = 0; i < 5; i++) ell(x0 + 44 + i * (x1 - x0 - 88) / 4, y + 35, 7, 7, CAB.rivet); }
  ell((x0 + x1) / 2, top + 70, 22, 22, '#1a1d26'); ell((x0 + x1) / 2, top + 70, 10, 10, '#3b8eea');
  rrect(x1 - 70, -330, 46, 26, 8, '#c7d0dc'); rect(x1 - 56, -320, 10, 50, '#9aa6b8');
  rrect(x0 + 40, top + 230, 120, 50, 6, '#d9433b');
  g.font = '700 26px Oswald'; g.textAlign = 'center'; g.fillStyle = '#fff3d6'; g.fillText('КАБИНА', x0 + 100, top + 264);
  // the bolts in the frame: they shoot out when the lock goes to ЗАКР
  const b = clamp(o.bolts ?? 0);
  for (const y of [top + 80, -300, -80]) rect(x1 - 6, y, 40 * b + 6, 22, '#c7d0dc');
  g.restore();
}
function jumpSeat() {
  const { x, y } = JUMP;
  rrect(x - 130, y - 10, 230, 40, 14, CAB.seatSh);
  rect(x - 110, y + 30, 20, -y - 30, '#1a1d26');
  rrect(x - 170, y - 300, 60, 300, 20, CAB.seat);
}
// the captain's seat: drawn before him (the back and the cushion), the armrest after him
export function seatBack() {
  const { x } = SEAT;
  rrect(x - 140, -500, 110, 460, 40, CAB.seatSh);
  rrect(x - 130, -560, 92, 110, 30, CAB.seat);
  rrect(x - 150, -130, 280, 60, 24, CAB.seat);
  rect(x - 20, -70, 40, 70, '#1a1d26'); rect(x - 120, -14, 240, 14, '#1a1d26');
  fill(rrPath(x - 128, -480, 84, 380, 30), CAB.seatHi);
}
export function seatFront() {
  const { x } = SEAT;
  rrect(x - 60, -240, 170, 30, 12, CAB.seatSh);
}
// the yoke: a column from the floor and the horns, turned by roll
export function yoke(t, roll = 0, pull = 0) {
  const [x, y] = YOKE, top = [x - 30 * pull, y];
  limb([[x + 70, 0], [x + 40, -120], top], 30, '#1a1d26', false);
  g.save(); g.translate(top[0], top[1]); g.rotate(roll);
  rrect(-20, -60, 40, 120, 14, '#2b2f3a');
  rrect(-14, -66, 28, 30, 10, '#4a5163'); rrect(-14, 36, 28, 30, 10, '#4a5163');
  g.restore();
}
