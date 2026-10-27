"""Тайны истории №12: «Вещи на три дня» (эвакуация Припяти, 27 апреля 1986).

vla 27.10 asked for more Chernobyl after №10, with hooky starts and endings that make people watch the next one, and
to queue the next story's frames right away: this follows №11 «Кнопка», whose ending (Pripyat waking up unwarned)
leads here. The radio, «take things for three days», over a thousand buses, almost fifty thousand people in about
three hours, the pets left behind, the flats left as they were, why they were told «three days», and the tease into
№13: the old people creeping back into the dead zone (sources and caveats in chernobyl1986_veshchi/factcheck.md).
Voice «Историк» (h4_s52). Pictures: vla's PC (Juggernaut XL, chernobyl1986_veshchi/shots_pc.json, two seeds each);
the ids below are picked by seed once the frames are in.
"""
import numpy as np

DISPLAY = {
    'L1': 'ЖИТЕЛЯМ ПРИПЯТИ СКАЗАЛИ ВЗЯТЬ ВЕЩИ НА ТРИ ДНЯ. ДОМОЙ ОНИ БОЛЬШЕ НЕ ВЕРНУЛИСЬ.',
    'L2': '27{двадцать седьмое} АПРЕЛЯ. ПО РАДИО ОБЪЯВЛЯЮТ ЭВАКУАЦИЮ.',
    'L3': 'БРАТЬ ТОЛЬКО ДОКУМЕНТЫ, ДЕНЬГИ И НЕМНОГО ЕДЫ: ЭТО НЕНАДОЛГО, ВСЕГО НА ТРИ ДНЯ.',
    'L4': 'К ПОДЪЕЗДАМ ПОДХОДЯТ БОЛЬШЕ ТЫСЯЧИ АВТОБУСОВ.',
    'L5': 'ПОЧТИ 50{пятьдесят} ТЫСЯЧ ЧЕЛОВЕК ВЫВОЗЯТ ПРИМЕРНО ЗА ТРИ ЧАСА.',
    'L6': 'КОШЕК И СОБАК БРАТЬ НЕЛЬЗЯ, И ОНИ БЕГУТ ЗА АВТОБУСАМИ.',
    'L7': 'В КВАРТИРАХ ОСТАЮТСЯ ИГРУШКИ, ПОСУДА НА СТОЛАХ И ЦВЕТЫ НА ПОДОКОННИКАХ.',
    'L8': 'ПРО ТРИ ДНЯ СКАЗАЛИ, ЧТОБЫ НЕ БЫЛО ПАНИКИ И ЛЮДИ УЕХАЛИ НАЛЕГКЕ.',
    'L9': 'А ПОТОМ В МЁРТВУЮ ЗОНУ ТАЙКОМ НАЧАЛИ ВОЗВРАЩАТЬСЯ СТАРИКИ. ЗАЧЕМ?',
    'L10': 'ПОДПИШИСЬ, ЧТОБЫ НЕ ПРОПУСКАТЬ ДРУГИЕ КРУТЫЕ ИСТОРИИ.',
}
HILITE = {'ТРИ', 'ДНЯ.', 'ВЕРНУЛИСЬ.', '27', 'ЭВАКУАЦИЮ.', 'ДОКУМЕНТЫ,', 'ДЕНЬГИ', 'НЕНАДОЛГО,', 'ДНЯ.',
          'ТЫСЯЧИ', 'АВТОБУСОВ.', '50', 'ЧАСА.', 'НЕЛЬЗЯ,', 'БЕГУТ', 'ИГРУШКИ,', 'ЦВЕТЫ', 'ПАНИКИ', 'НАЛЕГКЕ.',
          'МЁРТВУЮ', 'ТАЙКОМ', 'СТАРИКИ.', 'ЗАЧЕМ?'}

# gap (s) after each line before the next one starts (voice5/tools/gaps_used.py keeps the narrator's own pauses where
# they are longer); after L1 the locked door gets a beat, after L6 the dog runs on, before the last «зачем?» settles
GAPS = {'L1': 0.6, 'L2': 0.2, 'L3': 0.3, 'L4': 0.3, 'L5': 0.3, 'L6': 0.6, 'L7': 0.3, 'L8': 0.35, 'L9': 0.6,
        'L10': 0.0}
GAP_MAX = 0.3
LEAD_IN = 0.15
TAIL = 0.6                         # the plaque holds a moment after «истории», then a white flash loops to the cover
LOOP = True
COVER = dict(tag='ТАЙНЫ ИСТОРИИ · №12', year='1986', lines=['НА ТРИ ДНЯ', 'НАВСЕГДА'],
             # the preview cover (thumb.py, chernobyl1986_veshchi/thumbs.json) in the first frames, so YouTube's frame
             # picker can take it; the other variant sits next to it in covers/
             img='/mnt/project-files/history-facts/chernobyl1986_veshchi/covers/na_tri_dnya.jpg')
COVER_B = ['ВЕЩИ НА 3 ДНЯ', 'НЕ ВЕРНУЛСЯ НИКТО']
# the narrator says the plaque's words (L10, no bottom captions), so it comes up with «подпишись»
ENDCARD = dict(tag='ТАЙНЫ ИСТОРИИ · №12', over_last=0.0, lines=['ЧТОБЫ НЕ ПРОПУСКАТЬ', 'ДРУГИЕ КРУТЫЕ ИСТОРИИ'])
# stills from vla's PC (shots_pc.json, Juggernaut XL), chosen by seed; where a shot comes twice, the second seed gives
# the second appearance a new picture
RADIO = 'v01_radio_s3001'            # a woman and a boy at the kitchen radio
PACK = 'v02_packing_s3011'           # hands packing a small suitcase
PACK2 = 'v02_packing_s3012'          # the same, for «документы, деньги и немного еды»
BUSES = 'v03_buses_s3021'            # a line of buses along the blocks
COLUMN = 'v04_column_s3031'          # the endless column through the forest, from above
BOARD = 'v05_boarding_s3041'         # a mother and a girl boarding with one bag
DOG = 'v06_dog_s3051'                # a dog running after the bus
CAT = 'v07_cat_s3061'                # a cat alone on a windowsill
TOYS = 'v08_toys_s3071'              # a child's room left as it was
TABLE = 'v09_table_s3081'            # the kitchen table with the plates, flowers on the sill
EMPTY = 'v10_empty_city_s3091'       # the empty streets that evening, laundry on the balconies
OLD = 'v11_babushka_s3101'           # an old woman walking home down an overgrown road
WHEEL = 'v12_wheel_now_s3111'        # the Ferris wheel today, rusted
WHEEL2 = 'v12_wheel_now_s3112'       # the same, for the plaque
SFX_DIRS = ['/home/user/work/sfx/veshchi', '/home/user/work/sfx/knopka', '/home/user/work/sfx/chernobyl',
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


def plan(lines, words):
    """Music sections and sync points shared by the picture (camera beats) and the mix."""
    wt = lambda *a, **k: _wt(words, lines, *a, **k)
    p = {}
    p['hook'] = (0.0, lines['L1']['end'] + 0.2)
    p['things'] = wt('L1', 'ВЕЩИ')
    p['days1'] = wt('L1', 'ТРИ')
    p['home'] = wt('L1', 'ДОМОЙ')
    p['never'] = wt('L1', 'ВЕРНУЛИСЬ')
    p['radio'] = wt('L2', 'ПО')
    p['evac'] = wt('L2', 'ЭВАКУАЦИЮ')
    p['docs'] = wt('L3', 'ДОКУМЕНТЫ')
    p['short'] = wt('L3', 'НЕНАДОЛГО')
    p['days3'] = wt('L3', 'ТРИ')
    p['thousand'] = wt('L4', 'ТЫСЯЧИ')
    p['buses'] = wt('L4', 'АВТОБУСОВ')
    p['n50'] = wt('L5', '50')
    p['taken'] = wt('L5', 'ВЫВОЗЯТ')
    p['hours'] = wt('L5', 'ТРИ')
    p['cats'] = wt('L6', 'КОШЕК')
    p['no'] = wt('L6', 'НЕЛЬЗЯ')
    p['run'] = wt('L6', 'БЕГУТ')
    p['toys'] = wt('L7', 'ИГРУШКИ')
    p['dishes'] = wt('L7', 'ПОСУДА')
    p['why'] = wt('L8', 'ПРО')
    p['panic'] = wt('L8', 'ПАНИКИ')
    p['zone'] = wt('L9', 'МЁРТВУЮ')
    p['back'] = wt('L9', 'ВОЗВРАЩАТЬСЯ')
    p['what'] = wt('L9', 'ЗАЧЕМ')
    p['sub'] = lines['L10']['start']
    return p


def _beat(seg, end, **k):
    return dict(t0=seg[0], t1=end, grid=seg[0], period=2 * BEAT, **k)


def layout(c):
    L, add, wt, total = c.L, c.add, c.word_t, c.total
    p = plan(c.lines, c.words)
    home = dict(exposure=0.03, contrast=1.05, sat=0.85, warm=0.35, demagenta=0.2)       # the flats, daylight
    street = dict(exposure=0.03, contrast=1.06, sat=0.85, warm=0.25, demagenta=0.2)     # the street, the buses
    empty = dict(exposure=0.0, contrast=1.08, sat=0.7, warm=0.45, demagenta=0.3)        # left behind, evening
    now = dict(exposure=-0.02, contrast=1.1, sat=0.55, warm=-0.05, demagenta=0.3)       # the zone today
    hook = _beat(p['hook'], p['hook'][1], zoom=0.02, sway=0.3)
    white = (1.0, 0.97, 0.9)

    # L1 hook: «сказали взять вещи на три дня» on the suitcase being packed; «домой они больше не вернулись» on the
    # Ferris wheel rusting today
    hm = p['home'] - 0.06
    l2 = L('L2')['start'] - 0.08
    add(PACK, 0.0, hm, cam=dict(zoom=(1.12, 1.2), pany=(0.02, 0.0), parx=(-6, 6)),
        fx=dict(dust=15, beat=[hook], punch=[(p['things'], 0.05), (p['days1'], 0.06)], grade=home))
    add(WHEEL, hm, l2, into='flash', cam=dict(zoom=(1.0, 1.1), pany=(0.0, 0.02), parx=(-6, 6)),
        fx=dict(dust=20, beat=[hook], punch=[(p['never'], 0.08)], grade=now))
    # L2 the 27th: the radio in the kitchen announcing the evacuation
    l3 = L('L3')['start'] - 0.08
    add(RADIO, l2, l3, into='flash', cam=dict(zoom=(1.0, 1.1), dolly=(0.0, 0.05), parx=(-6, 6)),
        fx=dict(dust=10, punch=[(p['evac'], 0.06)], grade=home))
    # L3 documents, money, a little food (the suitcase again), «всего на три дня»
    l4 = L('L4')['start'] - 0.08
    add(PACK2, l3, l4, into='fade', cam=dict(zoom=(1.05, 1.15), panx=(-0.02, 0.02)),
        fx=dict(dust=10, punch=[(p['docs'], 0.04), (p['short'], 0.05), (p['days3'], 0.06)], grade=home))
    # L4 over a thousand buses at the doors
    l5 = L('L5')['start'] - 0.08
    add(BUSES, l4, l5, into='flash', cam=dict(zoom=(1.0, 1.1), panx=(0.03, -0.03), parx=(-10, 10)),
        fx=dict(dust=20, punch=[(p['thousand'], 0.05), (p['buses'], 0.05)], grade=street))
    # L5 almost fifty thousand people (boarding), taken away in about three hours (the column through the forest)
    tk = p['taken'] - 0.06
    add(BOARD, l5, tk, into='fade', cam=dict(zoom=(1.05, 1.12), dolly=(0.0, 0.04)),
        fx=dict(dust=10, punch=[(p['n50'], 0.05)], grade=street))
    l6 = L('L6')['start'] - 0.08
    add(COLUMN, tk, l6, into='whip', cam=dict(zoom=(1.0, 1.12), pany=(-0.03, 0.03)),
        fx=dict(dust=10, punch=[(p['hours'], 0.05)], grade=street))
    # L6 no cats or dogs: the cat on the sill, then the dog running after the bus
    rn = p['run'] - 0.06
    add(CAT, l6, rn, into='flash', cam=dict(zoom=(1.0, 1.08), dolly=(0.0, 0.04)),
        fx=dict(dust=10, punch=[(p['no'], 0.06)], grade=empty))
    l7 = L('L7')['start'] - 0.08
    add(DOG, rn, l7, into='whip', cam=dict(zoom=(1.05, 1.15), panx=(-0.03, 0.03), parx=(-8, 8)),
        fx=dict(dust=40, punch=[(p['run'], 0.06)], grade=street))
    # L7 the flats left as they were: the toys, the table with the plates and the flowers
    ds = p['dishes'] - 0.06
    add(TOYS, l7, ds, into='fade', cam=dict(zoom=(1.0, 1.1), dolly=(0.0, 0.05)),
        fx=dict(dust=25, punch=[(p['toys'], 0.05)], grade=empty))
    l8 = L('L8')['start'] - 0.08
    add(TABLE, ds, l8, into='fade', cam=dict(zoom=(1.05, 1.12), pany=(0.0, 0.02)),
        fx=dict(dust=25, grade=empty))
    # L8 why «three days»: the empty streets that evening
    l9 = L('L9')['start'] - 0.08
    add(EMPTY, l8, l9, into='flash', cam=dict(zoom=(1.0, 1.1), pany=(0.02, 0.0), parx=(-8, 8)),
        fx=dict(dust=10, punch=[(p['panic'], 0.05)], grade=empty))
    # L9 and then the old people creeping back into the dead zone: an old woman walking home, «зачем?» a beat
    sub = p['sub'] - 0.08
    add(OLD, l9, sub, into='flash', cam=dict(zoom=(1.0, 1.1), dolly=(0.0, 0.05), parx=(-4, 4)),
        fx=dict(dust=10, bloom=0.4, punch=[(p['zone'], 0.04), (p['what'], 0.08)], grade=dict(empty, warm=0.6)))
    # L10 «подпишись...»: the wheel today takes the plaque, then a white flash loops to the cover
    add(WHEEL2, sub, total, into='fade', cam=dict(zoom=(1.02, 1.1), pany=(0.0, 0.02), parx=(-4, 4)),
        fx=dict(dust=15, bloom=0.5, flash=[(total - 0.3, 0.35, 2.0, white)], grade=now))

    cards = [
        dict(text='3 ДНЯ', start=p['days3'] + 0.1, end=l4 - 0.05, y=1430, count=True),
        dict(text='3 ЧАСА', start=p['hours'] + 0.1, end=l6 - 0.05, y=1430, count=True),
    ]
    tags = [
        dict(text='ПРИПЯТЬ · 27 АПРЕЛЯ 1986', start=L('L2')['start'] + 0.05, end=l3 - 0.05),
        dict(text='ПОЧТИ 50 000 ЧЕЛОВЕК', start=p['n50'] + 0.1, end=tk - 0.05),
    ]
    cover = dict(start=0.0, end=p['things'] - 0.15)
    hook_text = dict(lines=['L1'], y=1330, size=84)
    return dict(cards=cards, tags=tags, cover=cover, hook_text=hook_text, no_caps=['L10'])


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

    # --- hook: the dark pulse; the suitcase shut on «вещи», the door locked for good on «домой ... не вернулись»
    h0, h1 = p['hook']
    loop('beds', 'pulse_dark', h0, h1, -8.0, fin=0.0, fout=0.1)
    loop('beds', 'drone_bed_tension', h0, h1 + 0.3, -10.0, fin=0.0, fout=0.3)
    put_hit(m, 'boom_hook', 0.02, -10.0)
    put_hit(m, 'suitcase_shut', p['things'], -8.0)
    put_hit(m, 'door_lock', p['home'] - 0.1, -6.0)
    put_hit(m, 'drum_big', p['never'], -5.0)
    put_hit(m, 'sub_drop', p['never'], -6.0)
    # cuts get a soft whoosh, except where a hit already marks them
    loud = [p['things'], p['home'], p['never'], p['evac'], p['thousand'], p['taken'], p['run'], p['why'],
            p['zone'], p['what'], p['sub']]
    for sh in tl['shots'][1:]:
        c = sh['start']
        if c < h1 or any(abs(c - x) < 0.4 for x in loud):
            continue
        put_hit(m, 'whoosh_short', c - 0.02, -14.0)
    # --- the radio: crackle under the announcement, a clock ticking while they pack
    loop('beds', 'radio_hum', L['L2']['start'] - 0.15, L['L3']['start'], -12.0, fin=0.05, fout=0.3)
    loop('beds', 'drone_bed', L['L2']['start'], L['L4']['start'], -12.0, fin=0.3, fout=0.2)
    t = L['L2']['start'] + 0.3
    while t < L['L4']['start'] - 0.3:
        put_hit(m, 'tick', t, -17.0)
        t += 1.0
    put_hit(m, 'impact_soft', p['evac'], -8.0)
    put_hit(m, 'suitcase_shut', p['days3'] - 0.3, -12.0)
    put_hit(m, 'impact_soft', p['days3'], -9.0)
    # --- the buses: diesels idling in the street, the doors, a drum on «тысячи», the column driving off
    loop('beds', 'bus_idle', L['L4']['start'] - 0.2, L['L6']['start'] + 0.5, -14.0, fin=0.4, fout=0.5)
    loop('beds', 'pulse_dark', L['L4']['start'] - 0.1, L['L6']['start'], -10.0, fin=0.3, fout=0.2)
    put_hit(m, 'drum_big', p['thousand'], -6.0)
    put_hit(m, 'bus_door', p['n50'] - 0.4, -12.0)
    put_hit(m, 'impact_soft', p['n50'], -9.0)
    put_hit(m, 'impact_soft', p['hours'], -9.0)
    # --- the pets left behind, the flats as they were: the sad piano and the wind come in
    loop('beds', 'piano_sad', L['L6']['start'] - 0.1, L['L9']['start'], -10.0, fin=0.4, fout=0.4)
    loop('beds', 'ambience_wind_dead_forest', L['L7']['start'] - 0.2, L['L9']['start'] + 0.3, -16.0, fin=0.5,
         fout=0.5)
    put_hit(m, 'bus_door', p['run'] - 0.5, -13.0)
    put_hit(m, 'sub_drop', p['no'], -9.0)
    put_hit(m, 'impact_soft', p['toys'], -10.0)
    # --- why «three days»: a low drop on «паники»
    put_hit(m, 'sub_drop', p['panic'], -8.0)
    # --- the dead zone: the Geiger counter, the tension back, a hit on «зачем?»
    loop('beds', 'geiger', p['zone'] - 0.2, p['sub'] + 0.5, -18.0, fin=0.4, fout=0.5)
    loop('beds', 'drone_bed_tension', L['L9']['start'] - 0.1, p['sub'], -10.0, fin=0.3, fout=0.2)
    put_hit(m, 'heartbeat', p['back'], -8.0)
    put_hit(m, 'drum_big', p['what'], -5.0)
    loop('beds', 'pad_hope', p['sub'] - 0.1, total, -11.0, fin=0.4, fout=0.03)
    put_hit(m, 'riser_2s', total - 0.02, -9.0)
    ec = tl.get('endcard')
    if ec:
        put_hit(m, 'whoosh_short', ec['start'] - 0.12, -10.0)
