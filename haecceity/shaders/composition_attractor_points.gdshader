shader_type canvas_item;
render_mode blend_add, unshaded;
// One instance per particle: its position comes from the state texture, rotated and projected into the trail
// buffer. Additive, so dense regions of the attractor glow.
uniform sampler2D state : filter_nearest;
uniform int side = 128;
uniform vec2 res = vec2(800.0, 510.0);
uniform vec3 centre = vec3(0.0);
// Where the attractor's centre sits in the buffer, in pixels.
uniform vec2 at = vec2(400.0, 255.0);
uniform mat3 rot = mat3(1.0);
uniform float scale = 100.0;
uniform float size = 1.5;
uniform float bright = 0.12;
uniform float persp_k = 0.05;
varying float fade;

void vertex() {
	ivec2 c = ivec2(INSTANCE_ID % side, INSTANCE_ID / side);
	vec3 p = rot * (texelFetch(state, c, 0).xyz - centre);
	float persp = 1.0 / max(0.25, 1.0 + p.z * persp_k);
	VERTEX = at + p.xy * scale * persp + VERTEX * size;
	fade = clamp(persp, 0.3, 1.5);
}

void fragment() {
	COLOR = vec4(vec3(bright * fade), 1.0);
}
