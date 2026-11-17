shader_type canvas_item;
render_mode blend_disabled;
// Strange attractors, one step per texel: each texel is a particle (xyz). Maps (Clifford, de Jong) jump once
// per frame and build a density cloud; flows (Lorenz, Rössler, Aizawa, Thomas) integrate a few substeps and
// trace paths. Kicks scatter them all.
uniform sampler2D state : filter_nearest;
uniform vec2 res = vec2(128.0, 128.0);
uniform int kind = 0;
uniform vec4 p = vec4(-1.4, 1.6, 1.0, 0.7);
uniform float dt = 0.006;
uniform float scatter = 0.0;
uniform float frame = 0.0;
uniform float first = 0.0;
uniform float reset = 0.0;

vec3 h3(vec2 q) {
	return fract(sin(vec3(dot(q, vec2(127.1, 311.7)), dot(q, vec2(269.5, 183.3)), dot(q, vec2(419.2, 371.9)))) * 43758.5453);
}

vec3 flow(vec3 v) {
	if (kind == 2) return vec3(10.0 * (v.y - v.x), v.x * (28.0 - v.z) - v.y, v.x * v.y - 2.6667 * v.z);
	if (kind == 3) return vec3(-v.y - v.z, v.x + 0.2 * v.y, 0.2 + v.z * (v.x - 5.7));
	if (kind == 4) {
		float a = 0.95, b = 0.7, c = 0.6, d = 3.5, e = 0.25, f = 0.1;
		return vec3((v.z - b) * v.x - d * v.y, d * v.x + (v.z - b) * v.y, c + a * v.z - v.z * v.z * v.z / 3.0 - (v.x * v.x + v.y * v.y) * (1.0 + e * v.z) + f * v.z * v.x * v.x * v.x);
	}
	float b = 0.208186;
	return vec3(sin(v.y) - b * v.x, sin(v.z) - b * v.y, sin(v.x) - b * v.z);
}

vec3 seed(vec2 q) {
	vec3 r = h3(q + frame * 0.37) - 0.5;
	if (kind == 2) return r * vec3(30.0, 30.0, 40.0) + vec3(0.0, 0.0, 25.0);
	if (kind == 3) return r * 16.0;
	if (kind == 4) return r * 2.0;
	if (kind == 5) return r * 6.0;
	return r * 4.0;
}

void fragment() {
	vec2 cell = floor(UV * res);
	vec3 v = texture(state, UV).xyz;
	vec3 r = h3(cell + frame);
	bool lost = dot(v, v) < 1e-8 || any(isnan(v)) || dot(v, v) > 1e5;
	if (first > 0.5 && (reset > 0.5 || lost)) v = seed(cell);
	// A few particles a frame respawn beside another one, already on the attractor, so none settle on a short
	// cycle and none cross the empty space around it.
	else if (first > 0.5 && r.x < 0.003) v = texture(state, h3(cell + frame * 1.3).yz).xyz + (r - 0.5) * 0.01;
	if (kind == 0) {
		v = vec3(sin(p.x * v.y) + p.z * cos(p.x * v.x), sin(p.y * v.x) + p.w * cos(p.y * v.y), v.z * 0.9 + 0.1 * sin(v.x * 3.0));
	} else if (kind == 1) {
		v = vec3(sin(p.x * v.y) - cos(p.y * v.x), sin(p.z * v.x) - cos(p.w * v.y), v.z * 0.9 + 0.1 * cos(v.y * 3.0));
	} else {
		// Midpoint steps, deformed a little by p so notes bend the flow.
		for (int i = 0; i < 4; i++) {
			vec3 k1 = flow(v);
			vec3 k2 = flow(v + k1 * dt * 0.5);
			v += k2 * dt * (1.0 + 0.15 * (p.x + 1.4));
		}
	}
	v += (r - 0.5) * scatter;
	COLOR = vec4(v, 1.0);
}
