# Pauses between lines for the renderer (GAPS_JSON) when the voice is a continuous read: the narrator's own pause
# (cut_cont.py writes them to gaps.json), but not shorter than 0.25 s, and the episode's long dramatic pauses
# (0.55 s and more in its GAPS) stay at least as long as planned.
# usage: python3 gaps_used.py <render/episodes/<episode>.py> <cut dir>/gaps.json <out json>
import importlib.util, json, os, sys

EP_PY, NAT, OUT = sys.argv[1:4]
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(EP_PY))))    # render/, for the module's own imports
spec = importlib.util.spec_from_file_location('ep', EP_PY)
ep = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ep)
nat = json.load(open(NAT))
g = {lid: round(max(nat[lid], 0.25) if e < 0.55 else max(nat[lid], e), 2) for lid, e in ep.GAPS.items() if lid in nat}
json.dump(g, open(OUT, 'w'))
print('episode', ep.GAPS)
print('natural', nat)
print('used   ', g)
