shader_type canvas_item;
render_mode blend_disabled;
// An opaque copy: replaces what is under it instead of blending, so a reused tile never keeps old pixels.
void fragment() {
	COLOR = vec4(texture(TEXTURE, UV).rgb, 1.0);
}
