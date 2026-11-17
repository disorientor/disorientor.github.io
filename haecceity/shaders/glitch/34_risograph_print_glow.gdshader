shader_type canvas_item;
#include "visual_panel_sampling.gdshaderinc"
#include "kinetic_moves.gdshaderinc"
uniform sampler2D tDiffuse : hint_screen_texture, filter_linear_mipmap;
uniform vec2 u_resolution = vec2(1920.0, 1080.0);
uniform float u_time = 0.0;
/*
 * GLITCH SUITE - SHADER 34: RISOGRAPH PRINT & FLUORESCENT GLOW
 * -------------------------------------------------------------
 * Simulates physical dual-drum Risograph stencil duplication.
 * Features plate misregistration jitter, stochastic master-screen stippling,
 * subtractive soy ink multiplication on absorbent textured paper stock,
 * and high-intensity fluorescent core bloom on neon inks.
 */

uniform float u_intensity = 1.0;       // Blend of Riso print over source (default: 1.0)
uniform float u_drum_palette = 0.0;    // 0.0: Fluo Pink / Federal Blue, 1.0: Sunflower / Marine Red / Teal, 2.0: Mint / Violet, 3.0: Fluo Orange / Black
uniform float u_misregister = 0.35;    // Plate misalignment between drum passes (default: 0.35)
uniform float u_grain = 0.40;          // Thermal stencil screen grain / fiber stippling (default: 0.40)
uniform float u_paper_tone = 0.94;     // Paper stock brightness (default: 0.94, warm unbleached)
uniform float u_glow = 0.45;           // Fluorescent ink luminescence / bloom (default: 0.45)
uniform float u_ink_density = 1.1;     // Ink saturation / pressure transfer (default: 1.1)

float hash21(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
}

mat2 rot(float a) {
    float s = sin(a), c = cos(a);
    return mat2(vec2(c, -s), vec2(s, c));
}

// Stencil screen stippling noise
float screen_noise(vec2 px, float angle) {
    vec2 p = rot(angle) * px;
    float n1 = hash21(floor(p * 0.8));
    float n2 = hash21(floor(p * 1.6 + vec2(13.7, 91.1)));
    return mix(n1, n2, 0.5);
}

void get_drum_inks(float palette, out vec3 ink_a, out vec3 ink_b, out vec3 ink_c, out int drum_count) {
    if (palette < 0.5) {
        // Fluo Pink + Federal Blue (Classic 2-drum)
        ink_a = vec3(1.00, 0.18, 0.65); // Fluo Pink
        ink_b = vec3(0.00, 0.28, 0.68); // Federal Blue
        ink_c = vec3(0.0);
        drum_count = 2;
    } else if (palette < 1.5) {
        // Sunflower + Marine Red + Teal (3-drum)
        ink_a = vec3(1.00, 0.72, 0.00); // Sunflower
        ink_b = vec3(0.85, 0.10, 0.20); // Marine Red
        ink_c = vec3(0.00, 0.52, 0.54); // Teal
        drum_count = 3;
    } else if (palette < 2.5) {
        // Mint + Violet
        ink_a = vec3(0.00, 0.76, 0.45); // Mint
        ink_b = vec3(0.44, 0.18, 0.62); // Violet
        ink_c = vec3(0.0);
        drum_count = 2;
    } else {
        // Fluo Orange + Midnight Black
        ink_a = vec3(1.00, 0.40, 0.10); // Fluo Orange
        ink_b = vec3(0.08, 0.07, 0.09); // Black
        ink_c = vec3(0.0);
        drum_count = 2;
    }
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 px = vUv * u_resolution;
    vec4 src = sample_visual_panel(tDiffuse, vUv);
    
    // Dynamic misregistration modulated by audio sub-bass (swell) and sway
    float mis_amt = (u_misregister + u_rSwell * 0.45) * 8.0;
    vec2 offset_a = vec2(mis_amt * 0.5, -mis_amt * 0.25);
    vec2 offset_b = vec2(-mis_amt * 0.4, mis_amt * 0.35);
    vec2 offset_c = vec2(mis_amt * 0.2, mis_amt * 0.5);

    // Sample source channels with drum offset
    vec2 uv_a = clamp(vUv + offset_a / u_resolution, 0.0, 1.0);
    vec2 uv_b = clamp(vUv + offset_b / u_resolution, 0.0, 1.0);
    vec2 uv_c = clamp(vUv + offset_c / u_resolution, 0.0, 1.0);

    vec4 sample_a = sample_visual_panel(tDiffuse, uv_a);
    vec4 sample_b = sample_visual_panel(tDiffuse, uv_b);
    vec4 sample_c = sample_visual_panel(tDiffuse, uv_c);

    // Ink densities from luminance
    float luma_a = dot(sample_a.rgb, vec3(0.299, 0.587, 0.114));
    float luma_b = dot(sample_b.rgb, vec3(0.299, 0.587, 0.114));
    float luma_c = dot(sample_c.rgb, vec3(0.299, 0.587, 0.114));

    // Stencil grain perturbation
    float grain_a = (screen_noise(px + offset_a, 0.38) - 0.5) * u_grain;
    float grain_b = (screen_noise(px + offset_b, 1.15) - 0.5) * u_grain;
    float grain_c = (screen_noise(px + offset_c, 0.78) - 0.5) * u_grain;

    // Ink amounts with pressure gain
    float dens_a = clamp((1.0 - luma_a + grain_a) * u_ink_density, 0.0, 1.0);
    float dens_b = clamp((luma_b + grain_b) * u_ink_density * (1.0 - dens_a * 0.4), 0.0, 1.0);
    float dens_c = clamp((abs(luma_c - 0.5) * 2.0 + grain_c) * u_ink_density, 0.0, 1.0);

    vec3 ink_a, ink_b, ink_c;
    int drum_count;
    get_drum_inks(u_drum_palette, ink_a, ink_b, ink_c, drum_count);

    // Warm textured paper base
    float paper_noise = (hash21(px * 0.5) - 0.5) * 0.03;
    vec3 paper = vec3(u_paper_tone) * vec3(1.0, 0.985, 0.94) + paper_noise;

    // Subtractive ink transfer on paper (Beer-Lambert optical mixing)
    vec3 print_col = paper;
    print_col *= mix(vec3(1.0), ink_a, dens_a);
    print_col *= mix(vec3(1.0), ink_b, dens_b);
    if (drum_count > 2) {
        print_col *= mix(vec3(1.0), ink_c, dens_c * 0.8);
    }

    // Fluorescent ink luminescence / glow (active in highlights)
    float glow_strength = (u_glow + u_rGlow * 0.6);
    vec3 fluo_glow = ink_a * pow(dens_a, 2.0) * glow_strength * 0.6;
    print_col += fluo_glow;

    out_col = vec4(mix(src.rgb, print_col, clamp(u_intensity, 0.0, 1.0)), src.a);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(UV, col);
    COLOR = col;
}
