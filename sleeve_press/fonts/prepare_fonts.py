"""Turns the downloaded google/fonts TTFs into the woff2 cache sleeve+press serves (see SOURCES.md).
Variable fonts are pinned to one heavy weight; Japanese fonts are subset to ASCII, kana, CJK punctuation,
full-width forms and the JIS level-1 kanji (2,965 everyday characters) so each is a few hundred KB.
Needs fontTools and brotli:  python3 prepare_fonts.py DOWNLOAD_DIR
"""
import pathlib, sys
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools import subset

FONTS = {  # output name: (file, weight for variable fonts, Japanese)
    'anton': ('Anton-Regular.ttf', None, False), 'bebas-neue': ('BebasNeue-Regular.ttf', None, False),
    'archivo-black': ('ArchivoBlack-Regular.ttf', None, False), 'rubik-mono-one': ('RubikMonoOne-Regular.ttf', None, False),
    'rubik-glitch': ('RubikGlitch-Regular.ttf', None, False), 'monoton': ('Monoton-Regular.ttf', None, False),
    'bungee': ('Bungee-Regular.ttf', None, False), 'six-caps': ('SixCaps.ttf', None, False),
    'big-shoulders-display': ('BigShouldersDisplay[wght].ttf', 900, False), 'unbounded': ('Unbounded[wght].ttf', 900, False),
    'syne': ('Syne[wght].ttf', 800, False), 'major-mono-display': ('MajorMonoDisplay-Regular.ttf', None, False),
    'playfair-display': ('PlayfairDisplay[wght].ttf', 900, False), 'libre-caslon-display': ('LibreCaslonDisplay-Regular.ttf', None, False),
    'unifraktur-maguntia': ('UnifrakturMaguntia-Book.ttf', None, False), 'pirata-one': ('PirataOne-Regular.ttf', None, False),
    'space-mono': ('SpaceMono-Bold.ttf', None, False), 'vt323': ('VT323-Regular.ttf', None, False),
    'ibm-plex-mono': ('IBMPlexMono-Medium.ttf', None, False),
    'dela-gothic-one': ('DelaGothicOne-Regular.ttf', None, True), 'reggae-one': ('ReggaeOne-Regular.ttf', None, True),
    'rocknroll-one': ('RocknRollOne-Regular.ttf', None, True), 'rampart-one': ('RampartOne-Regular.ttf', None, True),
    'dotgothic16': ('DotGothic16-Regular.ttf', None, True), 'zen-antique': ('ZenAntique-Regular.ttf', None, True),
    'shippori-mincho-b1': ('ShipporiMinchoB1-ExtraBold.ttf', None, True), 'noto-sans-jp': ('NotoSansJP[wght].ttf', 900, True),
}

def jis_level1():
    out = []
    for hi in range(0x88, 0x99):
        for lo in list(range(0x40, 0x7f)) + list(range(0x80, 0xfd)):
            try: out.append(bytes([hi, lo]).decode('shift_jis'))
            except UnicodeDecodeError: pass
    return ''.join(c for c in out if '一' <= c <= '鿿')

LATIN = list(range(0x20, 0x7f)) + list(range(0xa0, 0x180)) + list(range(0x2000, 0x2070)) + [0x20ac, 0x2122, 0x2190, 0x2191, 0x2192, 0x2193, 0x25a0, 0x25cf]
JAPANESE = list(range(0x3000, 0x3100)) + list(range(0x31f0, 0x3200)) + list(range(0xff00, 0xfff0)) + [ord(c) for c in jis_level1()] + [0x3005, 0x30fc]

if __name__ == '__main__':
    src, out = pathlib.Path(sys.argv[1]), pathlib.Path(__file__).parent
    for name, (file, weight, jp) in FONTS.items():
        font = TTFont(src / file)
        if weight: font = instantiateVariableFont(font, {'wght': weight})
        opts = subset.Options(); opts.flavor = 'woff2'; opts.layout_features = ['*']; opts.name_IDs = ['*']; opts.notdef_outline = True
        sub = subset.Subsetter(opts); sub.populate(unicodes=LATIN + (JAPANESE if jp else []))
        sub.subset(font)
        font.flavor = 'woff2'; font.save(out / f'{name}.woff2')
        print(f'{name:24} {(out / f"{name}.woff2").stat().st_size // 1024:6} KB')
