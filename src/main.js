import { W, H, DT, audio, simulate, fmtSec, drawBackdrop, drawHook, drawBanner } from './engine.js';
import race from './toys/race.js';
import war from './toys/war.js';
import grow from './toys/grow.js';
import split from './toys/split.js';
import pendulum from './toys/pendulum.js';

const TOYS = [race, war, grow, split, pendulum];
const HOLD = 3; // seconds the end card stays before the loop restarts

const $ = (id) => document.getElementById(id);
const canvas = $('stage');
canvas.width = W;
canvas.height = H;
const ctx = canvas.getContext('2d');

const live = { note: (i, v, wave) => audio.note(i, v, wave) };

let toy;
let params;
let seed;
let sim;
let hold = 0;
let recording = null;
let searching = false;
let recomputeTimer = 0;

// ---------- controls ----------

function renderTabs() {
  $('labs').innerHTML = TOYS.map(
    (t) => `<button type="button" class="lab" data-id="${t.id}" aria-current="${t === toy}">${t.tab}</button>`,
  ).join('');
}

function sliderFill(input) {
  const f = (input.value - input.min) / (input.max - input.min);
  input.style.setProperty('--p', (f * 100).toFixed(1) + '%');
}

function fmtValue(def, v) {
  const digits = def.step < 1 ? (def.step < 0.1 ? 2 : 1) : 0;
  return Number(v).toFixed(digits).replace('.', ',');
}

function renderControls() {
  $('eyebrow').textContent = toy.eyebrow;
  const [a, b, c] = toy.title;
  $('title').innerHTML = `${a}<br>${b}<br><span class="hl">${c}</span>`;
  $('lede').textContent = toy.lede;
  document.title = `${toy.tab} · Залип Лаб`;

  const sliders = toy.params
    .map(
      (d) => `
      <div class="field">
        <label for="p-${d.key}"><span>${d.label}</span><output id="o-${d.key}">${fmtValue(d, params[d.key])}</output></label>
        <input type="range" id="p-${d.key}" data-key="${d.key}" min="${d.min}" max="${d.max}" step="${d.step}" value="${params[d.key]}">
      </div>`,
    )
    .join('');
  const seedField = toy.search
    ? `<div class="field">
        <label for="seed"><span>Сид</span></label>
        <div class="seed-row">
          <input id="seed" inputmode="numeric" autocomplete="off" value="${seed}">
          <button type="button" class="ghost icon" id="dice" aria-label="Случайный сид">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="8.5" cy="8.5" r="1.6" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/></svg>
          </button>
        </div>
      </div>`
    : '';
  $('sliders').innerHTML = sliders + seedField;
  $('sliders').querySelectorAll('input[type=range]').forEach(sliderFill);

  $('find').hidden = !toy.search;
  if (toy.search) $('find').textContent = toy.search.label;
}

function bindControls() {
  $('labs').addEventListener('click', (e) => {
    const b = e.target.closest('.lab');
    if (b) selectToy(b.dataset.id);
  });
  $('sliders').addEventListener('input', (e) => {
    const el = e.target;
    if (el.id === 'seed') {
      const v = parseInt(el.value, 10);
      if (Number.isFinite(v) && v > 0) {
        seed = v;
        changed();
      }
      return;
    }
    if (!el.dataset.key) return;
    const def = toy.params.find((d) => d.key === el.dataset.key);
    params[def.key] = Number(el.value);
    $('o-' + def.key).textContent = fmtValue(def, el.value);
    sliderFill(el);
    changed();
  });
  $('sliders').addEventListener('click', (e) => {
    if (!e.target.closest('#dice')) return;
    seed = 1 + Math.floor(Math.random() * 99999);
    $('seed').value = seed;
    changed();
  });
  $('find').addEventListener('click', findSeed);
  $('sound').addEventListener('click', () => {
    const on = audio.toggle();
    $('sound').textContent = on ? 'Звук вкл' : 'Звук выкл';
    $('sound').setAttribute('aria-pressed', String(on));
  });
  $('rec').addEventListener('click', () => (recording ? stopRecording() : startRecording()));
  canvas.addEventListener('click', restart);
}

function changed() {
  restart();
  clearTimeout(recomputeTimer);
  recomputeTimer = setTimeout(() => showResult(simulate(toy, params, seed)), 150);
}

function selectToy(id) {
  if (recording) stopRecording();
  toy = TOYS.find((t) => t.id === id) || TOYS[0];
  params = Object.fromEntries(toy.params.map((d) => [d.key, d.value]));
  seed = toy.seed ?? 1;
  renderTabs();
  renderControls();
  restart();
  showResult(simulate(toy, params, seed));
  try {
    history.replaceState(null, '', '#' + toy.id);
  } catch {}
  try {
    localStorage.setItem('zalip.toy', toy.id);
  } catch {}
}

// ---------- result card ----------

function showResult(done) {
  const head = $('headline');
  const bars = $('bars');
  if (!done.done) {
    head.className = 'headline bad';
    head.textContent = 'Не финиширует за 2 минуты';
    $('sub').textContent = 'Сделай отскок сильнее или уменьши лимит.';
    bars.innerHTML = '';
    return;
  }
  const s = done.summary();
  const d = s.duration;
  if (d <= 30) {
    head.className = 'headline good';
    head.textContent = `Идеально для TikTok: ${fmtSec(d)}`;
  } else if (d <= 60) {
    head.className = 'headline ok';
    head.textContent = `Подойдёт для Reels: ${fmtSec(d)}`;
  } else {
    head.className = 'headline warn';
    head.textContent = `Длинновато для коротких видео: ${fmtSec(d)}`;
  }
  $('sub').textContent = s.sub;
  const max = Math.max(...s.bars.map((b) => b.v), 1e-6);
  bars.innerHTML = s.bars
    .map((b) => `<span style="height:${Math.max(4, (b.v / max) * 100).toFixed(1)}%;background:${b.color}"></span>`)
    .join('');
}

async function findSeed() {
  if (searching || !toy.search) return;
  searching = true;
  const btn = $('find');
  btn.disabled = true;
  const s = toy.search;
  const score = (r) => (!r.done ? 1e9 : s.score ? s.score(r) : Math.abs(r.summary().duration - s.target));
  let best = seed;
  let bestScore = score(simulate(toy, params, seed));
  const t0 = performance.now();
  let tries = 0;
  while (tries < 150 && performance.now() - t0 < 6000) {
    const cand = 1 + Math.floor(Math.random() * 99999);
    const sc = score(simulate(toy, params, cand));
    tries++;
    if (sc < bestScore) {
      bestScore = sc;
      best = cand;
    }
    if (sc < (s.score ? 0.004 : 0.4)) break;
    btn.textContent = `Ищу… проверено ${tries}`;
    await new Promise((r) => setTimeout(r, 0));
  }
  seed = best;
  if ($('seed')) $('seed').value = seed;
  btn.textContent = s.label;
  btn.disabled = false;
  searching = false;
  restart();
  showResult(simulate(toy, params, seed));
}

// ---------- recording ----------

function pickMime() {
  const types = [
    'video/mp4;codecs=avc1.640028,mp4a.40.2',
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) || '';
}

function startRecording() {
  const note = $('recnote');
  if (!canvas.captureStream || !window.MediaRecorder) {
    note.textContent = 'Этот браузер не умеет записывать видео. Открой страницу в Chrome на компьютере.';
    $('recout').hidden = false;
    return;
  }
  restart();
  const stream = canvas.captureStream(60);
  if (audio.on && audio.dest) stream.addTrack(audio.dest.stream.getAudioTracks()[0]);
  const mime = pickMime();
  let rec;
  try {
    rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 16_000_000 } : undefined);
  } catch {
    note.textContent = 'Не получилось начать запись в этом браузере.';
    $('recout').hidden = false;
    return;
  }
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  rec.onstop = () => {
    const type = rec.mimeType || mime || 'video/webm';
    const blob = new Blob(chunks, { type });
    const url = URL.createObjectURL(blob);
    const ext = type.includes('mp4') ? 'mp4' : 'webm';
    const v = $('recvideo');
    v.src = url;
    const a = $('recdl');
    a.href = url;
    a.download = `${toy.id}-${seed ?? 'cycle'}.${ext}`;
    a.textContent = `Скачать ${ext.toUpperCase()}`;
    note.textContent =
      ext === 'webm'
        ? 'Браузер записал WebM. TikTok его принимает, для Instagram лучше перегнать в MP4.'
        : 'Готово: MP4 1080×1920, можно сразу загружать.';
    $('recout').hidden = false;
  };
  rec.start(250);
  recording = rec;
  $('rec').textContent = 'Остановить запись';
  $('rec').classList.add('live');
}

function stopRecording() {
  if (!recording) return;
  recording.stop();
  recording = null;
  $('rec').textContent = 'Записать ролик';
  $('rec').classList.remove('live');
}

// ---------- loop ----------

function restart() {
  sim = toy.create(params, seed, live);
  hold = 0;
}

let acc = 0;
let last = performance.now();
function frame(now) {
  acc += Math.min(0.1, (now - last) / 1000);
  last = now;
  while (acc >= DT) {
    acc -= DT;
    if (!sim.done) sim.step(DT);
    else {
      hold += DT;
      if (recording && hold > 2) stopRecording();
      if (hold > HOLD) restart();
    }
  }
  drawBackdrop(ctx);
  sim.draw(ctx);
  drawHook(ctx, toy.hook, sim.pills());
  if (sim.done) {
    const b = sim.banner();
    drawBanner(ctx, b.lines, b.color, hold * 3);
  }
  requestAnimationFrame(frame);
}

function start() {
  bindControls();
  let id = location.hash.slice(1);
  if (!TOYS.some((t) => t.id === id)) {
    try {
      id = localStorage.getItem('zalip.toy') || '';
    } catch {
      id = '';
    }
  }
  selectToy(id);
  requestAnimationFrame((t) => {
    last = t;
    frame(t);
  });
}

start();
