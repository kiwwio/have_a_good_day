"""好日子行事曆：產生手機 App 的圖示與啟動畫面（Android、iOS）。
圖樣與網頁版相同：撕頁日曆（紅色頁首＋大字「好」）。
用法：在 好日子行事曆_app_v3.0 資料夾執行  python tools/make-app-icons.py
"""
import os, glob
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = os.path.join(ROOT, "android", "app", "src", "main", "res")
IOS = os.path.join(ROOT, "ios", "App", "App", "Assets.xcassets")

PAPER = (244, 241, 232); SHEET = (255, 253, 247); INK = (20, 23, 28); RED = (154, 18, 9); LINE = (140, 133, 121)
FONT = next(p for p in [r"C:\Windows\Fonts\msjhbd.ttc", r"C:\Windows\Fonts\msjh.ttc"] if os.path.exists(p))


def calendar(S, safe, bg):
    """畫一張 S×S 的日曆圖示；safe = 日曆占畫面的比例；bg = 底色（None 為透明）"""
    im = Image.new("RGBA", (S, S), bg + (255,) if bg else (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    w = int(S * safe); x0 = (S - w) // 2; y0 = (S - w) // 2 + int(w * 0.03); x1 = x0 + w; y1 = y0 + int(w * 0.94)
    r = int(w * 0.12)
    d.rounded_rectangle([x0, y0 + w // 100, x1, y1 + w // 100], r, fill=(210, 204, 190, 255))   # 陰影
    d.rounded_rectangle([x0, y0, x1, y1], r, fill=SHEET, outline=LINE, width=max(2, w // 90))
    head = int(w * 0.26)
    d.rounded_rectangle([x0, y0, x1, y0 + head], r, fill=RED)
    d.rectangle([x0, y0 + head - r, x1, y0 + head], fill=RED)
    for cx in (x0 + w * 0.3, x0 + w * 0.7):                                                     # 掛環
        rr = w * 0.045
        d.ellipse([cx - rr, y0 - rr * 1.6, cx + rr, y0 + rr * 0.4], fill=INK)
    f = ImageFont.truetype(FONT, int(w * 0.58))
    bb = d.textbbox((0, 0), "好", font=f)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    cy = y0 + head + (y1 - y0 - head) / 2
    d.text((S / 2 - tw / 2 - bb[0], cy - th / 2 - bb[1]), "好", font=f, fill=INK)
    return im


def scaled(im, size):
    return im.resize((size, size), Image.LANCZOS)


def save(im, path, rgb=False):
    if rgb:
        im = im.convert("RGB")
    im.save(path)
    print("  ", os.path.relpath(path, ROOT), im.size)


BIG = 1024
legacy = calendar(BIG, 0.80, PAPER)        # 舊版 Android 方形圖示
fg = calendar(BIG, 0.46, None)             # Android 8+ 自適應圖示前景：內容要在中央直徑 66/108 的圓形安全區內，連圓角都不被裁
round_src = calendar(BIG, 0.66, PAPER)     # 圓形圖示

mask = Image.new("L", (BIG, BIG), 0)
ImageDraw.Draw(mask).ellipse([0, 0, BIG - 1, BIG - 1], fill=255)
round_im = Image.new("RGBA", (BIG, BIG), (0, 0, 0, 0)); round_im.paste(round_src, (0, 0), mask)

print("Android 圖示")
for dpi, n in {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}.items():
    folder = os.path.join(RES, "mipmap-" + dpi)
    save(scaled(legacy, n), os.path.join(folder, "ic_launcher.png"))
    save(scaled(round_im, n), os.path.join(folder, "ic_launcher_round.png"))
    save(scaled(fg, int(n * 108 / 48)), os.path.join(folder, "ic_launcher_foreground.png"))

with open(os.path.join(RES, "values", "ic_launcher_background.xml"), "w", encoding="utf-8") as fh:
    fh.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#F4F1E8</color>\n</resources>\n')

print("Android 啟動畫面（舊版 Android；Android 12 以上改用圖示＋底色，見 styles.xml）")
for path in glob.glob(os.path.join(RES, "drawable*", "splash.png")):
    w, h = Image.open(path).size
    im = Image.new("RGBA", (w, h), PAPER + (255,))
    n = int(min(w, h) * 0.42)
    im.alpha_composite(scaled(calendar(BIG, 0.9, None), n), ((w - n) // 2, (h - n) // 2))
    save(im, path, rgb=True)

print("iOS 圖示與啟動畫面")
save(calendar(BIG, 0.80, PAPER), os.path.join(IOS, "AppIcon.appiconset", "AppIcon-512@2x.png"), rgb=True)
for path in glob.glob(os.path.join(IOS, "Splash.imageset", "*.png")):
    S = 2732
    im = Image.new("RGBA", (S, S), PAPER + (255,))
    n = 700
    im.alpha_composite(scaled(calendar(BIG, 0.9, None), n), ((S - n) // 2, (S - n) // 2))
    save(im, path, rgb=True)

# 預覽圖（給人看，不會打包進 App）
prev = Image.new("RGBA", (3 * 300 + 80, 380), (255, 255, 255, 255))
d = ImageDraw.Draw(prev)
adaptive = Image.new("RGBA", (BIG, BIG), PAPER + (255,)); adaptive.alpha_composite(fg)
cut = int(BIG * 18 / 108); adaptive = adaptive.crop((cut, cut, BIG - cut, BIG - cut)).resize((BIG, BIG), Image.LANCZOS)  # 桌面只顯示中央 72/108
amask = Image.new("L", (BIG, BIG), 0); ImageDraw.Draw(amask).ellipse([0, 0, BIG - 1, BIG - 1], fill=255)
circ = Image.new("RGBA", (BIG, BIG), (0, 0, 0, 0)); circ.paste(adaptive, (0, 0), amask)
for i, (img, label) in enumerate([(legacy, "legacy"), (circ, "adaptive (circle)"), (round_im, "round")]):
    prev.alpha_composite(scaled(img, 260), (20 + i * 320, 20))
    d.text((40 + i * 320, 300), label, fill=(0, 0, 0, 255))
os.makedirs(os.path.join(ROOT, "tools", "shots"), exist_ok=True)
prev.save(os.path.join(ROOT, "tools", "shots", "icon-preview.png"))
print("ok")
