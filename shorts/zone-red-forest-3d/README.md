# «Рыжий лес» — «Зона», серия 2 (3D)

Зрители выбрали Рыжий лес и попросили больше опасности: без гида, ты один с Пургой. Чтобы не звать никого в Зону самому,
сюжет — ты отстал от группы, автобус уехал, и нужно выбраться. Та же история есть в 2D (`../zone-red-forest`); голос,
музыка, звуки и надписи у обеих версий общие (этот `src/main.js` — тот же, с `OVERLAY=1` он рисует только 2D-слой).

Планы (`blender/forest.py`): A — один в лесу, автобус уходит по дороге; B — 1986-й: роща рыжеет, бульдозер валит сосны
в траншею, песок, молодые сосны (в `tools/bg.py` — как старая плёнка); C — выход на асфальт; D — порыв ветра с пылью,
красный шарф на нос; E — грибы во мху, дозиметр краснеет; F — река с отражениями, рука к воде — и назад; G — сумерки,
волки выходят из леса, руки вверх, отход вдоль дороги; H — развилка с указателями «ДУГА» и «ПРИПЯТЬ», знак, решётка
«Дуги» и дома Припяти на горизонте. Лес — 1150 сосен (молодые, порыжевшие, мёртвые) копиями нескольких мешей.

```bash
/home/user/work/bpyenv/bin/python blender/forest.py A 4.66 /home/user/work/redforest-r/f_A 66 10 3
python3 tools/bg.py build/cues.json /home/user/work/redforest-r build/bg.mp4
OVERLAY=1 FPS=30 node render.mjs video build/overlay.mov 1
cd tools && python3 music.py ../build/cues.json ../build/music.wav && python3 mix.py ../build/cues.json ../build/music.wav ../build/mix.wav ../build/voice.wav && cd ..
ffmpeg -i build/bg.mp4 -i build/overlay.mov -i build/mix.wav -filter_complex "[0:v][1:v]overlay=format=auto,format=yuv420p[v];[2:a]afade=t=out:st=51.53:d=0.5[a]" -map "[v]" -map "[a]" -c:v libx264 -preset slow -crf 16 -c:a aac -b:a 256k -ar 48000 -shortest -movflags +faststart out/zona-ryzhiy-les.mp4
```

Статус: собрано 08.11, `qa/check_clip.py` без ошибок (−14,1 LUFS, пик −1,9 dBTP, 52,0 с; замечание «рыжий» под музыкой —
без неё «рЫжий» верно). Голос: L0 s6, L1 s4 (`/home/user/work/zone-red-forest-d`), L2 s4, L3 s2, L4 s5, L5 s1, L6 s1,
L7 s4 (`-b`), L8 s1, L9 s2, L10 s5 (`-c`), L11 s1. Четыре фразы переписаны из-за ударений: «порЫжели», «соснЫ»,
«вОлков», «припЯть» в вопросе (теперь «лес тут стал рыжим», «Волки. Их в Зоне…», «или в мёртвый город?»).
