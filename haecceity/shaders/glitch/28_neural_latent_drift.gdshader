shader_type canvas_item;
#include "visual_panel_sampling.gdshaderinc"
uniform sampler2D tDiffuse : hint_screen_texture, filter_linear_mipmap;
uniform sampler2D tPrevFrame : hint_screen_texture, filter_linear_mipmap;
uniform vec2 u_resolution = vec2(1920.0, 1080.0);
uniform float u_time = 0.0;
/*
 * GLITCH SUITE - SHADER 28: NEURAL LATENT SPACE DRIFT & VQ-VAE FRACTURE
 * ----------------------------------------------------------------------
 * Emulates the surreal visual artifacts of deep neural generative models (VAE/Diffusion):
 *   - Latent Vector Drift: The embedding representation drifts along non-linear manifolds,
 *     causing dreamlike hallucinated textures, biological eyes/mouth contours, and morphing.
 *   - Vector Quantization (VQ) Codebook Snapping: Discrete codebook indices fail to resolve,
 *     locking spatial patches into repetitive synthetic semantic patterns.
 *   - High-Frequency Spectral Bleed: Latent unpooling upsampling checkerboard artifacts.
 */






uniform float u_intensity = 1.0;        // Glitch intensity (default: 1.0)
uniform float u_drift_rate = 1.55;       // Manifold drift speed (0.1 to 3.0)
uniform float u_codebook_size = 36.0;    // Discrete codebook resolution (8.0 to 64.0)
uniform float u_hallucination = 1.0;    // Deep feature hallucination blend weight



float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

// 2D Simplex / Perlin-style noise for smooth latent manifold geometry
vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453);
}

float perlinNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(dot(hash2(i + vec2(0.0, 0.0)) - 0.5, f - vec2(0.0, 0.0)),
            dot(hash2(i + vec2(1.0, 0.0)) - 0.5, f - vec2(1.0, 0.0)), u.x),
        mix(dot(hash2(i + vec2(0.0, 1.0)) - 0.5, f - vec2(0.0, 1.0)),
            dot(hash2(i + vec2(1.0, 1.0)) - 0.5, f - vec2(1.0, 1.0)), u.x), u.y
    );
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 uv = vUv;
    float timeScaled = u_time * u_drift_rate;

    // 1. Latent Manifold Warping (Smooth high-dimensional vector field)
    vec2 latentFlow = vec2(
        perlinNoise(uv * 4.0 + vec2(timeScaled * 0.2, 0.0)),
        perlinNoise(uv * 4.0 + vec2(0.0, timeScaled * 0.2 + 10.0))
    );
    vec2 driftedUv = uv + latentFlow * (0.08 * u_intensity);

    // 2. Vector Quantization (VQ) Codebook Grid Snapping
    float codebookGrid = max(4.0, u_codebook_size);
    vec2 vqCoord = floor(driftedUv * codebookGrid) / codebookGrid;
    vec2 snappedUv = mix(driftedUv, vqCoord, 0.45 * u_intensity);

    // 3. Sample Latent-Reconstructed Color
    vec3 col = sample_visual_panel(tDiffuse, clamp(snappedUv, 0.0, 1.0)).rgb;

    // 4. Hallucinated Feature Synthesis (Deep Dream-style pareidolia ripples)
    float featureWave = sin(length(driftedUv - 0.5) * 40.0 + perlinNoise(driftedUv * 8.0) * 8.0 - timeScaled);
    float eyeRing = smoothstep(0.4, 0.0, abs(featureWave)) * perlinNoise(driftedUv * 16.0);
    
    vec3 dreamHue = 0.5 + 0.5 * cos(timeScaled * 0.5 + vec3(0.0, 2.0, 4.0) + featureWave * 2.0);
    col = mix(col, col * dreamHue * 1.5, u_hallucination * abs(eyeRing) * u_intensity);

    // 5. Deconvolution / Latent Upsampling Checkerboard Artifacts
    // (Odena et al. "Deconvolution and Checkerboard Artifacts")
    vec2 px = floor(uv * u_resolution);
    float checker = mod(px.x + px.y, 2.0);
    col += (checker - 0.5) * 0.06 * u_intensity;

    out_col = vec4(clamp(col, 0.0, 1.0), 1.0);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(UV, col);
    COLOR = col;
}
