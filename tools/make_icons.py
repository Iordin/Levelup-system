"""Draws the app icons: a neon hexagon with a V (level-up chevron) on the system's void colour."""
from PIL import Image, ImageDraw, ImageFilter
import math, sys, os
OUT = sys.argv[1] if len(sys.argv) > 1 else 'icons'
os.makedirs(OUT, exist_ok=True)
BG, ACC = (5, 8, 19, 255), (0, 204, 255, 255)

def art(size, scale=1.0):
    """Transparent layer with the glowing emblem, `scale` = share of the canvas it may use."""
    S = size * 4
    layer = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    c = S / 2; R = S * 0.40 * scale
    hexa = [(c + R * math.cos(math.radians(a)), c + R * math.sin(math.radians(a))) for a in range(-90, 270, 60)]
    d.line(hexa + [hexa[0]], fill=ACC, width=int(S * 0.045 * scale), joint='curve')
    u = R / 190.0  # unit: 1 = original 512px design coordinates
    def P(x, y): return (c + (x - 256) * u, c + (y - 256) * u)
    d.polygon([P(146, 186), P(210, 186), P(256, 284), P(302, 186), P(366, 186), P(284, 346), P(228, 346)], fill=ACC)
    d.line([P(222, 152), P(256, 118), P(290, 152)], fill=ACC, width=int(S * 0.026 * scale), joint='curve')
    glow = layer.filter(ImageFilter.GaussianBlur(S * 0.018))
    out = Image.alpha_composite(Image.new('RGBA', (S, S), (0, 0, 0, 0)), glow)
    out = Image.alpha_composite(out, glow)
    return Image.alpha_composite(out, layer)

def icon(size, scale, rounded):
    base = Image.new('RGBA', (size * 4, size * 4), BG)
    base = Image.alpha_composite(base, art(size, scale))
    if rounded:
        m = Image.new('L', base.size, 0)
        ImageDraw.Draw(m).rounded_rectangle([0, 0, base.size[0] - 1, base.size[1] - 1], radius=int(base.size[0] * 0.22), fill=255)
        base.putalpha(m)
    return base.resize((size, size), Image.LANCZOS)

icon(192, 1.0, True).save(f'{OUT}/icon-192.png')
icon(512, 1.0, True).save(f'{OUT}/icon-512.png')
icon(512, 0.68, False).save(f'{OUT}/icon-maskable-512.png')
icon(180, 0.86, False).convert('RGB').save(f'{OUT}/apple-touch-icon.png')
print('icons ok')
