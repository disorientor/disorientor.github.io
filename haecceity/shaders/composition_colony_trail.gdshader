shader_type canvas_item;
render_mode blend_disabled;
// The trail map's last frame, diffused a little and decayed.
uniform sampler2D prev : filter_linear, repeat_enable;
uniform vec2 res = vec2(800.0, 510.0);
uniform float decay = 0.9;
uniform float diffuse = 0.5;

void fragment() {
	vec2 px = 1.0 / res;
	vec3 c = texture(prev, UV).rgb;
	vec3 n = texture(prev, UV + vec2(px.x, 0.0)).rgb + texture(prev, UV - vec2(px.x, 0.0)).rgb + texture(prev, UV + vec2(0.0, px.y)).rgb + texture(prev, UV - vec2(0.0, px.y)).rgb;
	COLOR = vec4(mix(c, n * 0.25, diffuse) * decay, 1.0);
}
