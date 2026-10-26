"""Тайны истории №10: «Чернобыльские «смертники»» (Ананенко, Беспалов и Баранов под четвёртым блоком, май 1986).

vla 26.10: «я хочу историю про чернобыль как люди которые были там или человек который был в самом центре выжил».
Three plant workers waded into the flooded basement under the burning reactor to open the valves, so the pools could
be drained before the molten fuel reached the water; the press said all three died, and all three survived (sources
and the myths left out in chernobyl1986/factcheck.md). Hook first: «никто не ждал, что они вернутся» as big live
text, then why they went, the dark water, the valves, the myth of their deaths and the long lives after. Voice
«Историк» (h4_s52) until vla's ElevenLabs take arrives. Pictures: vla's PC (Juggernaut XL, chernobyl1986/
shots_pc.json, two seeds each); the ids below are picked by seed once the frames are in.
"""
import numpy as np

DISPLAY = {
    'L1': 'ИХ ОТПРАВИЛИ ПОД ВЗОРВАННЫЙ РЕАКТОР ЧЕРНОБЫЛЯ, И НИКТО НЕ ЖДАЛ, ЧТО ОНИ ВЕРНУТСЯ.',
    'L2': 'ПОД РЕАКТОРОМ ПЛАВИТСЯ ТОПЛИВО, А ВНИЗУ БАССЕЙНЫ С ВОДОЙ.',
    'L3': 'ЕСЛИ ЭТА ЛАВА ДОЙДЁТ ДО ВОДЫ, БУДЕТ НОВЫЙ ВЗРЫВ.',
    'L4': 'ВОДУ МОЖНО СПУСТИТЬ, ТОЛЬКО ОТКРЫВ ЗАДВИЖКИ В ЗАТОПЛЕННОМ ПОДВАЛЕ.',
    'L5': 'ВНИЗ ИДУТ ТРОЕ: АНАНЕНКО, БЕСПАЛОВ И БАРАНОВ.',
    'L6': 'В ТЕМНОТЕ, ПО КОЛЕНО В РАДИОАКТИВНОЙ ВОДЕ, ОНИ НАХОДЯТ ЗАДВИЖКИ.',
    'L7': 'И СЛЫШАТ, КАК УХОДИТ ВОДА.',
    'L8': 'ГАЗЕТЫ ПОТОМ ПИСАЛИ, ЧТО ВСЕ ТРОЕ УМЕРЛИ ОТ ОБЛУЧЕНИЯ.',
    'L9': 'НО ЭТО МИФ: ИХ ВЫХОДИЛИ В БОЛЬНИЦЕ, И ВСЕ ТРОЕ ВЫЖИЛИ.',
    'L10': 'БАРАНОВ ПРОЖИЛ ЕЩЁ 19{девятнадцать} ЛЕТ, А АНАНЕНКО ЕЩЁ 30{тридцать} ЛЕТ РАБОТАЛ В АТОМНОЙ ЭНЕРГЕТИКЕ.',
    'L11': 'ПОДПИШИСЬ, ЧТОБЫ НЕ ПРОПУСКАТЬ ДРУГИЕ КРУТЫЕ ИСТОРИИ.',
}
HILITE = {'РЕАКТОР', 'ЧЕРНОБЫЛЯ,', 'НИКТО', 'ВЕРНУТСЯ.', 'ПЛАВИТСЯ', 'ТОПЛИВО,', 'ВОДОЙ.', 'ЛАВА', 'НОВЫЙ',
          'ВЗРЫВ.', 'ЗАДВИЖКИ', 'ТРОЕ:', 'АНАНЕНКО,', 'БЕСПАЛОВ', 'БАРАНОВ.', 'РАДИОАКТИВНОЙ', 'ВОДА.', 'УМЕРЛИ',
          'МИФ:', 'ВЫЖИЛИ.', '19', '30'}

# gap (s) after each line before the next one starts (voice5/tools/gaps_used.py keeps the narrator's own pauses where
# they are longer); after L3 the imagined blast gets a beat of its own, after L7 the water is heard going
GAPS = {'L1': 0.35, 'L2': 0.2, 'L3': 0.5, 'L4': 0.3, 'L5': 0.3, 'L6': 0.25, 'L7': 0.6, 'L8': 0.25, 'L9': 0.35,
        'L10': 0.4, 'L11': 0.0}
GAP_MAX = 0.5
LEAD_IN = 0.15
TAIL = 0.6                         # the plaque holds a moment after «истории», then a white flash loops to the cover
LOOP = True
# the preview cover (thumb.py, chernobyl1986/thumbs.json) goes in the first frames once it is made
COVER = dict(tag='ТАЙНЫ ИСТОРИИ · №10', year='1986', lines=['ОНИ', 'ВЕРНУЛИСЬ'])
COVER_B = ['ЧЕРНОБЫЛЬСКИЕ', 'СМЕРТНИКИ']
# the narrator says the plaque's words (L11, no bottom captions), so it comes up with «подпишись»
ENDCARD = dict(tag='ТАЙНЫ ИСТОРИИ · №10', over_last=0.0, lines=['ЧТОБЫ НЕ ПРОПУСКАТЬ', 'ДРУГИЕ КРУТЫЕ ИСТОРИИ'])
# stills from vla's PC (shots_pc.json), chosen by seed when the frames arrive
BASEMENT = 'c01_basement_s1001'      # the three knee-deep in the dark water, flashlights
REACTOR = 'c02_reactor_s1011'        # the ruined unit 4 at night
LAVA = 'c03_lava_s1021'
POOL = 'c04_pool_s1031'              # the flooded chamber, nobody in it
VALVE = 'c05_valve_s1041'            # gloved hands on the wheel
THREE = 'c06_three_s1051'            # the three of them, portrait
DRAIN = 'c07_drain_s1061'
PAPER = 'c08_newspaper_s1071'
HOSPITAL = 'c09_hospital_s1081'
OLD = 'c10_old_s1091'                # Ananenko decades later in front of a plant
WALK = 'c11_walk_s1101'              # three silhouettes walking out into the light: room for the plaque
SFX_DIRS = ['/home/user/work/sfx/chernobyl', '/home/user/work/sfx/yamaguchi', '/home/user/work/sfx/rescue',
            '/home/user/work/sfx/olga', '/home/user/work/sfx']
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
    p['hook'] = (0.0, lines['L1']['end'] + 0.2)                      # the Geiger counter and the dark pulse
    p['reactor'] = wt('L1', 'РЕАКТОР')
    p['nobody'] = wt('L1', 'НИКТО')
    p['back'] = wt('L1', 'ВЕРНУТСЯ')
    p['melt'] = wt('L2', 'ПЛАВИТСЯ')
    p['water'] = wt('L2', 'БАССЕЙНЫ')
    p['lava'] = wt('L3', 'ЛАВА')
    p['blast'] = wt('L3', 'ВЗРЫВ')
    p['drain'] = wt('L4', 'СПУСТИТЬ')
    p['valves'] = wt('L4', 'ЗАДВИЖКИ')
    p['three'] = wt('L5', 'ТРОЕ')
    p['n1'] = wt('L5', 'АНАНЕНКО')
    p['n2'] = wt('L5', 'БЕСПАЛОВ')
    p['n3'] = wt('L5', 'БАРАНОВ')
    p['dark'] = (lines['L6']['start'] - 0.15, lines['L7']['end'] + 0.5)   # the basement: wading, the valves, the drain
    p['knee'] = wt('L6', 'КОЛЕНО')
    p['found'] = wt('L6', 'НАХОДЯТ')
    p['hear'] = wt('L7', 'СЛЫШАТ')
    p['gone'] = wt('L7', 'УХОДИТ')
    p['papers'] = wt('L8', 'ГАЗЕТЫ')
    p['died'] = wt('L8', 'УМЕРЛИ')
    p['myth'] = wt('L9', 'МИФ')
    p['nursed'] = wt('L9', 'ВЫХОДИЛИ')
    p['lived'] = wt('L9', 'ВЫЖИЛИ')
    p['y19'] = wt('L10', 'ДЕВЯТНАДЦАТЬ')
    p['anan'] = wt('L10', 'АНАНЕНКО')
    p['y30'] = wt('L10', 'ТРИДЦАТЬ')
    p['sub'] = lines['L11']['start']
    return p


def _beat(seg, end, **k):
    return dict(t0=seg[0], t1=end, grid=seg[0], period=2 * BEAT, **k)


def layout(c):
    L, add, wt, total = c.L, c.add, c.word_t, c.total
    p = plan(c.lines, c.words)
    night = dict(exposure=-0.04, contrast=1.12, sat=0.75, warm=0.2, demagenta=0.3)       # the ruined block at night
    lava = dict(exposure=0.02, contrast=1.12, sat=0.95, warm=0.9)
    dark = dict(exposure=-0.06, contrast=1.14, sat=0.6, warm=-0.1, demagenta=0.3)        # the basement, cold
    paper = dict(exposure=0.0, contrast=1.06, sat=0.6, warm=0.5, demagenta=0.3)
    ward = dict(exposure=0.04, contrast=1.04, sat=0.8, warm=0.35, demagenta=0.3)         # the hospital, alive
    now = dict(exposure=0.02, contrast=1.04, sat=0.85, warm=0.3, demagenta=0.2)          # the long life after
    hook = _beat(p['hook'], p['hook'][1], zoom=0.02, sway=0.3)
    white = (1.0, 0.97, 0.9)
    orange = (1.0, 0.6, 0.25)
    glow = dict(x=0.5, y=0.75, r=1.1, col=(0.5, 0.2, 0.03), flicker=0.25)

    # L1 hook: the ruined block at night under «их отправили под взорванный реактор Чернобыля», then «и никто не
    # ждал, что они вернутся» on the three in the dark water (another subject, so a whip is fine)
    nob = p['nobody'] - 0.06
    l2 = L('L2')['start'] - 0.08
    add(REACTOR, 0.0, nob, cam=dict(zoom=(1.12, 1.2), pany=(0.02, 0.0), parx=(-6, 6)),
        fx=dict(dust=30, ash=20, beat=[hook], bloom=0.5, punch=[(p['reactor'], 0.05)], grade=night))
    add(BASEMENT, nob, l2, into='whip', cam=dict(zoom=(1.05, 1.15), dolly=(0.0, 0.06), parx=(-6, 6)),
        fx=dict(dust=40, beat=[hook], punch=[(p['back'], 0.08)], flash=[(p['back'], 0.3, 0.5, white)], grade=dark))
    # L2 the fuel melting through (the lava), the pools of water below (the dark flooded chamber)
    wat = p['water'] - 0.06
    add(LAVA, l2, wat, into='flash', cam=dict(zoom=(1.0, 1.1), dolly=(0.0, 0.08), parx=(-10, 10)),
        fx=dict(embers=40, bloom=0.8, light=glow, punch=[(p['melt'], 0.05)], grade=lava))
    l3 = L('L3')['start'] - 0.08
    add(POOL, wat, l3, into='fade', cam=dict(zoom=(1.0, 1.08), dolly=(0.0, 0.05), parx=(-8, 8)),
        fx=dict(dust=15, fog=0.25, grade=dark))
    # L3 «если эта лава дойдёт до воды»: closer on the lava; «будет новый взрыв»: an orange flash on the block, a shake
    bl = p['blast'] - 0.06
    add(LAVA, l3, bl, cam=dict(zoom=(1.2, 1.32), pany=(0.0, 0.02)),
        fx=dict(embers=60, bloom=1.0, light=glow, punch=[(p['lava'], 0.05)], grade=dict(lava, exposure=0.06)))
    l4 = L('L4')['start'] - 0.08
    add(REACTOR, bl, l4, into='flash', cam=dict(zoom=(1.0, 1.1), pany=(0.0, -0.02), parx=(-10, 10)),
        fx=dict(dust=60, ash=40, embers=30, bloom=0.9, shake=[(p['blast'], 1.0, 24)], smear=[(p['blast'], 0.3, 40)],
                flash=[(p['blast'], 0.5, 0.9, orange)], punch=[(p['blast'], 0.1)], grade=night))
    # L4 the only way is to drain them: the flooded chamber, then «задвижки» on the valve wheel
    val = p['valves'] - 0.06
    add(POOL, l4, val, into='fade', cam=dict(zoom=(1.08, 1.16), pany=(0.02, 0.03)),
        fx=dict(dust=15, fog=0.3, punch=[(p['drain'], 0.05)], grade=dark))
    l5 = L('L5')['start'] - 0.08
    add(VALVE, val, l5, into='whip', cam=dict(zoom=(1.05, 1.15), parx=(-4, 4)),
        fx=dict(dust=20, punch=[(p['valves'], 0.06)], grade=dark))
    # L5 «вниз идут трое»: the three of them, each name a beat
    l6 = L('L6')['start'] - 0.08
    add(THREE, l5, l6, into='flash', cam=dict(zoom=(1.0, 1.1), pany=(0.0, 0.01)),
        fx=dict(dust=15, punch=[(p['three'], 0.05), (p['n1'], 0.03), (p['n2'], 0.03), (p['n3'], 0.03)],
                grade=dict(dark, exposure=0.0, sat=0.7)))
    # L6 in the dark, knee-deep: the three wading, then the hands on the wheel again
    fnd = p['found'] - 0.06
    add(BASEMENT, l6, fnd, into='fade', cam=dict(zoom=(1.1, 1.2), panx=(-0.02, 0.02), dolly=(0.0, 0.06)),
        fx=dict(dust=40, fog=0.2, beat=[_beat(p['dark'], fnd, zoom=0.02)], grade=dark))
    l7 = L('L7')['start'] - 0.08
    add(VALVE, fnd, l7, cam=dict(zoom=(1.2, 1.3), roll=(0.0, 2.0)),
        fx=dict(dust=20, punch=[(p['found'], 0.06)], grade=dark))
    # L7 «и слышат, как уходит вода»: the water swirling away through the hatch, held in the pause after it
    l8 = L('L8')['start'] - 0.08
    add(DRAIN, l7, l8, into='fade', cam=dict(zoom=(1.0, 1.12), dolly=(0.0, 0.06), roll=(0.0, -3.0)),
        fx=dict(dust=20, punch=[(p['gone'], 0.05)], grade=dark))
    # L8 the papers said all three died: the newspaper under the lamp
    myth = p['myth'] - 0.06
    add(PAPER, l8, myth, into='flash', cam=dict(zoom=(1.0, 1.1), pany=(0.0, 0.02), parx=(-6, 6)),
        fx=dict(dust=10, punch=[(p['died'], 0.05)], grade=paper))
    # L9 «но это миф»: a white flash into the hospital ward, alive
    l10 = L('L10')['start'] - 0.08
    add(HOSPITAL, myth, l10, into='flash', cam=dict(zoom=(1.02, 1.1), pany=(0.0, 0.01)),
        fx=dict(dust=10, bloom=0.5, punch=[(p['myth'], 0.08), (p['lived'], 0.05)], grade=ward))
    # L10 Baranov lived nineteen more years (the three again, warmer), Ananenko worked thirty more (him, older)
    an = p['anan'] - 0.06
    add(THREE, l10, an, into='fade', cam=dict(zoom=(1.1, 1.18), panx=(0.02, 0.04)),
        fx=dict(dust=10, punch=[(p['y19'], 0.05)], grade=now))
    sub = p['sub'] - 0.08
    add(OLD, an, sub, into='fade', cam=dict(zoom=(1.0, 1.08), pany=(0.03, 0.04), parx=(-4, 4)),
        fx=dict(dust=10, punch=[(p['y30'], 0.05)], grade=now))
    # L11 «подпишись...»: the three walking out into the light, which takes the plaque, then a white flash loops to
    # the cover
    add(WALK, sub, total, into='fade', cam=dict(zoom=(1.02, 1.1), pany=(0.0, 0.02), dolly=(0.0, 0.05), parx=(-4, 4)),
        fx=dict(dust=20, bloom=0.7, flash=[(total - 0.3, 0.35, 2.0, white)], grade=now))

    cards = [
        dict(text='19 ЛЕТ', start=p['y19'] + 0.1, end=an - 0.05, y=950, count=True),
        dict(text='30 ЛЕТ', start=p['y30'] + 0.1, end=sub - 0.05, y=950, count=True),
    ]
    tags = [
        dict(text='ЧАЭС · 4-Й ЭНЕРГОБЛОК · МАЙ 1986', start=L('L2')['start'] + 0.05, end=l3 - 0.05),
        dict(text='АЛЕКСЕЙ АНАНЕНКО · ВАЛЕРИЙ БЕСПАЛОВ · БОРИС БАРАНОВ', start=p['three'] + 0.1, end=l6 - 0.05),
    ]
    cover = dict(start=0.0, end=wt('L1', 'ЧЕРНОБЫЛЯ') - 0.2)
    hook_text = dict(lines=['L1'], y=1330, size=84)
    return dict(cards=cards, tags=tags, cover=cover, hook_text=hook_text, no_caps=['L11'])


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

    # --- hook: the Geiger counter crackling up under the reactor, the dark pulse; «никто» and «вернутся» land on hits
    h0, h1 = p['hook']
    loop('beds', 'pulse_dark', h0, h1, -7.0, fin=0.0, fout=0.1)
    loop('beds', 'drone_bed_tension', h0, h1 + 0.3, -9.0, fin=0.0, fout=0.3)
    put_hit(m, 'boom_hook', 0.02, -9.0)
    put_hit(m, 'geiger_rise', p['nobody'], -12.0)            # peaks and cuts on «никто» (enters part-way if early)
    put_hit(m, 'impact_soft', p['nobody'], -7.0)
    put_hit(m, 'drum_big', p['back'], -3.0)
    put_hit(m, 'sub_drop', p['back'], -5.0)
    # cuts get a soft whoosh, except where a hit already marks them
    loud = [p['reactor'], p['nobody'], p['back'], p['melt'], p['blast'], p['valves'], p['three'], p['found'],
            p['gone'], p['died'], p['myth'], p['y19'], p['y30'], p['sub']]
    for sh in tl['shots'][1:]:
        c = sh['start']
        if c < h1 or any(abs(c - x) < 0.4 for x in loud):
            continue
        put_hit(m, 'whoosh_short', c - 0.02, -14.0)
    # --- the melting fuel and the water below: a low rumble, the fire's hiss, the Geiger counter
    loop('beds', 'rumble_long', L['L2']['start'] - 0.1, L['L4']['start'] + 0.3, -9.0, fin=0.2, fout=0.4)
    loop('beds', 'fire_crackle', L['L2']['start'] - 0.1, p['water'], -11.0, fin=0.1, fout=0.2)
    loop('beds', 'geiger', L['L2']['start'] - 0.1, p['blast'], -16.0, fin=0.3, fout=0.05)
    loop('beds', 'drone_bed_tension', L['L2']['start'], p['blast'], -10.0, fin=0.3, fout=0.05)
    put_hit(m, 'impact_soft', p['melt'], -8.0)
    put_hit(m, 'sub_drop', p['lava'], -8.0)
    put_hit(m, 'heartbeat', L['L3']['start'] + 0.1, -8.0)
    # «будет новый взрыв»: the imagined blast, under the narrator's last word and in the pause after it
    put_hit(m, 'boom_big', p['blast'], -6.0)
    put_hit(m, 'shockwave', p['blast'] + 0.05, -8.0)
    # --- the plan and the three: the pulse comes back, a drum on «трое», soft hits on the names
    loop('beds', 'pulse_dark', L['L4']['start'] - 0.1, L['L6']['start'] - 0.1, -9.0, fin=0.3, fout=0.1)
    loop('beds', 'basement_hum', L['L4']['start'] - 0.1, p['dark'][1], -9.0, fin=0.5, fout=0.6)
    put_hit(m, 'valve_creak', p['valves'] - 0.05, -14.0)
    put_hit(m, 'drum_big', p['three'], -5.0)
    for k in ('n1', 'n2', 'n3'):
        put_hit(m, 'impact_soft', p[k], -10.0)
    # --- the basement: wading in the dark with the counter crackling, the valve turning, the water going
    d0, d1 = p['dark']
    loop('beds', 'geiger', d0, p['hear'], -14.0, fin=0.3, fout=0.3)
    loop('beds', 'drone_bed_tension', d0, d1, -10.0, fin=0.3, fout=0.4)
    put_hit(m, 'wade', d0 + 0.1, -9.0)
    put_hit(m, 'valve_creak', p['found'] - 0.05, -9.0)
    put_hit(m, 'water_drain', p['gone'] - 0.4, -7.0)
    # --- the papers: the pages, a low drop on «умерли»
    put_hit(m, 'paper_rustle', L['L8']['start'] - 0.1, -10.0)
    loop('beds', 'drone_bed', L['L8']['start'] - 0.1, p['myth'], -11.0, fin=0.3, fout=0.05)
    put_hit(m, 'sub_drop', p['died'], -8.0)
    # --- «но это миф»: a hit, then the hopeful pad and the piano carry the long lives to the end
    put_hit(m, 'drum_big', p['myth'], -5.0)
    loop('beds', 'pad_hope', p['myth'], total, -9.0, fin=0.3, fout=0.03)
    loop('beds', 'piano_sad', p['myth'] + 0.2, p['sub'], -11.0, fin=0.4, fout=0.4)
    put_hit(m, 'impact_soft', p['lived'], -7.0)
    put_hit(m, 'impact_soft', p['y19'], -9.0)
    put_hit(m, 'impact_soft', p['y30'], -9.0)
    put_hit(m, 'riser_2s', total - 0.02, -9.0)
    ec = tl.get('endcard')
    if ec:
        put_hit(m, 'whoosh_short', ec['start'] - 0.12, -10.0)
