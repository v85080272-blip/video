import sys, numpy as np, onnxruntime as ort
from PIL import Image
def load_session(path='/home/user/work/models/sdxl_vae_decoder.onnx', threads=4):
    so = ort.SessionOptions(); so.intra_op_num_threads = threads
    return ort.InferenceSession(path, so, providers=['CPUExecutionProvider'])
def decode(sess, base, out_png, scale=0.13025):
    shape = [int(x) for x in open(base + '.shape').read().split()]
    W, H, C = shape[0], shape[1], shape[2]
    z = np.fromfile(base + '.bin', dtype=np.float32).reshape(1, C, H, W)
    y = sess.run(None, {'latent_sample': (z / scale).astype(np.float32)})[0][0]
    img = np.clip((y.transpose(1, 2, 0) + 1) * 127.5 + 0.5, 0, 255).astype(np.uint8)
    Image.fromarray(img).save(out_png)
    return img
if __name__ == '__main__':
    s = load_session()
    for base in sys.argv[1:]:
        decode(s, base, base + '.png'); print('decoded', base)
