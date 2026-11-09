"""Vectorise le symbole SEN AIR (logoPNG.png) en SVG : un contour par couleur."""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage
import contourpy

src, out = sys.argv[1], sys.argv[2]
im = np.asarray(Image.open(src).convert('RGBA')).astype(float) / 255
rgb, alpha = im[..., :3], im[..., 3]
COLORS = {'#5AC8FA': (0x5A, 0xC8, 0xFA), '#6DBE45': (0x6D, 0xBE, 0x45)}
refs = {k: np.array(v) / 255 for k, v in COLORS.items()}
dist = {k: np.linalg.norm(rgb - r, axis=-1) for k, r in refs.items()}
SCALE = 8

def simplify(points, tol):
    if len(points) < 3:
        return points
    a, b = points[0], points[-1]
    ab = b - a
    n = np.linalg.norm(ab)
    d = np.abs(ab[0] * (points[:, 1] - a[1]) - ab[1] * (points[:, 0] - a[0])) / n if n > 0 else np.linalg.norm(points - a, axis=1)
    i = int(np.argmax(d))
    if d[i] > tol:
        return np.vstack([simplify(points[: i + 1], tol)[:-1], simplify(points[i:], tol)])
    return np.vstack([a, b])

paths = []
for key in COLORS:
    other = [k for k in COLORS if k != key][0]
    mask = alpha * (dist[key] < dist[other])
    big = ndimage.zoom(mask, SCALE, order=3)
    big = ndimage.gaussian_filter(big, sigma=SCALE * 0.35)
    gen = contourpy.contour_generator(z=big)
    d = []
    for line in gen.lines(0.5):
        pts = simplify((line + 0.5) / SCALE, 0.12)  # centre des pixels agrandis vers coordonnées SVG
        if len(pts) < 4:
            continue
        d.append('M' + ' L'.join(f'{x:.2f} {y:.2f}' for y, x in [(p[1], p[0]) for p in pts]) + ' Z')
    paths.append((key, ' '.join(d)))

ys, xs = np.nonzero(alpha > 0.1)
pad = 2
x0, y0, x1, y1 = xs.min() - pad, ys.min() - pad, xs.max() + 1 + pad, ys.max() + 1 + pad
svg = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0} {y0} {x1 - x0} {y1 - y0}">']
for color, d in paths:
    svg.append(f'  <path fill="{color}" fill-rule="evenodd" d="{d}"/>')
svg.append('</svg>')
open(out, 'w').write('\n'.join(svg) + '\n')
print(out, 'viewBox', x0, y0, x1 - x0, y1 - y0, [len(d) for _, d in paths])
