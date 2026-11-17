shader_type spatial;
// A sheet of glass in the Space rig carrying one of the composition's 2D layers (transparent viewport texture,
// premultiplied by the canvas, so it is un-premultiplied here). A faint ink edge shows the sheet off-axis.
render_mode unshaded, cull_disabled, shadows_disabled, depth_draw_never, blend_mix;

uniform sampler2D tex : source_color, filter_linear, repeat_disable;
uniform vec3 ink : source_color = vec3(0.07);
uniform float alpha = 1.0;
uniform float edge_alpha = 0.0;

void fragment() {
	vec4 c = texture(tex, UV);
	vec3 rgb = c.a > 0.001 ? c.rgb / c.a : vec3(0.0);
	float edge = step(min(min(UV.x, 1.0 - UV.x), min(UV.y, 1.0 - UV.y)), 0.0025) * edge_alpha;
	float a = max(c.a, edge);
	ALBEDO = mix(rgb, ink, edge / max(a, 0.001));
	ALPHA = a * alpha;
}
