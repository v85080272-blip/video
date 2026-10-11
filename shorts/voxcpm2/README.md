# Нейроголоса VoxCPM2 для мультиков (облако, без видеокарты)

[VoxCPM2](https://huggingface.co/openbmb/VoxCPM2) от OpenBMB: 2 млрд параметров, 30 языков (русский есть), звук 48 кГц, голос по текстовому описанию и клон голоса по образцу. Лицензия Apache-2.0, ролики можно монетизировать.

Работает прямо в облачном треде на процессоре, PyPI не нужен:
- движок [llama.cpp-omni](https://github.com/tc-mb/llama.cpp-omni) (C++, его советует README VoxCPM) собирается из GitHub;
- веса в формате GGUF качаются с Hugging Face ([DennisHuang648/VoxCPM2-GGUF](https://huggingface.co/DennisHuang648/VoxCPM2-GGUF), ссылка из того же README);
- каждый дубль проверяется распознаванием речи [whisper.cpp](https://github.com/ggml-org/whisper.cpp) (large-v3-turbo).

В сети проекта должны быть открыты `huggingface.co`, `*.huggingface.co`, `*.hf.co` (окружение «Голоса»).

## Скорость на процессоре (4 ядра Xeon, 15 ГБ памяти, 11 октября 2026)

| Режим | Речь | Время | Во сколько раз медленнее речи |
|---|---|---|---|
| Фраза без описания, BaseLM Q8_0 | 3,2 с | 15,5 с | 4,8 |
| То же, BaseLM F16 | 3,4 с | 16,4 с | 4,9 |
| То же, 6 шагов диффузии вместо 10 | 3,4 с | 13,0 с | 3,9 |
| Голос по описанию (кастинг), сервер | 3,2–5,8 с | 20–36 с | 5,9–6,4 |
| Короткая реплика клоном с эмоцией | 0,8–2,4 с | 11–22 с | 9–14 |

Загрузка модели около 11 с (сервер грузит её один раз). Память: около 6 ГБ. Q8_0 и F16 по скорости одинаковы, узкое место в акустической части, поэтому берём Q8_0 (вдвое меньше файл). Генерация всей озвучки серии «Побег» заняла около 12 минут: кастинг 12 проб (54 с звука) 5,5 минуты, 24 дубля реплик (40 с звука) 7 минут, плюс проверка каждого дубля Whisper.

## Как озвучить серию

```bash
export VOX_HOME=~/voxcpm2
bash setup.sh                                   # сборка движка и whisper.cpp, модели с проверкой sha256
$VOX_HOME/src/llama.cpp-omni/build/bin/llama-tts-server --host 127.0.0.1 --port 8099 -t 4 \
  --voxcpm2-base-lm $VOX_HOME/models/VoxCPM2-GGUF/VoxCPM2-BaseLM-Q8_0.gguf \
  --voxcpm2-acoustic $VOX_HOME/models/VoxCPM2-GGUF/VoxCPM2-Acoustic-F16.gguf &

python3 tools/cast.py voices/cast.json work/cast 1,2,3          # только для новых персонажей
python3 tools/lines.py morozilka3/lines.json work/lines 1,2,3,4   # 4 дубля каждой реплики
# выбрать дубли в lines.json → "chosen" (CER 0, влезает в паузу, тембр как у голоса из voices/)
python3 tools/build.py <папка фильма> morozilka3/lines.json work/lines
```

Дальше обычная сборка «Морозилки» (см. `shorts/morozilka/README.md` в ветке `claude/ai-cartoons-hype-h3r05n`): картинка через lemo-opuscar, звук `mix.py`, склейка ffmpeg с `loudnorm=I=-14:TP=-1.5`.

**Голоса персонажей лежат в `voices/`:** `syrnik.wav` (Сырник) и `pelmen.wav` (Пельмень Петрович). В новых сериях клонируем из них, тогда герои звучат одинаково. Эмоция реплики пишется в скобках перед текстом на английском, например `(terrified and panicked, out of breath)Там! Сковородка!`.

## Что проверяется автоматически

- `cer`: Whisper распознаёт дубль, сравниваем с текстом. Ловит проглоченные и искажённые слова («Борозилки», «смигаем»). Ударения так не проверить.
- `speech`: длина без тишины по краям, должна влезть в паузу до следующего события (`max`).
- `f0`: высота голоса (медиана и разброс), `timbre_sim`: похожесть тембра на голос персонажа.

## Если PyPI закрыт

`mix.py` из lemo-opuscar просит scipy и soundfile. В `shim/` лежат их замены на numpy: фильтры Баттерворта той же схемы, что в scipy (сверено: −3,01 дБ на частоте среза, расхождение с прямой рекурсией ~1e-12), `maximum_filter1d`/`uniform_filter1d` и чтение/запись WAV. Запуск: `PYTHONPATH=shim LIB=<lemo-opuscar> python3 <фильм>/mix.py`. Музыка и шумы совпадают с оригинальной серией (корреляция 0,91–0,99 на участках без речи).

Для рендера lemo-opuscar без npm: `node_modules/playwright-core` можно связать с `/opt/node-tools/node_modules/playwright-core`, браузер `PLAYWRIGHT_CHROME=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.

## Подводные камни

- Сервер llama.cpp-omni, собранный с OpenSSL, превращается в HTTPS-сервер без сертификата и пишет `Couldn't bind HTTP server socket`. Собирать с `-DLLAMA_OPENSSL=OFF` (так делает `setup.sh`).
- Движок читает образец голоса только как 16-битный WAV.
- Голос по описанию каждый раз новый, поэтому описание используется один раз на кастинге, а реплики делаются клоном.
