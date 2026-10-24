# Plain zeros for GurtOS (UX P-29). Atkinson Hyperlegible Next and Mono draw 0 with a slash, and have no plain one.
# These files hold only a 0 whose opening is the font's own O counter, so money and clocks read 100.00, not 1Ø0.ØØ.
# kit.css loads them first with unicode-range U+0030; every other character still comes from Atkinson.
# Derived from Atkinson Hyperlegible Next and Mono under the SIL Open Font License 1.1 (OFL.txt), renamed as the
# license asks of a modified version.
#   python3 -m venv /tmp/ft && /tmp/ft/bin/pip install fonttools brotli
#   /tmp/ft/bin/python -I portal/src/kit/fonts/plain-zero.py portal/node_modules/@fontsource portal/src/kit/fonts
import sys

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.ttLib.tables import ttProgram
from fontTools.ttLib.tables._g_l_y_f import GlyphCoordinates

src, out = sys.argv[1:3]
FACES = [('atkinson-hyperlegible-next', w, 'GurtOS Digits', f'digits-{w}') for w in (400, 500, 600, 700)]
FACES.append(('atkinson-hyperlegible-mono', 400, 'GurtOS Mono Digits', 'mono-digits-400'))


def contours(glyf, g):
    coords, ends, flags = g.getCoordinates(glyf)
    out, start = [], 0
    for end in ends:
        out.append((list(coords[start : end + 1]), list(flags[start : end + 1])))
        start = end + 1
    return out


def box(pts):
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    return min(xs), min(ys), max(xs), max(ys)


def area(c):
    x0, y0, x1, y1 = box(c[0])
    return (x1 - x0) * (y1 - y0)


for pkg, weight, family, name in FACES:
    font = TTFont(f'{src}/{pkg}/files/{pkg}-latin-{weight}-normal.woff2')
    glyf = font['glyf']
    zero = glyf['zero']
    outer, *halves = sorted(contours(glyf, zero), key=area, reverse=True)
    assert len(halves) == 2, f'{name}: expected a zero split by its slash into two openings'
    # The two halves together span the zero's opening; the O's opening, fitted to that box, replaces them.
    tx0, ty0, tx1, ty1 = box([p for h in halves for p in h[0]])
    counter = min(contours(glyf, glyf['O']), key=area)
    ox0, oy0, ox1, oy1 = box(counter[0])
    fit = [(round(tx0 + (x - ox0) * (tx1 - tx0) / (ox1 - ox0)), round(ty0 + (y - oy0) * (ty1 - ty0) / (oy1 - oy0))) for x, y in counter[0]]
    zero.coordinates = GlyphCoordinates(outer[0] + fit)
    zero.flags = bytearray(outer[1] + counter[1])
    zero.endPtsOfContours = [len(outer[0]) - 1, len(outer[0]) + len(fit) - 1]
    zero.numberOfContours = 2
    zero.program = ttProgram.Program()
    zero.program.fromBytecode(b'')  # the old hints point at the old outline
    zero.recalcBounds(glyf)

    opts = subset.Options()
    opts.layout_features = ['tnum', 'pnum']  # tabular figures (zero.tf) keep working
    opts.flavor = 'woff2'
    opts.hinting = False
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=[0x30])
    sub.subset(font)
    for rec in font['name'].names:
        if rec.nameID in (1, 4, 16):
            rec.string = family
        elif rec.nameID == 6:
            rec.string = family.replace(' ', '') + f'-{weight}'
    font.flavor = 'woff2'
    font.save(f'{out}/{name}.woff2')
    print(name, 'zero:', box(outer[0]), 'opening:', (tx0, ty0, tx1, ty1))
