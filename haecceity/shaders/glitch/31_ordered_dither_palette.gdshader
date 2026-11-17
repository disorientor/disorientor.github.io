shader_type canvas_item;
#include "visual_panel_sampling.gdshaderinc"
#include "kinetic_moves.gdshaderinc"
uniform sampler2D tDiffuse : hint_screen_texture, filter_linear_mipmap;
uniform vec2 u_resolution = vec2(1920.0, 1080.0);
uniform float u_time = 0.0;
/*
 * GLITCH SUITE - SHADER 31: ORDERED DITHER & PALETTE QUANTIZE
 * -----------------------------------------------------------
 * Bayer-matrix ordered dithering (2x2 / 4x4 / 8x8) against a small hard
 * palette: 1-bit mono, Game Boy greens, two-ink riso, thermal ramp, CGA.
 * Cell size is chunky on purpose so the dither reads as pixel art.
 */

uniform float u_intensity = 1.0;       // Blend of dithered image over source (default: 1.0)
uniform float u_cell_size = 3.0;       // Dither cell size in screen pixels (default: 3.0)
uniform float u_matrix_size = 1.0;     // 0.0: Bayer 2x2, 1.0: Bayer 4x4, 2.0: Bayer 8x8
uniform float u_palette = 0.0;         // 0.0: 1-Bit, 1.0: Game Boy, 2.0: Riso two-ink, 3.0: Thermal, 4.0: CGA
uniform float u_levels = 4.0;          // Palette steps for ramp palettes (2.0 to 8.0, default: 4.0)
uniform float u_contrast = 1.0;        // Luma contrast before dither (default: 1.0)
uniform float u_threshold_drift = 0.0; // Animated threshold wobble, audio/time reactive (default: 0.0)

float bayer2(vec2 p) {
    p = floor(mod(p, 2.0));
    return (p.x + 2.0 * p.y == 0.0) ? 0.0 : (p.x + 2.0 * p.y == 1.0) ? 2.0 : (p.x + 2.0 * p.y == 2.0) ? 3.0 : 1.0;
}

// Recursive Bayer: each level quadruples the previous matrix.
float bayer4(vec2 p) {
    return bayer2(p) * 4.0 + bayer2(floor(p * 0.5));
}

float bayer8(vec2 p) {
    return bayer4(p) * 4.0 + bayer2(floor(p * 0.25));
}

float threshold_at(vec2 cell) {
    if (u_matrix_size < 0.5) return (bayer2(cell) + 0.5) / 4.0;
    if (u_matrix_size < 1.5) return (bayer2(cell) * 4.0 + bayer2(floor(cell * 0.5)) + 0.5) / 16.0;
    return (bayer8(cell) + 0.5) / 64.0;
}

vec3 ramp(float t) {
    if (u_palette < 0.5) {
        return vec3(t);
    } else if (u_palette < 1.5) {
        // Game Boy: 4 greens, darkest to lightest
        if (t < 0.25) return vec3(0.059, 0.220, 0.059);
        if (t < 0.50) return vec3(0.188, 0.384, 0.188);
        if (t < 0.75) return vec3(0.545, 0.675, 0.059);
        return vec3(0.608, 0.737, 0.059);
    } else if (u_palette < 2.5) {
        // Riso: paper + two inks
        vec3 paper = vec3(0.96, 0.93, 0.84);
        vec3 ink_a = vec3(0.00, 0.47, 0.78);
        vec3 ink_b = vec3(1.00, 0.28, 0.45);
        return mix(mix(ink_a, ink_b, smoothstep(0.0, 0.5, t)), paper, smoothstep(0.5, 1.0, t));
    } else if (u_palette < 3.5) {
        // Thermal: black -> violet -> pink -> orange -> white
        vec3 c = vec3(0.02, 0.0, 0.08);
        c = mix(c, vec3(0.45, 0.05, 0.65), smoothstep(0.0, 0.3, t));
        c = mix(c, vec3(1.00, 0.30, 0.65), smoothstep(0.25, 0.55, t));
        c = mix(c, vec3(1.00, 0.75, 0.25), smoothstep(0.5, 0.8, t));
        return mix(c, vec3(1.0), smoothstep(0.8, 1.0, t));
    }
    // CGA: black, cyan, magenta, white
    if (t < 0.25) return vec3(0.0);
    if (t < 0.50) return vec3(0.0, 0.95, 0.95);
    if (t < 0.75) return vec3(0.95, 0.0, 0.85);
    return vec3(1.0);
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 px = vUv * u_resolution;
    vec2 cell = floor(px / max(u_cell_size, 1.0));
    vec2 cell_uv = (cell + 0.5) * max(u_cell_size, 1.0) / u_resolution;

    vec4 src = sample_visual_panel(tDiffuse, clamp(cell_uv, 0.0, 1.0));
    float luma = dot(src.rgb, vec3(0.299, 0.587, 0.114));
    float eff_contrast = u_contrast + u_rGlow * 0.4;
    luma = clamp((luma - 0.5) * eff_contrast + 0.5, 0.0, 1.0);

    float drift = (u_threshold_drift + u_rSway * 0.4) * 0.25 * sin(u_time * 3.0 + cell.y * 0.35);
    float th = threshold_at(cell) + drift;

    float steps = (u_palette < 0.5) ? 1.0 : max(2.0, floor(u_levels)) - 1.0;
    float scaled = luma * steps;
    float q = (floor(scaled) + step(th, fract(scaled))) / steps;
    vec3 dithered = ramp(clamp(q, 0.0, 1.0));

    out_col = vec4(mix(src.rgb, dithered, clamp(u_intensity, 0.0, 1.0)), src.a);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(UV, col);
    COLOR = col;
}
