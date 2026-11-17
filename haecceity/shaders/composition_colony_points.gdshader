shader_type canvas_item;
render_mode blend_add, unshaded;
// One point per agent (a single mesh of points whose vertex positions are their texels), drawn additively into the trail map in its species' channel.
uniform sampler2D state : filter_nearest;
// Share of the agents drawn (the rest are parked off the map).
uniform float share = 1.0;
uniform vec2 res = vec2(800.0, 510.0);
uniform float size = 1.0;
uniform float bright = 0.03;
varying vec3 chan;

void vertex() {
	ivec2 c = ivec2(VERTEX);
	vec4 s = texelFetch(state, c, 0);
	int sp = int(s.w + 0.5);
	chan = vec3(sp == 0 ? 1.0 : 0.0, sp == 1 ? 1.0 : 0.0, sp == 2 ? 1.0 : 0.0);
	float pick = fract(sin(dot(vec2(c), vec2(12.9898, 78.233))) * 43758.5453);
	VERTEX = pick <= share ? s.xy * res : vec2(-64.0);
}

void fragment() {
	COLOR = vec4(chan * bright, 1.0);
}
