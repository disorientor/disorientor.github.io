import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

import { createScene, allocateFromXY } from '../src/xy-allocator.js';
import { textToPhonemes } from '../src/audio/mumble.js';
import { transpileCanvasItem, transpileInstancedCanvasItem, transpileSpatial } from '../src/visual/gdshader-transpiler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

console.log('1. Testing Scene switching & X/Y Coordinate Allocation...');
const sA = createScene(0xdead);
const sB = createScene(0x1337);
assert.notEqual(sA.seed16, sB.seed16);

const f00 = allocateFromXY(sA, 0.05, 0.05);
const f10 = allocateFromXY(sA, 0.95, 0.05);
const f01 = allocateFromXY(sA, 0.05, 0.95);
const f11 = allocateFromXY(sA, 0.95, 0.95);

assert.ok(f10.bpm !== f00.bpm || f11.bpm !== f00.bpm, 'XY must shift BPM');
assert.notDeepEqual(f00.kickPattern, f11.kickPattern, 'XY must mutate kick pattern');
assert.notEqual(f00.idm.p10, f10.idm.p10, 'XY must sweep IDM cut probability');
assert.notEqual(f00.unstableDsp.bitDepth, f10.unstableDsp.bitDepth, 'XY must sweep bit-depth');
assert.notEqual(f00.visual.bgXY[0], f11.visual.bgXY[0], 'XY must sweep background uniform vectors');
assert.notEqual(sA.bgOrder[0], sB.bgOrder[0], 'Radical scene switch must change background');
console.log(`   PASS: XY sweeps BPM (${f00.bpm}..${f11.bpm}), patterns, IDM, DSP, and shader parameters.`);

console.log('1a. Testing Equal Likelihood for Death Industrial / Dark Ambient / Power Electronics...');
const archCounts = [0, 0, 0, 0, 0, 0];
for (let i = 0; i < 1000; i++) {
  const sc = createScene((i * 7919) & 0xffff);
  archCounts[sc.tempoArchetype]++;
}
const beatTotal = archCounts[0] + archCounts[1] + archCounts[2];
const darkTotal = archCounts[3] + archCounts[4] + archCounts[5];
assert.ok(darkTotal >= 420 && darkTotal <= 580, `Expected ~50% dark/industrial/ambient/PE, got ${darkTotal}/1000`);
assert.ok(archCounts[3] >= 100 && archCounts[4] >= 100 && archCounts[5] >= 100, `Each dark archetype must trigger frequently: ${archCounts.slice(3).join(',')}`);
console.log(`   PASS: Beat/IDM=${beatTotal}/1000, DeathInd=${archCounts[3]}, DarkAmb=${archCounts[4]}, PowerElec=${archCounts[5]}.`);

console.log('1b. Testing Imported Shader Transpilation (51 backgrounds, 40 glitches, 34 foregrounds)...');
const shadersRoot = path.join(rootDir, 'shaders');
const manifest = JSON.parse(fs.readFileSync(path.join(shadersRoot, 'manifest.json'), 'utf8'));
assert.equal(manifest.backgrounds.length, 51);
assert.equal(manifest.glitches.length, 40);
assert.equal(manifest.foregrounds.length, 34);
const inc = {
  'visual_panel_sampling.gdshaderinc': fs.readFileSync(path.join(shadersRoot, 'glitch/visual_panel_sampling.gdshaderinc'), 'utf8'),
  'kinetic_moves.gdshaderinc': fs.readFileSync(path.join(shadersRoot, 'glitch/kinetic_moves.gdshaderinc'), 'utf8'),
};
const instanced = new Set(['composition_glyphs', 'composition_shards', 'composition_colony_points', 'composition_attractor_points']);
const spatial = new Set(['composition_terrain_mesh', 'composition_terrain_head', 'composition_glass', 'composition_screen']);
for (const b of manifest.backgrounds) {
  const glsl = transpileCanvasItem(fs.readFileSync(path.join(rootDir, b.path), 'utf8'), inc);
  assert.ok(!/shader_type|render_mode|hint_|source_color/.test(glsl), `Leaked Godot syntax in ${b.id}`);
}
for (const g of manifest.glitches) {
  const glsl = transpileCanvasItem(fs.readFileSync(path.join(rootDir, g.path), 'utf8'), inc);
  assert.ok(!/shader_type|render_mode|hint_|source_color/.test(glsl), `Leaked Godot syntax in ${g.id}`);
}
for (const f of manifest.foregrounds) {
  const raw = fs.readFileSync(path.join(rootDir, f.path), 'utf8');
  if (spatial.has(f.id)) transpileSpatial(raw);
  else if (instanced.has(f.id)) transpileInstancedCanvasItem(raw, { isPoints: f.id === 'composition_colony_points' });
  else transpileCanvasItem(raw, inc);
}
console.log('   PASS: All 125 imported Haecceity shaders transpiled cleanly.');

console.log('2. Testing MumbleSpeak text-to-phoneme conversion...');
const ph = textToPhonemes('haecceity breaks the signal!', { speed: 120, seed: 0xdead });
assert.ok(ph.length >= 6, `Expected >=6 phonemes, got ${ph.length}`);
assert.ok(ph.some((p) => p.text === 'HAECCEITY'), 'Expected word label preserved');
console.log(`   PASS: Generated ${ph.length} phonemes from phrase.`);

console.log('3. Testing AudioWorklet DSP (Kick, Kits, IDM, Unstable, MumbleSpeak, Sidechain)...');
const workletSrc = fs.readFileSync(path.join(rootDir, 'src/audio/haecceity-worklet.js'), 'utf8');
let RegisteredProcessor = null;
const telemetryEvents = [];
const sandbox = {
  sampleRate: 48000,
  Float32Array,
  Math,
  Number,
  Array,
  Object,
  AudioWorkletProcessor: class {
    constructor() {
      this.port = {
        onmessage: null,
        postMessage: (m) => { if (m?.type === 'telemetry') telemetryEvents.push(m); },
      };
    }
  },
  registerProcessor: (_name, cls) => {
    RegisteredProcessor = cls;
  },
};
vm.runInNewContext(workletSrc, sandbox);
assert.ok(RegisteredProcessor, 'HaecceityProcessor must register cleanly');

const proc = new RegisteredProcessor();
const outL = new Float32Array(128);
const outR = new Float32Array(128);

proc.handleMessage({ type: 'scene', seed16: sA.seed16 });
proc.handleMessage({ type: 'xyFrame', frame: f11 });
proc.handleMessage({ type: 'mumblePhrase', phonemes: ph });
proc.handleMessage({ type: 'transport', playing: true, bpm: f11.bpm });

const idmModesSeen = new Set();
let maxPeak = 0;
let mumbleSawOutput = false;
for (let b = 0; b < 800; b++) {
  if (b === 300) {
    proc.handleMessage({ type: 'xyFrame', frame: allocateFromXY(sB, 0.88, 0.72) });
  }
  assert.equal(proc.process([], [[outL, outR]]), true);
  for (let i = 0; i < 128; i++) {
    assert.ok(Number.isFinite(outL[i]) && Number.isFinite(outR[i]), `Non-finite sample at ${b}:${i}`);
    assert.ok(Math.abs(outL[i]) <= 1.0001 && Math.abs(outR[i]) <= 1.0001, `Limiter exceeded at ${b}:${i}`);
    maxPeak = Math.max(maxPeak, Math.abs(outL[i]), Math.abs(outR[i]));
  }
}
for (const ev of telemetryEvents) {
  idmModesSeen.add(ev.idmMode);
  if (ev.peakMumble > 0.01) mumbleSawOutput = true;
}
assert.ok(maxPeak > 0.2, `Expected strong audio peak, got ${maxPeak}`);
assert.ok(idmModesSeen.size >= 2, `Expected IDM plugin to switch modes actively, saw: ${[...idmModesSeen].join(',')}`);
assert.ok(mumbleSawOutput, 'Expected MumbleSpeak rhythmic formant audio output');
console.log(`   PASS: 102,400 frames processed, maxPeak=${maxPeak.toFixed(3)}, IDM modes=[${[...idmModesSeen].join(', ')}], MumbleSpeak active.`);

console.log('4. Testing Kick Sidechain Ducking on Unstable Path...');
const scProc = new RegisteredProcessor();
scProc.handleMessage({ type: 'mixParam', key: 'kickGain', value: 0.0 });
scProc.handleMessage({ type: 'mixParam', key: 'drumGain', value: 0.0 });
scProc.handleMessage({ type: 'mixParam', key: 'idmGain', value: 0.0 });
scProc.handleMessage({ type: 'mixParam', key: 'mumbleGain', value: 0.0 });
scProc.handleMessage({ type: 'unstableParam', key: 'droneLevel', value: 0.9 });
scProc.handleMessage({ type: 'unstableParam', key: 'scDepth', value: 0.95 });
const measureRms = (p, blocks) => {
  let sum = 0;
  for (let b = 0; b < blocks; b++) {
    p.process([], [[outL, outR]]);
    for (let i = 0; i < 128; i++) sum += outL[i] * outL[i];
  }
  return Math.sqrt(sum / (blocks * 128));
};
const rmsBefore = measureRms(scProc, 40);
scProc.handleMessage({ type: 'trigKick', vel: 1.0 });
const rmsDuring = measureRms(scProc, 8);
assert.ok(rmsDuring < rmsBefore * 0.45, `Expected sidechain duck (${rmsDuring.toFixed(4)} vs ${rmsBefore.toFixed(4)})`);
console.log(`   PASS: Sidechain ducked unstable RMS ${rmsBefore.toFixed(4)} -> ${rmsDuring.toFixed(4)}.`);

console.log('4b. Testing Death Industrial, Dark Ambient, and Power Electronics DSP modes...');
for (const [archIdx, label] of [[3, 'DEATH_INDUSTRIAL'], [4, 'DARK_AMBIENT'], [5, 'POWER_ELECTRONICS']]) {
  const sc = createScene(0x4242 + archIdx, { archetype: archIdx });
  const fr = allocateFromXY(sc, 0.62, 0.71);
  const p = new RegisteredProcessor();
  p.handleMessage({ type: 'scene', seed16: sc.seed16 });
  p.handleMessage({ type: 'xyFrame', frame: fr });
  p.handleMessage({ type: 'transport', playing: true, bpm: fr.bpm });
  let peak = 0;
  for (let b = 0; b < 300; b++) {
    assert.equal(p.process([], [[outL, outR]]), true);
    for (let i = 0; i < 128; i++) {
      assert.ok(Number.isFinite(outL[i]) && Number.isFinite(outR[i]), `${label} non-finite sample`);
      assert.ok(Math.abs(outL[i]) <= 1.0001 && Math.abs(outR[i]) <= 1.0001, `${label} limiter exceeded`);
      peak = Math.max(peak, Math.abs(outL[i]), Math.abs(outR[i]));
    }
  }
  assert.ok(peak > 0.15, `${label} must produce strong audio, got peak=${peak}`);
  console.log(`   PASS: ${label} (texMode=${fr.unstableDsp.textureMode}, bpm=${fr.bpm}) peak=${peak.toFixed(3)}.`);
}

console.log('5. Checking minimal UI & HTML invariants...');
const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
const appSrc = fs.readFileSync(path.join(rootDir, 'src/ui/app.js'), 'utf8');
assert.ok(indexHtml.includes('id="haecceity-btn"') && indexHtml.includes('>haecceity<'), 'Missing top-right haecceity button');
assert.ok(indexHtml.includes('id="mumble-modal"') && indexHtml.includes('id="volume-dock"'), 'Missing MumbleSpeak modal or volume dock');
assert.ok(!/<input\b[^>]*type\s*=\s*["']range["']/i.test(indexHtml + appSrc), 'Must not use HTML range sliders');
console.log('   PASS: All UI invariants verified.');
