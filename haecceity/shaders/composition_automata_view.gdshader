shader_type canvas_item;
// Cells as ink: living cells full, the dead fading through their trail; cyclic states as bands of density.
uniform float amount = 0.0;
uniform int rule = 0;
uniform vec4 ink : source_color = vec4(0.95, 0.96, 0.94, 1.0);
uniform vec2 res = vec2(266.0, 170.0);

void fragment() {
	vec4 s = texture(TEXTURE, UV);
	float a;
	if (rule == 2) {
		// Every third state draws, so the spirals read as arms.
		float k = floor(s.b * 12.0 + 0.5);
		a = mod(k, 3.0) < 0.5 ? 0.85 : 0.08;
	} else if (rule == 1) {
		a = smoothstep(0.05, 0.6, s.r);
	} else {
		a = max(s.r * 0.9, s.g * 0.35 + s.b * 0.5);
	}
	// A hairline grid between cells keeps the pixels legible.
	vec2 f = fract(UV * res);
	float gap = step(0.08, f.x) * step(0.08, f.y);
	COLOR = vec4(ink.rgb, a * mix(0.75, 1.0, gap) * amount);
}
