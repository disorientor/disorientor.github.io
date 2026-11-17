// Effects use panel-local UVs, while Godot's screen texture covers the window.
// Bounds are normalized in the root viewport, including canvas stretch.
uniform vec4 u_screen_rect = vec4(0.0, 0.0, 1.0, 1.0);

vec4 sample_visual_panel(sampler2D source, vec2 local_uv) {
    vec2 half_pixel = 0.5 / vec2(textureSize(source, 0));
    vec2 screen_uv = u_screen_rect.xy + local_uv * u_screen_rect.zw;
    screen_uv = clamp(screen_uv, u_screen_rect.xy + half_pixel,
        u_screen_rect.xy + u_screen_rect.zw - half_pixel);
    return textureLod(source, screen_uv, 0.0);
}
