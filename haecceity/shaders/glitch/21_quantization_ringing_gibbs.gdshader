shader_type canvas_item;
#include "visual_panel_sampling.gdshaderinc"
uniform sampler2D tDiffuse : hint_screen_texture, filter_linear_mipmap;
uniform sampler2D tPrevFrame : hint_screen_texture, filter_linear_mipmap;
uniform vec2 u_resolution = vec2(1920.0, 1080.0);
uniform float u_time = 0.0;
/*
 * GLITCH SUITE - SHADER 21: QUANTIZATION RINGING & GIBBS PHENOMENON
 * ------------------------------------------------------------------
 * Simulates severe JPEG/MPEG transform coefficient quantization:
 *   - Truncation of high-frequency DCT basis functions produces the Gibbs phenomenon:
 *     under-damped sinusoidal overshoot and ringing ripples flanking high-contrast edges.
 *   - Discrete 8x8 pixel transform block boundary seams and luminance stepping.
 *   - False contouring / color banding in smooth gradients due to coarse quantization steps.
 */






uniform float u_intensity = 1.0;        // Glitch intensity (default: 1.0)
uniform float u_block_size = 8.0;       // Quantization block size (default: 8.0, range: 4.0 to 32.0)
uniform float u_ringing_freq = 22.5;     // Gibbs oscillation spatial frequency (5.0 to 40.0)
uniform float u_ringing_decay = 5.5;    // Ripple damping decay rate (1.0 to 10.0)
uniform float u_quant_steps = 18.0;      // Number of discrete color quantization levels (4.0 to 32.0)



float getLuma(vec3 c) {
    return dot(c, vec3(0.299, 0.587, 0.114));
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 uv = vUv;
    float bSize = max(4.0, u_block_size);
    vec2 pxCoord = uv * u_resolution;
    vec2 blockCoord = floor(pxCoord / bSize);
    vec2 inBlock = fract(pxCoord / bSize);

    // Sample central pixel
    vec3 col = sample_visual_panel(tDiffuse, uv).rgb;

    // Edge gradient detection via multi-directional sampling
    vec2 stepUv = 2.0 / u_resolution;
    float lC = getLuma(col);
    float lR = getLuma(sample_visual_panel(tDiffuse, uv + vec2(stepUv.x, 0.0)).rgb);
    float lL = getLuma(sample_visual_panel(tDiffuse, uv - vec2(stepUv.x, 0.0)).rgb);
    float lU = getLuma(sample_visual_panel(tDiffuse, uv + vec2(0.0, stepUv.y)).rgb);
    float lD = getLuma(sample_visual_panel(tDiffuse, uv - vec2(0.0, stepUv.y)).rgb);

    vec2 grad = vec2(lR - lL, lU - lD);
    float gradMag = length(grad);

    // Synthesize Gibbs Phenomenon Oscillations
    // Gibbs overshoot is proportional to jump discontinuity amplitude:
    // f_N(x) ~ sign(x) * (2/pi) * Si(N * pi * x)
    float distToEdge = min(length(inBlock - 0.5) * bSize, 4.0);
    float gibbsWave = sin(distToEdge * u_ringing_freq * 3.14159) * exp(-distToEdge * u_ringing_decay * 0.3);
    float ringingArtifact = gibbsWave * gradMag * 3.5 * u_intensity;

    // Add Gibbs overshoot/undershoot to color channels
    col += vec3(ringingArtifact);

    // Discrete 8x8 Transform Block Boundary Seams (Blockiness)
    vec2 distToBlockEdge = abs(inBlock - 0.5) * 2.0;
    float blockEdge = smoothstep(0.92, 1.0, max(distToBlockEdge.x, distToBlockEdge.y));
    col = mix(col, col * 0.82 + vec3(0.04), blockEdge * 0.7 * u_intensity);

    // Coarse Transform Coefficient Quantization (Color Posterization / Banding)
    float steps = max(2.0, u_quant_steps);
    col = floor(col * steps + 0.5) / steps;

    // High-frequency diagonal checkerboard artifact from isolated AC coefficient discard
    float acChecker = (mod(floor(pxCoord.x) + floor(pxCoord.y), 2.0) - 0.5) * 2.0;
    col += vec3(acChecker * gradMag * 0.08 * u_intensity);

    out_col = vec4(clamp(col, 0.0, 1.0), 1.0);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(UV, col);
    COLOR = col;
}
