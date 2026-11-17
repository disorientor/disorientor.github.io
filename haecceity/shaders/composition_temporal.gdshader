shader_type canvas_item;
// Temporal: the last sixteen captured frames (a 4x4 atlas, newest at `head`) used as material. Each pixel
// reads its own moment in that history: a slit-scan across a direction notes turn, bright parts held further
// back, ripples of delay from a kick. Echo layers older frames as ghosts; flow pushes each pixel along the
// difference between two moments, so motion smears through time.
uniform sampler2D atlas : filter_linear;
uniform sampler2D cur : filter_linear;
uniform float head = 0.0;
uniform float amount = 0.0;
uniform vec2 slit_dir = vec2(1.0, 0.0);
uniform float slit = 0.5;
uniform float luma_hold = 0.0;
uniform float ripple = 0.0;
uniform vec2 ripple_at = vec2(0.5);
uniform float ripple_r = 0.0;
uniform float echo = 0.0;
uniform float flow = 0.0;
uniform float span = 15.0;

vec3 slot(float back, vec2 uv) {
	float i = mod(head - back + 32.0, 16.0);
	vec2 tile = vec2(mod(i, 4.0), floor(i / 4.0));
	vec2 q = clamp(uv, vec2(0.002), vec2(0.998));
	return texture(atlas, (tile + q) / 4.0).rgb;
}

// Between two whole slots, so delays sweep smoothly.
vec3 at_time(float back, vec2 uv) {
	back = clamp(back, 0.0, 15.0);
	float f = floor(back);
	return mix(slot(f, uv), slot(min(15.0, f + 1.0), uv), back - f);
}

void fragment() {
	vec2 uv = UV;
	vec3 now = texture(cur, uv).rgb;
	float l = dot(now, vec3(0.299, 0.587, 0.114));
	float d = (dot(uv - 0.5, slit_dir) + 0.5) * slit * span;
	d += l * luma_hold * span;
	float rr = length((uv - ripple_at) * vec2(1.6, 1.0));
	d += ripple * exp(-pow((rr - ripple_r) * 7.0, 2.0)) * span * 0.6;
	d = clamp(d, 0.0, span);
	vec3 a = at_time(d, uv);
	vec3 b = at_time(d + 2.0, uv);
	vec2 push = vec2(dot(a - b, vec3(0.33)), dot(b - a, vec3(0.2, 0.5, 0.3))) * flow * 0.08;
	vec3 col = at_time(d, uv + push);
	// Averaging misaligned moments greys the frame, so ghosts only add where they are brighter:
	// the base moment keeps its darks and the echoes trail as light.
	for (int k = 1; k <= 3; k++) {
		float w = echo * pow(0.6, float(k));
		col = mix(col, max(col, at_time(d + float(k) * span / 4.0, uv + push * float(k))), w);
	}
	COLOR = vec4(col, amount);
}
