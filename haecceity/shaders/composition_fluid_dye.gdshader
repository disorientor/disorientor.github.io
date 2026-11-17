shader_type canvas_item;
render_mode blend_disabled;
// The finished frame as dye: last frame's dye carried along the velocity field, with a little of the live
// frame (t-1) mixed back in every frame. Low refresh lets everything on screen smear into the turbulence.
// Bilinear carrying blurs a little every frame, and over hundreds of frames that greys the picture out, so the
// carried dye is sharpened back within the range of its neighbours: edges stay, nothing overshoots.
uniform sampler2D prev : filter_linear;
uniform sampler2D cur : filter_linear;
uniform sampler2D vel : filter_linear;
uniform vec2 vel_res = vec2(160.0, 102.0);
uniform float refresh = 0.1;
uniform float first = 0.0;
uniform float sharpen = 0.6;

void fragment() {
	vec2 v = texture(vel, UV).xy / vel_res;
	vec2 src = UV - v;
	vec2 px = 1.0 / vec2(textureSize(prev, 0));
	vec3 c = texture(prev, src).rgb;
	vec3 e = texture(prev, src + vec2(px.x, 0.0)).rgb;
	vec3 w = texture(prev, src - vec2(px.x, 0.0)).rgb;
	vec3 n = texture(prev, src + vec2(0.0, px.y)).rgb;
	vec3 s = texture(prev, src - vec2(0.0, px.y)).rgb;
	vec3 lo = min(min(min(e, w), min(n, s)), c);
	vec3 hi = max(max(max(e, w), max(n, s)), c);
	vec4 carried = vec4(clamp(c + sharpen * (c - (e + w + n + s) * 0.25), lo, hi), 1.0);
	vec4 live = texture(cur, UV);
	// Dither by half a step so 8-bit rounding cannot pin faint smears in place.
	float d = (fract(sin(dot(FRAGCOORD.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
	COLOR = vec4(mix(carried.rgb, live.rgb, first > 0.5 ? 1.0 : refresh) + d, 1.0);
}
