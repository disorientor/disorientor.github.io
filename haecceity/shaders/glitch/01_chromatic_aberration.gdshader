shader_type canvas_item;
#include "visual_panel_sampling.gdshaderinc"
uniform sampler2D tDiffuse : hint_screen_texture, filter_linear_mipmap;
uniform sampler2D tPrevFrame : hint_screen_texture, filter_linear_mipmap;
uniform vec2 u_resolution = vec2(1920.0, 1080.0);
uniform float u_time = 0.0;
/*
 * GLITCH SUITE - SHADER 01: CHROMATIC ABERRATION (SPECTRAL PRISM DISPERSION)
 * --------------------------------------------------------------------------
 * Simulates radial and directional chromatic dispersion caused by optical lens
 * refraction anomalies, prism splitting, and sensor misalignment.
 * Supports multi-tap spectral sampling (6 chromatic sample bands) for continuous
 * rainbow fringing rather than cheap 2-tap red/cyan separation.
 */






uniform float u_intensity = 1.0;       // Overall aberration magnitude (default: 1.0)
uniform float u_direction_mode = 0.0;  // 0.0 = Radial (lens edges), 1.0 = Directional (linear angle), 2.0 = Chaos/Noise
uniform float u_angle = 0.0;           // Angle in radians for directional mode (default: 0.0)
uniform float u_spectral_taps = 6.0;   // Number of spectral samples: 3.0 (RGB) or 6.0 (smooth rainbow)
uniform float u_jitter = 1.0;          // Dynamic time jitter factor



// Pseudo-random noise generator
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

// Spectral wavelength color weight approximation (Cauchy dispersion)
vec3 spectrum(float t) {
    // Maps t in [0, 1] to smooth RGB spectral hues
    float r = clamp(abs(t * 6.0 - 3.0) - 1.0, 0.0, 1.0);
    float g = clamp(2.0 - abs(t * 6.0 - 2.0), 0.0, 1.0);
    float b = clamp(2.0 - abs(t * 6.0 - 4.0), 0.0, 1.0);
    return vec3(r, g, b);
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 uv = vUv;
    vec2 center = vec2(0.5);
    vec2 toCenter = uv - center;
    float dist = length(toCenter);

    // Dynamic micro-jitter
    float jitter = (hash(vec2(u_time * 15.0, uv.y * 100.0)) - 0.5) * u_jitter * 0.01;
    
    // Determine displacement direction vector
    vec2 dir;
    if (u_direction_mode < 0.5) {
        // Mode 0: Radial dispersion (strongest at screen edges, barrel profile)
        dir = normalize(toCenter + vec2(1e-5)) * pow(dist, 1.5);
    } else if (u_direction_mode < 1.5) {
        // Mode 1: Directional / linear displacement
        dir = vec2(cos(u_angle), sin(u_angle));
    } else {
        // Mode 2: Chaotic directional noise field
        float nAngle = hash(floor(uv * 12.0) + floor(u_time * 8.0)) * 6.28318;
        dir = vec2(cos(nAngle), sin(nAngle));
    }

    vec2 maxOffset = dir * (0.04 * u_intensity + jitter);

    vec3 finalColor = vec3(0.0);
    float totalWeight = 0.0;

    if (u_spectral_taps > 4.0) {
        // 6-Tap continuous spectral dispersion
        int SAMPLES = 6;
        for (int i = 0; i < SAMPLES; i++) {
            float t = float(i) / float(SAMPLES - 1);
            vec2 sampleUv = uv + maxOffset * (t - 0.5);
            vec3 sColor = sample_visual_panel(tDiffuse, clamp(sampleUv, 0.0, 1.0)).rgb;
            vec3 sWeight = spectrum(t);
            finalColor += sColor * sWeight;
            totalWeight += (sWeight.r + sWeight.g + sWeight.b) / 3.0;
        }
        finalColor /= totalWeight;
    } else {
        // Classic 3-Tap RGB separation
        vec2 rUv = clamp(uv + maxOffset, 0.0, 1.0);
        vec2 gUv = clamp(uv, 0.0, 1.0);
        vec2 bUv = clamp(uv - maxOffset, 0.0, 1.0);

        float r = sample_visual_panel(tDiffuse, rUv).r;
        float g = sample_visual_panel(tDiffuse, gUv).g;
        float b = sample_visual_panel(tDiffuse, bUv).b;
        finalColor = vec3(r, g, b);
    }

    out_col = vec4(finalColor, 1.0);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(UV, col);
    COLOR = col;
}
