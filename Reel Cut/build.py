import base64, pathlib
root = pathlib.Path(__file__).parent
font = base64.b64encode((root/'fonts/DepartureMono-Regular.otf').read_bytes()).decode()
# Mediabunny (WebCodecs demux/decode/encode/mux) powers faster-than-real-time export.
mediabunny = (root/'vendor/mediabunny-1.61.4.min.js').read_text()
assert '</script' not in mediabunny
src = (root/'src/editor.src.html').read_text().replace('__FONT__', font).replace('__MEDIABUNNY__', mediabunny)
gate = '<style id="tools-access-lock">html{visibility:hidden!important}</style><script src="../tools-access/config.js"></script><script src="../tools-access/access.js"></script>'
(root/'reel-cut.html').write_text(gate + src)
head = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' + gate + '</head><body>'
(root/'reel-cut-offline.html').write_text(head + src + '</body></html>')

# GitHub Pages serves the editor from /reelcut/.
site = root.parent / 'reelcut'
site.mkdir(exist_ok=True)
(site/'index.html').write_text(head + src + '</body></html>')
