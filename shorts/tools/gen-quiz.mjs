import { writeFileSync } from 'node:fs';
import { fontsCss } from './fonts.css.mjs';
const dir = process.argv[2];
const L = [
  { emo: ['🦁', '👑', '🌅'], ans: 'Король Лев', diff: 'ЛЕГКО', bg: ['#ff9a3c', '#ff4f6d'] },
  { emo: ['👸', '❄️', '⛄'], ans: 'Холодное сердце', diff: 'ЛЕГКО', bg: ['#4fc3ff', '#5b5bff'] },
  { emo: ['👧', '🐻', '🍯'], ans: 'Маша и Медведь', diff: 'СРЕДНЕ', bg: ['#ff6fb1', '#a24bff'] },
  { emo: ['🦔', '🌫️', '🐴'], ans: 'Ёжик в тумане', diff: 'СЛОЖНО', bg: ['#3a4b8f', '#1b1f4a'] },
  { emo: ['🐍', '🦜', '🐘', '🐒'], ans: '38 попугаев', diff: 'ГЕНИЙ', bg: ['#1fd18a', '#0b7a6a'] },
];
const HOOK = 2.4, LEV = 4.2, END = 3.0;
const total = HOOK + L.length * LEV + END;
const ev = [[0.05, 'pop'], [0.5, 'pop'], [1.1, 'blip']];
let scenes = '', js = '';
L.forEach((l, i) => {
  const s = HOOK + i * LEV, id = `l${i}`;
  ev.push([s, 'whoosh']);
  l.emo.forEach((_, j) => ev.push([s + 0.25 + j * 0.16, 'pop']));
  ev.push([s + 1.0, 'tick'], [s + 1.8, 'tock'], [s + 2.6, 'tick'], [s + 3.3, 'ding']);
  scenes += `
  <section id="${id}" class="clip scene" data-start="${s}" data-duration="${LEV}" data-track-index="1" style="background:linear-gradient(160deg,${l.bg[0]},${l.bg[1]})">
    <div class="top"><div class="kicker">УГАДАЙ МУЛЬТФИЛЬМ</div>
      <div class="dots">${L.map((_, k) => `<i class="${k < i ? 'done' : k === i ? 'now' : ''}"></i>`).join('')}</div>
      <div class="lvl">Уровень ${i + 1} · <b>${l.diff}</b></div></div>
    <div class="emo">${l.emo.map(e => `<span>${e}</span>`).join('')}</div>
    <div class="timer"><svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="86" class="trk"/><circle cx="100" cy="100" r="86" class="arc"/></svg>
      <b class="n n3">3</b><b class="n n2">2</b><b class="n n1">1</b></div>
    <div class="ans">${l.ans}</div>
  </section>`;
  js += `
  tl.fromTo('#${id} .top',{y:-60,opacity:0},{y:0,opacity:1,duration:.4,ease:'power3.out'},${s});
  tl.fromTo('#${id} .emo span',{scale:0,rotation:-25},{scale:1,rotation:0,duration:.5,ease:'back.out(2.2)',stagger:.16},${s + 0.2});
  tl.to('#${id} .emo span',{y:-18,duration:.5,yoyo:true,repeat:5,ease:'sine.inOut',stagger:.12},${s + 0.8});
  tl.fromTo('#${id} .timer',{scale:.4,opacity:0},{scale:1,opacity:1,duration:.35,ease:'back.out(2)'},${s + 0.75});
  tl.fromTo('#${id} .arc',{strokeDashoffset:0},{strokeDashoffset:540,duration:2.4,ease:'none'},${s + 0.9});
  ${[3, 2, 1].map((n, k) => `tl.fromTo('#${id} .n${n}',{opacity:0,scale:1.6},{opacity:1,scale:1,duration:.2},${s + 1.0 + k * 0.8}); tl.to('#${id} .n${n}',{opacity:0,duration:.15},${s + 1.0 + k * 0.8 + 0.65});`).join('\n  ')}
  tl.to('#${id} .timer',{scale:0,opacity:0,duration:.2},${s + 3.25});
  tl.fromTo('#${id} .ans',{scale:.3,opacity:0,rotation:-6},{scale:1,opacity:1,rotation:-2,duration:.45,ease:'back.out(2.5)'},${s + 3.3});
  tl.fromTo('#${id} .emo',{scale:1},{scale:.82,duration:.4,ease:'power2.out'},${s + 3.3});`;
});
const es = HOOK + L.length * LEV;
ev.push([es, 'fanfare']);
const html = `<!doctype html>
<html lang="ru" data-resolution="portrait">
<head><meta charset="UTF-8"><meta name="viewport" content="width=1080, height=1920">
<script src="assets/gsap.min.js"></script>
<style>
${fontsCss}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1920px;overflow:hidden;background:#111}
#root{position:relative;width:1080px;height:1920px;font-family:Rubik,'DejaVu Sans',sans-serif;color:#fff}
.scene{position:absolute;inset:0;overflow:hidden}
.top{position:absolute;top:210px;left:0;right:0;display:flex;flex-direction:column;align-items:center;gap:26px}
.kicker{font:900 56px/1 Unbounded,Rubik,sans-serif;letter-spacing:.01em;text-shadow:0 6px 0 rgba(0,0,0,.18)}
.dots{display:flex;gap:18px}.dots i{width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,.3)}
.dots i.done{background:#fff}.dots i.now{background:#ffe14d;box-shadow:0 0 0 7px rgba(255,225,77,.35)}
.lvl{font:700 46px Rubik,sans-serif;background:rgba(0,0,0,.22);padding:12px 34px;border-radius:999px}.lvl b{color:#ffe14d;font-weight:900}
.emo{position:absolute;top:720px;left:0;right:0;display:flex;justify-content:center;gap:24px;font-size:200px;line-height:1;font-family:'Noto Color Emoji',sans-serif}
.emo span{display:inline-block;filter:drop-shadow(0 18px 18px rgba(0,0,0,.25))}
.timer{position:absolute;top:1140px;left:440px;width:200px;height:200px}
.timer svg{position:absolute;inset:0;transform:rotate(-90deg)}
.trk{fill:rgba(0,0,0,.2);stroke:rgba(255,255,255,.25);stroke-width:14}.arc{fill:none;stroke:#ffe14d;stroke-width:14;stroke-linecap:round;stroke-dasharray:540}
.n{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:900 110px/1 Unbounded,Rubik,sans-serif;opacity:0}
.ans{position:absolute;top:1150px;left:60px;right:60px;text-align:center;font:900 92px/1.1 Unbounded,Rubik,sans-serif;color:#1a1a1a;background:#ffe14d;padding:36px 30px;border-radius:40px;box-shadow:0 14px 0 rgba(0,0,0,.2);opacity:0}
#hook{background:radial-gradient(circle at 50% 40%,#ff5aa5,#6a2bff 70%)}
#hook .big{position:absolute;top:470px;left:40px;right:40px;text-align:center;font:900 100px/1.05 Unbounded,Rubik,sans-serif;text-shadow:0 10px 0 rgba(0,0,0,.2)}
#hook .em{position:absolute;top:1010px;left:0;right:0;text-align:center;font-size:170px;font-family:'Noto Color Emoji',sans-serif}
#hook .sub{position:absolute;top:1290px;left:0;right:0;text-align:center;font:900 70px Rubik,sans-serif}
#hook .sub b{background:#ffe14d;color:#1a1a1a;padding:4px 22px;border-radius:18px}
#end{background:radial-gradient(circle at 50% 45%,#ffb13b,#ff3d6e 75%)}
#end .q{position:absolute;top:520px;left:60px;right:60px;text-align:center;font:900 112px/1.08 Unbounded,Rubik,sans-serif;text-shadow:0 10px 0 rgba(0,0,0,.18)}
#end .score{position:absolute;top:930px;left:0;right:0;display:flex;justify-content:center;gap:22px}
#end .score b{width:150px;height:150px;border-radius:36px;background:#fff;color:#ff3d6e;display:flex;align-items:center;justify-content:center;font:900 90px Unbounded,Rubik,sans-serif;box-shadow:0 12px 0 rgba(0,0,0,.18)}
#end .cta{position:absolute;top:1200px;left:60px;right:60px;text-align:center;font:700 64px/1.25 Rubik,sans-serif}
</style></head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="${total}" data-width="1080" data-height="1920">
  <audio id="sfx" src="assets/sfx.wav" data-start="0" data-duration="${total}" data-track-index="9"></audio>
  <section id="hook" class="clip scene" data-start="0" data-duration="${HOOK}" data-track-index="1">
    <div class="big">УГАДАЙ<br>МУЛЬТФИЛЬМ<br>ПО ЭМОДЗИ</div>
    <div class="em">🤔🎬</div>
    <div class="sub">все 5 угадают <b>3%</b></div>
  </section>${scenes}
  <section id="end" class="clip scene" data-start="${es}" data-duration="${END}" data-track-index="1">
    <div class="q">СКОЛЬКО<br>УГАДАЛ?</div>
    <div class="score">${[1, 2, 3, 4, 5].map(n => `<b>${n}</b>`).join('')}</div>
    <div class="cta">Пиши цифру в комментах 👇<br>и отметь друга, который не угадает</div>
  </section>
</div>
<script>
  window.__timelines = window.__timelines || {};
  const tl = gsap.timeline({ paused: true });
  tl.fromTo('#hook .big',{scale:2.2,opacity:0},{scale:1,opacity:1,duration:.45,ease:'power4.out'},0);
  tl.fromTo('#hook .em',{y:200,opacity:0},{y:0,opacity:1,duration:.4,ease:'back.out(2)'},.45);
  tl.fromTo('#hook .sub',{scale:0},{scale:1,duration:.35,ease:'back.out(3)'},1.05);
  tl.to('#hook .big',{scale:1.05,duration:.6,yoyo:true,repeat:1,ease:'sine.inOut'},1.1);
  ${js}
  tl.fromTo('#end .q',{scale:2,opacity:0},{scale:1,opacity:1,duration:.4,ease:'power4.out'},${es});
  tl.fromTo('#end .score b',{y:120,opacity:0},{y:0,opacity:1,duration:.35,ease:'back.out(2.5)',stagger:.1},${es + 0.35});
  tl.fromTo('#end .cta',{opacity:0,y:40},{opacity:1,y:0,duration:.4},${es + 0.9});
  tl.to('#end .score b',{y:-20,duration:.3,yoyo:true,repeat:3,stagger:.08,ease:'sine.inOut'},${es + 1.3});
  window.__timelines["main"] = tl;
  tl.seek(0);
</script>
</body></html>`;
writeFileSync(`${dir}/index.html`, html);
writeFileSync(`${dir}/events.json`, JSON.stringify(ev));
console.log('total', total);
