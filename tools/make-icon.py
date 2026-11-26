# Uygulama simgesi: parşömen üstünde deri gezgin defteri, kapağında alev (annenin defteri: "Isı kaybolmaz").
# Çalıştır: python3 tools/make-icon.py  → android/app/src/main/res/mipmap-*/ ve public/icon.png
import math, os, random
from PIL import Image, ImageDraw, ImageFilter

S = 1024                       # çizim tuvali (108dp karşılığı)
PAPER = (234, 224, 200); INK = (42, 39, 34); LEATHER = (122, 82, 50); LEATHER_D = (92, 60, 36)
FLAME_O = (224, 122, 46); FLAME_I = (255, 210, 122); RED = (158, 52, 35)
RES = "android/app/src/main/res"
random.seed(7)

def wobbly_poly(d, pts, fill=None, outline=INK, width=14):
    d.polygon(pts, fill=fill)
    if outline: d.line(pts + [pts[0]], fill=outline, width=width, joint="curve")

def notebook(scale=1.0):
    """Şeffaf zeminde defter (adaptif simgenin ön katmanı): güvenli alan ortadaki %62."""
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    c = S / 2; w = 560 * scale; h = 660 * scale; x0, y0 = c - w / 2, c - h / 2 + 10
    # sayfalar (arkada, sağ kenardan görünen)
    d.rounded_rectangle([x0 + 40, y0 + 22, x0 + w + 26, y0 + h + 10], radius=36, fill=(244, 236, 214), outline=INK, width=12)
    for i in range(4): d.line([x0 + w + 6 + i * 4, y0 + 60, x0 + w + 6 + i * 4, y0 + h - 30], fill=(190, 178, 150), width=3)
    # kapak
    d.rounded_rectangle([x0, y0, x0 + w, y0 + h], radius=44, fill=LEATHER, outline=INK, width=14)
    d.rounded_rectangle([x0, y0, x0 + 86 * scale, y0 + h], radius=44, fill=LEATHER_D, outline=INK, width=14)  # sırt
    # dikiş
    m = 46 * scale
    for t in range(0, 1000, 26):
        pass
    def dashed(p, q):
        L = math.dist(p, q); n = int(L / 30)
        for k in range(n):
            a = k / n; b = (k + 0.55) / n
            d.line([p[0] + (q[0] - p[0]) * a, p[1] + (q[1] - p[1]) * a, p[0] + (q[0] - p[0]) * b, p[1] + (q[1] - p[1]) * b], fill=(214, 182, 136), width=7)
    xs, ys, xe, ye = x0 + 86 * scale + 30, y0 + m, x0 + w - m, y0 + h - m
    dashed((xs, ys), (xe, ys)); dashed((xe, ys), (xe, ye)); dashed((xe, ye), (xs, ye)); dashed((xs, ye), (xs, ys))
    # alev amblemi: kapağın ortasında daire içinde
    cx = (xs + xe) / 2; cy = y0 + h * 0.46; R = 150 * scale
    d.ellipse([cx - R, cy - R, cx + R, cy + R], fill=(236, 220, 186), outline=INK, width=12)
    fl = [(cx, cy - R * 0.78)]
    for a in range(0, 181, 12):   # alev: alt yarım daire + iki kıvrım
        r = math.radians(a); fl.append((cx + math.cos(r) * R * 0.48, cy + R * 0.18 + math.sin(r) * R * 0.48))
    fl = [(cx, cy - R * 0.78), (cx + R * 0.22, cy - R * 0.35), (cx + R * 0.5, cy - R * 0.1)] + fl[1:] + [(cx - R * 0.5, cy - R * 0.05), (cx - R * 0.28, cy - R * 0.42), (cx - R * 0.1, cy - R * 0.2)]
    d.polygon(fl, fill=FLAME_O); d.line(fl + [fl[0]], fill=INK, width=11, joint="curve")
    inner = [(cx, cy - R * 0.2), (cx + R * 0.24, cy + R * 0.25), (cx, cy + R * 0.5), (cx - R * 0.24, cy + R * 0.25)]
    d.polygon(inner, fill=FLAME_I)
    # kayış ve toka
    sy = y0 + h * 0.78
    d.rectangle([x0 + w - 150 * scale, sy - 34 * scale, x0 + w + 40 * scale, sy + 34 * scale], fill=LEATHER_D, outline=INK, width=11)
    d.rounded_rectangle([x0 + w - 4 * scale, sy - 48 * scale, x0 + w + 66 * scale, sy + 48 * scale], radius=14, fill=(201, 162, 74), outline=INK, width=11)
    # yer imi şeridi
    bx = x0 + w * 0.7
    d.polygon([(bx, y0 + h - 6), (bx + 44, y0 + h - 6), (bx + 44, y0 + h + 90), (bx + 22, y0 + h + 66), (bx, y0 + h + 90)], fill=RED, outline=INK)
    return im

def paper_bg(size, rounded=False):
    """Parşömen zemin: hafif lekeli, kenarlarda koyulaşan."""
    bg = Image.new("RGB", (size, size), PAPER); px = bg.load()
    for y in range(size):
        for x in range(size):
            dx, dy = (x - size / 2) / (size / 2), (y - size / 2) / (size / 2); v = min(1, math.hypot(dx, dy))
            n = random.randint(-4, 4); k = 1 - 0.12 * v ** 2
            px[x, y] = tuple(max(0, min(255, int(c * k) + n)) for c in PAPER)
    bg = bg.convert("RGBA")
    if rounded:
        m = Image.new("L", (size, size), 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * 0.22), fill=255); bg.putalpha(m)
    return bg

def main():
    fg = notebook(0.86)                       # adaptif ön katman (güvenli alan içinde)
    sizes = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
    for name, k in sizes.items():
        d = f"{RES}/mipmap-{name}"; os.makedirs(d, exist_ok=True)
        fg.resize((int(108 * k),) * 2, Image.LANCZOS).save(f"{d}/ic_launcher_foreground.png")
        # eski tip simge: parşömen + defter, köşeleri yuvarlak; yuvarlak simge: daire
        n = int(48 * k); big = paper_bg(512); big.alpha_composite(notebook(1.02).resize((512, 512), Image.LANCZOS))
        sq = big.copy(); mask = Image.new("L", (512, 512), 0); ImageDraw.Draw(mask).rounded_rectangle([0, 0, 511, 511], radius=110, fill=255); sq.putalpha(mask)
        sq.resize((n, n), Image.LANCZOS).save(f"{d}/ic_launcher.png")
        rd = big.copy(); mask = Image.new("L", (512, 512), 0); ImageDraw.Draw(mask).ellipse([0, 0, 511, 511], fill=255); rd.putalpha(mask)
        rd.resize((n, n), Image.LANCZOS).save(f"{d}/ic_launcher_round.png")
    with open(f"{RES}/values/ic_launcher_background.xml", "w") as f:
        f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#EAE0C8</color>\n</resources>\n')
    # web/önizleme ve açılış ekranı için
    big = paper_bg(512, rounded=True); big.alpha_composite(notebook(0.9).resize((512, 512), Image.LANCZOS)); big.save("public/icon.png")
    # açılış ekranı (Capacitor splash): parşömen, ortada defter
    for folder in os.listdir(RES):
        p = f"{RES}/{folder}/splash.png"
        if not os.path.exists(p): continue
        w, h = Image.open(p).size; sp = Image.new("RGBA", (w, h), PAPER + (255,))
        k = int(min(w, h) * 0.42); sp.alpha_composite(notebook(0.95).resize((k, k), Image.LANCZOS), ((w - k) // 2, (h - k) // 2 - int(h * 0.04)))
        sp.convert("RGB").save(p)

if __name__ == "__main__":
    main()
