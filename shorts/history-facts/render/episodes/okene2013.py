"""Тайны истории №7: «Живой на дне» (кок Харрисон Окене, буксир Jascon-4, Нигерия, 26–28 мая 2013).

A looped Short (vla 17.10, YouTube's advice): the hook is the diver's hand gripped back by «the dead man», the story
runs to the cliffhanger «а спасла его всего секунда, когда...», and the clip cuts back to the diver at the door, which
is that second. From vizavi-motion (vla 19.10): the hook builds up as big live text in the middle of the frame, focus
racks in depth, whip pans and the sinking camera smear. The rescue kit from sfx/make_sfx_rescue.py (70 bpm).
"""
import numpy as np

DISPLAY = {
    'L1': 'ВОДОЛАЗ ПРОТЯНУЛ РУКУ ПОГИБШЕМУ.',
    'L2': 'И ПОГИБШИЙ СЖАЛ ЕЁ В ОТВЕТ.',
    'L3': 'МАЙ 2013{две тысячи тринадцатого} ГОДА.',
    'L4': 'У ПОБЕРЕЖЬЯ НИГЕРИИ БУКСИР ПЕРЕВОРАЧИВАЕТСЯ И УХОДИТ НА ДНО.',
    'L5': '30{Тридцать} МЕТРОВ ПОД ВОДОЙ.',
    'L6': 'КОК ХАРРИСОН УСПЕВАЕТ ДОПЛЫТЬ ДО КАЮТЫ, ГДЕ ОСТАЛСЯ ВОЗДУХ.',
    'L7': 'ХОЛОДНАЯ ВОДА И ПОЛНАЯ ТЕМНОТА.',
    'L8': 'С КАЖДЫМ ЧАСОМ ДЫШАТЬ ВСЁ ТРУДНЕЕ.',
    'L9': '60{Шестьдесят} ЧАСОВ ОН ЖДЁТ ПОМОЩИ.',
    'L10': 'ВОДОЛАЗЫ СПУСКАЮТСЯ ЗА ПОГИБШИМИ.',
    'L11': 'ЖИВЫХ НИКТО НЕ ИЩЕТ.',
    'L12': 'ИЗ 12{двенадцати} ЧЕЛОВЕК ВЫЖИЛ ТОЛЬКО ОН.',
    'L13': 'А СПАСЛА ЕГО ВСЕГО СЕКУНДА, КОГДА...',
}
HILITE = {'ПОГИБШЕМУ.', 'СЖАЛ', '2013', 'ДНО.', '30', 'ВОЗДУХ.', 'ТЕМНОТА.', 'ТРУДНЕЕ.', '60', 'ПОГИБШИМИ.', 'ЖИВЫХ',
          'ВЫЖИЛ', 'СЕКУНДА,'}

# gap (s) after each line before the next one starts (voice5/tools/gaps_used.py keeps the narrator's own pauses where
# they are longer)
GAPS = {'L1': 0.25, 'L2': 0.55, 'L3': 0.20, 'L4': 0.30, 'L5': 0.40, 'L6': 0.30, 'L7': 0.25, 'L8': 0.35, 'L9': 0.45,
        'L10': 0.25, 'L11': 0.45, 'L12': 0.35, 'L13': 0.0}
LEAD_IN = 0.15
TAIL = 0.5                         # the clip ends half a second after the last word and loops back to the start
LOOP = True
COVER = dict(tag='ТАЙНЫ ИСТОРИИ · №7', year='2013', lines=['ЖИВОЙ', 'НА ДНЕ'])
COVER_B = ['60 ЧАСОВ', 'НА ДНЕ МОРЯ']
ENDCARD = dict(tag='ТАЙНЫ ИСТОРИИ · №7', over_last=1.0)
# the cloud stills chosen by seed (shots_cloud.json): two takes of the storm, the corridor towards the light,
# the dark cabin, him waiting in the dark, a diver's helmet in the wreck, the chamber's lit porthole
STORM = ('o03_tug_capsize_s301', 'o03_tug_capsize_s302')
SWIM = 'o07_dark_cabin_s701'
DARK = 'o07_dark_cabin_s702'
WAIT = 'o09_shelf_wait_s901'
DIVER = 'o11_lamp_corridor_s1102'
CHAMBER = 'o12_chamber_s1201'
SFX_DIRS = ['/home/user/work/sfx/rescue', '/home/user/work/sfx/olga', '/home/user/work/sfx/dance', '/home/user/work/sfx']
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
    p['hook'] = (0.0, lines['L2']['end'] + 0.2)                      # the dark pulse under the hook
    p['grip'] = wt('L2', 'СЖАЛ')
    p['storm'] = (lines['L3']['start'] - 0.15, wt('L4', 'УХОДИТ'))
    p['flip'] = wt('L4', 'ПЕРЕВОРАЧИВАЕТСЯ')
    p['sink'] = wt('L4', 'УХОДИТ')
    p['deep'] = wt('L5', '30')
    p['air'] = wt('L6', 'ГДЕ')
    p['dark'] = (lines['L7']['start'] - 0.1, lines['L10']['start'] - 0.1)    # alone in the dark: drips, his heart
    p['hours'] = wt('L9', '60')
    p['divers'] = (lines['L10']['start'] - 0.1, lines['L12']['start'] - 0.1)
    p['alive'] = wt('L12', 'ВЫЖИЛ')
    p['cliff'] = (lines['L13']['start'] - 0.1, None)                 # the cliffhanger rises into the loop
    return p


def _beat(seg, end, **k):
    return dict(t0=seg[0], t1=end, grid=seg[0], period=2 * BEAT, **k)


def layout(c):
    L, add, wt, total = c.L, c.add, c.word_t, c.total
    p = plan(c.lines, c.words)
    codex = dict(exposure=0.0, contrast=1.04, sat=0.95, teal=0.15, demagenta=0.3)       # the Codex stills are graded
    dark = dict(codex, exposure=-0.16, sat=0.75)
    deep = dict(exposure=-0.04, contrast=1.08, sat=0.85, teal=0.75, demagenta=0.5)       # the cloud stills: cold teal
    storm = dict(exposure=-0.06, contrast=1.12, sat=0.8, teal=0.55, demagenta=0.5)
    alive = dict(exposure=0.02, contrast=1.06, sat=0.95, warm=0.45, demagenta=0.4)
    lamp = lambda x, y, k=1.0: dict(x=x, y=y, r=0.8, col=(0.16 * k, 0.26 * k, 0.28 * k), flicker=0.15, rate=2.5)
    bolt = (0.75, 0.85, 1.0)                                       # lightning: a blue-white flash
    hook = _beat(p['hook'], p['hook'][1], zoom=0.02, sway=0.3)
    door = dict(zoom=1.85, panx=-0.2, pany=-0.2)                   # the diver at the door: the first and the last frame

    # L1 hook: the diver at the door of the sunken tug, his lamp; the focus racks from him into the dark doorway
    pg = wt('L1', 'ПОГИБШЕМУ')
    l2 = L('L2')['start'] - 0.06
    add('o02_handshake', 0.0, l2, cam=dict(zoom=(door['zoom'], 1.75), panx=(door['panx'], -0.15),
                                           pany=(door['pany'], -0.16), parx=(-6, 6)),
        fx=dict(bubbles=40, dust=20, beat=[hook], light=lamp(0.42, 0.2, 0.8), grade=codex,
                focus=dict(keys=[(0.0, 0.34), (pg - 0.25, 0.34), (pg + 0.25, 0.06)], r=10)))
    # L2 «и погибший сжал её в ответ»: whip onto the grip
    sj = p['grip']
    l3 = L('L3')['start'] - 0.08
    add('o02_handshake', l2, l3, into='whip', cam=dict(zoom=(1.8, 1.9), panx=(0.07, 0.09), pany=(0.01, 0.02)),
        fx=dict(bubbles=50, punch=[(sj, 0.1)], shake=[(sj, 0.6, 14)], flash=[(sj, 0.22, 0.3, bolt)],
                light=lamp(0.45, 0.4, 0.6), grade=codex))
    # L3–L4 May 2013, a storm off Nigeria; the tug rolls over...
    fl = p['flip']
    sk = p['sink'] - 0.06
    l4 = L('L4')['start'] - 0.08
    add(STORM[0], l3, l4, into='flash', cam=dict(zoom=(1.0, 1.1), dolly=(0.0, 0.08), parx=(-12, 12)),
        fx=dict(rain=240, fog=0.1, flash=[(l3 + 0.12, 0.35, 0.6, bolt)], grade=storm))
    add(STORM[1], l4, sk, into='whip', cam=dict(zoom=(1.05, 1.2), dolly=(0.0, 0.08), parx=(-10, 10), roll=(0.0, -6.0)),
        fx=dict(rain=260, fog=0.1, flash=[(fl, 0.25, 0.35, bolt)], shake=[(fl, 0.9, 14)], punch=[(fl, 0.06)],
                grade=storm))
    # ...and goes down: the camera sinks after it to the wreck thirty metres down
    l6 = L('L6')['start'] - 0.08
    add('o04_tug_seabed', sk, l6, into='zoom', cam=dict(zoom=(1.35, 1.45), pany=(-0.12, -0.1), dolly=(0.0, 0.06),
                                                         parx=(-8, 8)),
        fx=dict(bubbles=60, drop=[(sk, 0.75, -330.0, 1.5)], punch=[(p['deep'], 0.05)], grade=codex))
    # L6 the cook swims to the cabin where the air was left; the focus finds his face
    gd = p['air'] - 0.06
    l7 = L('L7')['start'] - 0.08
    add(SWIM, l6, gd, into='fade', cam=dict(zoom=(1.0, 1.3), dolly=(0.0, 0.12), parx=(-10, 10)),
        fx=dict(bubbles=60, grade=deep))           # swimming down the flooded corridor towards the light
    add('o06_air_pocket', gd, l7, into='whip', cam=dict(zoom=(1.1, 1.22), panx=(0.0, -0.03), pany=(-0.02, -0.04),
                                                         dolly=(0.0, 0.06)),
        fx=dict(dust=15, grade=codex, focus=dict(keys=[(gd, 0.02), (gd + 0.5, 0.02), (gd + 1.1, 0.22)], r=9)))
    # L7 cold water and total darkness
    tm = wt('L7', 'ТЕМНОТА')
    l8 = L('L8')['start'] - 0.08
    add(DARK, l7, l8, into='fade', cam=dict(zoom=(1.0, 1.1), dolly=(0.0, 0.06), parx=(-8, 8)),
        fx=dict(dust=10, punch=[(tm, 0.04)], blackout=(L('L7')['end'] + 0.12, l8), grade=dict(deep, exposure=-0.12)))
    # L8 every hour it is harder to breathe: his face, close, the heart beating
    heart = dict(t0=l8, t1=L('L9')['start'] - 0.08, grid=l8, period=0.8, zoom=0.025)
    l9 = L('L9')['start'] - 0.08
    add('o06_air_pocket', l8, l9, into='fade', cam=dict(zoom=(1.6, 1.75), panx=(-0.08, -0.08), pany=(-0.09, -0.1)),
        fx=dict(dust=10, beat=[heart], punch=[(wt('L8', 'ТРУДНЕЕ'), 0.05)], grade=dark))
    # L9 sixty hours he waits for help
    l10 = L('L10')['start'] - 0.08
    add(WAIT, l9, l10, into='fade', cam=dict(zoom=(1.0, 1.12), dolly=(0.0, 0.08), parx=(-8, 8)),
        fx=dict(dust=15, punch=[(p['hours'], 0.06)], shake=[(p['hours'], 0.5, 8)], grade=deep))
    # L10 the divers come down for the dead: the bell sinks into the deep, the focus finds it
    l11 = L('L11')['start'] - 0.08
    add('o10_diving_bell', l10, l11, into='fade', cam=dict(zoom=(1.12, 1.24), pany=(-0.04, 0.02), dolly=(0.0, 0.06)),
        fx=dict(bubbles=40, grade=codex, focus=dict(keys=[(l10, 0.4), (l10 + 0.7, 0.95)], r=8)))
    # L11 nobody is looking for the living: an empty corridor in a diver's lamp
    jv = wt('L11', 'ЖИВЫХ')
    l12 = L('L12')['start'] - 0.08
    add(DIVER, l11, l12, into='whip', cam=dict(zoom=(1.0, 1.12), dolly=(0.0, 0.1), panx=(0.02, -0.02)),
        fx=dict(bubbles=30, light=lamp(0.5, 0.35, 0.9), punch=[(jv, 0.05)], grade=deep))
    # L12 out of twelve men only he survived: the decompression chamber, warm light inside
    l13 = L('L13')['start'] - 0.08
    add(CHAMBER, l12, l13, into='fade', cam=dict(zoom=(1.0, 1.1), dolly=(0.0, 0.08), parx=(-10, 10)),
        fx=dict(dust=10, bloom=0.5, punch=[(p['alive'], 0.05)], grade=alive))
    # L13 «а спасла его всего секунда, когда...»: back to the diver at the door, ending on the first frame (the loop)
    add('o02_handshake', l13, total, into='fade', cam=dict(zoom=(1.95, door['zoom']), panx=(-0.16, door['panx']),
                                                           pany=(-0.17, door['pany'])),
        fx=dict(bubbles=40, dust=20, light=lamp(0.42, 0.2, 0.8), grade=codex,
                focus=dict(keys=[(l13, 0.06), (l13 + 0.6, 0.34)], r=10)))

    cards = [
        dict(text='30', sub='МЕТРОВ', start=p['deep'], end=l6 - 0.05, y=760, count=True),
        dict(text='60', sub='ЧАСОВ', start=p['hours'], end=l10 - 0.05, y=470, count=True),    # above his head
        dict(text='1', sub='ИЗ 12', start=p['alive'], end=l13 - 0.05, y=470),                 # above the porthole
    ]
    tags = [
        dict(text='БУКСИР JASCON-4 · НИГЕРИЯ', start=L('L4')['start'] + 0.1, end=fl - 0.05),
        dict(text='ХАРРИСОН ОКЕНЕ · КОК', start=gd + 0.2, end=l7 - 0.1),
    ]
    cover = dict(start=0.0, end=wt('L1', 'ПРОТЯНУЛ') - 0.1)
    hook_text = dict(lines=['L1', 'L2'], y=900, size=132)
    return dict(cards=cards, tags=tags, cover=cover, hook_text=hook_text)


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

    # --- hook: in the wreck under water, the dark pulse and the diver's breath
    h0, h1 = p['hook']
    loop('beds', 'underwater', h0, h1 + 0.3, -6.0, fin=0.0, fout=0.3)
    loop('beds', 'pulse_dark', h0, h1, -7.0, fin=0.0, fout=0.1)
    put_hit(m, 'boom_hook', 0.02, -9.0)
    put_hit(m, 'diver_breath', 0.15, -10.0)
    put_hit(m, 'drum_big', p['grip'], -2.0)
    put_hit(m, 'sub_drop', p['grip'], -5.0)
    put_hit(m, 'heartbeat', L['L2']['end'] + 0.1, -8.0)
    # cuts get a soft whoosh, except where a hit already marks them
    loud = [p['grip'], p['flip'], p['sink'], p['deep'], p['hours'], p['alive'], L['L3']['start']]
    for sh in tl['shots'][1:]:
        c = sh['start']
        if c < h1 or any(abs(c - x) < 0.4 for x in loud):
            continue
        put_hit(m, 'whoosh_short', c - 0.02, -14.0)
    # --- May 2013: the storm, the tug rolls over and goes down
    s0, s1 = p['storm']
    put_hit(m, 'thunder', L['L3']['start'] + 0.12, -3.0)
    loop('beds', 'rain_heavy', s0, s1 + 0.3, -6.0, fin=0.2, fout=0.3)
    loop('beds', 'wind_high', s0, s1, -11.0, fin=0.3, fout=0.3)
    loop('beds', 'drone_bed_tension', s0, s1, -11.0, fin=0.3, fout=0.3)
    put_hit(m, 'impact_soft', p['flip'], -5.0)
    loop('beds', 'water_rush', p['flip'] - 0.1, p['sink'] + 0.9, -5.0, fin=0.1, fout=0.6)
    put_hit(m, 'drum_big', p['sink'], -4.0)
    put_hit(m, 'sub_drop', p['sink'], -4.0)
    # --- thirty metres down; the piano starts telling his story
    d0, d1 = p['dark']
    loop('beds', 'underwater', p['sink'], d0 + 0.3, -7.0, fin=0.4, fout=0.5)
    loop('beds', 'piano_sad', L['L5']['start'] - 0.2, d0 + 0.4, -8.0, fin=0.6, fout=0.5)
    put_hit(m, 'impact_soft', p['deep'], -7.0)
    put_hit(m, 'riser_2s', p['air'], -12.0)
    # --- alone in the dark: drips, the dark pulse, his heart, his breath
    loop('beds', 'cave_drips', d0, d1, -7.0, fin=0.3, fout=0.4)
    loop('beds', 'pulse_dark', d0, d1, -9.0, fin=0.4, fout=0.3)
    loop('beds', 'drone_bed_tension', d0, d1, -11.0, fin=0.5, fout=0.4)
    put_hit(m, 'heartbeat', L['L8']['start'] + 0.1, -7.0)
    put_hit(m, 'breath_mask', wt('L8', 'ДЫШАТЬ'), -12.0)
    put_hit(m, 'drum_big', p['hours'], -4.0)
    put_hit(m, 'sub_drop', p['hours'], -6.0)
    # --- the divers come down for the dead
    v0, v1 = p['divers']
    loop('beds', 'underwater', v0, v1, -7.0, fin=0.3, fout=0.3)
    loop('beds', 'drone_bed_tension', v0, v1, -10.0, fin=0.3, fout=0.3)
    put_hit(m, 'diver_breath', L['L10']['start'] + 0.2, -6.0)
    put_hit(m, 'radio_static', L['L10']['end'] - 0.1, -14.0)
    put_hit(m, 'impact_soft', wt('L11', 'ЖИВЫХ'), -7.0)
    # --- only he survived: the hope pad
    l12 = L['L12']['start']
    c0 = p['cliff'][0]
    loop('beds', 'pad_hope', l12 - 0.3, c0 + 0.3, -6.0, fin=0.6, fout=0.4)
    loop('beds', 'piano_sad', l12 - 0.2, c0 + 0.2, -9.0, fin=0.5, fout=0.4)
    put_hit(m, 'drum_big', p['alive'], -4.0)
    # --- the cliffhanger rises into the loop (the first frame starts with the boom and the pulse again)
    loop('beds', 'underwater', c0, total, -8.0, fin=0.3, fout=0.03)
    loop('beds', 'pulse_dark', c0, total, -8.0, fin=0.3, fout=0.03)
    loop('beds', 'drone_bed_tension', c0, total, -10.0, fin=0.4, fout=0.03)
    put_hit(m, 'heartbeat', c0 + 0.15, -8.0)
    put_hit(m, 'riser_2s', total - 0.02, -9.0)
    ec = tl.get('endcard')
    if ec:
        put_hit(m, 'whoosh_short', ec['start'] - 0.12, -10.0)
        put_hit(m, 'impact_soft', ec['start'], -7.0)
