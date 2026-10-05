import { writeFileSync } from 'node:fs';
import { fontsCss } from './fonts.css.mjs';
const dir = process.argv[2];
const M = [
  ['ЯНВАРЬ', '⛄', 'Спит до обеда и всё равно прав', '#7fd3ff', '#2f6bff'],
  ['ФЕВРАЛЬ', '💘', 'Обижается молча, но очень красиво', '#ff9ec7', '#d6338a'],
  ['МАРТ', '🌷', 'Влюбляется каждую неделю', '#a8f07a', '#1fa36b'],
  ['АПРЕЛЬ', '🃏', 'Шутит даже когда не надо', '#ffd36b', '#ff7a2f'],
  ['МАЙ', '🚲', 'Опаздывает, но всегда с тортиком', '#c6a2ff', '#6a3cff'],
  ['ИЮНЬ', '🍓', 'Главный по шашлыкам и движу', '#ff8a8a', '#e0244f'],
  ['ИЮЛЬ', '🍉', 'Энергии на троих, денег на одного', '#ffe066', '#22b573'],
  ['АВГУСТ', '🍎', 'Тихий гений и мамин любимчик', '#ffb36b', '#d9480f'],
  ['СЕНТЯБРЬ', '📚', 'Составляет планы и не выполняет', '#f7c66b', '#a0522d'],
  ['ОКТЯБРЬ', '🍄', 'Плед, чай и «я никуда не пойду»', '#d9a36b', '#6b3a1f'],
  ['НОЯБРЬ', '☁️', 'Ворчит, но спасёт любого', '#a9b4c8', '#3c4660'],
  ['ДЕКАБРЬ', '🎄', 'Дарит подарки лучше всех', '#7ee0b0', '#0f6b4a'],
];
const HOOK = 2.6, C = 1.5, END = 3.2, total = +(HOOK + M.length * C + END).toFixed(2);
const ev = [[0.05, 'pop'], [0.55, 'pop'], [1.2, 'blip'], [1.8, 'blip']];
let cards = '', js = '';
M.forEach(([name, emo, trait, a, b], i) => {
  const s = +(HOOK + i * C).toFixed(2), id = `m${i}`;
  ev.push([s, 'whoosh'], [s + 0.12, 'pop']);
  cards += `
  <section id="${id}" class="clip scene card" data-start="${s}" data-duration="${C}" data-track-index="1" style="background:linear-gradient(165deg,${a},${b})">
    <div class="bar">${M.map((_, k) => `<i class="${k <= i ? 'on' : ''}"></i>`).join('')}</div>
    <div class="hint">✋ СТОП НА СВОЁМ МЕСЯЦЕ</div>
    <div class="name">${name}</div>
    <div class="emo">${emo}</div>
    <div class="trait">${trait}</div>
  </section>`;
  js += `
  tl.fromTo('#${id} .name',{scale:2.4,opacity:0},{scale:1,opacity:1,duration:.28,ease:'power4.out'},${s});
  tl.fromTo('#${id} .emo',{scale:0,rotation:-30},{scale:1,rotation:0,duration:.4,ease:'back.out(2.4)'},${s + 0.1});
  tl.to('#${id} .emo',{y:-24,duration:.35,yoyo:true,repeat:2,ease:'sine.inOut'},${s + 0.5});
  tl.fromTo('#${id} .trait',{y:80,opacity:0},{y:0,opacity:1,duration:.3,ease:'power3.out'},${s + 0.22});`;
});
const es = +(HOOK + M.length * C).toFixed(2);
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
.bar{position:absolute;top:200px;left:80px;right:80px;display:flex;gap:10px}
.bar i{flex:1;height:14px;border-radius:7px;background:rgba(255,255,255,.3)}.bar i.on{background:#fff}
.hint{position:absolute;top:262px;left:0;right:0;text-align:center;font:700 44px Rubik,sans-serif;opacity:.92}
.name{position:absolute;top:420px;left:30px;right:30px;text-align:center;font:900 136px/1 Unbounded,Rubik,sans-serif;text-shadow:0 10px 0 rgba(0,0,0,.18)}
.emo{position:absolute;top:640px;left:0;right:0;text-align:center;font-size:330px;line-height:1;font-family:'Noto Color Emoji',sans-serif;filter:drop-shadow(0 24px 22px rgba(0,0,0,.28))}
.trait{position:absolute;top:1110px;left:70px;right:70px;text-align:center;font:900 72px/1.15 Rubik,sans-serif;background:rgba(255,255,255,.95);color:#1b1b2b;padding:40px 36px;border-radius:44px;box-shadow:0 14px 0 rgba(0,0,0,.18)}
#hook{background:radial-gradient(circle at 50% 38%,#ffcf4a,#ff4f8b 72%)}
#hook .big{position:absolute;top:430px;left:40px;right:40px;text-align:center;font:900 112px/1.05 Unbounded,Rubik,sans-serif;text-shadow:0 10px 0 rgba(0,0,0,.18)}
#hook .em{position:absolute;top:900px;left:0;right:0;text-align:center;font-size:190px;font-family:'Noto Color Emoji',sans-serif}
#hook .sub{position:absolute;top:1200px;left:60px;right:60px;text-align:center;font:900 66px/1.2 Rubik,sans-serif}
#hook .sub b{background:#fff;color:#ff4f8b;padding:4px 22px;border-radius:18px}
#end{background:radial-gradient(circle at 50% 42%,#6ef0c2,#2f6bff 75%)}
#end .q{position:absolute;top:480px;left:40px;right:40px;text-align:center;font:900 118px/1.08 Unbounded,Rubik,sans-serif;text-shadow:0 10px 0 rgba(0,0,0,.18)}
#end .em{position:absolute;top:820px;left:0;right:0;text-align:center;font-size:170px;font-family:'Noto Color Emoji',sans-serif}
#end .cta{position:absolute;top:1100px;left:60px;right:60px;text-align:center;font:700 66px/1.25 Rubik,sans-serif}
</style></head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="${total}" data-width="1080" data-height="1920">
  <audio id="sfx" src="assets/sfx.wav" data-start="0" data-duration="${total}" data-track-index="9"></audio>
  <section id="hook" class="clip scene" data-start="0" data-duration="${HOOK}" data-track-index="1">
    <div class="big">КАКОЙ ТЫ<br>ПО МЕСЯЦУ<br>РОЖДЕНИЯ</div>
    <div class="em">🎂🔮</div>
    <div class="sub">останови видео<br>на <b>своём месяце</b></div>
  </section>${cards}
  <section id="end" class="clip scene" data-start="${es}" data-duration="${END}" data-track-index="1">
    <div class="q">СОВПАЛО?</div>
    <div class="em">😳🎯</div>
    <div class="cta">Пиши свой месяц в комменты 👇<br>Проверим, чей самый точный</div>
  </section>
</div>
<script>
  window.__timelines = window.__timelines || {};
  const tl = gsap.timeline({ paused: true });
  tl.fromTo('#hook .big',{scale:2.2,opacity:0},{scale:1,opacity:1,duration:.45,ease:'power4.out'},0);
  tl.fromTo('#hook .em',{y:200,opacity:0},{y:0,opacity:1,duration:.4,ease:'back.out(2)'},.5);
  tl.fromTo('#hook .sub',{scale:0},{scale:1,duration:.35,ease:'back.out(3)'},1.15);
  ${js}
  tl.fromTo('#end .q',{scale:2,opacity:0},{scale:1,opacity:1,duration:.4,ease:'power4.out'},${es});
  tl.fromTo('#end .em',{scale:0},{scale:1,duration:.45,ease:'back.out(2.5)'},${es + 0.3});
  tl.fromTo('#end .cta',{opacity:0,y:40},{opacity:1,y:0,duration:.4},${es + 0.8});
  window.__timelines["main"] = tl;
  tl.seek(0);
</script>
</body></html>`;
writeFileSync(`${dir}/index.html`, html);
writeFileSync(`${dir}/events.json`, JSON.stringify(ev));
console.log('total', total);
