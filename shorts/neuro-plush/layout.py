# Раскладка: каждая реплика начинается через pre после конца предыдущей; кадр начинается с первой своей реплики минус pre.
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
p = os.path.join(HERE, 'story.json'); ST = json.load(open(p))
t, cur, shots = 0.0, None, {}
for i, L in enumerate(ST['lines']):
    if L['shot'] != cur:
        if cur: t += ST['shotPost'][cur]
        cur = L['shot']; shots[cur] = round(t, 3)
    L['t0'] = round(t + L['pre'], 3); t = L['t0'] + L['d']
t += ST['shotPost'][cur]; shots['END'] = round(t, 3)
ST['dur'] = round(t + ST['endCard'], 2); ST['shots'] = shots
lines = ST['lines']
for i, L in enumerate(lines):
    nxt = lines[i + 1]['t0'] if i + 1 < len(lines) else shots['END']
    L['sub1'] = round(min(L['t0'] + L['d'] + .35, nxt - .04), 3)
    print(f"{L['id']:4} {L['shot']} {L['t0']:6.2f}-{L['t0'] + L['d']:6.2f}  {L['text']}")
print(shots, 'dur', ST['dur'])
json.dump(ST, open(p, 'w'), ensure_ascii=False, indent=1)
