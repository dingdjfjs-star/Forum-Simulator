"""生成 PWA 图标（纯 Python，无第三方依赖）：
- 圆角方形渐变底 + 白色对话气泡 + 三个点
- 3~4 倍超采样抗锯齿
输出：icon-192.png / icon-512.png / icon-maskable-512.png / apple-touch-icon.png
"""
import zlib
import struct
import os

OUT = r"E:\buddy\网站\forum-simulator\public\icons"
os.makedirs(OUT, exist_ok=True)

TOP = (0x63, 0x8C, 0xB0)     # 顶部渐变蓝
BOTTOM = (0x38, 0x55, 0x72)  # 底部深蓝
BUBBLE = (0xFD, 0xFC, 0xF8)  # 气泡白
DOT = (0x46, 0x69, 0x87)     # 气泡内的点


def write_png(path, w, h, buf):
    raw = bytearray()
    stride = w * 4
    for y in range(h):
        raw.append(0)
        raw += buf[y * stride:(y + 1) * stride]

    def chunk(tag, data):
        return (struct.pack(">I", len(data)) + tag + data
                + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF))

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)


def in_round_rect(x, y, x0, y0, x1, y1, r):
    if x < x0 or x > x1 or y < y0 or y > y1:
        return False
    cx = min(max(x, x0 + r), x1 - r)
    cy = min(max(y, y0 + r), y1 - r)
    dx = x - cx
    dy = y - cy
    return dx * dx + dy * dy <= r * r


def in_circle(x, y, cx, cy, r):
    dx = x - cx
    dy = y - cy
    return dx * dx + dy * dy <= r * r


def in_tri(px, py, ax, ay, bx, by, cx, cy):
    def sign(x1, y1, x2, y2, x3, y3):
        return (x1 - x3) * (y2 - y3) - (x2 - x3) * (y1 - y3)
    d1 = sign(px, py, ax, ay, bx, by)
    d2 = sign(px, py, bx, by, cx, cy)
    d3 = sign(px, py, cx, cy, ax, ay)
    neg = (d1 < 0) or (d2 < 0) or (d3 < 0)
    pos = (d1 > 0) or (d2 > 0) or (d3 > 0)
    return not (neg and pos)


def render(size, ss, rounded, scale):
    """渲染图标：size 输出边长，ss 超采样倍数，rounded 是否圆角，scale 内容缩放"""
    n = size * ss
    canvas = bytearray(n * n * 4)

    def px(i, r, g, b, a):
        canvas[i] = r
        canvas[i + 1] = g
        canvas[i + 2] = b
        canvas[i + 3] = a

    # 内容区域（居中缩放）
    def mapc(v):
        return (0.5 + (v - 0.5) * scale) * n

    bx0, by0 = mapc(0.20), mapc(0.27)
    bx1, by1 = mapc(0.80), mapc(0.62)
    br = (bx1 - bx0) * 0.30
    # 尾巴三角
    t1 = (mapc(0.33), mapc(0.61))
    t2 = (mapc(0.45), mapc(0.61))
    t3 = (mapc(0.31), mapc(0.78))
    dots = [(mapc(dx), mapc(0.445), (bx1 - bx0) * 0.075) for dx in (0.365, 0.50, 0.635)]

    for y in range(n):
        fy = (y + 0.5) / n
        # 背景渐变（沿 y 轴）
        t = fy
        bg = (
            int(TOP[0] + (BOTTOM[0] - TOP[0]) * t),
            int(TOP[1] + (BOTTOM[1] - TOP[1]) * t),
            int(TOP[2] + (BOTTOM[2] - TOP[2]) * t),
        )
        row = y * n * 4
        for x in range(n):
            fx = (x + 0.5) / n
            i = row + x * 4
            # 1. 背景（圆角方形，或满幅）
            if rounded:
                r = 0.22 * n
                if not in_round_rect(x + 0.5, y + 0.5, 0, 0, n, n, r):
                    px(i, 0, 0, 0, 0)
                    continue
            # 2. 气泡 + 尾巴
            if in_round_rect(x + 0.5, y + 0.5, bx0, by0, bx1, by1, br) or \
               in_tri(x + 0.5, y + 0.5, *t1, *t2, *t3):
                is_dot = any(in_circle(x + 0.5, y + 0.5, cx, cy, dr) for cx, cy, dr in dots)
                c = DOT if is_dot else BUBBLE
                px(i, c[0], c[1], c[2], 255)
            else:
                px(i, bg[0], bg[1], bg[2], 255)

    # 降采样
    out = bytearray(size * size * 4)
    inv = 1.0 / (ss * ss)
    for y in range(size):
        for x in range(size):
            r = g = b = a = 0
            for dy in range(ss):
                base = ((y * ss + dy) * n + x * ss) * 4
                for dx in range(ss):
                    j = base + dx * 4
                    r += canvas[j]
                    g += canvas[j + 1]
                    b += canvas[j + 2]
                    a += canvas[j + 3]
            k = (y * size + x) * 4
            out[k] = int(r * inv + 0.5)
            out[k + 1] = int(g * inv + 0.5)
            out[k + 2] = int(b * inv + 0.5)
            out[k + 3] = int(a * inv + 0.5)
    return out


jobs = [
    ("icon-192.png", 192, 4, True, 1.0),
    ("icon-512.png", 512, 3, True, 1.0),
    ("icon-maskable-512.png", 512, 2, False, 0.62),   # 满幅底 + 内容缩到安全区
    ("apple-touch-icon.png", 180, 2, False, 0.86),    # iOS 自己加圆角，需满幅
]

for name, size, ss, rounded, scale in jobs:
    buf = render(size, ss, rounded, scale)
    path = os.path.join(OUT, name)
    write_png(path, size, size, buf)
    print(f"{name}: {size}x{size}, {os.path.getsize(path)} bytes")
