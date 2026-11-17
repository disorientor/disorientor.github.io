shader_type canvas_item;
// Reaction–diffusion as ink: B's concentration fills, its edges draw a fine contour.
uniform float amount = 0.0;
uniform vec4 ink : source_color = vec4(0.95, 0.96, 0.94, 1.0);
uniform vec2 res = vec2(400.0, 255.0);

void fragment() {
	float b = texture(TEXTURE, UV).g;
	vec2 t = 1.0 / res;
	float gx = texture(TEXTURE, UV + vec2(t.x, 0.0)).g - texture(TEXTURE, UV - vec2(t.x, 0.0)).g;
	float gy = texture(TEXTURE, UV + vec2(0.0, t.y)).g - texture(TEXTURE, UV - vec2(0.0, t.y)).g;
	float fill = smoothstep(0.12, 0.34, b);
	float edge = smoothstep(0.04, 0.16, length(vec2(gx, gy)));
	// The fill only tints; a heavier fill lays a pale veil over the whole frame.
	COLOR = vec4(ink.rgb, clamp(fill * 0.18 + edge * 0.75, 0.0, 1.0) * amount);
}
