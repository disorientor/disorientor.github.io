shader_type canvas_item;
#include "visual_panel_sampling.gdshaderinc"
#include "kinetic_moves.gdshaderinc"
uniform sampler2D tDiffuse : hint_screen_texture, filter_linear_mipmap;
uniform vec2 u_resolution = vec2(1920.0, 1080.0);
uniform float u_time = 0.0;
/*
 * GLITCH SUITE - SHADER 36: TOPOGRAPHIC CONTOUR MAP & ISOLINES
 * -----------------------------------------------------------
 * Renders the visual field as an elevation surveyor map with stepped
 * contour isolines, index contours, and elevation plateaus.
 * Sub-bass (u_rSwell) sends seismic elevation shockwaves through the terrain,
 * while kicks (u_rPulse) illuminate the peak elevation summits.
 */

uniform float u_intensity = 1.0;       // Blend of contour map over source (default: 1.0)
uniform float u_intervals = 16.0;      // Number of elevation contour bands (6.0 to 40.0, default: 16.0)
uniform float u_line_width = 0.8;      // Contour isoline thickness (default: 0.8)
uniform float u_style = 0.0;           // 0.0: Surveyor Parchment, 1.0: Neon Radar Topo, 2.0: Vintage Cartography
uniform float u_plateau_fill = 0.35;   // Shading fill between contour bands (default: 0.35)
uniform float u_index_interval = 5.0;  // Every Nth line is an accented index contour (default: 5.0)

float hash21(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec4 src = sample_visual_panel(tDiffuse, vUv);
    float luma = dot(src.rgb, vec3(0.299, 0.587, 0.114));

    // Seismic elevation displacement from sub-bass
    float seismic_wave = sin(length(vUv - 0.5) * 30.0 - u_time * 4.0) * u_rSwell * 0.04;
    float elevation = clamp(luma + seismic_wave, 0.0, 1.0);

    // Compute scaled elevation and fractional isoline position
    float scaled = elevation * max(u_intervals, 2.0);
    float band_index = floor(scaled);
    float band_frac = fract(scaled);

    // Isoline distance to nearest interval boundary
    float dist_to_line = abs(band_frac - 0.5);
    float screen_aa = fwidth(scaled) * 1.5;

    // Check if this band is a major index contour
    bool is_index = mod(band_index, max(u_index_interval, 1.0)) < 0.5;
    float current_width = u_line_width * (is_index ? 1.8 : 1.0);
    float line_mask = smoothstep(current_width * 0.15 + screen_aa, current_width * 0.15 - screen_aa, dist_to_line);

    // Summit peak flash on transients
    float summit_mask = step(0.92, elevation) * u_rPulse;

    vec3 bg_color;
    vec3 line_color;
    vec3 index_color;

    if (u_style < 0.5) {
        // Surveyor Parchment
        bg_color = vec3(0.95, 0.94, 0.89);
        line_color = vec3(0.25, 0.28, 0.32);
        index_color = vec3(0.08, 0.10, 0.14);
    } else if (u_style < 1.5) {
        // Tactical Neon Radar
        bg_color = vec3(0.02, 0.04, 0.06);
        line_color = vec3(0.00, 0.75, 0.85);
        index_color = vec3(0.20, 1.00, 0.60);
    } else {
        // Vintage Sepia Cartography
        bg_color = vec3(0.88, 0.80, 0.68);
        line_color = vec3(0.48, 0.32, 0.20);
        index_color = vec3(0.28, 0.16, 0.10);
    }

    // Plateau step shading
    float step_shade = (band_index / max(u_intervals, 1.0)) * u_plateau_fill;
    vec3 terrain = mix(bg_color, line_color, step_shade);

    // Composite contour lines
    vec3 active_line = is_index ? index_color : line_color;
    vec3 result = mix(terrain, active_line, line_mask);

    // Add peak flash
    result += vec3(1.0, 0.9, 0.6) * summit_mask * 0.8;

    out_col = vec4(mix(src.rgb, result, clamp(u_intensity, 0.0, 1.0)), src.a);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(UV, col);
    COLOR = col;
}
