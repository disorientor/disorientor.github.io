shader_type canvas_item;
#include "visual_panel_sampling.gdshaderinc"
uniform sampler2D tDiffuse : hint_screen_texture, filter_linear_mipmap;
uniform sampler2D tPrevFrame : hint_screen_texture, filter_linear_mipmap;
uniform vec2 u_resolution = vec2(1920.0, 1080.0);
uniform float u_time = 0.0;
/*
 * GLITCH SUITE - SHADER 26: IEEE 754 DENORMAL FLOAT & NAN POISONING
 * ------------------------------------------------------------------
 * Simulates low-level GPU floating-point register corruption and ALU exceptions:
 *   - NaN (Not a Number) Contagion: Invalid arithmetic operations (0/0, sqrt(-1))
 *     propagating as expanding caustic poison patches across neighboring fragments.
 *   - Denormalized Number Flush-to-Zero (DAZ/FTZ): Sudden catastrophic dropouts
 *     in low-luminance values when exponents underflow into subnormal territory.
 *   - Floating-Point Sign-Bit Inversion: Bitwise flips in IEEE 754 float32 sign bits
 *     causing harsh inverted luminance islands.
 */






uniform float u_intensity = 1.0;        // Glitch intensity (default: 1.0)
uniform float u_nan_spread = 0.55;       // NaN infection contagion radius (0.1 to 1.0)
uniform float u_ftz_threshold = 0.13;    // Flush-to-zero luminance threshold (0.01 to 0.25)
uniform float u_bit_flip_prob = 0.205;    // Probability of float sign-bit inversion (0.01 to 0.4)

float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 uv = vUv;
    float amount = clamp(u_intensity, 0.0, 1.0);
    vec3 base = sample_visual_panel(tDiffuse, uv).rgb;
    vec2 p = (uv - .5) * vec2(u_resolution.x / max(u_resolution.y, 1.0), 1.0);
    // Smooth exponent domains break into stepped mantissa contours; all math stays finite.
    float field = sin(p.x * 7.0 + u_time * .43) + sin(p.y * 9.0 - u_time * .37) + .5 * sin((p.x+p.y)*17.0);
    float infected = smoothstep(1.9 - clamp(u_nan_spread, 0.0, 1.0) * 1.9, 2.25, field);
    vec2 src = clamp(uv + vec2(sin(field * 7.0), cos(field * 9.0)) * infected * amount * .035, 0.0, 1.0);
    vec3 col = sample_visual_panel(tDiffuse, src).rgb;
    float threshold = max(.00001, u_ftz_threshold * amount);
    col *= smoothstep(vec3(threshold * .6), vec3(threshold), col);
    vec3 exponent = exp2(floor(log2(max(col, vec3(.00001)))));
    col = mix(col, exponent, infected * amount * .6);
    float signDomain = sin(field * 8.0 + sin(p.x * 31.0));
    float flipped = smoothstep(1.0 - 2.0 * clamp(u_bit_flip_prob, 0.0, 1.0), 1.0, signDomain) * infected;
    col = mix(col, abs(vec3(.85) - col), flipped * amount * .65);
    float contour = pow(.5 + .5 * cos(field * 48.0), 22.0);
    col += vec3(.38, .07, .32) * infected * contour * amount * .55;
    out_col = vec4(mix(base, clamp(col, 0.0, 1.0), amount), 1.0);
}

void fragment() {
    vec4 col;
    mainImage(UV, col);
    COLOR = col;
}
