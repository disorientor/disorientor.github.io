shader_type canvas_item;
// Composition window content: crop (with cover fit computed by the controller), rect or circle mask,
// a backing colour under transparent sources, an empty-frame cross and a capture flash.
uniform vec4 crop = vec4(0.0, 0.0, 1.0, 1.0);
uniform vec2 half_size = vec2(100.0, 100.0);
uniform bool circle = false;
uniform bool empty = false;
uniform vec4 bg : source_color = vec4(0.07, 0.075, 0.08, 1.0);
uniform float flash = 0.0;

varying vec2 local;
varying vec4 tint;

void vertex() {
	local = VERTEX;
	tint = COLOR;
}

void fragment() {
	if (circle && length(local) > min(half_size.x, half_size.y)) discard;
	vec3 rgb = bg.rgb;
	if (empty) {
		vec2 p = local / half_size;
		float d = min(abs(p.x - p.y), abs(p.x + p.y)) * min(half_size.x, half_size.y);
		rgb = mix(vec3(0.66, 0.71, 0.75), rgb, smoothstep(0.5, 1.5, d));
	} else {
		vec4 t = texture(TEXTURE, crop.xy + UV * crop.zw);
		rgb = mix(rgb, t.rgb, t.a);
	}
	rgb = mix(rgb, vec3(0.953, 0.957, 0.945), clamp(flash, 0.0, 1.0));
	COLOR = vec4(rgb, tint.a);
}
