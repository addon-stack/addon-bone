"""Regenerate the original synthetic test font with fonttools[woff] (not needed to run tests)."""

from pathlib import Path

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

font = FontBuilder(1000, isTTF=True)
font.setupGlyphOrder([".notdef", "A"])
font.setupCharacterMap({65: "A"})

pen = TTGlyphPen(None)
pen.moveTo((0, 0))
pen.lineTo((1000, 0))
pen.lineTo((1000, 800))
pen.lineTo((0, 800))
pen.closePath()
glyph = pen.glyph()
font.setupGlyf({".notdef": glyph, "A": glyph})
# Each A is 2em wide: AAAA at 40px must measure 320px, independently of installed fonts.
font.setupHorizontalMetrics({".notdef": (2000, 0), "A": (2000, 0)})
font.setupHorizontalHeader(ascent=800, descent=-200)
font.setupNameTable({
    "familyName": "Adnbn Shadow Probe",
    "styleName": "Regular",
    "uniqueFontIdentifier": "AdnbnShadowProbe-Regular",
    "fullName": "Adnbn Shadow Probe Regular",
    "psName": "AdnbnShadowProbe-Regular",
    "version": "Version 1.0",
})
font.setupOS2(sTypoAscender=800, sTypoDescender=-200, usWinAscent=800, usWinDescent=200)
font.setupPost()
font.setupMaxp()
font.font["head"].created = font.font["head"].modified = 3800000000
font.font.recalcTimestamp = False
font.font.flavor = "woff2"
font.save(Path(__file__).parent / "src" / "probe.content" / "probe.woff2")
