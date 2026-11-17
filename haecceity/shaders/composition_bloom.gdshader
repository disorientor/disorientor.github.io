shader_type canvas_item;
// Bloom and glints over the frame with the fields on it: the blurred levels of the frame added back, and
// short four-point streaks off the brightest marks. On paper it deepens the ink instead.
uniform sampler2D screen : hint_screen_texture, filter_linear_mipmap;
uniform vec2 res = vec2(1600.0, 1020.0);
uniform float amount = 0.0;
uniform float hit = 0.0;
uniform float paper = 0.0;

vec3 hot(vec2 uv) {
	vec3 c = textureLod(screen, uv, 1.0).rgb;
	return c * smoothstep(0.55, 0.95, max(c.r, max(c.g, c.b)));
}

void fragment() {
	vec2 uv = SCREEN_UV;
	vec2 px = SCREEN_PIXEL_SIZE;
	vec3 base = textureLod(screen, uv, 0.0).rgb;
	vec3 glow = vec3(0.0);
	for (int i = 0; i < 4; i++) {
		vec2 o = vec2(float(i % 2) - 0.5, float(i / 2) - 0.5);
		glow += textureLod(screen, uv + o * px * 6.0, 2.5).rgb * 0.3 + textureLod(screen, uv + o * px * 14.0, 4.0).rgb * 0.4 + textureLod(screen, uv + o * px * 30.0, 5.5).rgb * 0.3;
	}
	glow *= 0.25;
	vec3 streak = vec3(0.0);
	for (int i = 1; i <= 8; i++) {
		float d = float(i) * 5.0;
		float w = exp(-float(i) * 0.45);
		streak += (hot(uv + vec2(d * px.x, 0.0)) + hot(uv - vec2(d * px.x, 0.0)) + hot(uv + vec2(0.0, d * px.y)) + hot(uv - vec2(0.0, d * px.y))) * w;
	}
	float k = amount * (1.0 + hit * 0.6);
	vec3 lit = base + glow * k * 2.2 + streak * k * 0.22;
	vec3 inked = base * (1.0 - (1.0 - glow) * k * 0.5);
	COLOR = vec4(mix(lit, inked, paper), 1.0);
}
