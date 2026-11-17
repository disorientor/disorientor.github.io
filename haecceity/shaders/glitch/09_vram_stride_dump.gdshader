shader_type canvas_item;
#include "visual_panel_sampling.gdshaderinc"
uniform sampler2D tDiffuse : hint_screen_texture, filter_linear_mipmap;
uniform sampler2D tPrevFrame : hint_screen_texture, filter_linear_mipmap;
uniform vec2 u_resolution = vec2(1920.0, 1080.0);
uniform float u_time = 0.0;
/*
 * GLITCH SUITE - SHADER 09: VRAM STRIDE MISALIGNMENT & MEMORY BUFFER DUMP
 * ------------------------------------------------------------------------
 * Simulates graphics GPU video memory (VRAM) corruption, DMA buffer leaks,
 * and pitch/stride misalignment errors.
 * When row stride is miscalculated, raster lines shear diagonally into parallel
 * slanted zebra bands. Incorporates unmapped video memory leaks, raw hexadecimal
 * ASCII memory noise bars, and address bus wrapping.
 */






uniform float u_intensity = 1.0;       // Memory corruption severity (default: 1.0)
uniform float u_stride_skew = 0.15;     // Row pitch offset angle (default: 0.15)
uniform float u_leak_prob = 1.0;       // Probability of memory buffer bleed slices
uniform float u_noise_blend = 1.0;     // Intensity of raw memory hex noise

float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 uv = vUv;
    vec2 res = max(u_resolution, vec2(1.0));
    float amount = clamp(u_intensity, 0.0, 1.0);
    vec2 px = floor(uv * res);
    float tick = floor(u_time * 5.0);
    float bank = floor(px.y / 24.0);
    float leaked = step(1.0 - .3 * clamp(u_leak_prob, 0.0, 1.0) * amount, hash(vec2(bank, tick)));
    // Linear address, incorrect pitch, then decode back to x/y: zero skew is identity.
    float pitchError = floor(u_stride_skew * 110.0 * amount * (.65 + .35 * sin(u_time * .4)));
    float address = px.y * (res.x + pitchError) + px.x;
    address += leaked * floor((hash(vec2(bank, tick + 9.0)) - .5) * res.x * 32.0);
    address = mod(address, res.x * res.y);
    vec2 src = (vec2(mod(address, res.x), floor(address / res.x)) + .5) / res;
    vec3 col = sample_visual_panel(tDiffuse, src).rgb;
    vec3 bytes = sample_visual_panel(tDiffuse, fract(src + vec2(3.0 / res.x, 0.0))).brg;
    float bus = step(.84, hash(vec2(floor(px.x / 96.0), bank + tick)));
    col = mix(col, bytes, leaked * bus * .65);
    float bit = step(.75, hash(vec2(floor(px.x / 3.0), px.y + tick)));
    col += leaked * bit * clamp(u_noise_blend, 0.0, 1.0) * .16 * vec3(.3, .8, 1.0);
    out_col = vec4(mix(sample_visual_panel(tDiffuse, uv).rgb, clamp(col, 0.0, 1.0), amount), 1.0);
}

void fragment() {
    vec4 col;
    mainImage(UV, col);
    COLOR = col;
}
