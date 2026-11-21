Сгенерируй 8 фотореалистичных картинок для вертикального ролика «Волки Чернобыля» (YouTube Shorts) и сохрани их в папку shorts/chernobyl-wolves/img: файлы 01.jpg … 08.jpg (см. «Качество»).

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

К каждому запросу ниже добавь в начало: "Photorealistic cinematic nature documentary still, vertical 9:16, Chernobyl exclusion zone, natural light, film grain, no text, no letters, no logos."

01.jpg — A grey wolf standing on an empty overgrown street of the abandoned city of Pripyat, looking straight at the camera, Soviet apartment blocks behind, mysterious
02.jpg — An empty street of Pripyat overgrown with trees and bushes, abandoned buildings, no people, quiet
03.jpg — Wolf paw tracks in fresh snow on an abandoned cracked road
04.jpg — Night camera-trap image: a wolf caught in grainy black-and-white infrared light between trees, no timestamp or text
05.jpg — A wolf pack walking in a line through a snowy birch forest
06.jpg — Wild Przewalski's horses and a moose grazing in a meadow in the zone, an abandoned house in the background
07.jpg — A researcher fixing a small camera trap to a tree trunk in the forest, seen from behind, no face
08.jpg — A wolf howling at dusk near abandoned buildings, purple sky

Кадр 01 — обложка: он должен цеплять сразу. Когда закончишь, проверь, что в папке shorts/chernobyl-wolves/img ровно 8 файлов 2160×3840, сделай коммит и запушь в ветку claude/real-stories.
