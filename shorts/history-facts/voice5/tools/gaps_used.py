# Pauses between lines for the renderer (GAPS_JSON) when the voice is a continuous read: the narrator's own pause
# (cut_cont.py writes them to gaps.json), but not shorter than 0.25 s, and the episode's long dramatic pauses
# (0.55 s and more in its GAPS) stay at least as long as planned. An episode near its length limit can cap the
# narrator's other pauses with GAP_MAX (s).
# usage: python3 gaps_used.py <render/episodes/<episode>.py> <cut dir>/gaps.json <out json>
import importlib.util, json, os, sys

EP_PY, NAT, OUT = sys.argv[1:4]
sys.dont_write_bytecode = True                  # no __pycache__ next to the episode modules in the repo
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(EP_PY))))    # render/, for the module's own imports
spec = importlib.util.spec_from_file_location('ep', EP_PY)
ep = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ep)
nat = json.load(open(NAT))
cap = getattr(ep, 'GAP_MAX', None) or 99.0
g = {lid: round(min(max(nat[lid], 0.25), cap) if e < 0.55 else max(nat[lid], e), 2) for lid, e in ep.GAPS.items()
     if lid in nat}
json.dump(g, open(OUT, 'w'))
print('episode', ep.GAPS)
print('natural', nat)
print('used   ', g)
