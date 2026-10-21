# Listening page, round 6: our voices in the manner of vla's MiniMax sample, next to it. make_page3.py with the page title
# taken from the entries (page_title). Usage: python3 make_page6.py <entries.json> <out.html>
import base64, html, json, os, re, subprocess, sys, tempfile
import numpy as np
sys.path[:0] = ['/home/user/work/voice/shorts/voxcpm2/tools']
import aud

src = open('/home/user/work/voice2/tools/make_page.py').read()
STYLE = re.search(r'<style>.*?</style>', src, re.S).group(0)
SCRIPT = re.search(r'<script>.*?</script>', src, re.S).group(0)
FONTS = re.search(r'<link rel="preconnect".*?display=swap">', src, re.S).group(0)
EXTRA = '''<style>
.card.ref{border-color:var(--fg);border-width:2px}
.ref .num{background:var(--fg);color:var(--bg)}
.kv{display:inline-block;margin-left:4px;color:var(--fg);font-weight:600}
</style>'''

entries, out = json.load(open(sys.argv[1])), sys.argv[2]


def mp3_and_peaks(wav, start=0.0, dur=None, bars=72):
    with tempfile.TemporaryDirectory() as td:
        cut = os.path.join(td, 'c.wav')
        cmd = ['ffmpeg', '-v', 'error', '-y', '-ss', str(start), '-i', wav]
        if dur:
            cmd += ['-t', str(dur)]
        cmd += ['-ac', '1', '-ar', '24000', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '24000', cut]
        subprocess.run(cmd, check=True)
        mp3 = os.path.join(td, 'c.mp3')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', cut, '-c:a', 'libmp3lame', '-b:a', '80k', mp3], check=True)
        x, sr = aud.read_wav(cut)
        b64 = base64.b64encode(open(mp3, 'rb').read()).decode()
    n = len(x) // bars
    rms = np.sqrt((x[:n * bars].reshape(bars, n) ** 2).mean(1))
    pk = np.clip(rms / (rms.max() + 1e-9), 0.08, 1.0)
    return b64, [round(float(v), 2) for v in pk], len(x) / sr


def fmt(d):
    s = int(round(d))
    return f'{s // 60}:{s % 60:02d}'


def card(e):
    b64, pk, d = mp3_and_peaks(e['wav'], e.get('start', 0.0), e.get('dur'))
    bars = ''.join(f'<i style="--h:{p:.2f}"></i>' for p in pk)
    cls = ' '.join(c for c in ['rec' if e.get('rec') else '', 'ref' if e.get('ref') else '', 'old' if e.get('old') else ''] if c)
    badge = '<span class="badge">Советую</span>' if e.get('rec') else ''
    num = f'<span class="num">{html.escape(e["num"])}</span>'
    meta = ''.join(f'<li>{m}</li>' for m in e.get('meta', []))
    return f'''
<article class="card {cls}">
  <div class="top">
    {num}
    <div class="titles"><h2>{html.escape(e['name'])}</h2><p>{html.escape(e['desc'])}</p></div>
    {badge}
  </div>
  <div class="player">
    <button class="play" type="button" aria-label="Слушать: {html.escape(e['name'])}">
      <svg class="i-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>
      <svg class="i-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.6v14H7zM13.4 5H17v14h-3.6z"/></svg>
    </button>
    <div class="wave" role="slider" tabindex="0" aria-label="Перемотка" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">{bars}</div>
    <span class="time" data-dur="{fmt(d)}">{fmt(d)}</span>
  </div>
  <ul class="meta">{meta}</ul>
  <audio preload="metadata" src="data:audio/mpeg;base64,{b64}"></audio>
</article>'''


P = entries
secs = ''.join(f'<div class="sep">{html.escape(s["title"])}</div>\n<section class="list" aria-label="{html.escape(s["title"])}">'
               + ''.join(card(e) for e in s['cards']) + '</section>' for s in P['sections'])
page = f'''<title>{html.escape(P.get('page_title', 'Голос для «Тайн истории»'))}</title>
<meta name="claude:viewport-fit-sides" content="cover">
{FONTS}
{STYLE}
{EXTRA}
<main class="wrap">
  <header>
    <p class="kicker">{html.escape(P['kicker'])}</p>
    <h1>{html.escape(P['title'])}</h1>
    <p class="lead">{html.escape(P['lead'])}</p>
    <div class="excerpt"><b>Текст</b>«{html.escape(P['sample'])}»</div>
  </header>
  {secs}
  <footer class="note">{''.join(f'<p>{t}</p>' for t in P['notes'])}</footer>
</main>
{SCRIPT}
'''
open(out, 'w').write(page)
print(len(page), 'bytes ->', out)
