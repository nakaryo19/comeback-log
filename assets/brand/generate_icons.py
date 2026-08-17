#!/usr/bin/env python3
"""
アプリアイコン・スプラッシュ・favicon を生成する。

意匠：いちど下がってから、出発点より高いところまで戻る一本の線。
末端の点が「いま」。挽回ログが可視化しようとしているもの（実績と感情の波、
そこからの立て直し）を、そのまま図形にしている。

配色は `lib/theme.ts` の primary / primaryDark をそのまま使う。
アイコンだけ別の色を持たせると、アプリを開いた瞬間に色が変わって見えるため。

**実行方法**（Pillow はこのプロジェクトの依存ではないので、使い捨ての venv で入れる）:

    python3 -m venv /tmp/iconvenv
    /tmp/iconvenv/bin/pip install pillow
    /tmp/iconvenv/bin/python assets/brand/generate_icons.py

生成物は assets/ 直下を上書きする。手で描き直すのではなく、
この意匠を変えたいときはこのファイルの座標・色を編集して再実行すること。
"""

from pathlib import Path
from PIL import Image, ImageDraw

ASSETS = Path(__file__).resolve().parent.parent

# lib/theme.ts と同じ値
PRIMARY = (99, 102, 241)  # #6366F1
PRIMARY_DARK = (67, 56, 202)  # #4338CA
BACKGROUND = (249, 250, 251)  # #F9FAFB

# 描画は 4 倍で行い、最後に縮小して輪郭を滑らかにする
# （Pillow の線描画にアンチエイリアスが無いため）
SS = 4
SIZE = 1024

# 1024 座標系での折れ線。下がって、そこから二段で出発点より高く戻る。
#
# **2点の V 字にしないこと。** 一度そう描いたが、ただのチェックマークに見えた。
# タスク管理アプリのアイコンとして最もありふれた形で、
# 「波があって、そこから戻る」という本題が消える。
# 折れ点を増やし、各頂点に小さな点を置くことで、記録の推移として読ませている。
STROKE = 52
DOT_R = 66  # 末端の点＝「いま」。他の頂点より大きくして終着点だと分かるようにする
VERTEX_R = 44
PATH = [(232, 480), (400, 690), (556, 610), (760, 350)]

# Android のアダプティブアイコンは外周が切り取られる。
# 中央 66% に収まらない図形は端末の形状によって欠ける
ADAPTIVE_SCALE = 0.66


def scaled(points, factor, size=SIZE):
    """図形を中心基準で拡大縮小する"""
    c = size / 2
    return [(c + (x - c) * factor, c + (y - c) * factor) for x, y in points]


def dot(draw, center, r, color):
    x, y = center
    draw.ellipse([x - r, y - r, x + r, y + r], fill=color)


def draw_mark(draw, points, color, stroke, dot_r, vertex_r):
    """折れ線・各頂点の点・末端の点を描く。線の角と端は丸くする"""
    draw.line(points, fill=color, width=stroke, joint="curve")
    # 末端以外のすべての頂点に打点を置く。これが無いと折れ線がただの記号に見える。
    # **打点の半径は線幅の半分より明確に大きくすること。** 同じだと線に埋もれて消える
    for p in points[:-1]:
        dot(draw, p, vertex_r, color)
    dot(draw, points[-1], dot_r, color)


def gradient(size):
    """左上から右下へ primary → primaryDark。小さく作って引き伸ばす"""
    n = 256
    small = Image.new("RGB", (n, n))
    px = []
    for y in range(n):
        for x in range(n):
            t = (x + y) / (2 * (n - 1))
            px.append(tuple(round(a + (b - a) * t) for a, b in zip(PRIMARY, PRIMARY_DARK)))
    small.putdata(px)
    return small.resize((size, size), Image.LANCZOS)


def render(background, mark_color, scale=1.0):
    """4 倍で描いて 1024 に落とす。background が None なら透過"""
    big = SIZE * SS
    if background is None:
        img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    elif background == "gradient":
        img = gradient(big).convert("RGBA")
    else:
        img = Image.new("RGBA", (big, big), background)

    draw = ImageDraw.Draw(img)
    points = [(x * SS, y * SS) for x, y in scaled(PATH, scale)]
    draw_mark(
        draw,
        points,
        mark_color,
        round(STROKE * scale * SS),
        DOT_R * scale * SS,
        VERTEX_R * scale * SS,
    )
    return img.resize((SIZE, SIZE), Image.LANCZOS)


def save(img, name, size=SIZE, rgb=False):
    out = img if size == SIZE else img.resize((size, size), Image.LANCZOS)
    # App Store のアイコンはアルファチャンネルを持っていると審査で弾かれる
    if rgb:
        out = out.convert("RGB")
    out.save(ASSETS / name)
    print(f"  {name}  {size}x{size}{' (RGB)' if rgb else ''}")


def main():
    white = (255, 255, 255, 255)
    print("生成:")

    # iOS / 共通。アルファ無しで書き出す
    icon = render("gradient", white)
    save(icon, "icon.png", rgb=True)

    # Web。小さくなるので、フルのアイコンをそのまま縮める
    save(icon, "favicon.png", size=48)

    # Android アダプティブ。前景は中央 66% に収める
    save(render(None, white, ADAPTIVE_SCALE), "android-icon-foreground.png")
    save(render("gradient", (0, 0, 0, 0)), "android-icon-background.png")
    # モノクロは端末側で塗り直されるため、形だけあればよい
    save(render(None, white, ADAPTIVE_SCALE), "android-icon-monochrome.png")

    # スプラッシュ。背景色は app.json 側で指定するので、ここは透過にする
    save(render(None, (*PRIMARY_DARK, 255)), "splash-icon.png")

    print(f"\n背景色（app.json 用）: #{'%02X%02X%02X' % BACKGROUND}")


if __name__ == "__main__":
    main()
