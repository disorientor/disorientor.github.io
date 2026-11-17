shader_type canvas_item;
#include "visual_panel_sampling.gdshaderinc"
#include "kinetic_moves.gdshaderinc"
uniform sampler2D tDiffuse : hint_screen_texture, filter_linear_mipmap;
uniform vec2 u_resolution = vec2(1920.0, 1080.0);
uniform float u_time = 0.0;
/*
 * GLITCH SUITE - SHADER 33: HALFTONE & HATCHING
 * ---------------------------------------------
 * Print-process look. Mode 0: classic CMYK rotated halftone dots on paper.
 * Mode 1: golden single-ink halftone. Mode 2: crosshatch where line density
 * and layer count follow luminance. Dot radius is the audio-reactive handle.
 */

uniform float u_intensity = 1.0;       // Blend of print render over source (default: 1.0)
uniform float u_dot_size = 9.0;        // Halftone cell / hatch spacing in pixels (4.0 to 30.0, default: 9.0)
uniform float u_mode = 0.0;            // 0.0: CMYK dots, 1.0: Golden single ink, 2.0: Crosshatch
uniform float u_dot_gain = 1.0;        // Dot radius scale, bass-reactive (default: 1.0)
uniform float u_paper = 0.85;          // Paper brightness, 0 = black stock (default: 0.85)
uniform float u_misregister = 0.25;    // Plate offset between inks (default: 0.25)
uniform float u_line_width = 0.5;      // Hatch line thickness (default: 0.5)

mat2 rot(float a) {
    float s = sin(a), c = cos(a);
    return mat2(vec2(c, -s), vec2(s, c));
}

// Coverage [0,1] of a dot screen of given angle for ink amount `amt`.
float dot_screen(vec2 px, float angle, float amt) {
    vec2 p = rot(angle) * px / u_dot_size;
    vec2 f = fract(p) - 0.5;
    float effective_gain = u_dot_gain * (1.0 + u_rPulse * 0.45);
    float r = sqrt(clamp(amt, 0.0, 1.0)) * 0.7071 * effective_gain;
    float aa = 1.2 / u_dot_size;
    return smoothstep(r + aa, r - aa, length(f));
}

float hatch_layer(vec2 px, float angle, float darkness, float threshold) {
    vec2 p = rot(angle) * px / u_dot_size;
    float line = abs(fract(p.y) - 0.5);
    float on = step(threshold, darkness);
    float w = u_line_width * 0.5 * clamp(darkness * 1.5, 0.3, 1.0);
    return on * smoothstep(w + 0.04, w - 0.04, 0.5 - line);
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 px = vUv * u_resolution;
    vec4 src = sample_visual_panel(tDiffuse, vUv);
    vec3 rgb = clamp(src.rgb, 0.0, 1.0);
    vec3 paper_col = vec3(u_paper) * vec3(1.0, 0.98, 0.93);
    vec3 result;

    if (u_mode < 0.5) {
        // RGB -> CMYK
        float k = 1.0 - max(rgb.r, max(rgb.g, rgb.b));
        float inv = 1.0 / max(1.0 - k, 0.001);
        vec3 cmy = (1.0 - rgb - k) * inv;
        vec2 off = vec2(u_misregister + u_rSwell * 0.25) * u_dot_size * 0.3;
        float c = dot_screen(px + off * vec2(1.0, 0.0), radians(15.0), cmy.x);
        float m = dot_screen(px + off * vec2(-0.5, 0.8), radians(75.0), cmy.y);
        float y = dot_screen(px + off * vec2(0.3, -0.9), radians(0.0), cmy.z);
        float kk = dot_screen(px, radians(45.0), k);
        // Subtractive mix on paper
        result = paper_col;
        result *= mix(vec3(1.0), vec3(0.0, 0.62, 0.88), c);
        result *= mix(vec3(1.0), vec3(0.93, 0.0, 0.55), m);
        result *= mix(vec3(1.0), vec3(1.0, 0.92, 0.0), y);
        result *= mix(vec3(1.0), vec3(0.08, 0.07, 0.10), kk);
    } else if (u_mode < 1.5) {
        // Golden halftone: single warm ink, 45 degree screen, on dark stock
        float luma = dot(rgb, vec3(0.299, 0.587, 0.114));
        float d = dot_screen(px, radians(45.0), luma);
        vec3 gold = vec3(1.0, 0.78, 0.28);
        vec3 bg = vec3(0.04, 0.025, 0.01);
        result = mix(bg, gold * (0.7 + 0.5 * luma), d);
    } else {
        // Crosshatch: more layers as darkness rises
        float luma = dot(rgb, vec3(0.299, 0.587, 0.114));
        float dark = 1.0 - luma;
        float h = 0.0;
        h = max(h, hatch_layer(px, radians(45.0), dark, 0.20));
        h = max(h, hatch_layer(px, radians(-45.0), dark, 0.40));
        h = max(h, hatch_layer(px, radians(0.0), dark, 0.60));
        h = max(h, hatch_layer(px, radians(90.0), dark, 0.80));
        vec3 ink = vec3(0.07, 0.06, 0.10);
        result = mix(paper_col, ink, h);
    }

    out_col = vec4(mix(src.rgb, result, clamp(u_intensity, 0.0, 1.0)), src.a);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(UV, col);
    COLOR = col;
}
