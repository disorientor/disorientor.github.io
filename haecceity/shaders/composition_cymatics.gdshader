shader_type canvas_item;
// Cymatics: a vibrating plate seen from above. mode.xy are the mode numbers (pitch), mode.z 0 for a square
// Chladni plate, 1 for a round membrane and 2 for a hexagonal resonator (three waves 120 degrees apart). Sand settles on the nodal lines of the field and migrates as
// `blend` carries one mode into the next. Timbre (spectral centroid) adds the plate's higher partials and
// sharpens the lines; energy shakes the grains off the antinodes; shimmer lights the moving surface.
uniform vec2 res = vec2(1600.0, 1020.0);
uniform float time = 0.0;
uniform float amount = 0.0;
uniform vec3 mode_a = vec3(2.0, 3.0, 0.0);
uniform vec3 mode_b = vec3(2.0, 3.0, 0.0);
uniform float blend = 1.0;
uniform float energy = 0.0;
uniform float timbre = 0.0;
uniform float shimmer = 0.0;
uniform float plate = 1.31;
uniform float grain_amt = 1.0;
// The two terms of a mode beat against each other continuously (cos and sin of `beat`), so the nodal lines
// never stop travelling, as on a plate driven slightly off resonance.
uniform float beat = 0.0;
uniform vec4 ink : source_color = vec4(0.95, 0.96, 0.94, 1.0);
// The moving parts of the plate glow in this colour.
uniform vec4 glow : source_color = vec4(0.36, 0.44, 1.0, 1.0);


float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float chladni(vec2 p, float n, float m) {
	// p in [-1,1]: free-edge square plate, the classic antisymmetric pair.
	vec2 q = p * 0.5 + 0.5;
	return (cos(beat) * cos(n * PI * q.x) * cos(m * PI * q.y) - sin(beat) * cos(m * PI * q.x) * cos(n * PI * q.y)) * 1.4;
}

// Bessel J_n, power series near the centre and its asymptote further out; close enough to draw rings.
float bessel(float n, float x) {
	if (x < n + 1.5) {
		float t = 1.0, s = 0.0, f = 1.0;
		for (float k = 1.0; k <= n; k += 1.0) f *= k;
		float base = pow(x * 0.5, n) / f;
		for (int k = 0; k < 6; k++) {
			float fk = float(k);
			s += t;
			t *= -(x * x * 0.25) / ((fk + 1.0) * (fk + 1.0 + n));
		}
		return base * s;
	}
	return sqrt(2.0 / (PI * x)) * cos(x - n * PI * 0.5 - PI * 0.25);
}

float membrane(vec2 p, float n, float m) {
	float r = length(p);
	float a = atan(p.y, p.x);
	// The m-th ring: roughly the m-th zero of J_n sits at the rim.
	float k = (m + n * 0.5 + 0.75) * PI;
	return bessel(n, r * k) * cos(n * a + beat * 0.5) * 2.5;
}

float hexagon(vec2 p, float n, float m) {
	vec2 k1 = vec2(1.0, 0.0), k2 = vec2(-0.5, 0.866025), k3 = vec2(-0.5, -0.866025);
	return (sin(dot(p, k1) * n * PI + beat) + sin(dot(p, k2) * m * PI - beat * 0.7) + sin(dot(p, k3) * (n + m) * PI * 0.5 + beat * 0.4)) * 0.6;
}

float mode_field(vec2 p, vec3 md) {
	float f = md.z < 0.5 ? chladni(p, md.x, md.y) : (md.z < 1.5 ? membrane(p, md.x, md.y) : hexagon(p, md.x, md.y));
	// Brighter timbres excite the higher partials of the same plate.
	float hp = md.z < 0.5 ? chladni(p, md.x * 2.0, md.y + 1.0) : (md.z < 1.5 ? membrane(p, md.x + 1.0, md.y * 2.0) : hexagon(p, md.x * 2.0, md.y + 1.0));
	return f + hp * 0.45 * timbre;
}

void fragment() {
	vec2 px = UV * res;
	float side = min(res.x, res.y) * plate;
	vec2 c = res * 0.5;
	vec2 p = (px - c) / (side * 0.5);
	// A slow turning field and unbroken drift, including between note onsets.
	float turn = time * 0.05;
	p = mat2(vec2(cos(turn), sin(turn)), vec2(-sin(turn), cos(turn))) * p;
	p += 0.06 * vec2(sin(p.y * 2.1 + time * 0.31), cos(p.x * 1.8 - time * 0.27));
	float round_plate = mix(min(mode_a.z, 1.0), min(mode_b.z, 1.0), blend);
	float edge = mix(max(abs(p.x), abs(p.y)), length(p), round_plate);
	if (edge > 1.15) { COLOR = vec4(0.0); }
	else {
		float f = mix(mode_field(p, mode_a), mode_field(p, mode_b), blend);
		float e = clamp(energy, 0.0, 3.0);
		// Grains jitter where the plate moves; they rest where it does not.
		float g = 2.0;
		vec2 cell = floor(px / g);
		float phase = h(cell) * TAU;
		vec2 jitter = vec2(sin(time * 3.1 + phase), cos(time * 2.7 + phase)) * abs(f) * (0.002 + e * 0.004);
		vec2 jp = p + jitter;
		float fj = mix(mode_field(jp, mode_a), mode_field(jp, mode_b), blend);
		float width = mix(0.16, 0.05, timbre) * (1.0 + 0.6 * (1.0 - blend));
		float sand = exp(-abs(fj) / width);
		float grain = step(h(cell * 1.37 + 3.0), min(1.0, sand * 0.9 * (0.6 + 0.4 * amount) * grain_amt));
		// The moving surface: faint bands that swell with the oscillation.
		float wave = clamp(abs(f), 0.0, 1.5) * (0.07 + 0.1 * shimmer + 0.06 * e);
		// A continuous bright line along the nodes under the grains.
		float line = exp(-abs(f) / (width * 0.5)) * 0.4;
		// No rim: both plate and viewport dissolve gradually into the background.
		float feather = 1.0 - smoothstep(0.55, 1.15, edge);
		vec2 frame = smoothstep(vec2(0.0), vec2(0.12), UV) * (vec2(1.0) - smoothstep(vec2(0.88), vec2(1.0), UV));
		float settled = max(grain * 0.85, line);
		float a = (settled + wave) * amount * feather * frame.x * frame.y;
		COLOR = vec4(mix(glow.rgb, ink.rgb, clamp(settled / max(settled + wave, 0.0001), 0.0, 1.0)), clamp(a, 0.0, 1.0));
	}
}
