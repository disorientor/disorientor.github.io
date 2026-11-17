shader_type canvas_item;
#include "visual_panel_sampling.gdshaderinc"
uniform sampler2D tDiffuse : hint_screen_texture, filter_linear_mipmap;
uniform sampler2D tPrevFrame : hint_screen_texture, filter_linear_mipmap;
uniform vec2 u_resolution = vec2(1920.0, 1080.0);
uniform float u_time = 0.0;
/*
 * GLITCH SUITE - SHADER 04: MACROBLOCK SCRAMBLE & TILE MATRIX TEAR
 * -----------------------------------------------------------------
 * Simulates video streaming packet loss, damaged DCT/IDCT transform matrices,
 * and cellular tile decoding failure (JPEG/MPEG macroblock corruption).
 * Discrete NxN blocks are displaced, swapped, inverted, or replaced with
 * corrupted memory slices and cybernetic matrix rune patterns.
 */






uniform float u_intensity = 1.0;        // Glitch severity and corruption probability (default: 1.0)
uniform float u_block_dimension = 32.0;  // Base macroblock pixel size (default: 32.0)
uniform float u_scramble_speed = 8.0;   // Frequency of tile re-shuffling (default: 8.0)
uniform float u_corrupt_threshold = 0.5;// Threshold for block damage (0.0 to 1.0)
uniform float u_invert_prob = 1.0;      // Probability of color inversion in corrupted blocks

float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 uv = vUv;
    float amount = clamp(u_intensity, 0.0, 1.0);
    float tick = floor(u_time * max(.1, u_scramble_speed));
    vec2 pixel = uv * u_resolution;
    // Long codec runs contain differently sized transform blocks, rather than a uniform tile overlay.
    float row = floor(pixel.y / max(8.0, u_block_dimension * .5));
    float run = mix(2.0, 9.0, hash(vec2(row, floor(tick * .25))));
    vec2 blockSize = vec2(max(8.0, u_block_dimension) * run, max(8.0, u_block_dimension * .5));
    vec2 cell = floor(pixel / blockSize);
    float seed = hash(cell + vec2(tick, row));
    float damage = step(1.0 - .55 * clamp(u_corrupt_threshold, 0.0, 1.0) * amount, seed);
    vec2 src = uv;
    float slip = (hash(cell + tick + 7.3) - .5) * .38 * amount;
    src.x = fract(src.x + damage * slip);
    // A held chroma plane stretches only a narrow part of a lost packet.
    float hold = step(.72, hash(cell + tick + 18.0)) * damage;
    src.y = mix(src.y, (cell.y + .5) * blockSize.y / u_resolution.y, hold * .85);
    vec3 original = sample_visual_panel(tDiffuse, uv).rgb;
    vec3 col = sample_visual_panel(tDiffuse, src).rgb;
    vec3 chroma = sample_visual_panel(tDiffuse, fract(src + vec2(slip * .22, 0.0))).rgb;
    col = mix(col, vec3(chroma.r, col.g, chroma.b), damage * .65);
    vec3 quantized = floor(col * 15.0 + .5) / 15.0;
    col = mix(col, quantized, damage * .55);
    float invert = step(.96, hash(cell + tick + 44.0)) * damage * clamp(u_invert_prob, 0.0, 1.0);
    col = mix(col, 1.0 - col, invert * .6);
    // Thin DCT ringing follows image contrast; no painted square borders or runes.
    float edge = length(col - sample_visual_panel(tDiffuse, fract(src + vec2(2.0 / u_resolution.x, 0.0))).rgb);
    col += vec3(.10, .24, .28) * sin(pixel.x * .7) * edge * damage;
    out_col = vec4(mix(original, clamp(col, 0.0, 1.0), amount), 1.0);
}

void fragment() {
    vec4 col;
    mainImage(UV, col);
    COLOR = col;
}
