shader_type canvas_item;
render_mode unshaded;
// Shards: instanced fragments of an instrument panel (bars, frames, rulers, barcodes, brackets, rows of pixel
// glyphs) that sit assembled as concentric rings and fly apart along their own directions when burst rises.
// A share of the instances are streaks: thin radial lines that shoot out with each burst.
uniform vec2 res = vec2(1600.0, 1020.0);
uniform float time = 0.0;
uniform float burst = 0.0;
uniform float force = 1.0;
uniform float streaks = 0.5;
// 0 burst, 1 tunnel, 2 orbit
uniform int mode = 0;
uniform float yaw = 0.0;
uniform float travel = 0.0;
uniform float bass = 0.0;
uniform float amount = 1.0;
uniform vec3 col_a : source_color = vec3(0.23, 0.36, 1.0);
uniform vec3 col_b : source_color = vec3(0.91, 0.93, 1.0);
uniform vec3 col_w : source_color = vec3(0.96);
varying flat float kind;
varying flat float seed;
varying float asp;
varying vec3 tint;
varying float fade;

vec4 h4(float n) { return fract(sin(vec4(n * 127.1, n * 269.5 + 1.3, n * 419.2 + 2.7, n * 311.7 + 4.1)) * 43758.5453); }

void vertex() {
	float id = float(INSTANCE_ID);
	vec4 h = h4(id + 1.0);
	vec4 g = h4(id + 71.3);
	bool streak = g.w < streaks * 0.3;
	float k = floor(h.x * 7.0);
	float r0 = 0.2 + k * 0.085 + bass * 0.02 * sin(k);
	float a0 = floor(h.y * 72.0) / 72.0 * TAU + time * 0.12 * (mod(k, 2.0) * 2.0 - 1.0);
	vec3 dir = normalize(vec3(cos(a0), sin(a0), (h.z - 0.5) * 1.8));
	float e = burst * (0.3 + 1.4 * h.w);
	vec3 p = vec3(cos(a0), sin(a0), 0.0) * r0 + dir * e * force * 1.5;
	float w = 0.02 + 0.11 * g.x * g.x;
	float hgt = 0.004 + 0.035 * g.y * g.y;
	float rot = a0 + PI * 0.5 + e * (g.z - 0.5) * 9.0;
	fade = 1.0;
	if (streak) {
		w = (0.15 + h.x * 1.2) * burst * force + 0.0001;
		hgt = 0.0016;
		rot = a0;
		p = vec3(cos(a0), sin(a0), 0.0) * (r0 + w * 0.5 + e * 0.4);
		fade = clamp(burst * 2.0, 0.0, 1.0);
	}
	if (mode == 1) {
		p.xy *= 1.7;
		p.z += mod(h.z * 9.0 - travel, 9.0) - 0.8;
	}
	if (mode == 2) {
		float cy = cos(yaw), sy = sin(yaw);
		p = vec3(p.x * cy + p.z * sy, p.y, -p.x * sy + p.z * cy);
		float cx = cos(yaw * 0.6), sx = sin(yaw * 0.6);
		p = vec3(p.x, p.y * cx - p.z * sx, p.y * sx + p.z * cx);
	}
	float persp = 1.0 / max(0.12, 1.0 + p.z * 0.7);
	if (mode == 1) fade *= clamp(p.z + 0.8, 0.0, 1.0) * clamp(8.0 - p.z, 0.0, 1.0);
	float unit = min(res.x, res.y) * 0.5;
	vec2 size = max(vec2(w, hgt) * unit * persp, vec2(1.5));
	asp = size.x / size.y;
	kind = streak ? 0.0 : floor(g.z * 6.0);
	seed = id;
	tint = h.w < 0.5 ? col_a : (h.w < 0.82 ? col_w : col_b);
	if (streak) tint = col_w;
	vec2 q = VERTEX * size;
	float ca = cos(rot), sa = sin(rot);
	VERTEX = res * 0.5 + p.xy * unit * persp + vec2(q.x * ca - q.y * sa, q.x * sa + q.y * ca);
}

float hs(float n) { return fract(sin(n * 91.7) * 43758.5453); }

void fragment() {
	vec2 u = UV;
	float m = 1.0;
	float x = u.x * asp;
	if (kind > 0.5 && kind < 1.5) {
		vec2 b = min(u, 1.0 - u) * vec2(asp, 1.0);
		m = step(min(b.x, b.y), 0.14);
	} else if (kind < 2.5 && kind > 1.5) {
		float tick = step(fract(x * 2.0), 0.3);
		m = tick * step(mod(floor(x * 2.0), 5.0) < 0.5 ? 0.0 : 0.5, u.y);
	} else if (kind < 3.5 && kind > 2.5) {
		m = step(0.45, hs(floor(x * 5.0) + seed));
	} else if (kind < 4.5 && kind > 3.5) {
		vec2 b = min(u, 1.0 - u) * vec2(asp, 1.0);
		m = step(min(b.x, b.y), 0.16) * step(max(min(u.x, 1.0 - u.x) * asp, 0.0), 0.9) * step(min(b.x, b.y) + abs(b.x - b.y) * 0.0, 1.0);
		m *= step(min(u.x, 1.0 - u.x) * asp, 0.9);
	} else if (kind > 4.5) {
		// A row of 3x5 glyph cells with seeded bits.
		float cell = floor(x / 0.8);
		vec2 c = vec2(fract(x / 0.8) / 0.75, u.y);
		ivec2 bit = ivec2(c * vec2(3.0, 5.0));
		m = c.x < 1.0 ? step(0.5, hs(cell * 17.0 + seed + float(bit.y * 3 + bit.x) * 3.1)) : 0.0;
	}
	COLOR = vec4(tint, m * fade * clamp(amount, 0.0, 1.0));
}
