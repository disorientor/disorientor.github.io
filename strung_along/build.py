import base64, pathlib
root = pathlib.Path(__file__).parent
font = base64.b64encode((root/'fonts/DepartureMono-Regular.otf').read_bytes()).decode()
src = (root/'src/chordgrid.src.html').read_text().replace('__FONT__', font)
head = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>'
(root/'chord-grid.html').write_text(head + src + '</body></html>')
