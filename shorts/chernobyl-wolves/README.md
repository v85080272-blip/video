# «Волки Чернобыля» (серия «Жизнь в Чернобыле», история с картинками)

Вертикальный ролик 1080×1920, 60 к/с, 38,2 с. Восемь кадров Codex с компьютера владельца, Real-ESRGAN до 2160×3840
(`img/01–08.jpg`). Рассказчик из ElevenLabs (Amid Hasan), субтитры-караоке, плашки, обложка-приманка (первый кадр и
превью), «ИИ-реконструкция» на кадрах. Без «а ты бы…» и без слов о смерти.

## Голос

| Строка | Текст |
|---|---|
| L0 | «Людей из Чернобыльской зоны эвакуировали. А волков там теперь больше, чем в заповедниках.» |
| L1 | «Город Припять пустует почти сорок лет.» |
| L2 | «Учёные считали следы зверей на снегу — год за годом.» |
| L3 | «И сравнили зону с четырьмя обычными заповедниками.» |
| L4 | «Волков в зоне оказалось больше в семь раз.» |
| L5 | «А лосей, косуль и кабанов — примерно столько же, сколько в заповедниках.» |
| L6 | «Но численность не говорит, здоров ли каждый зверь. Это изучают до сих пор.» |
| L7 | «Радиация осталась. А охоты и людей стало гораздо меньше. Знал об этом? Пиши! И подписывайся!» |

Факты и источники: Deryabina et al., Current Biology 25(19), 5 Oct 2015: winter snow-track surveys show wolf relative abundance in the zone more than seven times that of four uncontaminated reserves in the region; elk, roe deer, red deer and wild boar similar to the reserves; helicopter counts 1987–96 showed rising elk, roe deer and boar. Abundance says nothing about each animal's health. Sources: ScienceDaily, EurekAlert, Scientific American (2015).

Два дубля ElevenLabs (`/home/user/work/chernobyl-wolves-el`); L0 «волко́в», L1 «При́пять» — ударения в `tts`, перечитаны (`-el-b`); паузы ужаты, речь ускорена на 12 % (`tighten.py`). Таймлайн —
генератор серии (`scratchpad/gen/series.py`). Видео CRF 17, ≤14 Мбит/с.

## Статус

Собран 22.11: проверка `qa/check_clip.py` — без ошибок и замечаний. Черновик vidiq на 24.11, 12:00 мск.
