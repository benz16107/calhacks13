"""Make Atkinson Hyperlegible Next's 0 plain: replace the two half-counters (the slash between them) with one oval
counter, at the default and at every weight master. The tabular zero (zero.tf) is a reference to zero, so it follows.
  plain_zero.py in.ttf out.ttf"""
import math
import sys

from fontTools.ttLib import TTFont
from fontTools.ttLib.tables import ttProgram

src, out = sys.argv[1], sys.argv[2]
f = TTFont(src)
glyf, gvar = f['glyf'], f['gvar']
g = glyf['zero']
coords, ctrl = glyf._getCoordinatesAndControls('zero', f['hmtx'].metrics, f['vmtx'].metrics if 'vmtx' in f else None)
ends = ctrl.endPts
n = ends[-1] + 1
ranges, s = [], 0
for e in ends:
    ranges.append((s, e))
    s = e + 1
assert len(ranges) == 3, 'expected the outer oval and two half-counters'
(o0, o1), (a0, a1), (b0, b1) = ranges


def area(pts):
    return sum(pts[i][0] * pts[i - 1][1] - pts[i - 1][0] * pts[i][1] for i in range(len(pts)))


counter_dir = 1 if area(list(coords[a0:a1 + 1])) > 0 else -1
K = 8
SPREAD = 1 / math.cos(math.pi / K)  # off-curve points on a larger octagon put the implied on-curves on the ellipse


def oval(pts):
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    cx, cy, rx, ry = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, (max(xs) - min(xs)) / 2, (max(ys) - min(ys)) / 2
    ring = [(cx + rx * SPREAD * math.cos(math.pi / K + 2 * math.pi * k / K), cy + ry * SPREAD * math.sin(math.pi / K + 2 * math.pi * k / K)) for k in range(K)]
    ring = ring if (area(ring) > 0) == (counter_dir > 0) else ring[::-1]
    return ring


base = [tuple(c) for c in coords]
counter = base[a0:a1 + 1] + base[b0:b1 + 1]
new_default = oval(counter)
outer = base[o0:o1 + 1]

variations = gvar.variations.get('zero', [])
new_vars = []
for tv in variations:
    tv.calcInferredDeltas(coords, ends)
    d = [tuple(x) if x is not None else (0, 0) for x in tv.coordinates]
    moved = [(base[i][0] + d[i][0], base[i][1] + d[i][1]) for i in range(n)]
    peak_oval = oval(moved[a0:a1 + 1] + moved[b0:b1 + 1])
    oval_d = [(round(p[0] - q[0]), round(p[1] - q[1])) for p, q in zip(peak_oval, new_default)]
    tv.coordinates = d[o0:o1 + 1] + oval_d + d[n:]  # the outer oval's deltas, the new counter's, then the 4 phantom points
    new_vars.append(tv)

g.coordinates.__init__([(round(x), round(y)) for x, y in outer + new_default])
g.flags = bytearray(list(g.flags[o0:o1 + 1]) + [0] * K)  # 0: off-curve
g.endPtsOfContours = [o1, o1 + K]
g.numberOfContours = 2
g.program = ttProgram.Program()
g.program.fromBytecode(b'')  # its hints pointed at the old points
g.recalcBounds(glyf)
gvar.variations['zero'] = new_vars
name = f['name']
for rec in name.names:
    if rec.nameID == 5:
        rec.string = rec.toUnicode() + '; GurtOS: plain zero'
f.save(out)
print('ok', out)
