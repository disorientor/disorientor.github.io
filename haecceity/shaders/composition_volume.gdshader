shader_type canvas_item;
render_mode blend_disabled;
// Volume: a raymarched density field lit by one moving light. Low fog rolls across the floor of the space,
// kicks leave puffs of smoke that billow out and thin, and a form (sphere, torus, box, octahedron, chosen by
// the last note) condenses out of the empty air as luminous density on its surface. White with alpha; the
// field node tints it with the ink.
uniform vec2 res = vec2(533.0, 340.0);
uniform float time = 0.0;
uniform float density = 0.5;
uniform float light = 0.5;
uniform float form = 0.5;
uniform float drift = 0.5;
uniform float swell = 0.0;
uniform vec3 light_pos = vec3(0.6, 0.8, 0.2);
uniform int shape_a = 0;
uniform int shape_b = 1;
uniform float shape_t = 1.0;
uniform vec4 puffs[4];
uniform float sparkle = 0.0;

float h(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float n3(vec3 p) {
	vec3 i = floor(p), f = fract(p);
	vec3 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(mix(h(i), h(i + vec3(1, 0, 0)), u.x), mix(h(i + vec3(0, 1, 0)), h(i + vec3(1, 1, 0)), u.x), u.y),
		mix(mix(h(i + vec3(0, 0, 1)), h(i + vec3(1, 0, 1)), u.x), mix(h(i + vec3(0, 1, 1)), h(i + vec3(1, 1, 1)), u.x), u.y), u.z);
}
float fbm(vec3 p) { return n3(p) * 0.55 + n3(p * 2.03) * 0.28 + n3(p * 4.1) * 0.17; }

float sdf(vec3 p, int s) {
	if (s == 0) return length(p) - 0.55;
	if (s == 1) { vec2 q = vec2(length(p.xz) - 0.5, p.y); return length(q) - 0.17; }
	if (s == 2) { vec3 d = abs(p) - vec3(0.4); return length(max(d, 0.0)) + min(max(d.x, max(d.y, d.z)), 0.0); }
	return (abs(p.x) + abs(p.y) + abs(p.z) - 0.65) * 0.577;
}

float field(vec3 p) {
	vec3 w = p + vec3(time * 0.12, time * 0.03, time * 0.07) * drift;
	float n = fbm(w * 1.6);
	// Fog lies low and thins with height.
	float fog = smoothstep(0.75, -0.6, p.y) * (n - 0.35) * 1.6;
	float smoke = 0.0;
	for (int i = 0; i < 4; i++) {
		vec3 c = puffs[i].xyz;
		float r = puffs[i].w;
		if (r <= 0.0) continue;
		float d = length(p - c) / r;
		smoke += smoothstep(1.0, 0.2, d + (n - 0.5) * 0.8) * (1.2 - r);
	}
	// The form: density on its surface, broken by noise until Form brings it fully out of the air.
	float t = shape_t;
	vec3 q = p;
	float a = time * 0.2;
	q.xz = mat2(vec2(cos(a), sin(a)), vec2(-sin(a), cos(a))) * q.xz;
	float sd = mix(sdf(q, shape_a), sdf(q, shape_b), t);
	float shell = exp(-abs(sd) * 14.0) * smoothstep(0.25, 0.75, n + form * 0.6);
	return max(0.0, fog * density * (1.0 + swell)) + max(0.0, smoke) * 0.9 + shell * form * 1.8;
}

void fragment() {
	vec2 uv = (UV - 0.5) * vec2(res.x / res.y, 1.0) * 2.0;
	uv.y = -uv.y;
	vec3 ro = vec3(0.0, 0.05, -2.4);
	vec3 rd = normalize(vec3(uv, 1.6));
	float t = 1.2;
	float trans = 1.0;
	float glow = 0.0;
	// Jittered start hides the step banding.
	t += h(vec3(FRAGCOORD.xy, time)) * 0.06;
	for (int i = 0; i < 30; i++) {
		vec3 p = ro + rd * t;
		float d = field(p);
		if (d > 0.01) {
			// Two short steps toward the light for its shadowing.
			vec3 l = normalize(light_pos - p);
			float sh = field(p + l * 0.12) + field(p + l * 0.3);
			float lit = exp(-sh * 1.6) * (0.25 + light * 1.6) / (1.0 + dot(light_pos - p, light_pos - p) * 0.4);
			float a = 1.0 - exp(-d * 0.09);
			glow += trans * a * (lit + 0.08);
			trans *= 1.0 - a;
			if (trans < 0.02) break;
		}
		t += 0.085;
	}
	// The light itself, as a faint halo through the volume.
	vec3 lp = light_pos - ro;
	float ld = length(cross(rd, lp)) / max(0.1, dot(rd, normalize(lp)));
	glow += exp(-ld * ld * 30.0) * light * 0.35 * trans;
	glow += sparkle * step(0.997, h(vec3(floor(FRAGCOORD.xy), floor(time * 12.0)))) * (1.0 - trans);
	COLOR = vec4(1.0, 1.0, 1.0, clamp(glow, 0.0, 1.0));
}
