shader_type canvas_item;
render_mode unshaded;
// Glyphs: GPU-instanced analytic SDF glyph field (needles, chevrons, brackets, split ticks,
// crosshairs, diamonds, targets and corners) on a log-polar or rectangular lattice.

uniform vec2 res = vec2(1600.0, 1020.0);
uniform int cols = 64;
uniform int rows = 24;
// 0 rings, 1 lattice, 2 flow, 3 spectrum
uniform int mode = 0;
uniform float time = 0.0;
uniform float twist = 0.5;
uniform float weight = 0.5;
uniform float snap = 0.0;
uniform float heading = 0.0;
uniform float wave = -1.0;
uniform int sym = 6;
uniform float bass = 0.0;
uniform float highs = 0.0;
uniform float flux = 0.0;
uniform float hit = 0.0;
uniform float bands[16];
uniform float peaks[16];
uniform float amount = 1.0;
uniform float paper = 0.0;
uniform vec3 col_a : source_color = vec3(0.96);
uniform vec3 col_b : source_color = vec3(0.36, 0.44, 1.0);
uniform vec3 col_w : source_color = vec3(0.96);

varying flat float glyph_id;
varying float asp;
varying vec3 tint;
varying float core_boost;
varying float alpha_w;

float h1(float n) { return fract(sin(n * 127.1) * 43758.5453); }

float n2(vec2 p) {
	vec2 i = floor(p), f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	float a = h1(i.x + i.y * 57.0);
	float b = h1(i.x + 1.0 + i.y * 57.0);
	float c = h1(i.x + (i.y + 1.0) * 57.0);
	float d = h1(i.x + 1.0 + (i.y + 1.0) * 57.0);
	return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
	return n2(p) * 0.65 + n2(p * 2.07 + 13.7) * 0.35;
}

float sd_seg(vec2 p, vec2 a, vec2 b) {
	vec2 pa = p - a, ba = b - a;
	float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.00001), 0.0, 1.0);
	return length(pa - ba * h);
}

float sd_box(vec2 p, vec2 b) {
	vec2 q = abs(p) - b;
	return length(max(q, vec2(0.0))) + min(max(q.x, q.y), 0.0);
}

void vertex() {
	int cx = INSTANCE_ID % cols;
	int cy = INSTANCE_ID / cols;
	vec2 centre = res * 0.5;
	float R = length(res) * 0.56;
	vec2 pos = centre;
	float ang = 0.0;
	float len = 8.0;
	float wid = 3.0;
	float gid = 0.0;
	bool square_glyph = false;

	tint = col_a;
	core_boost = 0.0;
	alpha_w = 0.85;

	if (mode == 0 || mode == 3) {
		float k = float(cy);
		float u = (k + 0.5) / float(rows);
		float rmin = R * 0.042;
		float r = rmin * pow(R / rmin, u);
		float dir = mod(k, 2.0) < 0.5 ? 1.0 : -1.0;

		if (mode == 0) {
			r *= 1.0 + bass * 0.055 * sin(k * 1.7 + time);
			float rate = 0.18 + 0.42 * h1(k + 3.0);
			float theta = (float(cx) + 0.5 * mod(k, 2.0)) / float(cols) * TAU + time * dir * rate;
			pos = centre + r * vec2(cos(theta), sin(theta));
			float arc_step = r * TAU / float(cols);
			float sym_f = float(max(3, sym));
			float harmonic = 0.5 + 0.5 * cos(theta * sym_f - time * dir * 1.2 + k * 0.5);
			bool spoke = (cx % max(2, cols / max(3, sym))) == 0;
			int tier = cy % 6;

			ang = theta + PI * 0.5 + (twist - 0.5) * 3.4 * sin(time * 0.55 + k * 0.42) + twist * 0.9;
			len = arc_step * (0.72 + 0.28 * harmonic) * (1.0 + hit * 0.30 * sin(k * 0.9));
			wid = len * mix(0.20, 0.58, weight);

			if (spoke) {
				gid = (cy % 2 == 0) ? 4.0 : 5.0; // crosshair or diamond on harmonic spokes
				square_glyph = true;
				len = max(arc_step * 0.82, 6.0);
				wid = len;
				tint = col_b;
				core_boost = 0.72;
				alpha_w = 1.0;
			} else if (tier == 1) {
				gid = 1.0; // chevron pointing along spin
				square_glyph = true;
				ang = theta + (dir > 0.0 ? PI * 0.5 : -PI * 0.5) + (twist - 0.5) * 1.4;
				tint = harmonic > 0.7 ? col_b : col_a;
				core_boost = 0.38 * harmonic;
			} else if (tier == 2) {
				gid = 2.0; // framing brackets
				square_glyph = true;
				alpha_w = 0.78;
			} else if (tier == 3) {
				gid = 3.0; // split binary tick
				tint = mod(k, 5.0) > 3.2 ? col_b : col_a;
				alpha_w = 0.72;
			} else if (tier == 4) {
				gid = harmonic > 0.75 ? 6.0 : 0.0; // target ring at crests
				square_glyph = harmonic > 0.75;
				if (harmonic > 0.75) {
					tint = col_b;
					core_boost = 0.55;
				}
			} else if (tier == 5) {
				gid = 7.0; // opposing corner brackets
				square_glyph = true;
				tint = col_b;
				alpha_w = 0.86;
			} else {
				gid = 0.0; // tapered vector needle
				core_boost = 0.35 * harmonic;
			}
		} else {
			// Mode 3: 16-band polar FFT spectrum telemetry with peak holds
			float bpos = u * 15.0;
			int b0 = int(floor(bpos));
			int b1 = min(15, b0 + 1);
			float bf = fract(bpos);
			float b = mix(bands[b0], bands[b1], bf);
			float pk = mix(peaks[b0], peaks[b1], bf);

			float theta = (float(cx) + 0.5 * mod(k, 2.0)) / float(cols) * TAU + time * dir * (0.08 + 0.45 * b);
			pos = centre + r * vec2(cos(theta), sin(theta));
			float arc_step = r * TAU / float(cols);
			bool tick_mark = (cx % 6) == 0;
			bool is_peak = pk > 0.14 && abs(b - pk) < 0.18 && (cx % 2 == 0);

			// Keep a strong baseline schematic even in silence so the dial never collapses to dots
			len = arc_step * (0.48 + 1.55 * b + 0.25 * pk);
			wid = arc_step * mix(0.18, 0.48, weight) * (0.85 + 0.85 * b);
			ang = theta + PI * 0.5 * (1.0 - clamp(b * 1.35, 0.0, 1.0)) + (twist - 0.5) * 1.8;

			if (is_peak) {
				gid = 5.0; // peak-hold diamond
				square_glyph = true;
				len = max(arc_step * 0.78, 5.5);
				wid = len;
				tint = col_w;
				core_boost = 0.9;
				alpha_w = 1.0;
			} else if (tick_mark) {
				gid = (b > 0.35) ? 1.0 : 2.0; // chevron or bracket azimuth tick
				square_glyph = true;
				ang = theta;
				tint = b > 0.25 ? col_b : col_a;
				core_boost = 0.55 * b;
				alpha_w = 0.92;
			} else if (b > 0.42) {
				gid = 1.0; // energetic chevron
				square_glyph = true;
				tint = col_b;
				core_boost = clamp(b * 0.9, 0.0, 0.95);
				alpha_w = 0.98;
			} else {
				gid = (cy % 3 == 0) ? 3.0 : 0.0; // split tick / capsule ring
				tint = mix(col_a, col_b, clamp(b * 1.8, 0.0, 1.0));
				core_boost = 0.35 * b;
				alpha_w = 0.68 + 0.32 * clamp(b * 2.0, 0.0, 1.0);
			}
		}
	} else {
		vec2 cell = res / vec2(float(cols), float(rows));
		float cell_min = min(cell.x, cell.y);
		pos = (vec2(float(cx), float(cy)) + 0.5) * cell;
		vec2 d = pos - centre;
		float dist = length(d) / R;
		float sym_f = float(max(3, sym));

		if (mode == 1) {
			// Mode 1: Multi-wave interference lattice
			float tw_a = twist * TAU;
			float w1 = sin(dist * 18.0 - time * 2.1);
			float w2 = cos((d.x * cos(tw_a) + d.y * sin(tw_a)) * (0.011 + 0.008 * twist) + time * 1.35);
			float w3 = sin(atan(d.y, d.x) * sym_f + dist * 6.0 - time * 0.9);
			float env = 0.5 + 0.5 * (w1 * 0.5 + w2 * 0.32 + w3 * 0.18);
			float curl = (w1 - w2) * 0.5;

			ang = atan(d.y, d.x) + (twist - 0.5) * 6.5 * w1 + w2 * 1.4 + time * 0.25;
			len = cell_min * (0.42 + 0.68 * env) * (0.85 + bass * 0.45);
			wid = cell_min * mix(0.12, 0.48, weight) * (0.75 + 0.45 * env);

			if (env > 0.78) {
				gid = (abs(curl) > 0.42) ? 4.0 : 1.0; // crosshair or chevron at wave crests
				square_glyph = true;
				tint = col_b;
				core_boost = 0.85;
				alpha_w = 1.0;
			} else if (env > 0.56) {
				gid = 2.0; // brackets
				square_glyph = true;
				tint = mix(col_a, col_b, (env - 0.56) * 2.5);
				core_boost = 0.35;
				alpha_w = 0.9;
			} else if (env < 0.24) {
				gid = 6.0; // quiet nodal target ring
				square_glyph = true;
				len = cell_min * 0.52;
				wid = len;
				alpha_w = 0.55;
			} else {
				gid = ((cx + cy) % 3 == 0) ? 3.0 : 0.0;
				alpha_w = 0.68 + 0.25 * env;
			}
		} else {
			// Mode 2: Divergence-free curl-noise streamline field
			vec2 uv_n = pos * 0.0024 + vec2(time * 0.07, -time * 0.045);
			float eps = 0.045;
			float p_c = fbm(uv_n);
			float p_x = fbm(uv_n + vec2(eps, 0.0));
			float p_y = fbm(uv_n + vec2(0.0, eps));
			vec2 curl_v = vec2(p_y - p_c, -(p_x - p_c)) / eps;
			float spd = clamp(length(curl_v) * 1.25, 0.0, 1.8);
			float jet = smoothstep(0.32, 1.10, spd);
			float stream_wave = 0.5 + 0.5 * sin(p_c * 18.0 - time * 2.2);

			ang = atan(curl_v.y, curl_v.x) + (twist - 0.5) * 2.2;
			len = cell_min * (0.50 + 0.72 * jet + 0.18 * stream_wave) * (0.85 + bass * 0.45);
			wid = cell_min * mix(0.18, 0.50, weight);

			if (spd < 0.28) {
				// Vortex stagnation eddies -> targets & diamonds
				gid = stream_wave > 0.5 ? 6.0 : 5.0;
				square_glyph = true;
				len = cell_min * 0.72;
				wid = len;
				tint = col_b;
				core_boost = 0.65;
				alpha_w = 0.92;
			} else if (jet > 0.55 && stream_wave > 0.45) {
				// High-velocity jet streamlines -> chevrons & corners
				gid = 1.0;
				square_glyph = true;
				tint = col_b;
				core_boost = 0.78 * jet;
				alpha_w = 1.0;
			} else if (stream_wave > 0.80) {
				gid = 7.0;
				square_glyph = true;
				alpha_w = 0.88;
			} else {
				gid = (spd > 0.55) ? 0.0 : 3.0;
				alpha_w = 0.74 + 0.26 * jet;
			}
		}
	}

	// Radial kick shockwave sweeping across the lattice
	float dist_norm = length(pos - centre) / max(1.0, length(res) * 0.54);
	float w_band = wave >= 0.0 ? exp(-pow((dist_norm - wave) * 6.5, 2.0)) : 0.0;
	if (w_band > 0.05) {
		len *= 1.0 + w_band * 0.42;
		wid *= 1.0 + w_band * 0.35;
		tint = mix(tint, col_w, clamp(w_band * 0.85, 0.0, 1.0));
		core_boost = max(core_boost, w_band * 0.95);
		alpha_w = max(alpha_w, 0.98);
		if (w_band > 0.55 && gid < 0.5) {
			gid = 1.0;
			square_glyph = true;
		}
	}

	// Highs / flux transient sparkle on a deterministic subset of cells
	float cell_hash = h1(float(INSTANCE_ID) * 1.37 + 19.1);
	if (highs + flux > 0.45 && cell_hash > 0.88 - 0.14 * clamp(highs + flux, 0.0, 1.5)) {
		gid = 4.0;
		square_glyph = true;
		tint = mix(tint, col_w, 0.6);
		core_boost = max(core_boost, 0.85);
	}

	// Kick heading alignment
	float da = mod(heading - ang + PI * 0.5, PI) - PI * 0.5;
	ang += da * snap;

	if (square_glyph) {
		float s = max(max(len, wid), 4.5);
		len = s;
		wid = max(wid, s * 0.78);
	} else {
		wid = max(wid, 2.0);
		len = max(len, wid * 1.2);
	}

	glyph_id = gid;
	asp = (len + 2.0) / (wid + 2.0);
	vec2 q = VERTEX * vec2(len + 2.0, wid + 2.0);
	float ca = cos(ang), sa = sin(ang);
	VERTEX = pos + vec2(q.x * ca - q.y * sa, q.x * sa + q.y * ca);
}

void fragment() {
	vec2 p = (UV - 0.5) * vec2(asp, 1.0);
	float th = clamp(mix(0.072, 0.165, weight), 0.06, 0.18);
	float d = 1.0;
	int id = int(glyph_id + 0.5);

	if (id == 0) {
		float r = mix(0.24, 0.41, weight);
		float hl = max(0.0, asp * 0.42 - r);
		d = length(p - vec2(clamp(p.x, -hl, hl), 0.0)) - r;
	} else if (id == 1) {
		float hx = min(0.36, asp * 0.36);
		d = min(sd_seg(p, vec2(-hx, 0.29), vec2(hx, 0.0)), sd_seg(p, vec2(-hx, -0.29), vec2(hx, 0.0))) - th * 1.1;
	} else if (id == 2) {
		float hx = min(0.39, asp * 0.38);
		float sx = abs(p.x);
		float bar = sd_box(vec2(sx - hx * 0.72, p.y), vec2(th * 0.75, 0.33));
		float serif = sd_box(vec2(sx - hx * 0.48, abs(p.y) - 0.30), vec2(hx * 0.24, th * 0.75));
		d = min(bar, serif);
	} else if (id == 3) {
		float hl = max(0.08, asp * 0.40 - 0.08);
		d = min(sd_box(p - vec2(0.0, 0.16), vec2(hl, th * 1.02)), sd_box(p + vec2(0.0, 0.16), vec2(hl, th * 1.02)));
	} else if (id == 4) {
		float arm = min(0.35, asp * 0.35);
		d = min(sd_box(p, vec2(arm, th * 0.85)), sd_box(p, vec2(th * 0.85, arm)));
	} else if (id == 5) {
		float r = min(0.35, asp * 0.35);
		d = abs((abs(p.x) + abs(p.y)) * 0.7071 - r * 0.7071) - th * 0.9;
	} else if (id == 6) {
		float r = min(0.33, asp * 0.33);
		float ring = abs(length(p) - r) - th * 0.85;
		float pip = length(p) - th * 1.3;
		d = min(ring, pip);
	} else {
		vec2 ap = abs(p);
		float h_arm = sd_box(ap - vec2(0.19, 0.30), vec2(0.15, th * 0.8));
		float v_arm = sd_box(ap - vec2(0.30, 0.19), vec2(th * 0.8, 0.15));
		d = (p.x * p.y >= -0.001) ? min(h_arm, v_arm) : 1.0;
	}

	float aa = max(fwidth(d), 0.002);
	float m = 1.0 - smoothstep(-aa, aa, d);
	float inner_core = smoothstep(0.01, -th * 0.8, d) * core_boost * (1.0 - paper);
	vec3 rgb = mix(tint, col_w, clamp(inner_core, 0.0, 1.0));
	COLOR = vec4(rgb, m * alpha_w * clamp(amount, 0.0, 1.0));
}
