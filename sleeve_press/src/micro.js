/* ---------- micrographics ----------
   Small graphic devices of the kind found on record sleeves since the 1960s, each drawn here from plain
   geometry: no logos, trademarks or marks from real releases. draw(k, w, h, ink, r) paints inside a w x h box
   at the origin in one ink; r is a seeded random source. Shape says how a graphic fills its slot:
   'sq' keeps a square, 'wide' and 'tall' stretch to the box. */
const LOGO_PATH = new Path2D('__LOGO__');
const TAU2 = Math.PI * 2;
const disc = (k, x, y, rad) => { k.beginPath(); k.arc(x, y, Math.max(0, rad), 0, TAU2); k.fill(); };
const ring = (k, x, y, rad, lw) => { k.lineWidth = lw; k.beginPath(); k.arc(x, y, Math.max(0, rad), 0, TAU2); k.stroke(); };
const poly = (k, pts) => { k.beginPath(); pts.forEach(([x, y], i) => i ? k.lineTo(x, y) : k.moveTo(x, y)); k.closePath(); k.fill(); };
const star = (k, cx, cy, n, ro, ri, rot = -Math.PI / 2) => poly(k, Array.from({ length: n * 2 }, (_, i) => { const a = rot + i * Math.PI / n, rr = i % 2 ? ri : ro; return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]; }));
const cut = (k, fn) => { k.save(); k.globalCompositeOperation = 'destination-out'; fn(); k.restore(); };

const MICRO = [
  // disorientor's own mark, traced from the logo.
  ['disorientor', 'disorientor logo', 'disorientor', 'sq', (k, w) => { k.save(); k.scale(w / 1000, w / 1000); k.fill(LOGO_PATH, 'evenodd'); k.restore(); }],
  ['disorientor-ring', 'disorientor in a ring', 'disorientor', 'sq', (k, w) => { ring(k, w / 2, w / 2, w * .47, w * .03); k.save(); k.translate(w * .2, w * .2); k.scale(w * .6 / 1000, w * .6 / 1000); k.fill(LOGO_PATH, 'evenodd'); k.restore(); }],
  ['disorientor-tile', 'disorientor knockout tile', 'disorientor', 'sq', (k, w) => { k.fillRect(0, 0, w, w); cut(k, () => { k.translate(w * .14, w * .14); k.scale(w * .72 / 1000, w * .72 / 1000); k.fill(LOGO_PATH, 'evenodd'); }); }],

  // 1960s: op-art, starbursts, hi-fi badges.
  ['target', 'Op-art target', '1960s', 'sq', (k, w) => { for (let i = 8; i > 0; i--) { if (i % 2) disc(k, w / 2, w / 2, w / 2 * i / 8); else cut(k, () => disc(k, w / 2, w / 2, w / 2 * i / 8)); } }],
  ['moire', 'Moiré rings', '1960s', 'sq', (k, w) => { k.strokeStyle = k.fillStyle; for (let i = 1; i < 12; i++) { ring(k, w * .44, w / 2, w * .04 * i, w * .012); ring(k, w * .56, w / 2, w * .04 * i, w * .012); } }],
  ['burst16', 'Sixteen-point burst', '1960s', 'sq', (k, w) => star(k, w / 2, w / 2, 16, w / 2, w * .3)],
  ['burst-ring', 'Burst with ring', '1960s', 'sq', (k, w) => { star(k, w / 2, w / 2, 24, w / 2, w * .38); cut(k, () => disc(k, w / 2, w / 2, w * .32)); disc(k, w / 2, w / 2, w * .26); }],
  ['hifi-waves', 'Hi-fi waves', '1960s', 'sq', (k, w) => { k.strokeStyle = k.fillStyle; k.lineCap = 'round'; disc(k, w * .2, w / 2, w * .08); for (let i = 1; i <= 3; i++) { k.lineWidth = w * .06; k.beginPath(); k.arc(w * .2, w / 2, w * .2 * i, -.7, .7); k.stroke(); } }],
  ['polka', 'Polka grid', '1960s', 'sq', (k, w) => { for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) disc(k, (x + .5 + (y % 2) * .5) * w / 6.5, (y + .5) * w / 6, w / 22); }],
  ['op-checker', 'Bulging checkerboard', '1960s', 'sq', (k, w) => { const n = 10; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if ((x + y) % 2) { const f = v => { const t = v / n * 2 - 1; return (Math.sign(t) * Math.pow(Math.abs(t), .7) + 1) / 2 * w; }; k.fillRect(f(x), f(y), f(x + 1) - f(x), f(y + 1) - f(y)); } }],
  ['stereo-badge', 'Stereo badge', '1960s', 'wide', (k, w, h) => { k.lineWidth = h * .08; k.strokeStyle = k.fillStyle; k.beginPath(); k.roundRect(h * .05, h * .05, w - h * .1, h * .9, h * .45); k.stroke(); k.font = `${h * .5}px "sp-archivo-black",sans-serif`; k.textAlign = 'center'; k.textBaseline = 'middle'; k.fillText('STEREO', w / 2, h * .54, w * .8); }],

  // 1970s: rainbows, sunrises, chevrons.
  ['rainbow', 'Arched bands', '1970s', 'sq', (k, w) => { k.strokeStyle = k.fillStyle; for (let i = 0; i < 5; i++) { k.lineWidth = w * .06; k.beginPath(); k.arc(w / 2, w * .85, w * (.44 - i * .085), Math.PI, 0); k.stroke(); } }],
  ['sunrise', 'Sunrise rays', '1970s', 'sq', (k, w) => { k.save(); k.beginPath(); k.rect(0, 0, w, w * .7); k.clip(); for (let i = 0; i < 13; i++) { const a = Math.PI + i * Math.PI / 12; poly(k, [[w / 2, w * .7], [w / 2 + Math.cos(a - .05) * w, w * .7 + Math.sin(a - .05) * w], [w / 2 + Math.cos(a + .05) * w, w * .7 + Math.sin(a + .05) * w]]); } k.restore(); disc(k, w / 2, w * .7, w * .2); k.fillRect(0, w * .74, w, w * .03); k.fillRect(w * .15, w * .8, w * .7, w * .03); k.fillRect(w * .3, w * .86, w * .4, w * .03); }],
  ['chevrons', 'Chevron stack', '1970s', 'tall', (k, w, h) => { const n = 5, s = h / n; for (let i = 0; i < n; i++) poly(k, [[0, i * s], [w / 2, i * s + s * .5], [w, i * s], [w, i * s + s * .35], [w / 2, i * s + s * .85], [0, i * s + s * .35]]); }],
  ['racing', 'Racing stripes', '1970s', 'wide', (k, w, h) => { for (let i = 0; i < 3; i++) k.fillRect(0, h * (.1 + i * .3), w, h * (.22 - i * .05)); }],
  ['flower', 'Six-petal flower', '1970s', 'sq', (k, w) => { for (let i = 0; i < 6; i++) { const a = i * TAU2 / 6; k.beginPath(); k.ellipse(w / 2 + Math.cos(a) * w * .22, w / 2 + Math.sin(a) * w * .22, w * .2, w * .12, a, 0, TAU2); k.fill(); } cut(k, () => disc(k, w / 2, w / 2, w * .1)); }],
  ['quadrants', 'Four-channel circle', '1970s', 'sq', (k, w) => { for (let i = 0; i < 4; i++) { k.beginPath(); k.moveTo(w / 2, w / 2); k.arc(w / 2, w / 2, w * .48, i * Math.PI / 2 + .08, (i + 1) * Math.PI / 2 - .08); k.closePath(); k.fill(); } cut(k, () => disc(k, w / 2, w / 2, w * .14)); }],
  ['speedlines', 'Speed lines', '1970s', 'wide', (k, w, h, c, r) => { for (let i = 0; i < 9; i++) { const y = h * (i + .5) / 9, len = w * (.35 + r() * .65); k.fillRect(w - len, y - h * .03, len, h * .06); } }],

  // 1980s: grids, triangles, squiggles.
  ['horizon-grid', 'Horizon grid', '1980s', 'wide', (k, w, h) => { k.strokeStyle = k.fillStyle; k.lineWidth = Math.max(1, h * .015); for (let i = 0; i <= 14; i++) { k.beginPath(); k.moveTo(w / 2 + (i - 7) * w * .02, 0); k.lineTo(w / 2 + (i - 7) * w * .16, h); k.stroke(); } for (let j = 0; j < 9; j++) { const y = h * Math.pow(j / 8, 2); k.beginPath(); k.moveTo(0, y); k.lineTo(w, y); k.stroke(); } }],
  ['triangles', 'Scattered triangles', '1980s', 'sq', (k, w, h, c, r) => { for (let i = 0; i < 9; i++) { const x = r() * w * .8 + w * .1, y = r() * w * .8 + w * .1, s = w * (.06 + r() * .1), a = r() * TAU2; poly(k, [0, 1, 2].map(j => [x + Math.cos(a + j * TAU2 / 3) * s, y + Math.sin(a + j * TAU2 / 3) * s])); } }],
  ['squiggle', 'Squiggle', '1980s', 'wide', (k, w, h) => { k.strokeStyle = k.fillStyle; k.lineWidth = h * .14; k.lineCap = 'round'; k.lineJoin = 'round'; k.beginPath(); for (let x = 0; x <= 40; x++) { const t = x / 40; k.lineTo(h * .1 + t * (w - h * .2), h / 2 + Math.sin(t * Math.PI * 6) * h * .3); } k.stroke(); }],
  ['zigzag', 'Zigzag band', '1980s', 'wide', (k, w, h) => { const n = Math.max(3, Math.round(w / h * 2)); k.strokeStyle = k.fillStyle; k.lineWidth = h * .18; k.lineJoin = 'miter'; k.beginPath(); for (let i = 0; i <= n; i++) k.lineTo(i * w / n, i % 2 ? h * .15 : h * .85); k.stroke(); }],
  ['dot-ramp', 'Halftone ramp', '1980s', 'wide', (k, w, h) => { const rows = 5, s = h / rows, cols = Math.ceil(w / s); for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) disc(k, (x + .5) * s, (y + .5) * s, s * .48 * (1 - x / cols)); }],
  ['bolt', 'Lightning bolt', '1980s', 'tall', (k, w, h) => poly(k, [[w * .6, 0], [w * .1, h * .55], [w * .45, h * .55], [w * .3, h], [w * .9, h * .4], [w * .55, h * .4], [w * .8, 0]])],
  ['pixel-block', 'Pixel block', '1980s', 'sq', (k, w, h, c, r) => { const n = 8, s = w / n; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (r() > .45 || (x > 1 && x < 6 && y > 1 && y < 6)) k.fillRect(x * s, y * s, s * .9, s * .9); }],
  ['sunset-bars', 'Sliced sun', '1980s', 'sq', (k, w) => { disc(k, w / 2, w / 2, w * .46); cut(k, () => { for (let i = 0; i < 6; i++) k.fillRect(0, w * (.55 + i * .07), w, w * .012 * (i + 1)); }); }],
  ['memphis', 'Shapes & dots', '1980s', 'sq', (k, w) => { k.strokeStyle = k.fillStyle; ring(k, w * .3, w * .3, w * .18, w * .05); poly(k, [[w * .55, w * .85], [w * .95, w * .85], [w * .75, w * .5]]); for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) disc(k, w * (.08 + i * .07), w * (.7 + j * .08), w * .015); k.fillRect(w * .62, w * .12, w * .3, w * .08); k.fillRect(w * .72, w * .02, w * .08, w * .3); }],

  // 1990s: print marks, warning stripes, data strips.
  ['registration', 'Registration mark', '1990s', 'sq', (k, w) => { k.strokeStyle = k.fillStyle; ring(k, w / 2, w / 2, w * .3, w * .04); k.fillRect(w / 2 - w * .02, 0, w * .04, w); k.fillRect(0, w / 2 - w * .02, w, w * .04); k.beginPath(); k.moveTo(w / 2, w / 2); k.arc(w / 2, w / 2, w * .3, 0, Math.PI / 2); k.arc(w / 2, w / 2, w * .3, Math.PI, Math.PI * 1.5); k.fill(); }],
  ['crop-marks', 'Crop marks', '1990s', 'sq', (k, w) => { const t = w * .025, l = w * .22; for (const [x, y, sx, sy] of [[0, 0, 1, 1], [w, 0, -1, 1], [0, w, 1, -1], [w, w, -1, -1]]) { k.fillRect(x + sx * l * .3, y, sx * l, sy * t); k.fillRect(x, y + sy * l * .3, sx * t, sy * l); } }],
  ['colour-bars', 'Colour control bars', '1990s', 'wide', (k, w, h) => { const cols = ['#00a0e4', '#e4007f', '#ffe600', '#111111', '#00a0e4', '#e4007f', '#ffe600', '#111111']; const s = w / cols.length; cols.forEach((col, i) => { k.save(); k.fillStyle = col; k.fillRect(i * s, 0, s * .94, h * .6); k.globalAlpha = .5; k.fillRect(i * s, h * .64, s * .94, h * .36); k.restore(); }); }],
  ['hazard-stripes', 'Warning stripes', '1990s', 'wide', (k, w, h) => { k.save(); k.beginPath(); k.rect(0, 0, w, h); k.clip(); for (let x = -h; x < w + h; x += h * .8) poly(k, [[x, h], [x + h * .4, h], [x + h * .4 + h, 0], [x + h, 0]]); k.restore(); }],
  ['plus-grid', 'Plus grid', '1990s', 'sq', (k, w) => { const n = 5, s = w / n; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { k.fillRect((x + .5) * s - s * .25, (y + .5) * s - s * .05, s * .5, s * .1); k.fillRect((x + .5) * s - s * .05, (y + .5) * s - s * .25, s * .1, s * .5); } }],
  ['dot-arrows', 'Dot-matrix arrows', '1990s', 'wide', (k, w, h) => { const rows = 7, s = h / rows, cols = Math.floor(w / s); const pat = ['0001000', '0001100', '1111110', '1111111', '1111110', '0001100', '0001000']; for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) if (pat[y][x % 9] === '1') disc(k, (x + .5) * s, (y + .5) * s, s * .38); }],
  ['barcode', 'Barcode', '1990s', 'wide', (k, w, h, c, r) => { const bars = []; let total = 0; while (total < 95) { const b = 1 + Math.floor(r() * 3), g = 1 + Math.floor(r() * 3); bars.push(b, g); total += b + g; } const u = w / total; let x = 0; bars.forEach((b, i) => { if (i % 2 === 0) k.fillRect(x, 0, b * u, h); x += b * u; }); }],
  ['asterisk', 'Asterisk', '1990s', 'sq', (k, w) => { for (let i = 0; i < 6; i++) { k.save(); k.translate(w / 2, w / 2); k.rotate(i * Math.PI / 3); k.fillRect(-w * .06, -w * .48, w * .12, w * .96); k.restore(); } }],
  ['warning', 'Warning triangle', '1990s', 'sq', (k, w) => { k.lineJoin = 'round'; k.strokeStyle = k.fillStyle; k.lineWidth = w * .08; k.beginPath(); k.moveTo(w / 2, w * .08); k.lineTo(w * .94, w * .88); k.lineTo(w * .06, w * .88); k.closePath(); k.stroke(); k.fillRect(w * .46, w * .35, w * .08, w * .28); disc(k, w / 2, w * .73, w * .05); }],

  // 2000s: stickers, sparkles, dotted rings.
  ['halftone-disc', 'Halftone disc', '2000s', 'sq', (k, w) => { const n = 14, s = w / n; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const d = Math.hypot(x + .5 - n / 2, y + .5 - n / 2) / (n / 2); if (d < 1) disc(k, (x + .5) * s, (y + .5) * s, s * .5 * Math.sqrt(1 - d)); } }],
  ['tag', 'Hang tag', '2000s', 'wide', (k, w, h) => { poly(k, [[h * .4, 0], [w, 0], [w, h], [h * .4, h], [0, h / 2]]); cut(k, () => disc(k, h * .45, h / 2, h * .12)); }],
  ['sparkles', 'Sparkles', '2000s', 'sq', (k, w, h, c, r) => { star(k, w * .38, w * .42, 4, w * .34, w * .06, 0); star(k, w * .78, w * .2, 4, w * .14, w * .03, 0); star(k, w * .74, w * .78, 4, w * .18, w * .035, 0); }],
  ['sticker-new', 'Round sticker', '2000s', 'sq', (k, w) => { star(k, w / 2, w / 2, 20, w / 2, w * .44); cut(k, () => { k.font = `${w * .26}px "sp-archivo-black",sans-serif`; k.textAlign = 'center'; k.textBaseline = 'middle'; k.fillText('NEW', w / 2, w * .53, w * .7); }); }],
  ['dotted-ring', 'Dotted ring', '2000s', 'sq', (k, w) => { for (let j = 0; j < 3; j++) { const rad = w * (.46 - j * .11), n = Math.round(36 - j * 9); for (let i = 0; i < n; i++) disc(k, w / 2 + Math.cos(i * TAU2 / n) * rad, w / 2 + Math.sin(i * TAU2 / n) * rad, w * (.022 - j * .004)); } }],
  ['pixel-arrow', 'Pixel arrow', '2000s', 'sq', (k, w) => { const pat = ['00010000', '00011000', '11111100', '11111110', '11111100', '00011000', '00010000', '00000000'], s = w / 8; pat.forEach((row, y) => [...row].forEach((v, x) => v === '1' && k.fillRect(x * s, (y + .5) * s, s * .92, s * .92))); }],
  ['scribble-circle', 'Hand-drawn circle', '2000s', 'sq', (k, w, h, c, r) => { k.strokeStyle = k.fillStyle; k.lineWidth = w * .035; k.lineCap = 'round'; k.beginPath(); for (let i = 0; i <= 80; i++) { const a = i / 80 * TAU2 * 1.15 - .4, rad = w * (.42 + Math.sin(i * .7) * .02 + (r() - .5) * .015); k.lineTo(w / 2 + Math.cos(a) * rad, w / 2 + Math.sin(a) * rad * .92); } k.stroke(); }],

  // 2010s: wireframes, phases, glitch blocks.
  ['wire-sphere', 'Wireframe sphere', '2010s', 'sq', (k, w) => { k.strokeStyle = k.fillStyle; k.lineWidth = w * .012; ring(k, w / 2, w / 2, w * .46, w * .02); for (let i = 1; i < 6; i++) { k.beginPath(); k.ellipse(w / 2, w / 2, w * .46 * Math.sin(i * Math.PI / 6), w * .46, 0, 0, TAU2); k.stroke(); k.beginPath(); k.ellipse(w / 2, w / 2 + w * .46 * Math.cos(i * Math.PI / 6), w * .46 * Math.sin(i * Math.PI / 6), w * .04, 0, 0, TAU2); k.stroke(); } }],
  ['wire-cube', 'Wireframe cube', '2010s', 'sq', (k, w) => { k.strokeStyle = k.fillStyle; k.lineWidth = w * .025; k.lineJoin = 'round'; const a = [[.2, .3], [.62, .3], [.62, .72], [.2, .72]], b = a.map(([x, y]) => [x + .18, y - .18]); for (const q of [a, b]) { k.beginPath(); q.forEach(([x, y], i) => i ? k.lineTo(x * w, y * w) : k.moveTo(x * w, y * w)); k.closePath(); k.stroke(); } a.forEach(([x, y], i) => { k.beginPath(); k.moveTo(x * w, y * w); k.lineTo(b[i][0] * w, b[i][1] * w); k.stroke(); }); }],
  ['moon-phases', 'Moon phases', '2010s', 'wide', (k, w, h) => { const n = 5, s = Math.min(h, w / n); for (let i = 0; i < n; i++) { const cx = (i + .5) * w / n, cy = h / 2, rad = s * .42; k.save(); k.strokeStyle = k.fillStyle; ring(k, cx, cy, rad, s * .04); k.beginPath(); k.arc(cx, cy, rad, -Math.PI / 2, Math.PI / 2); k.ellipse(cx, cy, Math.abs(rad * Math.cos(i / (n - 1) * Math.PI)), rad, 0, Math.PI / 2, -Math.PI / 2, i / (n - 1) < .5); k.fill(); k.restore(); } }],
  ['tri-circle', 'Triangle in circle', '2010s', 'sq', (k, w) => { k.strokeStyle = k.fillStyle; ring(k, w / 2, w / 2, w * .46, w * .04); k.lineWidth = w * .04; k.lineJoin = 'miter'; k.beginPath(); for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + i * TAU2 / 3; k.lineTo(w / 2 + Math.cos(a) * w * .46, w / 2 + Math.sin(a) * w * .46); } k.closePath(); k.stroke(); }],
  ['punch-holes', 'Punch holes', '2010s', 'tall', (k, w, h) => { const n = Math.max(3, Math.round(h / w * 1.4)); for (let i = 0; i < n; i++) { const cy = (i + .5) * h / n; k.fillRect(0, cy - w * .4, w, w * .8); cut(k, () => disc(k, w / 2, cy, w * .22)); } }],
  ['glitch-blocks', 'Glitch blocks', '2010s', 'wide', (k, w, h, c, r) => { for (let i = 0; i < 14; i++) { const bh = h * (.05 + r() * .2), y = r() * (h - bh); k.fillRect(r() * w * .5, y, w * (.1 + r() * .5), bh); } }],
  ['sparkle-big', 'Four-point sparkle', '2010s', 'sq', (k, w) => { k.beginPath(); k.moveTo(w / 2, 0); k.quadraticCurveTo(w / 2, w / 2, w, w / 2); k.quadraticCurveTo(w / 2, w / 2, w / 2, w); k.quadraticCurveTo(w / 2, w / 2, 0, w / 2); k.quadraticCurveTo(w / 2, w / 2, w / 2, 0); k.fill(); }],
  ['ruler', 'Ruler ticks', '2010s', 'wide', (k, w, h) => { const n = 40; for (let i = 0; i <= n; i++) { const t = i % 10 === 0 ? 1 : i % 5 === 0 ? .65 : .38; k.fillRect(i * (w - h * .04) / n, 0, Math.max(1, h * .04), h * t); } }],
  ['dither-square', 'Dither square', '2010s', 'sq', (k, w) => { const n = 16, s = w / n, B = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if ((1 - x / n) * 16 > B[(y % 4) * 4 + (x % 4)]) k.fillRect(x * s, y * s, s, s); }],
  ['coordinates', 'Coordinates readout', '2010s', 'wide', (k, w, h, c, r) => { k.font = `${h * .32}px "sp-space-mono",monospace`; k.textBaseline = 'top'; const n = () => (r() * 180 - 90).toFixed(4); k.fillText(`${n()}° N`, 0, h * .05, w); k.fillText(`${n()}° E`, 0, h * .55, w); }]
];
const MICRO_BY = Object.fromEntries(MICRO.map(([id, name, era, shape, draw]) => [id, { id, name, era, shape, draw }]));
const MICRO_ERAS = ['disorientor', '1960s', '1970s', '1980s', '1990s', '2000s', '2010s'];
// Paints graphic `id` into the box on its own canvas (so knock-outs never cut the type beneath), keeping square
// graphics square and centred, and turning strip graphics a quarter turn when the box runs the other way.
function drawMicro(k, id, x, y, w, h, ink, seed) {
  const g = MICRO_BY[id];
  if (!g || w < 1 || h < 1) return;
  const turn = (g.shape === 'wide' && h > w * 1.4) || (g.shape === 'tall' && w > h * 1.4);
  const bw = Math.ceil(turn ? h : w), bh = Math.ceil(turn ? w : h);
  const c = document.createElement('canvas'); c.width = bw; c.height = bh;
  const o = c.getContext('2d');
  o.fillStyle = ink; o.strokeStyle = ink;
  if (g.shape === 'sq') { const s = Math.min(bw, bh); o.translate((bw - s) / 2, (bh - s) / 2); g.draw(o, s, s, ink, rng(seed)); }
  else g.draw(o, bw, bh, ink, rng(seed));
  k.save();
  if (turn) { k.translate(x + w, y); k.rotate(Math.PI / 2); }
  else k.translate(x, y);
  k.drawImage(c, 0, 0);
  k.restore();
}
