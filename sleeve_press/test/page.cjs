// Loads the built sleeve+press page in headless Chrome, runs scripted steps and saves screenshots.
// node sleeve_press/test/page.cjs OUT_DIR [--phone]   — exits non-zero on page errors or failed checks.
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os'), { spawn } = require('child_process'), assert = require('assert/strict');
const site = path.resolve(__dirname, '../..');
const outDir = path.resolve(process.argv[2] || os.tmpdir()), phone = process.argv.includes('--phone');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2', '.otf': 'font/otf', '.png': 'image/png', '.jpg': 'image/jpeg' };
(async () => {
  const server = http.createServer((req, res) => {
    let n = decodeURIComponent(req.url.split('?')[0]); if (n.endsWith('/')) n += 'index.html';
    const f = path.join(site, n);
    if (!f.startsWith(site) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
  });
  await new Promise(r => server.listen(8132, '127.0.0.1', r));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'sleeve-page-'));
  const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--remote-debugging-port=9232', '--user-data-dir=' + profile, '--no-first-run', '--use-angle=metal', `--window-size=${phone ? '390,844' : '1440,900'}`, 'about:blank'], { stdio: 'ignore' });
  let code = 1;
  const errors = [];
  try {
    let targets; for (let i = 0; i < 40 && !targets; i++) { await sleep(250); try { targets = await (await fetch('http://127.0.0.1:9232/json')).json(); } catch {} }
    const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
    await new Promise(r => ws.onopen = r);
    let id = 0; const pending = new Map();
    ws.onmessage = e => { const m = JSON.parse(e.data);
      if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map(a => a.value || a.description).join(' '));
      if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
    const send = (method, params) => new Promise(r => { pending.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
    const evaluate = async expr => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'eval failed'); return r.result.result.value; };
    const shot = async name => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(outDir, name + '.png'), Buffer.from(r.result.data, 'base64')); };
    await send('Runtime.enable'); await send('Page.enable');
    if (phone) await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    else await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false });
    // The tools sit behind tools-access/; mark this tab unlocked the way a correct password does.
    await send('Page.navigate', { url: 'http://127.0.0.1:8132/tools-access/' }); await sleep(1200);
    await evaluate(`sessionStorage.setItem('disorientor-tools:' + TOOLS_ACCESS_CONFIG.verifier, 'unlocked')`);
    await send('Page.navigate', { url: 'http://127.0.0.1:8132/sleeve-press/' }); await sleep(2500);
    await evaluate('localStorage.clear(); location.reload()').catch(() => {}); await sleep(3000);
    await evaluate('document.fonts.ready.then(() => new Promise(r => setTimeout(r, 800)))');
    await shot(phone ? 'phone' : 'default');
    const ev = process.argv.indexOf('--eval');
    if (ev > 0) {
      const steps = process.argv[ev + 1].split(';;');
      for (const [i, js] of steps.entries()) {
        const res = await evaluate(`(async () => { ${js}; await fontsReady(); const c = await renderPixels(...dims(700)); return c.toDataURL('image/png'); })()`);
        fs.writeFileSync(path.join(outDir, `eval-${i}.png`), Buffer.from(res.split(',')[1], 'base64'));
      }
      console.log(errors.join('\n') || 'eval ok'); code = errors.length ? 1 : 0; return;
    }
    const js = process.argv.indexOf('--json');
    if (js > 0) { console.log(await evaluate(`(async () => JSON.stringify(await (async () => { ${process.argv[js + 1]} })()))()`)); code = 0; return; }
    if (process.argv.includes('--realms')) {
      const r = await evaluate(`JSON.stringify(SHADERS.filter(s => s.group === 'backgrounds').map(s => { const t = tgt('probe', 128, 128, false); eng.run(s, t, { time: 4.2, clear: true, res: [128, 128] }); const px = new Uint8Array(128*128*4); gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb); gl.readPixels(0,0,128,128,gl.RGBA,gl.UNSIGNED_BYTE,px); let m=0,a=0; for (let i=0;i<px.length;i+=4){m+=px[i]+px[i+1]+px[i+2];a+=px[i+3];} return s.id+' '+(m/px.length*4/3).toFixed(0)+' a'+(a/px.length*4).toFixed(0); }))`);
      console.log(JSON.parse(r).join('\n')); return;
    }
    // Katakana from Latin text.
    const kana = await evaluate('JSON.stringify(["Disorientor","Ex Cathedra","The Glass Room","Fluorescent","Stories"].map(toKatakana))');
    console.log('katakana', kana);
    assert.equal(JSON.parse(kana)[0], 'ディスオリエンター');
    if (!phone) {
      for (const tpl of Object.keys(await evaluate('Object.fromEntries(Object.keys(TEMPLATES).map(k=>[k,1]))'))) {
        await evaluate(`state.template = ${JSON.stringify(tpl)}; renderPanel(); scheduleRender(); new Promise(r => setTimeout(r, 900))`);
        await shot('template-' + tpl);
        const png = await evaluate(`renderPixels(...dims(900)).then(c => c.toDataURL('image/png'))`);
        fs.writeFileSync(path.join(outDir, 'cover-' + tpl + '.png'), Buffer.from(png.split(',')[1], 'base64'));
      }
      await evaluate(`state.template = 'headline'; activeTab = 'shaders'; renderTabs(); renderPanel();
        addLayer('field_reaction'); addLayer('t03_gray_scott_reaction_diffusion'); new Promise(r => setTimeout(r, 2500))`);
      await shot('shaders-tab');
      await evaluate(`state.template = 'strip'; activeTab = 'graphics'; activeSlot = 'feature'; renderTabs(); renderPanel(); scheduleRender(); new Promise(r => setTimeout(r, 1200))`);
      await shot('graphics-tab');
      // Drag the artist wordmark 120 px right and 60 px down in Move mode, then wheel it larger.
      await evaluate(`state.template = 'headline'; setMode('move'); activeTab = 'arrange'; renderTabs(); renderPanel(); scheduleRender(); new Promise(r => setTimeout(r, 800))`);
      const pt = JSON.parse(await evaluate(`(() => { const h = lastHits.hits.find(h => h.id === 'artist'), r = cv.getBoundingClientRect(); return JSON.stringify([r.left + h.cx / lastHits.W * r.width, r.top + h.cy / lastHits.H * r.height]); })()`));
      const mouse = (type, x, y, extra = {}) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, ...extra });
      await mouse('mousePressed', pt[0], pt[1]);
      for (let i = 1; i <= 6; i++) await mouse('mouseMoved', pt[0] + i * 20, pt[1] + i * 10);
      await mouse('mouseReleased', pt[0] + 120, pt[1] + 60);
      await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: pt[0] + 120, y: pt[1] + 60, deltaX: 0, deltaY: -200 });
      await sleep(900);
      const moved = JSON.parse(await evaluate(`JSON.stringify(state.layout.headline.artist)`));
      console.log('drag', JSON.stringify(moved));
      assert(moved.x > .05 && moved.y > .02 && moved.s > 1.1, 'drag/scale did not move the wordmark');
      // The outline overlay must sit exactly over the cover at any pixel density.
      const ovr = JSON.parse(await evaluate(`JSON.stringify([cv.getBoundingClientRect(), ov.getBoundingClientRect(), devicePixelRatio].map(r => r.toJSON ? r.toJSON() : r))`));
      console.log('overlay', JSON.stringify({ dpr: ovr[2], cover: [ovr[0].width, ovr[0].height], overlay: [ovr[1].width, ovr[1].height] }));
      assert(Math.abs(ovr[0].left - ovr[1].left) < 1 && Math.abs(ovr[0].top - ovr[1].top) < 1 && Math.abs(ovr[0].width - ovr[1].width) < 1 && Math.abs(ovr[0].height - ovr[1].height) < 1, 'overlay does not match the cover');
      await shot('arrange-tab');
      const slots = await evaluate(`JSON.stringify(Object.fromEntries(Object.keys(TEMPLATES).map(t => [t, slotsFor(t)])))`);
      console.log('slots', slots);
      await evaluate(`randomize(); new Promise(r => setTimeout(r, 1500))`); await shot('random-1');
      await evaluate(`randomize(); new Promise(r => setTimeout(r, 1500))`); await shot('random-2');
      // Full-size export path (without the download): render 3000 px and check it is not blank.
      const stat = await evaluate(`renderPixels(...dims(3000)).then(c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let s = 0, v = 0; for (let i = 0; i < d.length; i += 4000) { s += d[i] + d[i+1] + d[i+2]; v++; } return c.width + 'x' + c.height + ' mean ' + (s / v / 3).toFixed(1); })`);
      console.log('export', stat);
      const jcard = await evaluate(`state.template = 'tape'; state.export.guides = true; const H = jcardPixels(), W = Math.round(H * TEMPLATES.tape.aspect); renderPixels(W, H).then(c => { const a = document.createElement('a'); return c.toDataURL('image/png').length + ' bytes ' + W + 'x' + H; })`);
      console.log('jcard', jcard);
      const pdf = await evaluate(`renderPixels(400, 400).then(c => pdfFromCanvas(c, 100, 100)).then(b => b.text()).then(t => t.slice(0, 8) + ' ... ' + t.slice(-6).trim())`);
      console.log('pdf', pdf);
      await evaluate(`activeTab = 'export'; renderTabs(); renderPanel(); new Promise(r => setTimeout(r, 900))`); await shot('tape-export');
    }
    console.log(errors.length ? 'PAGE ERRORS:\n' + errors.join('\n') : 'no page errors');
    code = errors.length ? 1 : 0;
  } catch (e) { console.error(e.message, "\nPAGE ERRORS:\n" + errors.join("\n")); } finally { chrome.kill(); server.close(); process.exitCode = code; }
})();
