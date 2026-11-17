shader_type canvas_item;
render_mode blend_disabled;
// A coarse velocity field, one pass per buffer: pass 0 self-advects the velocity and adds forces (curl noise,
// kicks as bursts, notes as vortices), passes 1 relax the pressure (Jacobi, held in b), pass 2 subtracts its
// gradient so the flow stays swirling rather than bunching. rg velocity in texels per frame.
uniform sampler2D state : filter_linear;
uniform vec2 res = vec2(160.0, 102.0);
uniform int stage = 0;
uniform float first = 0.0;
uniform float time = 0.0;
uniform float turbulence = 0.5;
uniform float scale = 4.0;
uniform float keep = 0.98;
uniform vec4 drops[4];

float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p) {
	vec2 i = floor(p), f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(h(i), h(i + vec2(1, 0)), u.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), u.x), u.y);
}
float pot(vec2 p) { return n2(p + time * 0.13) + 0.5 * n2(p * 2.1 - time * 0.21); }

void fragment() {
	vec2 t = 1.0 / res;
	vec4 c = texture(state, UV);
	if (stage == 0) {
		vec2 back = UV - c.xy * t;
		vec4 a = texture(state, back);
		vec2 v = a.xy * keep;
		// Curl of a scalar potential is divergence free: eddies without sources.
		vec2 q = UV * vec2(res.x / res.y, 1.0) * scale;
		float e = 0.01;
		vec2 curl = vec2(pot(q + vec2(0, e)) - pot(q - vec2(0, e)), -(pot(q + vec2(e, 0)) - pot(q - vec2(e, 0)))) / (2.0 * e);
		v += curl * turbulence * 0.06;
		for (int i = 0; i < 4; i++) {
			vec2 d = (UV - drops[i].xy) * vec2(res.x / res.y, 1.0);
			float r = drops[i].z;
			float fall = exp(-dot(d, d) / (r * r));
			// Positive strength bursts outward, negative spins.
			vec2 dir = drops[i].w > 0.0 ? normalize(d + 1e-5) : vec2(-d.y, d.x) / (length(d) + 1e-5);
			v += dir * fall * abs(drops[i].w) * 3.0;
		}
		COLOR = vec4(clamp(v, vec2(-6.0), vec2(6.0)), a.z * 0.9, 1.0);
	} else if (stage == 1) {
		float div = 0.5 * (texture(state, UV + vec2(t.x, 0)).x - texture(state, UV - vec2(t.x, 0)).x + texture(state, UV + vec2(0, t.y)).y - texture(state, UV - vec2(0, t.y)).y);
		float p = (texture(state, UV + vec2(t.x, 0)).z + texture(state, UV - vec2(t.x, 0)).z + texture(state, UV + vec2(0, t.y)).z + texture(state, UV - vec2(0, t.y)).z - div) * 0.25;
		COLOR = vec4(c.xy, p, 1.0);
	} else {
		vec2 g = 0.5 * vec2(texture(state, UV + vec2(t.x, 0)).z - texture(state, UV - vec2(t.x, 0)).z, texture(state, UV + vec2(0, t.y)).z - texture(state, UV - vec2(0, t.y)).z);
		COLOR = vec4(c.xy - g, c.z, 1.0);
	}
}
