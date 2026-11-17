shader_type canvas_item;
render_mode blend_disabled;
// The trail buffer's last frame, dimmed: the decay sets how long paths linger.
uniform sampler2D prev : filter_nearest;
uniform float decay = 0.9;

void fragment() {
	COLOR = vec4(texture(prev, UV).rgb * decay, 1.0);
}
