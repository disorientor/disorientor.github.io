shader_type canvas_item;
#include "visual_panel_sampling.gdshaderinc"
#include "kinetic_moves.gdshaderinc"
uniform sampler2D tDiffuse : hint_screen_texture, filter_linear_mipmap;
uniform vec2 u_resolution = vec2(1920.0, 1080.0);
uniform float u_time = 0.0;
/*
 * GLITCH SUITE - SHADER 35: WOVEN TEXTILE & KILIM EMBROIDERY
 * ----------------------------------------------------------
 * Transforms the visual frame into a physical needlepoint tapestry of
 * cross-stitched 'X' yarn threads, woven linen backing, and Anatolian
 * geometric kilim motifs. Includes thread relief normals and wool sheen.
 */

uniform float u_intensity = 1.0;       // Blend of woven textile over source (default: 1.0)
uniform float u_yarn_size = 12.0;      // Pixel size of each cross-stitch cell (6.0 to 32.0, default: 12.0)
uniform float u_palette = 0.0;         // 0.0: Natural Wool / Madder / Indigo, 1.0: Neon Tapestry, 2.0: Earth Kilim
uniform float u_relief = 0.75;         // Normal depth & thread shadow intensity (default: 0.75)
uniform float u_border_kilim = 0.5;    // Stepped geometric kilim diamond border intensity (default: 0.5)
uniform float u_sheen = 0.40;          // Wool fiber specular sheen (default: 0.40)

float hash21(vec2 p) {
    p = fract(p * vec2(154.34, 765.21));
    p += dot(p, p + 23.45);
    return fract(p.x * p.y);
}

// Distance to an 'X' cross-stitch stroke pair inside [0,1]^2 cell
float stitch_x(vec2 p, out float thread_dir) {
    vec2 c = p - 0.5;
    // Diagonal 1: bottom-left to top-right
    float d1 = abs(c.x - c.y) * 0.7071;
    // Diagonal 2: top-left to bottom-right (over top)
    float d2 = abs(c.x + c.y) * 0.7071;

    // Boundary mask so threads end within cell
    float bound = max(abs(c.x), abs(c.y));
    float mask = smoothstep(0.48, 0.42, bound);

    // Diag 2 passes over Diag 1 with a subtle overlap shadow
    float w = 0.16;
    float s1 = smoothstep(w + 0.03, w - 0.03, d1);
    float s2 = smoothstep(w + 0.03, w - 0.03, d2);

    thread_dir = (s2 > s1 * 0.5) ? 1.0 : -1.0;
    float combined = max(s1 * 0.85, s2) * mask;
    return combined;
}

vec3 quantize_wool_palette(vec3 rgb, float palette_mode) {
    float luma = dot(rgb, vec3(0.299, 0.587, 0.114));
    if (palette_mode < 0.5) {
        // Natural Anatolian dyes: Ecru, Madder Red, Saffron, Indigo, Walnut Brown
        if (luma < 0.20) return vec3(0.12, 0.09, 0.08); // Walnut
        if (luma < 0.40) return vec3(0.15, 0.28, 0.48); // Indigo
        if (luma < 0.65) return vec3(0.68, 0.18, 0.14); // Madder Red
        if (luma < 0.85) return vec3(0.85, 0.62, 0.22); // Saffron
        return vec3(0.92, 0.89, 0.80);                  // Ecru Wool
    } else if (palette_mode < 1.5) {
        // Neon Electric Tapestry
        if (luma < 0.25) return vec3(0.04, 0.02, 0.10);
        if (luma < 0.50) return vec3(0.85, 0.05, 0.55); // Fluo Magenta
        if (luma < 0.75) return vec3(0.00, 0.85, 0.90); // Cyan
        return vec3(0.95, 0.95, 0.30);                  // Electric Lime
    }
    // Earth Kilim
    if (luma < 0.25) return vec3(0.18, 0.12, 0.10);
    if (luma < 0.50) return vec3(0.48, 0.26, 0.18); // Terracotta
    if (luma < 0.75) return vec3(0.72, 0.48, 0.28); // Raw Sienna
    return vec3(0.88, 0.82, 0.72);                  // Sand
}

void mainImage(vec2 vUv, out vec4 out_col) {
    float cell_size = max(u_yarn_size, 4.0);
    
    // Slight wave distortion across textile from bass (u_rSwell)
    vec2 wave_uv = vUv + vec2(sin(vUv.y * 12.0 + u_time * 2.0), cos(vUv.x * 12.0)) * u_rSwell * 0.004;
    vec2 px = wave_uv * u_resolution;
    vec2 cell = floor(px / cell_size);
    vec2 local = fract(px / cell_size);
    vec2 cell_uv = (cell + 0.5) * cell_size / u_resolution;

    vec4 src = sample_visual_panel(tDiffuse, clamp(cell_uv, 0.0, 1.0));
    vec3 yarn_col = quantize_wool_palette(src.rgb, u_palette);

    // Kilim geometric border motif
    if (u_border_kilim > 0.01) {
        vec2 k_coord = mod(cell, 8.0) - 4.0;
        float diamond = abs(k_coord.x) + abs(k_coord.y);
        if (diamond > 3.0 && diamond < 4.5) {
            yarn_col = mix(yarn_col, vec3(0.85, 0.22, 0.15), u_border_kilim * 0.65);
        }
    }

    // Cross-stitch thread shape & relief
    float thread_dir;
    float thread_mask = stitch_x(local, thread_dir);

    // Thread normal highlight & wool fiber texture
    float fiber_noise = (hash21(cell * 3.1 + local * 5.7) - 0.5) * 0.18;
    float relief_light = 0.5 + 0.5 * sin((local.x + local.y * thread_dir) * 25.0);
    float sheen = pow(relief_light, 3.0) * (u_sheen + u_rGlow * 0.4);

    vec3 thread_shaded = yarn_col * (0.75 + relief_light * 0.45 * u_relief) + sheen + fiber_noise;

    // Dark linen canvas backing visible between stitches
    vec3 backing_col = vec3(0.08, 0.06, 0.05) + hash21(px) * 0.02;

    vec3 result = mix(backing_col, thread_shaded, thread_mask);
    out_col = vec4(mix(src.rgb, result, clamp(u_intensity, 0.0, 1.0)), src.a);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(UV, col);
    COLOR = col;
}
