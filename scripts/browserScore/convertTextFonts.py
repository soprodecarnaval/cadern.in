"""Convert Verovio's Liberation text fonts (WOFF2) to TTF for the songbook PDF (ticket 014).

PDFKit embeds WOFF2 fonts with broken glyphs (the text is extractable but not
drawn), so the PDF uses TTF copies. Run after `npm run browser-score:assets`
whenever Verovio changes its fonts (the asset build then fails, naming them):

    python3 scripts/browserScore/convertTextFonts.py

Needs fontTools and brotli (pip install fonttools brotli). Writes
src/lib/browserScore/fonts/<name>.ttf and fonts.json, which maps each WOFF2
digest to its TTF.
"""
import hashlib, json, pathlib
from fontTools.ttLib import TTFont

root = pathlib.Path(__file__).resolve().parents[2]
manifest = json.loads((root / "public/browser-score/manifest.json").read_text())
out = root / "src/lib/browserScore/fonts"
out.mkdir(parents=True, exist_ok=True)
mapping = {}
for font in manifest["textFonts"]:
    woff2 = root / "public/browser-score" / font["path"]
    name = f'{font["family"].lower()}-{font["weight"]}-{font["style"]}.ttf'
    ttf = TTFont(str(woff2))
    ttf.flavor = None
    ttf.save(str(out / name))
    mapping[font["sha256"]] = name
    print(name, hashlib.sha256((out / name).read_bytes()).hexdigest()[:12])
(out / "fonts.json").write_text(json.dumps(mapping, indent=2) + "\n")
