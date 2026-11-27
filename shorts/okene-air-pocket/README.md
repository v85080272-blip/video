# «60 часов на дне в перевёрнутом корабле — и он выжил» — история по кадрам Codex

Вертикальный ролик 1080×1920, ~40 с, `out/60-chasov-na-dne.mp4` и обложка `out/60-chasov-na-dne-cover.jpg`. Восемь фотореалистичных кадров
Codex (`img/01–08.jpg`, 2160×3840 после Real-ESRGAN, задание — `../CODEX-batch-24-11.md`), рассказчик ElevenLabs
(Amid Hasan, ускорен 1,12), караоке-субтитры, плашки; без надписи про ИИ (правило владельца 25.11). Шаблон —
`../izhma-landing` (без выбора), монтаж собран `scratchpad/gen/series.py` с параметрами `scratchpad/gen/okene.py`.

## Факты

«60 часов на дне в перевёрнутом корабле» — Харрисон Окене, буксир Jascon-4, 26 мая 2013, у берегов Нигерии. Факты: буксир перевернулся в шторм и лёг на дно на глубине ~30 м; повар Окене нашёл воздушный карман высотой ~1,2 м в каюте; около 60 часов в темноте; водолазы компании DCN нашли его — известное видео, где рука хватает водолаза; потом ~60 часов в барокамере. Остальных из экипажа не называем (правило канала). Источники: ABC News, Washington Times, Fox News 2013.

## Звук

Только реальные записи ElevenLabs Sound Effects (правило владельца 23–24.11 — никаких «детских» синтетических эффектов):
amb_sea_sunrise, amb_underwater_hull, bubbles, heartbeat, impact, metal_knock, riser, ship_capsize, whoosh. Реплики `rec:` в `src/main.js`, файлы в `/home/user/work/shorts-sfx`, микшер `tools/mix.py` (функция `rec`).

## Голос

Ударения проверены распознаванием (`myth-pick.sh`), ошибки исправлены знаком ударения в `tts` или перефразом. Дубли:
`/home/user/work/okene-air-pocket`, сборка голоса — `tighten.py` 1,12 → `tools/voice.py`.

## Сборка

```bash
bash /home/user/work/okene-air-pocket-build.sh
```
