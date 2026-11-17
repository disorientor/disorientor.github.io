shader_type canvas_item;
#include "visual_panel_sampling.gdshaderinc"
uniform sampler2D tDiffuse : hint_screen_texture, filter_linear_mipmap;
uniform sampler2D tPrevFrame : hint_screen_texture, filter_linear_mipmap;
uniform vec2 u_resolution = vec2(1920.0, 1080.0);
uniform float u_time = 0.0;
/*
 * GLITCH SUITE - SHADER 02: DATAMOSH & MOTION VECTOR SMEAR
 * --------------------------------------------------------
 * Replicates video compression failure caused by dropped I-frames (keyframes).
 * Motion vectors from predictive P-frames propagate across macroblocks without
 * keyframe reset, creating iconic sticky pixel trails, block displacement melting,
 * quantization clamping, and color vector bleed.
 */




   // Optional previous frame feedback texture


uniform float u_intensity = 1.0;      // Glitch intensity & vector displacement scale (default: 1.0)
uniform float u_block_size = 16.0;     // Macroblock pixel dimension (e.g. 16.0 or 32.0)
uniform float u_hold_time = 1.0;      // Periodic keyframe drop duration
uniform float u_flow_direction = 1.0; // Dominant flow angle or -1.0 for chaotic flow



// Hash functions for pseudo-random block motion vectors
float hash12(vec2 p) {
    p = fract(p * vec2(443.897, 441.423));
    p += dot(p, p.yx + 19.19);
    return fract((p.x + p.y) * p.x);
}

vec2 hash22(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(443.897, 441.423, 437.195));
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.xx + p3.yz) * p3.zy);
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 uv = vUv;
    vec2 res = u_resolution;
    float blockSize = max(4.0, u_block_size);

    // Discrete macroblock coordinates
    vec2 blockCoord = floor(uv * res / blockSize);
    vec2 blockUv = (blockCoord * blockSize) / res;

    // Time cycle: keyframe burst followed by prolonged datamosh freeze
    float cycle = mod(u_time * 0.7, 4.0);
    float isMoshActive = step(1.0, cycle); // Keyframe resets when cycle < 1.0

    // Compute pseudo-motion vector for this macroblock
    vec2 blockSeed = blockCoord + floor(u_time * 2.0) * 0.17;
    vec2 motionVec = (hash22(blockSeed) - 0.5) * 2.0;

    // Apply directional bias if specified
    if (u_flow_direction >= 0.0) {
        vec2 dirBias = vec2(cos(u_flow_direction), sin(u_flow_direction));
        motionVec = mix(motionVec, dirBias, 0.65);
    }

    // Edge-aware vector magnitude: sample current block luminance gradient
    vec3 colCenter = sample_visual_panel(tDiffuse, blockUv).rgb;
    vec3 colRight  = sample_visual_panel(tDiffuse, blockUv + vec2(blockSize / res.x, 0.0)).rgb;
    vec3 colUp     = sample_visual_panel(tDiffuse, blockUv + vec2(0.0, blockSize / res.y)).rgb;
    float edgeMag  = length(colCenter - colRight) + length(colCenter - colUp);

    // Blocks with high detail smear more aggressively
    float moshFactor = smoothstep(0.05, 0.4, edgeMag) * u_intensity * isMoshActive;

    // Accumulated displacement vector
    vec2 moshedUv = uv + motionVec * (0.05 * moshFactor);

    // Discrete macroblock quantization of coordinates
    vec2 quantUv = floor(moshedUv * res / blockSize) * blockSize / res;
    vec2 finalUv = mix(moshedUv, quantUv, 0.45 * u_intensity);

    // Sample distorted video frame
    vec4 moshedCol = sample_visual_panel(tDiffuse, clamp(finalUv, 0.0, 1.0));

    // Color quantization & YUV compression artifact simulation
    // Low frequency color block smudge
    vec3 blockCol = sample_visual_panel(tDiffuse, clamp(blockUv + motionVec * 0.02 * u_intensity, 0.0, 1.0)).rgb;
    vec3 resultCol = mix(moshedCol.rgb, blockCol, 0.3 * isMoshActive);

    // Chroma sub-sampling stain (green/magenta YCbCr quantization errors)
    float chromaError = hash12(blockCoord + floor(u_time * 3.0));
    if (chromaError > 0.88 && isMoshActive > 0.5 && u_intensity > 0.4) {
        resultCol.g *= 1.35;
        resultCol.rb *= 0.75;
    }

    out_col = vec4(resultCol, moshedCol.a);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(UV, col);
    COLOR = col;
}
