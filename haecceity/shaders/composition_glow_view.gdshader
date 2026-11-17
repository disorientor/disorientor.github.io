shader_type canvas_item;
// An additive buffer as ink: brightness tone-mapped into alpha.
uniform float amount = 0.0;
uniform float gain = 1.0;
uniform vec4 ink : source_color = vec4(0.95, 0.96, 0.94, 1.0);

void fragment() {
	float v = texture(TEXTURE, UV).r * gain;
	COLOR = vec4(ink.rgb, (1.0 - exp(-v)) * amount);
}
