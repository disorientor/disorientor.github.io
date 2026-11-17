shader_type canvas_item;
render_mode blend_mix, unshaded;
// Point cloud / Gaussian splats: one instance per grid cell of the source picture. Luminance becomes depth,
// the cloud turns in 3D, kicks explode it along seeded directions and it reassembles as the burst decays;
// a note sweeps a slicing plane that pulls one depth band apart. Dark cells stay as a faint ink dust, so the
// grid itself reads as a cloud in space.
uniform sampler2D src : filter_linear;
uniform ivec2 grid = ivec2(160, 100);
uniform vec2 res = vec2(1600.0, 1020.0);
uniform float depth = 0.5;
uniform float yaw = 0.0;
uniform float pitch = 0.0;
uniform float explode = 0.0;
uniform float seed = 0.0;
uniform float slice = -9.0;
uniform float jitter = 0.0;
uniform float size = 1.0;
uniform float amount = 1.0;
uniform float time = 0.0;
uniform vec4 ink : source_color = vec4(0.95, 0.96, 0.94, 1.0);
varying vec4 tint;

vec3 h3(float q) {
	return fract(sin(vec3(q * 12.9898, q * 78.233, q * 37.719)) * 43758.5453);
}

void vertex() {
	ivec2 c = ivec2(INSTANCE_ID % grid.x, INSTANCE_ID / grid.x);
	vec2 uv = (vec2(c) + 0.5) / vec2(grid);
	vec4 s = textureLod(src, uv, 0.0);
	float lum = dot(s.rgb, vec3(0.299, 0.587, 0.114));
	float aspect = res.x / res.y;
	vec3 p = vec3((uv.x - 0.5) * aspect, uv.y - 0.5, (lum - 0.5) * depth);
	vec3 r = h3(float(INSTANCE_ID) + seed) - 0.5;
	p += normalize(r + 1e-4) * explode * (0.4 + length(r) * 1.6);
	float band = exp(-pow((p.z - slice) * 8.0, 2.0));
	p.xy += normalize(p.xy + 1e-4) * band * 0.25;
	p += (h3(float(INSTANCE_ID) * 1.7 + floor(time * 20.0)) - 0.5) * jitter * 0.02;
	float cy = cos(yaw), sy = sin(yaw), cp = cos(pitch), sp = sin(pitch);
	p = vec3(cy * p.x + sy * p.z, p.y, -sy * p.x + cy * p.z);
	p = vec3(p.x, cp * p.y - sp * p.z, sp * p.y + cp * p.z);
	float persp = 1.6 / (1.6 + p.z);
	float cell = res.y / float(grid.y);
	VERTEX = res * 0.5 + p.xy * res.y * persp + VERTEX * cell * size * 2.2 * persp;
	float lit = smoothstep(0.03, 0.16, lum) * s.a;
	tint = vec4(mix(ink.rgb * 0.5, s.rgb, lit), max(lit, 0.035) * amount);
}

void fragment() {
	vec2 d = UV - 0.5;
	COLOR = vec4(tint.rgb, tint.a * exp(-dot(d, d) * 14.0));
}
