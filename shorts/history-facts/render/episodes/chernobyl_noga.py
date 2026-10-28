"""Тайны истории №15: «Слоновья нога» (лава под реактором).

vla 28.10 said «Давай» to the story №14's ending teases: the frozen lava under the reactor. Five minutes next to it in
1986 gave a lethal dose; it was found in December 1986 in a corridor right under the destroyed reactor; it is fuel
melted together with sand and concrete that flowed down; its folds gave it the name; a drill could not bite it, so
the sample was shot off with a rifle; it is dangerous because the nuclear fuel itself is inside; it is weaker now but
still not to be approached, hence the arch over the reactor. The tease into a next story: on the roof next door,
where even the robots broke, men were sent, the «biorobots» (sources in chernobyl1986_noga/factcheck.md).
Voice «Историк» (h4_s52). Pictures: vla's PC (Juggernaut XL, chernobyl1986_noga/shots_pc.json, two or three seeds
each) plus a few earlier Chernobyl frames copied into this episode's shots; the ids below are picked by seed.
"""
import numpy as np

DISPLAY = {
    'L1': 'ПЯТЬ МИНУТ РЯДОМ С ЭТОЙ ШТУКОЙ, И ДОЗА УЖЕ СМЕРТЕЛЬНАЯ.',
    'L2': 'ЕЁ НАШЛИ В ДЕКАБРЕ 86-ГО{восемьдесят шестого} ПРЯМО ПОД ВЗОРВАННЫМ РЕАКТОРОМ.',
    'L3': 'ЭТО ЛАВА: ТОПЛИВО РАСПЛАВИЛОСЬ ВМЕСТЕ С ПЕСКОМ И БЕТОНОМ И ПОТЕКЛО ВНИЗ.',
    'L4': 'ИЗ-ЗА СКЛАДОК ЕЁ ПРОЗВАЛИ СЛОНОВЬЕЙ НОГОЙ.',
    'L5': 'ЕЁ НЕ БРАЛ ДАЖЕ БУР, И КУСОЧЕК ДЛЯ АНАЛИЗА ПРИШЛОСЬ ОТСТРЕЛИТЬ ИЗ ВИНТОВКИ.',
    'L6': 'ПОЧЕМУ ОНА ТАКАЯ ОПАСНАЯ? ВНУТРИ ТО САМОЕ ЯДЕРНОЕ ТОПЛИВО.',
    'L7': 'СЕЙЧАС ОНА СЛАБЕЕ, НО ПОДХОДИТЬ К НЕЙ ВСЁ ЕЩЁ НЕЛЬЗЯ. ПОЭТОМУ НАД РЕАКТОРОМ ПОСТРОИЛИ ОГРОМНУЮ АРКУ.',
    'L8': 'А НА КРЫШУ РЯДОМ, ГДЕ ЛОМАЛИСЬ ДАЖЕ РОБОТЫ, ПОСЛАЛИ ЛЮДЕЙ. ИХ ЗВАЛИ БИОРОБОТАМИ.',
    'L9': 'ПОДПИШИСЬ, ЧТОБЫ НЕ ПРОПУСКАТЬ ДРУГИЕ КРУТЫЕ ИСТОРИИ.',
}
HILITE = {'ПЯТЬ', 'МИНУТ', 'СМЕРТЕЛЬНАЯ.', 'ДЕКАБРЕ', '86-ГО', 'ВЗОРВАННЫМ', 'РЕАКТОРОМ.', 'ЛАВА:', 'ТОПЛИВО',
          'РАСПЛАВИЛОСЬ', 'ВНИЗ.', 'СКЛАДОК', 'СЛОНОВЬЕЙ', 'НОГОЙ.', 'БУР,', 'ОТСТРЕЛИТЬ', 'ВИНТОВКИ.',
          'ОПАСНАЯ?', 'ЯДЕРНОЕ', 'СЛАБЕЕ,', 'НЕЛЬЗЯ.', 'АРКУ.', 'КРЫШУ', 'РОБОТЫ,', 'ЛЮДЕЙ.', 'БИОРОБОТАМИ.'}

# gap (s) after each line before the next one starts (voice5/tools/gaps_used.py keeps the narrator's own pauses where
# they are longer); after L1 the hook settles, after L4 the name lands, after L5 the shot's echo rolls away, after L8
# the tease hangs before the plaque
GAPS = {'L1': 0.6, 'L2': 0.25, 'L3': 0.3, 'L4': 0.5, 'L5': 0.6, 'L6': 0.4, 'L7': 0.3, 'L8': 0.6, 'L9': 0.0}
GAP_MAX = 0.3
LEAD_IN = 0.15
TAIL = 0.6                         # the plaque holds a moment after «истории», then a white flash loops to the cover
LOOP = True
COVER = dict(tag='ТАЙНЫ ИСТОРИИ · №15', year='1986', lines=['СЛОНОВЬЯ', 'НОГА'],
             # the preview cover (thumb.py, chernobyl1986_noga/thumbs.json) in the first frames, so YouTube's frame
             # picker can take it; the other variant sits next to it in covers/
             img='/mnt/project-files/history-facts/chernobyl1986_noga/covers/noga.jpg')
COVER_B = ['5 МИНУТ РЯДОМ', 'СМЕРТЕЛЬНО']
# the narrator says the plaque's words (L9, no bottom captions), so it comes up with «подпишись»
ENDCARD = dict(tag='ТАЙНЫ ИСТОРИИ · №15', over_last=0.0, lines=['ЧТОБЫ НЕ ПРОПУСКАТЬ', 'ДРУГИЕ КРУТЫЕ ИСТОРИИ'])
# stills from vla's PC (shots_pc.json, Juggernaut XL, drawn 28.10), chosen by seed; where a shot comes twice, the
# second seed gives the second appearance a new picture; the foot is the n01b redraw (the first prompt drew a pile of
# rubble). LAVA, REACTOR and SHELTER come from №10, №11 and №14 (copied into this episode's shots)
FOOT = 'n01b_foot_s6202'             # the wrinkled glossy black column flaring at its foot in the corridor (hook, plaque)
FOOT2 = 'n01b_foot_s6201'            # the same up close, for «слоновьей ногой»
FOOT3 = 'n01b_foot_s6203'            # the same by the windows, for «сейчас она слабее»
FOLDS = 'n02_foot_close_s6011'       # the folds up close, for «из-за складок»
FOLDS2 = 'n02_foot_close_s6012'      # the same, for «почему она такая опасная?»
DOSE = 'n03_dosimeter_s6021'         # a dosimeter's needle at the stop, for «доза смертельная»
CORRIDOR = 'n04_corridor_s6031'      # two liquidators with flashlights in the corridor, for «её нашли»
REACTOR = 'k09_dawn_s2081'           # №11's destroyed fourth block at dawn, for «под взорванным реактором»
LAVA = 'c03_lava_s1021'              # №10's glowing lava on the floor under the reactor, for «это лава»
FLOW = 'n05_flow_s6041'              # lava pouring down a pipe and steps, for «потекло вниз»
DRILL = 'n06_drill_s6051'            # the drill cart against the black mass, sparks
SHOOTER = 'n07_marksman_s6062'       # a soldier in a respirator with a rifle coming down the corridor
SAMPLE = 'n08_sample_s6071'          # a glowing yellow chip in a gloved hand over a tray, for «ядерное топливо»
ARCH = 'n10_arch_inside_s6091'       # inside a giant arched hangar, for «поэтому над реактором»
SHELTER = 'm12b_shelter_s5211'       # №14's cover over the reactor with the red-and-white stack, for «огромную арку»
ROBOT = 'n11_robot_s6101'            # a tracked robot stuck on the roof among graphite and smoke, for «ломались даже роботы»
MEN = 'n12_biorobots_s6111'          # men in lead aprons and gas masks running with shovels, for «послали людей»
MEN2 = 'n12_biorobots_s6112'         # the same, for «биороботами»
SFX_DIRS = ['/home/user/work/sfx/noga', '/home/user/work/sfx/mutanty', '/home/user/work/sfx/chernobyl',
            '/home/user/work/sfx/knopka', '/home/user/work/sfx/rescue', '/home/user/work/sfx/olga', '/home/user/work/sfx']
DUCK = (-12.0, -10.0)

BPM = 70.0
BEAT = 60.0 / BPM
LOOP_S = 16 * BEAT                 # every music loop of the kit is 4 bars
SR = 48000


def _wt(words, lines, lid, prefix, nth=0):
    k = 0
    for w, a, b in words[lid]:
        if w.startswith(prefix):
            if k == nth:
                return a
            k += 1
    return lines[lid]['start']


def plan(lines, words):
    """Music sections and sync points shared by the picture (camera beats) and the mix."""
    wt = lambda *a, **k: _wt(words, lines, *a, **k)
    p = {}
    p['hook'] = (0.0, lines['L1']['end'] + 0.2)
    p['five'] = wt('L1', 'ПЯТЬ')
    p['dose'] = wt('L1', 'ДОЗА')
    p['deadly'] = wt('L1', 'СМЕРТЕЛЬНАЯ')
    p['dec'] = wt('L2', 'ДЕКАБРЕ')
    p['under'] = wt('L2', 'ПОД')
    p['blown'] = wt('L2', 'ВЗОРВАННЫМ')
    p['lava'] = wt('L3', 'ЛАВА')
    p['melted'] = wt('L3', 'РАСПЛАВИЛОСЬ')
    p['flowed'] = wt('L3', 'ПОТЕКЛО')
    p['folds'] = wt('L4', 'СКЛАДОК')
    p['foot'] = wt('L4', 'СЛОНОВЬЕЙ')
    p['drill'] = wt('L5', 'БУР')
    p['piece'] = wt('L5', 'КУСОЧЕК')
    p['shoot'] = wt('L5', 'ОТСТРЕЛИТЬ')
    p['rifle'] = wt('L5', 'ВИНТОВКИ')
    p['why'] = wt('L6', 'ПОЧЕМУ')
    p['inside'] = wt('L6', 'ВНУТРИ')
    p['fuel'] = wt('L6', 'ЯДЕРНОЕ')
    p['now'] = wt('L7', 'СЕЙЧАС')
    p['never'] = wt('L7', 'НЕЛЬЗЯ')
    p['so'] = wt('L7', 'ПОЭТОМУ')
    p['arch'] = wt('L7', 'ОГРОМНУЮ')
    p['roof'] = wt('L8', 'КРЫШУ')
    p['robots'] = wt('L8', 'РОБОТЫ')
    p['sent'] = wt('L8', 'ПОСЛАЛИ')
    p['called'] = wt('L8', 'ИХ')
    p['bio'] = wt('L8', 'БИОРОБОТАМИ')
    p['sub'] = lines['L9']['start']
    return p


def _beat(seg, end, **k):
    return dict(t0=seg[0], t1=end, grid=seg[0], period=2 * BEAT, **k)


def layout(c):
    L, add, wt, total = c.L, c.add, c.word_t, c.total
    p = plan(c.lines, c.words)
    dark = dict(exposure=-0.03, contrast=1.12, sat=0.7, warm=-0.08, demagenta=0.3)       # the corridor, cold
    hot = dict(exposure=0.02, contrast=1.1, sat=0.95, warm=0.35, demagenta=0.2)          # the lava, glowing
    day = dict(exposure=0.0, contrast=1.08, sat=0.75, warm=0.05, demagenta=0.3)
    hook = _beat(p['hook'], p['hook'][1], zoom=0.02, sway=0.3)
    white = (1.0, 0.97, 0.9)

    # L1 hook: the mass in the flashlight beam; the dosimeter's needle at the stop on «доза»
    ds = p['dose'] - 0.06
    l2 = L('L2')['start'] - 0.08
    add(FOOT, 0.0, ds, cam=dict(zoom=(1.12, 1.22), dolly=(0.0, 0.05), parx=(-6, 6)),
        fx=dict(dust=30, beat=[hook], punch=[(p['five'], 0.06)], grade=dark))
    add(DOSE, ds, l2, into='flash', cam=dict(zoom=(1.05, 1.15), dolly=(0.0, 0.05)),
        fx=dict(dust=12, beat=[hook], punch=[(p['deadly'], 0.07)], grade=dark))
    # L2 found in December 1986, right under the blown-up reactor
    un = p['under'] - 0.06
    l3 = L('L3')['start'] - 0.08
    add(CORRIDOR, l2, un, into='fade', cam=dict(zoom=(1.0, 1.08), dolly=(0.0, 0.05), parx=(-6, 6)),
        fx=dict(dust=20, punch=[(p['dec'], 0.04)], grade=dark))
    add(REACTOR, un, l3, into='flash', cam=dict(zoom=(1.02, 1.1), pany=(0.02, 0.0), parx=(-8, 8)),
        fx=dict(dust=15, fog=0.15, punch=[(p['blown'], 0.05)], grade=day))
    # L3 it is lava: the fuel melted with sand and concrete and flowed down
    fl = p['flowed'] - 0.06
    l4 = L('L4')['start'] - 0.08
    add(LAVA, l3, fl, into='flash', cam=dict(zoom=(1.0, 1.1), dolly=(0.0, 0.04)),
        fx=dict(dust=20, bloom=0.3, punch=[(p['lava'], 0.06)], grade=hot))
    add(FLOW, fl, l4, into='fade', cam=dict(zoom=(1.02, 1.1), pany=(-0.02, 0.02)),
        fx=dict(dust=20, bloom=0.3, grade=hot))
    # L4 the folds up close, then the whole foot on «слоновьей ногой»
    ft = p['foot'] - 0.06
    l5 = L('L5')['start'] - 0.08
    add(FOLDS, l4, ft, into='fade', cam=dict(zoom=(1.0, 1.1), panx=(-0.02, 0.02)),
        fx=dict(dust=25, punch=[(p['folds'], 0.04)], grade=dark))
    add(FOOT2, ft, l5, into='flash', cam=dict(zoom=(1.05, 1.18), dolly=(0.0, 0.06), parx=(-6, 6)),
        fx=dict(dust=30, punch=[(p['foot'], 0.1)], grade=dark))
    # L5 the drill can't bite it, so a piece is shot off: the drill cart, then the marksman
    sh = p['shoot'] - 0.06
    l6 = L('L6')['start'] - 0.08
    add(DRILL, l5, sh, into='flash', cam=dict(zoom=(1.0, 1.08), dolly=(0.0, 0.04)),
        fx=dict(dust=25, punch=[(p['drill'], 0.05)], shake=[(p['drill'], 1.0, 4)], grade=dark))
    add(SHOOTER, sh, l6, into='flash', cam=dict(zoom=(1.05, 1.15), dolly=(0.0, 0.05)),
        fx=dict(dust=25, punch=[(p['rifle'] + 0.65, 0.12)], flash=[(p['rifle'] + 0.65, 0.12, 0.6, white)],
                shake=[(p['rifle'] + 0.65, 0.5, 12)],
                grade=dark))
    # L6 why it's dangerous: the folds again, then the chip with the fuel glowing inside
    ins = p['inside'] - 0.06
    l7 = L('L7')['start'] - 0.08
    add(FOLDS2, l6, ins, into='fade', cam=dict(zoom=(1.0, 1.1), dolly=(0.0, 0.05)),
        fx=dict(dust=30, punch=[(p['why'], 0.04)], grade=dark))
    add(SAMPLE, ins, l7, into='flash', cam=dict(zoom=(1.05, 1.18), dolly=(0.0, 0.06)),
        fx=dict(dust=10, bloom=0.3, punch=[(p['fuel'], 0.07)], grade=dict(dark, sat=0.9)))
    # L7 weaker now but still off limits, so the arch: the mass under a cold lamp, the arch from inside, then outside
    so = p['so'] - 0.06
    ar = p['arch'] - 0.06
    l8 = L('L8')['start'] - 0.08
    add(FOOT3, l7, so, into='fade', cam=dict(zoom=(1.0, 1.08), dolly=(0.0, 0.04)),
        fx=dict(dust=25, punch=[(p['never'], 0.05)], grade=dict(dark, warm=-0.2)))
    add(ARCH, so, ar, into='flash', cam=dict(zoom=(1.0, 1.08), pany=(0.02, -0.02)),
        fx=dict(dust=12, grade=day))
    add(SHELTER, ar, l8, into='fade', cam=dict(zoom=(1.02, 1.12), pany=(0.02, 0.0), parx=(-6, 6)),
        fx=dict(dust=10, grade=day))
    # L8 the tease: the broken robot on the roof, then the men with shovels, «биороботами»
    st = p['sent'] - 0.06
    bi = p['bio'] - 0.06
    sub = p['sub'] - 0.08
    add(ROBOT, l8, st, into='flash', cam=dict(zoom=(1.0, 1.08), dolly=(0.0, 0.04), parx=(-6, 6)),
        fx=dict(dust=20, fog=0.15, punch=[(p['robots'], 0.05)], grade=day))
    add(MEN, st, bi, into='flash', cam=dict(zoom=(1.02, 1.1), panx=(-0.02, 0.02)),
        fx=dict(dust=25, fog=0.15, grade=day))
    add(MEN2, bi, sub, into='flash', cam=dict(zoom=(1.05, 1.15), dolly=(0.0, 0.05)),
        fx=dict(dust=25, fog=0.15, punch=[(p['bio'], 0.1)], grade=day))
    # L9 «подпишись...»: the hook's foot takes the plaque, then a white flash loops to the cover
    add(FOOT, sub, total, into='fade', cam=dict(zoom=(1.02, 1.1), pany=(0.0, 0.02), parx=(-4, 4)),
        fx=dict(dust=20, flash=[(total - 0.3, 0.35, 2.0, white)], grade=dark))

    cards = []
    tags = [
        dict(text='1986 · 10 000 РЕНТГЕН В ЧАС', start=p['dose'] + 0.05, end=l2 - 0.05),
        dict(text='ДЕКАБРЬ 1986 · ПОД 4-М БЛОКОМ', start=L('L2')['start'] + 0.05, end=l3 - 0.05),
        dict(text='НОВЫЙ САРКОФАГ · 2016', start=p['so'] + 0.05, end=l8 - 0.05),
        dict(text='КРЫША 3-ГО БЛОКА · 1986', start=L('L8')['start'] + 0.05, end=sub - 0.05),
    ]
    cover = dict(start=0.0, end=p['five'] - 0.1)
    hook_text = dict(lines=['L1'], y=1330, size=84)
    return dict(cards=cards, tags=tags, cover=cover, hook_text=hook_text, no_caps=['L9'])


def mix_cues(m, tl, a):
    L = tl['lines']
    put_hit, sfx, wt = a.put_hit, a.sfx, a.wt
    p = plan(L, tl['words'])
    total = tl['total']

    def loop(bus, name, t0, t1, gain, grid=None, fin=0.03, fout=0.08):
        x = sfx(name)
        if x is None or t1 <= t0:
            return
        g = t0 if grid is None else grid
        i0 = int(round(((t0 - g) % (len(x) / SR)) * SR)) % len(x)
        need = int(round((t1 - t0) * SR))
        reps = (i0 + need) // len(x) + 2
        m.put(bus, np.concatenate([x] * reps)[i0:i0 + need], t0, gain, fade_in=fin, fade_out=fout)

    # --- hook: the counter crackling in the corridor, the flashlight clicks on, a hit on «смертельная»
    h0, h1 = p['hook']
    loop('beds', 'drone_bed_tension', h0, L['L4']['end'] + 0.3, -10.0, fin=0.0, fout=0.4)
    loop('beds', 'basement_hum', h0, L['L3']['start'], -15.0, fin=0.0, fout=0.3)
    loop('beds', 'geiger', h0, L['L2']['start'], -17.0, fin=0.0, fout=0.2)
    put_hit(m, 'boom_hook', 0.02, -10.0)
    put_hit(m, 'torch_click', 0.02, -12.0)
    put_hit(m, 'geiger_rise', p['dose'] - 0.4, -16.0)
    put_hit(m, 'drum_big', p['deadly'], -6.0)
    put_hit(m, 'sub_drop', p['deadly'], -8.0)
    # cuts get a soft whoosh, except where a hit already marks them
    loud = [p['deadly'], p['blown'], p['lava'], p['foot'], p['shoot'], p['rifle'] + 0.65, p['fuel'], p['arch'],
            p['robots'], p['bio'], p['sub']]
    for sh in tl['shots'][1:]:
        c = sh['start']
        if c < h1 or any(abs(c - x) < 0.4 for x in loud):
            continue
        put_hit(m, 'whoosh_short', c - 0.02, -14.0)
    # --- found under the reactor: a boom on «взорванным»; the lava pours and hisses under L3
    put_hit(m, 'impact_soft', p['dec'], -9.0)
    put_hit(m, 'drum_big', p['blown'], -7.0)
    put_hit(m, 'lava_pour', L['L3']['start'] - 0.2, -11.0)
    put_hit(m, 'impact_soft', p['lava'], -8.0)
    # --- the name: a big hit on «слоновьей ногой»
    put_hit(m, 'drum_big', p['foot'], -5.0)
    put_hit(m, 'sub_drop', p['foot'], -7.0)
    # --- the drill grinds and gives up, the rifle shot rings down the corridor right after «винтовки»
    loop('beds', 'pulse_dark', L['L5']['start'] - 0.1, L['L7']['start'], -11.0, fin=0.2, fout=0.3)
    put_hit(m, 'drill_grind', L['L5']['start'] - 0.3, -14.0)
    put_hit(m, 'rifle_shot', p['rifle'] + 0.65, -7.0)
    # --- why: the counter again and a drop on «ядерное топливо»
    loop('beds', 'geiger', p['inside'] - 0.3, L['L7']['start'] + 0.3, -17.0, fin=0.2, fout=0.3)
    put_hit(m, 'sub_drop', p['fuel'], -8.0)
    put_hit(m, 'drum_big', p['fuel'], -7.0)
    # --- now weaker, the arch: the sad piano, a soft hit on «огромную арку»
    loop('beds', 'piano_sad', L['L7']['start'] - 0.1, L['L8']['start'], -10.0, fin=0.3, fout=0.4)
    put_hit(m, 'impact_soft', p['never'], -9.0)
    put_hit(m, 'drum_big', p['arch'], -7.0)
    # --- the tease: the robot whines and dies, the shovels throw debris, a hit on «биороботами»
    loop('beds', 'drone_bed_tension', L['L8']['start'] - 0.1, p['sub'], -9.0, fin=0.2, fout=0.2)
    loop('beds', 'ambience_wind_dead_forest', L['L8']['start'] - 0.1, p['sub'], -16.0, fin=0.2, fout=0.3)
    put_hit(m, 'robot_die', L['L8']['start'] - 0.2, -13.0)
    put_hit(m, 'debris_throw', p['sent'] - 0.1, -12.0)
    put_hit(m, 'drum_big', p['bio'], -5.0)
    put_hit(m, 'sub_drop', p['bio'], -7.0)
    loop('beds', 'pad_hope', p['sub'] - 0.1, total, -11.0, fin=0.4, fout=0.03)
    put_hit(m, 'riser_2s', total - 0.02, -9.0)
    ec = tl.get('endcard')
    if ec:
        put_hit(m, 'whoosh_short', ec['start'] - 0.12, -10.0)
