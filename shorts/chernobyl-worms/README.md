# «ДНК червей Чернобыля» (серия «Жизнь в Чернобыле», история с картинками)

Вертикальный ролик 1080×1920, 60 к/с, 38,2 с. Восемь кадров Codex с компьютера владельца, Real-ESRGAN до 2160×3840
(`img/01–08.jpg`). Рассказчик из ElevenLabs (Amid Hasan), субтитры-караоке, плашки, обложка-приманка (первый кадр и
превью), «ИИ-реконструкция» на кадрах. Без «а ты бы…» и без слов о смерти.

## Голос

| Строка | Текст |
|---|---|
| L0 | «Учёные собрали в Чернобыле крошечных червей и прочитали их ДНК.» |
| L1 | «Ждали увидеть следы радиации — поломки в генах.» |
| L2 | «Червей брали и там, где радиации много, и там, где мало.» |
| L3 | «Это нематоды — они живут в гниющих листьях и плодах.» |
| L4 | «Пятнадцать червей из зоны сравнили с червями из других стран.» |
| L5 | «И не нашли в их генах следов радиации.» |
| L6 | «Учёные говорят: это не значит, что зона безопасна. Скорее, эти черви невероятно выносливые.» |
| L7 | «Почему ожидаемого следа нет — теперь новая загадка. Знал об этом? Пиши! И подписывайся!» |

Факты и источники: Tintori, Rockman et al., PNAS, 5 March 2024 («Environmental radiation exposure at Chornobyl has not systematically affected the genomes or chemical mutagen tolerance phenotypes of local worms»): nematodes Oscheius tipulae collected in high- and low-radiation sites; genomes of 15 Chornobyl worms compared with 5 from elsewhere; no detectable radiation damage; Chornobyl lines not more mutagen-tolerant. The authors: this does not mean the zone is safe — the worms are very resilient. Sources: PMC10945782, NYU/EurekAlert, Live Science.

Два дубля ElevenLabs (`/home/user/work/chernobyl-worms-el`); все строки с первого раза; паузы ужаты, речь ускорена на 12 % (`tighten.py`). Таймлайн —
генератор серии (`scratchpad/gen/series.py`). Видео CRF 17, ≤14 Мбит/с.

## Статус

Собран 22.11: проверка `qa/check_clip.py` — «ошибка» «мАло» — ложная: наречие «ма́ло», голос прав; «лишнее не» — распознавание слова «нематоды». Черновик vidiq на 24.11, 19:00 мск.
