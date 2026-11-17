/**
 * Haecceity Web AudioWorkletProcessor
 * Sample-accurate DSP engine containing:
 *  - Master Transport & Polymetric Sequencer
 *  - Kick Engine (5 Haecceity recipes, dual pitch env, direct sub, transient, dual-stage drive + screech)
 *  - 4 Procedural Drumkits x 8 Voices (Binary Raster, Hydraulic Piston, Wire Ritual KS, Crate Dust)
 *  - IDM Plugin (Immediate IdmUnit: 6s ringbuf, onset detector, Lag/Mute/Ratchet/Cut/Ghost, Body Locks + Stereo Comb)
 *  - Unstable Signal Path (Algorithmic Pulse/Drone -> Buffer Mangler -> Waveshaper -> Stereo Feedback Loop, sidechained against Kicks)
 *  - MumbleSpeak Formant Synthesizer (Glottal LF pulse -> 4 Formant SVFs + Consonants + Reverse/Fragment grains, rhythmically synced)
 */

const TAU = Math.PI * 2;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function fastTanh(x) {
  if (!Number.isFinite(x)) return 0;
  if (x > 4.5) return 1;
  if (x < -4.5) return -1;
  return Math.tanh(x);
}

function idmHash(a, b, c, d) {
  let h = (Math.imul(a >>> 0, 0x9e3779b1) +
           Math.imul(b >>> 0, 0x85ebca77) +
           Math.imul(c >>> 0, 0xc2b2ae3d) +
           Math.imul(d >>> 0, 0x27d4eb2f)) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d) >>> 0;
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39) >>> 0;
  h ^= h >>> 15;
  return h >>> 0;
}

function idmUnit(h) {
  return (h & 0xffffff) / 16777216.0;
}

function euclidHit(step, k, n) {
  if (n <= 0 || k <= 0) return false;
  if (k >= n) return true;
  const s = ((step % n) + n) % n;
  return ((s * k) % n) < k;
}

class SVF {
  constructor() {
    this.ic1eq = 0;
    this.ic2eq = 0;
  }
  reset() {
    this.ic1eq = 0;
    this.ic2eq = 0;
  }
  process(v0, cutoffHz, q, sr) {
    if (!Number.isFinite(v0)) return { low: 0, band: 0, high: 0 };
    const fc = clamp(Number.isFinite(cutoffHz) ? cutoffHz : 1000, 20, sr * 0.44);
    const k = 1 / Math.max(0.25, Number.isFinite(q) ? q : 0.7);
    const g = Math.tan(Math.PI * fc / sr);
    const a1 = 1 / (1 + g * (g + k));
    const a2 = g * a1;
    const a3 = g * a2;
    const v3 = v0 - this.ic2eq;
    const v1 = a1 * this.ic1eq + a2 * v3;
    const v2 = this.ic2eq + a2 * this.ic1eq + a3 * v3;
    this.ic1eq = 2 * v1 - this.ic1eq;
    this.ic2eq = 2 * v2 - this.ic2eq;
    if (!Number.isFinite(this.ic1eq) || !Number.isFinite(this.ic2eq)) {
      this.ic1eq = 0;
      this.ic2eq = 0;
      return { low: 0, band: 0, high: 0 };
    }
    return { low: v2, band: v1, high: v0 - k * v1 - v2 };
  }
}

class DCBlock {
  constructor() {
    this.x1 = 0;
    this.y1 = 0;
  }
  process(x) {
    const y = x - this.x1 + 0.9965 * this.y1;
    this.x1 = x;
    this.y1 = Number.isFinite(y) ? y : 0;
    return this.y1;
  }
}

class StereoHistory {
  constructor(maxSamples) {
    this.size = maxSamples;
    this.l = new Float32Array(maxSamples);
    this.r = new Float32Array(maxSamples);
    this.cursor = 0;
    this.written = 0;
  }
  clear() {
    this.l.fill(0);
    this.r.fill(0);
    this.cursor = 0;
    this.written = 0;
  }
  write(left, right) {
    this.l[this.cursor] = left;
    this.r[this.cursor] = right;
    this.cursor = (this.cursor + 1) % this.size;
    if (this.written < this.size) this.written++;
  }
  read(delaySamples) {
    const d = clamp(delaySamples, 0, this.size - 2);
    const idx = this.cursor - 1 - d;
    let i0 = Math.floor(idx);
    const frac = idx - i0;
    i0 = ((i0 % this.size) + this.size) % this.size;
    const i1 = (i0 + 1) % this.size;
    return [
      this.l[i0] + (this.l[i1] - this.l[i0]) * frac,
      this.r[i0] + (this.r[i1] - this.r[i0]) * frac,
    ];
  }
  readCubic(delaySamples) {
    const d = clamp(delaySamples, 0, this.size - 4);
    let pos = this.cursor - 1 - d;
    while (pos < 0) pos += this.size;
    const i = Math.floor(pos);
    const f = pos - i;
    const s = this.size;
    const im1 = (i - 1 + s) % s;
    const i0 = i % s;
    const i1 = (i + 1) % s;
    const i2 = (i + 2) % s;
    const aL = this.l[im1], bL = this.l[i0], cL = this.l[i1], dL = this.l[i2];
    const aR = this.r[im1], bR = this.r[i0], cR = this.r[i1], dR = this.r[i2];
    return [
      bL + 0.5 * f * (cL - aL + f * (2 * aL - 5 * bL + 4 * cL - dL + f * (3 * (bL - cL) + dL - aL))),
      bR + 0.5 * f * (cR - aR + f * (2 * aR - 5 * bR + 4 * cR - dR + f * (3 * (bR - cR) + dR - aR))),
    ];
  }
}

class FxFilter {
  constructor() {
    this.ic1 = 0;
    this.ic2 = 0;
  }
  reset() {
    this.ic1 = 0;
    this.ic2 = 0;
  }
  process(x, hz, resonance, sr) {
    if (!Number.isFinite(x)) return { low: 0, mid: 0, high: 0 };
    const fc = clamp(Number.isFinite(hz) ? hz : 1000, 20, sr * 0.40);
    const g = Math.tan(Math.PI * fc / sr);
    const k = 2 - 1.94 * clamp(Number.isFinite(resonance) ? resonance : 0.302, 0, 0.96);
    const a1 = 1 / (1 + g * (g + k));
    const v1 = a1 * (this.ic1 + g * (x - this.ic2));
    const v2 = this.ic2 + g * v1;
    this.ic1 = 2 * v1 - this.ic1;
    this.ic2 = 2 * v2 - this.ic2;
    if (!Number.isFinite(this.ic1) || !Number.isFinite(this.ic2)) {
      this.ic1 = 0;
      this.ic2 = 0;
      return { low: 0, mid: 0, high: 0 };
    }
    return { low: v2, mid: v1, high: x - k * v1 - v2 };
  }
}

class LR4 {
  constructor() {
    this.a = new FxFilter();
    this.b = new FxFilter();
    this.c = new FxFilter();
    this.d = new FxFilter();
  }
  reset() {
    this.a.reset();
    this.b.reset();
    this.c.reset();
    this.d.reset();
  }
  split(x, hz, sr) {
    const low = this.b.process(this.a.process(x, hz, 0.302, sr).low, hz, 0.302, sr).low;
    const high = this.d.process(this.c.process(x, hz, 0.302, sr).high, hz, 0.302, sr).high;
    return [low, high];
  }
}

// ---------------------------------------------------------------------------
// PSYCHOACOUSTICS UNIT (Phantom Bass, Air Exciter, Haas Width, Loudness, 3D Pan)
// ---------------------------------------------------------------------------
class PsychoUnit {
  constructor(sr) {
    this.sr = sr;
    this.xo = [new LR4(), new LR4()];
    this.harmHp = new LR4();
    this.midXo = new LR4();
    this.sideXo = new LR4();
    this.airIn = [new LR4(), new LR4()];
    this.airOut = [new LR4(), new LR4()];
    this.harmLp = new FxFilter();
    this.airLp = [new FxFilter(), new FxFilter()];
    this.shelfLo = [new FxFilter(), new FxFilter()];
    this.shelfHi = [new FxFilter(), new FxFilter()];
    this.haas = new StereoHistory(Math.max(256, Math.ceil(sr * 0.1)));
    this.ears = new StereoHistory(Math.max(128, Math.ceil(sr * 0.01)));
    this.env = 0;
    this.airEnv = [0, 0];
    this.cutLp = [0, 0];
    this.shadowX = [0, 0];
    this.shadowY = [0, 0];
    this.pinna = [new FxFilter(), new FxFilter()];
    this.frontBand = [new FxFilter(), new FxFilter()];
    this.rearBand = [new FxFilter(), new FxFilter()];
    this.upBand = [new FxFilter(), new FxFilter()];
    this.rearShade = [new FxFilter(), new FxFilter()];
    this.airLoss = [new FxFilter(), new FxFilter()];

    this.model = 0;
    this.params = {
      wet: 0.0,
      amount: 0.7,
      x: 0.0,
      y: 0.0,
      alt: 0.0,
      p0: 0.45, p1: 0.55, p2: 0.35, p3: 0.20,
      p4: 0.45, p5: 0.45, p6: 0.40,
      p7: 0.35, p8: 0.55, p9: 0.35,
      p10: 0.45, p11: 0.55,
      p12: 0.50, p13: 0.45, p14: 0.25,
    };
  }

  applyParams(obj) {
    if (!obj) return;
    if (typeof obj.model === 'number') this.model = clamp(Math.round(obj.model), 0, 4);
    for (const k of Object.keys(obj)) {
      if (k !== 'model' && k in this.params && typeof obj[k] === 'number') {
        this.params[k] = obj[k];
      }
    }
  }

  process(inL, inR) {
    const p = this.params;
    const wet = clamp(p.wet, 0, 1);
    if (wet <= 0.005) return [inL, inR];

    const sr = this.sr;
    const a = clamp(p.amount, 0, 1);
    const inten = (0.35 + 0.65 * a) * Math.pow(2, 0.5 * clamp(p.x, -1, 1));
    const tilt = Math.pow(2, 0.5 * clamp(p.y, -1, 1));
    const right = p.alt > 0.5;
    let outL = inL;
    let outR = inR;

    if (this.model === 0) {
      // Phantom bass: missing-fundamental Chebyshev harmonics 2-5
      const hz = clamp(40 * Math.pow(4, clamp(p.p0, 0, 1)) * tilt, 30, 250);
      const [lowL] = this.xo[0].split(inL, hz, sr);
      const [lowR] = this.xo[1].split(inR, hz, sr);
      const m = 0.5 * (lowL + lowR);
      const r = Math.abs(m);
      this.env += (r - this.env) * (1 - Math.exp(-1 / (sr * (r > this.env ? 0.002 : 0.05))));
      const scale = this.env * 0.95 + 1e-5;
      const u = clamp(m / scale, -1, 1);
      const u2 = u * u;
      const t2 = 2 * u2 - 1;
      const t3 = -(u * (4 * u2 - 3));
      const t4 = -(8 * u2 * u2 - 8 * u2 + 1);
      const t5 = u * (16 * u2 * u2 - 20 * u2 + 5);
      const odd = clamp(p.p2, 0, 1);
      let h = ((1 - odd) * (0.7 * t2 + 0.3 * t4) + odd * (0.7 * t3 + 0.3 * t5)) * scale;
      const [, hi] = this.harmHp.split(h, hz, sr);
      h = this.harmLp.process(hi, hz * 8, 0.25, sr).low;
      const gain = 2.8 * clamp(p.p1, 0, 1) * inten * (right ? 1.35 : 1);
      const cut = clamp(clamp(p.p3, 0, 1) + (right ? a : 0), 0, 1);
      const c1 = 1 - Math.exp(-TAU * clamp(hz * 1.25, 30, sr * 0.25) / sr);
      this.cutLp[0] += (inL - this.cutLp[0]) * c1;
      this.cutLp[1] += (inR - this.cutLp[1]) * c1;
      outL = (inL - cut * this.cutLp[0]) + gain * h;
      outR = (inR - cut * this.cutLp[1]) + gain * h;
    } else if (this.model === 1) {
      // Air exciter
      const hz = clamp(2000 * Math.pow(5, clamp(p.p4, 0, 1)) * tilt, 1000, Math.min(16000, sr * 0.42));
      const drive = clamp(clamp(p.p5, 0, 1) * (0.6 + 0.4 * inten), 0, 1);
      const mix = 5.5 * clamp(p.p6, 0, 1) * inten;
      const inHp = Math.max(300, hz * 0.32);
      const inLp = Math.min(hz * 3.2, sr * 0.23);
      const kr = 1 - Math.exp(-1 / (sr * 0.002));
      const kf = 1 - Math.exp(-1 / (sr * 0.04));
      const ins = [inL, inR];
      const outs = [inL, inR];
      for (let c = 0; c < 2; c++) {
        let [, band] = this.airIn[c].split(ins[c], inHp, sr);
        band = this.airLp[c].process(band, inLp, 0.2, sr).low;
        const r2 = band * band;
        this.airEnv[c] += (r2 - this.airEnv[c]) * (r2 > this.airEnv[c] ? kr : kf);
        const scale = Math.sqrt(this.airEnv[c]) * 1.15 + 1e-5;
        const u = clamp(band / scale, -1, 1);
        const u2 = u * u;
        const t2 = 2 * u2 - 1;
        const t4 = -(8 * u2 * u2 - 8 * u2 + 1);
        const t3 = -(u * (4 * u2 - 3));
        const t5 = u * (16 * u2 * u2 - 20 * u2 + 5);
        const h = right ? (1 - drive) * t3 + drive * t5 : (1 - drive) * t2 + drive * t4;
        const [, hi] = this.airOut[c].split(h * scale, hz, sr);
        outs[c] = ins[c] + mix * hi;
      }
      outL = outs[0];
      outR = outs[1];
    } else if (this.model === 2) {
      // Mono-safe Haas width
      const mid = 0.5 * (inL + inR);
      const side = 0.5 * (inL - inR);
      const monoHz = 60 * Math.pow(5, clamp(p.p9, 0, 1));
      const lag = sr * 0.001 * clamp((1 + 29 * clamp(p.p7, 0, 1)) * tilt, 0.5, 60);
      const [, mh] = this.midXo.split(mid, monoHz, sr);
      const [, sh] = this.sideXo.split(side, monoHz, sr);
      this.haas.write(mh, 0);
      const ghost = this.haas.readCubic(lag)[0];
      const w = clamp(clamp(p.p8, 0, 1) * inten, 0, 2);
      const s = right ? sh * (1 - clamp(a + 0.5 * clamp(p.p8, 0, 1), 0, 1)) : sh * (1 + 0.8 * w) + 1.4 * w * ghost;
      outL = mid + s;
      outR = mid - s;
    } else if (this.model === 4) {
      // 3D binaural pan: Woodworth ITD, Brown-Duda head shadow, rising pinna notch, Blauert bands
      const rad = Math.PI / 180;
      const head = 0.0875;
      const sound = 343;
      let az = (-180 + 360 * clamp(p.p12, 0, 1)) + 90 * clamp(p.x, -1, 1);
      if (right) az = 180 - az;
      az = ((az + 180) % 360 + 360) % 360 - 180;
      const el = clamp(-45 + 135 * clamp(p.p13, 0, 1) + 45 * clamp(p.y, -1, 1), -45, 90);
      const dist = 0.3 * Math.pow(40, clamp(p.p14, 0, 1));
      const cue = 0.35 + 0.65 * a;
      const ca = Math.cos(az * rad), sa = Math.sin(az * rad);
      const ce = Math.cos(el * rad), se = Math.sin(el * rad);
      const lateral = clamp(sa * ce, -1, 1);
      const lat = Math.asin(lateral);
      const itd = head / sound * (lat + Math.sin(lat)) * sr;
      const mono = 0.5 * (inL + inR);
      this.ears.write(mono, 0);
      const front = Math.max(0, ca) * ce;
      const behind = Math.max(0, -ca) * ce;
      const above = Math.max(0, se);
      const gain = clamp(1 / dist, 0.08, 1.25);
      const airHz = clamp(20000 / (1 + 0.3 * dist), 3000, Math.min(20000, sr * 0.42));
      const notchHz = 6000 + 4000 * (el + 45) / 135;
      const notch = cue * (0.35 + 0.45 * (1 - (el + 45) / 135));
      const outs = [0, 0];
      for (let c = 0; c < 2; c++) {
        const lag = c === 0 ? Math.max(0, itd) : Math.max(0, -itd);
        let v = this.ears.readCubic(lag)[0];
        const incidence = Math.acos(clamp(c === 0 ? -lateral : lateral, -1, 1)) / rad;
        let alpha = 1.05 + 0.95 * Math.cos(Math.min(incidence, 180) / 150 * Math.PI);
        alpha = 1 + (alpha - 1) * cue;
        const tk = sr / (sound / head);
        const b0 = 1 + alpha * tk, b1 = 1 - alpha * tk, a0 = 1 + tk, a1 = 1 - tk;
        const y = (b0 * v + b1 * this.shadowX[c] - a1 * this.shadowY[c]) / a0;
        this.shadowX[c] = v;
        this.shadowY[c] = Math.abs(y) < 1e-15 ? 0 : y;
        v = y;
        v -= notch * (2 - 1.94 * 0.6) * this.pinna[c].process(v, notchHz, 0.6, sr).mid;
        const kDir = 2 - 1.94 * 0.4;
        const fb = this.frontBand[c].process(v, 4000, 0.4, sr).mid;
        const rb = this.rearBand[c].process(v, 1100, 0.4, sr).mid;
        const ub = this.upBand[c].process(v, 8000, 0.4, sr).mid;
        v += kDir * (0.4 * cue * front * fb + 0.4 * cue * behind * rb + 0.6 * cue * above * ub);
        const dull = this.rearShade[c].process(v, 6000, 0, sr).low;
        v += 0.5 * cue * behind * (dull - v);
        v = this.airLoss[c].process(v, airHz, 0, sr).low;
        outs[c] = v * gain;
      }
      outL = outs[0];
      outR = outs[1];
    } else {
      // Equal-loudness contour shelves
      const drop = (1 - clamp(p.p10, 0, 1)) * 42 * clamp(clamp(p.p11, 0, 1) * inten * (right ? 1.6 : 1), 0, 2);
      const loDb = Math.min(12, 0.45 * drop);
      const hiDb = Math.min(8, 0.22 * drop);
      const gl = Math.pow(10, loDb / 20) - 1;
      const gh = Math.pow(10, hiDb / 20) - 1;
      const loHz = clamp(130 * tilt, 40, 320);
      const hiHz = clamp(5500 * tilt, 2500, 14000);
      outL = inL + gl * this.shelfLo[0].process(inL, loHz, 0.25, sr).low + gh * this.shelfHi[0].process(inL, hiHz, 0.25, sr).high;
      outR = inR + gl * this.shelfLo[1].process(inR, loHz, 0.25, sr).low + gh * this.shelfHi[1].process(inR, hiHz, 0.25, sr).high;
    }

    return [inL + (outL - inL) * wet, inR + (outR - inR) * wet];
  }
}

// ---------------------------------------------------------------------------
// CHOP AND SCREW UNIT (Two-deck variable speed, rotor, bar chops, wow/grit)
// ---------------------------------------------------------------------------
function chopSpeedFromDial(dial) {
  const d = clamp(dial, 0, 1);
  return Math.abs(d - 0.5) < 0.012 ? 1.0 : Math.pow(2, 2 * d - 1);
}

function chopWindowForBar(bar, amount) {
  const bars = bar + 1;
  const section = bars % 8 === 0;
  const phrase = bars % 4 === 0;
  const half = bars % 2 === 0;
  const nudge = idmUnit(idmHash(bar >>> 0, 0x9e3779b1, 0x2c1b3c6d, 1)) - 0.5;
  const threshold = (section ? 0.05 : phrase ? 0.25 : half ? 0.5 : 0.78) + nudge * 0.16;
  if (amount <= 0.001 || amount < threshold) return 0;
  return section ? (amount > 0.75 ? 4 : 2) : phrase ? 2 : 1;
}

class ChopScrewUnit {
  constructor(sr) {
    this.sr = sr;
    this.history = new StereoHistory(Math.ceil(sr * 12));
    this.rng = 0x51ed270b;
    this.params = {
      wet: 0.0,
      amount: 0.0,
      alt: 0.0,
      p0: 0.42, // Speed (0.5 = 1x)
      p1: 0.45, // Chop frequency
      p2: 0.50, // Division (2, 1, .5, .25, .125)
      p3: 0.82, // Gate duty
      p4: 0.25, // Wow
      p5: 0.20, // Flutter
      p6: 0.15, // Hiss
      p7: 0.12, // Crackle
      p8: 0.25, // Tape grit
    };
    this.clear();
  }

  clear() {
    this.history.clear();
    this.speed = 1;
    this.lag = 0;
    this.oldLag = 0;
    this.fade = 1;
    this.fadeStep = 0;
    this.lastTape = 0;
    this.wow = 0;
    this.flutter = 0;
    this.flutterTarget = 0;
    this.flutterClock = 0;
    this.rotor = 0;
    this.rotorMix = 0;
    this.chopping = false;
    this.fired = false;
    this.planned = -1e9;
    this.chopHit = -1;
    this.window = 0;
    this.chopStart = 0;
    this.chopEnd = 0;
    this.chopSize = 1;
    this.chopLag = 0;
    this.chopOld = 0;
    this.chopFade = 1;
    this.deck = 0;
    this.gate = 1;
    this.env = 0;
    this.pop = 0;
    this.popEnv = 0;
    this.popPan = 0.5;
    this.hissLow = [0, 0];
    this.tone = [0, 0];
    this.blockX = [0, 0];
    this.blockY = [0, 0];
  }

  applyParams(obj) {
    if (!obj) return;
    for (const k of Object.keys(obj)) {
      if (k in this.params && typeof obj[k] === 'number') this.params[k] = obj[k];
    }
  }

  nextNoise() {
    this.rng = (Math.imul(this.rng, 1664525) + 1013904223) >>> 0;
    return (this.rng / 2147483648.0) - 1.0;
  }

  jump(to, ms) {
    this.oldLag = this.lag;
    this.lag = to;
    this.fade = 0;
    this.fadeStep = 1 / Math.max(1, ms * this.sr * 0.001);
    this.chopping = false;
    this.planned = -1e9;
  }

  process(inL, inR, beat, tempo) {
    const p = this.params;
    const wet = clamp(p.wet, 0, 1);
    if (wet <= 0.005) {
      if (this.lag > 0) this.clear();
      return [inL, inR];
    }

    const sr = this.sr;
    this.history.write(inL, inR);
    const tTempo = clamp(tempo, 30, 240);
    const frames = sr * 60 / tTempo;
    const limit = this.history.size - 8;

    const target = chopSpeedFromDial(p.p0) * (p.alt > 0.5 ? Math.pow(2, -clamp(p.amount, 0, 1)) : 1.0);
    this.speed += (target - this.speed) * (1 - Math.exp(-1 / (sr * 0.35)));
    this.lag += 1 - this.speed;
    this.oldLag += 1 - this.speed;

    const rotating = this.speed > 1.001 && this.lag <= 1;
    this.rotorMix += ((rotating ? 1 : 0) - this.rotorMix) * (1 - Math.exp(-1 / (sr * 0.03)));
    if (this.lag < 0) this.lag = 0;
    if (this.oldLag < 0) this.oldLag = 0;
    if (this.fade >= 1 && this.lag >= limit) this.jump(0, 200);

    let tape = beat - this.lag / frames;
    let bar = Math.floor(tape / 4);
    if (this.fade >= 1 && Math.abs(target - 1) < 0.002 && this.lag > 1 && !this.chopping && bar !== Math.floor(this.lastTape / 4)) {
      this.jump(0, 60);
      tape = beat;
      bar = Math.floor(tape / 4);
    }
    if (tape < this.lastTape - 1) this.chopping = false;
    this.lastTape = tape;

    const divs = [2, 1, 0.5, 0.25, 0.125];
    const division = divs[clamp(Math.round(clamp(p.p2, 0, 1) * 4), 0, 4)];
    if (bar !== this.planned) {
      this.planned = bar;
      this.fired = false;
      this.window = chopWindowForBar(bar, clamp(p.p1, 0, 1));
    }

    if (!this.chopping && this.window > 0 && !this.fired) {
      const w = Math.max(division, Math.round(this.window / division) * division);
      const end = (bar + 1) * 4;
      if (tape >= end - w && this.lag + division * frames < Math.min(this.history.written, limit)) {
        this.fired = true;
        this.chopping = true;
        this.chopStart = end - w;
        this.chopEnd = end;
        this.chopSize = division;
        this.chopHit = -1;
        this.chopFade = 1;
      }
    }
    if (this.chopping && tape >= this.chopEnd) this.chopping = false;

    this.chopLag += 1 - this.speed;
    this.chopOld += 1 - this.speed;
    const duty = 0.25 + 0.75 * clamp(p.p3, 0, 1);
    let open = 1;
    if (this.chopping) {
      const hit = Math.floor((tape - this.chopStart) / this.chopSize);
      if (hit !== this.chopHit) {
        const to = this.lag + (hit + 1) * this.chopSize * frames;
        if (to >= Math.min(this.history.written, limit)) {
          this.chopping = false;
        } else {
          this.chopHit = hit;
          this.chopOld = this.chopLag;
          this.chopLag = to;
          this.chopFade = hit > 0 ? 0 : 1;
        }
      }
      const along = (tape - this.chopStart) / this.chopSize - hit;
      open = along < duty ? 1 : 0;
    }

    this.deck += ((this.chopping ? 1 : 0) - this.deck) * (1 - Math.exp(-1 / (sr * 0.003)));
    this.gate += ((this.chopping ? open : 1) - this.gate) * (1 - Math.exp(-1 / (sr * 0.002)));

    this.wow = (this.wow + TAU * (0.45 + 0.2 * Math.sin(this.flutterClock * 0.37)) / sr) % TAU;
    this.flutterClock += 11 / sr;
    if (this.flutterClock >= 1) {
      this.flutterClock -= 1;
      this.flutterTarget = this.nextNoise();
    }
    this.flutter += (this.flutterTarget - this.flutter) * 0.002;
    const wobble = sr * (0.004 * clamp(p.p4, 0, 1) * (1 + Math.sin(this.wow)) + 0.00025 * clamp(p.p5, 0, 1) * (1 + this.flutter));

    let [mainL, mainR] = this.history.readCubic(this.lag + wobble);
    if (this.rotorMix > 0.0005) {
      const span = sr * 0.07;
      this.rotor += (this.speed - 1) / span;
      this.rotor -= Math.floor(this.rotor);
      const second = this.rotor + 0.5 - Math.floor(this.rotor + 0.5);
      const [aL, aR] = this.history.readCubic(this.lag + wobble + span * (1 - this.rotor));
      const [bL, bR] = this.history.readCubic(this.lag + wobble + span * (1 - second));
      let ga = Math.sin(Math.PI * this.rotor);
      let gb = Math.sin(Math.PI * second);
      ga *= ga;
      gb *= gb;
      mainL = mainL * (1 - this.rotorMix) + (aL * ga + bL * gb) * this.rotorMix;
      mainR = mainR * (1 - this.rotorMix) + (aR * ga + bR * gb) * this.rotorMix;
    }

    if (this.fade < 1) {
      const [befL, befR] = this.history.readCubic(this.oldLag + wobble);
      const g = Math.sin(this.fade * Math.PI * 0.5);
      const h = Math.cos(this.fade * Math.PI * 0.5);
      this.fade = Math.min(1, this.fade + this.fadeStep);
      mainL = mainL * g + befL * h;
      mainR = mainR * g + befR * h;
    }

    let yL = mainL;
    let yR = mainR;
    if (this.deck > 0.0005) {
      let [secL, secR] = this.history.readCubic(this.chopLag + wobble);
      if (this.chopFade < 1) {
        const [cbL, cbR] = this.history.readCubic(this.chopOld + wobble);
        const g = Math.sin(this.chopFade * Math.PI * 0.5);
        const h = Math.cos(this.chopFade * Math.PI * 0.5);
        this.chopFade = Math.min(1, this.chopFade + 1 / (sr * 0.004));
        secL = secL * g + cbL * h;
        secR = secR * g + cbR * h;
      }
      yL = mainL * (1 - this.deck) + secL * this.deck;
      yR = mainR * (1 - this.deck) + secR * this.deck;
    }
    yL *= this.gate;
    yR *= this.gate;

    const grit = clamp(p.p8, 0, 1);
    if (grit > 0.0005) {
      const drive = 1 + 3 * grit;
      const bias = 0.12 * grit;
      const k = 1 - Math.exp(-TAU * 20000 * Math.pow(0.3, grit) / sr);
      const vs = [yL, yR];
      for (let c = 0; c < 2; c++) {
        const s = (Math.tanh(vs[c] * drive + bias) - Math.tanh(bias)) / drive;
        this.tone[c] += (s - this.tone[c]) * k;
        const b = this.tone[c] - this.blockX[c] + 0.9995 * this.blockY[c];
        this.blockX[c] = this.tone[c];
        this.blockY[c] = b;
        vs[c] = b;
      }
      yL = vs[0];
      yR = vs[1];
    }

    const level = Math.max(Math.abs(yL), Math.abs(yR));
    this.env = level > this.env ? this.env + (level - this.env) * 0.01 : this.env * (1 - 1 / (sr * 1.5));
    const surface = 0.08 + 0.92 * clamp(this.env * 4, 0, 1);
    const hiss = clamp(p.p6, 0, 1);
    if (hiss > 0.0005) {
      const amt = hiss * hiss * 0.05 * surface;
      const w0 = this.nextNoise(), w1 = this.nextNoise();
      this.hissLow[0] += (w0 - this.hissLow[0]) * 0.12;
      this.hissLow[1] += (w1 - this.hissLow[1]) * 0.12;
      yL += (w0 - this.hissLow[0]) * amt;
      yR += (w1 - this.hissLow[1]) * amt;
    }
    const crackle = clamp(p.p7, 0, 1);
    if (crackle > 0.0005) {
      if (this.nextNoise() * 0.5 + 0.5 < crackle * crackle * 22 / sr) {
        const a = this.nextNoise() * 0.5 + 0.5;
        this.pop = a * a * a;
        this.popEnv = 1;
        this.popPan = this.nextNoise() * 0.5 + 0.5;
      }
      if (this.popEnv > 0.0005) {
        this.popEnv *= Math.exp(-1 / (sr * 0.0007));
        const v = this.nextNoise() * this.pop * this.popEnv * 0.5 * surface;
        yL += v * Math.sqrt(1 - this.popPan);
        yR += v * Math.sqrt(this.popPan);
      }
    }

    return [inL + (yL - inL) * wet, inR + (yR - inR) * wet];
  }
}

// ---------------------------------------------------------------------------
// GLITCH UNIT (Shuffle, Retrigger, CD Skip, Bit/Clock Desync, Spectral/Comb, Chaos)
// ---------------------------------------------------------------------------
function runRadix2Fft(re, im, n, inverse) {
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i]; re[i] = re[j]; re[j] = tr;
      const ti = im[i]; im[i] = im[j]; im[j] = ti;
    }
  }
  const sign = inverse ? 1 : -1;
  for (let len = 2; len <= n; len <<= 1) {
    const ang = sign * TAU / len;
    const wStepRe = Math.cos(ang);
    const wStepIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let wRe = 1, wIm = 0;
      const half = len >> 1;
      for (let j = 0; j < half; j++) {
        const idx1 = i + j;
        const idx2 = idx1 + half;
        const uRe = re[idx1], uIm = im[idx1];
        const vRe = re[idx2] * wRe - im[idx2] * wIm;
        const vIm = re[idx2] * wIm + im[idx2] * wRe;
        re[idx1] = uRe + vRe;
        im[idx1] = uIm + vIm;
        re[idx2] = uRe - vRe;
        im[idx2] = uIm - vIm;
        const nwRe = wRe * wStepRe - wIm * wStepIm;
        wIm = wRe * wStepIm + wIm * wStepRe;
        wRe = nwRe;
      }
    }
  }
  if (inverse) {
    for (let i = 0; i < n; i++) {
      re[i] /= n;
      im[i] /= n;
    }
  }
}

class GlitchUnit {
  constructor(sr) {
    this.sr = sr;
    this.history = new StereoHistory(Math.max(4096, Math.ceil(sr * 3.0)));
    this.combSize = 4096;
    this.comb = [new Float32Array(this.combSize), new Float32Array(this.combSize)];
    this.combCursor = 0;

    this.fftN = 256;
    this.fftH = 64;
    this.fftIn = [new Float32Array(this.fftN), new Float32Array(this.fftN)];
    this.fftOut = [new Float32Array(this.fftN), new Float32Array(this.fftN)];
    this.fftWin = new Float32Array(this.fftN);
    for (let i = 0; i < this.fftN; i++) this.fftWin[i] = 0.5 - 0.5 * Math.cos(TAU * i / this.fftN);
    this.fftRe = new Float64Array(this.fftN);
    this.fftIm = new Float64Array(this.fftN);
    this.fftCur = 0;
    this.fftHop = 0;
    this.fftFilled = 0;

    this.ch = [this.makeChan(), this.makeChan()];
    this.lastStep = -1;
    this.freePhase = 0;
    this.freeStep = 0;
    this.stepSamples = 6000;
    this.fastEnv = 0;
    this.slowEnv = 0;
    this.ka = 1 - Math.exp(-1 / (sr * 0.0005));
    this.kr = 1 - Math.exp(-1 / (sr * 0.012));
    this.ks = 1 - Math.exp(-1 / (sr * 0.08));
    this.refractory = 0;
    this.lastOnsetLag = 0;

    this.model = 5;
    this.params = {
      wet: 0.0,
      amount: 0.55,
      x: 0.0,
      y: 0.0,
      motion: 0.25,
      alt: 0.0,
      p0: 0.55,  // Density
      p1: 0.50,  // Division
      p2: 1.0,   // Synced
      p3: 0.45,  // Slice length
      p4: 0.50,  // Pitch/speed ramp
      p5: 0.35,  // Reverse prob
      p6: 0.30,  // Crush
      p7: 0.35,  // Comb/ring
      p8: 0.20,  // Gate
      p9: 0.35,  // Stereo split
      p10: 0.35, // Smooth splice
      p11: 0.25, // Seed
    };
  }

  makeChan() {
    return {
      event: 0,
      readLag: 0,
      rate: 1,
      rateMult: 1,
      sliceLen: 512,
      age: 0,
      stepLen: 2048,
      gateDuty: 1,
      reverse: false,
      holdClock: 0,
      heldSample: 0,
      slipLag: 0,
      ringPhase: 0,
      ringHz: 220,
      combPeriod: 128,
      combFb: 0,
      combMix: 0,
      prevOut: 0,
      fade: 1,
      fadeStep: 1,
      lastDryOrWet: 0,
      dcX: 0,
      dcY: 0,
    };
  }

  applyParams(obj) {
    if (!obj) return;
    if (typeof obj.model === 'number') this.model = clamp(Math.round(obj.model), 0, 5);
    for (const k of Object.keys(obj)) {
      if (k !== 'model' && k in this.params && typeof obj[k] === 'number') {
        this.params[k] = obj[k];
      }
    }
  }

  resetTransport() {
    for (const c of this.ch) {
      c.event = 0;
      c.readLag = 0;
      c.rate = 1;
      c.rateMult = 1;
      c.age = 0;
      c.holdClock = 0;
      c.heldSample = 0;
      c.slipLag = 0;
      c.fade = 1;
    }
    this.lastStep = -1;
    this.freePhase = 0;
    this.freeStep = 0;
  }

  planChannel(cIdx, step, effDensity, stepSamps) {
    const p = this.params;
    const seed = Math.round(clamp(p.p11, 0, 1) * 999);
    const bar = Math.floor(Math.max(0, step) / 16);
    const st = Math.max(0, step) >>> 0;
    const split = clamp(p.p9, 0, 1);
    const chanSalt = (cIdx === 1 && split > 0.01) ? 0x91e10da5 : 0;
    const u = (salt) => idmUnit(idmHash(seed, bar >>> 0, st, (salt ^ chanSalt) >>> 0));

    const cs = this.ch[cIdx];
    cs.prevOut = cs.lastDryOrWet;
    const fadeMs = clamp(p.p10, 0, 1) * 4.0;
    cs.fade = fadeMs <= 0.02 ? 1.0 : 0.0;
    cs.fadeStep = fadeMs <= 0.02 ? 1.0 : 1.0 / Math.max(1.0, this.sr * fadeMs * 0.001);
    cs.age = 0;
    cs.stepLen = Math.max(64.0, stepSamps);

    const alt = p.alt > 0.5;
    const sliceP = clamp(p.p3, 0, 1);
    const rampP = clamp(p.p4 + clamp(p.y, -1, 1) * 0.45, 0, 1);
    const revP = clamp(p.p5 + (alt ? 0.35 : 0), 0, 1);
    const crushP = clamp(p.p6 + (alt ? 0.25 : 0), 0, 1);
    const combP = clamp(p.p7, 0, 1);
    const gateP = clamp(p.p8, 0, 1);

    if (effDensity <= 1e-6 || u(1) >= effDensity) {
      const prev = cs.event;
      cs.event = 0;
      cs.readLag = 0;
      cs.rate = 1;
      cs.rateMult = 1;
      cs.reverse = false;
      cs.gateDuty = 1;
      cs.slipLag = 0;
      cs.combMix = 0;
      if (prev === 0) cs.fade = 1.0;
      return;
    }

    // Events: 1 shuffle, 2 retrigger, 3 reverse, 4 tape stop, 5 cd skip, 6 bit desync, 7 comb ring, 8 spectral, 9 gate
    let ev = 1;
    switch (clamp(this.model, 0, 5)) {
      case 0: ev = u(2) < revP ? 3 : 1; break;
      case 1: ev = (rampP < 0.22 && u(2) < 0.45) ? 4 : 2; break;
      case 2: ev = 5; break;
      case 3: ev = 6; break;
      case 4: ev = u(2) < 0.48 + 0.3 * crushP ? 8 : 7; break;
      case 5: {
        const wRetrig = 0.28;
        const wRev = 0.14 + 0.35 * revP;
        const wStop = 0.10 + 0.25 * (1 - Math.min(1, rampP * 2)) + (alt ? 0.15 : 0);
        const wCrush = 0.14 + 0.4 * crushP + (alt ? 0.15 : 0);
        const wComb = 0.10 + 0.35 * combP;
        const wSpec = 0.08 + 0.25 * combP;
        const wCd = 0.12;
        const wGate = 0.06 + 0.28 * gateP;
        const total = wRetrig + wRev + wStop + wCrush + wComb + wSpec + wCd + wGate;
        let r = u(3) * total;
        if ((r -= wRetrig) < 0) ev = 2;
        else if ((r -= wRev) < 0) ev = 3;
        else if ((r -= wStop) < 0) ev = 4;
        else if ((r -= wCrush) < 0) ev = 6;
        else if ((r -= wComb) < 0) ev = 7;
        else if ((r -= wSpec) < 0) ev = 8;
        else if ((r -= wCd) < 0) ev = 5;
        else ev = 9;
        break;
      }
    }
    cs.event = ev;

    const semitones = (rampP - 0.5) * 24.0;
    const baseRate = Math.abs(rampP - 0.5) < 0.03 ? 1.0 : Math.pow(2, semitones / 12);
    cs.reverse = (ev === 3) || (ev !== 4 && ev !== 6 && u(4) < revP * 0.75);
    cs.gateDuty = 1.0 - gateP * 0.75 * (u(5) < 0.35 + 0.65 * gateP ? 1.0 : 0.0);
    cs.slipLag = split > 0.01 ? (cIdx === 1 ? 1 : -1) * split * (u(6) * this.sr * 0.022) : 0;
    cs.holdClock = 0;
    cs.combMix = 0;
    cs.rateMult = 1.0;

    const maxLag = this.history.size - 16;
    if (ev === 1) {
      const jumps = [1, 2, 3, 4, 6, 8];
      const j = jumps[Math.min(5, Math.floor(u(7) * (2 + 4 * sliceP)))];
      let targetLag = j * cs.stepLen;
      if (cs.reverse) targetLag = Math.max(cs.stepLen, targetLag);
      cs.readLag = clamp(targetLag, 0, maxLag);
      cs.sliceLen = cs.stepLen * (0.25 + 0.75 * sliceP);
      cs.rate = baseRate;
    } else if (ev === 2) {
      const reps = 2 + Math.round((1 - sliceP) * 10 + u(8) * 4);
      cs.sliceLen = Math.max(this.sr * 0.004, cs.stepLen / Math.max(1, reps));
      const startLag = (this.lastOnsetLag > 8 && this.lastOnsetLag < cs.stepLen * 2) ? this.lastOnsetLag : cs.sliceLen;
      cs.readLag = clamp(startLag, 4, maxLag);
      cs.rate = baseRate;
      const rampAmt = (rampP - 0.5) * 2.0;
      cs.rateMult = Math.pow(2, rampAmt * 1.2 / Math.max(1, cs.stepLen));
    } else if (ev === 3) {
      cs.sliceLen = Math.max(this.sr * 0.01, cs.stepLen * (0.35 + 0.65 * sliceP));
      cs.readLag = clamp(cs.sliceLen * 0.25, 4, maxLag);
      cs.rate = baseRate;
      cs.reverse = true;
    } else if (ev === 4) {
      cs.readLag = 0;
      cs.rate = 1.0;
      cs.reverse = false;
      const targetEnd = 0.04 + 0.25 * rampP;
      cs.rateMult = Math.pow(targetEnd, 1.0 / Math.max(1, cs.stepLen * (0.4 + 0.6 * sliceP)));
    } else if (ev === 5) {
      cs.sliceLen = this.sr * (0.004 + 0.041 * sliceP * (0.3 + 0.7 * u(9)));
      cs.readLag = clamp(cs.sliceLen * (1 + 3 * u(10)), 4, maxLag);
      cs.rate = 1.0;
      cs.reverse = u(11) < revP * 0.4;
    } else if (ev === 6) {
      cs.readLag = clamp(cs.slipLag < 0 ? 0 : cs.slipLag, 0, maxLag);
      cs.rate = 1.0;
    } else if (ev === 7) {
      const hz = clamp(220 * Math.pow(2, (rampP - 0.5) * 2 + (u(12) - 0.5) * 0.8), 45, this.sr * 0.25);
      cs.combPeriod = clamp(Math.round(this.sr / hz), 4, this.combSize - 4);
      cs.combFb = 0.76 + 0.20 * Math.max(combP, 0.4);
      cs.combMix = 0.45 + 0.45 * combP;
      cs.ringHz = hz * (1 + 1.5 * u(13));
      cs.readLag = 0;
    } else if (ev === 8) {
      cs.readLag = 0;
      cs.rate = baseRate;
    } else {
      cs.gateDuty = 0.15 + 0.35 * (1 - gateP);
      cs.readLag = 0;
    }
  }

  process(inL, inR, beat, tempo) {
    const p = this.params;
    const wetAmt = clamp(p.wet, 0, 1);
    const amount = clamp(p.amount, 0, 1);
    if (wetAmt <= 0.005 || amount <= 0.005) return [inL, inR];

    const sr = this.sr;
    this.history.write(inL, inR);
    const tTempo = clamp(tempo, 30, 240);

    const peak = Math.max(Math.abs(inL), Math.abs(inR));
    this.fastEnv += (peak - this.fastEnv) * (peak > this.fastEnv ? this.ka : this.kr);
    this.slowEnv += (peak - this.slowEnv) * this.ks;
    this.lastOnsetLag = Math.min(this.history.size - 16, this.lastOnsetLag + 1);
    if (this.refractory > 0) this.refractory--;
    else if (this.fastEnv > this.slowEnv * 1.7 + 0.0004 && this.fastEnv > 0.0012) {
      this.refractory = Math.floor(sr * 0.022);
      this.lastOnsetLag = sr * 0.001;
    }

    const effDensity = clamp(clamp(p.p0, 0, 1) * amount + clamp(p.motion, 0, 1) * 0.25, 0, 1);
    const divBeats = [2.0, 1.0, 0.5, 1 / 3, 0.25, 1 / 6, 0.125, 0.0625];
    const divPos = clamp(p.p1 + clamp(p.x, -1, 1) * 0.45, 0, 1);
    const divIdx = clamp(Math.round(divPos * 7), 0, 7);
    const synced = p.p2 >= 0.5;

    let step = 0;
    if (synced) {
      const stepBeats = divBeats[divIdx];
      this.stepSamples = sr * 60 / tTempo * stepBeats;
      step = Math.max(0, Math.floor(beat / stepBeats + 1e-9));
      if (step < this.lastStep) this.resetTransport();
    } else {
      const hz = Math.pow(32, divPos);
      this.stepSamples = sr / hz;
      this.freePhase += hz / sr;
      if (this.freePhase >= 1) {
        this.freePhase -= Math.floor(this.freePhase);
        this.freeStep++;
      }
      step = this.freeStep;
    }

    if (step !== this.lastStep) {
      this.lastStep = step;
      this.planChannel(0, step, effDensity, this.stepSamples);
      if (p.p9 > 0.01) this.planChannel(1, step, effDensity, this.stepSamples);
      else this.ch[1] = { ...this.ch[0] };
    }

    // 256-pt STFT scratch for Spectral Tear
    this.fftIn[0][this.fftCur] = inL;
    this.fftIn[1][this.fftCur] = inR;
    const specOutL = this.fftOut[0][this.fftCur];
    const specOutR = this.fftOut[1][this.fftCur];
    this.fftOut[0][this.fftCur] = 0;
    this.fftOut[1][this.fftCur] = 0;
    this.fftCur = (this.fftCur + 1) % this.fftN;
    this.fftFilled = Math.min(this.fftN, this.fftFilled + 1);

    const crushP = clamp(p.p6 + (p.alt > 0.5 ? 0.25 : 0), 0, 1);
    const combP = clamp(p.p7, 0, 1);
    if (++this.fftHop >= this.fftH) {
      this.fftHop = 0;
      if (this.fftFilled === this.fftN && (this.ch[0].event === 8 || this.ch[1].event === 8)) {
        const binStep = Math.max(1, 1 + Math.round(crushP * 6));
        const magFloor = 0.05 + 0.35 * combP;
        const qLevels = 2 + 14 * (1 - crushP);
        for (let c = 0; c < 2; c++) {
          for (let i = 0; i < this.fftN; i++) {
            this.fftRe[i] = this.fftIn[c][(this.fftCur + i) % this.fftN] * this.fftWin[i];
            this.fftIm[i] = 0;
          }
          runRadix2Fft(this.fftRe, this.fftIm, this.fftN, false);
          let peakMag = 1e-9;
          for (let k = 0; k <= this.fftN / 2; k++) {
            const m = Math.hypot(this.fftRe[k], this.fftIm[k]);
            if (m > peakMag) peakMag = m;
          }
          for (let k = 0; k <= this.fftN / 2; k++) {
            const qk = Math.floor(k / binStep) * binStep;
            let mag = Math.hypot(this.fftRe[qk], this.fftIm[qk]);
            if (mag < peakMag * magFloor * 0.25) mag = 0;
            let ph = Math.atan2(this.fftIm[qk], this.fftRe[qk]);
            ph = Math.round(ph * qLevels / TAU) * TAU / qLevels;
            const rVal = mag * Math.cos(ph);
            const iVal = mag * Math.sin(ph);
            if (k === 0 || k === this.fftN / 2) {
              this.fftRe[k] = rVal;
              this.fftIm[k] = 0;
            } else {
              this.fftRe[k] = rVal;
              this.fftIm[k] = iVal;
              this.fftRe[this.fftN - k] = rVal;
              this.fftIm[this.fftN - k] = -iVal;
            }
          }
          runRadix2Fft(this.fftRe, this.fftIm, this.fftN, true);
          for (let i = 0; i < this.fftN; i++) {
            this.fftOut[c][(this.fftCur + i) % this.fftN] += this.fftRe[i] * this.fftWin[i] / 1.5;
          }
        }
      }
    }

    const split = clamp(p.p9, 0, 1);
    const smooth = clamp(p.p10, 0, 1);
    const dry = [inL, inR];
    const outs = [inL, inR];
    const maxLag = this.history.size - 16;

    for (let c = 0; c < 2; c++) {
      const cs = this.ch[c];
      let y = dry[c];
      const ev = cs.event;

      if (ev >= 1 && ev <= 5) {
        const srate = cs.reverse ? -cs.rate : cs.rate;
        cs.readLag += 1 - srate;
        if (ev === 2) {
          const sl = Math.max(8, cs.sliceLen);
          if ((cs.age % sl) < 1 && cs.age >= 1) {
            cs.readLag = clamp(cs.sliceLen, 4, maxLag);
            if (smooth > 0.01) {
              cs.prevOut = cs.lastDryOrWet;
              cs.fade = 0;
            }
          }
          cs.rate = clamp(cs.rate * cs.rateMult, 0.125, 4);
        } else if (ev === 4) {
          cs.rate = Math.max(0.02, cs.rate * cs.rateMult);
        } else if (ev === 5) {
          const sl = Math.max(16, cs.sliceLen);
          if ((cs.age % sl) < 1 && cs.age >= 1) {
            const u = idmUnit(idmHash(this.lastStep >>> 0, cs.age >>> 0, c, 0xcd51));
            cs.readLag = u < 0.35
              ? clamp(cs.readLag + cs.sliceLen * (0.5 + u), 4, maxLag)
              : clamp(cs.sliceLen * (0.8 + 1.5 * u), 4, maxLag);
            if (smooth > 0.01) {
              cs.prevOut = cs.lastDryOrWet;
              cs.fade = 0;
            }
          }
        }
        cs.readLag = clamp(cs.readLag, 0, maxLag);
        const lag = clamp(cs.readLag + (c === 1 ? Math.abs(cs.slipLag) : 0), 0, maxLag);
        y = this.history.readCubic(lag)[c];
        if (split > 0.05 && (ev === 1 || ev === 2)) {
          const subIdx = Math.floor(cs.age / Math.max(8, cs.sliceLen));
          const odd = (subIdx & 1) === 1;
          const duck = 1 - split * 0.65 * ((c === 0) === odd ? 1 : 0);
          y *= duck;
        }
      } else if (ev === 6) {
        y = this.history.readCubic(clamp(cs.readLag, 0, maxLag))[c];
      } else if (ev === 8) {
        y = c === 0 ? specOutL : specOutR;
      }

      if (ev !== 0 && (ev === 6 || crushP > 0.05)) {
        const cAmt = ev === 6 ? Math.max(0.45, crushP) : crushP * 0.85;
        const decimate = 1 + Math.pow(cAmt, 1.6) * 38;
        if (++cs.holdClock >= decimate) {
          cs.holdClock -= decimate;
          const bits = Math.max(2.5, 14 - cAmt * 11);
          const steps = Math.pow(2, bits);
          let q = Math.round(clamp(y, -1.5, 1.5) * steps) / steps;
          if (ev === 6 && cAmt > 0.55) {
            let iv = Math.round(clamp(q, -1, 1) * 127);
            const mask = Math.round((cAmt - 0.55) * 2.2 * 24) & 0x1f;
            iv ^= mask;
            q = q * 0.65 + (iv / 127) * 0.35;
          }
          cs.heldSample = q;
        }
        y = y * (1 - cAmt) + cs.heldSample * cAmt;
      }

      if (ev !== 0 && (ev === 7 || combP > 0.05)) {
        const cmix = ev === 7 ? cs.combMix : combP * 0.45;
        const period = ev === 7 ? cs.combPeriod : clamp(Math.round(sr / 440), 8, this.combSize - 4);
        const fb = ev === 7 ? cs.combFb : 0.65 + 0.25 * combP;
        const at = (this.combCursor - period + this.combSize) % this.combSize;
        const cy = this.comb[c][at];
        this.comb[c][this.combCursor] = fastTanh(y * 0.6 + cy * fb);
        if (ev === 7) {
          cs.ringPhase = (cs.ringPhase + TAU * cs.ringHz / sr) % TAU;
          const ring = y * Math.sin(cs.ringPhase);
          y = y * (1 - cmix * 0.65) + cy * cmix + ring * cmix * 0.35;
        } else {
          y = y * (1 - cmix * 0.35) + cy * cmix;
        }
      } else {
        this.comb[c][this.combCursor] *= 0.95;
      }

      if (ev !== 0 && cs.gateDuty < 0.999) {
        const period = ev === 2 ? Math.max(8, cs.sliceLen) : cs.stepLen;
        const pos = cs.age % period;
        let g = (pos / period) <= cs.gateDuty ? 1 : 0;
        if (smooth > 0.02) {
          const ramp = Math.min(period * 0.15, sr * smooth * 0.003);
          if (ramp > 1) {
            const edge = cs.gateDuty * period;
            if (pos > edge - ramp && pos < edge + ramp) g = clamp(1 - (pos - (edge - ramp)) / (2 * ramp), 0, 1);
          }
        }
        y *= g;
      }

      if (cs.fade < 1) {
        const g = 0.5 - 0.5 * Math.cos(Math.PI * cs.fade);
        y = cs.prevOut * (1 - g) + y * g;
        cs.fade = Math.min(1, cs.fade + cs.fadeStep);
      }

      if (ev !== 0) {
        const dc = y - cs.dcX + 0.9985 * cs.dcY;
        cs.dcX = y;
        cs.dcY = Math.abs(dc) < 1e-15 ? 0 : dc;
        y = fastTanh(dc * 0.85) / 0.85;
      }
      if (!Number.isFinite(y)) y = 0;
      cs.lastDryOrWet = y;
      cs.age += 1;
      outs[c] = y;
    }
    this.combCursor = (this.combCursor + 1) % this.combSize;

    return [inL + (outs[0] - inL) * wetAmt, inR + (outs[1] - inR) * wetAmt];
  }
}

// ---------------------------------------------------------------------------
// ARTIFACT UNIT (Objects 8-mode resonator, Chatter grains, Suspended diffuse/freeze, Worn)
// ---------------------------------------------------------------------------
class ArtifactUnit {
  constructor(sr) {
    this.sr = sr;
    this.rng = 0x41f37acd;

    // 0: Objects (8 modal resonators per channel)
    this.objN = 8;
    this.objRe = [new Float64Array(8), new Float64Array(8)];
    this.objIm = [new Float64Array(8), new Float64Array(8)];
    this.objCos = [new Float64Array(8), new Float64Array(8)];
    this.objSin = [new Float64Array(8), new Float64Array(8)];
    this.objRad = [new Float64Array(8), new Float64Array(8)];
    this.objW = [new Float64Array(8), new Float64Array(8)];
    this.objFast = 0; this.objSlow = 0; this.objPrev = [0, 0]; this.objStrike = [0, 0];
    this.objPhase = 0; this.objRefractory = 0; this.objPulse = 0; this.objTick = 0;
    this.objAtk = 1 - Math.exp(-1 / (sr * 0.0004));
    this.objRel = 1 - Math.exp(-1 / (sr * 0.008));
    this.objFol = 1 - Math.exp(-1 / (sr * 0.045));

    // 1: Chatter (dual transient-scanning grains)
    this.chatHist = new StereoHistory(Math.max(1024, Math.ceil(sr * 2.0)));
    this.chatGrains = [{ start: 0, age: 0, length: 1, rate: 1, active: false }, { start: 0, age: 0, length: 1, rate: 1, active: false }];
    this.chatFrames = 0; this.chatAnchor = 0; this.chatAge = 0; this.chatSpan = 1;
    this.chatFast = 0; this.chatSlow = 0; this.chatClock = 0; this.chatPhase = 0;
    this.chatCaptured = false; this.chatRefractory = 0;
    this.chatAtk = 1 - Math.exp(-1 / (sr * 0.0005));
    this.chatRel = 1 - Math.exp(-1 / (sr * 0.012));
    this.chatFol = 1 - Math.exp(-1 / (sr * 0.08));

    // 2: Suspended (4-line Hadamard diffuse space + breathing beat gate + slow LFO shift)
    this.susLines = [
      new StereoHistory(Math.ceil(sr * 0.22)),
      new StereoHistory(Math.ceil(sr * 0.22)),
      new StereoHistory(Math.ceil(sr * 0.22)),
      new StereoHistory(Math.ceil(sr * 0.22)),
    ];
    this.susDampL = new Float64Array(4);
    this.susDampR = new Float64Array(4);
    this.susTone = [new FxFilter(), new FxFilter()];
    this.susPhase = 0; this.susGate = 0; this.susMotionPhase = 0;

    // 3: Worn (dual-mono tape drift, bandwidth, sampler wear, asymmetric drive)
    this.wornHist = new StereoHistory(Math.max(256, Math.ceil(sr * 0.12)));
    this.wornHp = [new FxFilter(), new FxFilter()];
    this.wornLp = [new FxFilter(), new FxFilter()];
    this.wornPhase = 0; this.wornHold = 0; this.wornHeld = [0, 0];

    // Character wander mixer
    this.weight = new Float64Array(4);
    this.wanderPhase = 0;
    this.primed = false;
    this.smooth = 1 - Math.exp(-1 / (sr * 0.06));

    this.model = 0;
    this.params = {
      wet: 0.0,
      amount: 0.7,
      p0: 0.65, // Mix / intensity
      p1: 0.45, // Scale
      p2: 0.35, // Motion
      p3: 0.25, // Wander
    };
  }

  applyParams(obj) {
    if (!obj) return;
    if (typeof obj.model === 'number') this.model = clamp(Math.round(obj.model), 0, 3);
    for (const k of Object.keys(obj)) {
      if (k !== 'model' && k in this.params && typeof obj[k] === 'number') {
        this.params[k] = obj[k];
      }
    }
  }

  nextNoise() {
    this.rng = (Math.imul(this.rng, 1664525) + 1013904223) >>> 0;
    return (this.rng / 2147483648.0) - 1.0;
  }

  tuneObjects(scale, motion) {
    const sr = this.sr;
    const glass = [1, 2.32, 4.25, 6.63, 9.38, 12.4, 15.8, 19.5];
    const wood  = [1, 2.76, 5.40, 8.93, 13.3, 18.6, 24.8, 31.9];
    const metal = [1, 1.47, 2.09, 2.56, 3.30, 4.08, 5.43, 6.79];
    const woodMix = 1 - Math.abs(2 * scale - 1);
    const metalMix = Math.max(0, 2 * scale - 1);
    const base = 1900 * Math.pow(0.065, scale);
    const decay = (0.025 + 0.6 * scale * scale) * (1 - 0.68 * woodMix);
    for (let c = 0; c < 2; c++) {
      for (let k = 0; k < this.objN; k++) {
        const ratio = glass[k] + (wood[k] - glass[k]) * woodMix + (metal[k] - glass[k]) * metalMix;
        const drift = motion * (0.018 * Math.sin(this.objPhase * (1 + k * 0.071) + k * 1.7 + c * 0.8));
        const hz = base * ratio * Math.pow(2, drift + (c ? 1 : -1) * motion * 0.002);
        const audible = clamp((sr * 0.44 - hz) / (sr * 0.08), 0, 1);
        const angle = TAU * clamp(hz, 30, sr * 0.44) / sr;
        this.objCos[c][k] = Math.cos(angle);
        this.objSin[c][k] = Math.sin(angle);
        this.objRad[c][k] = Math.exp(-1 / (sr * decay / (1 + k * 0.32)));
        this.objW[c][k] = audible / (1 + k * 0.65);
      }
    }
  }

  processObjects(inL, inR, a, scale, motion) {
    const sr = this.sr;
    if (this.objTick === 0) this.tuneObjects(scale, motion);
    this.objTick = (this.objTick + 1) % 32;
    this.objPhase = (this.objPhase + TAU * 0.13 / sr) % (TAU * 1000);
    const v = [inL, inR];
    const peak = Math.max(Math.abs(inL), Math.abs(inR));
    this.objFast += (peak - this.objFast) * (peak > this.objFast ? this.objAtk : this.objRel);
    this.objSlow += (peak - this.objSlow) * this.objFol;
    if (this.objRefractory > 0) this.objRefractory--;
    else if (this.objFast > this.objSlow * 1.6 + 0.0002 && this.objFast > 0.0005) {
      this.objRefractory = Math.floor(sr * 0.018);
      this.objPulse = Math.max(1, Math.floor(sr * 0.001));
      const norm = Math.max(peak, 1e-6);
      this.objStrike[0] = (v[0] / norm) * Math.min(1, this.objFast * 2.5);
      this.objStrike[1] = (v[1] / norm) * Math.min(1, this.objFast * 2.5);
    }
    const noise = this.objPulse > 0 ? this.nextNoise() : 0;
    const outs = [0, 0];
    const normPulse = Math.sqrt(Math.max(1, sr * 0.001));
    for (let c = 0; c < 2; c++) {
      const diff = v[c] - this.objPrev[c];
      this.objPrev[c] = v[c];
      const excite = 0.045 * fastTanh(diff * 2) + this.objStrike[c] * noise * (this.objPulse > 0 ? 0.32 : 0) / normPulse;
      let acc = 0;
      for (let k = 0; k < this.objN; k++) {
        const r = this.objRad[c][k];
        const re = this.objRe[c][k];
        const im = this.objIm[c][k];
        const nRe = r * (this.objCos[c][k] * re - this.objSin[c][k] * im) + excite * this.objW[c][k];
        const nIm = r * (this.objSin[c][k] * re + this.objCos[c][k] * im);
        if (Math.abs(nRe) + Math.abs(nIm) < 1e-15) {
          this.objRe[c][k] = 0;
          this.objIm[c][k] = 0;
        } else {
          this.objRe[c][k] = nRe;
          this.objIm[c][k] = nIm;
        }
        acc += this.objIm[c][k];
      }
      outs[c] = v[c] * (1 - 0.85 * a) + fastTanh(acc * 2.8 / (1 + 2 * scale)) * a;
    }
    if (this.objPulse > 0) this.objPulse--;
    return outs;
  }

  processChatter(inL, inR, a, scale, motion) {
    const sr = this.sr;
    this.chatHist.write(inL, inR);
    const peak = Math.max(Math.abs(inL), Math.abs(inR));
    this.chatFast += (peak - this.chatFast) * (peak > this.chatFast ? this.chatAtk : this.chatRel);
    this.chatSlow += (peak - this.chatSlow) * this.chatFol;
    if (this.chatRefractory > 0) this.chatRefractory--;
    if ((!this.chatCaptured || this.chatAge > this.chatSpan * (4 + 4 * scale)) && this.chatFast > 0.001) {
      this.chatCaptured = true;
      this.chatAnchor = Math.max(0, this.chatFrames - sr * 0.002);
      this.chatAge = 0;
      this.chatSpan = sr * (0.025 + 0.15 * scale);
      this.chatClock = 0;
    } else if (this.chatFast > this.chatSlow * 1.9 + 0.0005 && this.chatFast > 0.002 && this.chatRefractory === 0 && this.chatAge > sr * 0.08) {
      this.chatAnchor = Math.max(0, this.chatFrames - sr * 0.002);
      this.chatAge = 0;
      this.chatSpan = sr * (0.025 + 0.15 * scale);
      this.chatRefractory = Math.floor(sr * (0.12 + 0.18 * scale));
    }
    const length = sr * (0.005 + 0.025 * scale);
    const stretch = 4 + 4 * scale;
    if (this.chatCaptured && --this.chatClock <= 0) {
      this.chatClock = length * 0.5;
      for (const g of this.chatGrains) {
        if (!g.active) {
          g.active = true;
          g.age = 0;
          g.length = length;
          const travel = clamp(this.chatAge / (this.chatSpan * stretch), 0, 1);
          const semitones = motion * (24 * travel - 12 + 6 * Math.sin(this.chatPhase));
          g.rate = Math.pow(2, semitones / 12);
          g.start = this.chatAnchor + Math.min(this.chatSpan * 0.85, this.chatAge / stretch);
          break;
        }
      }
    }
    let yL = 0, yR = 0;
    for (const g of this.chatGrains) {
      if (!g.active) continue;
      const pos = g.start + g.age * g.rate;
      const z = this.chatHist.readCubic(clamp(this.chatFrames - pos, 0, this.chatHist.size - 4));
      const w = 0.5 - 0.5 * Math.cos(TAU * g.age / g.length);
      yL += z[0] * w;
      yR += z[1] * w;
      if (++g.age >= g.length) g.active = false;
    }
    if (this.chatCaptured) this.chatAge++;
    this.chatFrames++;
    this.chatPhase = (this.chatPhase + TAU * 0.19 / sr) % TAU;
    const tail = Math.exp(-Math.max(0, this.chatAge - this.chatSpan * stretch) / (sr * 0.08));
    yL = fastTanh(yL * 1.4) * tail;
    yR = fastTanh(yR * 1.4) * tail;
    return [inL + (yL - inL) * a, inR + (yR - inR) * a];
  }

  processSuspended(inL, inR, a, scale, motion, tempo) {
    const sr = this.sr;
    const times = [0.0311, 0.0437, 0.0593, 0.0719];
    let spL = 0, spR = 0;
    const d = 0.16 + 0.3 * (1 - scale);
    for (let k = 0; k < 4; k++) {
      const z = this.susLines[k].readCubic(sr * times[k] * (0.7 + 1.8 * scale));
      this.susDampL[k] += (z[0] - this.susDampL[k]) * d;
      this.susDampR[k] += (z[1] - this.susDampR[k]) * d;
      spL += this.susDampL[k] * 0.48;
      spR += this.susDampR[k] * 0.48;
    }
    const fb = 0.68 + 0.14 * scale;
    for (let k = 0; k < 4; k++) {
      let l = 0, r = 0;
      for (let j = 0; j < 4; j++) {
        const sign = ((k & j) === 1 || (k & j) === 2) ? -1 : 1;
        l += this.susDampL[j] * sign * 0.5;
        r += this.susDampR[j] * sign * 0.5;
      }
      const leftGain = 0.19 + 0.025 * k;
      const rightGain = 0.265 - 0.025 * k;
      this.susLines[k].write(fastTanh(inL * leftGain + r * fb), fastTanh(inR * rightGain + l * fb));
    }

    this.susMotionPhase = (this.susMotionPhase + TAU * 0.11 / sr) % TAU;
    const cycles = Math.pow(2, 3 * (1 - scale)) * (1 + 0.08 * motion * Math.sin(this.susMotionPhase * 0.7));
    this.susPhase = (this.susPhase + clamp(tempo, 30, 240) / 60 * cycles / sr) % 1;
    const duty = 0.3 + 0.35 * scale + 0.08 * motion * Math.sin(this.susMotionPhase);
    const floor = 0.04 + 0.34 * scale;
    const pulse = this.susPhase < duty ? Math.pow(Math.max(0, Math.sin(Math.PI * this.susPhase / duty)), 0.65) : 0;
    this.susGate += ((floor + (1 - floor) * pulse) - this.susGate) * (1 - Math.exp(-1 / (sr * (0.0015 + 0.006 * scale))));

    const toneCut = 9000 * Math.pow(0.5, scale);
    const lOut = fastTanh(this.susTone[0].process(spL, toneCut, 0.1, sr).low * 2.4) * this.susGate;
    const rOut = fastTanh(this.susTone[1].process(spR, toneCut, 0.1, sr).low * 2.4) * this.susGate;
    return [inL + (lOut - inL) * a, inR + (rOut - inR) * a];
  }

  processWorn(inL, inR, a, scale, motion) {
    const sr = this.sr;
    this.wornHist.write(inL, inR);
    this.wornPhase = (this.wornPhase + TAU / sr) % (TAU * 100);
    const v = [0, 0];
    for (let c = 0; c < 2; c++) {
      const drift = motion * (
        0.00045 * Math.sin(this.wornPhase * 0.18 + c * 0.8) +
        0.00033 * Math.sin(this.wornPhase * 0.29 + c * 1.3) +
        0.000025 * Math.sin(this.wornPhase * 7.13 + c * 0.6)
      );
      let n = this.wornHist.readCubic(sr * (0.018 + drift))[c];
      n = this.wornHp[c].process(n, 70 + 180 * scale, 0.1, sr).high;
      v[c] = this.wornLp[c].process(n, 8200 * Math.pow(0.28, scale), 0.1, sr).low;
    }
    this.wornHold += Math.min(sr, 22000 * Math.pow(0.22, scale)) / sr;
    if (this.wornHold >= 1) {
      this.wornHold -= Math.floor(this.wornHold);
      const steps = Math.pow(2, 14 - 7 * scale);
      this.wornHeld[0] = Math.round(v[0] * steps) / steps;
      this.wornHeld[1] = Math.round(v[1] * steps) / steps;
    }
    const drive = 1 + 2.3 * scale;
    const bias = 0.04 + 0.13 * scale;
    const biasT = Math.tanh(bias);
    const wL = (fastTanh(this.wornHeld[0] * drive + bias) - biasT) / drive * 1.25;
    const wR = (fastTanh(this.wornHeld[1] * drive + bias) - biasT) / drive * 1.25;
    return [inL + (wL - inL) * a, inR + (wR - inR) * a];
  }

  process(inL, inR, tempo) {
    const p = this.params;
    const wet = clamp(p.wet, 0, 1);
    const effA = clamp(p.p0 * p.amount, 0, 1);
    if (wet * effA <= 0.005) return [inL, inR];

    const model = clamp(Math.round(this.model), 0, 3);
    const wander = clamp(p.p3, 0, 1);
    if (!this.primed) {
      this.weight.fill(0);
      this.weight[model] = 1;
      this.primed = true;
    }
    if (wander > 0) this.wanderPhase = (this.wanderPhase + TAU * (0.008 + 0.027 * wander) / this.sr) % (TAU * 1000);

    let pos = model + 1.5 * wander * (1 - Math.cos(this.wanderPhase));
    pos -= 4 * Math.floor(pos / 4);
    const first = Math.floor(pos) % 4;
    const second = (first + 1) % 4;
    const frac = pos - Math.floor(pos);

    const a = clamp(effA * (1 + 0.2 * wander * Math.sin(this.wanderPhase * 1.13)), 0, 1) * wet;
    const scale = clamp(p.p1 + 0.24 * wander * Math.sin(this.wanderPhase * 0.73), 0, 1);
    const motion = clamp(p.p2 + 0.3 * wander * Math.sin(this.wanderPhase * 0.91), 0, 1);

    let outL = 0, outR = 0;
    for (let k = 0; k < 4; k++) {
      const target = (k === first ? 1 - frac : 0) + (k === second ? frac : 0);
      this.weight[k] += (target - this.weight[k]) * this.smooth;
      if (Math.abs(this.weight[k] - target) < 1e-12) this.weight[k] = target;
      if (this.weight[k] > 0.001 || target > 0.001) {
        const y = k === 0 ? this.processObjects(inL, inR, a, scale, motion)
          : k === 1 ? this.processChatter(inL, inR, a, scale, motion)
          : k === 2 ? this.processSuspended(inL, inR, a, scale, motion, tempo)
          : this.processWorn(inL, inR, a, scale, motion);
        outL += y[0] * this.weight[k];
        outR += y[1] * this.weight[k];
      }
    }
    return [outL, outR];
  }
}

// ---------------------------------------------------------------------------
// KICK ENGINE
// ---------------------------------------------------------------------------
const KICK_RECIPES = [
  {
    pitchMidi: 36, drop: 44, dropMs: 14, glide: 7, glideMs: 90,
    shape: 0.05, sub: 0.42, click: 0.85, clickType: 0, clickHz: 4200, clickMs: 5,
    cutoff: 4800, drive1: 0.65, bias: 0.25, screechHz: 220, screechQ: 0.9, drive2: 0.30, decayMs: 400, gain: 0.92,
  },
  {
    pitchMidi: 31, drop: 30, dropMs: 9, glide: 12, glideMs: 60,
    shape: 0.0, sub: 0.72, click: 1.5, clickType: 1, clickHz: 280, clickMs: 28,
    cutoff: 2200, drive1: 0.56, bias: 0.10, screechHz: 1450, screechQ: 1.8, drive2: 0.40, decayMs: 460, gain: 0.95,
  },
  {
    pitchMidi: 34, drop: 38, dropMs: 12, glide: 10, glideMs: 110,
    shape: 0.35, sub: 0.55, click: 1.2, clickType: 2, clickHz: 1900, clickMs: 14,
    cutoff: 3600, drive1: 0.74, bias: 0.30, screechHz: 680, screechQ: 3.4, drive2: 0.52, decayMs: 360, gain: 0.90,
  },
  {
    pitchMidi: 29, drop: 24, dropMs: 15, glide: 5, glideMs: 85,
    shape: 0.0, sub: 0.95, click: 0.45, clickType: 0, clickHz: 3200, clickMs: 3,
    cutoff: 1600, drive1: 0.28, bias: 0.06, screechHz: 140, screechQ: 0.7, drive2: 0.16, decayMs: 650, gain: 0.98,
  },
  {
    pitchMidi: 37, drop: 48, dropMs: 11, glide: 14, glideMs: 140,
    shape: 0.65, sub: 0.62, click: 1.65, clickType: 1, clickHz: 3400, clickMs: 12,
    cutoff: 5400, drive1: 0.82, bias: 0.22, screechHz: 980, screechQ: 2.6, drive2: 0.62, decayMs: 390, gain: 0.88,
  },
  // 5: Gabber / Digital Hardcore Diode Kick
  {
    pitchMidi: 40, drop: 42, dropMs: 8, glide: 16, glideMs: 120,
    shape: 0.85, sub: 0.58, click: 1.85, clickType: 2, clickHz: 4800, clickMs: 8,
    cutoff: 6400, drive1: 0.96, bias: 0.34, screechHz: 1150, screechQ: 3.1, drive2: 0.78, decayMs: 310, gain: 0.92,
  },
  // 6: Microsound 40Hz Pure Sine Impulse
  {
    pitchMidi: 28, drop: 18, dropMs: 4, glide: 2, glideMs: 35,
    shape: 0.0, sub: 0.92, click: 1.35, clickType: 0, clickHz: 6400, clickMs: 1.8,
    cutoff: 1400, drive1: 0.06, bias: 0.0, screechHz: 90, screechQ: 0.5, drive2: 0.04, decayMs: 260, gain: 0.96,
  },
  // 7: Flashcore / Splittercore Laser-Tok Kick
  {
    pitchMidi: 38, drop: 54, dropMs: 6, glide: 12, glideMs: 42,
    shape: 0.55, sub: 0.48, click: 1.95, clickType: 1, clickHz: 3800, clickMs: 4,
    cutoff: 5800, drive1: 0.86, bias: 0.24, screechHz: 1850, screechQ: 3.8, drive2: 0.68, decayMs: 145, gain: 0.90,
  },
];

class KickEngine {
  constructor(sr) {
    this.sr = sr;
    this.active = false;
    this.age = 0;
    this.vel = 1;
    this.phase = 0;
    this.subPhase = 0;
    this.clickPhase = 0;
    this.rng = 0x51a7b3c9;
    this.preFilter = new SVF();
    this.screechFilter = new SVF();
    this.tokFilter = new SVF();
    this.dc = new DCBlock();
    this.params = { ...KICK_RECIPES[0], recipe: 0 };
  }

  applyParams(obj) {
    if (typeof obj.recipe === 'number' && obj.recipe !== this.params.recipe) {
      const r = KICK_RECIPES[clamp(Math.round(obj.recipe), 0, KICK_RECIPES.length - 1)];
      this.params.clickType = r.clickType;
      this.params.clickHz = r.clickHz;
      this.params.clickMs = r.clickMs;
      this.params.screechQ = r.screechQ;
      this.params.drive2 = r.drive2;
      this.params.bias = r.bias;
      this.params.recipe = obj.recipe;
    }
    for (const k of ['pitchMidi', 'drop', 'glide', 'shape', 'sub', 'click', 'drive1', 'screechHz', 'decayMs']) {
      if (typeof obj[k] === 'number') this.params[k] = obj[k];
    }
  }

  setParam(k, v) {
    if (k === 'recipe') {
      const r = KICK_RECIPES[clamp(Math.round(v), 0, KICK_RECIPES.length - 1)];
      this.params = { ...r, recipe: v };
      return;
    }
    if (k in this.params) this.params[k] = v;
  }

  trigger(velocity = 1.0) {
    this.active = true;
    this.age = 0;
    this.vel = clamp(velocity, 0.1, 1.3);
    this.phase = 0;
    this.subPhase = 0;
    this.clickPhase = 0;
    this.preFilter.reset();
    this.screechFilter.reset();
    this.tokFilter.reset();
  }

  nextNoise() {
    this.rng = (Math.imul(this.rng, 1664525) + 1013904223) >>> 0;
    return (this.rng / 2147483648.0) - 1.0;
  }

  process() {
    if (!this.active) return 0;
    const p = this.params;
    const tMs = (this.age / this.sr) * 1000.0;
    if (tMs > p.decayMs + 40) {
      this.active = false;
      return 0;
    }

    const envDrop = Math.exp(-5.0 * tMs / Math.max(2, p.dropMs));
    const envGlide = Math.exp(-3.0 * tMs / Math.max(8, p.glideMs));
    const ampEnv = Math.exp(-2.4 * Math.pow(tMs / Math.max(30, p.decayMs), 1.35)) * Math.min(1, tMs / 0.35);

    const baseHz = 440 * Math.pow(2, (p.pitchMidi - 69) / 12);
    const semiOffset = p.drop * envDrop + p.glide * envGlide;
    const bodyHz = clamp(baseHz * Math.pow(2, semiOffset / 12), 20, this.sr * 0.4);
    const subHz = clamp(baseHz * Math.pow(2, (p.drop * 0.65 * envDrop) / 12), 20, 400);

    this.phase = (this.phase + bodyHz / this.sr) % 1.0;
    this.subPhase = (this.subPhase + subHz / this.sr) % 1.0;

    const s = Math.sin(TAU * this.phase);
    const tri = 1 - 4 * Math.abs(Math.round(this.phase - 0.25) - (this.phase - 0.25));
    const fold = Math.sin(s * (1.2 + p.shape * 3.2));
    const osc = s * (1 - p.shape) + (tri * 0.55 + fold * 0.45) * p.shape;

    let trans = 0;
    if (tMs < p.clickMs * 3.5) {
      const cEnv = Math.exp(-4.0 * tMs / Math.max(1.5, p.clickMs));
      if (p.clickType === 0) {
        this.clickPhase = (this.clickPhase + p.clickHz / this.sr) % 1.0;
        trans = Math.sin(TAU * this.clickPhase) * cEnv * 0.75;
      } else if (p.clickType === 1) {
        const tokHz = p.clickHz * (1 + 0.5 * Math.exp(-tMs / 4));
        this.clickPhase = (this.clickPhase + tokHz / this.sr) % 1.0;
        const exc = Math.sin(TAU * this.clickPhase) + 0.35 * this.nextNoise();
        trans = this.tokFilter.process(exc, p.clickHz * 1.15, 2.8, this.sr).band * cEnv * 1.4;
      } else {
        trans = this.tokFilter.process(this.nextNoise(), p.clickHz, 1.5, this.sr).band * cEnv * 1.5;
      }
      trans *= p.click;
    }

    let sig = this.preFilter.process(osc * ampEnv, p.cutoff, 0.8, this.sr).low;
    const g1 = 1.0 + p.drive1 * 14.0;
    sig = fastTanh((sig + p.bias * 0.35 * ampEnv) * g1) - fastTanh(p.bias * 0.35 * ampEnv);

    if (p.screechQ > 0.75) {
      sig += this.screechFilter.process(sig, p.screechHz, p.screechQ, this.sr).band * 0.55;
    }

    const g2 = 1.0 + p.drive2 * 9.0;
    sig = fastTanh((sig + trans * 0.45) * g2);
    const directSub = Math.sin(TAU * this.subPhase) * p.sub * ampEnv * 0.85;

    const out = this.dc.process((sig * 0.62 + directSub + trans * 0.25) * p.gain * this.vel);
    this.age++;
    return clamp(out, -1.2, 1.2);
  }
}

// ---------------------------------------------------------------------------
// PROCEDURAL DRUMKITS (12 Kits x 8 Voices)
// ---------------------------------------------------------------------------
const DRUM_KIT_DECAYS_MS = [
  [180, 140, 110, 48, 220, 75, 160, 290],  // 0: Binary Raster
  [220, 190, 160, 62, 290, 115, 240, 380], // 1: Hydraulic Piston
  [260, 220, 180, 95, 340, 150, 290, 450], // 2: Wire Ritual KS
  [240, 210, 150, 70, 310, 95, 220, 420],  // 3: Crate Dust
  [120, 110, 85,  36, 155, 65, 130, 220],  // 4: Surgical Blades
  [280, 240, 200, 85, 320, 165, 260, 460], // 5: Iron Foundry / Bronze Teeth
  [165, 135, 95,  42, 180, 80, 150, 260],  // 6: Gabber / Hardcore Chop
  [75,  60,  45,  22, 85,  38, 65,  110],  // 7: Microsound Zero-Crossing
  [210, 175, 140, 58, 240, 130, 220, 340], // 8: Lowercase Foley / Paper & Glass
  [145, 125, 100, 44, 170, 85, 140, 260],  // 9: Comb Needle / Buffer Glitch
  [190, 155, 115, 52, 230, 78, 165, 310],  // 10: Amen / Breakbeat Vault
  [310, 250, 180, 75, 330, 140, 290, 480], // 11: Bone Room / Concrete Slam
];

class DrumVoice {
  constructor(sr) {
    this.sr = sr;
    this.active = false;
    this.kit = 0;
    this.slot = 0;
    this.age = 0;
    this.vel = 1;
    this.pan = 0;
    this.pitchMul = 1;
    this.phase = 0;
    this.modPhase = 0;
    this.rng = 0x1234567;
    this.svf = new SVF();
    this.ksBuf = new Float32Array(2048);
    this.ksLen = 256;
    this.ksIdx = 0;
    this.ksLast = 0;
    this.decaySamples = 4000;
  }

  nextNoise() {
    this.rng = (Math.imul(this.rng, 1664525) + 1013904223) >>> 0;
    return (this.rng / 2147483648.0) - 1.0;
  }

  trigger(kit, slot, vel, seedOffset = 0, pitchSemi = 0) {
    this.active = true;
    this.kit = kit;
    this.slot = slot;
    this.vel = vel;
    this.pitchMul = Math.pow(2, pitchSemi / 12);
    this.age = 0;
    this.phase = 0;
    this.modPhase = 0;
    this.rng = (0x9e3779b1 ^ (slot * 7919) ^ (kit * 3571) ^ seedOffset) >>> 0 || 1;
    this.svf.reset();

    const pans = [-0.05, 0.08, -0.24, 0.30, -0.36, 0.20, -0.28, 0.38];
    this.pan = pans[slot % 8];

    const decayTable = DRUM_KIT_DECAYS_MS[clamp(kit | 0, 0, DRUM_KIT_DECAYS_MS.length - 1)];
    this.decaySamples = Math.round((decayTable[slot] / 1000) * this.sr);

    if (kit === 2 || kit === 9 || slot === 7) {
      const wireHz = (kit === 2
        ? [68, 185, 310, 1120, 1540, 440, 132, 620][slot]
        : kit === 9
          ? [120, 340, 580, 1850, 2400, 920, 210, 1240][slot]
          : [90, 240, 400, 1600, 1900, 520, 180, 780][slot]) * this.pitchMul;
      this.ksLen = clamp(Math.round(this.sr / wireHz), 16, 2000);
      this.ksIdx = 0;
      this.ksLast = 0;
      for (let i = 0; i < this.ksLen; i++) {
        this.ksBuf[i] = this.nextNoise() * 0.9;
      }
    }
  }

  process() {
    if (!this.active) return [0, 0];
    if (this.age > this.decaySamples * 1.4) {
      this.active = false;
      return [0, 0];
    }

    const t = this.age / this.sr;
    const norm = this.age / Math.max(1, this.decaySamples);
    const env = Math.exp(-3.4 * norm) * Math.min(1, this.age / 14);
    const n = this.nextNoise();
    const pm = this.pitchMul;
    let s = 0;

    if (this.kit === 0) {
      if (this.slot === 0) {
        const f = (52 + 240 * Math.exp(-t * 95)) * pm;
        this.phase = (this.phase + f / this.sr) % 1;
        s = Math.sin(Math.sin(TAU * this.phase) * 2.2) * env;
      } else if (this.slot === 1) {
        const f = (190 + 180 * Math.exp(-t * 60)) * pm;
        this.modPhase = (this.modPhase + (f * 2.73) / this.sr) % 1;
        this.phase = (this.phase + (f + Math.sin(TAU * this.modPhase) * 280 * env) / this.sr) % 1;
        s = (Math.sin(TAU * this.phase) * 0.55 + this.svf.process(n, 3800 * pm, 1.4, this.sr).high * 0.65) * env;
      } else if (this.slot === 2) {
        const burst = ((this.age % 310) < 120 && t < 0.025) ? 1.2 : 0.7;
        s = this.svf.process(n * burst, 1850 * pm, 2.2, this.sr).band * env * 1.3;
      } else if (this.slot === 3 || this.slot === 4) {
        this.phase = (this.phase + (3210 * pm) / this.sr) % 1;
        this.modPhase = (this.modPhase + (4780 * pm) / this.sr) % 1;
        const sq = (this.phase < 0.5 ? 1 : -1) * (this.modPhase < 0.5 ? 1 : -1);
        s = this.svf.process(sq * 0.4 + n * 0.7, (this.slot === 3 ? 7400 : 5800) * pm, 1.6, this.sr).high * env;
      } else if (this.slot === 5) {
        this.phase = (this.phase + (890 * pm) / this.sr) % 1;
        this.modPhase = (this.modPhase + (1940 * pm) / this.sr) % 1;
        s = Math.sin(TAU * this.phase + Math.sin(TAU * this.modPhase) * 2.5) * Math.exp(-t * 55);
      } else if (this.slot === 6) {
        const f = (115 + 160 * Math.exp(-t * 32)) * pm;
        this.phase = (this.phase + f / this.sr) % 1;
        const x = Math.sin(TAU * this.phase);
        s = (4 * x * x * x - 3 * x) * 0.55 * env + x * 0.5 * env;
      } else {
        const prev = this.ksBuf[this.ksIdx];
        const next = 0.985 * 0.5 * (prev + this.ksLast);
        this.ksLast = prev;
        this.ksBuf[this.ksIdx] = next;
        this.ksIdx = (this.ksIdx + 1) % this.ksLen;
        s = this.svf.process(next, 2400 * pm, 2.0, this.sr).high * env * 1.4;
      }
    } else if (this.kit === 1) {
      if (this.slot === 0) {
        const f = (46 + 190 * Math.exp(-t * 70)) * pm;
        this.phase = (this.phase + f / this.sr) % 1;
        s = fastTanh(Math.sin(TAU * this.phase) * 2.8) * env;
      } else if (this.slot === 1) {
        this.phase = (this.phase + ((210 + 90 * Math.exp(-t * 45)) * pm) / this.sr) % 1;
        const plate = this.svf.process(Math.sin(TAU * this.phase) + n * 0.85, 1650 * pm, 3.2, this.sr).band;
        s = fastTanh((plate * 1.8 + Math.sin(TAU * this.phase) * 0.5) * 1.8) * env;
      } else if (this.slot === 2) {
        s = this.svf.process(n, (2600 + 1800 * env) * pm, 2.4, this.sr).band * env * 1.6;
      } else if (this.slot === 3 || this.slot === 4) {
        s = this.svf.process(n, (this.slot === 3 ? 8800 : 6200) * pm, 2.8, this.sr).high * env * 1.2;
      } else if (this.slot === 5) {
        this.phase = (this.phase + (610 * pm) / this.sr) % 1;
        this.modPhase = (this.modPhase + (1480 * pm) / this.sr) % 1;
        s = fastTanh((Math.sin(TAU * this.phase) + Math.sin(TAU * this.modPhase)) * 1.6) * env;
      } else if (this.slot === 6) {
        const f = (98 + 110 * Math.exp(-t * 25)) * pm;
        this.phase = (this.phase + f / this.sr) % 1;
        s = fastTanh(Math.sin(TAU * this.phase) * 2.2) * env;
      } else {
        this.phase = (this.phase + (420 * pm) / this.sr) % 1;
        this.modPhase = (this.modPhase + (1137 * pm) / this.sr) % 1;
        s = this.svf.process(Math.sin(TAU * this.phase + Math.sin(TAU * this.modPhase) * 3.8), 1800 * pm, 1.8, this.sr).high * env;
      }
    } else if (this.kit === 2) {
      const damp = this.slot >= 3 && this.slot <= 4 ? 0.96 : 0.992;
      const cur = this.ksBuf[this.ksIdx];
      const lp = 0.5 * (cur + this.ksLast);
      this.ksLast = cur;
      this.ksBuf[this.ksIdx] = damp * lp;
      this.ksIdx = (this.ksIdx + 1) % this.ksLen;
      if (this.slot === 0) {
        const f = (54 + 130 * Math.exp(-t * 55)) * pm;
        this.phase = (this.phase + f / this.sr) % 1;
        s = (cur * 0.55 + Math.sin(TAU * this.phase) * 0.65) * env;
      } else if (this.slot === 1 || this.slot === 2) {
        s = (cur * 1.3 + this.svf.process(n, 2200 * pm, 1.5, this.sr).band * 0.45) * env;
      } else if (this.slot === 3 || this.slot === 4) {
        s = this.svf.process(cur * 0.8 + n * 0.55, 6200 * pm, 1.4, this.sr).high * env * 1.3;
      } else {
        s = fastTanh(cur * 1.6) * env;
      }
    } else if (this.kit === 3) {
      if (this.slot === 0) {
        const f = (56 + 150 * Math.exp(-t * 65)) * pm;
        this.phase = (this.phase + f / this.sr) % 1;
        s = fastTanh((Math.sin(TAU * this.phase) + 0.06 * n) * 1.8) * env;
      } else if (this.slot === 1) {
        const f = (175 + 95 * Math.exp(-t * 50)) * pm;
        this.phase = (this.phase + f / this.sr) % 1;
        s = fastTanh((Math.sin(TAU * this.phase) * 0.6 + this.svf.process(n, 2400 * pm, 1.1, this.sr).band * 0.8) * 1.6) * env;
      } else if (this.slot === 2) {
        s = fastTanh(this.svf.process(n, 1450 * pm, 1.6, this.sr).band * 1.9) * env;
      } else if (this.slot === 3 || this.slot === 4) {
        s = this.svf.process(n, (this.slot === 3 ? 6500 : 4800) * pm, 0.9, this.sr).high * env * 0.9;
      } else if (this.slot === 5) {
        this.phase = (this.phase + (430 * pm) / this.sr) % 1;
        s = fastTanh(this.svf.process(Math.sin(TAU * this.phase) + n * 0.3, 1200 * pm, 2.5, this.sr).band * 1.8) * env;
      } else if (this.slot === 6) {
        const f = (110 + 95 * Math.exp(-t * 28)) * pm;
        this.phase = (this.phase + f / this.sr) % 1;
        s = fastTanh(Math.sin(TAU * this.phase) * 1.5) * env;
      } else {
        this.phase = (this.phase + (3400 * pm) / this.sr) % 1;
        s = this.svf.process(n + Math.sin(TAU * this.phase) * 0.25, 4200 * pm, 1.2, this.sr).high * env;
      }
    } else if (this.kit === 4) {
      // 4: Surgical Blades (razor metallic FM slice + cold high-Q transient)
      const fBase = [78, 240, 410, 6200, 4900, 1420, 165, 2950][this.slot] * pm;
      this.modPhase = (this.modPhase + (fBase * 2.414) / this.sr) % 1;
      this.phase = (this.phase + (fBase * (1 + 2.2 * Math.exp(-t * 140))) / this.sr) % 1;
      const slice = Math.sin(TAU * this.phase + Math.sin(TAU * this.modPhase) * (3.2 * env));
      if (this.slot === 3 || this.slot === 4) {
        s = this.svf.process(slice * 0.55 + n * 0.65, fBase, 2.6, this.sr).high * env * 1.3;
      } else if (this.slot === 2 || this.slot === 1) {
        s = fastTanh((slice * 0.8 + this.svf.process(n, 3200 * pm, 2.8, this.sr).band * 0.9) * 1.8) * env;
      } else {
        s = fastTanh(slice * 1.9) * env;
      }
    } else if (this.kit === 5) {
      // 5: Iron Foundry / Bronze Teeth (ring-modulated steel plate & anvil clang)
      const fBase = [58, 195, 360, 4600, 3400, 740, 128, 1180][this.slot] * pm;
      this.phase = (this.phase + fBase / this.sr) % 1;
      this.modPhase = (this.modPhase + (fBase * 1.732) / this.sr) % 1;
      const ring = Math.sin(TAU * this.phase) * Math.sin(TAU * this.modPhase);
      const body = Math.sin(TAU * this.phase * (1 + 1.5 * Math.exp(-t * 45)));
      s = fastTanh((ring * 0.95 + body * 0.55 + this.svf.process(n, fBase * 2.2, 3.0, this.sr).band * 0.55) * 1.7) * env;
    } else if (this.kit === 6) {
      // 6: Gabber / Hardcore Chop (overdriven diode punch & tight rave snare)
      if (this.slot === 0 || this.slot === 6) {
        const f = ((this.slot === 0 ? 52 : 98) + 240 * Math.exp(-t * 105)) * pm;
        this.phase = (this.phase + f / this.sr) % 1;
        s = fastTanh((Math.sin(TAU * this.phase) + 0.12 * n) * 3.8) * env;
      } else if (this.slot === 1 || this.slot === 2) {
        this.phase = (this.phase + (220 * pm) / this.sr) % 1;
        s = fastTanh((Math.sin(TAU * this.phase) * 0.7 + this.svf.process(n, 2300 * pm, 1.8, this.sr).band * 1.3) * 2.8) * env;
      } else if (this.slot === 3 || this.slot === 4) {
        s = fastTanh(this.svf.process(n, (this.slot === 3 ? 7200 : 5100) * pm, 1.4, this.sr).high * 2.4) * env;
      } else {
        this.phase = (this.phase + (520 * pm) / this.sr) % 1;
        this.modPhase = (this.modPhase + (1310 * pm) / this.sr) % 1;
        s = fastTanh((Math.sin(TAU * this.phase) * 0.8 + Math.sin(TAU * this.modPhase) * 0.6 + n * 0.3) * 2.5) * env;
      }
    } else if (this.kit === 7) {
      // 7: Microsound Zero-Crossing (surgical impulse clicks, pure sine blips, piezo ticks)
      const blipHz = [44, 1280, 2560, 8400, 6200, 3840, 96, 4800][this.slot] * pm;
      this.phase = (this.phase + blipHz / this.sr) % 1;
      const click = this.age < 10 ? (this.age % 2 === 0 ? 0.95 : -0.85) : 0;
      const sine = Math.sin(TAU * this.phase) * Math.exp(-t * (this.slot === 0 ? 45 : 160));
      s = (click * 0.75 + sine * 0.85 + this.svf.process(n, blipHz, 3.8, this.sr).band * 0.28) * Math.min(1, this.age / 2);
    } else if (this.kit === 8) {
      // 8: Lowercase Foley / Paper & Glass (glass ping, paper brush, ceramic tap)
      const fBase = [86, 410, 920, 5400, 3800, 2140, 190, 1480][this.slot] * pm;
      this.phase = (this.phase + fBase / this.sr) % 1;
      if (this.slot === 2 || this.slot === 3 || this.slot === 4) {
        const paper = this.svf.process(n, fBase, 2.2, this.sr).band;
        s = (paper * 0.95 + Math.sin(TAU * this.phase) * 0.25) * env * 1.1;
      } else {
        const glass = Math.sin(TAU * this.phase) * Math.exp(-t * 14) + Math.sin(TAU * this.phase * 2.756) * 0.35 * Math.exp(-t * 22);
        s = (glass * 0.8 + this.svf.process(n, fBase * 1.4, 2.8, this.sr).band * 0.25) * env;
      }
    } else if (this.kit === 9) {
      // 9: Comb Needle / Buffer Glitch (pitched KS comb zaps + FM stutter grains)
      const cur = this.ksBuf[this.ksIdx];
      const lp = 0.5 * (cur + this.ksLast);
      this.ksLast = cur;
      this.ksBuf[this.ksIdx] = 0.968 * lp;
      this.ksIdx = (this.ksIdx + 1) % this.ksLen;
      const f = [95, 310, 620, 4400, 3100, 1380, 175, 2240][this.slot] * pm;
      this.phase = (this.phase + (f * (1 + 0.8 * Math.sin(t * 210))) / this.sr) % 1;
      s = fastTanh((cur * 1.2 + Math.sin(TAU * this.phase) * 0.65) * 1.6) * env;
    } else if (this.kit === 10) {
      // 10: Amen / Breakbeat Vault (tight crisp acoustic break snare/ghost/ride/kick)
      if (this.slot === 0) {
        const f = (58 + 185 * Math.exp(-t * 85)) * pm;
        this.phase = (this.phase + f / this.sr) % 1;
        s = fastTanh((Math.sin(TAU * this.phase) + n * 0.08 * Math.exp(-t * 90)) * 1.9) * env;
      } else if (this.slot === 1 || this.slot === 2) {
        const f = (195 + 110 * Math.exp(-t * 70)) * pm;
        this.phase = (this.phase + f / this.sr) % 1;
        const wires = this.svf.process(n, 3200 * pm, 1.3, this.sr).high * 0.95 + this.svf.process(n, 1650 * pm, 2.0, this.sr).band * 0.7;
        s = fastTanh((Math.sin(TAU * this.phase) * 0.55 + wires) * (this.slot === 1 ? 1.8 : 1.15)) * env;
      } else if (this.slot === 3 || this.slot === 4) {
        s = this.svf.process(n, (this.slot === 3 ? 7800 : 5400) * pm, 1.4, this.sr).high * env * 1.15;
      } else if (this.slot === 5 || this.slot === 7) {
        this.phase = (this.phase + (680 * pm) / this.sr) % 1;
        this.modPhase = (this.modPhase + (1790 * pm) / this.sr) % 1;
        const metal = Math.sin(TAU * this.phase + Math.sin(TAU * this.modPhase) * 1.9);
        s = (this.svf.process(metal + n * 0.4, 3400 * pm, 1.8, this.sr).high * 0.9 + metal * 0.35) * env;
      } else {
        const f = (128 + 120 * Math.exp(-t * 36)) * pm;
        this.phase = (this.phase + f / this.sr) % 1;
        s = fastTanh(Math.sin(TAU * this.phase) * 1.7) * env;
      }
    } else {
      // 11: Bone Room / Concrete Slam (cavernous dull thud & brittle snap)
      const f = [44, 142, 260, 2900, 2100, 510, 74, 880][this.slot] * pm;
      this.phase = (this.phase + (f * (1 + 0.9 * Math.exp(-t * 50))) / this.sr) % 1;
      const thud = this.svf.process(Math.sin(TAU * this.phase) + n * 0.35, f * 2.4, 1.8, this.sr).low;
      const snap = this.svf.process(n, f * 2.0, 2.4, this.sr).band * Math.exp(-t * 65);
      s = fastTanh((thud * 1.4 + snap * 0.9) * 1.5) * env;
    }

    s *= this.vel * 0.95;
    this.age++;
    const gL = Math.cos((this.pan * 0.5 + 0.5) * Math.PI * 0.5);
    const gR = Math.sin((this.pan * 0.5 + 0.5) * Math.PI * 0.5);
    return [s * gL, s * gR];
  }
}

// ---------------------------------------------------------------------------
// IDM PLUGIN (Un-throttled immediate IdmUnit for visceral IDM mangling)
// ---------------------------------------------------------------------------
const IDM_MODE_NAMES = ['NORMAL', 'LAG', 'MUTE', 'RATCHET', 'CUT'];

class IdmUnit {
  constructor(sr) {
    this.sr = sr;
    this.history = new StereoHistory(Math.ceil(sr * 6));
    this.hits = new Float32Array(64);
    this.combL = new Float32Array(4096);
    this.combR = new Float32Array(4096);
    this.toneL = new SVF();
    this.toneR = new SVF();
    this.softL = new SVF();
    this.softR = new SVF();

    this.ka = 1 - Math.exp(-1 / (sr * 0.0005));
    this.kr = 1 - Math.exp(-1 / (sr * 0.012));
    this.ks = 1 - Math.exp(-1 / (sr * 0.08));
    this.kg = 1 - Math.exp(-1 / (sr * 0.001));

    this.model = 4;
    this.params = {
      wet: 0.92,
      amount: 0.95,
      alt: 0.0,
      p0: 0.72,  // Roll chance
      p1: 0.85,  // Roll density
      p2: 0.35,  // Roll interval
      p3: 0.55,  // Roll dynamics
      p4: 0.65,  // Ghost notes
      p5: 0.68,  // Body tuning
      p6: 0.62,  // Body decay
      p7: 0.65,  // Hit brightness
      p8: 0.78,  // Comb tail detail
      p9: 0.75,  // Cut division
      p10: 0.52, // Cut chance
      p11: 0.70, // Cut reverse
      p12: 0.65, // Variation
      p13: 0.25, // Hocket gaps
      p14: 0.143,
      p15: 1.0,
      p16: 0.35, // Gap
      p17: 0.50,
      p18: 0.55, // Cut accelerate
      p19: 0.45, // Accent protect
      p20: 0.25, // Weave (kept gentle so edits pop immediately!)
    };
    this.clear();
  }

  clear() {
    this.history.clear();
    this.hits.fill(0);
    this.combL.fill(0);
    this.combR.fill(0);
    this.toneL.reset();
    this.toneR.reset();
    this.softL.reset();
    this.softR.reset();

    this.step = -1;
    this.until = -1;
    this.refractoryIn = 0;
    this.refractory = 0;
    this.phrase = 0;
    this.seed = 0;
    this.barIn = 0;
    this.bars = 8;
    this.strikes = 0;
    this.onsetPeak = 0;
    this.fastIn = 0;
    this.slowIn = 0;
    this.fast = 0;
    this.slow = 0;
    this.gain = 1;
    this.lockLevel = 0.85;

    this.mode = 0;
    this.count = 1;
    this.combCursor = 0;
    this.t = 0;
    this.since = 0;
    this.window = 1;
    this.lag = 0;
    this.curve = 0;
    this.sub = 1;
    this.accel = 1;
    this.sliceAt = 0;
    this.slice = 1;
    this.gapFrom = 1e18;
    this.reverse = false;

    this.frames = 0;
    this.lastOnset = -1e12;
    this.replayFrame = 0;
    this.pitchPhase = 0;
    this.bodyWindow = 1;
    this.transition = 1;
    this.transitionL = 0;
    this.transitionR = 0;
    this.lastL = 0;
    this.lastR = 0;
    this.ghostPan = 0;
    this.steps = 16;
    this.character = -1;
    this.ghost = 0;
    this.ghostLag = 0;

    this.locked = false;
    this.age = 0;
    this.rate = 1;
    this.lift = 0;
    this.span = 1;
    this.env = 1;
    this.decay = 1;
    this.bright = 0;
    this.combPeriod = 0;
    this.combFb = 0;
    this.combMix = 0;
    this.combDampL = 0;
    this.combDampR = 0;
  }

  applyParams(obj) {
    if (typeof obj.model === 'number') this.model = clamp(Math.round(obj.model), 0, 6);
    for (const k of Object.keys(obj)) {
      if (k !== 'model' && k in this.params) {
        this.params[k] = obj[k];
      }
    }
  }

  effectiveParams(model) {
    const q = { ...this.params };
    const weave = clamp(q.p20, 0, 1) * (q.alt > 0.5 ? 0 : 0.38);
    q.p0 *= 1 - weave;
    q.p10 *= 1 - weave;
    q.p12 *= 1 - weave;

    if (model === 4) {
      q.p4 = Math.min(1, q.p4 * 1.25);
      q.p10 = Math.min(1, q.p10 * 1.45);
    } else if (model === 5) {
      q.p0 = Math.min(1, q.p0 * 1.5);
      q.p1 = Math.min(1, q.p1 * 1.3);
      q.p10 = Math.min(1, q.p10 * 1.8);
      q.p18 = Math.min(1, q.p18 * 1.6);
    }
    return q;
  }

  hit(s) {
    return s < 0 ? 0 : this.hits[s % 64];
  }

  u(s, salt) {
    return idmUnit(idmHash(this.seed, this.phrase >>> 0, s >>> 0, salt >>> 0));
  }

  splice() {
    this.transition = 0;
    this.transitionL = this.lastL;
    this.transitionR = this.lastR;
  }

  static edge(pos, length, fade) {
    return clamp(Math.min(pos, length - pos) / Math.max(1, fade), 0, 1);
  }

  plan(s, model, len, externalSeed) {
    const p = this.effectiveParams(model);
    this.character = model;
    this.steps = model === 5 ? 28 : 16;
    if (this.step >= 0) this.hits[this.step % 64] = this.onsetPeak;
    this.onsetPeak = 0;
    if (s < this.step) this.until = -1;
    this.step = s;
    this.since = 0;
    this.strikes = 0;
    this.bars = 4 * (1 + Math.round(clamp(p.p14, 0, 1) * 3));
    const bar = Math.floor(s / this.steps);
    const at = s % this.steps;
    this.phrase = Math.floor(bar / this.bars);
    this.barIn = bar % this.bars;
    this.seed = externalSeed !== undefined ? externalSeed : Math.round(clamp(p.p17, 0, 1) * 999);

    const a = clamp(p.amount, 0, 1);
    this.lockLevel = a * (0.65 + 0.35 * (this.barIn / this.bars));

    this.ghost = 0;
    const k = this.u(bar, 21) < 0.5 ? 1 : 3;
    const gp = clamp(p.p4, 0, 1);
    if (this.hit(s - this.steps) <= 0 && this.hit(s - k) > 0 && this.u(s, 22) < gp * a * 1.4) {
      this.ghost = 0.32 * gp;
      this.ghostLag = k * len;
      this.ghostPan = (2 * this.u(s, 23) - 1) * 0.65;
    }

    if (s < this.until) return;
    this.mode = 0;
    this.t = 0;
    this.window = len;
    this.lag = 0;

    const division = [0.5, 1 / 3, 0.25, 1 / 6, 0.125];
    const brk = p.alt > 0.5;
    const last = (this.barIn === this.bars - 1) && (at === this.steps - 2);

    if ((at % 4 === 2 || at % 4 === 3 || (brk && at % 2 === 1)) &&
        (last || (brk && this.u(s, 1) < 0.55) || this.u(s, 1) < clamp(p.p10, 0, 1) * a)) {
      this.mode = 4; // CUT
      this.window = 2 * len;
      this.until = s + 2;
      this.sub = division[Math.round(clamp(p.p9, 0, 1) * 4)] * len * 4;
      this.reverse = brk ? (this.u(s, 2) < 0.78) : (this.u(s, 2) < p.p11);
      this.accel = 1 - 0.55 * clamp(p.p18, 0, 1);
      if (brk) this.accel = Math.min(this.accel, 0.76);
      const g = clamp(p.p16, 0, 1) * 0.65 * this.window;
      this.gapFrom = last ? this.window - g : (this.u(s, 3) < p.p16 * 0.55 ? this.window - g * 0.5 : 1e18);
      this.replayFrame = this.frames - Math.min(this.sub, this.frames);
      this.sliceAt = 0;
      this.slice = Math.max(this.sr * 0.012, this.sub);
      if (model === 4) this.slice = Math.min(this.slice, len * 0.45);
      return;
    }

    const protect = (at === 0) || (at % 4 === 0 && this.u(s, 4) < p.p19);
    const cycle = [1, 1, 2, 4];
    const n = cycle[Math.round(clamp(p.p2, 0, 1) * 3)];
    if (!protect && (this.frames - this.lastOnset) < 12 * len &&
        (bar % n === n - 1) && this.u(s, 5) < Math.min(1, clamp(p.p0, 0, 1) * a + (brk ? 0.25 : 0))) {
      const w = (at % 4 === 3 || at === this.steps - 1) ? 1 : 2;
      this.mode = 3; // RATCHET
      this.window = w * len;
      this.until = s + w;
      const cnt = 2 + Math.round(clamp(p.p1, 0, 1) * (model === 5 ? 12 : 8));
      const rolls = [2, 3, 4, 6, 8];
      const breaks = [3, 4, 5, 6, 8, 12];
      const chosen = model === 5
        ? breaks[Math.min(5, Math.floor(this.u(s, 31) * 6))]
        : rolls[Math.min(4, Math.floor(this.u(s, 31) * 5))];
      this.count = Math.min(cnt, chosen);
      this.replayFrame = Math.max(0, this.lastOnset);
      this.curve = 2 * clamp(p.p3, 0, 1) - 1;
      return;
    }

    if (protect) return;

    const gaps = clamp(p.p13, 0, 1) * a;
    const mute = (model !== 1 && model !== 2)
      ? this.u(s, 6) < gaps * 0.55
      : (this.u(s, 7) < Math.min(1, gaps * 1.4) && ((this.u(s, 8) < 0.5) !== (model === 1)));
    if (mute) {
      this.mode = 2; // MUTE
      this.until = s + 1;
      return;
    }

    if (this.u(s, 9) < clamp(p.p12, 0, 1) * a * 0.6) {
      const c = this.u(s, 10);
      if (c < 0.45) {
        this.mode = 1; // LAG
        this.lag = len;
        this.window = 2 * len;
        this.until = s + 2;
      } else if (c < 0.78) {
        this.mode = 1;
        this.lag = 2 * len;
        this.until = s + 1;
      } else {
        this.mode = 1;
        this.lag = 4 * len;
        this.until = s + 1;
      }
    }
  }

  strike(len) {
    const p = this.effectiveParams(this.character);
    const salt = 100 + 8 * (this.strikes++ % 16);
    this.locked = this.u(this.step, salt) < this.lockLevel;
    this.age = 0;
    this.env = 1;
    this.bodyWindow = Math.min(this.sr * 0.18, len * 1.3);
    if (!this.locked) return;

    const intervals = [-12, -7, -5, 0, 5, 7, 12, 19, 24];
    const tuning = clamp(p.p5, 0, 1);
    const st = tuning < 0.55
      ? intervals[Math.min(8, Math.floor(this.u(this.step, salt + 1) * 9))]
      : Math.round((2 * this.u(this.step, salt + 1) - 1) * 24);
    this.rate = tuning > 0 ? Math.pow(2, st / 12) : 1;
    this.span = this.sr * (0.018 + 0.024 * tuning);
    this.lift = 0.25 + tuning * 0.72;

    const dk = clamp(p.p6, 0, 1) * this.u(this.step, salt + 2);
    this.decay = dk > 0.05 ? Math.exp(-1 / (this.sr * (0.012 + 0.35 * (1 - dk) * (1 - dk)))) : 1;
    this.bright = (2 * this.u(this.step, salt + 3) - 1) * clamp(p.p7, 0, 1);
    this.combMix = 0;

    if (this.u(this.step, salt + 4) < clamp(p.p8, 0, 1)) {
      const tail = this.u(this.step, salt + 5) < 0.55;
      const hz = tail
        ? 110 * Math.pow(2, Math.round(this.u(this.step, salt + 6) * 28) / 12)
        : 620 + 2400 * this.u(this.step, salt + 6);
      this.combPeriod = clamp(Math.round(this.sr / hz), 2, 4000);
      this.combFb = tail ? 0.90 : 0.76;
      this.combMix = (tail ? 0.24 : 0.18) * Math.sqrt(1 - this.combFb);
    }
  }

  process(inL, inR, beat, tempo, externalSeed, idmWetGain = 1.0) {
    const len = this.sr * 15 / clamp(tempo, 30, 240);
    const s = Math.max(0, Math.floor(beat * 4 + 1e-9));
    if (s < this.step) this.clear();

    this.history.write(inL, inR);
    if (s !== this.step || this.model !== this.character) {
      const prevMode = this.mode;
      const prevEnd = this.until;
      this.plan(s, this.model, len, externalSeed);
      if (this.mode !== prevMode || (s >= prevEnd && this.mode !== 0)) this.splice();
    }

    const e = Math.max(Math.abs(inL), Math.abs(inR));
    this.fastIn += (e - this.fastIn) * (e > this.fastIn ? this.ka : this.kr);
    this.slowIn += (e - this.slowIn) * this.ks;
    if (this.refractoryIn > 0) this.refractoryIn--;
    else if (this.fastIn > this.slowIn * 1.45 + 0.0002 && this.fastIn > 0.0008) {
      this.refractoryIn = Math.floor(this.sr * 0.018);
      this.onsetPeak = Math.max(this.onsetPeak, this.fastIn);
      this.lastOnset = Math.max(0, this.frames - this.sr * 0.00075);
    }

    let off = 0;
    let g = 1;
    let silent = (this.mode === 2);
    if (this.mode === 1) {
      off = this.lag;
      g = IdmUnit.edge(this.t, this.window, this.sr * 0.0015);
    } else if (this.mode === 3) {
      const w = this.window / Math.max(1, this.count);
      const i = Math.min(this.count - 1, Math.floor(this.t / w));
      const f = this.count > 1 ? i / (this.count - 1) : 0;
      off = Math.max(0, this.frames - this.replayFrame - (this.t - i * w));
      g = (1 - 0.8 * (this.curve > 0 ? this.curve * f : -this.curve * (1 - f))) *
          IdmUnit.edge(this.t - i * w, w, this.sr * 0.001);
    } else if (this.mode === 4) {
      if (this.t >= this.gapFrom) {
        silent = true;
      } else {
        while (this.t - this.sliceAt >= this.slice) {
          this.sliceAt += this.slice;
          this.slice = Math.max(this.sr * 0.004, this.slice * this.accel);
          this.splice();
        }
        const pos = this.t - this.sliceAt;
        off = Math.max(0, this.frames - this.replayFrame - (this.reverse ? this.slice - 1 - pos : pos));
        g = IdmUnit.edge(pos, this.slice, this.sr * 0.001);
      }
    }

    this.gain += ((silent ? 0 : 1) - this.gain) * this.kg;
    const src = off <= 0 ? [inL, inR] : this.history.read(off);
    let yL = src[0];
    let yR = src[1];

    const es = Math.max(Math.abs(yL), Math.abs(yR)) * g;
    this.fast += (es - this.fast) * (es > this.fast ? this.ka : this.kr);
    this.slow += (es - this.slow) * this.ks;
    if (this.refractory > 0) this.refractory--;
    else if (this.fast > this.slow * 1.45 + 0.0002 && this.fast > 0.0008) {
      this.refractory = Math.floor(this.sr * 0.015);
      this.strike(len);
    }

    if (this.locked) {
      const body = clamp((this.age - this.sr * 0.004) / (this.sr * 0.005), 0, 1) *
                   clamp((this.bodyWindow - this.age) / (this.sr * 0.015), 0, 1);
      if (this.rate !== 1 && body > 0) {
        this.pitchPhase += (1 - this.rate) / this.span;
        this.pitchPhase -= Math.floor(this.pitchPhase);
        let ph = this.pitchPhase + 0.5;
        ph -= Math.floor(ph);
        const u0 = this.history.read(off + 8 + this.pitchPhase * this.span);
        const u1 = this.history.read(off + 8 + ph * this.span);
        const w = 0.5 - 0.5 * Math.cos(TAU * this.pitchPhase);
        const mix = body * this.lift;
        yL += (u0[0] * w + u1[0] * (1 - w) - yL) * mix;
        yR += (u0[1] * w + u1[1] * (1 - w) - yR) * mix;
      }
      this.env *= this.decay;
      const art = 1 - (1 - this.env) * body * 0.75;
      yL *= art;
      yR *= art;

      if (this.bright !== 0 && body > 0) {
        const hz = this.bright < 0 ? 16000 * Math.pow(0.03, -this.bright) : 30 * Math.pow(100, this.bright);
        const mix = Math.min(1, Math.abs(this.bright) * 1.5) * body;
        const bL = this.toneL.process(yL, hz, 0.707, this.sr);
        const bR = this.toneR.process(yR, hz, 0.707, this.sr);
        yL += ((this.bright < 0 ? bL.low : bL.high) - yL) * mix;
        yR += ((this.bright < 0 ? bR.low : bR.high) - yR) * mix;
      }
      if (++this.age >= this.bodyWindow) this.locked = false;
    }

    let wetL = yL * g * this.gain;
    let wetR = yR * g * this.gain;
    const exL = this.locked ? wetL * this.combMix : 0;
    const exR = this.locked ? wetR * this.combMix : 0;

    if (this.combPeriod > 0) {
      const at = (this.combCursor - this.combPeriod + 4096) % 4096;
      this.combDampL += (this.combL[at] - this.combDampL) * 0.5;
      this.combDampR += (this.combR[at] - this.combDampR) * 0.5;
      if (Math.abs(this.combDampL) < 1e-12) this.combDampL = 0;
      if (Math.abs(this.combDampR) < 1e-12) this.combDampR = 0;
      this.combL[this.combCursor] = fastTanh(exL + this.combDampL * this.combFb);
      this.combR[this.combCursor] = fastTanh(exR + this.combDampR * this.combFb);
      this.combCursor = (this.combCursor + 1) % 4096;
      wetL += this.combDampL * this.gain;
      wetR += this.combDampR * this.gain;
    }

    if (this.ghost > 0) {
      const ge = Math.min(1, this.since / (this.sr * 0.002)) * clamp(1 - this.since / len, 0, 1) * this.ghost;
      const gh = this.history.read(this.ghostLag);
      wetL += this.softL.process(gh[0], 5500, 0.7, this.sr).low * ge * this.gain * (1 - this.ghostPan);
      wetR += this.softR.process(gh[1], 5500, 0.7, this.sr).low * ge * this.gain * (1 + this.ghostPan);
    }

    if (this.transition < 1) {
      this.transition = Math.min(1, this.transition + 1 / (this.sr * 0.0015));
      wetL = this.transitionL + (wetL - this.transitionL) * this.transition;
      wetR = this.transitionR + (wetR - this.transitionR) * this.transition;
    }

    this.lastL = wetL;
    this.lastR = wetR;
    this.t++;
    this.since++;
    this.frames++;

    const scale = clamp(idmWetGain, 0, 1.3);
    return [wetL * scale, wetR * scale];
  }
}

// ---------------------------------------------------------------------------
// UNSTABLE SIGNAL PATH
// ---------------------------------------------------------------------------
class UnstablePath {
  constructor(sr) {
    this.sr = sr;
    this.mangleBuf = new StereoHistory(Math.ceil(sr * 2));
    this.fbBufL = new Float32Array(Math.ceil(sr * 1.5));
    this.fbBufR = new Float32Array(Math.ceil(sr * 1.5));
    this.fbCursor = 0;

    this.carPhase = 0;
    this.car2Phase = 0;
    this.car3Phase = 0;
    this.modPhase = 0;
    this.subPhase = 0;
    this.pulsePhase = 0;
    this.lfo1Phase = 0;
    this.lfo2Phase = 0;
    this.pulseEnv = 0;
    this.pulseHz = 220;
    this.lfsr = 0xace1;
    this.noiseRng = 0x6d2b79f5;
    this.brownL = 0;
    this.brownR = 0;
    this.gateEnv = 1.0;
    this.lastStep = -1;

    this.manglePhase = 0;
    this.holdCounter = 0;
    this.heldL = 0;
    this.heldR = 0;
    this.slewL = 0;
    this.slewR = 0;

    this.fbLpL = new SVF();
    this.fbLpR = new SVF();
    this.svfA = new SVF();
    this.svfB = new SVF();
    this.svfC = new SVF();
    this.svfPadL = new SVF();
    this.svfPadR = new SVF();
    this.svfPadFormantA = new SVF();
    this.svfPadFormantB = new SVF();
    this.dcL = new DCBlock();
    this.dcR = new DCBlock();
    this.fbPrevL = 0;
    this.fbPrevR = 0;

    // Haecceity Ambient/Pad engine state (4-voice chord + damped comb resonator + tape warp)
    this.padPhasesA = new Float64Array(4);
    this.padPhasesB = new Float64Array(4);
    this.padSubPhases = new Float64Array(4);
    this.padWarpPhase = 0;
    this.padLfoPhase = 0;
    this.padCombL = new Float32Array(8192);
    this.padCombR = new Float32Array(8192);
    this.padCombInL = new Float32Array(8192);
    this.padCombInR = new Float32Array(8192);
    this.padCombCur = 0;
    this.padRootOffset = 0;
    this.padTargetOffset = 0;
    this.padBowlPhase = 0;
    this.microEnv = 0;
    this.microHz = 880;
    this.microPan = 0;
    this.acidPhase = 0;
    this.acidSvf = new SVF();

    this.chaos = {
      textureMode: 0,
      donorTextureMode: 0,
      crossMix: 0,
      darkInterval: 1.4983,
      routingIndex: 0,
      shaperModeIndex: 1,
      bitDepth: 8,
      srDivider: 4,
      xorMask: 0x09,
      droneBaseHz: 55,
      fmRatio: 1.4142,
      subInterval: 0.5,
      lfsrMask: 0xb400,
      pulseEuclidK: 5,
      pulseEuclidN: 16,
      mangleSliceMs: 42,
      mangleRevProb: 0.4,
      fbDelayLMs: 65,
      fbDelayRMs: 89,
      fbPolarity: 1,
      ambientPreset: {
        name: 'Lustmord Deep Trench',
        rootMidi: 38,
        chord: [0, 7, 10, 15],
        prog: [0, 1, 0, -2],
        shape: 0.14,
        pulseMix: 0.08,
        pw: 0.5,
        subMix: 0.55,
        cutoff: 540,
        res: 0.16,
        detune: 11,
        lfoRate: 0.032,
        warpDepth: 0.7,
        padDelayMs: 36,
        padFeedback: 0.58,
        padWet: 0.42,
        vowel: 3,
        vowelAlt: 4,
        noise: 0.024,
        drive: 0.28,
        metalMix: 0.28,
        bowlRatio: 1.498,
        subGrind: 0.35,
      },
    };

    this.params = {
      enabled: 1,
      sceneBoost: 1.0,
      droneLevel: 0.42,
      pulseLevel: 0.55,
      fmIndex: 0.42,
      mangleMix: 0.58,
      shaperDrive: 0.48,
      fbGain: 0.68,
      fbDampHz: 4200,
      scDepth: 0.82,
      scMode: 0,
      padX: 0.35,
      padY: 0.45,
    };
  }

  applyChaos(dsp) {
    Object.assign(this.chaos, dsp);
  }

  applyParams(obj) {
    Object.assign(this.params, obj);
  }

  stepLfsr() {
    const lsb = this.lfsr & 1;
    this.lfsr >>>= 1;
    if (lsb) this.lfsr ^= (this.chaos.lfsrMask & 0xffff) | 0x8001;
    if (this.lfsr === 0) this.lfsr = 0xace1;
    return (this.lfsr & 0xffff) / 65535.0;
  }

  nextNoise() {
    this.noiseRng = (Math.imul(this.noiseRng, 1664525) + 1013904223) >>> 0;
    return (this.noiseRng / 2147483648.0) - 1.0;
  }

  runShaper(x, mode, drive, padY) {
    const d = 1.0 + drive * 10.0 + padY * 6.0;
    if (mode === 0) return fastTanh((x + 0.18) * d) - fastTanh(0.18 * d);
    if (mode === 1) return Math.sin(clamp(x * d * 0.9, -12, 12));
    if (mode === 2) {
      const v = x * d;
      return clamp(v > 0 ? v : v * 0.6, -0.95, 0.95);
    }
    if (mode === 3) {
      const q = Math.round(clamp(x, -1, 1) * 127);
      const mask = Math.floor((this.chaos.xorMask & 0x1f) * (0.3 + padY * 1.4));
      return fastTanh(((((q + 128) ^ mask) - 128) / 127.0) * (1 + drive * 2.5));
    }
    const v = x * d * 0.7;
    return fastTanh(v - 0.28 * v * v * v);
  }

  runMangler(inL, inR, srDiv, bits, sliceMs, revProb, padX, stepIdx) {
    this.mangleBuf.write(inL, inR);
    const div = Math.max(1, Math.round(srDiv * (0.35 + padX * 1.65)));
    if (this.holdCounter++ >= div) {
      this.holdCounter = 0;
      const sliceSamples = clamp(Math.round((sliceMs * (1.2 - padX * 0.85) / 1000) * this.sr), 64, this.sr * 0.6);
      const isReverse = ((stepIdx * 7 + this.chaos.xorMask) % 100) / 100 < revProb * (0.4 + padX * 0.9);

      this.manglePhase = (this.manglePhase + div) % sliceSamples;
      const readOff = isReverse ? (sliceSamples - this.manglePhase) : this.manglePhase;
      const bufRead = this.mangleBuf.read(readOff + 32);

      const effBits = clamp(Math.round(bits - padX * 3), 3, 16);
      const levels = Math.pow(2, effBits - 1);
      const preGain = 2.5;
      const qL = Math.round(clamp(bufRead[0] * preGain, -1, 1) * levels) / (levels * preGain);
      const qR = Math.round(clamp(bufRead[1] * preGain, -1, 1) * levels) / (levels * preGain);

      const mix = clamp(this.params.mangleMix * (0.35 + padX * 0.85), 0, 0.88);
      this.heldL = inL + (qL - inL) * mix;
      this.heldR = inR + (qR - inR) * mix;
    }

    if (this.chaos.shaperModeIndex === 4) {
      const slew = 0.04 + (1 - padX) * 0.45;
      this.slewL += clamp(this.heldL - this.slewL, -slew, slew);
      this.slewR += clamp(this.heldR - this.slewR, -slew, slew);
      return [this.slewL, this.slewR];
    }
    return [this.heldL, this.heldR];
  }

  processHaecceityPad(stepIdx, p, pitchTranspose = 0) {
    const pr = this.chaos.ambientPreset || {};
    const padX = clamp(p.padX ?? 0.5, 0, 1);
    const padY = clamp(p.padY ?? 0.5, 0, 1);
    const chord = pr.chord || [0, 7, 10, 15];
    const prog = pr.prog || [0, 1, 0, -2];
    const progStep = Math.floor(Math.max(0, stepIdx) / 16) % prog.length;
    this.padTargetOffset = prog[progStep] || 0;
    this.padRootOffset += (this.padTargetOffset - this.padRootOffset) * 0.00024;

    const lfoRate = (pr.lfoRate || 0.038) * (0.6 + padX * 1.6);
    this.padLfoPhase = (this.padLfoPhase + lfoRate / this.sr) % 1;
    this.padWarpPhase = (this.padWarpPhase + (0.025 + padX * 0.065) / this.sr) % 1;
    const lfo = Math.sin(TAU * this.padLfoPhase);
    const warp = Math.sin(TAU * this.padWarpPhase) * ((pr.warpDepth || 0.8) * (0.4 + padX * 1.4)) * 0.0038;

    // X/Y sweeps transpose upper voicing, detune spread, waveshape, sub-grind & bowl harmonics
    const rootMidi = (pr.rootMidi || 38) + pitchTranspose + this.padRootOffset;
    const detuneCents = (pr.detune || 12) * (0.45 + padX * 1.85);
    const shape = clamp((pr.shape ?? 0.22) + (padY - 0.3) * 0.55, 0, 0.92);
    const pulseMix = clamp((pr.pulseMix ?? 0.2) + padX * 0.32, 0, 0.78);
    const pw = clamp((pr.pw ?? 0.45) + lfo * 0.12 + (padX - 0.5) * 0.22, 0.18, 0.82);
    const subMix = clamp((pr.subMix ?? 0.45) + (1 - padX * 0.4) * 0.25 + padY * 0.25, 0.1, 0.85);
    const subGrind = (pr.subGrind ?? 0.32) * (0.2 + padY * 1.6);
    const bowlRatio = pr.bowlRatio || 1.498;
    const metalMix = (pr.metalMix ?? 0.3) * (0.15 + padX * 1.45);

    this.padBowlPhase = (this.padBowlPhase + (440 * Math.pow(2, (rootMidi - 69) / 12) * bowlRatio) / this.sr) % 1;
    const bowlMod = Math.sin(TAU * this.padBowlPhase) * metalMix * 1.4;

    let sumL = 0;
    let sumR = 0;
    const voiceCount = Math.min(4, chord.length);
    for (let v = 0; v < voiceCount; v++) {
      // Top voices open up into octave shimmer / fifth drift as X sweeps right
      const octaveLift = (v >= 2 && padX > 0.55) ? Math.round((padX - 0.55) * 2.2) * 12 : 0;
      const semi = rootMidi + chord[v] + octaveLift;
      const hz = clamp(440 * Math.pow(2, (semi - 69) / 12) * (1 + warp), 24, 2200);
      const det = Math.pow(2, (((v & 1 ? 1 : -1) * detuneCents * (0.6 + 0.4 * v)) / 1200));
      const hzA = hz;
      const hzB = hz * det;

      const phA = (this.padPhasesA[v] = (this.padPhasesA[v] + hzA / this.sr) % 1);
      const phB = (this.padPhasesB[v] = (this.padPhasesB[v] + hzB / this.sr) % 1);
      const phSub = (this.padSubPhases[v] = (this.padSubPhases[v] + (hz * 0.5) / this.sr) % 1);

      const sawA = 2 * phA - 1;
      const sawB = 2 * phB - 1;
      const sinA = Math.sin(TAU * phA + bowlMod * (v > 0 ? 1.0 : 0.25));
      const sinB = Math.sin(TAU * phB - bowlMod * (v > 0 ? 1.0 : 0.25));
      const oscA = sinA * (1 - shape) + sawA * shape;
      const oscB = sinB * (1 - shape) + sawB * shape;
      const sqA = phA < pw ? 0.7 : -0.7;
      const sqB = phB < (1 - pw) ? 0.7 : -0.7;
      const sub = Math.sin(TAU * phSub + subGrind * Math.sin(TAU * phA)) * subMix;

      const voiceWeight = v === 0 ? 1.05 : v === 1 ? 0.85 : (0.45 + padX * 0.55);
      const voiceA = (oscA + sqA * pulseMix + sub) * voiceWeight;
      const voiceB = (oscB + sqB * pulseMix + sub) * voiceWeight;
      const pan = voiceCount <= 1 ? 0.5 : v / (voiceCount - 1);
      sumL += voiceA * (1 - pan * 0.48) + voiceB * (0.22 + pan * 0.38);
      sumR += voiceB * (0.52 + pan * 0.48) + voiceA * (0.58 - pan * 0.32);
    }
    const norm = 0.55 / Math.max(1, voiceCount);
    let srcL = sumL * norm;
    let srcR = sumR * norm;

    const air = (pr.noise || 0.018) * (0.35 + padY * 1.9);
    if (air > 0) {
      const nA = this.nextNoise();
      const nB = this.nextNoise();
      // Shortwave ring-modulated frost / geiger texture blooms on high X*Y
      const radioRing = 1.0 + padX * padY * 2.2 * Math.sin(TAU * this.padBowlPhase * 1.7);
      srcL += nA * air * radioRing;
      srcR += nB * air * radioRing;
    }

    // Damped comb resonator swept dynamically by X (metallic cavity / reverse-room size)
    const dynDelayMs = clamp((pr.padDelayMs || 28) * (0.55 + padX * 1.65) + lfo * (2.2 + padX * 5.5), 4, 150);
    const delaySamples = clamp(dynDelayMs * this.sr * 0.001, 4, 8190);
    let readIdx = this.padCombCur - delaySamples;
    if (readIdx < 0) readIdx += 8192;
    const i0 = Math.floor(readIdx) % 8192;
    const i1 = (i0 + 1) % 8192;
    const frac = readIdx - Math.floor(readIdx);

    const delL = this.padCombL[i0] * (1 - frac) + this.padCombL[i1] * frac;
    const delR = this.padCombR[i0] * (1 - frac) + this.padCombR[i1] * frac;
    const inDelL = this.padCombInL[i0] * (1 - frac) + this.padCombInL[i1] * frac;
    const inDelR = this.padCombInR[i0] * (1 - frac) + this.padCombInR[i1] * frac;
    const pFb = clamp((pr.padFeedback ?? 0.5) * (0.72 + padX * 0.42), 0, 0.78);
    const combL = 0.35 * srcL + 0.15 * inDelL + pFb * delL;
    const combR = 0.35 * srcR + 0.15 * inDelR + pFb * delR;

    this.padCombInL[this.padCombCur] = srcL;
    this.padCombInR[this.padCombCur] = srcR;
    this.padCombL[this.padCombCur] = clamp(combL, -4, 4);
    this.padCombR[this.padCombCur] = clamp(combR, -4, 4);
    this.padCombCur = (this.padCombCur + 1) % 8192;

    const pWet = clamp((pr.padWet ?? 0.36) * (0.55 + padX * 0.95), 0, 0.72);
    srcL += combL * pWet;
    srcR += combR * pWet;

    // Formant choir veil: morphs between vowel and vowelAlt as X sweeps
    const vA = typeof pr.vowel === 'number' && pr.vowel >= 0 ? pr.vowel : 4;
    const vB = typeof pr.vowelAlt === 'number' && pr.vowelAlt >= 0 ? pr.vowelAlt : 7;
    const fTabA = VOWEL_FORMANTS[clamp(vA | 0, 0, VOWEL_FORMANTS.length - 1)];
    const fTabB = VOWEL_FORMANTS[clamp(vB | 0, 0, VOWEL_FORMANTS.length - 1)];
    const f1Hz = fTabA[0] + (fTabB[0] - fTabA[0]) * padX;
    const f2Hz = fTabA[1] + (fTabB[1] - fTabA[1]) * padX;
    const f1 = this.svfPadFormantA.process(srcL, f1Hz, 2.8 + padY * 1.4, this.sr).band;
    const f2 = this.svfPadFormantB.process(srcR, f2Hz, 3.0 + padX * 1.6, this.sr).band;
    const choirMix = clamp(0.18 + padX * 0.42, 0, 0.62);
    srcL = srcL * (1 - choirMix * 0.45) + f1 * choirMix;
    srcR = srcR * (1 - choirMix * 0.45) + f2 * choirMix;

    const baseCutoff = pr.cutoff || 1100;
    const cut = clamp(baseCutoff * Math.pow(2, lfo * 0.55 + (padY - 0.4) * 2.4 + (padX - 0.5) * 0.65), 110, 5600);
    const q = clamp(0.75 + (pr.res || 0.18) * (1.8 + padY * 2.8), 0.7, 3.2);
    const fL = this.svfPadL.process(srcL, cut, q, this.sr).low;
    const fR = this.svfPadR.process(srcR, cut, q, this.sr).low;

    const drv = 1.15 + (pr.drive || 0.28) * (1.4 + padY * 2.8);
    return [fastTanh(fL * drv), fastTanh(fR * drv)];
  }

  renderTexture(texMode, stepIdx, isNewStep, lfsrVal, p, c, baseHz, modOut, fmAmt, fbReadL, fbReadR) {
    if (texMode === 1) {
      // DEATH INDUSTRIAL: dark Haecceity organ/string bed (-12st) + bowed/scraped iron + tectonic sub
      const [padL, padR] = this.processHaecceityPad(stepIdx, p, -12);
      this.lfo1Phase = (this.lfo1Phase + (0.07 + p.padX * 0.25) / this.sr) % 1;
      const lfo1 = 0.5 + 0.5 * Math.sin(TAU * this.lfo1Phase);
      this.car2Phase = (this.car2Phase + (baseHz * 1.4142) / this.sr) % 1;
      const nL = this.nextNoise();
      const nR = this.nextNoise();
      this.brownL = clamp(this.brownL * 0.992 + nL * 0.09, -1, 1);
      this.brownR = clamp(this.brownR * 0.992 + nR * 0.09, -1, 1);

      const subCrush = Math.sin(TAU * this.carPhase + modOut * (0.45 + p.fmIndex * 1.8)) * 0.55 +
                       Math.sin(TAU * this.car2Phase) * 0.30 +
                       Math.sin(TAU * this.subPhase) * 0.42;
      const rumble = this.svfA.process(this.brownL * 1.5 + subCrush * 0.75, 90 + p.padY * 320 + lfo1 * 110, 1.8, this.sr).low;
      const scrape = this.svfB.process(subCrush * modOut + nR * 0.45, 220 + p.padX * 780 + lfo1 * 220, 2.4 + p.padY * 1.2, this.sr).band * 0.95;

      return [
        (padL * 0.62 + rumble * 0.65 + scrape * 0.50) * p.droneLevel,
        (padR * 0.62 + rumble * 0.60 - scrape * 0.46 + this.brownR * 0.32) * p.droneLevel,
      ];
    }
    if (texMode === 2) {
      // DARK AMBIENT (Lustmord/Atrium Carceri/Raison d'Etre/Koner/Biosphere/Illbient):
      // Rich XY variation across choir/organ pad, abyssal FM sub, bowed metal & geiger wind
      const [padL, padR] = this.processHaecceityPad(stepIdx, p, 0);
      const nL = this.nextNoise();
      const nR = this.nextNoise();
      this.brownL = clamp(this.brownL * 0.994 + nL * 0.055, -1, 1);
      this.brownR = clamp(this.brownR * 0.994 + nR * 0.055, -1, 1);
      const windL = this.svfA.process(this.brownL * 1.5 + fbReadL * 0.22 * p.padX, 140 + p.padY * 980, 1.4 + p.padX * 1.6, this.sr).band * (0.35 + p.padX * 0.45);
      const windR = this.svfB.process(this.brownR * 1.5 + fbReadR * 0.22 * p.padX, 190 + p.padX * 1120, 1.4 + p.padY * 1.6, this.sr).band * (0.35 + p.padY * 0.45);
      const abyssSub = Math.sin(TAU * this.subPhase + modOut * (0.2 + p.padY * 1.4)) * (0.28 + p.padY * 0.36);
      const bowMetal = Math.sin(TAU * this.carPhase * (c.darkInterval || 1.498) + modOut * (0.6 + p.padX * 1.8)) * (0.12 + p.padX * 0.32);
      return [
        (padL * 0.92 + windL + abyssSub + bowMetal) * p.droneLevel,
        (padR * 0.92 + windR + abyssSub - bowMetal * 0.85) * p.droneLevel,
      ];
    }
    if (texMode === 3) {
      // POWER ELECTRONICS: brutal low-mid analog feedback grunt + diode wall + sub weight
      const gateRate = 0.6 + p.padX * 11.0;
      this.lfo1Phase = (this.lfo1Phase + (0.16 + p.padY * 1.6) / this.sr) % 1;
      this.lfo2Phase = (this.lfo2Phase + gateRate / this.sr) % 1;
      const lfo1 = Math.sin(TAU * this.lfo1Phase);
      const lfo2 = Math.sin(TAU * this.lfo2Phase);

      const nL = this.nextNoise();
      const nR = this.nextNoise();
      const ringN = nL * modOut;
      const f1Hz = clamp(180 + p.padX * 920 + lfo1 * 260, 90, 1450);
      const f2Hz = clamp(140 + p.padY * 780 - lfo1 * 220, 80, 1250);

      const s1 = this.svfA.process(nL * 0.65 + ringN * 0.55 + fbReadL * 0.35, f1Hz, 2.2 + p.padY * 1.8, this.sr);
      const s2 = this.svfB.process(nR * 0.65 + s1.band * 0.45 + fbReadR * 0.35, f2Hz, 2.0 + p.padX * 1.8, this.sr);
      const subPush = Math.sin(TAU * this.subPhase) * 0.62 + Math.sin(TAU * this.carPhase + modOut * 2.4) * 0.52;

      const chopThresh = -0.75 + p.padX * 1.15 - p.padY * 0.55;
      const targetGate = lfo2 > chopThresh ? 1.0 : (0.24 + p.padY * 0.55);
      this.gateEnv += (targetGate - this.gateEnv) * 0.014;

      return [
        (s1.band * 0.85 + s1.low * 0.45 + subPush * 0.82 + ringN * 0.40) * this.gateEnv * p.droneLevel,
        (s2.band * 0.85 + s2.low * 0.45 + subPush * 0.78 - ringN * 0.40) * this.gateEnv * p.droneLevel,
      ];
    }
    if (texMode === 4) {
      // DIGITAL HARDCORE: overdriven diode 303 acid saw/square + sub-riot bass + scream FM
      if (isNewStep && (stepIdx % 2 === 0 || lfsrVal > 0.55)) {
        const oct = lfsrVal > 0.78 ? 2 : lfsrVal > 0.42 ? 1.5 : 1;
        this.microHz = clamp(baseHz * oct, 36, 520);
      }
      this.acidPhase = (this.acidPhase + this.microHz / this.sr) % 1;
      const saw = 2 * this.acidPhase - 1;
      const sq = this.acidPhase < (0.25 + p.padX * 0.45) ? 0.9 : -0.9;
      const raw303 = saw * 0.65 + sq * 0.45 + Math.sin(TAU * this.subPhase) * 0.55;
      const acidCut = clamp(240 + p.padX * 2600 + p.padY * 1800, 140, 4800);
      const acidFilt = this.acidSvf.process(raw303, acidCut, 2.2 + p.padY * 3.4, this.sr);
      const scream = fastTanh((acidFilt.low * 1.6 + acidFilt.band * (0.9 + p.padY)) * (1.8 + p.shaperDrive * 3.2));
      return [scream * p.droneLevel * 0.9, (scream * 0.86 + Math.sin(TAU * this.carPhase + modOut * fmAmt) * 0.25) * p.droneLevel];
    }
    if (texMode === 5) {
      // MICROSOUND / LOWERCASE: zero-crossing sine impulse blips, contact-mic dust & glass shimmer
      if (isNewStep && euclidHit(stepIdx, Math.max(2, c.pulseEuclidK), Math.max(8, c.pulseEuclidN))) {
        this.microEnv = 0.65 + lfsrVal * 0.35;
        this.microHz = clamp(baseHz * [1, 2, 4, 6, 8, 12, 16, 24][Math.floor(lfsrVal * 8)], 40, 4200);
        this.microPan = (lfsrVal * 2 - 1) * 0.75;
      }
      this.microEnv *= Math.exp(-1 / (this.sr * (0.018 + p.padY * 0.09)));
      this.acidPhase = (this.acidPhase + this.microHz / this.sr) % 1;
      const blip = Math.sin(TAU * this.acidPhase) * this.microEnv;
      const [padL, padR] = this.processHaecceityPad(stepIdx, p, 0);
      const contact = this.svfC.process(this.nextNoise(), 1200 + p.padX * 5200, 2.8, this.sr).band * (0.14 + p.padY * 0.24);
      const subPoint = Math.sin(TAU * this.subPhase) * (0.28 + (1 - p.padX) * 0.22);
      return [
        (blip * (1 - this.microPan * 0.45) * 0.75 + padL * 0.45 + contact + subPoint) * p.droneLevel,
        (blip * (1 + this.microPan * 0.45) * 0.75 + padR * 0.45 - contact * 0.8 + subPoint) * p.droneLevel,
      ];
    }
    if (texMode === 6) {
      // FLASHCORE / DECONSTRUCTION: comb-filtered reese/chug + Rhodes/Wurli pad ghosts + FM quark bursts
      const [padL, padR] = this.processHaecceityPad(stepIdx, p, 0);
      this.car2Phase = (this.car2Phase + (baseHz * 1.008) / this.sr) % 1;
      const reese = (2 * this.carPhase - 1) * 0.45 + (2 * this.car2Phase - 1) * 0.45 + Math.sin(TAU * this.subPhase) * 0.55;
      const reeseCut = clamp(180 + p.padX * 1600 + p.padY * 1400, 120, 3800);
      const fReese = this.acidSvf.process(reese, reeseCut, 1.8 + p.padY * 2.2, this.sr).low;
      const quark = Math.sin(TAU * this.carPhase + modOut * (fmAmt * 1.15)) * (0.25 + p.padX * 0.35);
      return [
        (fReese * 0.72 + quark + padL * 0.48) * p.droneLevel,
        (fReese * 0.68 - quark * 0.8 + padR * 0.48) * p.droneLevel,
      ];
    }
    // 0: ALGORITHMIC DRONE + HARMONICS + SUBTLE HAECCEITY PAD BED
    const [padL, padR] = this.processHaecceityPad(stepIdx, p, 0);
    this.lfo1Phase = (this.lfo1Phase + 0.09 / this.sr) % 1;
    this.car2Phase = (this.car2Phase + (baseHz * 2.003) / this.sr) % 1;
    const fmSig = Math.sin(TAU * this.carPhase + modOut * fmAmt);
    const octHarm = Math.sin(TAU * this.car2Phase + modOut * (fmAmt * 0.45)) * 0.38;
    const subSig = Math.sin(TAU * this.subPhase) * 0.35;
    const drone = (fmSig * 0.55 + octHarm + subSig) * p.droneLevel;
    return [drone + padL * 0.36, drone * 0.92 + padR * 0.36];
  }

  process(stepIdx, kickEnv) {
    if (this.params.enabled < 0.5) return [0, 0];
    const c = this.chaos;
    const p = this.params;

    let isNewStep = false;
    let lfsrVal = 0.5;
    if (stepIdx !== this.lastStep) {
      this.lastStep = stepIdx;
      isNewStep = true;
      lfsrVal = this.stepLfsr();
    }

    const fbCrossMod = c.routingIndex === 2 ? this.fbPrevL * 0.9 : 0;
    const lfsrPitchDrift = 1.0 + ((this.lfsr & 0x0f) / 15.0 - 0.5) * 0.025;
    const baseHz = clamp(Number.isFinite(c.droneBaseHz) ? c.droneBaseHz : 65.41, 24, 440) * lfsrPitchDrift;
    const fmRatioSafe = Number.isFinite(c.fmRatio) ? c.fmRatio : 1.4142;
    const subIntSafe = Number.isFinite(c.subInterval) ? c.subInterval : 0.5;
    const modHz = baseHz * fmRatioSafe;
    const texMode = c.textureMode | 0;
    const donorTexMode = (c.donorTextureMode ?? texMode) | 0;
    const crossMix = clamp(c.crossMix ?? 0, 0, 1);
    const boost = p.sceneBoost || 1.0;

    this.modPhase = (this.modPhase + modHz / this.sr) % 1;
    const modOut = Math.sin(TAU * this.modPhase);
    const fmAmt = (0.3 + p.fmIndex * 3.8 + p.padY * 1.8) * (1 + fbCrossMod);

    this.carPhase = (this.carPhase + baseHz / this.sr) % 1;
    this.subPhase = (this.subPhase + (baseHz * subIntSafe) / this.sr) % 1;

    const fbLen = this.fbBufL.length;
    const dL = clamp(Math.round((c.fbDelayLMs / 1000) * this.sr), 16, fbLen - 2);
    const dR = clamp(Math.round((c.fbDelayRMs / 1000) * this.sr), 16, fbLen - 2);
    const fbReadL = this.fbBufL[(this.fbCursor - dL + fbLen) % fbLen];
    const fbReadR = this.fbBufR[(this.fbCursor - dR + fbLen) % fbLen];

    let [genL, genR] = this.renderTexture(texMode, stepIdx, isNewStep, lfsrVal, p, c, baseHz, modOut, fmAmt, fbReadL, fbReadR);
    if (crossMix > 0.03 && donorTexMode !== texMode) {
      const [donL, donR] = this.renderTexture(donorTexMode, stepIdx, isNewStep, lfsrVal, p, c, baseHz, modOut, fmAmt, fbReadL, fbReadR);
      genL = genL * (1 - crossMix) + donL * crossMix;
      genR = genR * (1 - crossMix) + donR * crossMix;
    }

    const scGain = p.scMode === 2
      ? clamp(kickEnv * p.scDepth * 1.8, 0.05, 1)
      : clamp(1.0 - kickEnv * p.scDepth, 0.03, 1);

    let preFbL = genL;
    let preFbR = genR;

    if (texMode === 2 && crossMix < 0.35 && p.mangleMix < 0.16 && p.padY < 0.48) {
      // Dark ambient lower quadrant: smooth warm saturation + deep reverb wash
      const ambDrive = 1.2 + p.shaperDrive * 1.8;
      preFbL = fastTanh(preFbL * ambDrive);
      preFbR = fastTanh(preFbR * ambDrive);
    } else if (c.routingIndex === 0 || c.routingIndex === 2) {
      [preFbL, preFbR] = this.runMangler(preFbL, preFbR, c.srDivider, c.bitDepth, c.mangleSliceMs, c.mangleRevProb, p.padX, stepIdx);
      preFbL = this.runShaper(preFbL, c.shaperModeIndex, p.shaperDrive, p.padY);
      preFbR = this.runShaper(preFbR, c.shaperModeIndex, p.shaperDrive, p.padY);
    } else if (c.routingIndex === 1 || c.routingIndex === 4) {
      const inL = c.routingIndex === 4 ? preFbL + fbReadR * 0.35 : preFbL;
      const inR = c.routingIndex === 4 ? preFbR + fbReadL * 0.35 : preFbR;
      preFbL = this.runShaper(inL, c.shaperModeIndex, p.shaperDrive, p.padY);
      preFbR = this.runShaper(inR, c.shaperModeIndex, p.shaperDrive, p.padY);
      [preFbL, preFbR] = this.runMangler(preFbL, preFbR, c.srDivider, c.bitDepth, c.mangleSliceMs, c.mangleRevProb, p.padX, stepIdx);
    } else if (c.routingIndex === 3) {
      const [mL, mR] = this.runMangler(preFbL, preFbR, c.srDivider, c.bitDepth, c.mangleSliceMs, c.mangleRevProb, p.padX, stepIdx);
      const sL = this.runShaper(preFbL, c.shaperModeIndex, p.shaperDrive, p.padY);
      const sR = this.runShaper(preFbR, c.shaperModeIndex, p.shaperDrive, p.padY);
      preFbL = 0.5 * (mL + sL);
      preFbR = 0.5 * (mR + sR);
    } else if (c.routingIndex === 5) {
      preFbL = genL * (0.4 + fbReadL * 1.4);
      preFbR = genR * (0.4 + fbReadR * 1.4);
      [preFbL, preFbR] = this.runMangler(preFbL, preFbR, c.srDivider, c.bitDepth, c.mangleSliceMs, c.mangleRevProb, p.padX, stepIdx);
      preFbL = this.runShaper(preFbL, c.shaperModeIndex, p.shaperDrive, p.padY);
      preFbR = this.runShaper(preFbR, c.shaperModeIndex, p.shaperDrive, p.padY);
    } else {
      const [mL, mR] = this.runMangler(preFbL + fbReadL * 0.25, preFbR + fbReadR * 0.25, c.srDivider, c.bitDepth, c.mangleSliceMs, c.mangleRevProb, p.padX, stepIdx);
      preFbL = this.runShaper(mL, c.shaperModeIndex, p.shaperDrive, p.padY);
      preFbR = this.runShaper(mR, c.shaperModeIndex, p.shaperDrive, p.padY);
    }

    if (p.scMode === 1) {
      preFbL *= scGain;
      preFbR *= scGain;
    }

    const fbAmt = clamp(p.fbGain + p.padY * 0.14 + (p.scMode === 3 ? kickEnv * 0.15 : 0), 0, texMode >= 1 ? 0.78 : 0.84);
    let tapReadL = fbReadL;
    let tapReadR = fbReadR;
    if (texMode === 2) {
      // Extra cavernous stereo taps for dark ambient wash
      const dL2 = clamp(Math.round(dL * 0.618), 16, fbLen - 2);
      const dR2 = clamp(Math.round(dR * 0.732), 16, fbLen - 2);
      tapReadL = fbReadL * 0.65 + this.fbBufR[(this.fbCursor - dL2 + fbLen) % fbLen] * 0.35;
      tapReadR = fbReadR * 0.65 + this.fbBufL[(this.fbCursor - dR2 + fbLen) % fbLen] * 0.35;
    }
    const fL = this.fbLpL.process(tapReadL, p.fbDampHz, 0.75, this.sr).low;
    const fR = this.fbLpR.process(tapReadR, p.fbDampHz, 0.75, this.sr).low;

    const pol = c.fbPolarity;
    const nextFbL = fastTanh(this.dcL.process(preFbL * 0.55 + (fL * 0.65 + fR * 0.35 * pol) * fbAmt));
    const nextFbR = fastTanh(this.dcR.process(preFbR * 0.55 + (fR * 0.65 + fL * 0.35 * pol) * fbAmt));

    this.fbBufL[this.fbCursor] = nextFbL;
    this.fbBufR[this.fbCursor] = nextFbR;
    this.fbCursor = (this.fbCursor + 1) % fbLen;
    this.fbPrevL = nextFbL;
    this.fbPrevR = nextFbR;

    let outL = (preFbL * 0.55 + nextFbL * 0.62) * boost;
    let outR = (preFbR * 0.55 + nextFbR * 0.62) * boost;
    if (p.scMode !== 1) {
      outL *= scGain;
      outR *= scGain;
    }
    return [fastTanh(outL * 0.95), fastTanh(outR * 0.95)];
  }
}

// ---------------------------------------------------------------------------
// MUMBLESPEAK FORMANT VOICE (Ported from native engine.hpp formant_voice)
// ---------------------------------------------------------------------------
const VOWEL_FORMANTS = [
  [730, 1090, 2440, 3400], // a
  [530, 1840, 2480, 3500], // e
  [270, 2290, 3010, 3700], // i
  [570,  840, 2410, 3400], // o
  [300,  870, 2240, 3300], // u
  [610, 1700, 2500, 3500], // ɛ
  [640,  920, 2400, 3400], // ɔ
  [500, 1500, 2500, 3500], // ə
  [660, 1720, 2410, 3400], // æ
  [440, 1020, 2240, 3300], // ʊ
];
const NASAL_FORMANTS = [250, 1000, 2300, 3300];
const LIQUID_FORMANTS = [360, 1300, 2700, 3400];

class MumbleVoice {
  constructor(sr) {
    this.sr = sr;
    this.phonemes = [];
    this.cursor = 0;
    this.phonemeAgeMs = 0;
    this.active = false;
    this.speaking = false;
    this.phase = 0;
    this.age = 0;
    this.glottis = 0;
    this.voicePitch = 0;
    this.voiceAmp = 0;
    this.hiss = 0;
    this.rng = 0x7711aa33;
    this.formants = [new SVF(), new SVF(), new SVF(), new SVF()];
    this.formantHz = [500, 1500, 2500, 3500];
    this.revBank = [new Float32Array(2048), new Float32Array(2048)];
    this.revCur = 0;
    this.revWriteBank = 0;
    this.revReady = false;
    this.dc = new DCBlock();

    this.baseHz = 135;
    this.params = {
      pitchShift: 0,
      speedScale: 1.0,
      vocalSize: 1.0,
      fragment: 0.2,
      reverseMix: 0.15,
      roughness: 0.25,
      carrierRing: 0.1,
    };

    this.currentText = '';
    this.currentVowel = 0;
    this.currentConsonant = 0;
    this.envelopeOut = 0;
  }

  setPhrase(phonemes) {
    this.phonemes = Array.isArray(phonemes) ? phonemes : [];
    this.cursor = 0;
    this.phonemeAgeMs = 0;
    this.active = this.phonemes.length > 0;
    if (!this.active) {
      this.currentText = '';
      this.speaking = false;
      this.voiceAmp = 0;
    }
  }

  applyParams(obj) {
    Object.assign(this.params, obj);
  }

  triggerRhythmicStep(_stepIdx) {
    if (!this.active || this.phonemes.length === 0) return;
    let safety = 0;
    while (safety++ < this.phonemes.length) {
      const ph = this.phonemes[this.cursor];
      if (ph.consonant !== 5) {
        this.speaking = true;
        this.phonemeAgeMs = 0;
        this.currentText = ph.text || '';
        this.currentVowel = ph.vowel;
        this.currentConsonant = ph.consonant;
        this.cursor = (this.cursor + 1) % this.phonemes.length;
        return;
      }
      this.cursor = (this.cursor + 1) % this.phonemes.length;
    }
  }

  nextNoise() {
    this.rng = (Math.imul(this.rng, 1664525) + 1013904223) >>> 0;
    return (this.rng / 2147483648.0) - 1.0;
  }

  process() {
    if (!this.active || this.phonemes.length === 0) {
      this.envelopeOut *= 0.995;
      return 0;
    }

    const idx = (this.cursor - 1 + this.phonemes.length) % this.phonemes.length;
    const ph = this.phonemes[idx];
    const durMs = Math.max(40, (ph.ms || 120) * this.params.speedScale);

    let targets = VOWEL_FORMANTS[clamp(ph.vowel || 0, 0, 9)];
    let pitchTarget = (ph.pitch || 0) + this.params.pitchShift;
    let ampTarget = (ph.amp || 1);
    let voicing = 1;
    let fricative = 0;
    let burst = 0;

    if (!this.speaking || ph.consonant === 5 || this.phonemeAgeMs >= durMs) {
      voicing = 0;
      ampTarget = 0;
      this.speaking = false;
    } else {
      const t = this.phonemeAgeMs;
      const cMs = ph.consonant === 1 ? 26 : ph.consonant === 2 ? 58 : ph.consonant === 3 ? 48 : ph.consonant === 4 ? 36 : 0;
      if (t < cMs) {
        if (ph.consonant === 1) { voicing = 0; ampTarget = 1; burst = t > 16 ? 1 : 0; }
        else if (ph.consonant === 2) { voicing = 0.15; fricative = 1; }
        else if (ph.consonant === 3) { targets = NASAL_FORMANTS; ampTarget *= 0.6; }
        else if (ph.consonant === 4) { targets = LIQUID_FORMANTS; }
      }
      ampTarget *= clamp(Math.min(t / 8, (durMs - t) / 16), 0, 1);
      this.phonemeAgeMs += 1000 / this.sr;
    }

    this.voicePitch += (pitchTarget - this.voicePitch) * 0.004;
    this.voiceAmp += (ampTarget - this.voiceAmp) * 0.015;
    this.envelopeOut = this.voiceAmp;

    if (this.voiceAmp < 1e-4) return 0;

    const f0 = clamp(this.baseHz * Math.pow(2, this.voicePitch / 12), 45, 700);
    this.phase = (this.phase + f0 / this.sr) % 1;
    const p = this.phase;
    const lf = p < 0.65
      ? Math.sin(Math.PI * p / 0.65) * (0.75 + 0.5 * (p / 0.65))
      : -1.1 * Math.exp(-2.5 * (p - 0.65) / 0.08);
    this.glottis += (lf - this.glottis) * 0.42;

    const n = this.nextNoise();
    let ex = this.glottis * voicing + n * (0.08 + this.params.roughness * 0.14);

    if (this.params.carrierRing > 0.01) {
      ex *= (1 - this.params.carrierRing) + this.params.carrierRing * Math.sin(TAU * p * 3.0);
    }
    if (this.params.fragment > 0.05) {
      const st = Math.floor(this.age * (0.0005 + this.params.fragment * 0.003));
      const gate = Math.sin(st * 12.9898) > (this.params.fragment * 0.45) ? 1 : 0.06;
      ex *= gate;
    }
    if (this.params.reverseMix > 0.02) {
      const sz = 1440;
      this.revBank[this.revWriteBank][this.revCur] = ex;
      const rev = this.revReady ? this.revBank[1 - this.revWriteBank][sz - 1 - this.revCur] : 0;
      const win = Math.sin(Math.PI * (this.revCur + 0.5) / sz);
      ex = ex * (1 - this.params.reverseMix) + rev * (win * win) * this.params.reverseMix;
      if (++this.revCur >= sz) {
        this.revCur = 0;
        this.revWriteBank = 1 - this.revWriteBank;
        this.revReady = true;
      }
    }

    const scale = 1 / clamp(this.params.vocalSize, 0.5, 2.0);
    const gains = [1.0, 0.65, 0.34, 0.20];
    const qs = [7.5, 7.0, 6.0, 5.0];
    let out = 0;
    for (let i = 0; i < 4; i++) {
      this.formantHz[i] += (targets[i] * scale - this.formantHz[i]) * 0.02;
      out += this.formants[i].process(ex, this.formantHz[i], qs[i], this.sr).band * gains[i];
    }

    this.hiss += (n - this.hiss) * 0.2;
    out += (n - this.hiss) * fricative * 0.38 + burst * n * 0.45;
    this.age++;
    return clamp(this.dc.process(out * this.voiceAmp * 0.72), -1.1, 1.1);
  }
}

// ---------------------------------------------------------------------------
// MAIN WORKLET PROCESSOR
// ---------------------------------------------------------------------------
class HaecceityProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.sr = sampleRate;
    this.playing = false;
    this.bpm = 148;
    this.beat = 0;
    this.lastStep = -1;
    this.seed = 0xdead;

    this.kick = new KickEngine(this.sr);
    this.idm = new IdmUnit(this.sr);
    this.unstable = new UnstablePath(this.sr);
    this.mumble = new MumbleVoice(this.sr);
    this.artifact = new ArtifactUnit(this.sr);
    this.glitch = new GlitchUnit(this.sr);
    this.chopScrew = new ChopScrewUnit(this.sr);
    this.psycho = new PsychoUnit(this.sr);

    this.voices = Array.from({ length: 16 }, () => new DrumVoice(this.sr));
    this.voiceCursor = 0;
    this.selectedKit = 0;
    this.drumPitchShift = 0;
    this.polymeterSkew = 0;

    this.kickPattern = [2, 0, 0, 0,  1, 0, 0, 1,  0, 0, 1, 0,  2, 0, 0, 0];
    this.drumPattern = [
      [0, 0, 1, 0,  0, 0, 0, 0,  1, 0, 0, 0,  0, 0, 1, 0],
      [0, 0, 0, 0,  1, 0, 0, 0,  0, 0, 0, 0,  1, 0, 0, 1],
      [0, 0, 0, 0,  0, 0, 1, 0,  0, 0, 0, 0,  0, 1, 0, 0],
      [1, 0, 1, 1,  1, 0, 1, 0,  1, 1, 1, 0,  1, 0, 1, 1],
      [0, 0, 0, 0,  0, 0, 0, 1,  0, 0, 0, 0,  0, 0, 0, 1],
      [0, 1, 0, 0,  0, 1, 0, 0,  0, 0, 1, 0,  0, 0, 0, 0],
      [0, 0, 0, 1,  0, 0, 0, 0,  0, 1, 0, 0,  0, 0, 1, 0],
      [1, 0, 0, 0,  0, 0, 0, 0,  0, 0, 0, 1,  0, 0, 0, 0],
    ];

    this.kickGain = 0.56;
    this.drumGain = 0.72;
    this.idmGain = 0.88;
    this.unstableGain = 0.56;
    this.mumbleGain = 0.82;
    this.masterGain = 0.88;

    this.kickEnv = 0;
    this.scReleaseMs = 95;

    this.telemetryCounter = 0;
    this.peakKick = 0;
    this.peakDrum = 0;
    this.peakIdm = 0;
    this.peakUnstable = 0;
    this.peakMumble = 0;
    this.peakMaster = 0;
    this.scopeBuf = new Float32Array(64);
    this.scopeIdx = 0;

    this.port.onmessage = (e) => this.handleMessage(e.data);
  }

  handleMessage(msg) {
    if (!msg || !msg.type) return;
    switch (msg.type) {
      case 'transport':
        if (typeof msg.playing === 'boolean') {
          this.playing = msg.playing;
          if (!this.playing) {
            this.beat = 0;
            this.lastStep = -1;
          }
        }
        if (typeof msg.bpm === 'number') this.bpm = clamp(msg.bpm, 24, 240);
        break;
      case 'scene':
        if (typeof msg.seed16 === 'number') this.seed = msg.seed16 & 0xffff;
        break;
      case 'xyFrame': {
        const f = msg.frame;
        if (!f) break;
        if (typeof f.bpm === 'number') this.bpm = clamp(f.bpm, 24, 240);
        if (typeof f.polymeterSkew === 'number') this.polymeterSkew = f.polymeterSkew;
        if (Array.isArray(f.kickPattern)) this.kickPattern = f.kickPattern;
        if (Array.isArray(f.drumPattern)) this.drumPattern = f.drumPattern;
        if (f.kick) this.kick.applyParams(f.kick);
        if (typeof f.kitIndex === 'number') this.selectedKit = clamp(f.kitIndex, 0, 11);
        if (typeof f.drumPitchShift === 'number') this.drumPitchShift = f.drumPitchShift;
        if (f.idm) this.idm.applyParams(f.idm);
        if (f.unstableDsp) this.unstable.applyChaos(f.unstableDsp);
        if (f.unstableParams) this.unstable.applyParams(f.unstableParams);
        if (f.mumble) this.mumble.applyParams(f.mumble);
        if (f.artifact) this.artifact.applyParams(f.artifact);
        if (f.glitch) this.glitch.applyParams(f.glitch);
        if (f.chopScrew) this.chopScrew.applyParams(f.chopScrew);
        if (f.psychoacoustics) this.psycho.applyParams(f.psychoacoustics);
        break;
      }
      case 'chaos':
        if (typeof msg.addr16 === 'number') this.seed = msg.addr16 & 0xffff;
        if (msg.dsp) this.unstable.applyChaos(msg.dsp);
        break;
      case 'trigKick':
        this.kick.trigger(msg.vel ?? 1.0);
        this.kickEnv = Math.max(this.kickEnv, 0.95);
        break;
      case 'trigDrum':
        this.spawnDrum(msg.slot, msg.vel ?? 0.95);
        break;
      case 'mumblePhrase':
        this.mumble.setPhrase(msg.phonemes || []);
        if (msg.phonemes && msg.phonemes.length > 0) {
          this.mumble.triggerRhythmicStep(Math.max(0, this.lastStep));
        }
        break;
      case 'mixParam':
        if (msg.key === 'kickGain') this.kickGain = msg.value;
        else if (msg.key === 'drumGain') this.drumGain = msg.value;
        else if (msg.key === 'idmGain') this.idmGain = msg.value;
        else if (msg.key === 'unstableGain') this.unstableGain = msg.value;
        else if (msg.key === 'mumbleGain') this.mumbleGain = msg.value;
        else if (msg.key === 'masterGain') this.masterGain = msg.value;
        else if (msg.key === 'scReleaseMs') this.scReleaseMs = clamp(msg.value, 25, 700);
        break;
      case 'unstableParam':
        if (msg.key in this.unstable.params) this.unstable.params[msg.key] = msg.value;
        break;
      case 'idmParam':
        if (msg.key === 'model') this.idm.model = clamp(Math.round(msg.value), 0, 6);
        else if (msg.key in this.idm.params) this.idm.params[msg.key] = msg.value;
        break;
    }
  }

  spawnDrum(slot, vel) {
    if (slot === 3) {
      for (const v of this.voices) {
        if (v.active && v.slot === 4) v.active = false;
      }
    }
    const v = this.voices[this.voiceCursor];
    this.voiceCursor = (this.voiceCursor + 1) % this.voices.length;
    v.trigger(this.selectedKit, slot, vel, this.seed, this.drumPitchShift);
  }

  process(inputs, outputs) {
    const out = outputs[0];
    if (!out || out.length === 0) return true;
    const outL = out[0];
    const outR = out[1] || out[0];
    const blockLen = outL.length;

    const beatsPerSample = (this.bpm / 60.0) / this.sr;
    const scRelCoeff = Math.exp(-1.0 / ((this.scReleaseMs / 1000) * this.sr));
    const scAtkCoeff = 1.0 - Math.exp(-1.0 / (0.0012 * this.sr));
    const drumModLen = [16, 14, 12, 15][this.polymeterSkew % 4];

    for (let i = 0; i < blockLen; i++) {
      let stepIdx = this.lastStep;
      if (this.playing) {
        this.beat += beatsPerSample;
        stepIdx = Math.floor(this.beat * 4 + 1e-9);
        if (stepIdx !== this.lastStep) {
          this.lastStep = stepIdx;
          const s16 = ((stepIdx % 16) + 16) % 16;
          const sDrum = ((stepIdx % drumModLen) + drumModLen) % drumModLen;

          const kVel = this.kickPattern[s16] || 0;
          if (kVel > 0) this.kick.trigger(kVel > 1 ? 1.15 : 0.95);

          for (let slot = 0; slot < 8; slot++) {
            const dVel = this.drumPattern[slot]?.[sDrum % 16] || 0;
            if (dVel > 0) this.spawnDrum(slot, dVel);
          }

          if (this.mumble.active && (stepIdx % 2 === 0 || euclidHit(stepIdx, 5, 16))) {
            this.mumble.triggerRhythmicStep(stepIdx);
          }
        }
      }

      const kSig = this.kick.process() * this.kickGain;
      const kAbs = Math.abs(kSig);
      if (kAbs > this.kickEnv) this.kickEnv += (kAbs - this.kickEnv) * scAtkCoeff;
      else this.kickEnv *= scRelCoeff;
      const scEnv = clamp(this.kickEnv * 1.45, 0, 1);

      let rawL = 0;
      let rawR = 0;
      for (let v = 0; v < this.voices.length; v++) {
        if (this.voices[v].active) {
          const [vl, vr] = this.voices[v].process();
          rawL += vl;
          rawR += vr;
        }
      }

      const mSig = this.mumble.process() * this.mumbleGain;
      const feedIdmL = rawL + mSig * 0.25;
      const feedIdmR = rawR + mSig * 0.25;
      const [wetIdmL, wetIdmR] = this.idm.process(feedIdmL, feedIdmR, this.beat, this.bpm, this.seed % 1000, 1.0);

      const dL = rawL * this.drumGain;
      const dR = rawR * this.drumGain;
      const iL = wetIdmL * this.idmGain;
      const iR = wetIdmR * this.idmGain;

      const [uL, uR] = this.unstable.process(Math.max(0, stepIdx), scEnv);
      const unL = uL * this.unstableGain;
      const unR = uR * this.unstableGain;

      let mixL = kSig + dL * 0.65 + iL * 1.05 + unL + mSig * 0.9;
      let mixR = kSig + dR * 0.65 + iR * 1.05 + unR + mSig * 0.9;

      [mixL, mixR] = this.artifact.process(mixL, mixR, this.bpm);
      [mixL, mixR] = this.glitch.process(mixL, mixR, this.beat, this.bpm);
      [mixL, mixR] = this.chopScrew.process(mixL, mixR, this.beat, this.bpm);
      [mixL, mixR] = this.psycho.process(mixL, mixR);

      const mL = fastTanh(mixL * this.masterGain);
      const mR = fastTanh(mixR * this.masterGain);

      outL[i] = mL;
      outR[i] = mR;

      this.peakKick = Math.max(this.peakKick, Math.abs(kSig));
      this.peakDrum = Math.max(this.peakDrum, Math.max(Math.abs(dL), Math.abs(dR)));
      this.peakIdm = Math.max(this.peakIdm, Math.max(Math.abs(iL), Math.abs(iR)));
      this.peakUnstable = Math.max(this.peakUnstable, Math.max(Math.abs(unL), Math.abs(unR)));
      this.peakMumble = Math.max(this.peakMumble, Math.abs(mSig));
      this.peakMaster = Math.max(this.peakMaster, Math.max(Math.abs(mL), Math.abs(mR)));

      if ((i & 1) === 0) {
        this.scopeBuf[this.scopeIdx] = 0.5 * (mL + mR);
        this.scopeIdx = (this.scopeIdx + 1) % this.scopeBuf.length;
      }
    }

    if (++this.telemetryCounter >= 12) {
      this.telemetryCounter = 0;
      this.port.postMessage({
        type: 'telemetry',
        step: this.lastStep < 0 ? 0 : (this.lastStep % 16),
        kickEnv: clamp(this.kickEnv * 1.45, 0, 1),
        peakKick: this.peakKick,
        peakDrum: this.peakDrum,
        peakIdm: this.peakIdm,
        peakUnstable: this.peakUnstable,
        peakMumble: this.peakMumble,
        peakMaster: this.peakMaster,
        idmMode: IDM_MODE_NAMES[this.idm.mode] || 'NORMAL',
        idmLocked: this.idm.locked,
        idmCombHz: this.idm.combPeriod > 0 ? Math.round(this.sr / this.idm.combPeriod) : 0,
        mumbleActive: this.mumble.active,
        mumbleSpeaking: this.mumble.speaking,
        mumbleText: this.mumble.currentText,
        mumbleVowel: this.mumble.currentVowel,
        mumbleConsonant: this.mumble.currentConsonant,
        mumbleEnv: this.mumble.envelopeOut,
        scope: Array.from(this.scopeBuf),
      });
      this.peakKick *= 0.4;
      this.peakDrum *= 0.4;
      this.peakIdm *= 0.4;
      this.peakUnstable *= 0.4;
      this.peakMumble *= 0.4;
      this.peakMaster *= 0.4;
    }

    return true;
  }
}

registerProcessor('haecceity-processor', HaecceityProcessor);
