Сгенерируй 8 фотореалистичных картинок для вертикального ролика «Собаки Чернобыля и их ДНК» (YouTube Shorts) и сохрани их в папку shorts/chernobyl-dogs/img: файлы 01.jpg … 08.jpg (см. «Качество»).

Требования ко всем картинкам:
- вертикально 9:16;
- фотореалистично, как кадр из документального фильма: естественный свет, лёгкое плёночное зерно;
- никакого текста, букв, цифр, номеров, табличек и логотипов на картинке (на приборах — без читаемых цифр);
- лица людей не показывать: защитные костюмы, респираторы, вид со спины или сбоку, только руки в перчатках;
- без крови, ран и мёртвых животных.

Качество (важно — кадры потом приближаются камерой, поэтому нужна чёткость):
- генерируй в максимальном разрешении и максимальном качестве, какие даёт Codex;
- затем увеличь каждый кадр ИИ-апскейлером Real-ESRGAN (realesrgan-ncnn-vulkan, модель realesrgan-x4plus; Windows-сборка лежит в релизах github.com/xinntao/Real-ESRGAN), а не простым растягиванием;
- приведи к ровно 2160×3840 (9:16, лишнее обрежь по краям) и сохрани как JPG с качеством 92: 01.jpg, 02.jpg … (PNG такого размера слишком тяжёлые для git);
- просмотри каждый кадр в увеличении: лишние пальцы, кривые лица, буквы и логотипы — перегенерируй.

К каждому запросу ниже добавь в начало: "Photorealistic cinematic documentary still, vertical 9:16, Chernobyl exclusion zone today, natural light, film grain, no text, no letters, no logos."

01.jpg — Close-up portrait of a stray dog with intelligent amber eyes in front of an abandoned grey Soviet building, overcast sky, emotional
02.jpg — Several stray dogs resting near the Chernobyl nuclear power plant, the huge steel arch of the New Safe Confinement in the background far away, grey day
03.jpg — A stray dog sitting on an old street of the small town of Chernobyl among trees and old Soviet houses, calm
04.jpg — Aerial view of the exclusion zone: endless forest, a river, the nuclear power plant small on the horizon, a road leading away
05.jpg — A researcher in gloves gently holding a calm stray dog while another person fits a collar on it, seen from behind, faces not visible, friendly
06.jpg — Modern genetics laboratory: rows of small test tubes in a rack, a DNA sequencer machine with soft blue light, gloved hand, no readable screens
07.jpg — A litter of puppies sleeping together in straw near an abandoned building, warm soft light
08.jpg — A lone dog sitting on an empty road in the zone at sunset, seen from behind, looking toward the distant power plant

Кадр 01 — обложка: он должен цеплять сразу. Когда закончишь, проверь, что в папке shorts/chernobyl-dogs/img ровно 8 файлов 2160×3840, сделай коммит и запушь в ветку claude/real-stories.
