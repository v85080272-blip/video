"""Тайны истории №11: «Кнопка, которая взорвала реактор» (Чернобыль, ночь на 26 апреля 1986).

vla 27.10: №10 «очень понравилось людям», more Chernobyl with a hook at the start and an ending that makes people
want the next clip; vla picked this one first of the four on the card. The night test on unit 4: the power falls
almost to zero, nearly all the rods are pulled out to raise it, the emergency button is pressed at 1:23 and the rods'
graphite tips first push the power up; two blasts. The why: the reactor's design and the broken rules, not the button
(sources and what we leave out in chernobyl1986_knopka/factcheck.md). The ending turns to Pripyat waking up with no
warning, the hook into №12 «Вещи на три дня». Voice «Историк» (h4_s52). Pictures: vla's PC (Juggernaut XL,
chernobyl1986_knopka/shots_pc.json, two seeds each); the ids below are picked by seed once the frames are in.
"""
import numpy as np

DISPLAY = {
    'L1': 'РЕАКТОР ЧЕРНОБЫЛЯ ВЗОРВАЛСЯ ЧЕРЕЗ НЕСКОЛЬКО СЕКУНД ПОСЛЕ НАЖАТИЯ АВАРИЙНОЙ КНОПКИ.',
    'L2': 'НОЧЬ, 26{двадцать шестое} АПРЕЛЯ. НА ЧЕТВЁРТОМ БЛОКЕ ИДЁТ ИСПЫТАНИЕ.',
    'L3': 'МОЩНОСТЬ ПАДАЕТ ПОЧТИ ДО НУЛЯ. ЧТОБЫ ПОДНЯТЬ ЕЁ, ВЫНИМАЮТ ПОЧТИ ВСЕ СТЕРЖНИ, ХОТЯ ТАК НЕЛЬЗЯ.',
    'L4': 'В 1:23{час двадцать три} ОПЕРАТОР ЖМЁТ КНОПКУ АВАРИЙНОЙ ЗАЩИТЫ.',
    'L5': 'СТЕРЖНИ ИДУТ ВНИЗ, НО НА КОНЦАХ У НИХ ГРАФИТ, И РЕАКТОР НЕ ГАСНЕТ, А РАЗГОНЯЕТСЯ.',
    'L6': 'ДВА ВЗРЫВА СРЫВАЮТ С НЕГО МНОГОТОННУЮ КРЫШКУ.',
    'L7': 'ДЕЛО БЫЛО НЕ В КНОПКЕ, А В ОПАСНОЙ КОНСТРУКЦИИ РЕАКТОРА И НАРУШЕНИЯХ НА ИСПЫТАНИИ.',
    'L8': 'А ПРИПЯТЬ ПРОСЫПАЛАСЬ, ДЕТИ ШЛИ В ШКОЛУ, И БОЛЬШЕ СУТОК ЛЮДЯМ НИЧЕГО НЕ ОБЪЯВЯТ.',
    'L9': 'ПОДПИШИСЬ, ЧТОБЫ НЕ ПРОПУСКАТЬ ДРУГИЕ КРУТЫЕ ИСТОРИИ.',
}
HILITE = {'ВЗОРВАЛСЯ', 'СЕКУНД', 'КНОПКИ.', '26', 'ИСПЫТАНИЕ.', 'НУЛЯ.', 'ВСЕ', 'СТЕРЖНИ,', 'НЕЛЬЗЯ.', '1:23',
          'КНОПКУ', 'ГРАФИТ,', 'РАЗГОНЯЕТСЯ.', 'ДВА', 'ВЗРЫВА', 'КРЫШКУ.', 'КНОПКЕ,', 'КОНСТРУКЦИИ', 'НАРУШЕНИЯХ',
          'ШКОЛУ,', 'СУТОК', 'НИЧЕГО'}

# gap (s) after each line before the next one starts (voice5/tools/gaps_used.py keeps the narrator's own pauses where
# they are longer); after L5 the runaway gets a beat before the blasts, after L6 the ruin settles
GAPS = {'L1': 0.35, 'L2': 0.2, 'L3': 0.3, 'L4': 0.3, 'L5': 0.6, 'L6': 0.6, 'L7': 0.35, 'L8': 0.3, 'L9': 0.0}
GAP_MAX = 0.3
LEAD_IN = 0.15
TAIL = 0.6                         # the plaque holds a moment after «истории», then a white flash loops to the cover
LOOP = True
COVER = dict(tag='ТАЙНЫ ИСТОРИИ · №11', year='1986', lines=['НАЖАЛИ СТОП', 'И ОН ВЗОРВАЛСЯ'],
             # the preview cover (thumb.py, chernobyl1986_knopka/thumbs.json) in the first frames, so YouTube's frame
             # picker can take it; the other variant sits next to it in covers/
             img='/mnt/project-files/history-facts/chernobyl1986_knopka/covers/nazhali_stop.jpg')
COVER_B = ['КНОПКА', 'ВЗОРВАЛА РЕАКТОР']
# the narrator says the plaque's words (L9, no bottom captions), so it comes up with «подпишись»
ENDCARD = dict(tag='ТАЙНЫ ИСТОРИИ · №11', over_last=0.0, lines=['ЧТОБЫ НЕ ПРОПУСКАТЬ', 'ДРУГИЕ КРУТЫЕ ИСТОРИИ'])
# stills from vla's PC (shots_pc.json, Juggernaut XL), chosen by seed; where a shot comes twice, the second seed gives
# the second appearance a new picture
CONTROL = 'k01_control_s2001'        # the control room at night, operators at the long panels
HALL = 'k02_hall_s2011'              # the reactor hall, the round lid of steel blocks
HALL2 = 'k02_hall_s2012'             # the same, for «конструкции реактора»
GAUGE = 'k03_gauge_s2021'            # a meter's needle fallen to zero
RODS = 'k04_rods_s2031'              # rods lifted out of the graphite stack
BUTTON = 'k05_button_s2041'          # a finger on the emergency button
BUTTON2 = 'k05_button_s2042'         # the button again, for «дело было не в кнопке»
CORE = 'k06_core_s2051'              # rods sliding down into the glowing core
CORE2 = 'k06_core_s2052'             # the glow rising, for «разгоняется»
ALARM = 'k07_alarm_s2061'            # the control room in red light
BLAST = 'k08_explosion_s2071'        # the fireball through the roof under the stack
BLAST2 = 'k08_explosion_s2072'       # the second blast, from another angle
DAWN = 'k09_dawn_s2081'              # the ruined block at dawn, smoke, fire trucks
OPERATOR = 'k10_operator_s2091'      # a young operator's tense face
PRIPYAT = 'k11_pripyat_s2101'        # the town on a sunny Saturday morning, children going to school
PRIPYAT2 = 'k11_pripyat_s2102'       # the same street, for «дети шли в школу»
WHEEL = 'k12_wheel_s2111'            # the Ferris wheel in the sun
NIGHT = 'k13_night_plant_s2121'      # the plant at night across the pond: room for the plaque
SFX_DIRS = ['/home/user/work/sfx/knopka', '/home/user/work/sfx/chernobyl', '/home/user/work/sfx/yamaguchi',
            '/home/user/work/sfx/rescue', '/home/user/work/sfx/olga', '/home/user/work/sfx']
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


def _we(words, lines, lid, prefix):
    for w, a, b in words[lid]:
        if w.startswith(prefix):
            return b
    return lines[lid]['end']


def plan(lines, words):
    """Music sections and sync points shared by the picture (camera beats) and the mix."""
    wt = lambda *a, **k: _wt(words, lines, *a, **k)
    p = {}
    p['hook'] = (0.0, lines['L1']['end'] + 0.2)
    p['blew'] = wt('L1', 'ВЗОРВАЛСЯ')
    p['secs'] = wt('L1', 'СЕКУНД')
    p['press1'] = wt('L1', 'НАЖАТИЯ')
    p['button1'] = wt('L1', 'КНОПКИ')
    p['night'] = (lines['L2']['start'] - 0.1, lines['L4']['end'] + 0.2)   # the test: the clock, the hum, the rods
    p['test'] = wt('L2', 'ИСПЫТАНИЕ')
    p['zero'] = wt('L3', 'НУЛЯ')
    p['pull'] = wt('L3', 'ВЫНИМАЮТ')
    p['all'] = wt('L3', 'ВСЕ')
    p['no'] = wt('L3', 'НЕЛЬЗЯ')
    p['t123'] = wt('L4', '1:23')
    p['press'] = wt('L4', 'ЖМЁТ')
    p['button'] = wt('L4', 'КНОПКУ')
    p['down'] = wt('L5', 'ВНИЗ')
    p['graphite'] = wt('L5', 'ГРАФИТ')
    p['speed'] = wt('L5', 'РАЗГОНЯЕТСЯ')
    p['speed_end'] = _we(words, lines, 'L5', 'РАЗГОНЯЕТСЯ')
    p['two'] = wt('L6', 'ДВА')
    p['blast1'] = wt('L6', 'ВЗРЫВА')
    p['blast2'] = wt('L6', 'СРЫВАЮТ')
    p['lid'] = wt('L6', 'КРЫШКУ')
    p['notbtn'] = wt('L7', 'КНОПКЕ')
    p['design'] = wt('L7', 'КОНСТРУКЦИИ')
    p['rules'] = wt('L7', 'НАРУШЕНИЯХ')
    p['town'] = wt('L8', 'ПРИПЯТЬ')
    p['kids'] = wt('L8', 'ДЕТИ')
    p['day'] = wt('L8', 'СУТОК')
    p['nothing'] = wt('L8', 'НИЧЕГО')
    p['sub'] = lines['L9']['start']
    return p


def _beat(seg, end, **k):
    return dict(t0=seg[0], t1=end, grid=seg[0], period=2 * BEAT, **k)


def layout(c):
    L, add, wt, total = c.L, c.add, c.word_t, c.total
    p = plan(c.lines, c.words)
    room = dict(exposure=-0.02, contrast=1.1, sat=0.7, warm=0.1, demagenta=0.3)          # the control room at night
    core = dict(exposure=0.02, contrast=1.12, sat=0.85, warm=-0.4, demagenta=0.2)        # the core, cold blue
    red = dict(exposure=0.0, contrast=1.14, sat=0.95, warm=0.5, demagenta=0.0)           # the alarm
    fire = dict(exposure=0.0, contrast=1.14, sat=0.9, warm=0.8)                          # the blasts
    ash = dict(exposure=-0.02, contrast=1.1, sat=0.6, warm=0.0, demagenta=0.3)           # the ruin at dawn
    town = dict(exposure=0.04, contrast=1.04, sat=0.9, warm=0.35, demagenta=0.2)         # Pripyat, sunny
    night = dict(exposure=-0.04, contrast=1.12, sat=0.75, warm=0.2, demagenta=0.3)
    hook = _beat(p['hook'], p['hook'][1], zoom=0.02, sway=0.3)
    test = _beat(p['night'], p['night'][1], zoom=0.012)
    white = (1.0, 0.97, 0.9)
    orange = (1.0, 0.6, 0.25)
    blue = (0.6, 0.85, 1.0)
    glow = dict(x=0.5, y=0.8, r=1.1, col=(0.1, 0.3, 0.6), flicker=0.2)
    fglow = dict(x=0.5, y=0.6, r=1.1, col=(0.5, 0.2, 0.03), flicker=0.3)

    # L1 hook: «реактор Чернобыля взорвался» on the blast, «...после нажатия аварийной кнопки» on the finger pressing it
    pr = p['press1'] - 0.06
    l2 = L('L2')['start'] - 0.08
    add(BLAST, 0.0, pr, cam=dict(zoom=(1.12, 1.2), pany=(0.02, 0.0), parx=(-6, 6)),
        fx=dict(embers=40, ash=20, bloom=0.7, light=fglow, beat=[hook], shake=[(p['blew'], 0.7, 20)],
                flash=[(p['blew'], 0.35, 0.7, orange)], punch=[(p['blew'], 0.08)], grade=fire))
    add(BUTTON, pr, l2, into='whip', cam=dict(zoom=(1.05, 1.16), dolly=(0.0, 0.06)),
        fx=dict(dust=15, beat=[hook], punch=[(p['button1'], 0.08)], flash=[(p['button1'], 0.25, 0.4, white)],
                grade=room))
    # L2 the night test: the control room, then the reactor hall on «испытание»
    ts = p['test'] - 0.06
    add(CONTROL, l2, ts, into='flash', cam=dict(zoom=(1.0, 1.1), panx=(-0.02, 0.02), parx=(-8, 8)),
        fx=dict(dust=15, beat=[_beat(p['night'], ts)], grade=room))
    l3 = L('L3')['start'] - 0.08
    add(HALL, ts, l3, into='fade', cam=dict(zoom=(1.0, 1.08), dolly=(0.0, 0.06), parx=(-6, 6)),
        fx=dict(dust=20, fog=0.15, punch=[(p['test'], 0.05)], grade=room))
    # L3 the power falls to zero (the needle), so nearly all the rods come out (the rods rising)
    pu = p['pull'] - 0.3
    add(GAUGE, l3, pu, into='fade', cam=dict(zoom=(1.05, 1.15), pany=(0.0, 0.02)),
        fx=dict(dust=10, punch=[(p['zero'], 0.06)], grade=room))
    l4 = L('L4')['start'] - 0.08
    add(RODS, pu, l4, into='whip', cam=dict(zoom=(1.0, 1.1), pany=(0.03, -0.03), parx=(-8, 8)),
        fx=dict(dust=20, bloom=0.5, light=glow, punch=[(p['all'], 0.05), (p['no'], 0.08)], grade=core))
    # L4 at 1:23 the operator presses the button: his face, then the finger
    bt = p['press'] - 0.06
    add(OPERATOR, l4, bt, into='flash', cam=dict(zoom=(1.05, 1.12), dolly=(0.0, 0.04)),
        fx=dict(dust=10, beat=[_beat(p['night'], bt, zoom=0.015)], punch=[(p['t123'], 0.05)], grade=room))
    l5 = L('L5')['start'] - 0.08
    add(BUTTON, bt, l5, into='whip', cam=dict(zoom=(1.12, 1.25), dolly=(0.0, 0.05)),
        fx=dict(dust=10, punch=[(p['press'], 0.1), (p['button'], 0.05)], flash=[(p['press'], 0.2, 0.35, white)],
                grade=room))
    # L5 the rods go down into the core, the graphite tips push it up: the glow rises, then the room goes red
    sp = p['speed'] - 0.06
    add(CORE, l5, sp, into='flash', cam=dict(zoom=(1.0, 1.12), pany=(-0.02, 0.02), parx=(-8, 8)),
        fx=dict(dust=20, bloom=0.8, light=glow, punch=[(p['down'], 0.05), (p['graphite'], 0.06)], grade=core))
    l6 = L('L6')['start'] - 0.08
    add(ALARM, sp, l6, into='flash', cam=dict(zoom=(1.05, 1.18), roll=(0.0, 1.5)),
        fx=dict(dust=40, bloom=0.6, shake=[(p['speed'], 0.4, 14)], punch=[(p['speed'], 0.08)],
                flash=[(p['speed'], 0.25, 0.5, (1.0, 0.25, 0.15))], grade=red))
    # L6 two blasts: the fireball, then from another side on «срывают», held on the lid
    b2 = p['blast2'] - 0.06
    add(BLAST, l6, b2, into='flash', cam=dict(zoom=(1.0, 1.1), pany=(0.0, -0.02), parx=(-10, 10)),
        fx=dict(dust=60, ash=40, embers=40, bloom=0.9, light=fglow, shake=[(p['blast1'], 1.0, 24)],
                flash=[(p['blast1'], 0.5, 0.9, orange)], punch=[(p['blast1'], 0.1)], grade=fire))
    l7 = L('L7')['start'] - 0.08
    add(BLAST2, b2, l7, into='flash', cam=dict(zoom=(1.05, 1.15), pany=(0.02, -0.02), parx=(-8, 8)),
        fx=dict(dust=60, ash=50, embers=50, bloom=0.9, light=fglow, shake=[(p['blast2'], 0.9, 22)],
                flash=[(p['blast2'], 0.45, 0.8, orange)], punch=[(p['blast2'], 0.1), (p['lid'], 0.05)], grade=fire))
    # L7 the why: not the button (the button again), the reactor's design (the hall), the broken rules (the ruin)
    ds = p['design'] - 0.06
    add(BUTTON2, l7, ds, into='fade', cam=dict(zoom=(1.1, 1.02)),
        fx=dict(dust=10, punch=[(p['notbtn'], 0.06)], grade=dict(room, sat=0.5)))
    rl = p['rules'] - 0.06
    add(HALL2, ds, rl, into='whip', cam=dict(zoom=(1.0, 1.1), dolly=(0.0, 0.05), parx=(-6, 6)),
        fx=dict(dust=20, fog=0.2, punch=[(p['design'], 0.05)], grade=room))
    l8 = L('L8')['start'] - 0.08
    add(DAWN, rl, l8, into='fade', cam=dict(zoom=(1.02, 1.1), panx=(0.02, -0.02), parx=(-6, 6)),
        fx=dict(dust=30, ash=30, punch=[(p['rules'], 0.05)], grade=ash))
    # L8 Pripyat waking up: the sunny street, the children going to school, the wheel, and nobody is told
    kd = p['kids'] - 0.06
    add(PRIPYAT, l8, kd, into='flash', cam=dict(zoom=(1.0, 1.08), pany=(0.0, 0.02), parx=(-8, 8)),
        fx=dict(dust=8, bloom=0.4, grade=town))
    dy = p['day'] - 0.4
    add(PRIPYAT2, kd, dy, into='fade', cam=dict(zoom=(1.05, 1.12), panx=(-0.02, 0.02)),
        fx=dict(dust=8, bloom=0.4, grade=town))
    sub = p['sub'] - 0.08
    add(WHEEL, dy, sub, into='fade', cam=dict(zoom=(1.0, 1.1), pany=(0.0, 0.03), parx=(-4, 4)),
        fx=dict(dust=8, bloom=0.4, punch=[(p['nothing'], 0.05)], grade=dict(town, sat=0.7)))
    # L9 «подпишись...»: the plant at night across the water, which takes the plaque, then a white flash loops to the
    # cover
    add(NIGHT, sub, total, into='fade', cam=dict(zoom=(1.02, 1.1), dolly=(0.0, 0.05), parx=(-4, 4)),
        fx=dict(dust=10, bloom=0.6, flash=[(total - 0.3, 0.35, 2.0, white)], grade=night))

    cards = []
    tags = [
        dict(text='ЧАЭС · 4-Й БЛОК · 1986', start=L('L2')['start'] + 0.05, end=l3 - 0.05),
        dict(text='КНОПКА АЗ-5', start=p['button'] + 0.1, end=l5 - 0.05),
        dict(text='ПРИПЯТЬ · СУББОТА', start=L('L8')['start'] + 0.05, end=kd - 0.05),
    ]
    cover = dict(start=0.0, end=p['blew'] - 0.15)
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

    # --- hook: the dark pulse, a blast on «взорвался», the button's clack on «кнопки»
    h0, h1 = p['hook']
    loop('beds', 'pulse_dark', h0, h1, -7.0, fin=0.0, fout=0.1)
    loop('beds', 'drone_bed_tension', h0, h1 + 0.3, -9.0, fin=0.0, fout=0.3)
    put_hit(m, 'boom_hook', 0.02, -9.0)
    put_hit(m, 'boom_big', p['blew'], -8.0)
    put_hit(m, 'button_press', p['button1'] - 0.05, -6.0)
    put_hit(m, 'drum_big', p['button1'], -5.0)
    # cuts get a soft whoosh, except where a hit already marks them
    loud = [p['blew'], p['button1'], p['test'], p['zero'], p['pull'], p['press'], p['speed'], p['blast1'],
            p['blast2'], p['notbtn'], p['design'], p['town'], p['sub']]
    for sh in tl['shots'][1:]:
        c = sh['start']
        if c < h1 or any(abs(c - x) < 0.4 for x in loud):
            continue
        put_hit(m, 'whoosh_short', c - 0.02, -14.0)
    # --- the night test: a clock ticking through the control room's hum, the rods lifted, a heartbeat on «нельзя»
    n0, n1 = p['night']
    loop('beds', 'drone_bed_tension', n0, n1, -10.0, fin=0.3, fout=0.2)
    loop('beds', 'basement_hum', n0, p['speed'], -14.0, fin=0.4, fout=0.2)
    t = n0 + 0.2
    while t < p['press'] - 0.3:
        put_hit(m, 'tick', t, -16.0)
        t += 1.0
    put_hit(m, 'sub_drop', p['zero'], -8.0)
    put_hit(m, 'rods_drive', p['pull'], -12.0)
    put_hit(m, 'heartbeat', p['no'], -7.0)
    # --- 1:23: the button pressed, the rods driven down, the power running away into the blasts
    put_hit(m, 'heartbeat', p['t123'], -8.0)
    put_hit(m, 'button_press', p['press'] - 0.05, -4.0)
    put_hit(m, 'impact_soft', p['press'], -7.0)
    put_hit(m, 'rods_drive', p['down'] - 0.1, -9.0)
    put_hit(m, 'surge', p['speed_end'] + 0.25, -8.0)        # climbs under «...не гаснет, а разгоняется», cut at the peak
    loop('beds', 'klaxon', p['speed'], p['blast1'] + 0.8, -18.0, fin=0.05, fout=0.4)
    # --- the two blasts, the fire, the glass; the Geiger counter from here on
    put_hit(m, 'boom_big', p['blast1'], -4.0)
    put_hit(m, 'shockwave', p['blast1'] + 0.05, -7.0)
    put_hit(m, 'glass_shatter', p['blast1'] + 0.1, -12.0)
    put_hit(m, 'boom_hook', p['blast2'], -6.0)
    put_hit(m, 'sub_drop', p['lid'], -8.0)
    loop('beds', 'rumble_long', p['blast1'], L['L8']['start'], -9.0, fin=0.05, fout=0.5)
    loop('beds', 'fire_crackle', p['blast1'] + 0.2, L['L8']['start'], -12.0, fin=0.3, fout=0.4)
    loop('beds', 'geiger', p['blast1'] + 0.3, L['L8']['start'], -16.0, fin=0.5, fout=0.3)
    # --- the why: a hit on «не в кнопке», a low drop on «конструкции»
    loop('beds', 'drone_bed', L['L7']['start'] - 0.1, L['L8']['start'], -11.0, fin=0.3, fout=0.2)
    put_hit(m, 'impact_soft', p['notbtn'], -8.0)
    put_hit(m, 'sub_drop', p['design'], -8.0)
    put_hit(m, 'impact_soft', p['rules'], -10.0)
    # --- Pripyat waking up: birds and the sad piano, the Geiger counter creeping back under «ничего не объявят»
    loop('beds', 'ambience_morning_taiga', L['L8']['start'] - 0.1, p['sub'] + 0.4, -14.0, fin=0.4, fout=0.5)
    loop('beds', 'piano_sad', L['L8']['start'], total, -10.0, fin=0.4, fout=0.03)
    loop('beds', 'geiger', p['day'], p['sub'] + 0.6, -20.0, fin=0.8, fout=0.6)
    put_hit(m, 'sub_drop', p['nothing'], -8.0)
    put_hit(m, 'sting_end', p['sub'] - 0.1, -12.0)
    put_hit(m, 'riser_2s', total - 0.02, -9.0)
    ec = tl.get('endcard')
    if ec:
        put_hit(m, 'whoosh_short', ec['start'] - 0.12, -10.0)
