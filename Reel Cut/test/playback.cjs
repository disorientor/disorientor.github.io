const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(`${__dirname}/../src/editor.src.html`, 'utf8');
const playback = source.split('/* ---------- playback ---------- */')[1].split('/* ---------- drawing ---------- */')[0];
let seeks = 0, audioTime = 0, now = 1000;
const audio = {
  paused: false, seeking: false,
  get currentTime() { return audioTime; },
  set currentTime(value) { seeks++; audioTime = value; },
  pause() { this.paused = true; },
  play() { this.paused = false; return Promise.resolve(); }
};
const video = { paused: false, seeking: true, readyState: 1, currentTime: 0,
  pause() { this.paused = true; }, play() { this.paused = false; return Promise.resolve(); } };
const clip = { media: 'v', start: 0, in: 0, out: 60, vol: 0 };
const context = vm.createContext({
  performance: { now: () => now },
  media: new Map([['v', { id: 'v', kind: 'video', el: video }], ['a', { id: 'a', kind: 'audio', el: audio }]]),
  S: { clips: [clip], audio: [{ media: 'a', start: 0, in: 0, out: 60, vol: 1 }] },
  t: 0, playing: false, dirty: false, lastDrawT: -1, exporting: null,
  clipAt: () => clip, total: () => 60, cdur: c => c.out - c.in, aend: a => a.start + a.out - a.in,
  $: () => ({ style: {}, setAttribute() {} }),
  ensureAudio() {}, setVol() {}, draw() {}, updateTime() {}, updatePan() {}, requestAnimationFrame() {},
  finishExport() { context.finished = true; context.playing = false; }
});
vm.runInContext(playback, context);
context.setPlaying(true);
// Audio advances naturally during slow rendering and a buffering/seeking video.
for (let i = 1; i <= 20; i++) {
  audioTime = i * 0.25;
  context.tick(now + i * 250);
}
assert.equal(context.t, 5, 'slow frames and video buffering must not lose timeline time');
assert.equal(seeks, 0, 'continuous audio must never be rewound by rendering stalls');
// Do not restart an in-flight seek on every animation frame.
audio.seeking = true; audioTime = 0;
context.syncMedia();
assert.equal(seeks, 0);
audio.seeking = false;
context.syncMedia();
assert.equal(seeks, 1, 'real drift should still be corrected');
context.setPlaying(false);
now = 20000;
context.setPlaying(true);
audioTime = 5.1;
context.tick(20100);
assert.ok(Math.abs(context.t - 5.1) < 1e-9, 'resume must exclude paused time');
context.exporting = { T: 60 };
context.tick(75100);
assert.equal(context.t, 60);
assert.equal(context.finished, true, 'exports must still finish at the timeline end');
const script = source.match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(script);
console.log('Playback regression checks passed; editor script parses.');
