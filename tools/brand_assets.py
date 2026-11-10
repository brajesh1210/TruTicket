"""Generate TruTicket brand assets from the supplied logo.

Input : /home/user/uploads/image-2.png  (1254x1254 logo tile, supplied by user)
Output: assets/brand/*.png
Run   : python tools/brand_assets.py   (needs Pillow + numpy)
"""
import os
import sys

import numpy as np
from PIL import Image

SRC = os.environ.get("TT_LOGO", "/home/user/uploads/image-2.png")
OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "brand")
os.makedirs(OUT, exist_ok=True)

BG = (11, 11, 11, 255)  # #0B0B0B base background


def centered(img, size, scale, bg=(0, 0, 0, 0)):
    canvas = Image.new("RGBA", (size, size), bg)
    w, h = img.size
    k = min(size * scale / w, size * scale / h)
    im = img.resize((int(w * k), int(h * k)), Image.LANCZOS)
    canvas.paste(im, ((size - im.size[0]) // 2, (size - im.size[1]) // 2), im)
    return canvas


def main():
    src = Image.open(SRC).convert("RGB")
    src.save(os.path.join(OUT, "logo-tile.png"))

    a = np.asarray(src).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    cyan = np.clip((g + b) / 2 - r, 0, 255)
    alpha = np.clip((cyan - 25) / (120 - 25), 0, 1)

    rgba = np.zeros((a.shape[0], a.shape[1], 4), dtype=np.uint8)
    rgba[..., 0] = 0x0A
    rgba[..., 1] = 0xCB
    rgba[..., 2] = 0xDB
    rgba[..., 3] = (alpha * 255).astype(np.uint8)
    mark = Image.fromarray(rgba, "RGBA")
    mark = mark.crop(mark.getbbox())
    mark.save(os.path.join(OUT, "logo-mark.png"))

    src.resize((1024, 1024), Image.LANCZOS).save(os.path.join(OUT, "icon-1024.png"))
    centered(mark, 1024, 0.60).save(os.path.join(OUT, "adaptive-foreground-1024.png"))
    centered(mark, 1024, 0.42, BG).save(os.path.join(OUT, "splash-1024.png"))
    centered(mark, 48, 0.9).save(os.path.join(OUT, "favicon-48.png"))
    centered(mark, 512, 0.7, BG).save(os.path.join(OUT, "web-icon-512.png"))

    og = Image.new("RGBA", (1200, 630), BG)
    m = centered(mark, 630, 0.5)
    og.paste(m, (120, 0), m)
    og.convert("RGB").save(os.path.join(OUT, "og-image-1200x630.png"))
    print("mark bbox:", mark.size)
    print("assets written to", os.path.abspath(OUT))


if __name__ == "__main__":
    sys.exit(main())
