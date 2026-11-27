# «41 час в застрявшем лифте — его никто не искал» — история по кадрам Codex

Вертикальный ролик 1080×1920, ~40 с, `out/41-chas-v-lifte.mp4` и обложка `out/41-chas-v-lifte-cover.jpg`. Восемь фотореалистичных кадров
Codex (`img/01–08.jpg`, 2160×3840 после Real-ESRGAN, задание — `../CODEX-batch-24-11.md`), рассказчик ElevenLabs
(Amid Hasan, ускорен 1,12), караоке-субтитры, плашки; без надписи про ИИ (правило владельца 25.11). Шаблон —
`../izhma-landing` (без выбора), монтаж собран `scratchpad/gen/series.py` с параметрами `scratchpad/gen/elevator.py`.

## Факты

«41 час в застрявшем лифте» — Николас Уайт, небоскрёб McGraw-Hill (1221 Avenue of the Americas), Нью-Йорк, пятница 15 октября 1999. Факты: вышел вечером на перекур, лифт остановился между этажами; ни воды, ни еды; раздвинул двери — за ними стена шахты; охрана увидела его на камере в воскресенье около 16:00 — почти 41 час; видео с камеры опубликовал The New Yorker в 2008. Источники: ABC News, The New Yorker/NPR 2008.

## Звук

Только реальные записи ElevenLabs Sound Effects (правило владельца 23–24.11 — никаких «детских» синтетических эффектов):
amb_city_night, amb_elevator, button_press, doors_pry, elevator_jolt, elevator_ride, impact, whoosh. Реплики `rec:` в `src/main.js`, файлы в `/home/user/work/shorts-sfx`, микшер `tools/mix.py` (функция `rec`).

## Голос

Ударения проверены распознаванием (`myth-pick.sh`), ошибки исправлены знаком ударения в `tts` или перефразом. Дубли:
`/home/user/work/elevator-41h`, сборка голоса — `tighten.py` 1,12 → `tools/voice.py`.

## Сборка

```bash
bash /home/user/work/elevator-41h-build.sh
```
