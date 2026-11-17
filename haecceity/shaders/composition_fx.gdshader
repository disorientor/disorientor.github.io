shader_type canvas_item;
// Composition FX (from the web sketch): row shifts, block displacement, RGB split, a darkening smear from
// the previous composed frame, scanlines and grain. Processes everything drawn before it: the ground,
// the back layer, the stage and the under layer. Notes and interrupts raise `spike`.
uniform sampler2D screen : hint_screen_texture, filter_linear_mipmap;
uniform sampler2D prev_frame : filter_linear;
uniform bool has_prev = false;
uniform vec2 res = vec2(1600.0, 1020.0);
uniform float time = 0.0;
uniform float amount = 0.45;
uniform float spike = 0.0;

float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void fragment() {
	vec2 uv = SCREEN_UV;
	float tq = floor(time * 12.0);
	float row = floor(uv.y * 48.0);
	float shift = step(1.0 - (0.06 * amount + 0.35 * spike), h(vec2(row, tq))) * (h(vec2(row, 7.0 + tq)) - 0.5) * (0.06 * amount + 0.18 * spike);
	vec2 blk = floor(uv * vec2(12.0, 20.0));
	vec2 boff = step(1.0 - 0.05 * spike - 0.01 * amount, h(blk + floor(time * 6.0))) * vec2(h(blk + 3.1) - 0.5, 0.0) * 0.2;
	vec2 u2 = uv + vec2(shift, 0.0) + boff;
	float ca = 0.001 * amount * amount + 0.006 * spike;
	vec3 c = vec3(textureLod(screen, u2 + vec2(ca, 0.0), 0.0).r, textureLod(screen, u2, 0.0).g, textureLod(screen, u2 - vec2(ca, 0.0), 0.0).b);
	if (has_prev) {
		vec2 pu = (uv - 0.5) * (1.0 - 0.004 * amount) + 0.5 + vec2(0.0, 0.0012);
		vec3 pf = texture(prev_frame, pu).rgb;
		c = mix(c, min(c, pf), clamp(0.14 * amount + 0.25 * spike, 0.0, 0.6));
	}
	float sl = 0.97 + 0.03 * sin(uv.y * res.y * 3.14159);
	float gr = (h(uv * res + fract(time) * 100.0) - 0.5) * 0.012 * amount;
	COLOR = vec4(c * mix(1.0, sl, amount) + gr, 1.0);
}
