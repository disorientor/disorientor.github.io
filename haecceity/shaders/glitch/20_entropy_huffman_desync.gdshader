shader_type canvas_item;
#include "visual_panel_sampling.gdshaderinc"
uniform sampler2D tDiffuse : hint_screen_texture, filter_linear_mipmap;
uniform sampler2D tPrevFrame : hint_screen_texture, filter_linear_mipmap;
uniform vec2 u_resolution = vec2(1920.0, 1080.0);
uniform float u_time = 0.0;
/*
 * GLITCH SUITE - SHADER 20: ENTROPY HUFFMAN DESYNC & BITSTREAM LOSS
 * ------------------------------------------------------------------
 * Simulates bit-flip errors in compressed video bitstreams using variable-length
 * entropy coding (Huffman / CABAC / CAVLC):
 *   - When a bit flips in a variable-length stream, symbol boundaries are misidentified
 *   - Subsequent 8x8 DCT blocks suffer progressive run-length desynchronization
 *   - Horizontal scanline slices cascade with erroneous spatial offsets and zigzag drift
 *   - Re-synchronization markers (slice headers) periodically snap decoding back
 */






uniform float u_intensity = 1.0;        // Glitch intensity (default: 1.0)
uniform float u_slice_height = 36.0;     // Height of compressed slice bands (8.0 to 64.0 px)
uniform float u_bit_error_rate = 0.55;   // Frequency of corrupted slices (0.1 to 1.0)
uniform float u_zigzag_drift = 1.0;     // Zigzag DCT coefficient skew magnitude
uniform float u_chroma_desync = 1.0;    // Color component differential desync

float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 uv = vUv;
    float amount = clamp(u_intensity, 0.0, 1.0);
    float height = max(8.0, u_slice_height) / max(1.0, u_resolution.y);
    float row = floor(uv.y / height);
    float tick = floor(u_time * 5.0);
    float seed = hash(vec2(row, tick));
    float lost = step(1.0 - .65 * clamp(u_bit_error_rate, 0.0, 1.0) * amount, seed);
    // The code pointer fails partway through a slice, accumulates, then resets at the next header.
    float header = hash(vec2(row, tick + 3.0)) * .65;
    float run = smoothstep(header, header + .02, uv.x) * lost;
    float symbols = floor(max(0.0, uv.x - header) * 28.0);
    float slip = symbols * (seed - .5) * .008 * amount;
    float zig = sin(symbols * 1.7 + row) * .004 * u_zigzag_drift * amount;
    vec2 src = fract(uv + vec2((slip + zig) * run, height * (seed - .5) * run * amount));
    vec3 y = sample_visual_panel(tDiffuse, src).rgb;
    vec2 chromaOffset = vec2(.025 * u_chroma_desync * amount * run, 0.0);
    vec3 c = sample_visual_panel(tDiffuse, fract(src + chromaOffset)).rgb;
    float luma = dot(y, vec3(.299, .587, .114));
    float cl = dot(c, vec3(.299, .587, .114));
    vec3 col = vec3(luma) + (c - vec3(cl));
    float ring = sin(uv.x * u_resolution.x * .55) * length(y-c) * .15 * run;
    col += ring;
    float delimiter = (1.0 - smoothstep(0.0, 1.5 / max(1.0, u_resolution.y), mod(uv.y, height))) * run;
    col += vec3(.05, .13, .17) * delimiter * amount;
    out_col = vec4(mix(sample_visual_panel(tDiffuse, uv).rgb, clamp(col, 0.0, 1.0), amount), 1.0);
}

void fragment() {
    vec4 col;
    mainImage(UV, col);
    COLOR = col;
}
