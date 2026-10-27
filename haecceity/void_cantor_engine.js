/**
 * Void Cantor Native Audio Engine — JavaScript / Web Audio Port
 * Direct line-for-line port of Haecceity/standalone/native/ (engine.hpp, variation.hpp,
 * harsh.hpp, materials.hpp, faction_sounds.hpp, patch.hpp, performance_character.hpp, world.hpp).
 */
(function() {

function mapped(orig, amount, red, inc) {
    return orig * (1.0 - Math.max(0.0, -amount) * red) + (1.0 - orig) * Math.max(0.0, amount) * inc;
}

function default_physical_settings(p) {
    p = p || {};
    return {
        gesture: p.gesture != null ? p.gesture : 0,
        pressure: p.pressure != null ? p.pressure : 0.55,
        friction: p.friction != null ? p.friction : 0.6,
        contact_speed: p.contact_speed != null ? p.contact_speed : 0.4,
        coupling: p.coupling != null ? p.coupling : 0.35,
        damping: p.damping != null ? p.damping : 0.45,
        stress: p.stress != null ? p.stress : 0.5,
        elasticity: p.elasticity != null ? p.elasticity : 0.25,
        inharmonicity: p.inharmonicity != null ? p.inharmonicity : 0.55,
        fracture: p.fracture != null ? p.fracture : 0.5,
        material_feedback: p.material_feedback != null ? p.material_feedback : 0.35,
        gesture_ms: p.gesture_ms != null ? p.gesture_ms : 650.0
    };
}
function default_harsh_settings(s) {
    s = s || {};
    return {
        enabled: Boolean(s.enabled),
        speech_adsr: Boolean(s.speech_adsr),
        source_sfx: Boolean(s.source_sfx),
        tail_ms: s.tail_ms != null ? s.tail_ms : -1,
        attack_ms: s.attack_ms != null ? s.attack_ms : 2.0,
        decay_ms: s.decay_ms != null ? s.decay_ms : 45.0,
        sustain: s.sustain != null ? s.sustain : 0.0,
        release_ms: s.release_ms != null ? s.release_ms : 12.0,
        circuit: s.circuit != null ? s.circuit : 0,
        drive: s.drive != null ? s.drive : 0.4,
        bias: s.bias != null ? s.bias : 0.0,
        mix: s.mix != null ? s.mix : 0.7,
        feedback: s.feedback != null ? s.feedback : 0.5,
        tension: s.tension != null ? s.tension : 0.4,
        tone: s.tone != null ? s.tone : 0.6,
        root: s.root != null ? s.root : 110.0,
        trim: s.trim != null ? s.trim : 0.55,
        holes: s.holes != null ? s.holes : 0.0,
        articulation: s.articulation != null ? s.articulation : 0.9
    };
}
const HARSH_DEFAULTS = Object.freeze(default_harsh_settings());
function default_features(f) {
    f = f || {};
    return {
        algorithm: f.algorithm != null ? f.algorithm : 0,
        material: f.material != null ? f.material : 0,
        exciter: f.exciter != null ? f.exciter : 0,
        body: f.body != null ? f.body : 0,
        metal: f.metal != null ? f.metal : 0,
        rupture: f.rupture != null ? f.rupture : 0,
        motion: f.motion != null ? f.motion : 0,
        space: f.space != null ? f.space : 0,
        humanise: f.humanise != null ? f.humanise : 0,
        reverb: f.reverb != null ? f.reverb : 0,
        resonance: f.resonance != null ? f.resonance : 0,
        routes: Array.isArray(f.routes) ? f.routes : []
    };
}
// Every Sfx field with its native default (sfx.hpp), so voices never read undefined.
const SFX_DEFAULTS = {
    hardness: 0.6, position: 0.27, decay: 1.5, spread: 0.3, tension: 0, clang: 0, warp: 0, bounce_ms: 160, bounce_ratio: 0.72, scrape_rate: 600, bow: 0,
    reverse_envelope: 0, chamber: 0, formant_motion: 0, carrier_ring: 0, flutter: 0, fragment: 0, reverse_mix: 0, reverse_ms: 35,
    vocal_size: 1, roughness: 0.1, subharmonic: 0, breath: 0.08, voicing: 1, vowel: 0,
    boom: 0.8, crackle: 0.3, rumble: 0.4, noise_amount: 0.6, boom_ms: -1, hp: 0, soft_clip: 0, noise_color: 0, sample: -1, start_ms: 0,
    gain: 1, pitch_from: 0, pitch_to: 0, pitch_ms: 0, pitch_curve: 1, cutoff_from: 0, cutoff_to: 0, cutoff_ms: 0, pan: 0, hold_ms: -1,
    sustain_syllable: false, phoneme_count: 0
};
function default_sfx(s) {
    s = s || {};
    const out = {};
    for (const k in SFX_DEFAULTS) out[k] = s[k] != null ? s[k] : SFX_DEFAULTS[k];
    out.phonemes = s.phonemes || [];
    out.physical = default_physical_settings(s.physical);
    return out;
}

const PI = Math.PI;
const TAU = 2 * PI;

function clamp(x, a, b) {
    return Math.max(a, Math.min(b, x));
}

function random_bipolar(seedObj) {
    let s = seedObj.val;
    s ^= (s << 13) >>> 0;
    s ^= (s >>> 17);
    s ^= (s << 5) >>> 0;
    seedObj.val = s >>> 0;
    return (seedObj.val / 2147483648.0) - 1.0;
}

function fold_wave(value) {
    return Math.asin(Math.sin(value)) * (2.0 / PI);
}

// Wavetables for SoundEngine.WAVETABLE
const TABLE_LENGTH = 2048;
const WAVETABLES = (function() {
    const result = [
        new Float64Array(TABLE_LENGTH),
        new Float64Array(TABLE_LENGTH),
        new Float64Array(TABLE_LENGTH),
        new Float64Array(TABLE_LENGTH)
    ];
    for (let t = 0; t < 4; t++) {
        for (let n = 0; n < TABLE_LENGTH; n++) {
            let sum = 0, weight = 0;
            for (let h = 1; h <= 12; h++) {
                let a = 0;
                if (t === 0) a = (h % 2 ? 1.0 / (h * h) : 0);
                else if (t === 1) a = (h === 1 ? 0.8 : (h % 3 === 0 ? 0.45 / h : 0.07 / h));
                else if (t === 2) a = Math.exp(-Math.pow((h - 4.0) / 2.0, 2)) * 0.2 + (0.5 / h);
                else a = (h === 1 ? 1.0 : h === 2 ? 0.5 : h === 3 ? 0.25 : h === 5 ? 0.18 : 0);
                sum += Math.sin(TAU * h * n / TABLE_LENGTH) * a;
                weight += a;
            }
            result[t][n] = sum / Math.max(0.1, weight);
        }
    }
    return result;
})();

function table_wave(phase, position) {
    phase -= Math.floor(phase);
    position = Math.max(0.0, Math.min(1.0, position)) * 3.0;
    const t = Math.min(2, Math.floor(position));
    const i = Math.floor(phase * TABLE_LENGTH);
    const a = position - t;
    const f = phase * TABLE_LENGTH - i;
    const read = (row) => WAVETABLES[row][i] * (1.0 - f) + WAVETABLES[row][(i + 1) % TABLE_LENGTH] * f;
    return read(t) * (1.0 - a) + read(t + 1) * a;
}

// ---------------------------------------------------------------------------
// Space: asymmetric cross-feedback delay network
// ---------------------------------------------------------------------------
const HARSH_TABLES = {
    ratios: [1.0, 1.4983, 2.013],
    geometries: [
            [1, 1.41421356, 2.71828], [1, 1.27183, 3.14159], [1, 1.61803, 2.41421],
            [1, 1.73205, 2.64575], [1, 1.41421, 3.31662], [1, 1.13975, 1.79129], [1, 1.88775, 2.65331]
        ],
};

const FORMANT_TABLES = {
    gains: [1.0, 0.63, 0.32, 0.18],
    res: [0.93, 0.92, 0.9, 0.88],
};

class Space {
    constructor() {
        this.output = { left: 0, right: 0 };
        this.size = 65536;
        this.left = new Float64Array(this.size);
        this.right = new Float64Array(this.size);
        this.cursor = 0;
        this.damp_l = 0;
        this.damp_r = 0;
        this.phase = 0;
    }
    clear() {
        this.left.fill(0);
        this.right.fill(0);
        this.cursor = 0;
        this.damp_l = 0;
        this.damp_r = 0;
        this.phase = 0;
    }
    tap(buffer, delay) {
        let pos = this.cursor - Math.max(1.0, Math.min(65534.0, delay));
        if (pos < 0) pos += this.size;
        const i = Math.floor(pos);
        const f = pos - i;
        return buffer[i] * (1.0 - f) + buffer[(i + 1) % this.size] * f;
    }
    process(x, amount, sr) {
        const movement = Math.sin(this.phase) * sr * 0.0018;
        this.phase += TAU * 0.13 / sr;
        if (this.phase > TAU) this.phase -= TAU;
        const a = this.tap(this.left, sr * 0.173 + movement);
        const b = this.tap(this.right, sr * 0.257 - movement);
        const c = this.tap(this.left, sr * 0.031);
        const d = this.tap(this.right, sr * 0.047);
        this.damp_l += (a - this.damp_l) * 0.28;
        this.damp_r += (b - this.damp_r) * 0.28;
        const feedback = 0.25 + amount * 0.43;
        this.left[this.cursor] = Math.tanh(x * 0.62 + this.damp_r * feedback + c * 0.08);
        this.right[this.cursor] = Math.tanh(x * 0.62 + this.damp_l * feedback + d * 0.08);
        this.cursor = (this.cursor + 1) % this.size;
        const wet = amount * 0.58;
        this.output.left = x * (1.0 - wet * 0.25) + wet * (a * 0.75 + c * 0.25);
        this.output.right = x * (1.0 - wet * 0.25) + wet * (b * 0.75 + d * 0.25);
        return this.output;
    }
}

// ---------------------------------------------------------------------------
// ResonantReverb: 8-line FDN + 4 diffusers + 3 sympathetic combs
// ---------------------------------------------------------------------------
class ResonantReverb {
    constructor() {
        this.lines = 8;
        this.size = 32768;
        this.diffusers = 4;
        this.diffuser_size = 4096;
        this.combs = 3;
        this.comb_size = 16384;

        this.y_scratch = new Float64Array(this.lines);
        this.ring_scratch = new Float64Array(this.combs);
        this.output = { left: 0, right: 0 };
        this.buffer = Array.from({ length: this.lines }, () => new Float64Array(this.size));
        this.diffuser = Array.from({ length: this.diffusers }, () => new Float64Array(this.diffuser_size));
        this.diffuser_cursor = new Int32Array(this.diffusers);
        this.length = new Float64Array(this.lines);
        this.damp = new Float64Array(this.lines);
        this.feedback = new Float64Array(this.lines);

        this.comb = Array.from({ length: this.combs }, () => new Float64Array(this.comb_size));
        this.comb_length = new Float64Array(this.combs);
        this.comb_damp = new Float64Array(this.combs);
        this.comb_feedback = new Float64Array(this.combs);

        this.cursor = 0;
        this.clock = 0;
        this.phase = 0;
        this.primed = false;
        this.idle = true;

        this.hall_ms = [37.1, 41.9, 47.3, 53.7, 59.3, 67.1, 73.9, 83.3];
        this.diffuser_ms = [4.7, 3.6, 12.7, 9.3];
        this.comb_ratio = [1.0, 1.5, 2.0];
    }
    clear() {
        for (let i = 0; i < this.lines; i++) this.buffer[i].fill(0);
        for (let i = 0; i < this.diffusers; i++) { this.diffuser[i].fill(0); this.diffuser_cursor[i] = 0; }
        for (let i = 0; i < this.combs; i++) this.comb[i].fill(0);
        this.damp.fill(0);
        this.comb_damp.fill(0);
        this.cursor = 0;
        this.clock = 0;
        this.phase = 0;
        this.primed = false;
        this.idle = true;
    }
    process(x, amount, resonance, root_hz, sr) {
        if (amount < 0.00001) {
            if (!this.idle) this.clear();
            return x;
        }
        this.idle = false;
        const period = sr / clamp(root_hz, 20.0, 4000.0);
        const scale = 0.6 + amount * 0.9;

        if (this.clock-- <= 0) {
            this.clock = 64;
            const rt60 = 0.8 + amount * 6.0 + resonance * 4.0;
            for (let i = 0; i < this.lines; i++) {
                const hall = this.hall_ms[i] * scale * sr * 0.001;
                let tuned = Math.max(1.0, Math.round(hall / period)) * period;
                while (tuned > this.size - 64) tuned -= period;
                if (tuned < 2.0) tuned = hall;
                const target = clamp(hall * (1.0 - resonance) + tuned * resonance, 2.0, this.size - 64);
                if (!this.primed) this.length[i] = target;
                else this.length[i] += (target - this.length[i]) * 0.05;
                this.feedback[i] = Math.min(0.9995, Math.pow(10.0, -3.0 * this.length[i] / (sr * rt60)));
            }
            for (let c = 0; c < this.combs; c++) {
                const target = clamp(period / this.comb_ratio[c], 2.0, this.comb_size - 4);
                this.comb_length[c] = this.primed ? this.comb_length[c] + (target - this.comb_length[c]) * 0.05 : target;
                this.comb_feedback[c] = Math.min(0.9995, Math.pow(10.0, -3.0 * this.comb_length[c] / (sr * (1.2 + resonance * 7.0))));
            }
            this.primed = true;
        }

        let input = (x.left + x.right) * 0.5;
        for (let d = 0; d < this.diffusers; d++) {
            const delay = Math.min(this.diffuser_size - 1, Math.floor(this.diffuser_ms[d] * sr * 0.001));
            const read = (this.diffuser_cursor[d] - delay + this.diffuser_size) % this.diffuser_size;
            const delayed = this.diffuser[d][read];
            const v = input + delayed * 0.6;
            this.diffuser[d][this.diffuser_cursor[d]] = v;
            input = delayed - v * 0.6;
            this.diffuser_cursor[d] = (this.diffuser_cursor[d] + 1) % this.diffuser_size;
        }

        this.phase += TAU * 0.21 / sr;
        if (this.phase > TAU) this.phase -= TAU;
        const wobble = Math.sin(this.phase) * 8.0 * (1.0 - resonance);
        const y = this.y_scratch;
        let sum = 0;
        const cutoff = Math.min(sr * 0.45, 5500.0 + resonance * 6500.0 - amount * 2000.0);
        const coefficient = Math.exp(-TAU * cutoff / sr);

        for (let i = 0; i < this.lines; i++) {
            let pos = this.cursor - (this.length[i] + (i === 0 ? wobble : (i === 5 ? -wobble : 0)));
            while (pos < 0) pos += this.size;
            const a = Math.floor(pos) % this.size;
            const f = pos - Math.floor(pos);
            const v = this.buffer[i][a] * (1.0 - f) + this.buffer[i][(a + 1) % this.size] * f;
            this.damp[i] = v * (1.0 - coefficient) + this.damp[i] * coefficient;
            y[i] = this.damp[i] * this.feedback[i];
            sum += y[i];
        }

        sum *= 2.0 / this.lines;
        for (let i = 0; i < this.lines; i++) {
            this.buffer[i][this.cursor] = clamp(y[i] - sum + input * (i % 2 ? -0.5 : 0.5), -4.0, 4.0);
        }

        const left = y[0] - y[2] + y[4] - y[6];
        const right = y[1] - y[3] + y[5] - y[7];
        const wet = amount * 0.55;

        const excite = (left + right) * 0.08 + (x.left + x.right) * 0.04;
        const ring = this.ring_scratch;
        for (let c = 0; c < this.combs; c++) {
            let pos = this.cursor - this.comb_length[c];
            while (pos < 0) pos += this.comb_size;
            const a = Math.floor(pos) % this.comb_size;
            const f = pos - Math.floor(pos);
            const v = this.comb[c][a] * (1.0 - f) + this.comb[c][(a + 1) % this.comb_size] * f;
            this.comb_damp[c] = v * 0.72 + this.comb_damp[c] * 0.28;
            ring[c] = this.comb_damp[c] * this.comb_feedback[c];
            this.comb[c][this.cursor % this.comb_size] = clamp(ring[c] + excite * resonance, -4.0, 4.0);
        }

        this.cursor = (this.cursor + 1) % this.size;
        const sympathetic = resonance * wet * 1.8;
        const hall = wet * (1.0 - resonance * 0.55);
        this.output.left = x.left + left * hall + (ring[0] + ring[2] * 0.6 + ring[1] * 0.4) * sympathetic;
        this.output.right = x.right + right * hall + (ring[0] + ring[1] * 0.6 + ring[2] * 0.4) * sympathetic;
        return this.output;
    }
}

// ---------------------------------------------------------------------------
// Harsh Distortion & Nonlinear circuits (harsh.hpp)
// ---------------------------------------------------------------------------
const HALFBAND_COEFFS = (function() {
    const v = new Float64Array(17);
    let sum = 0;
    for (let n = 0; n < 17; n++) {
        const k = n - 8;
        v[n] = (k === 0 ? 0.5 : Math.sin(1.5707963267948966 * k) / (PI * k)) *
            (0.42 - 0.5 * Math.cos(TAU * n / 16.0) + 0.08 * Math.cos(2.0 * TAU * n / 16.0));
        sum += v[n];
    }
    for (let n = 0; n < 17; n++) v[n] /= sum;
    return v;
})();

class Halfband {
    constructor() {
        this.z = new Float64Array(17);
        this.cursor = 0;
    }
    process(x) {
        this.z[this.cursor] = x;
        let y = 0;
        for (let k = 0; k < 17; k++) {
            y += HALFBAND_COEFFS[k] * this.z[(this.cursor - k + 17) % 17];
        }
        this.cursor = (this.cursor + 1) % 17;
        return y;
    }
}

class Nonlinear {
    constructor() {
        this.up = new Halfband();
        this.down = new Halfband();
        this.slew = 0;
        this.held = 0;
        this.clock = 0;
        this.dc_x = 0;
        this.dc_y = 0;
    }
    static curve(x, mode, bias) {
        x += bias;
        switch (mode) {
            case 0: return Math.tanh(x) - Math.tanh(bias);
            case 1: return (x >= 0 ? Math.tanh(x) : 0.55 * Math.tanh(x / 0.55)) - (bias >= 0 ? Math.tanh(bias) : 0.55 * Math.tanh(bias / 0.55));
            case 2: return clamp(x, -1.0, 1.0) - clamp(bias, -1.0, 1.0);
            case 3: return Math.asin(Math.sin(x)) * 0.6366197723675814 - Math.asin(Math.sin(bias)) * 0.6366197723675814;
            case 4: return Math.abs(Math.tanh(x)) - Math.abs(Math.tanh(bias));
            default: return Math.tanh(x) - Math.tanh(bias);
        }
    }
    process(x, s, sr) {
        let y = 0;
        const g = 1.0 + s.drive * 24.0;
        for (let i = 0; i < 2; i++) {
            const v = this.up.process(i === 0 ? x * 2.0 : 0);
            let shaped = Nonlinear.curve(v * g, s.circuit, s.bias);
            if (s.circuit === 5) {
                const step = (250.0 + 12000.0 * (1.0 - s.drive)) / (sr * 2.0);
                this.slew += clamp(shaped - this.slew, -step, step);
                shaped = this.slew;
            }
            if (s.circuit === 6) {
                this.clock += (1000.0 + (1.0 - s.drive) * 18000.0) / (sr * 2.0);
                if (this.clock >= 1.0) {
                    this.clock -= Math.floor(this.clock);
                    const steps = 8.0 + (1.0 - s.drive) * 248.0;
                    this.held = Math.round(shaped * steps) / steps;
                }
                shaped = this.held;
            }
            const filtered = this.down.process(shaped);
            if (i === 0) y = filtered;
        }
        const r = Math.exp(-TAU * 18.0 / sr);
        const blocked = y - this.dc_x + r * this.dc_y;
        this.dc_x = y;
        this.dc_y = blocked;
        return blocked;
    }
}

class SpectralNotch {
    constructor() {
        this.x1 = 0; this.x2 = 0; this.y1 = 0; this.y2 = 0;
    }
    process(x, hz, sr) {
        const w = TAU * clamp(hz, 40.0, sr * 0.4) / sr;
        const c = Math.cos(w);
        const a = Math.sin(w) / 2.4;
        const n = 1.0 / (1.0 + a);
        const y = (x - 2.0 * c * this.x1 + this.x2 + 2.0 * c * this.y1 - (1.0 - a) * this.y2) * n;
        this.x2 = this.x1; this.x1 = x;
        this.y2 = this.y1; this.y1 = y;
        return y;
    }
}

class HarshEmitter {
    constructor() {
        this.size = 16384;
        this.line = [new Float64Array(this.size), new Float64Array(this.size), new Float64Array(this.size)];
        this.low = new Float64Array(3);
        this.high = new Float64Array(3);
        this.previous = new Float64Array(3);
        this.dry_delay = new Float64Array(8);
        this.returns = new Float64Array(3);
        this.dry_cursor = 0;
        this.cursor = 0;
        this.group = 0;
        this.body_slot = 0;
        this.used = false;
        this.age = 0;
        this.energy = 0;
        this.release = 1;
        this.pan = 0;
        this.release_seconds = 0.24;
        this.strain = 0;
        this.settings = {};
        this.distortion = new Nonlinear();
        this.notches = [new SpectralNotch(), new SpectralNotch(), new SpectralNotch()];
        this.stopping = false;
        this.source_mode = false;
        this.source_clock = -1;
        this.source_value = 0;
        this.source_root = 110;
    }
    start(id, s, position) {
        this.clear();
        this.used = true;
        this.group = id;
        this.settings = default_harsh_settings(s);
        this.source_root = this.settings.root;
        this.pan = position || 0;
        if (this.settings.tail_ms >= 0) this.release_seconds = Math.max(0.001, this.settings.tail_ms * 0.001);
    }
    clear() {
        for (let i = 0; i < 3; i++) this.line[i].fill(0);
        this.low.fill(0);
        this.high.fill(0);
        this.previous.fill(0);
        this.dry_delay.fill(0);
        this.dry_cursor = 0;
        this.cursor = 0;
        this.used = false;
        this.age = 0;
        this.energy = 0;
        this.strain = 0;
        this.release = 1;
        this.release_seconds = 0.24;
        this.distortion = new Nonlinear();
        this.notches = [new SpectralNotch(), new SpectralNotch(), new SpectralNotch()];
        this.stopping = false;
        this.source_mode = false;
        this.source_clock = -1;
        this.source_value = 0;
    }
    source(excitation, articulation, onset, pitch_ratio, frame, sr) {
        if (this.source_clock === frame) return this.source_value;
        this.source_clock = frame;
        if (onset) {
            for (let i = 0; i < 3; i++) this.line[i].fill(0);
            this.low.fill(0); this.high.fill(0); this.previous.fill(0); this.dry_delay.fill(0);
            this.distortion = new Nonlinear();
            this.notches = [new SpectralNotch(), new SpectralNotch(), new SpectralNotch()];
            this.cursor = 0; this.dry_cursor = 0; this.age = 0; this.energy = 0; this.strain = 0; this.release = 1;
        }
        this.settings.root = clamp(this.source_root * pitch_ratio, 20.0, 4000.0);
        this.source_value = this.process(excitation, articulation > 0, sr);
        return this.source_value;
    }
    stop(milliseconds = 60) {
        this.stopping = true;
        this.release_seconds = clamp(milliseconds * 0.001, 0.001, 10.0);
    }
    read(k, delay) {
        let p = this.cursor - clamp(delay, 2.0, this.size - 2);
        if (p < 0) p += this.size;
        const n = Math.floor(p);
        const f = p - n;
        return this.line[k][n] * (1.0 - f) + this.line[k][(n + 1) % this.size] * f;
    }
    process(input, sounding, sr) {
        if (!this.used) return 0;
        this.age += 1.0 / sr;
        if (!sounding || this.stopping) this.release *= Math.exp(-1.0 / (sr * this.release_seconds));
        else this.release = 1.0;

        const ratios = HARSH_TABLES.ratios;
        const geometries = HARSH_TABLES.geometries;
        const geometry = clamp(this.settings.circuit || 0, 0, 6);
        const strain_target = Math.min(1.0, Math.abs(input) * 4.0 + this.energy * 0.7);
        this.strain += (strain_target - this.strain) * (1.0 - Math.exp(-1.0 / (sr * 0.006)));

        const returns = this.returns;
        let sum = 0;
        const coefficient = 1.0 - Math.exp(-TAU * (600.0 + (this.settings.tone || 0.6) * 10500.0) / sr);
        const hp = Math.exp(-TAU * 35.0 / sr);

        for (let k = 0; k < 3; k++) {
            const structural = ratios[k] + (geometries[geometry][k] - ratios[k]) * (this.settings.tension || 0.4);
            const ratio = structural * (1.0 + (this.settings.tension || 0.4) * this.strain * 0.025 * (k - 1)) +
                Math.sin(this.age * (0.7 + k * 0.23)) * (this.settings.tension || 0.4) * 0.006;
            const v = this.read(k, sr / (this.settings.root * ratio));
            this.low[k] += (v - this.low[k]) * coefficient;
            const b = this.low[k] - this.previous[k] + hp * this.high[k];
            this.previous[k] = this.low[k];
            this.high[k] = b;
            returns[k] = b;
            sum += b;
        }

        let wet = 0;
        const loop = (0.72 + (this.settings.feedback || 0.5) * 0.67) * this.release;
        for (let k = 0; k < 3; k++) {
            const reflected = returns[k] - sum * (2.0 / 3.0);
            const exchange = (this.settings.tension || 0.4) * (0.25 + 0.4 * this.strain);
            const coupled = reflected * (1.0 - exchange) + returns[(k + 1) % 3] * exchange;
            const v = input * 0.38 + coupled * loop;
            const bent = Nonlinear.curve(v * (1.0 + (this.settings.drive || 0.4) * 2.0), this.settings.circuit || 0, (this.settings.bias || 0) * (k === 1 ? -0.35 : 0.35));
            this.line[k][this.cursor] = clamp(bent, -1.0, 1.0) / (1.0 + (this.settings.drive || 0.4) * 0.6);
            wet += returns[k] * (k === 1 ? -0.5 : 0.65);
        }

        this.cursor = (this.cursor + 1) % this.size;
        let shaped = this.distortion.process(input + wet * (0.35 + (this.settings.feedback || 0.5)), this.settings, sr);
        if (this.settings.holes > 0) {
            let hollow = shaped;
            for (let k = 0; k < 3; k++) {
                hollow = this.notches[k].process(hollow, this.settings.root * (3.1 + k * 4.7) * (1.0 + 0.13 * Math.sin(this.age * (0.5 + k * 0.2))), sr);
            }
            shaped += (hollow - shaped) * this.settings.holes;
        }

        const dry = this.dry_delay[this.dry_cursor];
        this.dry_delay[this.dry_cursor] = input;
        this.dry_cursor = (this.dry_cursor + 1) % 8;

        const mix = this.settings.mix != null ? this.settings.mix : 0.7;
        const trim = this.settings.trim != null ? this.settings.trim : 0.55;
        let out = (dry * (1.0 - mix) + shaped * mix) * trim;
        if (!this.source_mode && this.settings.tail_ms >= 0) out *= this.release;
        this.energy = Math.max(Math.abs(out), this.energy * Math.exp(-1.0 / (sr * 0.08)));
        if (!Number.isFinite(out)) { this.clear(); return 0; }
        if (!this.source_mode && !sounding && this.release < 0.001 && this.energy < 0.00001) this.used = false;
        return out;
    }
}

// ---------------------------------------------------------------------------
// Physical Material Instrument (materials.hpp)
// ---------------------------------------------------------------------------
class MaterialInstrument {
    constructor() {
        this.N = 16384;
        this.M = 16;
        this.string = [new Float64Array(this.N), new Float64Array(this.N)];
        this.x = new Float64Array(this.M);
        this.v = new Float64Array(this.M);
        this.c = new Float64Array(this.M);
        this.s = new Float64Array(this.M);
        this.loss = new Float64Array(this.M);
        this.ratio = new Float64Array(this.M);
        this.pickup = new Float64Array(this.M);
        this.fracture_detune = new Float64Array(this.M);

        this.age = 0; this.bristle = 0; this.load = 0; this.crack = 0; this.grit = 0; this.tooth = 0; this.next_tooth = 0.3;
        this.surface = 1; this.feedback_contact = 0;
        this.fracture_age = 0; this.fracture_load = 0; this.fracture_strength = 0; this.fragment_wait = 0; this.fragments = 0;
        this.contact = 0; this.body = 0; this.body_prev = 0;
        this.wire_low = [0, 0]; this.disp_x = [0, 0]; this.disp_y = [0, 0]; this.out_low = [0, 0];
        this.smooth_frequency = 0; this.contact_follow = 0.1; this.contact_loss = 0.5;
        this.cursor = 0; this.coefficient_clock = 0; this.fractured = false; this.ready = false;
        this.random = 1;
    }
    noise() {
        let r = this.random;
        r ^= (r << 13) >>> 0;
        r ^= (r >>> 17);
        r ^= (r << 5) >>> 0;
        this.random = r >>> 0;
        return (this.random / 2147483648.0) - 1.0;
    }
    seed(val) {
        this.random = val ? (val >>> 0) : 1;
    }
    read(bank, delay) {
        let pos = this.cursor - clamp(delay, 2.0, this.N - 2);
        if (pos < 0) pos += this.N;
        const i = Math.floor(pos);
        const f = pos - i;
        return this.string[bank][i] * (1.0 - f) + this.string[bank][(i + 1) % this.N] * f;
    }
    coefficients(hz, sr, wire, p, position) {
        this.contact_follow = 1.0 - Math.exp(-2.0 * PI * (350.0 + 6500.0 * Math.pow(1.0 - p.elasticity, 2)) / sr);
        this.contact_loss = (0.22 + 0.72 * (1.0 - p.damping)) * (1.0 - 0.75 * p.elasticity);
        for (let i = 0; i < this.M; i++) {
            const elastic = Math.pow(i + 1.0, 1.045);
            const metal = 1.0 + Math.pow(i, 1.28) * (1.12 + 0.7 * p.inharmonicity);
            this.ratio[i] = wire ? Math.pow(i + 1.0, 1.24) : (metal * (1.0 - p.elasticity) + elastic * p.elasticity);
            const brittle = (1.0 - p.elasticity) * p.inharmonicity;
            const settled = this.fractured ? 1.0 - Math.exp(-this.fracture_age / (0.003 + 0.065 * p.elasticity)) : 0;
            const damage = this.fractured && !wire ? this.fracture_strength * settled * (brittle * this.fracture_detune[i] - 0.075 * (1.0 - brittle) * (i % 3)) : 0;
            const raw_hz = hz * (wire ? 1.39 : 1.0) * this.ratio[i] * (1.0 + this.load * 0.12 * (i % 3 - 1) * p.stress) * (1.0 + damage);
            const f = clamp(raw_hz, 20.0, sr * 0.38);
            const a = 2.0 * PI * f / sr;
            this.c[i] = Math.cos(a);
            this.s[i] = Math.sin(a);
            let seconds = (0.04 + 1.6 * Math.pow(1.0 - p.damping, 2)) / (1.0 + Math.pow(this.ratio[i], 0.65) * (0.055 + p.elasticity * 0.22));
            if (this.fractured && !wire) seconds /= 1.0 + this.fracture_strength * (brittle * (0.5 + i * 0.55) + (1.0 - brittle) * i * 0.06);
            this.loss[i] = Math.exp(-6.90775527898 / (seconds * sr));
            const band_weight = clamp((sr * 0.4 - raw_hz) / (sr * 0.08), 0.0, 1.0);
            this.pickup[i] = Math.sin((i + 1) * PI * (0.08 + position * 0.83)) * band_weight / (1.0 + i * 0.37);
        }
    }
    modes(excitation, p) {
        let sum = 0;
        let previous = this.v[this.M - 1];
        for (let i = 0; i < this.M; i++) {
            const nx = (this.c[i] * this.x[i] - this.s[i] * this.v[i]) * this.loss[i];
            let nv = (this.s[i] * this.x[i] + this.c[i] * this.v[i]) * this.loss[i];
            const coup = Math.tanh(previous - this.x[i]) * (0.0002 + p.coupling * 0.0025);
            nv += excitation * this.pickup[i] * 0.13 + coup;
            previous = this.x[i];
            this.x[i] = clamp(nx, -4.0, 4.0);
            this.v[i] = clamp(nv, -4.0, 4.0);
            sum += this.x[i] * this.pickup[i];
        }
        return sum * 0.22;
    }
    substep(hz, sr, wire, gate, p, position, sustain_contact) {
        const duration = Math.max(0.02, (p.gesture_ms || 650) * 0.001);
        const progress = sustain_contact ? Math.min(0.85, this.age / duration) : this.age / duration;
        const touching = gate && progress < 1.0 && !this.fractured;
        const rise = Math.min(1.0, this.age / 0.018);
        const fall = clamp((1.0 - progress) * 8.0, 0.0, 1.0);
        let shape = touching ? rise * fall : 0;
        if (p.gesture === 0) shape = touching ? Math.exp(-this.age / (0.0018 + p.pressure * 0.009)) : 0;
        if (p.gesture === 2 || p.gesture === 4) shape *= 0.22 + 0.78 * Math.min(1.0, progress * 1.5);
        const stretch = clamp(progress, 0.0, 1.0);
        const requested_load = touching ? p.stress * (0.15 + 0.85 * stretch * (1.0 - p.elasticity + stretch * p.elasticity)) : 0;
        this.load += (requested_load - this.load) * (1.0 - Math.exp(-1.0 / (sr * (touching ? 0.025 : 0.018 + 0.14 * p.elasticity))));

        let slip_impulse = 0;
        const velocity = (0.025 + Math.pow(p.contact_speed, 1.5) * 0.9) * (1.0 + 0.08 * Math.sin(this.age * 27.0));
        if (touching && p.gesture !== 0) {
            const relative = velocity - clamp((this.body - this.body_prev) * sr * 0.001, -1.0, 1.0);
            this.bristle += relative / sr;
            const threshold = (0.00015 + Math.pow(1.0 - p.friction, 1.5) * 0.003 + p.pressure * 0.0006) * this.surface;
            if (Math.abs(this.bristle) > threshold) {
                slip_impulse = Math.sign(this.bristle) * ((0.08 + p.pressure * 0.6) * (0.2 + p.friction * 0.8));
                this.bristle *= 0.08 + 0.3 * p.elasticity;
                this.surface = 0.65 + 0.7 * (this.noise() * 0.5 + 0.5);
            }
        } else this.bristle *= 0.995;

        const break_at = 0.94 - p.fracture * 0.48;
        if (!this.fractured && touching && (p.gesture === 2 || p.gesture === 4) && progress > break_at && p.fracture > 0) {
            this.fractured = true;
            this.fracture_age = 0;
            this.fracture_load = this.load;
            this.fracture_strength = p.pressure * (0.25 + 0.75 * this.fracture_load) * p.fracture;
            for (let i = 0; i < this.M; i++) this.fracture_detune[i] = this.noise() * 0.32;
            const brittle = (1.0 - p.elasticity) * p.inharmonicity;
            this.fragments = wire ? 0 : Math.floor(2 + 8 * brittle);
            this.fragment_wait = 0.0015;
            this.crack = (0.7 + this.fracture_load) * (wire ? (0.85 + 0.25 * (1.0 - p.elasticity)) : (0.8 + 0.4 * brittle)) * p.fracture;
            this.load *= 0.05;
            this.bristle = 0;
            slip_impulse += (0.4 + this.fracture_load) * p.fracture;
            this.coefficient_clock = 0;
        }

        let fragment_impulse = 0;
        if (this.fractured) {
            this.fracture_age += 1.0 / sr;
            if (this.fragments > 0 && gate) {
                this.fragment_wait -= 1.0 / sr;
                if (this.fragment_wait <= 0) {
                    fragment_impulse = this.noise() * this.fracture_strength * (1.0 - p.elasticity) * 0.6;
                    this.fragment_wait = 0.0015 + 0.006 * Math.abs(this.noise());
                    this.fragments--;
                }
            } else if (!gate) this.fragments = 0;
        }

        if (p.gesture === 3 && touching) {
            this.tooth += (8.0 + p.contact_speed * 95.0) / sr;
            if (this.tooth > this.next_tooth) {
                this.tooth = 0;
                this.next_tooth = 0.5 + 0.7 * Math.abs(this.noise());
                slip_impulse += 0.5 + p.pressure * 0.8;
            }
        }

        this.crack *= Math.exp(-1.0 / (sr * (0.002 + p.elasticity * 0.012)));
        const n = this.noise();
        this.grit += (n - this.grit) * (1.0 - Math.exp(-2.0 * PI * (350.0 + 5500.0 * p.friction) / sr));
        const driving = (shape * (p.gesture === 0 ? n * 0.8 : this.grit * (0.015 + 0.075 * p.friction)) +
            slip_impulse * shape + this.crack * n * 0.5 + fragment_impulse) * p.pressure;

        const bend = this.load * (p.elasticity * 1.8 + 0.18 * p.stress);
        let broken_pitch = 1.0;
        if (this.fractured) {
            const settled = 1.0 - Math.exp(-this.fracture_age / 0.003);
            if (wire) {
                const slack = 0.68 + 0.23 * p.elasticity - 0.24 * this.fracture_load;
                const recoil = 0.12 * p.elasticity * Math.exp(-this.fracture_age / 0.075) * Math.sin(2.0 * PI * (8.0 + 16.0 * p.stress) * this.fracture_age);
                broken_pitch = 1.0 + (slack + recoil - 1.0) * settled;
            } else {
                const brittle = (1.0 - p.elasticity) * p.inharmonicity;
                broken_pitch = 1.0 - this.fracture_load * (0.12 + 0.38 * (1.0 - brittle)) * settled;
            }
        }

        const target = clamp(Math.abs(hz) * (1.0 + bend) * broken_pitch, 20.0, sr * 0.15);
        this.smooth_frequency += (target - this.smooth_frequency) * (1.0 - Math.exp(-1.0 / (sr * (0.001 + 0.008 * p.elasticity))));
        if (this.coefficient_clock-- <= 0) {
            this.coefficient_clock = 31;
            this.coefficients(this.smooth_frequency, sr, wire, p, position);
        }

        this.feedback_contact += ((touching ? 1.0 : 0.0) - this.feedback_contact) * (1.0 - Math.exp(-1.0 / (sr * 0.008)));
        const feedback = Math.tanh(this.body * 1.4) * (p.material_feedback || 0.35) * 0.012 * this.feedback_contact;

        let out = 0;
        if (wire) {
            this.contact += (driving - this.contact) * this.contact_follow;
            const a = this.read(0, sr / Math.max(20.0, this.smooth_frequency));
            const b = this.read(1, sr / Math.max(20.0, this.smooth_frequency * (1.006 + 0.031 * p.coupling)));
            let decay_seconds = Math.max(0.035, 0.08 + 1.7 * Math.pow(1.0 - p.damping, 2));
            if (this.fractured) decay_seconds /= 1.0 + this.fracture_strength * (2.8 - 2.3 * p.elasticity);
            const loop_loss = Math.exp(-6.90775527898 / (decay_seconds * Math.max(20.0, this.smooth_frequency)));

            for (let j = 0; j < 2; j++) {
                const inp = j ? b : a;
                const dispersion = (0.06 + p.inharmonicity * 0.65) * (1.0 - p.elasticity * 0.8);
                const dispersed = -dispersion * inp + this.disp_x[j] + dispersion * this.disp_y[j];
                this.disp_x[j] = inp; this.disp_y[j] = dispersed;
                this.wire_low[j] += (dispersed - this.wire_low[j]) * this.contact_loss;
                const mixed = this.wire_low[j] * (1.0 - p.coupling * 0.23) + (j ? a : b) * p.coupling * 0.23;
                this.string[j][this.cursor] = Math.tanh(mixed * loop_loss + this.contact * (j ? -0.65 : 1.0) + feedback) * 0.995;
            }
            this.cursor = (this.cursor + 1) % this.N;
            const bridge = this.modes((a - b) * 0.045 + this.contact * 0.4, p);
            out = (a + b) * 0.68 + bridge * 0.4;
        } else {
            out = this.modes(driving + feedback, p) + driving * (0.08 + p.friction * 0.04);
        }
        this.body_prev = this.body;
        this.body = out;
        this.age += 1.0 / sr;
        return out;
    }
    process(hz, sr, wire, gate, p, position, sustain_contact) {
        p = default_physical_settings(p);
        if (!this.ready) {
            this.smooth_frequency = Math.max(20.0, Math.abs(hz));
            this.ready = true;
        }
        let sum = 0;
        const alpha = 1.0 - Math.exp(-2.0 * PI * 0.19);
        for (let k = 0; k < 2; k++) {
            const raw = this.substep(hz, sr * 2.0, wire, gate, p, position, sustain_contact);
            this.out_low[0] += (raw - this.out_low[0]) * alpha;
            this.out_low[1] += (this.out_low[0] - this.out_low[1]) * alpha;
            sum += this.out_low[1];
        }
        return clamp(sum * 1.5, -6.0, 6.0);
    }
}

// ---------------------------------------------------------------------------
// Speech Formants & Metal Ratios (sfx.hpp)
// ---------------------------------------------------------------------------
const VOWEL_FORMANTS = [
    [730, 1090, 2440, 3400], [530, 1840, 2480, 3500], [270, 2290, 3010, 3700],
    [570, 840, 2410, 3400], [300, 870, 2240, 3300], [610, 1700, 2500, 3500],
    [640, 920, 2400, 3400], [500, 1500, 2500, 3500], [660, 1720, 2410, 3400],
    [440, 1020, 2240, 3300]
];
const NASAL_FORMANTS = [250, 1000, 2300, 3300];
const LIQUID_FORMANTS = [360, 1300, 2700, 3400];
const MATERIAL_SLOPE = [0.55, 0.9, 0.75, 0.45, 0.3, 0.2, 1.1, 0.35];

const MATERIAL_RATIOS = (function() {
    const t = Array.from({ length: 8 }, () => new Float64Array(24));
    const bell = [0.5, 1, 1.183, 1.506, 2, 2.514, 2.662, 3.011, 4.166, 5.433, 6.796, 8.215];
    const gong = [1, 1.594, 2.136, 2.296, 2.653, 2.918, 3.156, 3.501, 3.6, 3.652, 4.06, 4.154, 4.601, 4.832, 4.903, 5.131, 5.412, 5.635, 5.937, 6.152, 6.208, 6.528, 6.746, 6.888];
    const plate = [];
    for (let m = 1; m <= 8; m++) {
        for (let n = 1; n <= 8; n++) {
            plate.push(m * m + 1.37 * n * n);
        }
    }
    plate.sort((a, b) => a - b);
    const dense = [plate[0]];
    for (let i = 1; i < plate.length; i++) {
        if (plate[i] / dense[dense.length - 1] >= 1.01) dense.push(plate[i]);
        if (dense.length === 24) break;
    }
    const ring = (k) => k * (k * k - 1.0) / Math.sqrt(k * k + 1.0);

    for (let k = 0; k < 24; k++) {
        t[0][k] = bell[Math.floor(k / 2)] * (k % 2 ? 1.0025 : 1.0); // BELL
        t[1][k] = (2.0 * k + 3.0) * (2.0 * k + 3.0) / 9.0;         // BAR
        t[2][k] = Math.pow(k + 1.0, 1.42);                          // PIPE
        t[3][k] = dense[k] / dense[0];                              // PLATE
        t[4][k] = gong[k];                                          // GONG
        t[5][k] = (k + 1.0) * Math.sqrt(1.0 + 0.006 * (k + 1.0) * (k + 1.0)) / Math.sqrt(1.006); // BLADE
        t[6][k] = ring(k + 2.0) / ring(2.0);                        // CHAIN
        t[7][k] = k + 1.0;                                          // FANTASY
    }
    return t;
})();

// ---------------------------------------------------------------------------
// SVF Filter & Envelope (engine.hpp)
// ---------------------------------------------------------------------------
class Filter {
    constructor() {
        this.ic1 = 0; this.ic2 = 0;
        this.output = { low: 0, mid: 0, high: 0 };
    }
    process_g(x, g, resonance) {
        const k = 2.0 - 1.94 * clamp(resonance, 0.0, 0.96);
        const a1 = 1.0 / (1.0 + g * (g + k));
        const v1 = a1 * (this.ic1 + g * (x - this.ic2));
        const v2 = this.ic2 + g * v1;
        this.ic1 = 2.0 * v1 - this.ic1;
        this.ic2 = 2.0 * v2 - this.ic2;
        this.output.low = v2; this.output.mid = v1; this.output.high = x - k * v1 - v2;
        return this.output;
    }
    process(x, hz, resonance, sr) {
        return this.process_g(x, Math.tan(PI * clamp(hz, 20.0, sr * 0.40) / sr), resonance);
    }
}

class Envelope {
    constructor() {
        this.stage = 0; // 0=OFF, 1=A, 2=D, 3=S, 4=R
        this.value = 0;
        this.release_step = 0;
    }
    on() {
        this.stage = 1;
        this.value = 0;
    }
    off(ms, sr) {
        if (this.stage !== 0) {
            this.stage = 4;
            this.release_step = this.value / Math.max(1.0, ms * sr * 0.001);
        }
    }
    next(p, sr) {
        switch (this.stage) {
            case 1: // Attack
                this.value += 1.0 / Math.max(1.0, p[3] * sr * 0.001);
                if (this.value >= 1.0) { this.value = 1.0; this.stage = 2; }
                break;
            case 2: // Decay
                this.value -= (1.0 - clamp(p[5], 0.0, 1.0)) / Math.max(1.0, p[4] * sr * 0.001);
                if (this.value <= p[5]) { this.value = clamp(p[5], 0.0, 1.0); this.stage = 3; }
                break;
            case 3: // Sustain
                this.value = clamp(p[5], 0.0, 1.0);
                break;
            case 4: // Release
                this.value -= this.release_step;
                if (this.value <= 0) { this.value = 0; this.stage = 0; }
                break;
            default:
                this.value = 0;
        }
        return this.value;
    }
}

// ---------------------------------------------------------------------------
// Voice: 32 polyphonic voices running full 35-parameter Void Cantor DSP
// ---------------------------------------------------------------------------
const PARAM_COUNT = 35;
const MAX_PHONEMES = 96;
function default_params() {
    return new Float64Array([1, 2000, 0.3, 5, 150, 0.7, 400, 0, 2, 0.1, 1.5, 0, 0.5, 8, 0.1, 0.02, 180, 0, 0, 0, 0, 0, 0.7, 0, 58, 0, 90, 0, 1, 0.5, 0.4, 0.3, 4, 0.6, 0]);
}
function sfx_default_params() {
    const p = default_params();
    p[1] = 16000; p[2] = 0.08; p[3] = 1; p[4] = 400; p[5] = 1; p[6] = 250;
    p[9] = 0; p[10] = 1; p[14] = 0; p[15] = 0; p[27] = 0; p[28] = 0; p[30] = 0; p[31] = 0;
    return p;
}

// AudioWorkletGlobalScope has no structuredClone, so plain data is copied by hand.
function deep_clone(x) {
    if (x === null || typeof x !== 'object') return x;
    if (ArrayBuffer.isView(x)) return x.slice();
    if (Array.isArray(x)) return x.map(deep_clone);
    const out = {};
    for (const k in x) out[k] = deep_clone(x[k]);
    return out;
}
function is_state(x) { return ArrayBuffer.isView(x) || (x !== null && typeof x === 'object' && !Array.isArray(x) && Object.getPrototypeOf(x) !== Object.prototype); }
// Rebuilds target as a copy of a freshly constructed source without allocating DSP buffers: typed arrays are
// copied in place and class instances (filters, envelopes, bodies) recurse; plain data, which may be shared with
// patches, is replaced by a fresh copy rather than written into.
function reset_like(target, source) {
    for (const key in source) {
        const from = source[key], to = target[key];
        if (from === to) continue;
        if (ArrayBuffer.isView(from) && ArrayBuffer.isView(to) && to.length === from.length) to.set(from);
        else if (is_state(from) && to !== null && typeof to === 'object' && Object.getPrototypeOf(from) === Object.getPrototypeOf(to)) reset_like(to, from);
        else if (Array.isArray(from) && Array.isArray(to) && from.length === to.length && from.length > 0 && from.every(is_state)) reset_like(to, from);
        else target[key] = deep_clone(from);
    }
}
// harsh.hpp SpeechADSR: per-syllable envelope for articulated material speech.
class SpeechADSR {
    constructor() { this.stage = 0; this.value = 0; this.release_step = 0; }
    off(ms, sr) { if (this.stage !== 0 && this.stage !== 4) { this.stage = 4; this.release_step = this.value / Math.max(1, ms * sr * .001); } }
    next(s, held, onset, sr) {
        if (onset && held) { this.stage = 1; this.value = 0; }
        if (!held) this.off(s.release_ms, sr);
        switch (this.stage) {
            case 1: this.value += 1 / Math.max(1, s.attack_ms * sr * .001); if (this.value >= 1) { this.value = 1; this.stage = 2; } break;
            case 2: this.value -= (1 - s.sustain) / Math.max(1, s.decay_ms * sr * .001); if (this.value <= s.sustain) { this.value = s.sustain; this.stage = 3; } break;
            case 3: this.value = s.sustain; break;
            case 4: this.value -= this.release_step; if (this.value <= 1e-12) { this.value = 0; this.stage = 0; } break;
            default: this.value = 0;
        }
        return this.value;
    }
}
let PRISTINE_VOICE = null;
function pristine_voice() { return PRISTINE_VOICE || (PRISTINE_VOICE = new Voice()); }

class Voice {
    constructor() {
        this.track_owner = -1;
        this.layer_index = 0;
        this.channel_spatial = false;
        this.smooth_params = false;
        this.track_gain = 1; this.target_track_gain = 1;
        this.track_pan = 0; this.target_track_pan = 0;
        this.physical = new MaterialInstrument();
        this.gate = false;
        this.pitch = 60;
        this.serial = 0;
        this.velocity = 0;
        this.p = default_params();
        this.env_params = new Float64Array(PARAM_COUNT);
        this.body_params = new Float64Array(PARAM_COUNT);
        this.mod_scratch = new Float64Array(4);
        this.seed_a = { val: 0 }; this.seed_b = { val: 0 };
        this.live_features = default_features();
        this.target = default_params();
        this.env = new Envelope();
        this.body = new Envelope();
        this.filter = new Filter();
        this.hp_filter = new Filter();

        this.pluck = new Float64Array(32768);
        this.pluck_cursor = 0;
        this.pluck_last = 0;

        this.engine_weights = new Float64Array(12);
        this.engine_weights[0] = 1.0;

        this.mode_y1 = new Float64Array(24);
        this.mode_y2 = new Float64Array(24);
        this.mode_a1 = new Float64Array(24);
        this.mode_a2 = new Float64Array(24);
        this.mode_gain = new Float64Array(24);
        this.mode_drive = new Float64Array(24);
        this.mode_detune = new Float64Array(24);
        this.mode_jitter = new Float64Array(24);
        this.mode_clock = 0;

        this.material = null;
        this.material_sfx = false;
        this.has_harsh = false;
        this.render_clock = 0;
        this.material_phoneme = -1;
        this.material_amplitude = 1;
        this.syllable_adsr = new SpeechADSR();
        this.keyboard_profile = false;
        this.keyboard_slot = -1;

        this.own = false;
        this.modes_seeded = false;
        this.formants_ready = false;
        this.sub_flip = false;
        this.own_features = { algorithm: 0, material: 0, exciter: 0, body: 0, metal: 0, rupture: 0, motion: 0, space: 0, humanise: 0, reverb: 0, resonance: 0, routes: [] };
        this.sfx = {};
        this.group = 0;
        this.body_slot = 0;
        this.fine = 0;
        this.tail = 0;

        this.chamber_line = new Float64Array(8192);
        this.chamber_cursor = 0;
        this.reverse_grain = [new Float64Array(4096), new Float64Array(4096)];
        this.reverse_cursor = 0;
        this.reverse_bank = 0;
        this.reverse_ready = false;

        this.modal_level = 0; this.bounce_next = 0; this.bounce_interval = 0; this.bounce_amp = 1;
        this.clash_time = 0; this.scrape_clock = 0; this.click = 0; this.click_left = 0;

        this.formant = [new Filter(), new Filter(), new Filter(), new Filter()];
        this.formant_hz = new Float64Array(4);
        this.formant_g = new Float64Array(4);
        this.formant_clock = 0;
        this.phoneme = 0; this.phoneme_time = 0; this.voice_phase = 0; this.voice_pitch = 0; this.voice_amp = 0;
        this.jitter = 0; this.shimmer = 1; this.glottis = 0; this.hiss = 0;

        this.coefficient_sr = 0; this.smoothing = 0; this.weight_smoothing = 0;
        this.formant_follow = 0; this.pitch_follow = 0; this.amp_follow = 0;
        this.rumble_lp = 0; this.rumble_follow = 0; this.tail_fall = 0;
        this.base_hz = 0; this.filter_g = 0; this.filter_clock = 0;
        this.hp_g = 0;
        this.pink = new Float64Array(7); this.brown = 0;
        this.rumble = 0; this.rumble_am = 0; this.rumble_target = 0; this.rumble_clock = 0;
        this.crack = 0; this.boom_phase = 0;
        this.strike_pitch = 0; this.strike_brightness = 0; this.strike_attack = 0; this.strike_gain = 0;
        this.metal_phase1 = 0; this.metal_phase2 = 0;
        this.phase = 0; this.subphase = 0; this.fmphase = 0; this.ringphase = 0; this.warpphase = 0;
        this.chopphase = 0; this.anchorphase = 0; this.bodyphase = 0; this.audio_phase = 0; this.modnoise = 0;
        this.delay = new Float64Array(8192);
        this.input_delay = new Float64Array(8192);
        this.cursor = 0;
        this.random = 1;
        this.age = 0;
    }
    noise() {
        let r = this.random;
        r ^= (r << 13) >>> 0;
        r ^= (r >>> 17);
        r ^= (r << 5) >>> 0;
        this.random = r >>> 0;
        return (this.random / 2147483648.0) - 1.0;
    }
    static advance(obj, key, hz, sr) {
        obj[key] += hz / sr;
        obj[key] -= Math.floor(obj[key]);
    }
    static blep(t, dt) {
        dt = clamp(Math.abs(dt), 0.000001, 0.49);
        if (t < dt) { t /= dt; return t + t - t * t - 1.0; }
        if (t > 1.0 - dt) { t = (t - 1.0) / dt; return t * t + t + t + 1.0; }
        return 0.0;
    }
    static saw(t, dt) {
        return 2.0 * t - 1.0 - Voice.blep(t, dt);
    }
    start(note, vel, id, seed) {
        // Native rebuilds the voice in place (engine.hpp Voice::start); copy a pristine voice instead of allocating.
        reset_like(this, pristine_voice());
        this.physical.seed(seed ? (seed | 1) >>> 0 : (id | 1) >>> 0);
        this.pitch = note;
        this.velocity = clamp(vel / 127.0, 0.0, 1.0);
        this.gate = true;
        this.serial = id;
        this.random = seed ? (seed | 1) >>> 0 : (Math.floor(id * 747796405 + note * 2891336453) | 1) >>> 0;
        this.env.on();
        this.body.on();
        const seedObj = { val: (this.random ^ 0x9e3779b9) >>> 0 };
        this.strike_pitch = random_bipolar(seedObj);
        this.strike_brightness = random_bipolar(seedObj);
        this.strike_attack = random_bipolar(seedObj);
        this.strike_gain = random_bipolar(seedObj);
    }
    note_off(sr) {
        this.gate = false;
        let release_ms = this.target[6]; // RELEASE
        if (this.material && !this.material_sfx && this.material.settings.speech_adsr) {
            release_ms = Math.max(release_ms, this.material.settings.release_ms);
            this.syllable_adsr.off(this.material.settings.release_ms, sr);
        }
        this.env.off(release_ms, sr);
        this.body.off(35.0, sr);
    }
    active() {
        return this.env.stage !== 0 || this.body.stage !== 0;
    }
    sample(sr, features, modulation, character = 0) {
        if (this.coefficient_sr !== sr) {
            this.coefficient_sr = sr;
            this.smoothing = 1.0 - Math.exp(-1.0 / (sr * 0.004));
            this.weight_smoothing = 1.0 - Math.exp(-1.0 / (sr * 0.025));
            this.formant_follow = 1.0 - Math.exp(-1.0 / (sr * 0.025));
            this.pitch_follow = 1.0 - Math.exp(-1.0 / (sr * 0.03));
            this.amp_follow = 1.0 - Math.exp(-1.0 / (sr * 0.006));
            this.rumble_lp = 1.0 - Math.exp(-TAU * 90.0 / sr);
            this.rumble_follow = 1.0 - Math.exp(-1.0 / (sr * 0.05));
            this.tail_fall = 1.0 - 1.0 / (sr * 0.05);
        }
        const lean = this.own;
        if (!lean || this.smooth_params) {
            for (let i = 0; i < PARAM_COUNT; i++) this.p[i] += (this.target[i] - this.p[i]) * this.smoothing;
        }

        const env_p = this.env_params;
        env_p.set(this.p);
        env_p[3] *= 1.0 + (features.humanise || 0) * this.strike_attack * 0.28;
        const e = this.env.next(env_p, sr) * this.velocity;

        const bp = this.body_params;
        bp.set(this.p);
        bp[3] = 1.0; bp[4] = this.p[26]; bp[5] = 0.0; // ATTACK=1, DECAY=DRUMDECAY, SUSTAIN=0
        const be = this.body.next(bp, sr) * this.velocity;

        const ms = this.age * 1000.0;
        const sfx = this.sfx || {};
        const contour_pitch = (this.fine || 0) + sfx.pitch_from +
            (sfx.pitch_ms > 0 ? (sfx.pitch_to - sfx.pitch_from) * Math.pow(clamp(ms / sfx.pitch_ms, 0.0, 1.0), Math.max(0.05, sfx.pitch_curve)) : 0);
        const contour_cutoff = sfx.cutoff_from +
            (sfx.cutoff_ms > 0 ? (sfx.cutoff_to - sfx.cutoff_from) * clamp(ms / sfx.cutoff_ms, 0.0, 1.0) : 0);

        if (this.own && this.gate && sfx.hold_ms >= 0 && ms >= sfx.hold_ms) this.note_off(sr);
        if (this.own && this.gate && features.algorithm >= 10 && sfx.hold_ms < 0 && ms > sfx.physical.gesture_ms + 250 + 800 * (1 - sfx.physical.damping)) this.note_off(sr);
        if (this.base_hz === 0) this.base_hz = 440.0 * Math.pow(2.0, (this.pitch - 69.0) / 12.0);
        const base = this.base_hz;
        const mod = this.mod_scratch;
        mod.set(modulation);
        let envelope_pitch = 0, audio_fm = 0;
        if (features.routes) {
            for (let i = 0; i < features.routes.length; i++) {
                const r = features.routes[i];
                if (lean && r.amount === 0) continue;
                if (r.source < 3) { // LFOs
                    if (!this.own || features.motion === 0) continue;
                    const clock = this.age * (0.08 + features.motion * 2.5);
                    let val = 0;
                    if (r.source === 0) val = Math.sin(TAU * clock);
                    else {
                        const step_clock = clock * (r.source === 1 ? 0.47 : 2.3);
                        const a = ((Math.floor(step_clock) * 2654435761 + this.serial) | 1) >>> 0;
                        const b = (a + 2654435761) >>> 0;
                        const seedA = this.seed_a, seedB = this.seed_b;
                        seedA.val = a; seedB.val = b;
                        const first = random_bipolar(seedA), second = random_bipolar(seedB);
                        let blend = step_clock - Math.floor(step_clock);
                        blend = blend * blend * (3.0 - 2.0 * blend);
                        val = r.source === 1 ? first + (second - first) * blend : first;
                    }
                    const depth = val * r.amount * features.motion;
                    if (r.destination === 1) envelope_pitch += depth;
                    else mod[r.destination] += depth;
                    continue;
                }
                const v = (r.source === 3 ? this.env.value : (r.source === 4 ? Math.exp(-this.age * 14.0) : Math.sin(TAU * this.audio_phase))) * r.amount * (features.motion || 0);
                if (r.destination === 1) {
                    if (r.source === 5) audio_fm += v;
                    else envelope_pitch += v;
                } else mod[r.destination] += v;
            }
        }
        for (let i = 0; i < 4; i++) mod[i] = clamp(mod[i], -1.5, 1.5);

        let frequency = 440.0 * Math.pow(2.0, (this.pitch + contour_pitch + this.p[11] + (features.humanise || 0) * this.strike_pitch * 0.075 + modulation[1] * 0.7 + envelope_pitch * 12.0 - 69.0) / 12.0) +
            (lean && this.p[7] === 0 && (features.metal || 0) === 0 ? 0 : Math.sin(TAU * this.fmphase) * (this.p[7] + base * (features.metal || 0) * 0.35)) +
            e * this.p[21] + (lean && this.p[23] === 0 ? 0 : Math.sin(TAU * this.warpphase) * this.p[23]) + audio_fm * base * 2.0;

        frequency = clamp(frequency, -sr * 0.44, sr * 0.44);
        const dt = Math.abs(frequency) / sr;
        const sw = Voice.saw(this.phase, dt);
        const pulse = (this.phase > this.p[29] ? 1.0 : -1.0) - Voice.blep(this.phase, dt) + Voice.blep((this.phase - this.p[29] + 1.0) % 1.0, dt);
        const sub = (this.subphase > 0.5 ? 1.0 : -1.0) - Voice.blep(this.subphase, dt * 0.5) + Voice.blep((this.subphase + 0.5) % 1.0, dt * 0.5);
        const legacy = lean && this.p[27] === 0 ? 0 : (Math.sin(TAU * this.phase) * (1.0 - this.p[12]) + sw * this.p[12]) * this.p[27];
        const synth = (sw + pulse * this.p[30] + sub * this.p[31]) * 0.42 * this.p[28];
        const orig = legacy + synth;

        for (let i = 0; i < 12; i++) {
            this.engine_weights[i] += ((i === (features.algorithm || 0) ? 1.0 : 0.0) - this.engine_weights[i]) * this.weight_smoothing;
        }

        let source = orig * this.engine_weights[0];
        if (this.engine_weights[1] > 0.00001) { // FOLDED
            source += fold_wave(orig * (1.8 + (features.rupture || 0) * 5.0 + (features.metal || 0) * 2.0)) * this.engine_weights[1];
        }
        if (this.engine_weights[2] > 0.00001) { // METAL
            let ring = Math.sin(TAU * this.phase + Math.sin(TAU * this.metal_phase1) * (1.2 + (features.metal || 0) * 5.0));
            ring = (ring * 0.7 + Math.sin(TAU * this.metal_phase2) * 0.3) * Math.exp(-this.age * (0.25 + (1.0 - (features.body || 0)) * 1.3));
            source += ring * this.engine_weights[2];
        }
        if (this.engine_weights[3] > 0.00001) { // PLUCKED
            const length = clamp(sr / (base * Math.pow(2.0, (features.humanise || 0) * this.strike_pitch * 0.075 / 12.0)), 2.0, 32766.0);
            let pos = this.pluck_cursor - length;
            if (pos < 0) pos += 32768;
            const idx = Math.floor(pos);
            const frac = pos - idx;
            const delayed = this.pluck[idx] * (1.0 - frac) + this.pluck[(idx + 1) % 32768] * frac;
            const excitation = this.age < 0.004 ? this.noise() * 0.65 : 0;
            const loop = (delayed * (0.5 + (features.metal || 0) * 0.3) + this.pluck_last * (0.5 - (features.metal || 0) * 0.3)) * (0.973 + (features.body || 0) * 0.025);
            this.pluck_last = delayed;
            this.pluck[this.pluck_cursor] = clamp(excitation + loop, -2.0, 2.0);
            this.pluck_cursor = (this.pluck_cursor + 1) % 32768;
            source += delayed * 1.6 * this.engine_weights[3];
        }
        if (this.engine_weights[4] > 0.00001) { // WAVETABLE
            source += table_wave(this.phase + Math.sin(TAU * this.metal_phase1) * (features.metal || 0) * 0.04, clamp((features.body || 0) + mod[0] * 0.12, 0.0, 1.0)) * this.engine_weights[4];
        }
        const struck = this.engine_weights[5] <= 0.00001 && this.engine_weights[6] <= 0.00001 ? 0 :
            base * Math.pow(2.0, (contour_pitch + (features.humanise || 0) * this.strike_pitch * 0.075 + modulation[1] * 0.7 + envelope_pitch * 12.0) / 12.0);
        if (this.engine_weights[5] > 0.00001) source += this.modal_bank(orig, struck, features, sr, true) * this.engine_weights[5];
        if (this.engine_weights[6] > 0.00001) source += this.modal_bank(orig * sfx.bow, struck, features, sr, false) * this.engine_weights[6];
        if (this.engine_weights[7] > 0.00001) source += this.formant_voice(frequency, sr) * this.engine_weights[7];
        if (this.engine_weights[8] > 0.00001) source += this.blast(frequency, sr) * this.engine_weights[8];
        if (this.engine_weights[10] > 0.00001) source += this.physical.process(frequency, sr, false, this.gate, sfx.physical || {}, sfx.position, this.keyboard_profile && sfx.physical && sfx.physical.gesture === 1) * this.engine_weights[10];
        if (this.engine_weights[11] > 0.00001) source += this.physical.process(frequency, sr, true, this.gate, sfx.physical || {}, sfx.position, this.keyboard_profile && sfx.physical && sfx.physical.gesture === 1) * this.engine_weights[11];

        let src = source + this.noise() * this.p[9] + (lean && (features.body || 0) === 0 ? 0 : Math.sin(TAU * this.anchorphase) * (features.body || 0) * 0.28);
        if (this.material && this.material_sfx) {
            src = this.material.source(src * 0.4, e > 0 ? e : 0, this.age === 0, 1.0, this.render_clock, sr) * 2.0;
        }

        if (!(lean && this.p[34] === 0)) { // PADWET
            const delay_samples = clamp(this.p[32] * sr * 0.001, 1.0, 8190.0);
            let read = this.cursor - delay_samples;
            if (read < 0) read += 8192;
            const index = Math.floor(read);
            const frac = read - index;
            const delayed = this.delay[index] * (1.0 - frac) + this.delay[(index + 1) % 8192] * frac;
            const input_delayed = this.input_delay[index] * (1.0 - frac) + this.input_delay[(index + 1) % 8192] * frac;
            const comb = 0.35 * src + 0.15 * input_delayed + clamp(this.p[33], 0.0, 0.85) * delayed;
            this.input_delay[this.cursor] = src;
            this.delay[this.cursor] = clamp(comb, -8.0, 8.0);
            this.cursor = (this.cursor + 1) % 8192;
            src += comb * this.p[34];
        }

        const ring_depth = clamp(this.p[17] + (features.metal || 0) * 0.45 + mod[2] * 0.45, 0.0, 1.0);
        if (!(lean && ring_depth === 0)) src *= 1.0 - ring_depth + Math.sin(TAU * this.ringphase) * ring_depth;

        const slide = Math.max(1.0, 22050.0 / (this.p[13] + 0.02));
        this.modnoise += (this.noise() - this.modnoise) / slide;
        let cutoff = this.p[1] + this.modnoise * this.p[14] * 2400.0 + (lean && this.p[23] === 0 ? 0 : Math.sin(TAU * this.warpphase) * this.p[23] * 6.0);
        cutoff *= Math.pow(2.0, contour_cutoff + mod[0] * 1.6 - (features.body || 0) * 0.7 + (features.humanise || 0) * this.strike_brightness * 0.35 + character * 1.8);

        let bands;
        if (lean) {
            if (this.filter_clock-- <= 0) {
                this.filter_clock = 8;
                this.filter_g = Math.tan(PI * clamp(cutoff, 20.0, sr * 0.40) / sr);
            }
            bands = this.filter.process_g(src, this.filter_g, this.p[2]);
        } else {
            bands = this.filter.process(src, cutoff, this.p[2], sr);
        }

        let filtered = bands.low * (1.0 - this.p[19]) + bands.high * this.p[19] + bands.mid * this.p[20];
        if (sfx.hp > 0) {
            if (this.hp_g === 0) this.hp_g = Math.tan(PI * clamp(sfx.hp, 20.0, sr * 0.40) / sr);
            filtered = this.hp_filter.process_g(filtered, this.hp_g, 0.3).high;
        }

        const driven = filtered * this.p[10] * (1.0 + (features.rupture || 0) * 3.0);
        const limited = sfx.soft_clip >= 0.5 ? Math.tanh(driven) : clamp(driven, -1.0, 1.0);
        const clipped = lean && (features.rupture || 0) === 0 ? limited : limited * (1.0 - (features.rupture || 0) * 0.6) + fold_wave(driven) * (features.rupture || 0) * 0.6;
        const chopped = lean && this.p[18] === 0 ? clipped : clipped * (1.0 - this.p[18] + (Math.sin(TAU * this.chopphase) > 0 ? 1.0 : 0.0) * this.p[18]);
        const anchor = Math.floor(this.target[0]) === 3 ? Math.sin(TAU * this.anchorphase) * 0.5 : 0;
        const result = ((chopped + anchor) * e + (lean && this.p[25] === 0 ? 0 : Math.sin(TAU * this.bodyphase) * this.p[25] * be)) *
            (1.0 + (features.humanise || 0) * this.strike_gain * 0.08) * (1.0 - clamp(mod[3], -1.0, 1.0) * 0.35);

        Voice.advance(this, 'metal_phase1', base * (1.41421356 + (features.metal || 0) * 1.73), sr);
        Voice.advance(this, 'metal_phase2', base * (2.71 + (features.body || 0) * 0.6), sr);
        Voice.advance(this, 'phase', frequency, sr);
        Voice.advance(this, 'subphase', frequency * 0.5, sr);
        Voice.advance(this, 'fmphase', this.p[8], sr);
        Voice.advance(this, 'ringphase', this.p[16], sr);
        Voice.advance(this, 'warpphase', this.p[22], sr);
        Voice.advance(this, 'chopphase', this.p[13], sr);
        Voice.advance(this, 'anchorphase', base, sr);
        Voice.advance(this, 'bodyphase', this.p[24], sr);
        Voice.advance(this, 'audio_phase', base * (1.0 + (features.metal || 0) * 1.414), sr);
        this.age += 1.0 / sr;

        if (!Number.isFinite(result)) {
            this.env.stage = 0; this.body.stage = 0; return 0;
        }
        if (this.own) {
            let res = result * (sfx.gain != null ? sfx.gain : 1.0);
            this.tail = Math.max(Math.abs(res), this.tail * this.tail_fall);
            if (this.age > 0.12 && this.tail < 0.0001 && !((features.algorithm || 0) >= 10 && this.gate && this.age < (sfx.physical ? sfx.physical.gesture_ms : 650) * 0.001 + 0.05)) {
                this.env.stage = 0; this.body.stage = 0;
            }
            return res;
        }
        return result;
    }
    modal_bank(drive, hz, features, sr, musical) {
        const material = clamp(features.material || 0, 0, 7);
        if (!this.modes_seeded) {
            const seedObj = { val: (this.random ^ 0x85ebca6b) >>> 0 };
            const spread = musical ? 0 : this.sfx.spread;
            for (let k = 0; k < 24; k++) {
                this.mode_detune[k] = spread * 0.012 * random_bipolar(seedObj);
                this.mode_jitter[k] = Math.max(0.15, 1.0 + spread * 0.45 * random_bipolar(seedObj));
            }
            this.clash_time = 0.003 + 0.009 * Math.abs(random_bipolar(seedObj));
            this.bounce_interval = this.sfx.bounce_ms * 0.001 * (1.0 + spread * 0.25 * random_bipolar(seedObj));
            this.bounce_next = 0;
            this.bounce_amp = 1.0;
            this.modes_seeded = true;
        }
        if (this.mode_clock-- <= 0) {
            this.mode_clock = 32;
            const level = clamp(this.modal_level * 6.0, 0.0, 1.0);
            const first = musical ? MATERIAL_RATIOS[0][0] * Math.pow(MATERIAL_RATIOS[1][0] / MATERIAL_RATIOS[0][0], features.metal || 0) :
                (material === 7 ? 1.0 : MATERIAL_RATIOS[material][0]);

            for (let k = 0; k < 24; k++) {
                let ratio;
                if (musical) ratio = MATERIAL_RATIOS[0][k] * Math.pow(MATERIAL_RATIOS[1][k] / MATERIAL_RATIOS[0][k], features.metal || 0);
                else if (material === 7) ratio = Math.pow(k + 1.0, 1.0 + this.sfx.warp * 0.6) * (1.0 + 0.05 * Math.sin((k + 1.0) * (1.0 + this.sfx.warp * 7.0)));
                else ratio = MATERIAL_RATIOS[material][k] * (1.0 + (features.metal || 0) * 0.012 * k);
                ratio *= 1.0 + this.mode_detune[k];

                const f = hz * ratio * (1.0 + this.sfx.tension * level * 0.06 * (musical ? 0 : 1));
                if (f > sr * 0.45 || f < 15.0) {
                    this.mode_a1[k] = this.mode_a2[k] = this.mode_gain[k] = this.mode_drive[k] = 0;
                    continue;
                }
                let t60 = musical ? (0.35 + (features.body || 0) * 3.6) / (1.0 + k * (0.45 - (features.body || 0) * 0.25)) :
                    this.sfx.decay * (1.0 + (features.body || 0)) * Math.pow(Math.max(1.0, ratio / first), -MATERIAL_SLOPE[material]);
                t60 = Math.max(0.004, t60);
                const r = Math.exp(-6.907755 / (t60 * sr));
                const w = TAU * f / sr;
                const s = Math.sin(w);
                const amplitude = musical ? Math.pow(k + 1.0, -(0.35 + (features.body || 0) * 0.6)) :
                    Math.pow(k + 1.0, -(0.2 + (1.0 - this.sfx.hardness) * 1.3)) * (0.15 + 0.85 * Math.abs(Math.sin((k + 1.0) * PI * this.sfx.position))) * this.mode_jitter[k];

                this.mode_a1[k] = 2.0 * r * Math.cos(w);
                this.mode_a2[k] = r * r;
                this.mode_gain[k] = s * amplitude;
                this.mode_drive[k] = (1.0 - r) * s * amplitude;
            }
        }

        let excitation = 0;
        if (musical) {
            excitation = this.age < 0.0015 ? this.noise() * 0.5 * (0.5 - 0.5 * Math.cos(TAU * this.age / 0.0015)) : 0;
        } else {
            const strike = (amount, seconds) => { this.click = amount; this.click_left = Math.max(1.0, seconds * sr); };
            const exciter = clamp(features.exciter || 0, 0, 4);
            switch (exciter) {
                case 0: { // MALLET
                    const length = 0.0008 + (1.0 - this.sfx.hardness) * 0.006;
                    if (this.age < length) excitation = (0.5 - 0.5 * Math.cos(TAU * this.age / length)) * (1.0 + this.noise() * this.sfx.hardness * 0.5) * 0.8;
                    break;
                }
                case 1: // HAMMER
                    if (this.age === 0) strike(1.4, 0.0004);
                    break;
                case 2: // SCRAPE
                    if (this.gate) {
                        this.scrape_clock += this.sfx.scrape_rate * (1.0 + 0.6 * this.noise()) / sr;
                        if (this.scrape_clock >= 1.0) { this.scrape_clock -= 1.0; excitation += this.noise() * 0.9; }
                        const n = this.noise();
                        this.hiss += (n - this.hiss) * 0.3;
                        excitation += (n - this.hiss) * 0.25;
                        excitation *= Math.min(1.0, this.age / 0.01);
                    }
                    break;
                case 3: // BOUNCE
                    if (this.age >= this.bounce_next && this.bounce_amp > 0.03 && this.bounce_interval > 0.006) {
                        strike(1.2 * this.bounce_amp, 0.0004);
                        this.bounce_next += this.bounce_interval;
                        this.bounce_interval *= this.sfx.bounce_ratio;
                        const sObj = { val: (this.random ^ Math.floor(this.bounce_next * 1e6)) >>> 0 };
                        this.bounce_amp *= 0.55 + 0.25 * Math.abs(random_bipolar(sObj));
                    }
                    break;
                case 4: // CLASH
                    if (this.age === 0) strike(1.3, 0.0004);
                    if (this.age < this.clash_time && this.age + 1.0 / sr >= this.clash_time) strike(1.0, 0.0004);
                    if (this.age < 0.06) {
                        const n = this.noise();
                        this.hiss += (n - this.hiss) * 0.3;
                        excitation += (n - this.hiss) * 0.35 * (1.0 - this.age / 0.06);
                    }
                    break;
            }
            if (this.click_left > 0) {
                excitation += this.noise() * this.click;
                this.click_left--;
            }
        }

        let out = 0;
        for (let k = 0; k < 24; k++) {
            const y = this.mode_a1[k] * this.mode_y1[k] - this.mode_a2[k] * this.mode_y2[k] + excitation * this.mode_gain[k] + drive * this.mode_drive[k];
            this.mode_y2[k] = this.mode_y1[k];
            this.mode_y1[k] = y;
            out += y;
        }
        this.modal_level += (Math.abs(out) - this.modal_level) * 0.0005;
        if (!musical && this.sfx.clang > 0) out = out * (1.0 - this.sfx.clang) + Math.tanh(out * (1.0 + this.sfx.clang * 8.0)) * this.sfx.clang * 0.6;
        return clamp(out * (musical ? 0.3 : 0.28), -3.0, 3.0);
    }
    // Line-for-line port of Voice::formant_voice (native/engine.hpp).
    formant_voice(hz, sr) {
        const sfx = this.sfx, material = this.material;
        let pitch_target = 0, amp_target = 1, voicing = 1, fricative = 0, burst = 0, syllable_ms = 0, syllable_fraction = 0, consonant_length = 0;
        let speaking = true;
        const current_phoneme = this.phoneme;
        let targets = VOWEL_FORMANTS[clamp(sfx.vowel, 0, 9)];
        if (sfx.phoneme_count > 0) {
            if (this.phoneme < sfx.phoneme_count) {
                const ph = sfx.phonemes[this.phoneme];
                const t = this.phoneme_time * 1000;
                syllable_ms = t; syllable_fraction = clamp(t / Math.max(1, ph.ms), 0, 1);
                targets = VOWEL_FORMANTS[clamp(ph.vowel, 0, 9)]; pitch_target = ph.pitch; amp_target = ph.amp;
                const consonant_ms = ph.consonant === 1 ? 28 : ph.consonant === 2 ? 65 : ph.consonant === 3 ? 55 : ph.consonant === 4 ? 40 : 0;
                consonant_length = consonant_ms;
                if (ph.consonant === 5) { voicing = 0; amp_target = 0; speaking = false; }
                else if (t < consonant_ms) {
                    switch (ph.consonant) {
                        case 1: voicing = 0; amp_target = 1; burst = t > 18 ? 1 : 0; break;
                        case 2: voicing = .12; fricative = 1; break;
                        case 3: targets = NASAL_FORMANTS; amp_target *= .55; break;
                        case 4: targets = LIQUID_FORMANTS; break;
                    }
                }
                // Dip between syllables so the stream articulates instead of smearing.
                if (!sfx.sustain_syllable && (!material || !material.settings.speech_adsr) && (ph.consonant !== 1 || t >= consonant_ms)) amp_target *= clamp(Math.min(t / 10, (ph.ms - t) / 18), 0, 1);
                if (!sfx.sustain_syllable && material && speaking && !material.settings.speech_adsr) {
                    // Impact-shaped vowel energy: fast attack, short decay, then an actual gap.
                    const decay_ms = 18 + ph.ms * (.32 - .21 * material.settings.articulation);
                    amp_target *= Math.exp(-Math.max(0, t - consonant_ms) / decay_ms);
                }
                this.phoneme_time += 1 / sr;
                if (this.phoneme_time * 1000 >= ph.ms) {
                    if (sfx.sustain_syllable && this.phoneme === sfx.phoneme_count - 1) this.phoneme_time = Math.max(70, ph.ms - 20) / 1000;
                    else { this.phoneme++; this.phoneme_time = 0; }
                }
            } else { voicing = 0; amp_target = 0; speaking = false; if (this.gate) this.note_off(sr); }
        }
        const custom_adsr = Boolean(material && material.settings.speech_adsr);
        const syllable_onset = Boolean(material) && current_phoneme !== this.material_phoneme;
        if (custom_adsr) {
            if (speaking) this.material_amplitude = amp_target; else pitch_target = this.voice_pitch;
            amp_target = this.material_amplitude * this.syllable_adsr.next(material.settings, speaking && this.gate, syllable_onset, sr);
        }
        if (sfx.reverse_envelope > 0) amp_target *= 1 - sfx.reverse_envelope + sfx.reverse_envelope * syllable_fraction * syllable_fraction;
        this.voice_pitch += (pitch_target - this.voice_pitch) * this.pitch_follow;
        this.voice_amp += (amp_target - this.voice_amp) * (material ? 1 - Math.exp(-1 / (sr * .0015)) : this.amp_follow);
        this.jitter += (this.noise() - this.jitter) * .002;
        const f0 = clamp(hz * Math.pow(2, this.voice_pitch / 12) * (1 + sfx.roughness * .04 * this.jitter), 20, sr * .4), dt = f0 / sr;
        let pulse = -Voice.saw(this.voice_phase, dt);
        if (this.voice_phase + dt >= 1) { this.shimmer = 1 + sfx.roughness * .5 * this.noise(); this.sub_flip = !this.sub_flip; }
        Voice.advance(this, 'voice_phase', f0, sr);
        pulse *= this.shimmer * (this.sub_flip ? 1 - sfx.subharmonic * .7 : 1);
        this.glottis += (pulse - this.glottis) * .35;
        let excitation;
        if (material) {
            const onset = syllable_onset && (!custom_adsr || speaking); this.material_phoneme = current_phoneme;
            const hit = Math.exp(-syllable_ms / (2.5 + (1 - material.settings.articulation) * 8));
            const friction = Math.exp(-Math.max(0, syllable_ms - consonant_length) / 35);
            const source_open = custom_adsr ? this.syllable_adsr.value > 0 : speaking;
            const excite = source_open ? this.noise() * ((speaking ? hit : 0) * .8 + (custom_adsr ? 1 : friction) * (.045 + sfx.breath * .12)) : 0;
            excitation = material.source(excite, custom_adsr ? this.syllable_adsr.value : (speaking ? amp_target : 0), onset, Math.pow(2, this.voice_pitch / 12), this.render_clock, sr) * 3;
        } else excitation = this.glottis * voicing * sfx.voicing + this.noise() * sfx.breath * .6 * (voicing > .5 ? 1 : .4);
        // Character treatments act on the synthesized carrier before vocal filtering and final articulation.
        if (sfx.carrier_ring > 0) excitation *= 1 - sfx.carrier_ring + sfx.carrier_ring * Math.sin(2 * PI * this.voice_phase * 3);
        if (sfx.flutter > 0) excitation *= 1 - sfx.flutter * .5 + sfx.flutter * .5 * Math.sin(this.age * 2 * PI * 17.3);
        if (sfx.fragment > 0) { const step = Math.floor(this.age * (23 + sfx.fragment * 157)); const mask = Math.sin(step * 12.9898 + this.pitch * 7.23); excitation *= mask > sfx.fragment * .45 ? 1 : .04; }
        if (sfx.reverse_mix > 0) {
            // Double-buffered, windowed reverse grains. Only engine-generated audio enters this memory.
            const size = clamp(Math.trunc(sr * sfx.reverse_ms * .001), 16, 4096);
            this.reverse_grain[this.reverse_bank][this.reverse_cursor] = excitation;
            const reversed = this.reverse_ready ? this.reverse_grain[1 - this.reverse_bank][size - 1 - this.reverse_cursor] : 0;
            let window = Math.sin(PI * (this.reverse_cursor + .5) / size); window *= window;
            excitation = excitation * (1 - sfx.reverse_mix) + reversed * window * sfx.reverse_mix;
            if (++this.reverse_cursor >= size) { this.reverse_cursor = 0; this.reverse_bank = 1 - this.reverse_bank; this.reverse_ready = true; }
        }
        if (sfx.chamber > 0) {
            // Small inharmonic chamber in the carrier path, gated by the final syllable envelope.
            const line = this.chamber_line, c0 = this.chamber_cursor;
            const a = clamp(Math.trunc(sr * .019), 1, 8191), b = clamp(Math.trunc(sr * .0317), 1, 8191), c = clamp(Math.trunc(sr * .0423), 1, 8191);
            const reflected = (line[(c0 - a + 8192) % 8192] + line[(c0 - b + 8192) % 8192] * .71 - line[(c0 - c + 8192) % 8192] * .43) * .467;
            line[c0] = Math.tanh(excitation + reflected * .64); this.chamber_cursor = (c0 + 1) % 8192;
            excitation = excitation * (1 - sfx.chamber * .4) + reflected * sfx.chamber;
        }
        const scale = 1 / clamp(sfx.vocal_size, .4, 2.5), follow = this.formant_follow;
        const retune = this.formant_clock-- <= 0; if (retune) this.formant_clock = 16;
        const gains = FORMANT_TABLES.gains, res = FORMANT_TABLES.res;
        let out = 0;
        for (let i = 0; i < 4; i++) {
            const target = custom_adsr && !speaking && this.formants_ready ? this.formant_hz[i] : targets[i] * scale * (1 + sfx.formant_motion * .32 * Math.sin(this.age * (3.1 + i * 1.7) + i * 1.2));
            this.formant_hz[i] = this.formants_ready ? this.formant_hz[i] + (target - this.formant_hz[i]) * follow : target;
            if (retune || !this.formants_ready) this.formant_g[i] = Math.tan(PI * clamp(this.formant_hz[i], 20, sr * .4) / sr);
            out += this.formant[i].process_g(excitation, this.formant_g[i], res[i]).mid * (2 - 1.94 * res[i]) * gains[i];
        }
        this.formants_ready = true;
        const n = this.noise(); this.hiss += (n - this.hiss) * .2;
        if (material) out += excitation * (fricative * .45 + burst * .65); else out += (n - this.hiss) * fricative * .35 + burst * this.noise() * .5;
        return clamp(out * this.voice_amp * 2.2, -3, 3);
    }
    blast(hz, sr) {
        const n = this.noise();
        this.rumble += (n - this.rumble) * this.rumble_lp;
        if ((this.rumble_clock -= 1.0 / sr) <= 0) {
            this.rumble_clock = 0.08 + 0.1 * Math.abs(this.noise());
            this.rumble_target = 0.3 + 0.7 * Math.abs(this.noise());
        }
        this.rumble_am += (this.rumble_target - this.rumble_am) * this.rumble_follow;
        if (Math.abs(this.noise()) < this.sfx.crackle * 900.0 * Math.exp(-this.age * 2.5) / sr) {
            this.crack = (0.4 + 0.6 * Math.abs(this.noise())) * (this.noise() > 0 ? 1 : -1);
        }
        const debris = this.crack * this.noise();
        this.crack *= 1.0 - 1.0 / (sr * 0.002);
        const boom = Math.sin(TAU * this.boom_phase) * (this.sfx.boom_ms > 0 ? Math.exp(-6.907755 * this.age * 1000.0 / this.sfx.boom_ms) : Math.exp(-this.age * 1.2));
        Voice.advance(this, 'boom_phase', clamp(hz, 10.0, sr * 0.4), sr);
        let air = n;
        if (this.sfx.noise_color === 1) { // Pink
            this.pink[0] = 0.99886 * this.pink[0] + n * 0.0555179;
            this.pink[1] = 0.99332 * this.pink[1] + n * 0.0750759;
            this.pink[2] = 0.969 * this.pink[2] + n * 0.153852;
            this.pink[3] = 0.8665 * this.pink[3] + n * 0.3104856;
            this.pink[4] = 0.55 * this.pink[4] + n * 0.5329522;
            this.pink[5] = -0.7616 * this.pink[5] - n * 0.016898;
            air = (this.pink[0] + this.pink[1] + this.pink[2] + this.pink[3] + this.pink[4] + this.pink[5] + this.pink[6] + n * 0.5362) * 0.18;
            this.pink[6] = n * 0.115926;
        } else if (this.sfx.noise_color === 2) { // Brown
            this.brown = (this.brown + 0.02 * n) / 1.02;
            air = this.brown * 3.5;
        }
        return air * this.sfx.noise_amount * 0.45 + this.rumble * this.rumble_am * this.sfx.rumble * 3.2 + debris * 0.8 + boom * this.sfx.boom * 0.9;
    }
}

// ---------------------------------------------------------------------------
// Void Cantor Engine (engine.hpp)
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Stage effects (native/effects.hpp): per-organism insert chains played from the stage.
// A track gains a TrackFx bus only while it carries a chain; buffers are sized when a slot is created.
// ---------------------------------------------------------------------------
const FX_PARAM_NAMES = ["wet","amount","x","y","motion","held","p0","p1","p2","p3","p4","p5","p6","p7"];
const FX_WET = 0, FX_AMOUNT = 1, FX_X = 2, FX_Y = 3, FX_MOTION = 4, FX_HELD = 5, FX_P0 = 6, FX_P1 = 7, FX_P2 = 8, FX_P3 = 9, FX_P4 = 10, FX_P5 = 11, FX_P6 = 12, FX_P7 = 13, FX_PARAMS = 14;
const FX_KINDS = ["tape","distort","reverb","repeat"];
function fx_random(seed) { let v = seed.val; v ^= v << 13; v >>>= 0; v ^= v >>> 17; v ^= v << 5; v >>>= 0; seed.val = v; return v; }
function fx_noise(seed) { return fx_random(seed) / 2147483648 - 1; }
// Continuous stereo recording with Catmull-Rom reads behind the write head.
class FxHistory {
    constructor(frames) { this.size = frames; this.l = new Float32Array(frames); this.r = new Float32Array(frames); this.cursor = 0; this.out = { left: 0, right: 0 }; }
    write(x) { this.l[this.cursor] = x.left; this.r[this.cursor] = x.right; this.cursor = (this.cursor + 1) % this.size; }
    // lag in samples behind the newest frame (0 = newest).
    read(lag, out = this.out) {
        let pos = this.cursor - 1 - clamp(lag, 0, this.size - 4); while (pos < 0) pos += this.size;
        const i = Math.trunc(pos), f = pos - i, n = this.size;
        const cubic = b => { const a = b[((i - 1) % n + n) % n], c0 = b[i % n], c1 = b[(i + 1) % n], d = b[(i + 2) % n];
            return c0 + .5 * f * (c1 - a + f * (2 * a - 5 * c0 + 4 * c1 - d + f * (3 * (c0 - c1) + d - a))); };
        out.left = cubic(this.l); out.right = cubic(this.r); return out;
    }
}
// Varispeed tape. Slowing lets the read head fall behind live audio; a recovered motor crossfades back to live.
class TapeUnit {
    constructor(sr) { this.history = new FxHistory(Math.trunc(sr * 8)); this.speed = 1; this.lag = 0; this.old_lag = 0; this.fade = 1; this.fade_step = 0; this.wow = 0; this.flutter = 0; this.flutter_target = 0; this.flutter_clock = 0; this.seed = { val: 0x9e3779b9 }; this.state = 1; this.before = { left: 0, right: 0 }; this.result = { left: 0, right: 0 }; }
    clear() { this.speed = 1; this.lag = this.old_lag = 0; this.fade = 1; }
    jump(to, ms, sr) { this.old_lag = this.lag; this.lag = to; this.fade = 0; this.fade_step = 1 / Math.max(1, ms * sr * .001); }
    process(x, p, model, sr) {
        this.history.write(x);
        const limit = model === 0 ? .5 - .45 * clamp(p[FX_P0], 0, 1) : 1.25 + 1.75 * clamp(p[FX_P0], 0, 1);
        const target = 1 + (limit - 1) * clamp(p[FX_AMOUNT], 0, 1);
        this.speed += (target - this.speed) * (1 - Math.exp(-1 / (sr * (.03 + 1.97 * clamp(p[FX_P1], 0, 1)))));
        // Wow is slow capstan wobble, deepened by mouse movement; flutter is fast smoothed noise.
        this.wow += 6.283185307179586 * (.35 + .9 * p[FX_MOTION]) / sr; if (this.wow > 6.283185307179586) this.wow -= 6.283185307179586;
        this.flutter_clock += (4 + 26 * clamp(p[FX_P5], 0, 1)) / sr; if (this.flutter_clock >= 1) { this.flutter_clock -= 1; this.flutter_target = fx_noise(this.seed); }
        this.flutter += (this.flutter_target - this.flutter) * .002;
        const rate = this.speed * (1 + Math.sin(this.wow) * (.002 + .03 * p[FX_MOTION]) * clamp(p[FX_P3], 0, 1) * 2 + this.flutter * .006 * clamp(p[FX_P4], 0, 1));
        const recover_ms = 20 + 380 * clamp(p[FX_P2], 0, 1), window = sr * .35, limit_lag = this.history.size - 8;
        this.lag += 1 - rate; this.old_lag += 1 - rate;
        if (this.fade >= 1) {
            if (rate > 1 && this.lag <= 1) this.jump(Math.min(window, limit_lag), recover_ms, sr);
            else if (this.lag >= limit_lag) this.jump(0, recover_ms, sr);
            else if (p[FX_AMOUNT] < .002 && Math.abs(this.speed - 1) < .01 && this.lag > 1) this.jump(0, recover_ms, sr);
        }
        this.lag = clamp(this.lag, 0, limit_lag); this.old_lag = clamp(this.old_lag, 0, limit_lag);
        const now = this.history.read(this.lag, this.result);
        if (this.fade < 1) {
            const before = this.history.read(this.old_lag, this.before); const g = Math.sin(this.fade * 1.5707963267948966); this.fade = Math.min(1, this.fade + this.fade_step);
            const h = Math.cos(Math.asin(g));
            now.left = now.left * g + before.left * h; now.right = now.right * g + before.right * h;
        }
        this.state = rate; return now;
    }
}
// Circuit models: 0 germanium fuzz, 1 silicon clip, 2 tube, 3 diode rectifier, 4 bitcrusher, 5 wavefolder, 6 broken speaker.
class DistortUnit {
    constructor() { this.shape = [new Nonlinear(), new Nonlinear()]; this.tone = [new Filter(), new Filter()]; this.cone = [new Filter(), new Filter()]; this.delay = [new Float64Array(8), new Float64Array(8)];
        this.cursor = 0; this.env = 0; this.sag = 0; this.gate = 1; this.cut = 1; this.cut_clock = 0; this.seed = { val: 0x2545f491 }; this.state = 1; this.settings = default_harsh_settings(); this.v = [0, 0]; this.out = [0, 0]; this.result = { left: 0, right: 0 }; }
    clear() { for (const d of this.delay) d.fill(0); this.env = this.sag = 0; this.gate = this.cut = 1; }
    process(x, p, model, sr) {
        const amount = clamp(p[FX_AMOUNT], 0, 1), drive = clamp(.15 + amount * (.35 + .65 * clamp(p[FX_P0], 0, 1)), 0, 1);
        const starve = clamp(Math.abs(p[FX_X]), 0, 1) * clamp(p[FX_P1], 0, 1);
        const input = Math.max(Math.abs(x.left), Math.abs(x.right)); this.env += (input - this.env) * (input > this.env ? .01 : .0005);
        this.sag += (this.env * drive - this.sag) * .0003;
        const s = Object.assign(this.settings, HARSH_DEFAULTS); s.drive = drive;
        s.circuit = [1, 2, 0, 4, 6, 3, 1][clamp(model, 0, 6)];
        const bias = clamp(p[FX_P4], 0, 1);
        if (model === 0) s.bias = .15 + .45 * bias + starve * .5 - this.sag * .6;
        else if (model === 2) s.bias = .05 + .3 * bias - this.sag * .8;
        else if (model === 6) s.bias = .25 + starve * .4;
        if (model === 4) s.drive = clamp(drive * (.4 + .6 * clamp(p[FX_P5], 0, 1)), 0, 1);
        const pre = model === 5 ? 1 + clamp(p[FX_P6], 0, 1) * 5 : 1;
        // Starved circuits close below a rising threshold and sputter out in short random bursts.
        const threshold = starve * .12; this.gate += ((this.env > threshold ? 1 : 0) - this.gate) * (this.env > threshold ? .02 : .004);
        this.cut_clock -= 1;
        if (this.cut_clock <= 0) { this.cut_clock = sr * (.004 + .03 * fx_noise(this.seed) * fx_noise(this.seed)); const odds = starve * .6 + (model === 6 ? .15 * clamp(p[FX_P7], 0, 1) : 0); this.cut = (fx_noise(this.seed) * .5 + .5) < odds ? 0 : 1; }
        const hz = 800 + 17200 * clamp(p[FX_P2], 0, 1) * (model === 6 ? .35 : 1), trim = .25 + .75 * clamp(p[FX_P3], 0, 1);
        this.v[0] = x.left; this.v[1] = x.right;
        for (let c = 0; c < 2; c++) {
            this.delay[c][this.cursor] = this.v[c];
            let y = this.shape[c].process(this.v[c] * pre, s, sr);
            if (model === 6) { y = this.cone[c].process(y, 900, .55, sr).mid * 2.2; if (Math.abs(y) > .35 * (1 - .5 * clamp(p[FX_P7], 0, 1))) y += fx_noise(this.seed) * .25 * clamp(p[FX_P7], 0, 1) * Math.abs(y); }
            y = this.tone[c].process(y, hz, .1, sr).low * trim * this.gate * this.cut;
            this.out[c] = y;
        }
        this.cursor = (this.cursor + 1) % 8; const wet = clamp(p[FX_WET], 0, 1);
        // The 2x oversampler delays the wet path 8 samples; the dry path is delayed to match.
        this.state = drive;
        this.result.left = this.delay[0][this.cursor] * (1 - wet) + this.out[0] * wet; this.result.right = this.delay[1][this.cursor] * (1 - wet) + this.out[1] * wet;
        return this.result;
    }
}
// Models: 0 spring, 1 plate, 2 cathedral, 3 resonant tube, 4 feedback cavity. Wet is the send, so a released tail keeps ringing.
class ReverbUnit {
    constructor() { this.hall = new ResonantReverb(); this.comb_size = 8192; this.spring_size = 8192; this.pre_size = 24000;
        this.comb = [new Float64Array(8192), new Float64Array(8192)]; this.comb_damp = [0, 0]; this.comb_cursor = 0;
        this.spring_ap = Array.from({ length: 6 }, () => new Float64Array(512)); this.spring_cursor = [0, 0, 0, 0, 0, 0]; this.spring_line = new Float64Array(8192); this.spring_cursor_line = 0; this.spring_damp = 0; this.drip = 0;
        this.pre_l = new Float64Array(24000); this.pre_r = new Float64Array(24000); this.pre_cursor = 0; this.band = new Filter(); this.state = 1; this.send = { left: 0, right: 0 }; this.result = { left: 0, right: 0 }; }
    clear() { this.hall.clear(); for (const c of this.comb) c.fill(0); for (const a of this.spring_ap) a.fill(0); this.spring_line.fill(0); this.comb_damp[0] = this.comb_damp[1] = 0; }
    comb_read(c, delay) { let pos = this.comb_cursor - clamp(delay, 2, this.comb_size - 4); while (pos < 0) pos += this.comb_size; const i = Math.trunc(pos), f = pos - i; return this.comb[c][i] * (1 - f) + this.comb[c][(i + 1) % this.comb_size] * f; }
    process(x, p, model, sr) {
        const wet = clamp(p[FX_WET], 0, 1), amount = clamp(p[FX_AMOUNT], 0, 1);
        const size = .25 + .75 * clamp(p[FX_P0], 0, 1), ceiling = .3 + .7 * clamp(p[FX_P1], 0, 1), damping = clamp(p[FX_P2], 0, 1);
        const range = 1 + 3 * clamp(p[FX_P3], 0, 1), root = 110 * Math.pow(2, clamp(p[FX_X], -1, 1) * range);
        const feedback = clamp(.5 + .5 * p[FX_Y], 0, 1) * (.5 + .5 * clamp(p[FX_P4], 0, 1));
        const pre = Math.trunc(clamp(p[FX_P5], 0, 1) * (this.pre_size - 2));
        this.pre_l[this.pre_cursor] = x.left * wet; this.pre_r[this.pre_cursor] = x.right * wet;
        const read = (this.pre_cursor - pre + this.pre_size) % this.pre_size; this.pre_cursor = (this.pre_cursor + 1) % this.pre_size;
        const send = this.send; send.left = this.pre_l[read]; send.right = this.pre_r[read];
        let tl = 0, tr = 0;
        if (model === 1 || model === 2) {
            const space = model === 1 ? (.15 + .45 * amount) * size : (.45 + .55 * amount) * size;
            const sl = send.left, sr_ = send.right;
            const r = this.hall.process(send, clamp(space * ceiling * 1.4, 0, 1), clamp(feedback, 0, 1), root, sr);
            tl = (r.left - sl) * 1.6; tr = (r.right - sr_) * 1.6;
        } else if (model === 0) {
            // Spring: dispersive allpass chain feeding a short bouncing delay, with a slow "drip" wobble.
            let v0 = (send.left + send.right) * .5;
            const lengths = [37, 53, 71, 97, 131, 173];
            for (let k = 0; k < 6; k++) { const a = this.spring_ap[k], n = lengths[k], c = this.spring_cursor[k], r = (c - n + 512) % 512; const d = a[r], v = v0 + d * .62; a[c] = v; v0 = d - v * .62; this.spring_cursor[k] = (c + 1) % 512; }
            this.drip += 6.283185307179586 * 1.7 / sr; const delay = sr * (.028 + .012 * size) + Math.sin(this.drip) * 14;
            let pos = this.spring_cursor_line - delay; while (pos < 0) pos += this.spring_size; const i = Math.trunc(pos), f = pos - i;
            const y = this.spring_line[i % this.spring_size] * (1 - f) + this.spring_line[(i + 1) % this.spring_size] * f;
            this.spring_damp += (y - this.spring_damp) * (.15 + .6 * (1 - damping));
            const fb = clamp(.45 + .5 * amount * ceiling + .04 * feedback, 0, .97);
            this.spring_line[this.spring_cursor_line] = Math.tanh(v0 + this.spring_damp * fb); this.spring_cursor_line = (this.spring_cursor_line + 1) % this.spring_size;
            tl = this.spring_damp * 1.4; tr = -this.spring_damp * 1.3 + y * .2;
        } else {
            // Tube: one tuned comb; cavity: two cross-fed combs at the root and fifth with soft-clipped feedback that can sustain.
            const period = sr / clamp(root, 20, 4000), excite = this.band.process((send.left + send.right) * .5, root, .6, sr).mid;
            const fb = clamp(.6 + .39 * amount * ceiling + .1 * feedback, 0, model === 4 ? 1.04 : .995), c = 1 - (.15 + .7 * damping);
            // A closed tube is a half-period line with inverting feedback: odd harmonics over the root.
            const a = this.comb_read(0, model === 3 ? period * .5 : period), b = this.comb_read(1, period / 1.5);
            this.comb_damp[0] += (a - this.comb_damp[0]) * c; this.comb_damp[1] += (b - this.comb_damp[1]) * c;
            if (model === 3) { this.comb[0][this.comb_cursor] = clamp(excite - this.comb_damp[0] * fb, -3, 3); this.comb_cursor = (this.comb_cursor + 1) % this.comb_size; tl = tr = this.comb_damp[0]; }
            else { this.comb[0][this.comb_cursor] = Math.tanh(excite + this.comb_damp[1] * fb); this.comb[1][this.comb_cursor] = Math.tanh(excite * .7 + this.comb_damp[0] * fb);
                this.comb_cursor = (this.comb_cursor + 1) % this.comb_size; tl = this.comb_damp[0] * .9 + this.comb_damp[1] * .35; tr = this.comb_damp[1] * .9 + this.comb_damp[0] * .35; }
        }
        this.state = amount; this.result.left = x.left + tl; this.result.right = x.right + tr; return this.result;
    }
}
// Captures a fragment on the press and loops it; a fresh unit plays dry until the capture length has been recorded.
class RepeatUnit {
    constructor(sr) { this.history = new FxHistory(Math.trunc(sr * 4)); this.loop_l = new Float32Array(Math.trunc(sr * 2.5)); this.loop_r = new Float32Array(Math.trunc(sr * 2.5));
        this.captured = 0; this.filled = 0; this.waiting = false; this.pos = 0; this.last_held = 0; this.state = 0; this.frame = { left: 0, right: 0 }; this.result = { left: 0, right: 0 }; }
    clear() {}
    capture(seconds, sr) { this.captured = clamp(Math.trunc(seconds * sr), 64, this.loop_l.length);
        for (let k = 0; k < this.captured; k++) { const f = this.history.read(this.captured - 1 - k, this.frame); this.loop_l[k] = f.left; this.loop_r[k] = f.right; } this.pos = 0; }
    process(x, p, model, sr) {
        this.history.write(x); this.filled = Math.min(this.filled + 1, this.history.size);
        const capture_s = .06 + 1.94 * clamp(p[FX_P0], 0, 1);
        if (p[FX_HELD] > .5 && this.last_held <= .5) this.waiting = true;
        if (this.waiting && this.filled >= Math.trunc(capture_s * sr)) { this.capture(capture_s, sr); this.waiting = false; }
        this.last_held = p[FX_HELD];
        if (!this.captured) { this.state = 0; return x; }
        const minimum = sr * (.001 + .049 * clamp(p[FX_P1], 0, 1));
        const base = clamp(this.captured * Math.pow(2, clamp(p[FX_X], -1, 1) * 1.5), minimum, this.captured);
        const shorten = clamp(p[FX_AMOUNT], 0, 1) * (.4 + .6 * clamp(p[FX_P2], 0, 1)), length = Math.max(minimum, base * Math.pow(minimum / base, shorten));
        let speed = Math.pow(2, clamp(p[FX_Y], -1, 1) * (.5 + 2.5 * clamp(p[FX_P3], 0, 1))); if (model === 1) speed = -speed;
        this.pos += speed; while (this.pos >= length) this.pos -= length; while (this.pos < 0) this.pos += length;
        // Start the loop at the end of the capture so a shortened loop is the newest material.
        const at = this.captured - length + this.pos, i = Math.trunc(at), f = at - i, j = Math.min(this.captured - 1, i + 1);
        const l = this.loop_l[i] * (1 - f) + this.loop_l[j] * f, r = this.loop_r[i] * (1 - f) + this.loop_r[j] * f;
        const fade = Math.max(2, Math.min(length * .25, sr * .0005 + sr * .03 * clamp(p[FX_P4], 0, 1)));
        let g = Math.min(1, Math.min(this.pos / fade, (length - this.pos) / fade)); g = g * g * (3 - 2 * g);
        const wet = clamp(p[FX_WET], 0, 1); this.state = length / sr;
        this.result.left = x.left * (1 - wet) + l * g * wet; this.result.right = x.right * (1 - wet) + r * g * wet; return this.result;
    }
}
function make_fx_unit(kind, sr) { return kind === 0 ? new TapeUnit(sr) : kind === 1 ? new DistortUnit() : kind === 2 ? new ReverbUnit() : new RepeatUnit(sr); }
// One organism's insert chain, run in slot order.
class TrackFx {
    constructor() { this.slots = []; this.input = { left: 0, right: 0 }; this.peak = 0; this.frame = { left: 0, right: 0 }; }
    find(id) { for (const s of this.slots) if (s.id === id) return s; return null; }
    process(sr) {
        let y = this.frame; y.left = this.input.left; y.right = this.input.right; this.input.left = this.input.right = 0;
        const k = 1 - Math.exp(-1 / (sr * .015));
        for (const s of this.slots) {
            for (let i = 0; i < FX_PARAMS; i++) s.value[i] = (i === FX_HELD || !s.primed) ? s.target[i] : s.value[i] + (s.target[i] - s.value[i]) * k;
            s.primed = true;
            y = s.unit.process(y, s.value, s.model, sr);
        }
        // Bounded so a sustaining cavity or dense stack never overwhelms the master.
        const left = Math.tanh(y.left * .9) / .9, right = Math.tanh(y.right * .9) / .9;
        this.peak = Math.max(Math.max(Math.abs(left), Math.abs(right)), this.peak * .9997);
        this.frame.left = left; this.frame.right = right; return this.frame;
    }
}
function pan_into(bus, s, pan) { const a = (clamp(pan, -1, 1) + 1) * PI / 4; bus.left += s * Math.cos(a) * 1.41421356; bus.right += s * Math.sin(a) * 1.41421356; }

class Engine {
    constructor() {
        this.sample_rate = 48000;
        this.gain = 0.16;
        this.VOICES = 32;
        this.MATERIAL_BODIES = 16;
        this.harsh_inputs = new Float64Array(this.MATERIAL_BODIES);
        this.harsh_sounding = new Uint8Array(this.MATERIAL_BODIES);
        this.sources = new Float64Array(3);
        this.targets = new Float64Array(4);
        this.unmodulated = new Float64Array(4);
        this.bands = new Float64Array(3);
        this.spoken = new Float64Array(2);
        this.output = { left: 0, right: 0 };
        this.voices = Array.from({ length: this.VOICES }, () => new Voice());
        this.harsh_emitters = Array.from({ length: this.MATERIAL_BODIES }, () => new HarshEmitter());
        this.keyboard_emitters = Array.from({ length: this.VOICES }, () => new HarshEmitter());
        this.pending = Array.from({ length: 64 }, () => ({ trigger: null, delay: 0, used: false }));
        this.channel_spatial = new Map();
        this.track_fx = new Map();

        this.features = { algorithm: 0, material: 0, exciter: 0, body: 0, metal: 0, rupture: 0, motion: 0, space: 0, humanise: 0, reverb: 0, resonance: 0, routes: [] };
        this.target_features = Object.assign({}, this.features);
        this.space = new Space();
        this.reverb = new ResonantReverb();
        this.reverb_root = 130.81;

        this.modulation = new Float64Array(4);
        this.performance_palette = new Float64Array(4);
        this.orbit = 0; this.wander = 0; this.wander_target = 0; this.step = 0; this.wander_clock = 0; this.step_clock = 0;
        this.motion_random = { val: 987654321 };
        this.serial = 0;

        this.low = new Filter();
        this.high = new Filter();
        this.gains = [1, 1, 1];
        this.levels = [0, 0, 0];
        this.dc_x = 0; this.dc_y = 0;
        this.speech_dc_x = [0, 0]; this.speech_dc_y = [0, 0];
        this.render_clock = 0;
    }
    set_seed(val) {
        this.serial = val;
        this.motion_random.val = (val | 1) >>> 0;
        this.orbit = 0; this.wander = 0; this.wander_clock = 0; this.step_clock = 0;
        this.wander_target = random_bipolar(this.motion_random);
        this.step = random_bipolar(this.motion_random);
        this.modulation.fill(0);
        this.features = Object.assign({}, this.target_features);
    }
    pick_voice() {
        let choice = -1;
        for (let i = 0; i < this.VOICES; i++) {
            if (!this.voices[i].active()) { choice = i; break; }
        }
        if (choice < 0) {
            choice = 0;
            for (let i = 1; i < this.VOICES; i++) {
                if ((!this.voices[i].gate && this.voices[choice].gate) ||
                    (this.voices[i].gate === this.voices[choice].gate && this.voices[i].serial < this.voices[choice].serial)) {
                    choice = i;
                }
            }
        }
        return choice;
    }
    trigger(t, delay_samples) {
        if (delay_samples <= 0) return this.start_trigger(t) >= 0;
        for (let i = 0; i < this.pending.length; i++) {
            if (!this.pending[i].used) {
                this.pending[i].trigger = t;
                this.pending[i].delay = delay_samples;
                this.pending[i].used = true;
                return true;
            }
        }
        return false;
    }
    start_trigger(rawT) {
        const t = Object.assign({}, rawT);
        t.features = default_features(t.features);
        t.sfx = default_sfx(t.sfx);
        t.harsh = default_harsh_settings(t.harsh);
        if (t.channel_spatial && t.track_owner >= 0) {
            let fx = this.channel_spatial.get(t.track_owner);
            if (!fx) {
                fx = { echoes: new Space(), hall: new ResonantReverb(), input: 0, pan: 0, space: 0, reverb: 0, resonance: 0, root: 130.81, dc_x: 0, dc_y: 0 };
                this.channel_spatial.set(t.track_owner, fx);
            }
            fx.space = t.features ? t.features.space || 0 : 0;
            fx.reverb = t.features ? t.features.reverb || 0 : 0;
            fx.resonance = t.features ? t.features.resonance || 0 : 0;
            fx.pan = t.track_pan || 0;
            fx.root = 440.0 * Math.pow(2.0, (t.pitch + (t.fine || 0) - 69.0) / 12.0);
        }

        let emitter = null;
        const articulated = t.harsh && t.harsh.enabled && (((t.features ? t.features.algorithm : 0) === 7 && t.sfx && t.sfx.phoneme_count > 0) || t.harsh.source_sfx);
        if (t.harsh && t.harsh.enabled) {
            for (let i = 0; i < this.MATERIAL_BODIES; i++) {
                const e = this.harsh_emitters[i];
                if (e.used && e.group === t.group && e.body_slot === t.body_slot) { emitter = e; break; }
            }
            if (!emitter) {
                for (let i = 0; i < this.MATERIAL_BODIES; i++) {
                    const e = this.harsh_emitters[i];
                    if (!e.used) { emitter = e; break; }
                }
                if (!emitter) return -1;
                emitter.start(t.group, t.harsh, t.sfx ? t.sfx.pan : 0);
                emitter.source_mode = articulated;
                emitter.body_slot = t.body_slot || 0;
            }
            if (emitter.source_mode !== articulated) return -1;
        }

        const choice = this.pick_voice();
        const v = this.voices[choice];
        if (this.keyboard_emitters[choice]) this.keyboard_emitters[choice].clear();
        v.start(clamp(t.pitch, 0, 127), clamp(t.velocity, 1, 127), ++this.serial, t.seed);
        v.channel_spatial = Boolean(t.channel_spatial);
        v.track_owner = t.track_owner;
        v.layer_index = t.layer_index;
        v.track_gain = v.target_track_gain = t.track_gain != null ? t.track_gain : 1.0;
        v.track_pan = v.target_track_pan = t.track_pan != null ? t.track_pan : 0.0;
        v.material = articulated ? emitter : null;
        v.material_sfx = Boolean(t.harsh && t.harsh.source_sfx && (t.features ? t.features.algorithm : 0) !== 7);
        v.has_harsh = Boolean(t.harsh && t.harsh.enabled);
        v.own = true;
        v.own_features = t.features || {};
        v.sfx = t.sfx || {};
        v.group = t.group || 0;
        v.body_slot = t.body_slot || 0;
        v.fine = t.fine || 0;
        v.target = new Float64Array(t.params || default_params());
        v.p = new Float64Array(v.target);
        v.engine_weights.fill(0);
        v.engine_weights[clamp(t.features ? t.features.algorithm : 0, 0, 11)] = 1.0;
        this.reverb_root = 440.0 * Math.pow(2.0, (clamp(t.pitch, 0, 127) + (t.fine || 0) - 69.0) / 12.0);
        return choice;
    }
    stop_group(group, release_ms) {
        for (let i = 0; i < this.MATERIAL_BODIES; i++) {
            const e = this.harsh_emitters[i];
            if (e.used && e.group === group) e.stop(release_ms);
        }
        for (let i = 0; i < this.pending.length; i++) {
            if (this.pending[i].used && this.pending[i].trigger.group === group) this.pending[i].used = false;
        }
        for (let i = 0; i < this.VOICES; i++) {
            const v = this.voices[i];
            if (v.own && v.group === group && v.active()) {
                v.gate = false;
                v.env.off(Math.max(1.0, release_ms), this.sample_rate);
                v.body.off(Math.max(1.0, release_ms), this.sample_rate);
            }
        }
    }
    fx_bus(track) { return this.track_fx.size === 0 || track < 0 ? null : (this.track_fx.get(track) || null); }
    // HWorld::track_effects: replaces an organism's chain [{slots:[{id,kind,model,params}]}]; slots keep their running
    // state across reorders by id. An empty list removes the bus.
    set_track_fx(i, o, sr) {
        const list = o && Array.isArray(o.slots) ? o.slots.slice(0, 4) : [];
        if (list.length === 0) { this.track_fx.delete(i); return; }
        let bus = this.track_fx.get(i);
        if (!bus) { bus = new TrackFx(); this.track_fx.set(i, bus); }
        const next = [];
        for (const e of list) {
            const kind = FX_KINDS.indexOf(String(e && e.kind)); if (kind < 0) continue;
            const id = Math.trunc(Number(e.id)) || 0;
            const old = bus.find(id);
            const slot = old && old.kind === kind ? old : { id: id, kind: kind, model: 0, target: new Float64Array(FX_PARAMS), value: new Float64Array(FX_PARAMS), unit: make_fx_unit(kind, sr), primed: false };
            const model = Number(e.model); slot.model = Number.isFinite(model) ? clamp(Math.trunc(model), 0, 7) : 0;
            const params = e.params || {};
            for (let k = 0; k < FX_PARAMS; k++) { const v = Number(params[FX_PARAM_NAMES[k]]); if (Number.isFinite(v)) slot.target[k] = v; }
            next.push(slot);
        }
        if (next.length === 0) { this.track_fx.delete(i); return; }
        bus.slots = next;
    }
    set_fx_param(i, id, name, value) {
        const bus = this.track_fx.get(i); const v = Number(value); if (!bus || !Number.isFinite(v)) return;
        const k = FX_PARAM_NAMES.indexOf(name); if (k < 0) return;
        const slot = bus.find(id); if (slot) slot.target[k] = v;
    }
    // [track, slot id, unit state, bus peak] for every active slot.
    fx_state() { const out = []; for (const [track, bus] of this.track_fx) for (const slot of bus.slots) out.push([track, slot.id, slot.unit.state, bus.peak]); return out; }
    panic() {
        for (const fx of this.channel_spatial.values()) { fx.echoes.clear(); fx.hall.clear(); fx.input = fx.dc_x = fx.dc_y = 0; }
        for (const bus of this.track_fx.values()) { bus.input.left = bus.input.right = 0; for (const slot of bus.slots) slot.unit.clear(); }
        this.speech_dc_x[0] = this.speech_dc_x[1] = this.speech_dc_y[0] = this.speech_dc_y[1] = 0;
        for (let i = 0; i < this.MATERIAL_BODIES; i++) this.harsh_emitters[i].clear();
        for (let i = 0; i < this.VOICES; i++) {
            if (this.keyboard_emitters[i]) this.keyboard_emitters[i].clear();
            const v = this.voices[i];
            v.gate = false;
            v.env.stage = 0;
            v.body.stage = 0;
        }
        for (let i = 0; i < this.pending.length; i++) this.pending[i].used = false;
        this.dc_x = 0; this.dc_y = 0;
        this.low = new Filter(); this.high = new Filter();
        this.space.clear(); this.reverb.clear();
    }
    channel_wet(fx) {
        const dry = fx.input * this.gain, blocked = dry - fx.dc_x + .995 * fx.dc_y;
        fx.dc_x = dry; fx.dc_y = blocked;
        return fx.hall.process(fx.echoes.process(blocked, fx.space, this.sample_rate), fx.reverb, fx.resonance, fx.root, this.sample_rate);
    }
    sample_stereo() {
        ++this.render_clock;
        for (const fx of this.channel_spatial.values()) fx.input = 0;

        for (let i = 0; i < this.pending.length; i++) {
            const q = this.pending[i];
            if (q.used && --q.delay <= 0) {
                q.used = false;
                this.start_trigger(q.trigger);
            }
        }

        const smoothing = 1.0 - Math.exp(-1.0 / (this.sample_rate * 0.02));
        this.features.algorithm = this.target_features.algorithm || 0;
        this.features.body += ((this.target_features.body || 0) - (this.features.body || 0)) * smoothing;
        this.features.metal += ((this.target_features.metal || 0) - (this.features.metal || 0)) * smoothing;
        this.features.rupture += ((this.target_features.rupture || 0) - (this.features.rupture || 0)) * smoothing;
        this.features.motion += ((this.target_features.motion || 0) - (this.features.motion || 0)) * smoothing;
        this.features.space += ((this.target_features.space || 0) - (this.features.space || 0)) * smoothing;
        this.features.humanise += ((this.target_features.humanise || 0) - (this.features.humanise || 0)) * smoothing;
        this.features.reverb += ((this.target_features.reverb || 0) - (this.features.reverb || 0)) * smoothing;
        this.features.resonance += ((this.target_features.resonance || 0) - (this.features.resonance || 0)) * smoothing;
        this.features.routes = this.target_features.routes || [];

        const rate = 0.08 + (this.features.motion || 0) * 2.5;
        this.orbit += rate / this.sample_rate;
        this.orbit -= Math.floor(this.orbit);
        this.wander_clock += rate * 0.47 / this.sample_rate;
        this.step_clock += rate * 2.3 / this.sample_rate;
        if (this.wander_clock >= 1.0) { this.wander_clock -= 1.0; this.wander_target = random_bipolar(this.motion_random); }
        if (this.step_clock >= 1.0) { this.step_clock -= 1.0; this.step = random_bipolar(this.motion_random); }
        this.wander += (this.wander_target - this.wander) * (1.0 - Math.exp(-1.0 / (this.sample_rate * 0.45)));

        const sources = this.sources;
        sources[0] = Math.sin(TAU * this.orbit); sources[1] = this.wander; sources[2] = this.step;
        const targets = this.targets; targets.fill(0);
        if (this.target_features.routes) {
            for (let i = 0; i < this.target_features.routes.length; i++) {
                const r = this.target_features.routes[i];
                if (r.source < 3) targets[r.destination] += sources[r.source] * r.amount * (this.features.motion || 0);
            }
        }
        for (let i = 0; i < 4; i++) this.modulation[i] += (clamp(targets[i], -1.0, 1.0) - this.modulation[i]) * smoothing;

        const unmodulated = this.unmodulated;
        let x = 0, side_l = 0, side_r = 0, speech_l = 0, speech_r = 0;
        const harsh_inputs = this.harsh_inputs; harsh_inputs.fill(0);
        const harsh_sounding = this.harsh_sounding; harsh_sounding.fill(0);

        for (let vIdx = 0; vIdx < this.VOICES; vIdx++) {
            const v = this.voices[vIdx];
            if (!v.active()) continue;
            v.render_clock = this.render_clock;
            const authored = v.own ? v.own_features : this.features;
            let s = 0;
            if (this.performance_palette[0] === 0 && this.performance_palette[1] === 0 && this.performance_palette[2] === 0 && this.performance_palette[3] === 0) {
                s = v.sample(this.sample_rate, authored, v.own ? unmodulated : this.modulation);
            } else {
                const live = v.live_features;
                Object.assign(live, authored);
                live.metal = mapped(authored.metal || 0, this.performance_palette[1], 0.9, 0.8);
                live.rupture = mapped(authored.rupture || 0, this.performance_palette[2], 1.0, 1.0);
                live.motion = mapped(authored.motion || 0, this.performance_palette[3], 0.85, 0.75);
                s = v.sample(this.sample_rate, live, v.own ? unmodulated : this.modulation, this.performance_palette[0]);
            }

            v.track_gain += (v.target_track_gain - v.track_gain) * smoothing;
            v.track_pan += (v.target_track_pan - v.track_pan) * smoothing;
            s *= v.track_gain;

            let emitter = -1;
            if (v.own && v.has_harsh) {
                for (let k = 0; k < this.MATERIAL_BODIES; k++) {
                    const e = this.harsh_emitters[k];
                    if (e.used && e.group === v.group && e.body_slot === v.body_slot) { emitter = k; break; }
                }
            }

            if (v.keyboard_profile && v.has_harsh && this.keyboard_emitters[v.keyboard_slot]) {
                const e = this.keyboard_emitters[v.keyboard_slot];
                if (!e.source_mode) s = e.process(s, true, this.sample_rate);
            }
            if (v.keyboard_profile) s *= v.sfx.gain;

            const bus = this.fx_bus(v.track_owner);
            if (bus && !(v.channel_spatial && this.channel_spatial.has(v.track_owner)) && (emitter < 0 || (v.material && !v.keyboard_profile))) {
                if (emitter >= 0) harsh_sounding[emitter] = 1;
                pan_into(bus.input, s * this.gain, v.sfx.pan + v.track_pan);
                continue;
            }

            if (v.channel_spatial && (emitter < 0 || (v.material && !v.keyboard_profile))) {
                const fx = this.channel_spatial.get(v.track_owner);
                if (fx) {
                    fx.input += s;
                    if (emitter >= 0) harsh_sounding[emitter] = 1;
                    continue;
                }
            }

            if (v.material && !v.keyboard_profile) {
                if (emitter >= 0) harsh_sounding[emitter] = 1;
                const a = (clamp((v.sfx.pan || 0) + v.track_pan, -1.0, 1.0) + 1.0) * PI / 4.0;
                speech_l += s * Math.cos(a) * 1.41421356;
                speech_r += s * Math.sin(a) * 1.41421356;
                continue;
            }

            if (emitter >= 0) {
                harsh_inputs[emitter] += s;
                harsh_sounding[emitter] = 1;
                continue;
            }

            x += s;
            if (v.sfx.pan !== 0 || v.track_pan !== 0) {
                const a = (clamp((v.sfx.pan || 0) + v.track_pan, -1.0, 1.0) + 1.0) * PI / 4.0;
                side_l += s * (Math.cos(a) * 1.41421356 - 1.0);
                side_r += s * (Math.sin(a) * 1.41421356 - 1.0);
            }
        }

        for (let k = 0; k < this.MATERIAL_BODIES; k++) {
            const e = this.harsh_emitters[k];
            if (!e.used) continue;
            if (e.source_mode) {
                if (!harsh_sounding[k]) e.clear();
                continue;
            }
            const s = e.process(harsh_inputs[k], Boolean(harsh_sounding[k]), this.sample_rate);
            let routed = false;
            if (this.track_fx.size > 0) for (let vIdx = 0; vIdx < this.VOICES; vIdx++) {
                const v = this.voices[vIdx];
                if (v.own && v.group === e.group) {
                    const bus = this.fx_bus(v.track_owner);
                    if (bus && !(v.channel_spatial && this.channel_spatial.has(v.track_owner))) { pan_into(bus.input, s * this.gain, e.pan); routed = true; }
                    break;
                }
            }
            if (routed) continue;
            for (let vIdx = 0; vIdx < this.VOICES; vIdx++) {
                const v = this.voices[vIdx];
                if (v.channel_spatial && v.group === e.group) {
                    const fx = this.channel_spatial.get(v.track_owner);
                    if (fx) { fx.input += s; routed = true; }
                    break;
                }
            }
            if (routed) continue;
            x += s;
            const a = (clamp(e.pan, -1.0, 1.0) + 1.0) * PI / 4.0;
            side_l += s * (Math.cos(a) * 1.41421356 - 1.0);
            side_r += s * (Math.sin(a) * 1.41421356 - 1.0);
        }

        x *= this.gain;
        const l = this.low.process(x, 260.0, 0.45, this.sample_rate).low;
        const h = this.high.process(x, 3600.0, 0.4, this.sample_rate).high;
        const m = x - l - h;
        const smooth = 1.0 - Math.exp(-1.0 / (this.sample_rate * 0.05));
        const b = this.bands; b[0] = l; b[1] = m; b[2] = h;
        let y = 0;
        for (let i = 0; i < 3; i++) {
            this.levels[i] += (Math.abs(b[i]) - this.levels[i]) * smooth;
            y += b[i] * this.gains[i];
        }

        const blocked = y - this.dc_x + 0.995 * this.dc_y;
        this.dc_x = y; this.dc_y = blocked;
        const spaced = this.space.process(blocked, this.features.space || 0, this.sample_rate);
        spaced.left += side_l * this.gain;
        spaced.right += side_r * this.gain;

        // Effected organisms: their echo/hall feeds the bus, then the chain, then the master reverb.
        for (const [track, bus] of this.track_fx) {
            const cs = this.channel_spatial.get(track);
            if (cs) { const wet = this.channel_wet(cs); const a = (clamp(cs.pan, -1, 1) + 1) * PI / 4; bus.input.left += wet.left * Math.cos(a) * 1.41421356; bus.input.right += wet.right * Math.sin(a) * 1.41421356; }
            const out = bus.process(this.sample_rate); spaced.left += out.left; spaced.right += out.right;
        }
        const revAmt = this.target_features.reverb === 0 && (this.features.reverb || 0) < 0.00001 ? 0 : (this.features.reverb || 0);
        const stereo = this.reverb.process(spaced, revAmt, this.features.resonance || 0, this.reverb_root, this.sample_rate);

        for (const [track, fx] of this.channel_spatial) {
            if (this.fx_bus(track)) continue;
            const wet = this.channel_wet(fx);
            const a = (clamp(fx.pan, -1.0, 1.0) + 1.0) * PI / 4.0;
            stereo.left += wet.left * Math.cos(a) * 1.41421356;
            stereo.right += wet.right * Math.sin(a) * 1.41421356;
        }

        const spoken = this.spoken; spoken[0] = speech_l * this.gain; spoken[1] = speech_r * this.gain;
        for (let k = 0; k < 2; k++) {
            const blk = spoken[k] - this.speech_dc_x[k] + 0.995 * this.speech_dc_y[k];
            this.speech_dc_x[k] = spoken[k];
            this.speech_dc_y[k] = blk;
            spoken[k] = blk;
        }

        this.output.left = Math.tanh(stereo.left + spoken[0]);
        this.output.right = Math.tanh(stereo.right + spoken[1]);
        return this.output;
    }
}

// ---------------------------------------------------------------------------
// Performance Character (performance_character.hpp)
// ---------------------------------------------------------------------------
class PerformanceCharacter {
    constructor() {
        this.target = 0; this.value = 0; this.sample_rate = 0; this.slew = 0; this.envelope_follow = 0;
        this.tone = [0, 0]; this.envelope = 0; this.phase = 0;
        this.random = { val: 1977 };
        this.output = { left: 0, right: 0 };
        this.channels = new Float64Array(2);
        this.shaped = { left: 0, right: 0 };
        this.controls = new Float64Array(7);
        this.targets = new Float64Array(7);
        this.atmosphere = new ResonantReverb();
    }
    set(v) {
        if (!Number.isFinite(v)) return;
        this.target = clamp(v, -1.0, 1.0);
        for (let k = 0; k < 4; k++) this.targets[k] = this.target;
        this.targets[4] = Math.max(0.0, -this.target);
        this.targets[5] = this.targets[6] = Math.max(0.0, this.target);
    }
    set_control(k, v) {
        if (k >= 0 && k < 7 && Number.isFinite(v)) {
            this.targets[k] = clamp(v, k < 4 ? -1.0 : 0.0, 1.0);
        }
    }
    advance(sr) {
        if (sr !== this.sample_rate) {
            this.sample_rate = sr;
            this.slew = 1.0 - Math.exp(-1.0 / (sr * 0.045));
            this.envelope_follow = 1.0 - Math.exp(-1.0 / (sr * 0.012));
        }
        this.value += (this.target - this.value) * this.slew;
        if (this.target === 0 && Math.abs(this.value) < 1e-7) this.value = 0;
        for (let k = 0; k < 7; k++) {
            this.controls[k] += (this.targets[k] - this.controls[k]) * this.slew;
            if (this.targets[k] === 0 && Math.abs(this.controls[k]) < 1e-7) this.controls[k] = 0;
        }
        return this.value;
    }
    clear() {
        this.tone[0] = this.tone[1] = this.envelope = this.phase = 0;
        this.atmosphere.clear();
        this.random.val = 1977;
    }
    process(input) {
        const calm = Math.max(0.0, -this.controls[0]);
        const harsh = this.controls[6];
        const noise_amount = this.controls[5];
        const space = this.controls[4];

        this.envelope += (Math.min(1.0, Math.max(Math.abs(input.left), Math.abs(input.right))) - this.envelope) * this.envelope_follow;
        const cutoff = 18000.0 * Math.pow(2.0, -calm * 4.0);
        const tone_follow = 1.0 - Math.exp(-TAU * Math.min(this.sample_rate * 0.4, cutoff) / this.sample_rate);
        const channels = this.channels; channels[0] = input.left; channels[1] = input.right;
        this.phase += TAU * (23.0 + harsh * 174.0) / this.sample_rate;
        if (this.phase > TAU) this.phase -= TAU;

        for (let k = 0; k < 2; k++) {
            this.tone[k] += (channels[k] - this.tone[k]) * tone_follow;
            let softened = channels[k] * (1.0 - calm * 0.85) + this.tone[k] * calm * 0.85;
            const noise = random_bipolar(this.random) * this.envelope * noise_amount * 0.28;
            softened += noise;
            const broken = Math.sin(softened * (1.0 + harsh * 13.0));
            const ring = 0.65 + 0.35 * Math.sin(this.phase + k * 0.7);
            channels[k] = softened * (1.0 - harsh * 0.8) + broken * harsh * 0.8 * ring * 0.7;
        }

        const shaped = this.shaped; shaped.left = channels[0]; shaped.right = channels[1];
        const floating = this.atmosphere.process(shaped, space * 0.9, 0, 130.81, this.sample_rate);
        if (calm === 0 && harsh === 0 && noise_amount === 0 && space === 0) return input;
        this.output.left = floating.left / (1.0 + space * 0.2);
        this.output.right = floating.right / (1.0 + space * 0.2);
        return this.output;
    }
}

// ---------------------------------------------------------------------------
// Faction Sound Profiles (faction_sounds.hpp)
// ---------------------------------------------------------------------------
const FACTION_RELEASES = [120, 320, 620, 200, 650, 900, 60, 400, 120, 90, 70, 250, 230, 350, 1100, 50, 35]; // native faction_release_ms

// Generated from native/faction_sounds.hpp (tools/export_web.py checks it stays in sync).
function faction_trigger(i, pitch, velocity) {
    const t = { pitch: pitch, velocity: velocity, group: i * 128 + pitch, seed: (1977 + i * 104729 + pitch * 1009) >>> 0, fine: 0, body_slot: 0, channel_spatial: false,
        params: sfx_default_params(), features: default_features(), sfx: default_sfx(), harsh: default_harsh_settings() };
    t.features.routes = DEFAULT_ROUTES.map(r => ({ source: r[0], destination: r[1], amount: r[2] }));
    t.params[5] = .5; t.sfx.hold_ms = 15000; t.features.body = 0; t.features.metal = 0;
    // BEGIN GENERATED FACTIONS
    switch(i){
case 0:
t.features.algorithm=10;t.features.material=3;
t.params[3]=1;
t.params[4]=180;
t.params[6]=120;
t.params[1]=3200;
t.params[9]=0;
t.features.body=0.04;
t.features.metal=0.1;
t.sfx.pan=-0.8;t.sfx.gain=1.201619;
t.sfx.hardness=0.98;
t.sfx.decay=0.25;
t.sfx.pitch_from=-12;
t.sfx.pitch_to=-24;
t.sfx.pitch_ms=100;
t.sfx.physical.gesture=0;
t.sfx.physical.pressure=0.95;
t.sfx.physical.friction=0.3;
t.sfx.physical.damping=0.7;
t.sfx.physical.inharmonicity=0.85;
t.sfx.physical.fracture=0.15;
t.sfx.physical.gesture_ms=180;
break;
case 1:
t.features.algorithm=3;t.features.material=1;
t.params[3]=1;
t.params[4]=260;
t.params[6]=320;
t.params[1]=7800;
t.params[9]=0;
t.params[5]=0.0;
t.features.body=0.89;
t.features.metal=0.04;
t.sfx.pan=-0.7000000000000001;t.sfx.gain=0.918236;
t.sfx.hold_ms=380;
break;
case 2:
t.features.algorithm=7;t.features.material=0;
t.params[3]=160;
t.params[4]=800;
t.params[6]=620;
t.params[1]=7200;
t.params[9]=0;
t.features.body=0;
t.features.metal=0;
t.sfx.pan=-0.6000000000000001;t.sfx.gain=0.743338;
t.sfx.vowel=2;
t.sfx.vocal_size=0.5;
t.sfx.breath=0.28;
t.sfx.voicing=0.8;
t.sfx.formant_motion=0.65;
t.sfx.chamber=0.6;
t.sfx.reverse_mix=0.18;
break;
case 3:
t.features.algorithm=6;t.features.material=6;
t.params[3]=5;
t.params[4]=950;
t.params[6]=200;
t.params[1]=2800;
t.params[9]=0;
t.params[18]=0.7;
t.params[13]=13;
t.params[14]=0.5;
t.features.body=0;
t.features.metal=0;
t.sfx.pan=-0.5;t.sfx.gain=2.112719;
t.features.exciter=2;
t.sfx.hardness=0.35;
t.sfx.scrape_rate=160;
t.sfx.decay=0.095;
t.sfx.clang=0.65;
t.sfx.bow=0.35;
t.sfx.hp=180;
break;
case 4:
t.features.algorithm=5;t.features.material=7;
t.params[3]=2;
t.params[4]=500;
t.params[6]=650;
t.params[1]=9500;
t.params[9]=0;
t.params[27]=0.4;
t.params[28]=0.2;
t.params[34]=0.65;
t.params[32]=145;
t.params[33]=0.6;
t.params[17]=0.28;
t.params[16]=7;
t.features.body=0.72;
t.features.metal=0.05;
t.sfx.pan=-0.4;t.sfx.gain=0.396408;
break;
case 5:
t.features.algorithm=7;t.features.material=1;
t.params[3]=240;
t.params[4]=1300;
t.params[6]=900;
t.params[1]=1800;
t.params[9]=0;
t.params[5]=0.72;
t.features.body=0;
t.features.metal=0;
t.sfx.pan=-0.30000000000000004;t.sfx.gain=0.288773;
t.sfx.vowel=4;
t.sfx.vocal_size=2.3;
t.sfx.subharmonic=0.85;
t.sfx.breath=0.03;
t.sfx.voicing=1;
t.sfx.roughness=0.6;
t.sfx.chamber=0.95;
t.sfx.pitch_from=-12;
t.sfx.pitch_to=-12;
break;
case 6:
t.features.algorithm=11;t.features.material=5;
t.params[3]=1;
t.params[4]=90;
t.params[6]=60;
t.params[1]=13500;
t.params[9]=0;
t.params[5]=0.0;
t.features.body=0;
t.features.metal=0.1;
t.sfx.pan=-0.19999999999999996;t.sfx.gain=4.99513;
t.sfx.hp=1700;
t.sfx.pitch_from=12;
t.sfx.pitch_to=7;
t.sfx.pitch_ms=80;
t.sfx.physical.gesture=3;
t.sfx.physical.pressure=0.85;
t.sfx.physical.friction=0.95;
t.sfx.physical.contact_speed=0.9;
t.sfx.physical.damping=0.8;
t.sfx.physical.fracture=0.9;
t.sfx.physical.gesture_ms=110;
break;
case 7:
t.features.algorithm=6;t.features.material=7;
t.params[3]=1;
t.params[4]=650;
t.params[6]=400;
t.params[1]=14000;
t.params[9]=0;
t.features.body=0;
t.features.metal=0;
t.sfx.pan=-0.09999999999999998;t.sfx.gain=0.490169;
t.sfx.hardness=1;
t.sfx.decay=0.75;
t.sfx.position=0.18;
t.sfx.warp=0.82;
t.sfx.clang=0.1;
t.sfx.hp=2100;
t.features.exciter=4;
t.sfx.pitch_from=12;
t.sfx.pitch_to=12;
break;
case 8:
t.features.algorithm=8;t.features.material=3;
t.params[3]=1;
t.params[4]=210;
t.params[6]=120;
t.params[1]=3600;
t.params[9]=0;
t.params[5]=0.03;
t.features.body=0;
t.features.metal=0;
t.sfx.pan=0.0;t.sfx.gain=0.829546;
t.sfx.boom=1.4;
t.sfx.boom_ms=180;
t.sfx.rumble=0.75;
t.sfx.crackle=0.9;
t.sfx.noise_amount=0.8;
t.sfx.noise_color=1;
t.sfx.pitch_from=7;
t.sfx.pitch_to=-24;
t.sfx.pitch_ms=160;
break;
case 9:
t.features.algorithm=7;t.features.material=2;
t.params[3]=4;
t.params[4]=260;
t.params[6]=90;
t.params[1]=2100;
t.params[9]=0;
t.params[19]=0.7;
t.params[20]=1;
t.params[5]=0.2;
t.features.body=0;
t.features.metal=0;
t.sfx.pan=0.09999999999999998;t.sfx.gain=6.6;
t.sfx.vowel=3;
t.sfx.vocal_size=1.8;
t.sfx.voicing=0;
t.sfx.breath=1;
t.sfx.fragment=0.9;
t.sfx.flutter=0.8;
t.sfx.hp=650;
break;
case 10:
t.features.algorithm=1;t.features.material=3;
t.params[3]=2;
t.params[4]=170;
t.params[6]=70;
t.params[1]=10500;
t.params[9]=0.02;
t.params[27]=0.3;
t.params[28]=1;
t.params[29]=0.13;
t.params[30]=0.85;
t.params[31]=0;
t.params[7]=250;
t.params[8]=31;
t.params[18]=0.9;
t.params[13]=31;
t.params[14]=0.95;
t.features.body=0;
t.features.metal=0.9;
t.features.rupture=0.8;
t.sfx.pan=0.19999999999999996;t.sfx.gain=0.095155;
t.harsh.enabled=true;
t.harsh.circuit=6;
t.harsh.drive=0.7;
t.harsh.mix=0.8;
t.harsh.feedback=0.15;
t.harsh.trim=0.19;
break;
case 11:
t.features.algorithm=0;t.features.material=1;
t.params[3]=70;
t.params[4]=420;
t.params[6]=250;
t.params[1]=1050;
t.params[9]=0.015;
t.params[27]=1;
t.params[12]=0;
t.params[28]=0;
t.params[5]=0.6;
t.params[17]=0.06;
t.params[16]=3.5;
t.features.body=0;
t.features.metal=0;
t.sfx.pan=0.30000000000000004;t.sfx.gain=0.249337;
break;
case 12:
t.features.algorithm=4;t.features.material=7;
t.params[3]=15;
t.params[4]=320;
t.params[6]=230;
t.params[1]=12500;
t.params[9]=0;
t.params[5]=0.35;
t.params[17]=0.95;
t.params[16]=189;
t.params[34]=0.35;
t.params[32]=11.7;
t.params[33]=0.7;
t.features.body=0.97;
t.features.metal=0.9;
t.features.motion=0.3;
t.sfx.pan=0.40000000000000013;t.sfx.gain=1.243281;
t.sfx.hp=900;
break;
case 13:
t.features.algorithm=6;t.features.material=0;
t.params[3]=1;
t.params[4]=120;
t.params[6]=350;
t.params[1]=6500;
t.params[9]=0;
t.features.body=0;
t.features.metal=0;
t.sfx.pan=0.5;t.sfx.gain=0.808132;
t.features.exciter=3;
t.sfx.hardness=0.75;
t.sfx.decay=0.48;
t.sfx.position=0.63;
t.sfx.bounce_ms=120;
t.sfx.bounce_ratio=0.48;
t.sfx.clang=0.12;
t.sfx.pitch_from=-5;
t.sfx.pitch_to=-5;
break;
case 14:
t.features.algorithm=0;t.features.material=2;
t.params[3]=320;
t.params[4]=1500;
t.params[6]=1100;
t.params[1]=240;
t.params[9]=0;
t.params[27]=1;
t.params[12]=0;
t.params[28]=0;
t.params[5]=0.9;
t.params[2]=0.05;
t.features.body=0;
t.features.metal=0;
t.sfx.pan=0.6000000000000001;t.sfx.gain=0.222027;
t.sfx.pitch_from=-24;
t.sfx.pitch_to=-24;
t.sfx.hp=20;
break;
case 15:
t.features.algorithm=0;t.features.material=0;
t.params[3]=1;
t.params[4]=80;
t.params[6]=50;
t.params[1]=16000;
t.params[9]=0;
t.params[27]=1;
t.params[12]=0;
t.params[28]=0;
t.params[5]=0;
t.features.body=0;
t.features.metal=0;
t.sfx.pan=0.7;t.sfx.gain=0.697199;
t.sfx.pitch_from=12;
t.sfx.pitch_to=24;
t.sfx.pitch_ms=75;
t.sfx.hold_ms=115;
break;
case 16:
t.features.algorithm=2;t.features.material=1;
t.params[3]=1;
t.params[4]=28;
t.params[6]=35;
t.params[1]=7200;
t.params[9]=0;
t.params[5]=0;
t.params[7]=0;
t.features.body=0;
t.features.metal=0.98;
t.sfx.pan=0.8;t.sfx.gain=0.786813;
t.sfx.pitch_from=-7;
t.sfx.pitch_to=-7;
t.sfx.hold_ms=45;
t.sfx.hp=500;
break;
}
    // END GENERATED FACTIONS
    return t;
}

// ---------------------------------------------------------------------------
// Patch Parser (patch.hpp)
// ---------------------------------------------------------------------------
const PARAM_NAMES = ["mode","cutoff","res","attack","decay","sustain","release","fm","fmrate","noise","drive","detune","shape","glitchRate","glitchDepth","drift","ringRate","ringDepth","chopDepth","filterBlend","bandMix","pitchEnv","warpRate","warpDepth","drumBodyHz","drumBodyGain","drumBodyDecay","legacyGain","synthCoreGain","pulseWidth","pulseMix","subMix","padDelayMs","padFeedback","padWet"];
// PatchReader::num: missing/null/non-finite -> fallback, otherwise clamped.
function pnum(o, k, fallback, lo, hi) {
    if (!o || typeof o !== 'object') return fallback;
    const v = o[k];
    if (v === undefined || v === null) return fallback;
    const n = typeof v === 'boolean' ? (v ? 1 : 0) : Number(v);
    return Number.isFinite(n) ? clamp(n, lo, hi) : fallback;
}
function pobj(o, k) { return o && o[k] && typeof o[k] === 'object' ? o[k] : null; }
const SFX_RANGES = [["gain",0,4],["pan",-1,1],["vocal_size",.4,2.5],["roughness",0,1],["subharmonic",0,1],["breath",0,1],["voicing",0,1],
    ["hardness",0,1],["position",0,1],["decay",.005,30],["spread",0,1],["tension",-1,1],["clang",0,1],["warp",0,1],["bounce_ms",8,2000],["bounce_ratio",.2,.97],["scrape_rate",10,8000],["bow",0,1],
    ["reverse_envelope",0,1],["chamber",0,1],["formant_motion",0,1],["carrier_ring",0,1],["flutter",0,1],["fragment",0,1],["reverse_mix",0,1],["reverse_ms",2,85],
    ["boom",0,2],["crackle",0,1],["rumble",0,2],["noise_amount",0,2],["hold_ms",-1,60000],["hp",0,20000],["soft_clip",0,1],["pitch_from",-96,96],["pitch_to",-96,96],["pitch_ms",0,30000],["pitch_curve",.05,20],["cutoff_from",-10,10],["cutoff_to",-10,10],["cutoff_ms",0,30000]];
const PHYS_RANGES = [["pressure",0,1],["friction",0,1],["contact_speed",0,1],["coupling",0,1],["damping",0,1],["stress",0,1],["elasticity",0,1],["inharmonicity",0,1],["fracture",0,1],["material_feedback",0,1],["gesture_ms",20,10000]];
const HARSH_RANGES = [["drive",0,1],["bias",-1,1],["mix",0,1],["feedback",0,1],["tension",0,1],["tone",0,1],["root",20,4000],["trim",0,4],["holes",0,1],["articulation",0,1],["attack_ms",.1,10000],["decay_ms",1,10000],["sustain",0,1],["release_ms",1,20000],["tail_ms",-1,20000]];
const DEFAULT_ROUTES = [[0,0,.7],[1,1,.15],[2,2,.25],[0,3,.12]];
function parse_phoneme(o) {
    return { vowel: Math.trunc(pnum(o,"vowel",7,0,9)), consonant: Math.trunc(pnum(o,"consonant",0,0,5)), ms: pnum(o,"ms",140,5,20000), pitch: pnum(o,"pitch",0,-48,48), amp: pnum(o,"amp",1,0,2) };
}
// Line-for-line PatchReader::trigger (native/patch.hpp).
function parse_trigger(o) {
    const pitchValue = pnum(o, "pitch", 60, 0, 127);
    const t = {
        pitch: Math.trunc(pitchValue), fine: 0, velocity: Math.trunc(pnum(o, "velocity", 100, 1, 127)),
        features: default_features({ algorithm: Math.trunc(pnum(o,"engine",0,0,11)), material: Math.trunc(pnum(o,"material",0,0,7)), exciter: Math.trunc(pnum(o,"exciter",0,0,4)) }),
        channel_spatial: pnum(o, "channel_spatial", 0, 0, 1) > 0,
        params: sfx_default_params(), sfx: default_sfx(), harsh: default_harsh_settings(), body_slot: 0, seed: 1
    };
    t.fine = pitchValue - t.pitch;
    const f = pobj(o, "features");
    for (const k of ["body","metal","rupture","motion","humanise","space","reverb","resonance"]) t.features[k] = pnum(o, k, pnum(f, k, t.features[k], 0, 1), 0, 1);
    const p = pobj(o, "params");
    for (let i = 0; i < PARAM_COUNT; i++) t.params[i] = pnum(p, PARAM_NAMES[i], t.params[i], -20000, 20000);
    t.params[29] = clamp(t.params[29], .02, .98); t.params[33] = clamp(t.params[33], 0, .85); t.params[3] = clamp(t.params[3], .2, 10000); t.params[6] = clamp(t.params[6], 1, 20000); t.params[5] = clamp(t.params[5], 0, 1);
    t.features.routes = DEFAULT_ROUTES.map(r => ({ source: r[0], destination: r[1], amount: r[2] }));
    const routes = Array.isArray(o.routes) ? o.routes : [];
    for (let i = 0; i < Math.min(4, routes.length); i++) t.features.routes[i] = { source: Math.trunc(pnum(routes[i],"source",0,0,5)), destination: Math.trunc(pnum(routes[i],"destination",0,0,3)), amount: pnum(routes[i],"amount",0,-1,1) };
    for (const [k, lo, hi] of SFX_RANGES) t.sfx[k] = pnum(o, k, t.sfx[k], lo, hi);
    t.sfx.vowel = Math.trunc(pnum(o, "vowel", 0, 0, 9));
    const physical = pobj(o, "physical");
    for (const [k, lo, hi] of PHYS_RANGES) t.sfx.physical[k] = pnum(o, k, pnum(physical, k, t.sfx.physical[k], lo, hi), lo, hi);
    t.sfx.physical.gesture = Math.trunc(pnum(o, "gesture", pnum(physical, "gesture", 0, 0, 4), 0, 4));
    const h = pobj(o, "harsh");
    if (h) {
        t.harsh.enabled = true;
        for (const [k, lo, hi] of HARSH_RANGES) t.harsh[k] = pnum(h, k, t.harsh[k], lo, hi);
        t.harsh.circuit = Math.trunc(pnum(h, "circuit", 0, 0, 6)); t.harsh.speech_adsr = pnum(h, "speech_adsr", 0, 0, 1) > 0; t.harsh.source_sfx = pnum(h, "source_sfx", 0, 0, 1) > 0;
    }
    const ph = Array.isArray(o.phonemes) ? o.phonemes : [];
    t.sfx.phoneme_count = Math.min(MAX_PHONEMES, ph.length);
    t.sfx.phonemes = ph.slice(0, t.sfx.phoneme_count).map(parse_phoneme);
    t.body_slot = Math.trunc(pnum(o, "body_slot", 0, 0, 3)); t.seed = pnum(o, "seed", 1, 1, 4294967295) >>> 0;
    return t;
}

// Key zone: the layer sounds only for notes in [key_lo,key_hi] (modulo key_cycle when set); key_track scales transposition.
class PatchChunk {
    constructor(trigger, delay) { this.trigger = trigger; this.delay = delay; this.key_lo = 0; this.key_hi = 127; this.key_cycle = 0; this.key_track = 1; }
    plays(pitch) { const k = this.key_cycle > 0 ? pitch % this.key_cycle : pitch; return k >= this.key_lo && k <= this.key_hi; }
    pitch_for(note) { return clamp(Math.round(this.trigger.pitch + (note - 60) * this.key_track), 0, 127); }
}
function ptext(o, k, fallback = "") { return o && typeof o[k] === 'string' ? o[k] : fallback; }
// Line-for-line InstrumentPatch::read (native/patch.hpp).
function parse_patch(o) {
    const patch = { layers: [], syllables: [], kind: "synth", mode: "syllable", text: "", key: "", gain: 1, pan: 0, reference: 60, contour: 1, rate: 1, beats: 4,
        gated: true, overlap: false, random: false, sync: false, polyphony: 4, cursor: 0, last_onset: -1e9 };
    if (!o || typeof o !== 'object') return patch;
    patch.kind = ptext(o, "kind", "synth"); patch.gain = pnum(o, "gain", 1, 0, 2); patch.pan = pnum(o, "pan", 0, -1, 1);
    const layers = Array.isArray(o.triggers) ? o.triggers : [];
    for (let i = 0; i < Math.min(64, layers.length); i++) {
        const l = layers[i] || {};
        const c = new PatchChunk(parse_trigger(l), pnum(l, "delay_ms", 0, 0, 600000));
        c.key_lo = Math.trunc(pnum(l, "key_lo", 0, 0, 127)); c.key_hi = Math.trunc(pnum(l, "key_hi", 127, 0, 127)); c.key_cycle = Math.trunc(pnum(l, "key_cycle", 0, 0, 127)); c.key_track = pnum(l, "key_track", 1, 0, 2);
        patch.layers.push(c);
    }
    const speech = pobj(o, "speech");
    patch.mode = ptext(speech, "mode", "syllable"); patch.text = ptext(speech, "text"); patch.reference = pnum(speech, "reference", 60, 0, 127); patch.contour = pnum(speech, "contour", 1, 0, 2);
    patch.rate = pnum(speech, "rate", 1, .25, 4); patch.beats = pnum(speech, "beats", 4, .25, 64); patch.gated = pnum(speech, "gate", 1, 0, 1) > 0; patch.overlap = pnum(speech, "overlap", 0, 0, 1) > 0;
    patch.random = pnum(speech, "random", 0, 0, 1) > 0; patch.sync = pnum(speech, "sync", 0, 0, 1) > 0; patch.polyphony = Math.trunc(pnum(speech, "polyphony", 4, 1, 8));
    patch.key = patch.text + patch.mode + ptext(speech, "profile");
    const syllables = Array.isArray(o.syllables) ? o.syllables : [];
    for (let i = 0; i < Math.min(1024, syllables.length); i++) patch.syllables.push(parse_phoneme(syllables[i] || {}));
    return patch;
}

// ---------------------------------------------------------------------------
// HWorld: track state, drones, solos/mutes, rendering & mixing (world.hpp)
// ---------------------------------------------------------------------------
class HWorld {
    constructor() {
        this.tracks = [];
        this.next_group = 100000;
        this.rejected = 0;
        this.drone_launch = false;
        this.drone_offset = 0;
        this.rate = 48000;
        this.time = 0;
        this.tempo = 108;
        this.rendered = 0;
        this.event_count = 0;
        this.solo = -1;
        this.muted = [];
        this.solos = [];
        this.note_counts = [];
        this.pulses = [];
        this.pending = [];

        this.character = new PerformanceCharacter();
        this.engine = new Engine();
        this.engine.sample_rate = this.rate;
        this.engine.gain = 0.33;
        this.engine.target_features.space = 0.17;
        this.engine.target_features.reverb = 0.12;
        this.engine.set_seed(1977);
    }
    resize(n) {
        while (this.tracks.length < n) {
            this.tracks.push({
                active: true, custom: false, patch: { kind: "synth", layers: [], gain: 1, pan: 0 },
                held: Array.from({ length: 128 }, () => []),
                groups: [], previews: [], tokens: new Map(), drones: [], drone_velocity: 96, drone_fine: 0
            });
            this.muted.push(false);
            this.solos.push(false);
            this.note_counts.push(0);
            this.pulses.push(0.0);
        }
    }
    // HWorld::setup sizes the roster only; the app sends every track's patch itself.
    initFactions(factions) { this.resize(factions.length); }
    group_alive(g) {
        if (!g) return false;
        for (let i = 0; i < this.engine.voices.length; i++) {
            const v = this.engine.voices[i];
            if (v.own && v.group === g && v.active()) return true;
        }
        for (let i = 0; i < this.engine.pending.length; i++) {
            const q = this.engine.pending[i];
            if (q.used && q.trigger.group === g) return true;
        }
        return false;
    }
    drone_retune(i) {
        if (i < 0 || i >= this.tracks.length) return;
        const track = this.tracks[i];
        const p = track.patch;
        const layer_fine = (k) => {
            return track.custom && p.kind !== "mumble" && k >= 0 && k < p.layers.length ? (p.layers[k].trigger.fine || 0) : 0;
        };
        for (const d of track.drones) {
            if (!d.group) continue;
            for (const v of this.engine.voices) {
                if (v.own && v.group === d.group && v.active()) {
                    v.fine = layer_fine(v.layer_index) + (track.drone_fine || 0);
                }
            }
            for (const q of this.engine.pending) {
                if (q.used && q.trigger.group === d.group) {
                    q.trigger.fine = layer_fine(q.trigger.layer_index) + (track.drone_fine || 0);
                }
            }
        }
    }
    service_drones() {
        for (let i = 0; i < this.tracks.length; i++) {
            const track = this.tracks[i];
            if (!track.active || !track.drones || track.drones.length === 0) continue;
            for (let k = 0; k < track.drones.length; k++) {
                const d = track.drones[k];
                if (this.group_alive(d.group) || (this.time - d.retry < 250)) continue;
                d.retry = this.time;
                d.group = 0;
                const before = this.next_group;
                this.drone_launch = true;
                this.drone_offset = track.drone_fine || 0;
                this.sound({ time: this.time, organism: i, pitch: d.pitch, velocity: track.drone_velocity });
                this.drone_launch = false;
                if (this.next_group !== before) {
                    d.group = before;
                    const q = track.held[d.pitch];
                    if (q && q.length > 0 && q[q.length - 1] === before) q.pop();
                }
            }
        }
    }
    audible(i) {
        const anySolo = this.solos.some(s => s);
        return !this.muted[i] && (!anySolo || this.solos[i]);
    }
    cancel(i, release = 20) {
        if (!this.tracks[i]) return;
        for (const g of this.tracks[i].groups) this.engine.stop_group(g, release);
        this.tracks[i].groups = [];
        this.tracks[i].tokens.clear();
        for (let p = 0; p < 128; p++) this.tracks[i].held[p] = [];
    }
    // HWorld::patch: structural changes cancel sounding notes; matching speech keeps its syllable cursor;
    // sounding voices glide to the new gain, pan and synth parameters.
    patch(i, patchData) {
        if (i < 0) return;
        this.resize(i + 1);
        const next = parse_patch(patchData);
        if (next.layers.length === 0 && next.kind !== "mumble") return;
        const track = this.tracks[i], old = track.patch;
        let structural = old.kind !== next.kind || old.layers.length !== next.layers.length;
        if (!structural) for (let k = 0; k < old.layers.length; k++) if (old.layers[k].trigger.features.algorithm !== next.layers[k].trigger.features.algorithm) structural = true;
        if ((structural || old.key !== next.key) && track.custom) this.cancel(i, 25);
        if (old.key === next.key) { next.cursor = old.cursor; next.last_onset = old.last_onset; }
        track.patch = next; track.custom = true;
        const spatial = this.engine.channel_spatial.get(i);
        if (spatial && next.layers.length > 0) { const f = next.layers[0].trigger.features; spatial.space = f.space; spatial.reverb = f.reverb; spatial.resonance = f.resonance; spatial.pan = next.pan; }
        for (const q of this.engine.pending) if (q.used && q.trigger.track_owner === i) { q.trigger.track_gain = next.gain; q.trigger.track_pan = next.pan; }
        for (const v of this.engine.voices) if (v.active() && v.track_owner === i) {
            v.target_track_gain = next.gain; v.target_track_pan = next.pan;
            if (next.kind === "synth" && v.layer_index < next.layers.length) { const t = next.layers[v.layer_index].trigger; v.target = new Float64Array(t.params); v.smooth_params = true; v.own_features = t.features; }
        }
    }
    sound(e, audition = false) {
        const i = e.organism;
        if (i < 0 || i >= this.tracks.length) return;
        const track = this.tracks[i];

        if (e.velocity <= 0) {
            let g = 0;
            if (e.token && track.tokens.has(e.token)) {
                g = track.tokens.get(e.token);
                track.tokens.delete(e.token);
            } else if (track.held[e.pitch] && track.held[e.pitch].length > 0) {
                g = track.held[e.pitch].shift();
            }
            if (g && (!track.custom || track.patch.kind !== "mumble" || track.patch.gated)) {
                const rel = track.custom ? (track.patch.layers.length === 0 ? 100 : track.patch.layers[0].trigger.params[6]) : FACTION_RELEASES[i % 17];
                this.engine.stop_group(g, rel);
            }
            return;
        }

        // Native counts every model note-on as it is processed, audible or not (world.hpp render).
        if (!audition && !this.drone_launch) { this.event_count++; this.note_counts[i]++; this.pulses[i] = 1.0; }
        if ((!this.audible(i) && !audition) || (track.custom && track.patch.layers.length === 0)) return;
        const group = this.next_group++;
        if (this.next_group >= 2000000000) this.next_group = 100000;

        if (e.token) {
            track.tokens.set(e.token, group);
            if (track.tokens.size > 4096) { this.cancel(i); return; }
        } else {
            track.held[e.pitch].push(group);
            if (track.held[e.pitch].length > 64) track.held[e.pitch].shift();
        }

        const p = track.patch;
        const limit = track.custom && p.kind === "mumble" ? p.polyphony : 32;
        if (track.custom && p.kind === "mumble" && p.mode === "phrase" && !p.overlap) { for (const g of track.groups) this.engine.stop_group(g, 20); track.groups = []; }
        while (track.groups.length >= limit) {
            this.engine.stop_group(track.groups.shift(), 15);
        }
        track.groups.push(group);

        const launch = (trig, delay, layer) => {
            const t = Object.assign({}, trig);
            t.features = Object.assign({}, trig.features);
            t.sfx = Object.assign({}, trig.sfx);
            t.harsh = default_harsh_settings(trig.harsh);
            t.fine = Number(trig.fine) || 0;
            t.params = new Float64Array(trig.params);
            if (track.custom && (p.kind === "mumble" || t.channel_spatial) && t.harsh.enabled) {
                t.harsh.root = 440 * Math.pow(2.0, (t.pitch + t.fine - 69) / 12.0);
            }
            if (this.drone_launch) {
                t.fine += this.drone_offset;
                t.sfx.hold_ms = -1;
            }
            t.group = group;
            t.velocity = e.velocity;
            t.seed = ((t.seed ^ Math.floor(group * 747796405)) | 1) >>> 0;
            t.track_owner = i;
            t.layer_index = layer;
            t.track_gain = track.custom ? (p.gain != null ? p.gain : 1.0) : 1.0;
            t.track_pan = track.custom ? (p.pan != null ? p.pan : 0.0) : 0.0;
            const ok = this.engine.trigger(t, Math.floor(delay * this.rate * 0.001));
            if (!ok) { this.rejected++; return false; }
            return true;
        };

        if (!track.custom) {
            const t = faction_trigger(i % 17, e.pitch, e.velocity);
            launch(t, 0, 0);
            return;
        }

        if (p.kind !== "mumble") {
            for (let k = 0; k < p.layers.length; k++) {
                const layer = p.layers[k];
                if (!layer.plays(e.pitch)) continue;
                const t = Object.assign({}, layer.trigger);
                t.pitch = layer.pitch_for(e.pitch);
                if (!launch(t, layer.delay, k)) {
                    this.engine.stop_group(group, 5);
                    break;
                }
            }
            return;
        }
        if (p.mode === "syllable") {
            if (p.syllables.length === 0) return;
            if (e.time - p.last_onset > 4) {
                if (p.last_onset > -1e8) p.cursor = p.random ? Number((BigInt(group >>> 0) * 2654435761n) & 0xffffffffn) % p.syllables.length : (p.cursor + 1) % p.syllables.length;
                p.last_onset = e.time;
            }
            const t = Object.assign({}, p.layers[0].trigger);
            t.sfx = Object.assign({}, t.sfx); t.params = new Float64Array(t.params);
            t.pitch = e.pitch; t.fine = 0; t.sfx.phoneme_count = 1;
            const syllable = Object.assign({}, p.syllables[p.cursor % p.syllables.length]);
            syllable.pitch *= p.contour; syllable.ms = Math.max(100, syllable.ms / p.rate);
            t.sfx.phonemes = [syllable]; t.sfx.sustain_syllable = p.gated; t.sfx.hold_ms = -1; t.params[5] = 1;
            if (t.harsh.enabled && p.gated) { t.harsh = Object.assign({}, t.harsh); t.harsh.sustain = .8; }
            if (!launch(t, 0, 0)) this.engine.stop_group(group, 5);
            return;
        }
        let duration = 1;
        for (const c of p.layers) { let end = c.delay; for (let k = 0; k < c.trigger.sfx.phoneme_count; k++) end += c.trigger.sfx.phonemes[k].ms; duration = Math.max(duration, end); }
        const scale = p.sync ? (p.beats * 60000 / this.tempo / duration) : 1 / p.rate;
        for (let k = 0; k < p.layers.length; k++) {
            const t = Object.assign({}, p.layers[k].trigger);
            t.sfx = Object.assign({}, t.sfx);
            const base = t.pitch + t.fine + e.pitch - p.reference;
            t.pitch = Math.floor(clamp(base, 0, 127)); t.fine = base - t.pitch;
            t.sfx.phonemes = t.sfx.phonemes.slice(0, t.sfx.phoneme_count).map(ph => Object.assign({}, ph, { pitch: ph.pitch * p.contour, ms: ph.ms * scale }));
            t.sfx.hold_ms = -1;
            if (!launch(t, p.layers[k].delay * scale, k)) { this.engine.stop_group(group, 5); break; }
        }
    }
    // HWorld::command (native/world.hpp), including its gating of inactive tracks.
    command(i, name, args) {
        args = args || [];
        if (name === "performance_palette") {
            const o = args[0] || {};
            const keys = ["tone", "metal", "grit", "motion", "space", "noise", "distortion"];
            for (let k = 0; k < 7; k++) this.character.set_control(k, Number(o[keys[k]]));
            return;
        }
        if (name === "performance_character") { this.character.set(Number(args[0])); return; }
        if (name === "track_add") {
            if (i < 0 || i > 100000) return;
            const before = this.tracks.length;
            this.resize(Math.max(before, i + 1));
            for (let k = before; k < this.tracks.length; k++) this.tracks[k].active = false;
            this.tracks[i].active = true;
            return;
        }
        if (i >= this.tracks.length || i < -1) return;
        const track = i >= 0 ? this.tracks[i] : null;
        if (name === "preview") {
            if (!track || !track.active) return;
            const temporary = parse_patch(args[0]);
            if (temporary.layers.length === 0) return;
            const old = track.patch, custom = track.custom;
            temporary.gated = false;
            if (temporary.kind === "synth") for (const c of temporary.layers) c.trigger.sfx.hold_ms = 400;
            track.patch = temporary; track.custom = true;
            const pitch = clamp(Math.trunc(Number(args[1])) || 0, 0, 127);
            this.sound({ time: this.time, organism: i, pitch: pitch, velocity: 100 }, true);
            if (track.held[pitch].length > 0) track.held[pitch].pop();
            track.previews.push(this.next_group - 1);
            while (track.previews.length > 32) track.previews.shift();
            track.patch = old; track.custom = custom;
            return;
        }
        if (name === "stop_preview") {
            if (!track) return;
            for (const g of track.previews) this.engine.stop_group(g, 15);
            track.previews = [];
            return;
        }
        if (name === "set_patch") { if (track && track.active) this.patch(i, args[0]); return; }
        if (name === "track_fx") { if (track && track.active) this.engine.set_track_fx(i, args[0], this.rate); return; }
        if (name === "track_solo") {
            if (track && track.active) {
                this.solos[i] = Boolean(args[0]);
                for (let j = 0; j < this.tracks.length; j++) if (this.tracks[j].active && !this.audible(j)) this.cancel(j);
            }
            return;
        }
        if (name === "drone") {
            if (!track || !track.active) return;
            const release = track.custom && track.patch.layers.length > 0 ? track.patch.layers[0].trigger.params[6] : 200;
            for (const d of track.drones) if (d.group) {
                this.engine.stop_group(d.group, release);
                const at = track.groups.indexOf(d.group); if (at >= 0) track.groups.splice(at, 1);
            }
            track.drones = [];
            const list = Array.isArray(args[0]) ? args[0] : [];
            const velocity = Math.trunc(Number(args[1]));
            track.drone_velocity = clamp(Number.isFinite(velocity) ? velocity : 1, 1, 127);
            for (let k = 0; k < Math.min(16, list.length); k++) {
                const pitch = clamp(Math.trunc(Number(list[k])) || 0, 0, 127);
                if (!track.drones.some(d => d.pitch === pitch)) track.drones.push({ pitch: pitch, group: 0, retry: -1e9 });
            }
            return;
        }
        if (name === "drone_fine") {
            if (track && track.active) { const v = Number(args[0]); track.drone_fine = Number.isFinite(v) ? clamp(v, -48, 48) : 0; this.drone_retune(i); }
            return;
        }
        if (name === "restart_syllables") { if (track) { track.patch.cursor = 0; track.patch.last_onset = -1e9; } return; }
        if (track && !track.active && name !== "track_restore" && name !== "track_forget") return;
        if (name === "input_note" && track) {
            // Native plays live notes as the model's echo; this path serves the engine on its own (tests, no model).
            const p = clamp(Math.round(Number(args[0])), 0, 127), v = clamp(Math.round(Number(args[1])), 0, 127);
            this.sound({ time: this.time, organism: i, pitch: p, velocity: v }, true);
            return;
        }
        if (name === "track_remove" && track) {
            track.drones = []; this.cancel(i); this.engine.channel_spatial.delete(i); this.engine.track_fx.delete(i);
            track.active = false; this.solos[i] = false; this.muted[i] = false;
        }
        if (name === "track_restore" && track) track.active = true;
        if (name === "track_forget" && track) { track.patch = parse_patch(null); track.groups = []; }
        if (name === "stop_loop") {
            if (i < 0) { for (let j = 0; j < this.tracks.length; j++) this.cancel(j); this.engine.panic(); this.character.clear(); }
            else this.cancel(i);
        }
        if (name === "transport_tempo") { const t = Number(args[0]); if (Number.isFinite(t)) this.tempo = clamp(t, 30, 240); }
    }
    // HWorld::syllable_positions: the speech cursor of each MumbleSpeak track, -1 for the rest.
    syllable_positions() { return this.tracks.map(t => t.active && t.custom && t.patch.kind === "mumble" ? t.patch.cursor : -1); }
    // A live gesture value for one effect slot (HWorld::fx_param).
    fx_param(i, id, name, value) { this.engine.set_fx_param(i, id, name, value); }
    render(outL, outR, frames) {
        this.service_drones();
        for (let n = 0; n < frames; n++) {
            this.character.advance(this.rate);
            for (let k = 0; k < 4; k++) this.engine.performance_palette[k] = this.character.controls[k];
            const v = this.character.process(this.engine.sample_stereo());
            outL[n] = Math.tanh(v.left);
            outR[n] = Math.tanh(v.right);
        }
        this.rendered += frames;
        this.time += frames * 1000.0 / this.rate;
        const decay = Math.exp(-frames / this.rate * 7.0);
        for (let k = 0; k < this.pulses.length; k++) this.pulses[k] *= decay;
    }
}

// ---------------------------------------------------------------------------
// Browser / Web Audio Host
// ---------------------------------------------------------------------------
// The Godot bridge keeps calling world.*; forward those calls in order to the
// audio thread. No second synth runs on the UI thread when using the worklet.
function applyAudioAction(world, op, args) {
    if (op === 'muted') {
        const [i, value] = args;
        world.resize(i + 1);
        // HWorld::silence: muting cuts the track's notes and its channel echo/hall.
        world.muted[i] = Boolean(value);
        if (value) { world.cancel(i, 20); world.engine.channel_spatial.delete(i); }
    } else if (op === 'solo') {
        const i = args[0];
        world.solo = i;
        world.solos.fill(false);
        if (i >= 0) { world.resize(i + 1); world.solos[i] = true; }
        for (let j = 0; j < world.tracks.length; j++) {
            if (world.tracks[j].active && !world.audible(j)) world.cancel(j);
        }
    } else {
        world[op](...args);
    }
}

class AudioWorldProxy {
    constructor(host) {
        this.host = host;
        this.note_counts = []; this.pulses = []; this.tracks = []; this.fx_state = []; this.syllables = [];
        this.time = 0; this.rendered = 0; this.event_count = 0;
    }
    send(op, args) { this.host.send(op, args); }
    initFactions(factions) {
        this.tracks.length = factions.length;
        this.send('initFactions', [factions]);
    }
    command(...args) { this.send('command', args); }
    sound(...args) { this.send('sound', args); }
    patch(...args) { this.send('patch', args); }
    fx_param(...args) { this.send('fx_param', args); }
}

const AUDIO_MODULE_URL = typeof document !== 'undefined' ? document.currentScript?.src : '';

class VoidCantorWebAudio {
    constructor() {
        this.ctx = null; this.node = null; this.scriptNode = null;
        this.masterGain = null; this.running = false; this.peak = 0;
        this.volume = 0.7; this.backend = 'starting'; this.error = '';
        this.queue = []; this.localWorld = null; this.port = null;
        this.world = new AudioWorldProxy(this);
        // Capture the URL while the script is executing, before addModule's await.
        this.moduleURL = AUDIO_MODULE_URL;
        const unlock = () => this.resumeIfNeeded();
        for (const event of ['pointerdown', 'keydown', 'touchstart', 'click']) {
            window.addEventListener(event, unlock, { passive: true, capture: true });
        }
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) this.resumeIfNeeded();
        });
    }
    init() {
        if (this.initializing) return this.initializing;
        const Context = window.AudioContext || window.webkitAudioContext;
        if (!Context) return Promise.resolve();
        this.ctx = new Context({ latencyHint: 'interactive' });
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.volume;
        this.masterGain.connect(this.ctx.destination);
        this.initializing = this.start();
        return this.initializing;
    }
    async start() {
        try {
            if (!this.ctx.audioWorklet || !window.AudioWorkletNode) throw new Error('AudioWorklet unavailable');
            await this.ctx.audioWorklet.addModule(this.moduleURL);
            const node = new AudioWorkletNode(this.ctx, 'void-cantor', {
                numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2]
            });
            // Wait for the processor to construct successfully before discarding
            // queued setup/notes. Missing worklet files must never silently mute.
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Audio processor startup timed out')), 10000);
                node.onprocessorerror = () => { clearTimeout(timeout); reject(new Error('Audio processor failed')); };
                node.port.onmessage = ({ data }) => {
                    if (data.type === 'ready') { clearTimeout(timeout); resolve(); }
                    else if (data.type === 'stats') this.receiveStats(data);
                    else if (data.type === 'error') console.error('Void Cantor audio thread:', data.message);
                };
            }).catch(error => { node.disconnect(); node.port.close(); throw error; });
            this.node = node; this.port = node.port;
            node.onprocessorerror = () => {
                this.error = 'Audio processor stopped. Reload to restart audio.';
                console.error(this.error);
                window.dispatchEvent(new CustomEvent('haecceity-audio-error', { detail: this.error }));
            };
            for (const action of this.queue) this.port.postMessage(action);
            this.queue.length = 0;
            node.connect(this.masterGain);
            this.backend = 'worklet';
        } catch (error) {
            console.warn('Void Cantor: using buffered audio fallback:', error);
            this.localWorld = new HWorld();
            this.localWorld.rate = this.localWorld.engine.sample_rate = this.ctx.sampleRate;
            for (const action of this.queue) applyAudioAction(this.localWorld, action.op, action.args);
            this.queue.length = 0;
            this.node = this.scriptNode = this.ctx.createScriptProcessor(2048, 0, 2);
            this.scriptNode.onaudioprocess = event => {
                const left = event.outputBuffer.getChannelData(0);
                const right = event.outputBuffer.getChannelData(1);
                this.localWorld.render(left, right, left.length);
                let peak = 0;
                for (let i = 0; i < left.length; i++) peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
                this.receiveStats({ peak, note_counts: this.localWorld.note_counts, pulses: this.localWorld.pulses,
                    time: this.localWorld.time, rendered: this.localWorld.rendered, event_count: this.localWorld.event_count, fx_state: this.localWorld.engine.fx_state(), syllables: this.localWorld.syllable_positions() });
            };
            this.node.connect(this.masterGain);
            this.backend = 'buffered';
        }
        this.running = true;
    }
    send(op, args) {
        const action = { op, args };
        if (this.port) this.port.postMessage(action);
        else if (this.localWorld) applyAudioAction(this.localWorld, op, args);
        else this.queue.push(action);
    }
    receiveStats(data) {
        this.peak = Math.max(this.peak, data.peak);
        for (const key of ['note_counts', 'pulses', 'time', 'rendered', 'event_count', 'fx_state', 'syllables']) if (data[key] !== undefined) this.world[key] = data[key];
    }
    resumeIfNeeded() {
        this.init();
        if (this.ctx && this.ctx.state !== 'running' && this.ctx.state !== 'closed') this.ctx.resume().catch(console.warn);
    }
    setVolume(value) {
        this.volume = clamp(Number(value) || 0, 0, 1);
        if (this.masterGain) this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.01);
    }
    decayPeak(dt) { const peak = this.peak; this.peak = Math.max(0, peak - dt * 2.5); return peak; }
    setMuted(i, value) { if (i >= 0) this.send('muted', [i, value]); }
    setSolo(i) { this.send('solo', [i]); }
    noteOn(organism, pitch, velocity) { this.resumeIfNeeded(); this.world.sound({ organism, pitch, velocity }, false); }
    noteOff(organism, pitch) { this.world.sound({ organism, pitch, velocity: 0 }, false); }
    preview(organism, pitch, patch) { this.resumeIfNeeded(); this.world.command(organism, 'preview', [patch, pitch]); }
    stopPreview(organism) { this.world.command(organism, 'stop_preview', []); }
    setPatch(organism, patch) { this.world.patch(organism, patch); }
}

// The same file is loaded by the page and the worklet, keeping the DSP identical.
if (typeof registerProcessor === 'function') {
    class VoidCantorProcessor extends AudioWorkletProcessor {
        constructor() {
            super();
            this.world = new HWorld();
            this.world.rate = this.world.engine.sample_rate = sampleRate;
            this.untilStats = 0; this.peak = 0;
            this.port.onmessage = ({ data }) => {
                try { applyAudioAction(this.world, data.op, data.args); }
                catch (error) { this.report(error, data.op); }
            };
            this.port.postMessage({ type: 'ready' });
        }
        // The page cannot see worklet exceptions (onprocessorerror carries no message), so send the text first.
        report(error, where) {
            this.port.postMessage({ type: 'error', message: `${where}: ${error && error.stack || error}` });
        }
        process(inputs, outputs) {
            const [left, right] = outputs[0];
            try { this.world.render(left, right, left.length); }
            catch (error) { this.report(error, 'render'); throw error; }
            for (let i = 0; i < left.length; i++) this.peak = Math.max(this.peak, Math.abs(left[i]), Math.abs(right[i]));
            this.untilStats -= left.length;
            if (this.untilStats <= 0) {
                this.untilStats = sampleRate / 20;
                this.port.postMessage({ type: 'stats', peak: this.peak, note_counts: this.world.note_counts,
                    pulses: this.world.pulses, time: this.world.time, rendered: this.world.rendered, event_count: this.world.event_count, fx_state: this.world.engine.fx_state(), syllables: this.world.syllable_positions() });
                this.peak = 0;
            }
            return true;
        }
    }
    registerProcessor('void-cantor', VoidCantorProcessor);
}

if (typeof window !== 'undefined') {
    window.VoidCantorWorld = HWorld;
    window._void_cantor = new VoidCantorWebAudio();
    window._haecceity_synth = window._void_cantor;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { HWorld, Engine, Voice, MaterialInstrument, HarshEmitter, Space, ResonantReverb, PerformanceCharacter, faction_trigger, parse_patch };
}
})();
