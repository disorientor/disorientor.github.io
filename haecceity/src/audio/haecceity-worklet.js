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
    const fc = clamp(cutoffHz, 20, sr * 0.44);
    const g = Math.tan(Math.PI * fc / sr);
    const k = 1 / Math.max(0.25, q);
    const a1 = 1 / (1 + g * (g + k));
    const a2 = g * a1;
    const a3 = g * a2;
    const v3 = v0 - this.ic2eq;
    const v1 = a1 * this.ic1eq + a2 * v3;
    const v2 = this.ic2eq + a2 * this.ic1eq + a3 * v3;
    this.ic1eq = 2 * v1 - this.ic1eq;
    this.ic2eq = 2 * v2 - this.ic2eq;
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
  }
  clear() {
    this.l.fill(0);
    this.r.fill(0);
    this.cursor = 0;
  }
  write(left, right) {
    this.l[this.cursor] = left;
    this.r[this.cursor] = right;
    this.cursor = (this.cursor + 1) % this.size;
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
// PROCEDURAL DRUMKITS (4 Kits x 8 Voices)
// ---------------------------------------------------------------------------
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

    const baseDecaysMs = [
      [180, 140, 110, 48, 220, 75, 160, 290],
      [220, 190, 160, 62, 290, 115, 240, 380],
      [260, 220, 180, 95, 340, 150, 290, 450],
      [240, 210, 150, 70, 310, 95, 220, 420],
    ];
    this.decaySamples = Math.round((baseDecaysMs[kit][slot] / 1000) * this.sr);

    if (kit === 2 || slot === 7) {
      const wireHz = (kit === 2
        ? [68, 185, 310, 1120, 1540, 440, 132, 620][slot]
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
    } else {
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
    }

    s *= this.vel * 0.7;
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
    this.dcL = new DCBlock();
    this.dcR = new DCBlock();
    this.fbPrevL = 0;
    this.fbPrevR = 0;

    this.chaos = {
      textureMode: 0,
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

      const effBits = clamp(Math.round(bits - padX * 4), 2, 16);
      const levels = Math.pow(2, effBits - 1);
      const qL = Math.round(clamp(bufRead[0], -1, 1) * levels) / levels;
      const qR = Math.round(clamp(bufRead[1], -1, 1) * levels) / levels;

      const mix = clamp(this.params.mangleMix * (0.35 + padX * 0.85), 0, 1);
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

  process(stepIdx, kickEnv) {
    if (this.params.enabled < 0.5) return [0, 0];
    const c = this.chaos;
    const p = this.params;

    if (stepIdx !== this.lastStep) {
      this.lastStep = stepIdx;
      const lfsrVal = this.stepLfsr();
      if (euclidHit(stepIdx, c.pulseEuclidK, c.pulseEuclidN)) {
        this.pulseEnv = 0.55 + lfsrVal * 0.45;
        this.pulseHz = c.droneBaseHz * [2, 3, 4, 5, 6, 8][Math.floor(lfsrVal * 6)];
      }
    }
    this.pulseEnv *= Math.exp(-1 / (this.sr * 0.055));

    const fbCrossMod = c.routingIndex === 2 ? this.fbPrevL * 0.9 : 0;
    const lfsrPitchDrift = 1.0 + ((this.lfsr & 0x0f) / 15.0 - 0.5) * 0.025;
    const baseHz = c.droneBaseHz * lfsrPitchDrift;
    const modHz = baseHz * c.fmRatio;
    const texMode = c.textureMode | 0;
    const boost = p.sceneBoost || 1.0;

    this.modPhase = (this.modPhase + modHz / this.sr) % 1;
    const modOut = Math.sin(TAU * this.modPhase);
    const fmAmt = (0.3 + p.fmIndex * 3.8 + p.padY * 1.8) * (1 + fbCrossMod);

    this.carPhase = (this.carPhase + baseHz / this.sr) % 1;
    this.subPhase = (this.subPhase + (baseHz * c.subInterval) / this.sr) % 1;
    this.pulsePhase = (this.pulsePhase + this.pulseHz / this.sr) % 1;

    let genL;
    let genR;

    const fbLen = this.fbBufL.length;
    const dL = clamp(Math.round((c.fbDelayLMs / 1000) * this.sr), 16, fbLen - 2);
    const dR = clamp(Math.round((c.fbDelayRMs / 1000) * this.sr), 16, fbLen - 2);
    const fbReadL = this.fbBufL[(this.fbCursor - dL + fbLen) % fbLen];
    const fbReadR = this.fbBufR[(this.fbCursor - dR + fbLen) % fbLen];

    if (texMode === 1) {
      // DEATH INDUSTRIAL: tectonic sub-rumble + scraped iron resonance + dark machinery pulse
      this.lfo1Phase = (this.lfo1Phase + (0.07 + p.padX * 0.35) / this.sr) % 1;
      const lfo1 = 0.5 + 0.5 * Math.sin(TAU * this.lfo1Phase);
      this.car2Phase = (this.car2Phase + (baseHz * 1.013) / this.sr) % 1;
      const nL = this.nextNoise();
      const nR = this.nextNoise();
      this.brownL = clamp(this.brownL * 0.992 + nL * 0.08, -1, 1);
      this.brownR = clamp(this.brownR * 0.992 + nR * 0.08, -1, 1);

      const subCrush = Math.sin(TAU * this.carPhase + modOut * (0.4 + p.fmIndex * 2.1)) * 0.55 +
                       Math.sin(TAU * this.car2Phase) * 0.35 +
                       Math.sin(TAU * this.subPhase) * 0.45;
      const rumble = this.svfA.process(this.brownL * 1.6 + subCrush * 0.65, 70 + p.padY * 340 + lfo1 * 90, 2.6 + p.padY * 2.4, this.sr).low;
      const scrapeSrc = subCrush * modOut + nR * 0.55 + fbReadR * 0.35;
      const scrape = this.svfB.process(scrapeSrc, 220 + p.padX * 1850 + lfo1 * 380, 4.2 + p.padY * 4.5, this.sr).band * 1.35;
      const clang = (this.pulsePhase < 0.25 ? 1 : -1) * this.pulseEnv * p.pulseLevel * 0.65;

      genL = (rumble * 0.95 + scrape * 0.72 + clang) * p.droneLevel;
      genR = (rumble * 0.90 - scrape * 0.68 + this.brownR * 0.35 - clang * 0.7) * p.droneLevel;
    } else if (texMode === 2) {
      // DARK AMBIENT: slowly beating sub/tritone/fifth drones + cavernous LFO wind + 4-tap wash
      this.lfo1Phase = (this.lfo1Phase + (0.035 + p.padX * 0.09) / this.sr) % 1;
      this.lfo2Phase = (this.lfo2Phase + (0.023 + p.padY * 0.07) / this.sr) % 1;
      const lfo1 = 0.5 + 0.5 * Math.sin(TAU * this.lfo1Phase);
      const lfo2 = 0.5 + 0.5 * Math.sin(TAU * this.lfo2Phase);

      this.car2Phase = (this.car2Phase + (baseHz * (1.004 + p.padX * 0.011)) / this.sr) % 1;
      this.car3Phase = (this.car3Phase + (baseHz * (c.darkInterval || 1.4983)) / this.sr) % 1;

      const d1 = Math.sin(TAU * this.carPhase + modOut * (0.18 + lfo1 * 0.45));
      const d2 = Math.sin(TAU * this.car2Phase);
      const d3 = Math.sin(TAU * this.car3Phase) * (0.35 + 0.35 * lfo2);
      const dSub = Math.sin(TAU * this.subPhase) * 0.55;

      const nL = this.nextNoise();
      const nR = this.nextNoise();
      this.brownL = clamp(this.brownL * 0.994 + nL * 0.06, -1, 1);
      this.brownR = clamp(this.brownR * 0.994 + nR * 0.06, -1, 1);

      const windL = this.svfA.process(this.brownL * 1.8 + nL * 0.25, 95 + lfo1 * (240 + p.padY * 620), 3.6 + p.padY * 3.2, this.sr).band * 1.45;
      const windR = this.svfB.process(this.brownR * 1.8 + nR * 0.25, 160 + lfo2 * (320 + p.padX * 780), 3.8 + p.padX * 3.0, this.sr).band * 1.45;
      const chime = Math.sin(TAU * this.pulsePhase) * this.pulseEnv * p.pulseLevel * 0.45;

      genL = ((d1 * 0.48 + d2 * 0.42 + d3 * 0.35 + dSub) * 0.65 + windL + chime) * p.droneLevel;
      genR = ((d1 * 0.44 + d2 * 0.46 - d3 * 0.32 + dSub) * 0.65 + windR - chime * 0.8) * p.droneLevel;
    } else if (texMode === 3) {
      // POWER ELECTRONICS: cross-coupled self-oscillating feedback shriek + diode wall + sub weight
      const gateRate = 0.6 + p.padX * 14.0;
      this.lfo1Phase = (this.lfo1Phase + (0.18 + p.padY * 2.4) / this.sr) % 1;
      this.lfo2Phase = (this.lfo2Phase + gateRate / this.sr) % 1;
      const lfo1 = Math.sin(TAU * this.lfo1Phase);
      const lfo2 = Math.sin(TAU * this.lfo2Phase);

      const nL = this.nextNoise();
      const nR = this.nextNoise();
      const ringN = nL * modOut;
      const f1Hz = clamp(320 + p.padX * 3600 + lfo1 * 720 + fbReadR * 950, 90, 6800);
      const f2Hz = clamp(210 + p.padY * 2900 - lfo1 * 540 + fbReadL * 820, 80, 6200);

      const s1 = this.svfA.process(nL * 0.6 + ringN * 0.5 + fbReadL * 0.72, f1Hz, 6.0 + p.padY * 7.0, this.sr);
      const s2 = this.svfB.process(nR * 0.6 + s1.band * 0.55 + fbReadR * 0.72, f2Hz, 5.5 + p.padX * 6.5, this.sr);
      const subPush = Math.sin(TAU * this.subPhase) * 0.55 + Math.sin(TAU * this.carPhase + modOut * 2.4) * 0.45;

      const chopThresh = -0.75 + p.padX * 1.15 - p.padY * 0.55;
      const targetGate = lfo2 > chopThresh ? 1.0 : (0.18 + p.padY * 0.55);
      this.gateEnv += (targetGate - this.gateEnv) * 0.012;

      const rawPeL = (s1.band * 0.85 + s2.high * 0.42 + subPush * 0.75 + ringN * 0.45) * this.gateEnv;
      const rawPeR = (s2.band * 0.85 + s1.high * 0.42 + subPush * 0.70 - ringN * 0.45) * this.gateEnv;
      genL = rawPeL * p.droneLevel;
      genR = rawPeR * p.droneLevel;
    } else {
      const drone = (Math.sin(TAU * this.carPhase + modOut * fmAmt) * 0.65 +
                     Math.sin(TAU * this.subPhase) * 0.35) * p.droneLevel;
      const pulse = (this.pulsePhase < (0.2 + p.padX * 0.3) ? 1 : -1) * this.pulseEnv * p.pulseLevel;
      genL = drone + pulse * 0.85;
      genR = drone * 0.94 - pulse * 0.85;
    }

    const scGain = p.scMode === 2
      ? clamp(kickEnv * p.scDepth * 1.8, 0.05, 1)
      : clamp(1.0 - kickEnv * p.scDepth, 0.03, 1);

    let preFbL = genL;
    let preFbR = genR;

    if (texMode === 2) {
      // Dark ambient: smooth warm saturation, no harsh bitcrush
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

    const fbAmt = clamp(p.fbGain + p.padY * 0.25 + (p.scMode === 3 ? kickEnv * 0.25 : 0), 0, 1.03);
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

    let outL = (preFbL * 0.52 + nextFbL * 0.58) * boost;
    let outR = (preFbR * 0.52 + nextFbR * 0.58) * boost;
    if (p.scMode !== 1) {
      outL *= scGain;
      outR *= scGain;
    }
    return [fastTanh(outL * 0.75), fastTanh(outR * 0.75)];
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

    this.kickGain = 0.62;
    this.drumGain = 0.72;
    this.idmGain = 0.92;
    this.unstableGain = 0.65;
    this.mumbleGain = 0.82;
    this.masterGain = 0.88;

    this.kickEnv = 0;
    this.scReleaseMs = 165;

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
        if (typeof f.kitIndex === 'number') this.selectedKit = clamp(f.kitIndex, 0, 3);
        if (typeof f.drumPitchShift === 'number') this.drumPitchShift = f.drumPitchShift;
        if (f.idm) this.idm.applyParams(f.idm);
        if (f.unstableDsp) this.unstable.applyChaos(f.unstableDsp);
        if (f.unstableParams) this.unstable.applyParams(f.unstableParams);
        if (f.mumble) this.mumble.applyParams(f.mumble);
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
      const [wetIdmL, wetIdmR] = this.idm.process(feedIdmL, feedIdmR, this.beat, this.bpm, this.seed % 1000, this.idmGain);

      const dL = rawL * this.drumGain;
      const dR = rawR * this.drumGain;
      const iL = wetIdmL * this.idmGain;
      const iR = wetIdmR * this.idmGain;

      const [uL, uR] = this.unstable.process(Math.max(0, stepIdx), scEnv);
      const unL = uL * this.unstableGain;
      const unR = uR * this.unstableGain;

      const mL = fastTanh((kSig + dL * 0.55 + iL + unL + mSig * 0.9) * this.masterGain);
      const mR = fastTanh((kSig + dR * 0.55 + iR + unR + mSig * 0.9) * this.masterGain);

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
