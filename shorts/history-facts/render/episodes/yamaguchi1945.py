"""Тайны истории №9: «Две бомбы» (инженер Цутому Ямагути, Хиросима 6 августа и Нагасаки 9 августа 1945).

A looped Short (vla 17.10, YouTube's advice; vla 21.10: «сначала заинтересовать, а потом история»): the hook «он пережил
две атомные бомбы, за три дня» builds up as big live text over his bandaged face, the story runs from the Hiroshima
morning to the Nagasaki office, and the cliffhanger «комнату заливает тот же белый свет...» whites out into the hook
again. Voice «Историк» (voice6, h4_s52). Pictures: cloud stills (SDXL Lightning, shots_cloud.json), vla's PC was off.
"""
import numpy as np

DISPLAY = {
    'L1': 'ОН ПЕРЕЖИЛ ДВЕ АТОМНЫЕ БОМБЫ.',
    'L2': 'ЗА 3{три} ДНЯ.',
    'L3': 'АВГУСТ 1945{тысяча девятьсот сорок пятого} ГОДА.',
    'L4': 'ЯПОНСКИЙ ИНЖЕНЕР В КОМАНДИРОВКЕ В ХИРОСИМЕ.',
    'L5': 'УТРОМ НЕБО ВСПЫХИВАЕТ ЯРЧЕ СОЛНЦА.',
    'L6': 'ДО ВЗРЫВА ВСЕГО 3{три} КИЛОМЕТРА.',
    'L7': 'ОН ВЕСЬ В ОЖОГАХ, ПОЧТИ ОСЛЕП И ОГЛОХ. НО ЖИВ.',
    'L8': 'НА СЛЕДУЮЩИЙ ДЕНЬ ОН ЕДЕТ ДОМОЙ. В НАГАСАКИ.',
    'L9': 'В БИНТАХ ОН ВЫХОДИТ НА РАБОТУ И РАССКАЗЫВАЕТ НАЧАЛЬНИКУ ПРО ХИРОСИМУ.',
    'L10': 'НАЧАЛЬНИК НЕ ВЕРИТ: ОДНА БОМБА НЕ МОЖЕТ СТЕРЕТЬ ЦЕЛЫЙ ГОРОД.',
    'L11': 'И В ЭТОТ МОМЕНТ КОМНАТУ ЗАЛИВАЕТ ТОТ ЖЕ БЕЛЫЙ СВЕТ...',
}
HILITE = {'ДВЕ', 'БОМБЫ.', '3', '1945', 'ХИРОСИМЕ.', 'ВСПЫХИВАЕТ', 'ЖИВ.', 'НАГАСАКИ.', 'ВЕРИТ:', 'ГОРОД.', 'БЕЛЫЙ'}

# gap (s) after each line before the next one starts (voice5/tools/gaps_used.py keeps the narrator's own pauses where
# they are longer); after L5 the blast's sound arrives in a gap of its own, away from the words
GAPS = {'L1': 0.20, 'L2': 0.55, 'L3': 0.20, 'L4': 0.30, 'L5': 0.90, 'L6': 0.45, 'L7': 0.40, 'L8': 0.40, 'L9': 0.25,
        'L10': 0.35, 'L11': 0.0}
LEAD_IN = 0.15
TAIL = 0.6                         # the white-out holds a moment after the last word, then loops back to his face
LOOP = True
COVER = dict(tag='ТАЙНЫ ИСТОРИИ · №9', year='1945', lines=['ПЕРЕЖИЛ', 'ДВЕ БОМБЫ'])
COVER_B = ['ХИРОСИМА', 'И НАГАСАКИ']
ENDCARD = dict(tag='ТАЙНЫ ИСТОРИИ · №9', over_last=1.0)
# the cloud stills chosen by seed (shots_cloud.json)
HERO = 'y01_hero_s101'
OFFICE = 'y10_office_s1001'
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
    p['days'] = wt('L2', '3')
    p['morning'] = (lines['L3']['start'] - 0.15, wt('L5', 'ВСПЫХИВАЕТ'))
    p['flash'] = wt('L5', 'ВСПЫХИВАЕТ')
    p['boom'] = lines['L5']['end'] + 0.08                           # three kilometres away the sound comes later
    p['km'] = wt('L6', '3')
    p['ruins'] = (lines['L6']['start'] - 0.1, lines['L8']['start'] - 0.1)
    p['alive'] = wt('L7', 'ЖИВ')
    p['train'] = (lines['L8']['start'] - 0.1, lines['L9']['start'] - 0.1)
    p['naga'] = wt('L8', 'НАГАСАКИ')
    p['office'] = (lines['L9']['start'] - 0.1, lines['L11']['start'] - 0.1)
    p['doubt'] = wt('L10', 'ВЕРИТ')
    p['white'] = wt('L11', 'БЕЛЫЙ')
    p['cliff'] = (lines['L11']['start'] - 0.1, None)                 # the cliffhanger whites out into the loop
    return p


def _beat(seg, end, **k):
    return dict(t0=seg[0], t1=end, grid=seg[0], period=2 * BEAT, **k)


def layout(c):
    L, add, wt, total = c.L, c.add, c.word_t, c.total
    p = plan(c.lines, c.words)
    face = dict(exposure=-0.04, contrast=1.08, sat=0.8, warm=0.25, demagenta=0.3)        # his face, dim office light
    morning = dict(exposure=0.04, contrast=1.04, sat=0.9, warm=0.45, demagenta=0.3)     # the last calm morning
    blast = dict(exposure=0.06, contrast=1.12, sat=0.95, warm=1.0)
    ruins = dict(exposure=-0.08, contrast=1.12, sat=0.7, warm=0.6, demagenta=0.4)
    dawn = dict(exposure=-0.04, contrast=1.06, sat=0.75, teal=0.45, demagenta=0.4)       # the train home, cold dawn
    office = dict(exposure=0.0, contrast=1.05, sat=0.8, warm=0.4, demagenta=0.3)
    hook = _beat(p['hook'], p['hook'][1], zoom=0.02, sway=0.3)
    fl, bm, wh = p['flash'], p['boom'], p['white']
    white = (1.0, 0.97, 0.9)

    # L1–L2 hook: his bandaged face, the camera creeping in; «за три дня» punches closer
    l2 = L('L2')['start'] - 0.06
    l3 = L('L3')['start'] - 0.08
    add(HERO, 0.0, l2, cam=dict(zoom=(1.12, 1.22), pany=(-0.04, -0.06), parx=(-6, 6)),
        fx=dict(dust=20, beat=[hook], grade=face))
    add(HERO, l2, l3, into='whip', cam=dict(zoom=(1.45, 1.55), pany=(-0.1, -0.11)),
        fx=dict(dust=20, punch=[(p['days'], 0.1)], shake=[(p['days'], 0.5, 12)], grade=face))
    # L3–L4 August 1945, a calm morning in Hiroshima; the engineer on his business trip
    l4 = L('L4')['start'] - 0.08
    add('y03_street_s301', l3, l4, into='flash', cam=dict(zoom=(1.0, 1.1), dolly=(0.0, 0.08), parx=(-12, 12)),
        fx=dict(dust=15, oldfilm=True, grade=morning))
    l5 = L('L5')['start'] - 0.08
    add('y04_engineer_s401', l4, l5, into='whip', cam=dict(zoom=(1.05, 1.15), panx=(0.03, -0.03), parx=(10, -10)),
        fx=dict(dust=15, oldfilm=True, grade=morning))
    # L5 «утром небо вспыхивает ярче солнца»: the street again, then the flash
    add('y03_street_s301', l5, fl - 0.04, into='fade', cam=dict(zoom=(1.2, 1.26), pany=(-0.12, -0.14)),
        fx=dict(dust=10, oldfilm=True, grade=morning))
    l6 = L('L6')['start'] - 0.08
    add('y05_flash_s501', fl - 0.04, l6, cam=dict(zoom=(1.0, 1.12), roll=(0.0, -3.0)),
        fx=dict(flash=[(fl, 0.9, 1.6, white), (bm, 0.4, 0.5)], punch=[(fl, 0.1), (bm, 0.12)], shake=[(bm, 1.2, 36)],
                smear=[(bm, 0.6, 60)], bloom=1.0, heat=0.6, grade=blast))
    # L6 three kilometres away: the cloud over the city, a shockwave ring
    l7 = L('L7')['start'] - 0.08
    add('y06_cloud_s601', l6, l7, into='zoom', cam=dict(zoom=(1.0, 1.1), pany=(0.0, -0.02), parx=(-12, 12)),
        fx=dict(ring=dict(start=l6 + 0.15, x=0.5, y=0.35, r=320), ash=40, bloom=0.7, heat=0.5,
                punch=[(p['km'], 0.06)], grade=blast))
    # L7 burned, half blind and deaf, but alive
    l8 = L('L8')['start'] - 0.08
    add('y07_wounded_s701', l7, l8, into='fade', cam=dict(zoom=(1.05, 1.16), dolly=(0.0, 0.08), parx=(8, -8)),
        fx=dict(ash=70, embers=30, fire=0.5, heat=0.4, punch=[(p['alive'], 0.06)],
                light=dict(x=0.8, y=0.3, r=1.2, col=(0.5, 0.2, 0.03), flicker=0.3), grade=ruins))
    # L8 the next day the train home, to Nagasaki
    l9 = L('L9')['start'] - 0.08
    add('y08_train_s801', l8, l9, into='fade', cam=dict(zoom=(1.0, 1.12), dolly=(0.0, 0.1), parx=(-14, 14)),
        fx=dict(fog=0.2, dust=10, punch=[(p['naga'], 0.05)], grade=dawn))
    # L9–L10 Nagasaki, 9 August: bandaged, he tells his boss about Hiroshima; the boss doesn't believe him
    l10 = L('L10')['start'] - 0.08
    add(OFFICE, l9, l10, into='whip', cam=dict(zoom=(1.0, 1.1), dolly=(0.0, 0.06), parx=(-8, 8)),
        fx=dict(dust=20, grade=office))
    l11 = L('L11')['start'] - 0.08
    add('y11_boss_s1101', l10, l11, into='whip', cam=dict(zoom=(1.1, 1.22), pany=(-0.02, -0.04)),
        fx=dict(dust=15, punch=[(p['doubt'], 0.05)], grade=office))
    # L11 «и в этот момент комнату заливает тот же белый свет...»: the window light swells into a white-out (the loop)
    add('y12_white_s1201', l11, total, into='fade', cam=dict(zoom=(1.0, 1.18), dolly=(0.0, 0.1)),
        fx=dict(dust=30, bloom=1.2, flash=[(wh, 0.9, 1.5, white), (total - 0.3, 0.35, 2.0, white)], shake=[(wh, 0.8, 14)],
                punch=[(wh, 0.08)],
                grade=dict(office, exposure=0.1)))

    cards = [
        dict(text='3', sub='КМ ДО ВЗРЫВА', start=p['km'], end=l7 - 0.05, y=1250, count=True),
    ]
    tags = [
        dict(text='ЦУТОМУ ЯМАГУТИ · ИНЖЕНЕР', start=L('L4')['start'] + 0.1, end=l5 - 0.05),
        dict(text='ХИРОСИМА · 6 АВГУСТА, 8:15', start=L('L5')['start'] + 0.05, end=fl - 0.1),
        dict(text='НАГАСАКИ · 9 АВГУСТА', start=L('L9')['start'] + 0.1, end=l10 - 0.05),
    ]
    cover = dict(start=0.0, end=wt('L1', 'ПЕРЕЖИЛ') - 0.1)
    hook_text = dict(lines=['L1', 'L2'], y=1150, size=132)
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

    # --- hook: his face, the dark pulse, a heartbeat; «за три дня» lands on a drum
    h0, h1 = p['hook']
    loop('beds', 'pulse_dark', h0, h1, -7.0, fin=0.0, fout=0.1)
    loop('beds', 'drone_bed_tension', h0, h1 + 0.3, -9.0, fin=0.0, fout=0.3)
    put_hit(m, 'boom_hook', 0.02, -9.0)
    put_hit(m, 'heartbeat', 0.3, -9.0)
    put_hit(m, 'drum_big', p['days'], -3.0)
    put_hit(m, 'sub_drop', p['days'], -5.0)
    # cuts get a soft whoosh, except where a hit already marks them
    loud = [p['days'], p['flash'], p['boom'], p['km'], p['alive'], p['naga'], p['doubt'], p['white'], L['L3']['start']]
    for sh in tl['shots'][1:]:
        c = sh['start']
        if c < h1 or any(abs(c - x) < 0.4 for x in loud):
            continue
        put_hit(m, 'whoosh_short', c - 0.02, -14.0)
    # --- the last calm morning: birds, a hopeful pad, a clock ticking towards 8:15
    m0, m1 = p['morning']
    loop('beds', 'ambience_morning_taiga', m0, m1 + 0.1, -10.0, fin=0.3, fout=0.05)
    loop('beds', 'pad_hope', m0, m1, -9.0, fin=0.5, fout=0.05)
    loop('beds', 'tick', L['L5']['start'] - 0.2, m1, -13.0, fin=0.1, fout=0.02)
    # --- the flash: a low drop under the word, then the blast's sound in the gap after the line, and the long rumble
    put_hit(m, 'sub_drop', p['flash'], -8.0)
    put_hit(m, 'boom_big', p['boom'], -4.0)
    put_hit(m, 'shockwave', p['boom'] + 0.05, -6.0)
    r0, r1 = p['ruins']
    loop('beds', 'rumble_long', p['boom'] + 0.2, r0 + 1.5, -8.0, fin=0.2, fout=0.8)
    put_hit(m, 'impact_soft', p['km'], -6.0)
    # --- the ruins: fire, wind, his heart; «но жив»
    loop('beds', 'fire_crackle', r0, r1, -8.0, fin=0.4, fout=0.4)
    loop('beds', 'ambience_wind_dead_forest', r0, r1, -10.0, fin=0.4, fout=0.4)
    loop('beds', 'piano_sad', L['L7']['start'] - 0.2, r1 + 0.3, -9.0, fin=0.6, fout=0.4)
    put_hit(m, 'heartbeat', L['L7']['start'] + 0.2, -8.0)
    put_hit(m, 'drum_big', p['alive'], -5.0)
    # --- the train home to Nagasaki
    t0, t1 = p['train']
    loop('beds', 'rumble_long', t0, t1, -12.0, fin=0.4, fout=0.3)
    loop('beds', 'piano_sad', t0, t1 + 0.2, -9.0, fin=0.2, fout=0.3)
    put_hit(m, 'whoosh_long', t0 + 0.05, -12.0)
    put_hit(m, 'impact_soft', p['naga'], -6.0)
    # --- the office: a clock, papers, tension under the boss's disbelief
    o0, o1 = p['office']
    loop('beds', 'tick', o0, o1, -12.0, fin=0.2, fout=0.2)
    loop('beds', 'drone_bed_tension', o0, o1, -11.0, fin=0.5, fout=0.3)
    put_hit(m, 'paper_rustle', o0 + 0.3, -12.0)
    put_hit(m, 'impact_soft', p['doubt'], -7.0)
    # --- the cliffhanger: the same white light, a riser into the loop (the first frame starts with the boom again)
    c0 = p['cliff'][0]
    loop('beds', 'drone_bed_tension', c0, total, -9.0, fin=0.3, fout=0.03)
    loop('beds', 'pulse_dark', c0, total, -9.0, fin=0.3, fout=0.03)
    put_hit(m, 'heartbeat', c0 + 0.1, -8.0)
    put_hit(m, 'riser_4s', p['white'], -10.0)
    put_hit(m, 'whoosh_long', p['white'] - 0.1, -10.0)
    put_hit(m, 'riser_2s', total - 0.02, -9.0)
    ec = tl.get('endcard')
    if ec:
        put_hit(m, 'whoosh_short', ec['start'] - 0.12, -10.0)
