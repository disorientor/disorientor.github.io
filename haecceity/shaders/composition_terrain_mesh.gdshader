shader_type spatial;
render_mode unshaded, cull_disabled, shadows_disabled;

// 3D wireframe terrain mesh: world-locked grid vertices displaced by 4 selectable topographies
// (0 Canyon, 1 Ridge, 2 Caldera, 3 Terrace) + per-depth FFT bands. Draws isotropic anti-aliased
// Vectrex vector edges, iso-elevation contour lines, vertex beam-dwell hotspots, and flowing
// valley/basin current vectors with energy packets on a black occluding ground.

// 0 canyon, 1 ridge, 2 caldera, 3 terrace
uniform int mode = 0;
uniform float cam_x = 0.0;
uniform float time = 0.0;
uniform float travel = 0.0;
uniform float height = 1.0;
uniform float lines = 0.5;
uniform float flow = 0.5;
uniform float bass = 0.0;
uniform float highs = 0.0;
uniform float wave = -1.0;
uniform float note_pulse = 0.0;
uniform float bands[16];
uniform float shift = 0.0;
uniform vec3 col_a : source_color = vec3(0.29, 0.42, 1.0);
uniform vec3 col_b : source_color = vec3(1.0, 0.42, 0.24);
uniform vec3 col_w : source_color = vec3(0.96);

const float CELL_X = 0.36;
const float CELL_Z = 0.25;
const float NX = 80.0;
const float WATER = 0.06;
const float FAR = 16.0;

varying vec2 v_grid;
varying vec2 v_world_xz;
varying float v_height;
varying float v_depth;
varying float v_valley;

float h1(vec2 q) { return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453); }

float n2(vec2 p) {
	vec2 i = floor(p), f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	return mix(mix(h1(i), h1(i + vec2(1.0, 0.0)), f.x), mix(h1(i + vec2(0.0, 1.0)), h1(i + vec2(1.0, 1.0)), f.x), f.y);
}

float ridged(vec2 p, int oct) {
	float a = 0.5, s = 0.0;
	for (int i = 0; i < oct; i++) {
		float n = 1.0 - abs(n2(p) * 2.0 - 1.0);
		s += a * n * n;
		p = p * 2.03 + 17.3;
		a *= 0.48;
	}
	return s;
}

float eval_basin(vec2 p) {
	if (mode == 0) {
		return smoothstep(0.12, 1.5, abs(p.x - sin(p.y * 0.35) * 0.7));
	}
	if (mode == 1) {
		return mix(0.42, 1.0, smoothstep(0.3, 2.4, abs(p.x - sin(p.y * 0.22) * 1.6)));
	}
	if (mode == 2) {
		vec2 cp = vec2(p.x - sin(p.y * 0.28) * 1.1, mod(p.y + 6.0, 12.0) - 6.0);
		float rad = length(vec2(cp.x * 0.85, cp.y));
		return smoothstep(0.95, 2.7, rad);
	}
	return smoothstep(0.18, 1.45, abs(p.x - sin(p.y * 0.25) * 0.95));
}

float eval_h(vec2 c) {
	vec2 p = c * vec2(CELL_X, CELL_Z);
	float depth = clamp(p.y - travel, 0.0, FAR);
	float bpos = depth / FAR * 15.0;
	int b0 = int(floor(bpos));
	int b1 = min(15, b0 + 1);
	float band = mix(bands[b0], bands[b1], fract(bpos));
	float valley = eval_basin(p);
	float h = 0.0;

	if (mode == 0) {
		h = (ridged(p * 0.42, 4) * 1.7 * height * (1.0 + bass * 0.5) + band * 0.35) * valley;
	} else if (mode == 1) {
		float crest = ridged(p * 0.34 + vec2(0.0, 4.1), 4);
		float macro = 0.58 + 0.42 * sin(p.x * 0.28 + cos(p.y * 0.19) * 1.4);
		h = (crest * 1.85 * macro * height * (1.0 + bass * 0.45) + band * 0.42) * valley;
	} else if (mode == 2) {
		vec2 cp = vec2(p.x - sin(p.y * 0.28) * 1.1, mod(p.y + 6.0, 12.0) - 6.0);
		float rad = length(vec2(cp.x * 0.85, cp.y));
		float rim = 0.45 + 1.35 * exp(-pow((rad - 3.6) * 0.52, 2.0));
		float rbpos = clamp(rad / 6.0 * 15.0, 0.0, 15.0);
		int rb0 = int(floor(rbpos));
		int rb1 = min(15, rb0 + 1);
		float rband = mix(bands[rb0], bands[rb1], fract(rbpos));
		h = (ridged(p * 0.46, 3) * rim * height * (1.0 + bass * 0.45) + rband * 0.48 + band * 0.18) * valley;
	} else {
		float raw = (ridged(p * 0.38, 3) * 1.68 * height * (1.0 + bass * 0.42) + band * 0.35) * valley;
		float steps = 5.5;
		float q = raw * steps;
		h = (floor(q) + smoothstep(0.66, 0.98, fract(q))) / steps;
	}
	return max(WATER, h);
}

void vertex() {
	vec2 base_cell = vec2(floor(cam_x / CELL_X), floor(travel / CELL_Z));
	vec2 grid_origin = floor(base_cell / 4.0) * 4.0;
	vec2 world_cell = vec2(base_cell.x + (VERTEX.x - NX * 0.5), base_cell.y + VERTEX.z);
	v_grid = world_cell - grid_origin;

	float w2 = smoothstep(0.0, 0.38, lines);
	float w1 = smoothstep(0.35, 0.94, lines);

	vec2 g4 = floor(world_cell / 4.0) * 4.0;
	vec2 f4 = (world_cell - g4) / 4.0;
	float h4 = mix(
		mix(eval_h(g4), eval_h(g4 + vec2(4.0, 0.0)), f4.x),
		mix(eval_h(g4 + vec2(0.0, 4.0)), eval_h(g4 + vec2(4.0, 4.0)), f4.x),
		f4.y
	);

	vec2 g2 = floor(world_cell / 2.0) * 2.0;
	vec2 f2 = (world_cell - g2) / 2.0;
	float h2 = mix(
		mix(eval_h(g2), eval_h(g2 + vec2(2.0, 0.0)), f2.x),
		mix(eval_h(g2 + vec2(0.0, 2.0)), eval_h(g2 + vec2(2.0, 2.0)), f2.x),
		f2.y
	);

	float h1v = eval_h(world_cell);
	float wy = mix(mix(h4, h2, w2), h1v, w1);

	vec2 world_xz = world_cell * vec2(CELL_X, CELL_Z);
	v_world_xz = world_xz;
	v_height = wy;
	v_depth = world_xz.y - travel;
	v_valley = eval_basin(world_xz);

	VERTEX = vec3(world_xz.x, wy, -v_depth);
}

void eval_grid(vec2 uv, vec2 fw, float step_sz, float weight, out float body_out, out float core_out, out float dot_out) {
	vec2 cell = abs(fract(uv / step_sz - 0.5) - 0.5) * step_sz;
	vec2 px = cell / fw;
	vec2 nyq = 1.0 - smoothstep(0.28 * step_sz, 0.72 * step_sz, fw);
	float bx = (1.0 - smoothstep(0.45, 1.60, px.x)) * nyq.x;
	float bz = (1.0 - smoothstep(0.45, 1.60, px.y)) * nyq.y;
	body_out = max(bx, bz) * weight;
	float cx = (1.0 - smoothstep(0.0, 0.75, px.x)) * nyq.x;
	float cz = (1.0 - smoothstep(0.0, 0.75, px.y)) * nyq.y;
	core_out = max(cx, cz) * weight;
	float dv = length(px);
	// Vectrex beam dwell hotspot where edges meet at a vertex.
	dot_out = exp(-dv * dv * 0.24) * min(nyq.x, nyq.y) * weight;
}

void fragment() {
	// Isotropic Euclidean screen-space gradient prevents diagonal stair-stepping.
	vec2 fw = max(vec2(
		length(vec2(dFdx(v_grid.x), dFdy(v_grid.x))),
		length(vec2(dFdx(v_grid.y), dFdy(v_grid.y)))
	), vec2(0.0001));
	float w2 = smoothstep(0.0, 0.38, lines);
	float w1 = smoothstep(0.35, 0.94, lines);

	float b4, c4, d4;
	float b2, c2, d2;
	float b1, c1, d1;
	eval_grid(v_grid, fw, 4.0, 1.0, b4, c4, d4);
	eval_grid(v_grid, fw, 2.0, w2 * 0.95, b2, c2, d2);
	eval_grid(v_grid, fw, 1.0, w1 * 0.82, b1, c1, d1);

	float line_body = max(b4, max(b2, b1));
	float line_core = max(c4, max(c2, c1));
	float vert_dot = max(d4 * 1.15, max(d2 * 0.85, d1 * 0.45));

	// Topographic iso-elevation contour lines tracing geological strata across slopes.
	float c_step = (mode == 3) ? 0.19 : 0.32;
	float fw_h = max(length(vec2(dFdx(v_height), dFdy(v_height))), 0.0001);
	float ch = abs(fract(v_height / c_step - 0.5) - 0.5) * c_step;
	float c_px = ch / fw_h;
	float c_nyq = 1.0 - smoothstep(0.25 * c_step, 0.65 * c_step, fw_h);
	float c_weight = (mode == 3 ? 0.95 : 0.42) * smoothstep(0.15, 0.72, lines) * smoothstep(WATER + 0.03, WATER + 0.14, v_height);
	float contour_line = (1.0 - smoothstep(0.42, 1.48, c_px)) * c_nyq * c_weight;
	float contour_core = (1.0 - smoothstep(0.0, 0.68, c_px)) * c_nyq * c_weight;

	// Valley / basin floor: keep wireframe subtle on the floor and add flowing longitudinal vector currents + packets.
	float valley_mask = 1.0 - smoothstep(0.06, 0.38, v_valley);
	float center_x = mode == 1 ? sin(v_world_xz.y * 0.22) * 1.6 : (mode == 2 ? sin(v_world_xz.y * 0.28) * 1.1 : (mode == 3 ? sin(v_world_xz.y * 0.25) * 0.95 : sin(v_world_xz.y * 0.35) * 0.7));
	float rx = v_world_xz.x - center_x;
	float stream_u = rx * 3.8 + sin(v_world_xz.y * 1.1 + time * 1.2) * 0.22;
	float fw_rx = max(length(vec2(dFdx(stream_u), dFdy(stream_u))), 0.0001);
	float stream_px = abs(fract(stream_u - 0.5) - 0.5) / fw_rx;
	float stream_nyq = 1.0 - smoothstep(0.32, 0.78, fw_rx);
	float stream_env = valley_mask * smoothstep(1.15, 0.45, abs(rx));
	float pulse = 0.45 + 0.55 * (0.5 + 0.5 * sin(v_world_xz.y * 2.4 + time * flow * 5.0 + floor(stream_u) * 1.7));
	float packet = smoothstep(0.84, 0.99, sin(v_world_xz.y * 1.35 - time * (1.8 + flow * 5.5) + floor(stream_u) * 2.3)) * (0.5 + 0.8 * note_pulse + 0.6 * bass);
	float river_line = (1.0 - smoothstep(0.42, 1.45, stream_px)) * stream_nyq * stream_env;
	float river_core = (1.0 - smoothstep(0.0, 0.7, stream_px)) * stream_nyq * stream_env;

	// Height-banded palette cycling (col_a -> col_b -> col_w -> col_a), shifted by kicks.
	float hn = clamp(v_height / (1.3 * height + 0.2), 0.0, 1.0);
	float k = fract(hn * 1.15 + shift) * 3.0;
	vec3 band_col = k < 1.0
		? mix(col_a, col_b, smoothstep(0.55, 1.0, k))
		: (k < 2.0 ? mix(col_b, col_w, smoothstep(1.55, 2.0, k)) : mix(col_w, col_a, smoothstep(2.55, 3.0, k)));

	float rk = mod(abs(floor(stream_u)) + floor(shift * 3.0), 3.0);
	vec3 river_col = rk < 0.5 ? col_a : (rk < 1.5 ? col_w : col_b);

	// Kick shockwave racing down the terrain.
	float w_hit = wave > 0.0 ? exp(-abs(v_depth - wave) * 2.1) : 0.0;

	// Depth cueing + smooth far fade.
	float depth_clamped = max(0.0, v_depth);
	float fog = exp(-depth_clamped * 0.075) * smoothstep(FAR, FAR - 1.8, depth_clamped);
	float shimmer = 1.0 + highs * 0.14 * sin(time * 38.0 + v_depth * 3.1);

	float ridge_boost = 0.85 + 0.40 * smoothstep(0.18, 0.85, hn);
	float wire_amp = mix(1.0, 0.52, valley_mask) * ridge_boost;
	float trace = max(line_body, vert_dot) * wire_amp * (1.0 + 2.2 * w_hit);
	float core_hot = max(line_core * 0.62, vert_dot * 0.95) * wire_amp * (1.0 + 1.8 * w_hit);

	vec3 wire_col = mix(band_col, col_w, clamp(core_hot * 0.62 + w_hit * 0.85, 0.0, 1.0));
	vec3 vec_rgb = wire_col * trace + col_w * (core_hot * 0.42);
	vec3 contour_col = mix(col_b, col_w, clamp(contour_core * 0.55 + w_hit * 0.75, 0.0, 1.0));
	vec3 cont_rgb = contour_col * (contour_line * (0.78 + 1.4 * w_hit)) + col_w * (contour_core * 0.25);
	vec3 riv_rgb = mix(river_col, col_w, clamp(river_core * 0.52 + packet * 0.75 + w_hit * 0.8, 0.0, 1.0)) * (river_line * (0.86 * pulse + packet * 0.95) * (1.0 + 1.6 * w_hit));

	ALBEDO = clamp((vec_rgb + cont_rgb + riv_rgb) * fog * shimmer, vec3(0.0), vec3(1.0));
}
