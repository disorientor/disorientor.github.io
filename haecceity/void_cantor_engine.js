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
function default_sfx(s) {
    s = s || {};
    return {
        hold_ms: s.hold_ms != null ? s.hold_ms : -1,
        gain: s.gain != null ? s.gain : 1.0,
        pan: s.pan != null ? s.pan : 0.0,
        hardness: s.hardness != null ? s.hardness : 0.5,
        decay: s.decay != null ? s.decay : 0.5,
        pitch_from: s.pitch_from != null ? s.pitch_from : 0,
        pitch_to: s.pitch_to != null ? s.pitch_to : 0,
        pitch_ms: s.pitch_ms != null ? s.pitch_ms : 0,
        pitch_curve: s.pitch_curve != null ? s.pitch_curve : 1.0,
        cutoff_from: s.cutoff_from != null ? s.cutoff_from : 0,
        cutoff_to: s.cutoff_to != null ? s.cutoff_to : 0,
        cutoff_ms: s.cutoff_ms != null ? s.cutoff_ms : 0,
        bow: s.bow != null ? s.bow : 0,
        hp: s.hp != null ? s.hp : 0,
        soft_clip: s.soft_clip != null ? s.soft_clip : 0,
        position: s.position != null ? s.position : 0.27,
        physical: default_physical_settings(s.physical)
    };
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
function default_params() {
    return new Float64Array([1, 2000, 0.3, 5, 150, 0.7, 400, 0, 2, 0.1, 1.5, 0, 0.5, 8, 0.1, 0.02, 180, 0, 0, 0, 0, 0, 0.7, 0, 58, 0, 90, 0, 1, 0.5, 0.4, 0.3, 4, 0.6, 0]);
}
function sfx_default_params() {
    const p = default_params();
    p[1] = 16000; p[2] = 0.08; p[3] = 1; p[4] = 400; p[5] = 1; p[6] = 250;
    p[9] = 0; p[10] = 1; p[14] = 0; p[15] = 0; p[27] = 0; p[28] = 0; p[30] = 0; p[31] = 0;
    return p;
}

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
        this.pitch = note;
        this.velocity = clamp(vel / 127.0, 0.0, 1.0);
        this.gate = true;
        this.serial = id;
        this.random = seed ? (seed | 1) >>> 0 : (Math.floor(id * 747796405 + note * 2891336453) | 1) >>> 0;
        this.physical.seed(this.random);
        this.env.on();
        this.body.on();
        const seedObj = { val: (this.random ^ 0x9e3779b9) >>> 0 };
        this.strike_pitch = random_bipolar(seedObj);
        this.strike_brightness = random_bipolar(seedObj);
        this.strike_attack = random_bipolar(seedObj);
        this.strike_gain = random_bipolar(seedObj);
        this.base_hz = 440.0 * Math.pow(2.0, (note - 69.0) / 12.0);
        this.age = 0;
        this.tail = 0;
        this.modes_seeded = false;
        this.formants_ready = false;
    }
    note_off(sr) {
        this.gate = false;
        const release_ms = this.target[6]; // RELEASE
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
        const contour_pitch = (this.fine || 0) + (sfx.pitch_from || 0) +
            (sfx.pitch_ms > 0 ? (sfx.pitch_to - sfx.pitch_from) * Math.pow(clamp(ms / sfx.pitch_ms, 0.0, 1.0), Math.max(0.05, sfx.pitch_curve || 1.0)) : 0);
        const contour_cutoff = (sfx.cutoff_from || 0) +
            (sfx.cutoff_ms > 0 ? (sfx.cutoff_to - sfx.cutoff_from) * clamp(ms / sfx.cutoff_ms, 0.0, 1.0) : 0);

        if (this.own && this.gate && sfx.hold_ms >= 0 && ms >= sfx.hold_ms) this.note_off(sr);
        if (this.own && this.gate && (features.algorithm || 0) >= 10 && sfx.hold_ms < 0 && ms > (sfx.physical ? sfx.physical.gesture_ms : 650) + 250) this.note_off(sr);

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
        if (this.engine_weights[6] > 0.00001) source += this.modal_bank(orig * (sfx.bow || 0), struck, features, sr, false) * this.engine_weights[6];
        if (this.engine_weights[7] > 0.00001) source += this.formant_voice(frequency, sr) * this.engine_weights[7];
        if (this.engine_weights[8] > 0.00001) source += this.blast(frequency, sr) * this.engine_weights[8];
        if (this.engine_weights[10] > 0.00001) source += this.physical.process(frequency, sr, false, this.gate, sfx.physical || {}, sfx.position || 0.27, this.keyboard_profile && sfx.physical && sfx.physical.gesture === 1) * this.engine_weights[10];
        if (this.engine_weights[11] > 0.00001) source += this.physical.process(frequency, sr, true, this.gate, sfx.physical || {}, sfx.position || 0.27, this.keyboard_profile && sfx.physical && sfx.physical.gesture === 1) * this.engine_weights[11];

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
            const spread = musical ? 0 : (this.sfx.spread || 0.3);
            for (let k = 0; k < 24; k++) {
                this.mode_detune[k] = spread * 0.012 * random_bipolar(seedObj);
                this.mode_jitter[k] = Math.max(0.15, 1.0 + spread * 0.45 * random_bipolar(seedObj));
            }
            this.clash_time = 0.003 + 0.009 * Math.abs(random_bipolar(seedObj));
            this.bounce_interval = (this.sfx.bounce_ms || 160) * 0.001 * (1.0 + spread * 0.25 * random_bipolar(seedObj));
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
                else if (material === 7) ratio = Math.pow(k + 1.0, 1.0 + (this.sfx.warp || 0) * 0.6) * (1.0 + 0.05 * Math.sin((k + 1.0) * (1.0 + (this.sfx.warp || 0) * 7.0)));
                else ratio = MATERIAL_RATIOS[material][k] * (1.0 + (features.metal || 0) * 0.012 * k);
                ratio *= 1.0 + this.mode_detune[k];

                const f = hz * ratio * (1.0 + (this.sfx.tension || 0) * level * 0.06 * (musical ? 0 : 1));
                if (f > sr * 0.45 || f < 15.0) {
                    this.mode_a1[k] = this.mode_a2[k] = this.mode_gain[k] = this.mode_drive[k] = 0;
                    continue;
                }
                let t60 = musical ? (0.35 + (features.body || 0) * 3.6) / (1.0 + k * (0.45 - (features.body || 0) * 0.25)) :
                    (this.sfx.decay || 1.5) * (1.0 + (features.body || 0)) * Math.pow(Math.max(1.0, ratio / first), -MATERIAL_SLOPE[material]);
                t60 = Math.max(0.004, t60);
                const r = Math.exp(-6.907755 / (t60 * sr));
                const w = TAU * f / sr;
                const s = Math.sin(w);
                const amplitude = musical ? Math.pow(k + 1.0, -(0.35 + (features.body || 0) * 0.6)) :
                    Math.pow(k + 1.0, -(0.2 + (1.0 - (this.sfx.hardness || 0.6)) * 1.3)) * (0.15 + 0.85 * Math.abs(Math.sin((k + 1.0) * PI * (this.sfx.position || 0.27)))) * this.mode_jitter[k];

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
                    const length = 0.0008 + (1.0 - (this.sfx.hardness || 0.6)) * 0.006;
                    if (this.age < length) excitation = (0.5 - 0.5 * Math.cos(TAU * this.age / length)) * (1.0 + this.noise() * (this.sfx.hardness || 0.6) * 0.5) * 0.8;
                    break;
                }
                case 1: // HAMMER
                    if (this.age === 0) strike(1.4, 0.0004);
                    break;
                case 2: // SCRAPE
                    if (this.gate) {
                        this.scrape_clock += (this.sfx.scrape_rate || 600) * (1.0 + 0.6 * this.noise()) / sr;
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
                        this.bounce_interval *= this.sfx.bounce_ratio || 0.72;
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
    formant_voice(hz, sr) {
        let targets = VOWEL_FORMANTS[clamp(this.sfx.vowel || 0, 0, 9)];
        let pitch_target = 0, amp_target = 1, voicing = 1, fricative = 0, burst = 0;
        let syllable_ms = 0, syllable_fraction = 0, consonant_length = 0;
        let speaking = true;

        if (this.sfx.phoneme_count > 0 && this.phoneme < this.sfx.phoneme_count) {
            const ph = this.sfx.phonemes[this.phoneme];
            const t = this.phoneme_time * 1000.0;
            syllable_ms = t;
            syllable_fraction = clamp(t / Math.max(1.0, ph.ms), 0.0, 1.0);
            targets = VOWEL_FORMANTS[clamp(ph.vowel || 0, 0, 9)];
            pitch_target = ph.pitch || 0;
            amp_target = ph.amp || 1.0;
            const consonant_ms = ph.consonant === 1 ? 28 : (ph.consonant === 2 ? 65 : (ph.consonant === 3 ? 55 : (ph.consonant === 4 ? 40 : 0)));
            consonant_length = consonant_ms;

            if (ph.consonant === 5) { // PAUSE
                voicing = 0; amp_target = 0; speaking = false;
            } else if (t < consonant_ms) {
                switch (ph.consonant) {
                    case 1: voicing = 0; amp_target = 1; burst = t > 18 ? 1 : 0; break;
                    case 2: voicing = 0.12; fricative = 1; break;
                    case 3: targets = NASAL_FORMANTS; amp_target *= 0.55; break;
                    case 4: targets = LIQUID_FORMANTS; break;
                }
            }
            if (!this.sfx.sustain_syllable && (!this.material || !this.material.settings.speech_adsr) && (ph.consonant !== 1 || t >= consonant_ms)) {
                amp_target *= clamp(Math.min(t / 10.0, (ph.ms - t) / 18.0), 0.0, 1.0);
            }
            this.phoneme_time += 1.0 / sr;
            if (this.phoneme_time * 1000.0 >= ph.ms) {
                if (this.sfx.sustain_syllable && this.phoneme === this.sfx.phoneme_count - 1) {
                    this.phoneme_time = Math.max(70.0, ph.ms - 20.0) / 1000.0;
                } else {
                    this.phoneme++;
                    this.phoneme_time = 0;
                }
            }
        }

        this.voice_pitch += (pitch_target - this.voice_pitch) * this.pitch_follow;
        this.voice_amp += (amp_target - this.voice_amp) * this.amp_follow;
        this.jitter += (this.noise() - this.jitter) * 0.002;

        const f0 = clamp(hz * Math.pow(2.0, this.voice_pitch / 12.0) * (1.0 + (this.sfx.roughness || 0.1) * 0.04 * this.jitter), 20.0, sr * 0.4);
        const dt = f0 / sr;
        let pulse = -Voice.saw(this.voice_phase, dt);
        if (this.voice_phase + dt >= 1.0) {
            this.shimmer = 1.0 + (this.sfx.roughness || 0.1) * 0.5 * this.noise();
            this.sub_flip = !this.sub_flip;
        }
        Voice.advance(this, 'voice_phase', f0, sr);
        pulse *= this.shimmer * (this.sub_flip ? 1.0 - (this.sfx.subharmonic || 0) * 0.7 : 1.0);
        this.glottis += (pulse - this.glottis) * 0.35;

        const excitation = this.glottis * voicing * (this.sfx.voicing != null ? this.sfx.voicing : 1.0) +
            this.noise() * (this.sfx.breath != null ? this.sfx.breath : 0.08) * 0.6 * (voicing > 0.5 ? 1.0 : 0.4);

        const scale = 1.0 / clamp(this.sfx.vocal_size || 1.0, 0.4, 2.5);
        const retune = this.formant_clock-- <= 0;
        if (retune) this.formant_clock = 16;
        const gains = FORMANT_TABLES.gains;
        const res = FORMANT_TABLES.res;
        let out = 0;

        for (let i = 0; i < 4; i++) {
            const target = targets[i] * scale * (1.0 + (this.sfx.formant_motion || 0) * 0.32 * Math.sin(this.age * (3.1 + i * 1.7) + i * 1.2));
            this.formant_hz[i] = this.formants_ready ? this.formant_hz[i] + (target - this.formant_hz[i]) * this.formant_follow : target;
            if (retune || !this.formants_ready) this.formant_g[i] = Math.tan(PI * clamp(this.formant_hz[i], 20.0, sr * 0.4) / sr);
            out += this.formant[i].process_g(excitation, this.formant_g[i], res[i]).mid * (2.0 - 1.94 * res[i]) * gains[i];
        }
        this.formants_ready = true;
        const n = this.noise();
        this.hiss += (n - this.hiss) * 0.2;
        out += (n - this.hiss) * fricative * 0.35 + burst * this.noise() * 0.5;
        return clamp(out * this.voice_amp * 2.2, -3.0, 3.0);
    }
    blast(hz, sr) {
        const n = this.noise();
        this.rumble += (n - this.rumble) * this.rumble_lp;
        if ((this.rumble_clock -= 1.0 / sr) <= 0) {
            this.rumble_clock = 0.08 + 0.1 * Math.abs(this.noise());
            this.rumble_target = 0.3 + 0.7 * Math.abs(this.noise());
        }
        this.rumble_am += (this.rumble_target - this.rumble_am) * this.rumble_follow;
        if (Math.abs(this.noise()) < (this.sfx.crackle || 0.3) * 900.0 * Math.exp(-this.age * 2.5) / sr) {
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
        return air * (this.sfx.noise_amount || 0.6) * 0.45 + this.rumble * this.rumble_am * (this.sfx.rumble || 0.4) * 3.2 + debris * 0.8 + boom * (this.sfx.boom || 0.8) * 0.9;
    }
}

// ---------------------------------------------------------------------------
// Void Cantor Engine (engine.hpp)
// ---------------------------------------------------------------------------
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
    panic() {
        this.channel_spatial.clear();
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
            if (v.keyboard_profile) s *= (v.sfx.gain != null ? v.sfx.gain : 1.0);

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

        const revAmt = this.target_features.reverb === 0 && (this.features.reverb || 0) < 0.00001 ? 0 : (this.features.reverb || 0);
        const stereo = this.reverb.process(spaced, revAmt, this.features.resonance || 0, this.reverb_root, this.sample_rate);

        for (const fx of this.channel_spatial.values()) {
            const dry = fx.input * this.gain;
            const blk = dry - fx.dc_x + 0.995 * fx.dc_y;
            fx.dc_x = dry; fx.dc_y = blk;
            const wet = fx.hall.process(fx.echoes.process(blk, fx.space, this.sample_rate), fx.reverb, fx.resonance, fx.root, this.sample_rate);
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
const FACTION_RELEASES = [120, 320, 620, 200, 650, 900, 60, 400, 120, 90, 70, 250, 230, 350, 1100, 50, 35];

function faction_trigger(i, pitch, velocity) {
    const t = {
        pitch: pitch,
        velocity: velocity,
        group: i * 128 + pitch,
        seed: (1977 + i * 104729 + pitch * 1009) >>> 0,
        params: sfx_default_params(),
        features: { algorithm: 0, material: 0, exciter: 0, body: 0, metal: 0, rupture: 0, motion: 0, space: 0, humanise: 0, reverb: 0, resonance: 0, routes: [] },
        sfx: { hold_ms: 15000, gain: 1, pan: 0 }
    };
    t.params[5] = 0.5; // SUSTAIN

    switch (i % 17) {
        case 0:
            t.features.algorithm = 10; t.features.material = 3;
            t.params[3] = 1; t.params[4] = 180; t.params[6] = 120; t.params[1] = 3200; t.params[9] = 0;
            t.features.body = 0.04; t.features.metal = 0.1;
            t.sfx.pan = -0.8; t.sfx.gain = 1.201619; t.sfx.hardness = 0.98; t.sfx.decay = 0.25;
            t.sfx.pitch_from = -12; t.sfx.pitch_to = -24; t.sfx.pitch_ms = 100;
            t.sfx.physical = { gesture: 0, pressure: 0.95, friction: 0.3, damping: 0.7, inharmonicity: 0.85, fracture: 0.15, gesture_ms: 180 };
            break;
        case 1:
            t.features.algorithm = 3; t.features.material = 1;
            t.params[3] = 1; t.params[4] = 260; t.params[6] = 320; t.params[1] = 7800; t.params[9] = 0; t.params[5] = 0.0;
            t.features.body = 0.89; t.features.metal = 0.04;
            t.sfx.pan = -0.7; t.sfx.gain = 0.918236; t.sfx.hold_ms = 380;
            break;
        case 2:
            t.features.algorithm = 7; t.features.material = 0;
            t.params[3] = 160; t.params[4] = 800; t.params[6] = 620; t.params[1] = 7200; t.params[9] = 0;
            t.features.body = 0; t.features.metal = 0;
            t.sfx.pan = -0.6; t.sfx.gain = 0.743338; t.sfx.vowel = 2; t.sfx.vocal_size = 0.5;
            t.sfx.breath = 0.28; t.sfx.voicing = 0.8; t.sfx.formant_motion = 0.65; t.sfx.chamber = 0.6; t.sfx.reverse_mix = 0.18;
            break;
        case 3:
            t.features.algorithm = 6; t.features.material = 6;
            t.params[3] = 5; t.params[4] = 950; t.params[6] = 200; t.params[1] = 2800; t.params[9] = 0;
            t.params[18] = 0.7; t.params[13] = 13; t.params[14] = 0.5;
            t.features.body = 0; t.features.metal = 0;
            t.sfx.pan = -0.5; t.sfx.gain = 2.112719; t.features.exciter = 2;
            t.sfx.hardness = 0.35; t.sfx.scrape_rate = 160; t.sfx.decay = 0.095; t.sfx.clang = 0.65; t.sfx.bow = 0.35; t.sfx.hp = 180;
            break;
        case 4:
            t.features.algorithm = 11; t.features.material = 0;
            t.params[3] = 1; t.params[4] = 420; t.params[6] = 650; t.params[1] = 5400; t.params[9] = 0;
            t.features.body = 0; t.features.metal = 0;
            t.sfx.pan = -0.4; t.sfx.gain = 0.950796;
            t.sfx.physical = { gesture: 2, pressure: 0.8, friction: 0.45, contact_speed: 0.3, coupling: 0.45, damping: 0.45, stress: 0.7, elasticity: 0.35, inharmonicity: 0.7, fracture: 0.35, material_feedback: 0.35, gesture_ms: 600 };
            break;
        case 5:
            t.features.algorithm = 4; t.features.material = 0;
            t.params[3] = 60; t.params[4] = 650; t.params[6] = 900; t.params[1] = 9200; t.params[9] = 0;
            t.features.body = 0.65; t.features.metal = 0.32;
            t.sfx.pan = -0.3; t.sfx.gain = 0.949399;
            break;
        case 6:
            t.features.algorithm = 2; t.features.material = 5;
            t.params[3] = 1; t.params[4] = 120; t.params[6] = 60; t.params[1] = 12000; t.params[9] = 0;
            t.features.body = 0.25; t.features.metal = 0.95;
            t.sfx.pan = -0.2; t.sfx.gain = 1.054452; t.sfx.hardness = 0.95; t.sfx.decay = 0.12; t.sfx.clang = 0.85;
            break;
        case 7:
            t.features.algorithm = 5; t.features.material = 0;
            t.params[3] = 1; t.params[4] = 480; t.params[6] = 400; t.params[1] = 11000; t.params[9] = 0;
            t.features.body = 0.75; t.features.metal = 0.25;
            t.sfx.pan = -0.1; t.sfx.gain = 0.884144;
            break;
        case 8:
            t.features.algorithm = 8; t.features.material = 0;
            t.params[3] = 1; t.params[4] = 300; t.params[6] = 120; t.params[1] = 6200; t.params[9] = 0;
            t.features.body = 0; t.features.metal = 0;
            t.sfx.pan = 0.0; t.sfx.gain = 0.791559; t.sfx.boom = 1.2; t.sfx.crackle = 0.45; t.sfx.rumble = 0.85; t.sfx.noise_amount = 0.35;
            break;
        case 9:
            t.features.algorithm = 1; t.features.material = 0;
            t.params[3] = 2; t.params[4] = 180; t.params[6] = 90; t.params[1] = 8400; t.params[9] = 0;
            t.features.body = 0.1; t.features.metal = 0.8; t.features.rupture = 0.55;
            t.sfx.pan = 0.1; t.sfx.gain = 0.825867;
            break;
        case 10:
            t.features.algorithm = 6; t.features.material = 4;
            t.params[3] = 1; t.params[4] = 250; t.params[6] = 70; t.params[1] = 4200; t.params[9] = 0;
            t.features.body = 0; t.features.metal = 0;
            t.sfx.pan = 0.2; t.sfx.gain = 1.348963; t.features.exciter = 1;
            t.sfx.hardness = 0.9; t.sfx.decay = 0.22; t.sfx.tension = 0.35; t.sfx.clang = 0.4;
            break;
        case 11:
            t.features.algorithm = 10; t.features.material = 5;
            t.params[3] = 1; t.params[4] = 320; t.params[6] = 250; t.params[1] = 4600; t.params[9] = 0;
            t.features.body = 0; t.features.metal = 0;
            t.sfx.pan = 0.3; t.sfx.gain = 1.054452;
            t.sfx.physical = { gesture: 0, pressure: 0.85, friction: 0.5, damping: 0.55, inharmonicity: 0.65, fracture: 0.2, gesture_ms: 300 };
            break;
        case 12:
            t.features.algorithm = 7; t.features.material = 0;
            t.params[3] = 80; t.params[4] = 400; t.params[6] = 230; t.params[1] = 6800; t.params[9] = 0;
            t.features.body = 0; t.features.metal = 0;
            t.sfx.pan = 0.4; t.sfx.gain = 0.743338; t.sfx.vowel = 6; t.sfx.vocal_size = 0.85; t.sfx.voicing = 0.9; t.sfx.subharmonic = 0.35;
            break;
        case 13:
            t.features.algorithm = 0; t.features.material = 0;
            t.params[3] = 4; t.params[4] = 280; t.params[6] = 350; t.params[1] = 6500; t.params[9] = 0;
            t.features.body = 0.45; t.features.metal = 0.15;
            t.sfx.pan = 0.5; t.sfx.gain = 0.851138;
            break;
        case 14:
            t.features.algorithm = 4; t.features.material = 0;
            t.params[3] = 120; t.params[4] = 900; t.params[6] = 1100; t.params[1] = 8800; t.params[9] = 0;
            t.features.body = 0.85; t.features.metal = 0.15;
            t.sfx.pan = 0.6; t.sfx.gain = 0.884144;
            break;
        case 15:
            t.features.algorithm = 8; t.features.material = 0;
            t.params[3] = 1; t.params[4] = 140; t.params[6] = 50; t.params[1] = 9800; t.params[9] = 0;
            t.features.body = 0; t.features.metal = 0;
            t.sfx.pan = 0.7; t.sfx.gain = 0.950796; t.sfx.boom = 0.4; t.sfx.crackle = 0.95; t.sfx.noise_amount = 0.85; t.sfx.noise_color = 1;
            break;
        case 16:
            t.features.algorithm = 6; t.features.material = 2;
            t.params[3] = 1; t.params[4] = 90; t.params[6] = 35; t.params[1] = 14000; t.params[9] = 0;
            t.features.body = 0; t.features.metal = 0;
            t.sfx.pan = 0.8; t.sfx.gain = 1.488358; t.features.exciter = 0;
            t.sfx.hardness = 0.98; t.sfx.decay = 0.08; t.sfx.clang = 0.9;
            break;
    }
    return t;
}

// ---------------------------------------------------------------------------
// Patch Parser (patch.hpp)
// ---------------------------------------------------------------------------
function parse_trigger(o) {
    const vals = o.values || o;
    const t = {
        pitch: Math.round(Number(vals.pitch != null ? vals.pitch : 60)),
        velocity: Math.round(Number(vals.velocity != null ? vals.velocity : 100)),
        features: {
            algorithm: Math.round(Number(o.engine != null ? o.engine : (vals.engine != null ? vals.engine : 0))),
            material: Math.round(Number(o.material != null ? o.material : (vals.material != null ? vals.material : 0))),
            exciter: Math.round(Number(o.exciter != null ? o.exciter : (vals.exciter != null ? vals.exciter : 0))),
            body: Number(vals.body != null ? vals.body : (o.features && o.features.body != null ? o.features.body : 0)),
            metal: Number(vals.metal != null ? vals.metal : (o.features && o.features.metal != null ? o.features.metal : 0)),
            rupture: Number(vals.rupture != null ? vals.rupture : (o.features && o.features.rupture != null ? o.features.rupture : 0)),
            motion: Number(vals.motion != null ? vals.motion : (o.features && o.features.motion != null ? o.features.motion : 0)),
            humanise: Number(vals.humanise != null ? vals.humanise : (o.features && o.features.humanise != null ? o.features.humanise : 0)),
            space: Number(vals.space != null ? vals.space : (o.features && o.features.space != null ? o.features.space : 0)),
            reverb: Number(vals.reverb != null ? vals.reverb : (o.features && o.features.reverb != null ? o.features.reverb : 0)),
            resonance: Number(vals.resonance != null ? vals.resonance : (o.features && o.features.resonance != null ? o.features.resonance : 0)),
            routes: []
        },
        channel_spatial: Number(o.channel_spatial || vals.channel_spatial) > 0,
        params: sfx_default_params(),
        sfx: {
            gain: Number(vals.gain != null ? vals.gain : 1.0),
            pan: Number(vals.pan != null ? vals.pan : 0.0),
            decay: Number(vals.decay != null ? vals.decay : 1.5),
            hardness: Number(vals.hardness != null ? vals.hardness : 0.6),
            position: Number(vals.position != null ? vals.position : 0.27),
            hold_ms: Number(vals.hold_ms != null ? vals.hold_ms : -1),
            pitch_from: Number(vals.pitch_from || 0),
            pitch_to: Number(vals.pitch_to || 0),
            pitch_ms: Number(vals.pitch_ms || 0),
            pitch_curve: Number(vals.pitch_curve || 1.0),
            cutoff_from: Number(vals.cutoff_from || 0),
            cutoff_to: Number(vals.cutoff_to || 0),
            cutoff_ms: Number(vals.cutoff_ms || 0),
            hp: Number(vals.hp || 0),
            soft_clip: Number(vals.soft_clip || 0),
            physical: o.physical || vals.physical ? Object.assign({}, o.physical || vals.physical) : null,
            phonemes: o.phonemes ? o.phonemes.slice() : (vals.phonemes ? vals.phonemes.slice() : []),
            phoneme_count: o.phonemes ? o.phonemes.length : (vals.phonemes ? vals.phonemes.length : 0)
        },
        harsh: o.harsh || vals.harsh ? Object.assign({}, o.harsh || vals.harsh) : null,
        fine: Number(vals.fine != null ? vals.fine : (o.fine || 0)) || 0,
        body_slot: Number(o.body_slot || vals.body_slot || 0),
        seed: (Number(o.seed || vals.seed || 1) >>> 0)
    };

    const PARAM_NAMES = ["mode","cutoff","res","attack","decay","sustain","release","fm","fmrate","noise","drive","detune","shape","glitchRate","glitchDepth","drift","ringRate","ringDepth","chopDepth","filterBlend","bandMix","pitchEnv","warpRate","warpDepth","drumBodyHz","drumBodyGain","drumBodyDecay","legacyGain","synthCoreGain","pulseWidth","pulseMix","subMix","padDelayMs","padFeedback","padWet"];
    const pSrc = o.params || vals.params || o.parameters;
    if (pSrc) {
        for (let i = 0; i < PARAM_COUNT; i++) {
            const val = pSrc[PARAM_NAMES[i]];
            if (val != null) t.params[i] = Number(val);
        }
    }
    const rSrc = o.routes || vals.routes;
    if (rSrc && Array.isArray(rSrc)) {
        t.features.routes = rSrc.map(r => ({
            source: Number(r.source || 0),
            destination: Number(r.destination || 0),
            amount: Number(r.amount || 0)
        }));
    }
    return t;
}

function parse_patch(o) {
    if (!o) return { kind: "synth", layers: [], gain: 1, pan: 0 };
    const patch = {
        kind: String(o.kind || "synth"),
        gain: Number(o.gain != null ? o.gain : 1.0),
        pan: Number(o.pan != null ? o.pan : 0.0),
        layers: [],
        syllables: o.syllables ? o.syllables.slice() : [],
        mode: o.speech ? String(o.speech.mode || "syllable") : "syllable",
        gated: o.speech ? Number(o.speech.gate) > 0 : true,
        polyphony: o.speech ? Number(o.speech.polyphony || 4) : 4,
        cursor: 0,
        last_onset: -1e9
    };

    const list = o.triggers || o.layers || (o.sound ? [o.sound] : []);
    for (let i = 0; i < list.length; i++) {
        const l = list[i];
        const vals = l.values || l;
        const trig = parse_trigger(l);
        patch.layers.push({
            trigger: trig,
            delay: Number(l.delay_ms || vals.delay_ms || 0),
            key_lo: Number(vals.key_lo != null ? vals.key_lo : (l.key_lo != null ? l.key_lo : 0)),
            key_hi: Number(vals.key_hi != null ? vals.key_hi : (l.key_hi != null ? l.key_hi : 127)),
            key_cycle: Number(vals.key_cycle != null ? vals.key_cycle : (l.key_cycle || 0)),
            key_track: Number(vals.key_track != null ? vals.key_track : (l.key_track != null ? l.key_track : 1.0)),
            plays: function(pitch) {
                const k = this.key_cycle > 0 ? pitch % this.key_cycle : pitch;
                return k >= this.key_lo && k <= this.key_hi;
            },
            pitch_for: function(note) {
                return clamp(Math.round(this.trigger.pitch + (note - 60) * this.key_track), 0, 127);
            }
        });
    }
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
    initFactions(factions) {
        this.resize(factions.length);
        for (let i = 0; i < factions.length; i++) {
            const f = factions[i];
            if (f.patch) this.patch(i, f.patch);
        }
    }
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
    patch(i, patchData) {
        if (i < 0) return;
        this.resize(i + 1);
        const parsed = parse_patch(patchData);
        if (parsed.layers.length === 0 && parsed.kind !== "mumble") return;
        this.tracks[i].patch = parsed;
        this.tracks[i].custom = true;
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
                const rel = track.custom ? (track.patch.layers.length === 0 ? 100 : (track.patch.layers[0].trigger.params[6] || 250)) : FACTION_RELEASES[i % 17];
                this.engine.stop_group(g, rel);
            }
            return;
        }

        if ((!this.audible(i) && !audition) || (track.custom && track.patch.layers.length === 0)) return;
        this.event_count++;
        if (i >= 0 && i < this.note_counts.length) {
            this.note_counts[i]++;
            this.pulses[i] = 1.0;
        }
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
        const limit = track.custom && p.kind === "mumble" ? (p.polyphony || 4) : 32;
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
    }
    command(i, name, args) {
        if (name === "performance_palette") {
            if (args && args[0]) {
                const o = args[0];
                const keys = ["tone", "metal", "grit", "motion", "space", "noise", "distortion"];
                for (let k = 0; k < 7; k++) {
                    if (o[keys[k]] != null) this.character.set_control(k, Number(o[keys[k]]));
                }
            }
            return;
        }
        if (name === "performance_character") {
            if (args && args[0] != null) this.character.set(Number(args[0]));
            return;
        }
        if (name === "track_add") {
            this.resize(Math.max(this.tracks.length, i + 1));
            this.tracks[i].active = true;
            return;
        }
        if (name === "preview" && i >= 0) {
            this.resize(i + 1);
            const temporary = parse_patch(args[0]);
            if (temporary.layers.length === 0) return;
            const old = this.tracks[i].patch;
            const custom = this.tracks[i].custom;
            temporary.gated = false;
            for (const c of temporary.layers) {
                if (temporary.kind === "synth") c.trigger.sfx.hold_ms = 400;
            }
            this.tracks[i].patch = temporary;
            this.tracks[i].custom = true;
            const pitch = clamp(Math.round(Number(args[1] || 60)), 0, 127);
            this.sound({ time: this.time, organism: i, pitch: pitch, velocity: 100 }, true);
            if (this.tracks[i].held[pitch].length > 0) this.tracks[i].held[pitch].pop();
            this.tracks[i].previews.push(this.next_group - 1);
            while (this.tracks[i].previews.length > 32) this.tracks[i].previews.shift();
            this.tracks[i].patch = old;
            this.tracks[i].custom = custom;
            return;
        }
        if (name === "stop_preview" && i >= 0 && this.tracks[i]) {
            for (const g of this.tracks[i].previews) this.engine.stop_group(g, 15);
            this.tracks[i].previews = [];
            return;
        }
        if (name === "set_patch") {
            if (i >= 0) this.patch(i, args[0]);
            return;
        }
        if (name === "track_solo" && i >= 0) {
            this.resize(i + 1);
            this.solos[i] = Boolean(args[0]);
            for (let j = 0; j < this.tracks.length; j++) {
                if (this.tracks[j].active && !this.audible(j)) this.cancel(j);
            }
            return;
        }
        if (name === "drone" && i >= 0) {
            this.resize(i + 1);
            const track = this.tracks[i];
            const release = track.custom && track.patch.layers.length > 0 ? (track.patch.layers[0].trigger.params[6] || 200) : 200;
            for (const d of track.drones) {
                if (d.group) this.engine.stop_group(d.group, release);
            }
            track.drones = [];
            const list = args[0] || [];
            track.drone_velocity = clamp(Math.round(Number(args[1] || 96)), 1, 127);
            for (let k = 0; k < list.length; k++) {
                const pitch = clamp(Math.round(Number(list[k])), 0, 127);
                track.drones.push({ pitch: pitch, group: 0, retry: -1e9 });
            }
            return;
        }
        if (name === "input_note" && i >= 0) {
            const p = clamp(Math.round(Number(args[0])), 0, 127);
            const v = clamp(Math.round(Number(args[1])), 0, 127);
            this.sound({ time: this.time, organism: i, pitch: p, velocity: v }, true);
            return;
        }
        if (name === "track_remove" && i >= 0 && this.tracks[i]) {
            this.tracks[i].drones = [];
            this.cancel(i);
            this.engine.channel_spatial.delete(i);
            this.tracks[i].active = false;
            this.solos[i] = false;
            this.muted[i] = false;
            return;
        }
        if (name === "stop_loop") {
            if (i < 0) {
                for (let j = 0; j < this.tracks.length; j++) this.cancel(j);
                this.engine.panic();
                this.character.clear();
            } else {
                this.cancel(i);
            }
            return;
        }
        if (name === "transport_tempo" && args && args[0] != null) {
            this.tempo = clamp(Number(args[0]), 30.0, 240.0);
            return;
        }
    }
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
        world.muted[i] = Boolean(value);
        if (value && !world.audible(i)) world.cancel(i, 20);
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
        this.note_counts = []; this.pulses = []; this.tracks = [];
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
                    time: this.localWorld.time, rendered: this.localWorld.rendered, event_count: this.localWorld.event_count });
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
        for (const key of ['note_counts', 'pulses', 'time', 'rendered', 'event_count']) this.world[key] = data[key];
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
            this.port.onmessage = ({ data }) => applyAudioAction(this.world, data.op, data.args);
            this.port.postMessage({ type: 'ready' });
        }
        process(inputs, outputs) {
            const [left, right] = outputs[0];
            this.world.render(left, right, left.length);
            for (let i = 0; i < left.length; i++) this.peak = Math.max(this.peak, Math.abs(left[i]), Math.abs(right[i]));
            this.untilStats -= left.length;
            if (this.untilStats <= 0) {
                this.untilStats = sampleRate / 20;
                this.port.postMessage({ type: 'stats', peak: this.peak, note_counts: this.world.note_counts,
                    pulses: this.world.pulses, time: this.world.time, rendered: this.world.rendered, event_count: this.world.event_count });
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
