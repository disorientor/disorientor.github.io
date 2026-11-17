shader_type canvas_item;
render_mode blend_disabled;
// Colony agents, one per texel: xy position (0..1), z heading (turns), w species. Each senses the trail map
// ahead, left and right, turns toward what its species likes, steps, and wraps. The deposit pass draws them.
uniform sampler2D state : filter_nearest;
uniform sampler2D trail : filter_linear, repeat_enable;
uniform vec2 res = vec2(800.0, 510.0);
uniform float sense_d = 12.0;
uniform float sense_a = 0.5;
uniform float turn = 0.4;
uniform float speed = 1.0;
uniform float scatter = 0.0;
uniform float frame = 0.0;
uniform float first = 0.0;
uniform float reset = 0.0;
// 0 physarum, 1 cells, 2 lanes
uniform int mode = 0;
// xy centre (0..1), z radius, w share of agents moved there this frame
uniform vec4 blob = vec4(0.5, 0.5, 0.0, 0.0);

vec3 h3(vec2 q) {
	return fract(sin(vec3(dot(q, vec2(127.1, 311.7)), dot(q, vec2(269.5, 183.3)), dot(q, vec2(419.2, 371.9)))) * 43758.5453);
}

float sense(vec2 p, float a, vec3 w) {
	vec2 q = p + vec2(cos(a), sin(a)) * sense_d / res;
	return dot(texture(trail, q).rgb, w);
}

void fragment() {
	vec4 s = texture(state, UV);
	vec3 r = h3(UV * 311.0 + frame * 0.173);
	if (reset > 0.5) {
		vec3 q = h3(UV * 97.0 + 5.0);
		float pick = fract(q.z * 7.0);
		float sp = pick < 0.8 ? 0.0 : (pick < 0.92 ? 1.0 : 2.0);
		// Half start as a ring, so the first seconds already have a form; the rest fill the frame.
		float a = q.x * TAU;
		float rad = q.z < 0.5 ? 0.12 + 0.3 * sqrt(q.y) : 0.9 * sqrt(q.y);
		s = vec4(0.5 + cos(a) * rad * res.y / res.x, 0.5 + sin(a) * rad, fract(q.x + 0.5 + (r.x - 0.5) * 0.2), sp);
	}
	int sp = int(s.w + 0.5);
	vec3 w = mode == 0 ? vec3(0.0) : vec3(-1.2);
	if (mode == 2) {
		w = vec3(-1.0);
		w[(sp + 1) % 3] = 0.6;
	}
	w[sp] = 1.0;
	float a = s.z * TAU;
	float f = sense(s.xy, a, w);
	float l = sense(s.xy, a + sense_a, w);
	float rr = sense(s.xy, a - sense_a, w);
	if (f > l && f > rr) {
	} else if (f < l && f < rr) {
		a += (r.x - 0.5) * 2.0 * turn;
	} else if (l > rr) {
		a += turn;
	} else if (rr > l) {
		a -= turn;
	}
	a += (r.y - 0.5) * TAU * scatter;
	vec2 p = s.xy + vec2(cos(a), sin(a)) * speed * (0.7 + 0.6 * r.z) / res;
	if (r.z < blob.w) {
		float ba = r.x * TAU;
		p = blob.xy + vec2(cos(ba) * res.y / res.x, sin(ba)) * blob.z * sqrt(r.y);
		a = ba;
	}
	COLOR = vec4(fract(p), fract(a / TAU), s.w);
}
