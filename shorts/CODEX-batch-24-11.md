Сгенерируй фотореалистичные картинки для 6 вертикальных роликов YouTube Shorts (реальные истории выживания). У каждой истории своя папка shorts/<папка>/img и 8 кадров 01.jpg … 08.jpg.

Требования ко всем картинкам:
- ВЕРТИКАЛЬНО 9:16;
- фотореалистично, как кадр из документального фильма: естественный свет, лёгкое плёночное зерно, единый стиль внутри истории;
- никакого текста, букв, цифр, номеров, табличек и логотипов (у самолёта — без ливреи авиакомпании; у вертолёта — без надписей);
- лица людей не показывать: со спины, сбоку в тени, издалека, только руки (это реальные люди);
- без крови, ран и тел.

Качество (кадры потом приближаются камерой):
- генерируй в максимальном разрешении и качестве;
- увеличь Real-ESRGAN (realesrgan-ncnn-vulkan, realesrgan-x4plus) и приведи к ровно 2160×3840 (лишнее обрежь), JPG качество 92;
- просмотри каждый кадр в увеличении: лишние пальцы, буквы, логотипы — перегенерируй.

К каждому запросу добавь в начало строку «Префикс» своей истории. Кадр 01 — обложка, он должен цеплять сразу.

Делай по одной истории и после КАЖДОЙ коммить и пушь в claude/real-stories; если push отклонён — сделай git pull --no-rebase origin claude/real-stories и пушь снова (img/ я не трогаю, конфликтов не будет).

## Семья 40 лет жила в тайге и не знала о войне (Лыковы) — папка shorts/lykovy-taiga/img

Префикс: "Photorealistic cinematic documentary still, vertical 9:16, remote Siberian taiga mountains, 1970s, natural light, film grain, no text, no letters, no logos, no faces."

01.jpg — View from a 1970s helicopter window over endless wild Siberian taiga mountains and a river valley, morning mist
02.jpg — Tiny vegetable garden of potato rows on a steep forested mountain slope, seen from the air, a single smoke trail
03.jpg — A crude, blackened log hut half sunk into the ground in deep taiga, birch bark and moss, smoke from the roof
04.jpg — Two geologists in 1970s field gear seen from behind walking through dense taiga toward a hidden hut
05.jpg — Inside a dark tiny hut: birch bark vessels, a spinning wheel, homespun clothes hanging, a small window, candle light
06.jpg — Hands in homespun linen sleeves holding an old leather-bound book by candle light, close-up, no readable text
07.jpg — An old woman in a headscarf and homespun dress seen from behind, standing by a taiga river with a wooden bucket
08.jpg — Golden autumn taiga valley with a lonely smoke from a hut far below, peaceful and vast

## Самолёт сел на реку посреди города — живы все 155 — папка shorts/hudson-landing/img

Префикс: "Photorealistic cinematic documentary still, vertical 9:16, New York, cold January day 2009, natural light, film grain, no text, no letters, no logos, no airline livery, no faces."

01.jpg — A white twin-engine passenger airliner without any logos floating on a grey icy river with a city skyline behind, people standing on its wings
02.jpg — A flock of large geese flying straight into the jet engine of a climbing airliner, dramatic close-up, feathers
03.jpg — Jet engine on an airliner wing with smoke trailing, grey winter sky, from a passenger window
04.jpg — Cockpit seen from behind the two pilots, hands on the controls, a river and city towers ahead through the windscreen, no readable instruments
05.jpg — Wide shot of the airliner gliding low over a wide river between skyscrapers, very close to the water
06.jpg — Passengers in winter coats standing on the wing of the airliner in the river, seen from behind, waiting
07.jpg — Commuter ferries and small boats surrounding the floating airliner, people being helped aboard
08.jpg — The airliner half submerged in the river at dusk, city lights coming on, calm

## 60 часов на дне в перевёрнутом корабле — папка shorts/okene-air-pocket/img

Префикс: "Photorealistic cinematic documentary still, vertical 9:16, Atlantic Ocean off West Africa, 2013, dramatic light, film grain, no text, no letters, no logos, no faces, no gore."

01.jpg — A small ocean tugboat capsizing in huge storm waves at night, spray, dark sky
02.jpg — Upside-down ship hull resting on the dark sea floor at 30 metres, faint blue light from above, eerie
03.jpg — Inside a flooded overturned cabin in near darkness: a man up to his chest in black water in a small air pocket under the floor, seen from behind, faint light
04.jpg — A dive light beam cutting through murky water inside a flooded ship corridor, debris floating
05.jpg — A scuba diver in a helmet with a headlamp swimming through a narrow flooded ship passage
06.jpg — Close-up underwater: a bare human hand reaching out of the dark water and grabbing a diver's gloved hand
07.jpg — A small steel decompression chamber on the deck of a support vessel, divers around it, evening light
08.jpg — Sunrise over a calm tropical sea, a support vessel in the distance, hopeful

## 41 час в застрявшем лифте — папка shorts/elevator-41h/img

Префикс: "Photorealistic cinematic still, vertical 9:16, New York office skyscraper, 1999, cold fluorescent light, film grain, no text, no letters, no logos, no readable numbers, no faces."

01.jpg — An old wood-panelled office elevator interior, empty, harsh fluorescent light, doors closed
02.jpg — Night view up a tall office skyscraper with few lit windows, Manhattan, Friday night
03.jpg — A man in a suit seen from behind pressing the elevator call button panel, buttons without readable numbers
04.jpg — Black-and-white security camera view from the ceiling corner of an elevator: a man lying on the floor in a suit, grainy
05.jpg — Close-up of fingers trying to pry open closed elevator doors, a thin dark gap
06.jpg — Elevator ceiling hatch and dim light seen from the floor, claustrophobic
07.jpg — Elevator doors opening, firefighters' silhouettes against a bright corridor, seen from inside
08.jpg — Early morning city street outside the skyscraper, a man in a crumpled suit walking away, seen from behind

## 20 часов в открытом море после падения с лайнера — папка shorts/cruise-overboard/img

Префикс: "Photorealistic cinematic documentary still, vertical 9:16, Gulf of Mexico, 2022, natural light, film grain, no text, no letters, no logos, no faces."

01.jpg — A huge lit cruise ship at night seen from the dark sea level, sailing away
02.jpg — A lone man in dark water at night treading water, head and shoulders above the waves, seen from behind, ship lights far away
03.jpg — Pitch-dark open sea under stars, a tiny figure in the water, vast emptiness
04.jpg — Jellyfish glowing faintly near the surface of the dark sea, close-up
05.jpg — Dawn over the open sea, a small human head among the waves in the far distance
06.jpg — A rescue helicopter flying low over the sea with its door open, morning light, no markings
07.jpg — A rescue swimmer in a wetsuit lowered on a cable to a man in the water, spray from the rotor wash
08.jpg — Calm sea at sunset after the rescue, the helicopter flying toward the coast

## 76 дней на плоту посреди океана — папка shorts/callahan-raft/img

Префикс: "Photorealistic cinematic documentary still, vertical 9:16, Atlantic Ocean, 1982, natural light, film grain, no text, no letters, no logos, no faces."

01.jpg — A small sailing yacht sinking at night in the Atlantic, its stern going under, waves, dramatic
02.jpg — A tiny round orange inflatable life raft alone on a vast blue ocean, seen from above
03.jpg — Inside an inflatable life raft: a man's sunburned hands holding a spear gun, seen from behind, ocean around
04.jpg — Bright golden dorado fish swimming right under the floor of a life raft, underwater view
05.jpg — A small inflatable solar still (plastic balloon) floating next to the raft collecting drops of fresh water, close-up
06.jpg — Storm at sea: the orange life raft lifted on a huge wave, grey sky, spray
07.jpg — A wooden fishing boat with three fishermen approaching the faded orange raft, tropical island behind
08.jpg — A green tropical island with a beach at sunset seen from the sea, hopeful

В конце проверь, что в каждой из 6 папок ровно 8 файлов 2160×3840.
