import { W, H, DT, audio, simulate, fmtSec, drawBackdrop, drawHook, drawBanner } from './engine.js';
import { LANES, supportsBattle, createBattle, findBattleSeeds, simulateBattle } from './battle.js';
import { MELODIES, TIMBRES } from './melody.js';
import rings from './toys/rings.js';
import race from './toys/race.js';
import war from './toys/war.js';
import grow from './toys/grow.js';
import split from './toys/split.js';
import pendulum from './toys/pendulum.js';

const TOYS = [rings, race, war, grow, split, pendulum];
const BATTLE_TOYS = TOYS.filter(supportsBattle);

// Not a toy of its own: three different toys race in one frame.
const MIX = {
  id: 'mix',
  tab: 'Микс ×3',
  eyebrow: 'MIX LAB · БИТВА ×3',
  title: ['Три разные игрушки,', 'один финиш:', 'кто быстрее?'],
  lede: 'В каждой дорожке своя игрушка со своими правилами. Подбери сиды с фотофинишем, и зрители будут спорить, что быстрее: кольца, рост или толпа.',
  mixed: true,
  params: [],
  seed: null,
  search: { label: 'Найти фотофиниш', target: 18 },
  battle: { hook: ['Кто финиширует', 'первым?'], seeds: [49015, 25996, 18752] },
};
const ALL = [...TOYS, MIX];
const byId = (id) => TOYS.find((t) => t.id === id);
const defaults = (t) => Object.fromEntries(t.params.map((d) => [d.key, d.value]));
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
let seeds = [1, 2, 3];
let mode = 'solo';
let laneToys = ['rings', 'grow', 'split'];
let sim;
let hold = 0;
let recording = null;
let searching = false;
let recomputeTimer = 0;
let lastClip = null;

// Inside a claude.ai page, files go through the viewer's save prompt;
// in a normal browser a plain download link does the job.
let saver = null;
window.claude?.use?.('downloads').then((d) => (saver = d)).catch(() => {});

// ---------- controls ----------

function renderTabs() {
  $('labs').innerHTML = ALL.map(
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

const DICE = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="8.5" cy="8.5" r="1.6" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/></svg>`;

const battleOn = () => !!toy.mixed || (mode === 'battle' && supportsBattle(toy));

// what createBattle / simulateBattle / findBattleSeeds get as toy and params
function battleArgs() {
  if (!toy.mixed) return [toy, params];
  const ts = laneToys.map(byId);
  return [ts, ts.map(defaults)];
}

function hookLines() {
  if (!battleOn()) return toy.hook;
  const h = toy.battle.hook;
  return typeof h === 'function' ? h(params) : h;
}

function renderControls() {
  $('modes').hidden = !supportsBattle(toy) || !!toy.mixed;
  $('modes').querySelectorAll('button').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.mode === (battleOn() ? 'battle' : 'solo')));
  });
  $('eyebrow').textContent = battleOn() && !toy.mixed ? toy.eyebrow + ' · БИТВА ×3' : toy.eyebrow;
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
  let seedField = '';
  if (toy.mixed) {
    seedField += LANES.map(
      (l, i) => `<div class="field">
        <label for="lane-${i}"><span>Дорожка <b style="color:${l.color}">${l.n}</b></span></label>
        <select id="lane-${i}" data-lanetoy="${i}">${BATTLE_TOYS.map(
          (t) => `<option value="${t.id}"${t.id === laneToys[i] ? ' selected' : ''}>${t.tab}</option>`,
        ).join('')}</select>
      </div>`,
    ).join('');
  }
  if (battleOn()) {
    seedField += `<div class="field" style="grid-column: 1 / -1">
        <label for="seed-0"><span>Сиды трёх дорожек</span></label>
        <div class="seed-trio">
          ${LANES.map(
            (l, i) => `<label for="seed-${i}"><i style="color:${l.color}">${l.n}</i><input class="seed-input" id="seed-${i}" data-lane="${i}" inputmode="numeric" autocomplete="off" value="${seeds[i]}" aria-label="Сид дорожки ${l.n}"></label>`,
          ).join('')}
          <button type="button" class="ghost icon" id="dice" aria-label="Случайные сиды">${DICE}</button>
        </div>
      </div>`;
  } else if (toy.search) {
    seedField = `<div class="field">
        <label for="seed"><span>Сид</span></label>
        <div class="seed-row">
          <input id="seed" inputmode="numeric" autocomplete="off" value="${seed}">
          <button type="button" class="ghost icon" id="dice" aria-label="Случайный сид">${DICE}</button>
        </div>
      </div>`;
  }
  $('sliders').innerHTML = sliders + seedField;
  $('sliders').querySelectorAll('input[type=range]').forEach(sliderFill);

  $('find').hidden = !toy.search;
  $('find').textContent = findLabel();
}

const findLabel = () => (battleOn() ? 'Найти фотофиниш' : toy.search ? toy.search.label : '');

function renderSound() {
  $('melody').innerHTML = MELODIES.map((m) => `<option value="${m.id}">${m.name}</option>`).join('');
  $('timbre').innerHTML = TIMBRES.map((t) => `<option value="${t.id}">${t.name}</option>`).join('');
  $('melody').value = audio.melodyId;
  $('timbre').value = audio.timbre;
}

function bindControls() {
  $('labs').addEventListener('click', (e) => {
    const b = e.target.closest('.lab');
    if (b) selectToy(b.dataset.id);
  });
  $('sliders').addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset.lanetoy) {
      laneToys[Number(el.dataset.lanetoy)] = el.value;
      changed();
      return;
    }
    if (el.id === 'seed' || el.dataset.lane) {
      const v = parseInt(el.value, 10);
      if (Number.isFinite(v) && v > 0) {
        if (el.dataset.lane) seeds[Number(el.dataset.lane)] = v;
        else seed = v;
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
    const roll = () => 1 + Math.floor(Math.random() * 99999);
    if (battleOn()) {
      seeds = seeds.map(roll);
      seeds.forEach((v, i) => ($('seed-' + i).value = v));
    } else {
      seed = roll();
      $('seed').value = seed;
    }
    changed();
  });
  $('modes').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-mode]');
    if (b) setMode(b.dataset.mode);
  });
  $('melody').addEventListener('change', (e) => {
    audio.setMelody(e.target.value);
    savePref('zalip.melody', e.target.value);
  });
  $('timbre').addEventListener('change', (e) => {
    audio.timbre = e.target.value;
    savePref('zalip.timbre', e.target.value);
    audio.preview();
  });
  $('find').addEventListener('click', findSeed);
  $('sound').addEventListener('click', () => {
    const on = audio.toggle();
    $('sound').textContent = on ? 'Звук вкл' : 'Звук выкл';
    $('sound').setAttribute('aria-pressed', String(on));
  });
  $('rec').addEventListener('click', () => (recording ? stopRecording() : startRecording()));
  $('recdl').addEventListener('click', saveClip);
  canvas.addEventListener('click', restart);
}

function savePref(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

function loadPref(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

// Runs the current setup (one sim or the whole battle) to its end without drawing.
function runToEnd() {
  if (!battleOn()) return simulate(toy, params, seed);
  return simulateBattle(...battleArgs(), seeds);
}

function changed() {
  restart();
  clearTimeout(recomputeTimer);
  recomputeTimer = setTimeout(() => showResult(runToEnd()), 150);
}

function syncHash() {
  try {
    history.replaceState(null, '', '#' + toy.id + (battleOn() && !toy.mixed ? '-x3' : ''));
  } catch {}
  savePref('zalip.toy', toy.id);
  if (supportsBattle(toy) && !toy.mixed) savePref('zalip.mode', mode);
}

function setMode(m) {
  if (recording) stopRecording();
  mode = m;
  renderControls();
  restart();
  showResult(runToEnd());
  syncHash();
}

function selectToy(id) {
  if (recording) stopRecording();
  toy = ALL.find((t) => t.id === id) || TOYS[0];
  params = defaults(toy);
  seed = toy.seed ?? 1;
  seeds = toy.battle?.seeds ? [...toy.battle.seeds] : [seed ?? 1, (seed ?? 1) + 1, (seed ?? 1) + 2];
  renderTabs();
  renderControls();
  restart();
  showResult(runToEnd());
  syncHash();
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
  if (battleOn()) return findTrio();
  searching = true;
  const btn = $('find');
  btn.disabled = true;
  const key = setupKey();
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
  btn.textContent = findLabel();
  btn.disabled = false;
  searching = false;
  // the viewer may have switched toy or mode during the search
  if (setupKey() !== key) return;
  seed = best;
  if ($('seed')) $('seed').value = seed;
  restart();
  showResult(simulate(toy, params, seed));
}

// what a search result belongs to: toy, mode, lanes and every slider
function setupKey() {
  return JSON.stringify([toy.id, battleOn(), laneToys, params]);
}

async function findTrio() {
  searching = true;
  const btn = $('find');
  btn.disabled = true;
  const key = setupKey();
  const res = await findBattleSeeds(...battleArgs(), {
    budgetMs: 6000,
    target: toy.search.target ?? 18,
    onProgress: (n) => (btn.textContent = `Ищу фотофиниш… проверено ${n}`),
  });
  btn.textContent = findLabel();
  btn.disabled = false;
  searching = false;
  if (setupKey() !== key) return;
  if (res && res.seeds) {
    seeds = [...res.seeds];
    seeds.forEach((v, i) => $('seed-' + i) && ($('seed-' + i).value = v));
  }
  restart();
  showResult(runToEnd());
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
  const base = `${toy.id}-${battleOn() ? 'x3-' + seeds.join('-') : seed ?? 'cycle'}`;
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
    lastClip = { blob, url, filename: `${base}.${ext}` };
    $('recdl').textContent = `Скачать ${ext.toUpperCase()}`;
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

async function saveClip() {
  if (!lastClip) return;
  if (saver) {
    try {
      await saver.save({ filename: lastClip.filename, data: lastClip.blob });
    } catch (e) {
      if (e && e.code !== 'declined') $('recnote').textContent = 'Не удалось сохранить файл здесь. Открой лабораторию локально через npm run dev.';
    }
    return;
  }
  const a = document.createElement('a');
  a.href = lastClip.url;
  a.download = lastClip.filename;
  document.body.append(a);
  a.click();
  a.remove();
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
  sim = battleOn() ? createBattle(...battleArgs(), seeds, live) : toy.create(params, seed, live);
  audio.resetMelody();
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
  if (sim.done && battleOn()) {
    // in a battle the answer replaces the question, so no lane gets covered
    drawHook(ctx, sim.banner().lines, sim.pills());
  } else {
    drawHook(ctx, hookLines(), sim.pills());
    if (sim.done) {
      const b = sim.banner();
      drawBanner(ctx, b.lines, b.color, hold * 3);
    }
  }
  requestAnimationFrame(frame);
}

function start() {
  audio.setMelody(loadPref('zalip.melody') || 'pentatonic');
  if (TIMBRES.some((t) => t.id === loadPref('zalip.timbre'))) audio.timbre = loadPref('zalip.timbre');
  renderSound();
  bindControls();
  let id = location.hash.slice(1);
  if (id.endsWith('-x3')) {
    id = id.slice(0, -3);
    const t = ALL.find((x) => x.id === id);
    mode = t && supportsBattle(t) ? 'battle' : 'solo';
  } else if (ALL.some((t) => t.id === id)) {
    mode = 'solo';
  } else {
    id = loadPref('zalip.toy') || '';
    mode = loadPref('zalip.mode') === 'battle' ? 'battle' : 'solo';
  }
  selectToy(id);
  requestAnimationFrame((t) => {
    last = t;
    frame(t);
  });
}

start();
