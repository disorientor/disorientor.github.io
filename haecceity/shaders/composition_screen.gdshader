shader_type spatial;
// A flat screen in the composition's Space rig: the background realm (or another view) on an unlit quad with a
// thin bezel. Array copies carry their own inversion, crop and fade in INSTANCE_CUSTOM (r, g, b, a) and their
// atlas cell, shatter, fold and fold style in the instance COLOR; single screens take them from uniforms.
// Panes built by composition_panes.gd can break (shards in CUSTOM0, crack edges in CUSTOM1, corners in UV2)
// and fold along creases; a plain quad ignores both. The back of a screen shows the picture darkened toward ink.
render_mode unshaded, cull_disabled, shadows_disabled;

uniform sampler2D tex : source_color, filter_linear, repeat_disable;
uniform vec3 void_col : source_color = vec3(0.85);
uniform vec3 ink : source_color = vec3(0.07);
uniform bool use_custom = false;
uniform float fade = 0.0;
uniform float invert = 0.0;
uniform float zoom = 1.0;
uniform float crop_seed = 0.0;
uniform float bezel = 0.004;
uniform float gain = 1.0;
// Copies and monitors this close to the camera are cut away so a screen never fills the lens.
uniform float near_cut = 0.0;
// The texture as a grid of cells (the screens atlas); cell, shatter and fold for single screens.
uniform vec2 grid = vec2(1.0);
uniform float cell = 0.0;
uniform float shatter = 0.0;
uniform float motion_time = 0.0;
uniform float fold = 0.0;
uniform float fold_style = 0.0;

const vec2 IMPACT[4] = vec2[](vec2(.12, -.08), vec2(-.18, .1), vec2(0.0), vec2(.3, .2));

varying vec4 custom;
varying vec4 fx;
varying vec3 crack_edges;
varying float crack;
varying float moved;
varying float shard_rnd;

vec3 rotate(vec3 v, vec3 axis, float a) {
	return v * cos(a) + cross(axis, v) * sin(a) + axis * dot(axis, v) * (1.0 - cos(a));
}

// Origami: the flat sheet folded along creases, toward the viewer (+z).
vec3 folded(vec3 p, float f, int style) {
	if (f <= 0.001) return p;
	if (style == 0) {
		// Accordion: four pleats across.
		float th = f * 1.3;
		float u = p.x + 0.5;
		float w = 0.25;
		float k = floor(min(u, 0.9999) / w);
		float t = u - k * w;
		return vec3((u - 0.5) * cos(th), p.y, (mod(k, 2.0) < 0.5 ? t : w - t) * sin(th));
	}
	if (style == 1) {
		// A book closing: both halves swing up about the centre line.
		float a = f * 1.45;
		return vec3(p.x * cos(a), p.y, abs(p.x) * sin(a));
	}
	if (style == 2) {
		// Dog-ear: a corner folds over a crease that walks inward.
		vec2 n = normalize(vec2(1.0, 1.0));
		float d = dot(p.xy, n) - (0.62 - f * 0.55);
		if (d <= 0.0) return p;
		float a = f * 2.9;
		return vec3(p.xy - n * d + n * d * cos(a), d * sin(a));
	}
	// Envelope: four triangular flaps rise about their own edges.
	vec2 m = abs(p.x) > abs(p.y) ? vec2(sign(p.x), 0.0) : vec2(0.0, sign(p.y));
	float h = 0.5 - dot(p.xy, m);
	float a = f * 1.4;
	vec2 tangent = p.xy - m * dot(p.xy, m);
	return vec3(tangent + m * (0.5 - h * cos(a)), h * sin(a));
}

void vertex() {
	custom = use_custom ? INSTANCE_CUSTOM : vec4(0.0, zoom, crop_seed, 0.0);
	fx = use_custom ? COLOR : vec4(cell / 64.0, shatter, fold, fold_style / 4.0);
	vec3 rest = VERTEX;
	vec3 p = folded(rest, fx.b, int(floor(fx.a * 4.0 + 0.01)));
	crack_edges = CUSTOM1.xyz;
	crack = 0.0;
	moved = 0.0;
	shard_rnd = CUSTOM0.z;
	if (fx.g > 0.001) {
		vec2 c = CUSTOM0.xy;
		float rnd = CUSTOM0.z;
		// A phase field travels through the sheet. No static "broken" destination:
		// shards follow looping paths, articulate, weave through depth and return.
		float phase = motion_time + CUSTOM0.w * 4.0 + rnd * 2.0;
		float m = fx.g * (0.55 + 0.45 * sin(phase));
		crack = smoothstep(0.0, 0.12, m);
		moved = m;
		vec3 local = rest - vec3(c, 0.0);
		vec3 axis = normalize(vec3(rnd - 0.5, fract(rnd * 7.3) - 0.5, fract(rnd * 3.1) - 0.45));
		vec3 turned = rotate(local * (1.0 - 0.04 * crack), axis, m * sin(phase * 0.73 + rnd * 6.0) * 3.5);
		vec2 dir = normalize(c - IMPACT[int(CUSTOM1.w + 0.5) % 4] + vec2(1e-4));
		vec2 tangent = vec2(-dir.y, dir.x);
		vec3 off = vec3(dir * m * (0.12 + rnd * 0.45) + tangent * sin(phase) * fx.g * 0.18,
			sin(phase * 0.8 + rnd * 3.0) * fx.g * (0.12 + 0.5 * rnd));
		p += turned - local + off;
	}
	VERTEX = p;
}

void fragment() {
	if (length(VERTEX) < near_cut) discard;
	float z = clamp(custom.g, 0.05, 1.0);
	vec2 off = vec2(fract(custom.b * 7.13), fract(custom.b * 3.71));
	vec2 uv = off * (1.0 - z) + UV * z;
	// A loose shard bends the picture a little, like thick glass.
	uv += (vec2(fract(shard_rnd * 13.1), fract(shard_rnd * 5.3)) - 0.5) * 0.05 * moved;
	float id = floor(fx.r * 64.0 + 0.5);
	vec2 at = vec2(mod(id, grid.x), floor(id / grid.x));
	vec4 sample_color = texture(tex, (at + clamp(uv, 0.003, 0.997)) / grid);
	vec3 c = mix(void_col, sample_color.rgb * gain, sample_color.a);
	c = mix(c, 1.0 - c, clamp(max(invert, step(0.5, custom.r)), 0.0, 1.0));
	if (!FRONT_FACING) c = mix(c, ink, 0.6);
	// Folds and loose shards catch the light by how squarely they face the camera.
	float bent = clamp(fx.b * 2.0 + moved, 0.0, 1.0);
	if (bent > 0.0) {
		vec3 n = normalize(cross(dFdx(VERTEX), dFdy(VERTEX)));
		c *= mix(1.0, 0.45 + 0.55 * abs(n.z), bent);
	}
	vec3 b = vec3(UV2, 1.0 - UV2.x - UV2.y);
	float e = min(min(mix(1.0, b.x, step(0.5, crack_edges.x)), mix(1.0, b.y, step(0.5, crack_edges.y))), mix(1.0, b.z, step(0.5, crack_edges.z)));
	float line = (1.0 - smoothstep(0.0, 0.07, e)) * crack;
	c = mix(c, mix(vec3(1.0), ink, 0.25 + 0.5 * moved), line);
	float edge = min(min(UV.x, 1.0 - UV.x), min(UV.y, 1.0 - UV.y));
	c = mix(c, ink, step(edge, bezel));
	ALBEDO = mix(c, void_col, clamp(fade + custom.a, 0.0, 1.0) * (FRONT_FACING ? 1.0 : 0.4));
}
