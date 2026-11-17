shader_type canvas_item;
render_mode blend_disabled;
// Gray–Scott reaction–diffusion, one step. r holds 1-A (A, the substrate, sits near 1, where half floats are
// coarse), g holds B. 9-point Laplacian, dt 1. feed/kill pick the morphology (spots, stripes, mazes, worms,
// coral); spread lets the left and right of the plate drift apart so several morphologies grow side by side.
uniform sampler2D state : filter_nearest, repeat_enable;
uniform vec2 res = vec2(400.0, 255.0);
uniform float feed = 0.037;
uniform float kill = 0.06;
uniform float spread = 0.0;
uniform float da = 1.0;
uniform float db = 0.5;
uniform float first = 0.0;
uniform vec4 drops[4];
uniform float time = 0.0;

float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void fragment() {
	vec2 t = 1.0 / res;
	vec2 uv = UV;
	vec2 c = texture(state, uv).rg;
	vec2 lap = -c;
	lap += 0.2 * (texture(state, uv + vec2(t.x, 0.0)).rg + texture(state, uv - vec2(t.x, 0.0)).rg + texture(state, uv + vec2(0.0, t.y)).rg + texture(state, uv - vec2(0.0, t.y)).rg);
	lap += 0.05 * (texture(state, uv + t).rg + texture(state, uv - t).rg + texture(state, uv + vec2(t.x, -t.y)).rg + texture(state, uv + vec2(-t.x, t.y)).rg);
	float a = 1.0 - c.r;
	float b = c.g;
	float f = feed + (uv.x - 0.5) * 0.014 * spread;
	float k = kill + (uv.y - 0.5) * 0.006 * spread;
	float abb = a * b * b;
	// lap.r is the Laplacian of 1-A, so A's is its negative.
	a += da * -lap.r - abb + f * (1.0 - a);
	b += db * lap.g + abb - (k + f) * b;
	if (first > 0.5) {
		for (int i = 0; i < 4; i++) {
			vec2 d = (uv - drops[i].xy) * vec2(res.x / res.y, 1.0);
			float r = drops[i].z;
			// A ragged disc of B: noisy edges break the symmetry so the drop grows into structure.
			if (length(d) < r * (0.7 + 0.5 * h(floor(uv * res) + time))) { b = mix(b, 1.0, drops[i].w); a = mix(a, 0.5, drops[i].w); }
		}
	}
	COLOR = vec4(clamp(1.0 - a, 0.0, 1.0), clamp(b, 0.0, 1.0), 0.0, 1.0);
}
