// Compiles and renders every ported Haecceity shader in headless Chrome on a test picture.
// node sleeve_press/test/shaders.cjs  — exits non-zero if any shader fails to compile or draws nothing.
const http = require('http'), fs = require('fs'), path = require('path'), { spawn, execFileSync } = require('child_process');
const root = path.resolve(__dirname, '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const shaders = execFileSync('python3', [path.join(root, 'shaders.py'), '--json'], { maxBuffer: 64 << 20 }).toString();
const page = `<!doctype html><canvas id=c width=256 height=256></canvas><script>${fs.readFileSync(path.join(root, 'src/engine.js'), 'utf8')}
const SHADERS = ${shaders};
window.runAll = () => {
  const eng = new SpEngine(document.getElementById('c')), gl = eng.gl, N = 256;
  const px = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const i = (y * N + x) * 4; const d = Math.hypot(x - 128, y - 100) < 60;
    px[i] = d ? 230 : x; px[i + 1] = d ? 80 : y; px[i + 2] = ((x >> 4) + (y >> 4)) % 2 ? 200 : 40; px[i + 3] = 255; }
  const src = eng.texture(N, N, px), a = eng.target(N, N, true), b = eng.target(N, N, true);
  const out = [], read = new Uint8Array(N * N * 4), rgba8 = eng.target(N, N, false);
  for (const s of SHADERS) {
    const t0 = performance.now();
    let ok = true;
    for (let f = 0; f < 3 && ok; f++) ok = eng.run(s, f % 2 ? b : a, { src, prev: f ? (f % 2 ? a : b).tex : src, time: 1.3 + f / 30, frame: f, clear: true });
    if (ok) { eng.blit(b.tex, rgba8); gl.readPixels(0, 0, N, N, gl.RGBA, gl.UNSIGNED_BYTE, read); }
    gl.finish();
    let sum = 0, diff = 0, lit = 0;
    if (ok) for (let i = 0; i < read.length; i += 4) { const v = read[i] + read[i + 1] + read[i + 2]; sum += v; lit += (v > 6 && read[i + 3] > 6) ? 1 : 0; diff += Math.abs(read[i] - px[i]) + Math.abs(read[i + 1] - px[i + 1]) + Math.abs(read[i + 2] - px[i + 2]); }
    out.push({ id: s.id, group: s.group, ok, err: eng.errors[s.id] || '', lit: lit / (N * N), diff: diff / (N * N * 3), ms: Math.round(performance.now() - t0) });
  }
  return out;
};
</script>`;
(async () => {
  const server = http.createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(page); });
  await new Promise(r => server.listen(8131, '127.0.0.1', r));
  const profile = fs.mkdtempSync(path.join(require('os').tmpdir(), 'sleeve-'));
  const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--remote-debugging-port=9231', '--user-data-dir=' + profile, '--no-first-run', '--use-angle=metal', 'about:blank'], { stdio: 'ignore' });
  let code = 1;
  try {
    let targets; for (let i = 0; i < 40 && !targets; i++) { await sleep(250); try { targets = await (await fetch('http://127.0.0.1:9231/json')).json(); } catch {} }
    const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
    await new Promise(r => ws.onopen = r);
    let id = 0; const pending = new Map();
    ws.onmessage = e => { const m = JSON.parse(e.data); if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
    const send = (method, params) => new Promise(r => { pending.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
    await send('Page.navigate', { url: 'http://127.0.0.1:8131/' }); await sleep(1500);
    const r = await send('Runtime.evaluate', { expression: 'JSON.stringify(runAll())', returnByValue: true, timeout: 600000 });
    if (!r.result || r.result.exceptionDetails) throw new Error(JSON.stringify(r.result && r.result.exceptionDetails || r));
    const rows = JSON.parse(r.result.result.value);
    const bad = rows.filter(x => !x.ok), blank = rows.filter(x => x.ok && x.lit < 0.001);
    for (const x of rows) console.log(`${x.ok ? (x.lit < 0.001 ? 'BLANK' : 'ok   ') : 'FAIL '} ${x.group.padEnd(13)} ${x.id.padEnd(40)} lit ${(x.lit * 100).toFixed(0).padStart(3)}%  diff ${x.diff.toFixed(1).padStart(5)}  ${x.ms}ms`);
    for (const x of bad) console.log(`\n${x.id}\n${x.err.slice(0, 600)}`);
    console.log(`\n${rows.length} shaders, ${rows.length - bad.length} compiled, ${bad.length} failed, ${blank.length} blank`);
    if (process.argv.includes('--report')) fs.writeFileSync(path.join(__dirname, 'shader-report.json'), JSON.stringify(rows, null, 1));
    code = bad.length ? 1 : 0;
  } finally { chrome.kill(); server.close(); process.exitCode = code; }
})();
