import base64, json, html, sys
P = '/home/user/work/voice2/page'
peaks = json.load(open(f'{P}/peaks.json'))
OUT = sys.argv[1]

voices = [
    dict(id='v5_energetic', num='1', name='Энергичный рассказчик', rec=True,
         desc='Бодрый баритон, быстрый темп, яркие ударения. Ближе всего к роликам с фактами.',
         wps='2,6', mos='3,9'),
    dict(id='v1_deep', num='2', name='Низкий и тёплый',
         desc='Глубокий мужской голос с лёгкой хрипотцой, рассказывает как документальное кино.',
         wps='2,4', mos='3,8'),
    dict(id='v6_bass', num='3', name='Бас из трейлера',
         desc='Очень низкий и тяжёлый, медленнее и драматичнее остальных.',
         wps='2,4', mos='3,8'),
    dict(id='v4_female', num='4', name='Женский, загадочный',
         desc='Тёплый низкий женский голос, интригующая подача.',
         wps='2,7', mos='3,9'),
]
old = dict(id='v0_old', num='', name='Как было',
           desc='Голос из нынешней версии ролика, для сравнения.', wps='2,5', mos='3,0')

def fmt(d):
    s = int(round(d))
    return f'{s // 60}:{s % 60:02d}'

def card(v, cls=''):
    b64 = base64.b64encode(open(f"{P}/{v['id']}.mp3", 'rb').read()).decode()
    pk = peaks[v['id']]
    bars = ''.join(f'<i style="--h:{p:.2f}"></i>' for p in pk['peaks'])
    badge = '<span class="badge">Советую</span>' if v.get('rec') else ''
    num = f'<span class="num">{v["num"]}</span>' if v['num'] else '<span class="num num-old">0</span>'
    rec = ' rec' if v.get('rec') else ''
    return f'''
<article class="card{rec} {cls}">
  <div class="top">
    {num}
    <div class="titles"><h2>{html.escape(v['name'])}</h2><p>{html.escape(v['desc'])}</p></div>
    {badge}
  </div>
  <div class="player">
    <button class="play" type="button" aria-label="Слушать: {html.escape(v['name'])}">
      <svg class="i-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>
      <svg class="i-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.6v14H7zM13.4 5H17v14h-3.6z"/></svg>
    </button>
    <div class="wave" role="slider" tabindex="0" aria-label="Перемотка" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">{bars}</div>
    <span class="time" data-dur="{fmt(pk['dur'])}">{fmt(pk['dur'])}</span>
  </div>
  <ul class="meta"><li>темп {v['wps']} слова/с</li><li>натуральность {v['mos']} из 5</li></ul>
  <audio preload="metadata" src="data:audio/mpeg;base64,{b64}"></audio>
</article>'''

page = '''<title>Голос для «Тайн истории»</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600&family=Manrope:wght@400;600;700&display=swap">
<style>
:root{
  --bg:#f3ede2; --surface:#fffaf2; --surface-2:#ebe2d2; --fg:#1d1813; --muted:#6a5e51; --line:#dcd0bd;
  --accent:#c2410c; --accent-ink:#fff7ed; --wave:#bdac92; --wave-on:#c2410c; --rec:#fbe3cf; --shadow:0 1px 2px rgba(60,40,20,.08),0 6px 20px rgba(60,40,20,.06);
}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){
  --bg:#0e1013; --surface:#171a1f; --surface-2:#20242b; --fg:#ece5d8; --muted:#a39888; --line:#2b3038;
  --accent:#fb923c; --accent-ink:#1b0f05; --wave:#3a414b; --wave-on:#fb923c; --rec:#2a1b10; --shadow:none; color-scheme:dark;
}}
:root[data-theme="dark"]{
  --bg:#0e1013; --surface:#171a1f; --surface-2:#20242b; --fg:#ece5d8; --muted:#a39888; --line:#2b3038;
  --accent:#fb923c; --accent-ink:#1b0f05; --wave:#3a414b; --wave-on:#fb923c; --rec:#2a1b10; --shadow:none; color-scheme:dark;
}
body{background:var(--bg);color:var(--fg);font-family:Manrope,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-size:16px;line-height:1.55}
.wrap{max-width:640px;margin:0 auto;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));padding-block:28px 40px;display:flex;flex-direction:column;gap:22px}
.kicker{margin:0;font-family:Oswald,"Arial Narrow",sans-serif;font-weight:500;text-transform:uppercase;letter-spacing:.12em;font-size:13px;color:var(--accent)}
h1{margin:6px 0 0;font-family:Oswald,"Arial Narrow",sans-serif;font-weight:600;font-size:clamp(30px,8vw,44px);line-height:1.08;text-wrap:balance;letter-spacing:.01em}
.lead{margin:10px 0 0;color:var(--muted);max-width:60ch}
.excerpt{margin:14px 0 0;padding:14px 16px;border-left:3px solid var(--accent);background:var(--surface-2);border-radius:0 10px 10px 0;font-size:15px}
.excerpt b{display:block;font-family:Oswald,"Arial Narrow",sans-serif;font-weight:500;text-transform:uppercase;letter-spacing:.1em;font-size:12px;color:var(--muted);margin-bottom:4px}
.list{display:flex;flex-direction:column;gap:14px}
.card{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:12px;box-shadow:var(--shadow)}
.card.rec{border-color:var(--accent);background:linear-gradient(180deg,var(--rec),var(--surface) 70%)}
.card.old{background:transparent;box-shadow:none;border-style:dashed}
.top{display:flex;gap:12px;align-items:flex-start}
.num{flex:none;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;font-family:Oswald,"Arial Narrow",sans-serif;font-weight:600;font-size:17px;background:var(--surface-2);color:var(--fg)}
.rec .num{background:var(--accent);color:var(--accent-ink)}
.num-old{font-size:0}.num-old::before{content:"";width:12px;height:12px;border-radius:50%;border:2px solid var(--muted)}
.titles{min-width:0;flex:1}
.titles h2{margin:0;font-size:18px;line-height:1.25;font-weight:700}
.titles p{margin:3px 0 0;color:var(--muted);font-size:14.5px}
.badge{flex:none;font-family:Oswald,"Arial Narrow",sans-serif;font-weight:500;text-transform:uppercase;letter-spacing:.1em;font-size:11.5px;padding:4px 9px;border-radius:999px;background:var(--accent);color:var(--accent-ink)}
.player{display:flex;align-items:center;gap:12px}
.play{flex:none;width:48px;height:48px;border-radius:50%;border:0;background:var(--fg);color:var(--bg);display:grid;place-items:center;cursor:pointer;transition:transform .12s ease}
.rec .play{background:var(--accent);color:var(--accent-ink)}
.play:active{transform:scale(.94)}
.play:focus-visible,.wave:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
.play svg{width:22px;height:22px;fill:currentColor}
.play .i-pause{display:none}
.card.playing .play .i-play{display:none}.card.playing .play .i-pause{display:block}
.wave{flex:1;min-width:0;height:44px;display:flex;align-items:center;gap:2px;cursor:pointer;touch-action:none}
.wave i{flex:1;min-width:1px;height:calc(var(--h)*100%);background:var(--wave);border-radius:2px;transition:background .15s}
.wave i.on{background:var(--wave-on)}
.time{flex:none;font-variant-numeric:tabular-nums;color:var(--muted);font-size:14px;min-width:34px;text-align:right}
.meta{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:6px 14px;color:var(--muted);font-size:13px}
.meta li{display:flex;align-items:center;gap:6px}.meta li::before{content:"";width:5px;height:5px;border-radius:50%;background:var(--line)}
.sep{display:flex;align-items:center;gap:10px;color:var(--muted);font-family:Oswald,"Arial Narrow",sans-serif;text-transform:uppercase;letter-spacing:.12em;font-size:12px}
.sep::after{content:"";flex:1;height:1px;background:var(--line)}
.note{display:flex;flex-direction:column;gap:8px;color:var(--muted);font-size:14px;border-top:1px solid var(--line);padding-top:16px}
.note p{margin:0;max-width:62ch}
.note strong{color:var(--fg)}
</style>
<main class="wrap">
  <header>
    <p class="kicker">Тайны истории · №1 · Тунгуска, 1908</p>
    <h1>Каким голосом рассказывать?</h1>
    <p class="lead">Четыре новых голоса читают начало ролика. Послушай каждый и выбери в треде. Внизу голос из нынешней версии, чтобы сравнить.</p>
    <div class="excerpt"><b>Текст отрывка</b>«В 1908 году над Сибирью взорвалось нечто в сотни раз мощнее Хиросимы. И до сих пор никто точно не знает, что это было. Утро 30 июня. Вдруг небо раскалывается надвое, и над лесом встаёт огонь.»</div>
  </header>
  <section class="list" aria-label="Новые голоса">
''' + ''.join(card(v) for v in voices) + '''
  </section>
  <div class="sep">Для сравнения</div>
''' + card(old, 'old') + '''
  <footer class="note">
    <p><strong>Натуральность</strong> оценивает нейросеть UTMOS: насколько речь похожа на живую, от 1 до 5. Для русского это примерный ориентир, решает твоё ухо.</p>
    <p>Если ни один не похож на твои примеры, запиши экран с таким рилсом и пришли видео в тред. Подберу голос в той же манере и темпе.</p>
  </footer>
</main>
<script>
(function(){
  var cards=[].slice.call(document.querySelectorAll('.card'));
  function fmt(s){s=Math.max(0,Math.round(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');}
  cards.forEach(function(card){
    var a=card.querySelector('audio'),btn=card.querySelector('.play'),wave=card.querySelector('.wave'),
        bars=[].slice.call(wave.children),time=card.querySelector('.time'),raf=0;
    function paint(){
      var d=a.duration||0,p=d?a.currentTime/d:0,k=Math.round(p*bars.length);
      bars.forEach(function(b,i){b.classList.toggle('on',i<k);});
      wave.setAttribute('aria-valuenow',Math.round(p*100));
      time.textContent=a.paused&&a.currentTime===0?time.dataset.dur:fmt(a.currentTime);
    }
    function loop(){paint();if(!a.paused)raf=requestAnimationFrame(loop);}
    btn.addEventListener('click',function(){
      if(a.paused){
        cards.forEach(function(c){if(c!==card){var o=c.querySelector('audio');if(!o.paused)o.pause();}});
        var pr=a.play();if(pr&&pr.catch)pr.catch(function(){});
      }else a.pause();
    });
    a.addEventListener('play',function(){card.classList.add('playing');btn.setAttribute('aria-label','Пауза');cancelAnimationFrame(raf);loop();});
    a.addEventListener('pause',function(){card.classList.remove('playing');btn.setAttribute('aria-label','Слушать');paint();});
    a.addEventListener('ended',function(){a.currentTime=0;paint();});
    function seekAt(x){var r=wave.getBoundingClientRect(),p=Math.min(1,Math.max(0,(x-r.left)/r.width));if(a.duration){a.currentTime=p*a.duration;paint();}}
    wave.addEventListener('pointerdown',function(e){seekAt(e.clientX);});
    wave.addEventListener('keydown',function(e){
      if(!a.duration)return;
      if(e.key==='ArrowRight'){a.currentTime=Math.min(a.duration,a.currentTime+2);paint();e.preventDefault();}
      if(e.key==='ArrowLeft'){a.currentTime=Math.max(0,a.currentTime-2);paint();e.preventDefault();}
      if(e.key===' '||e.key==='Enter'){btn.click();e.preventDefault();}
    });
  });
})();
</script>
'''
open(OUT, 'w').write(page)
print(len(page))
