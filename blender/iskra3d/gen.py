# image → 3D through the free TRELLIS.2 demo (Hugging Face ZeroGPU), approved by the owner 16.11:
# preprocess, generate, extract a textured GLB
import sys, shutil, time
from gradio_client import Client, handle_file
img, out, seed, res = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4]
c = Client('microsoft/TRELLIS.2', verbose=False)
t = time.time()
try: c.predict(api_name='/start_session')
except Exception as e: print('start_session:', e)
pre = c.predict(handle_file(img), api_name='/preprocess_image'); print('pre', pre, round(time.time() - t))
p = pre['path'] if isinstance(pre, dict) else pre
shutil.copy(p, out + '-pre.png')
r = c.predict(handle_file(p), seed, res, api_name='/image_to_3d'); print('gen', str(r)[:200], round(time.time() - t))
g = c.predict(300000, 2048, api_name='/extract_glb'); print('glb', g, round(time.time() - t))
shutil.copy(g[0] if isinstance(g, (list, tuple)) else g, out + '.glb')
print('DONE')
