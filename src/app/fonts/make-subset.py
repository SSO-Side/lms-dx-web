import sys
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset

src, mid, out = sys.argv[1], sys.argv[2], sys.argv[3]

f = TTFont(src)
print("axes", [(a.axisTag, a.minValue, a.defaultValue, a.maxValue) for a in f["fvar"].axes])
# 쓰는 굵기 400~700만 남긴다(디자인 규칙상 400/500/600, 700 이상은 쓰지 않음)
f = instancer.instantiateVariableFont(f, {"wght": (400, 700)})
f.save(mid)

# KS X 1001 한글 2350자(EUC-KR 가~힝) — 자주 쓰는 음절
hangul = []
for hi in range(0xB0, 0xC9):
    for lo in range(0xA1, 0xFF):
        try:
            hangul.append(ord(bytes([hi, lo]).decode("euc-kr")))
        except UnicodeDecodeError:
            pass
print("hangul syllables", len(hangul))

ranges = [
    (0x0020, 0x007E),  # 기본 라틴·숫자·기호
    (0x00A0, 0x00FF),  # 라틴-1 (× ÷ · 등)
    (0x2000, 0x206F),  # 일반 문장부호 (… — ' " 등)
    (0x2190, 0x21FF),  # 화살표
    (0x2460, 0x24FF),  # 원 숫자
    (0x25A0, 0x25FF),  # 도형 (● ○ ■ 등)
    (0x2600, 0x27BF),  # 기호 (✓ ★ 등)
    (0x3000, 0x303F),  # CJK 기호 (、。「」 등)
    (0x3131, 0x318E),  # 호환 자모 (ㄱ~ㅣ)
    (0xFF01, 0xFF5E),  # 전각 문자
]
unicodes = set(hangul)
for a, b in ranges:
    unicodes.update(range(a, b + 1))

opts = subset.Options()
opts.flavor = "woff2"
opts.layout_features = ["*"]       # kern·tnum(tabular-nums) 등 기능 유지
opts.glyph_names = False
opts.notdef_outline = True
opts.name_IDs = [1, 2, 3, 4, 6]
opts.hinting = False
font = subset.load_font(mid, opts)
sub = subset.Subsetter(opts)
sub.populate(unicodes=sorted(unicodes))
sub.subset(font)
subset.save_font(font, out, opts)
print("done")
