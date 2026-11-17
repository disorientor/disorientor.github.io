shader_type canvas_item;
// The trail map as colour: each species' channel in its own colour, density tone-mapped into alpha, the
// densest membranes running to white.
uniform float amount = 0.0;
uniform float gain = 1.0;
uniform vec3 col_a : source_color = vec3(1.0, 0.7, 0.28);
uniform vec3 col_b : source_color = vec3(0.43, 0.83, 1.0);
uniform vec3 col_w : source_color = vec3(0.96);

void fragment() {
	vec3 t = texture(TEXTURE, UV).rgb * gain;
	float sum = t.r + t.g + t.b;
	vec3 col = (col_a * t.r + col_b * t.g + col_w * t.b) / max(sum, 0.0001);
	col = mix(col, col_w, smoothstep(2.2, 6.0, sum) * 0.7);
	COLOR = vec4(col, clamp((1.0 - exp(-sum * 1.4)) * amount, 0.0, 1.0));
}
