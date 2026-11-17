shader_type canvas_item;
#include "visual_panel_sampling.gdshaderinc"
uniform sampler2D tDiffuse : hint_screen_texture, filter_linear_mipmap;
uniform sampler2D tPrevFrame : hint_screen_texture, filter_linear_mipmap;
uniform vec2 u_resolution = vec2(1920.0, 1080.0);
uniform float u_time = 0.0;
/*
 * GLITCH SUITE - SHADER 08: NTSC COMPOSITE SIGNAL & YIQ CHROMA BLEED
 * ------------------------------------------------------------------
 * Simulates analog NTSC/PAL composite video signal decoding anomalies:
 * - Color space conversion from RGB to YIQ (Luma Y, In-phase I, Quadrature Q)
 * - Severe horizontal low-pass bandwidth choking on I and Q chroma channels,
 *   causing iconic horizontal color bleeding and smearing across sharp edges
 * - 3.58 MHz color subcarrier phase drift (hue rotation & tint instability)
 * - Luma-chroma crosstalk (cross-color rainbow fringes on high-frequency details)
 * - Composite ringing & notch filter ghosting
 */






uniform float u_intensity = 1.0;        // Glitch severity & chroma bleed distance (default: 1.0)
uniform float u_phase_jitter = 1.0;     // Subcarrier phase noise (hue instability)
uniform float u_cross_color = 1.0;      // Luma-to-chroma crosstalk strength (rainbow fringing)
uniform float u_ring_samples = 8.0;     // Horizontal blur radius for chroma channels (default: 8.0)



// RGB to YIQ Color Space Conversion Matrix (NTSC Standard 1953)
const mat3 RGB_TO_YIQ = mat3(vec3(0.299, 0.587, 0.114), vec3(0.596, -0.274, -0.322), vec3(0.211, -0.523, 0.312
));

// YIQ to RGB Inverse Matrix
const mat3 YIQ_TO_RGB = mat3(vec3(1.0, 0.956, 0.621), vec3(1.0, -0.272, -0.647), vec3(1.0, -1.106, 1.703
));

float hash11(float p) {
    p = fract(p * 0.1031);
    p *= p + 33.33;
    return fract(p * p);
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 uv = vUv;
    float pixelX = 1.0 / max(u_resolution.x, 1.0);

    // 1. Color Subcarrier Phase Jitter (Hue oscillation along horizontal scanlines)
    float scanlineY = floor(uv.y * u_resolution.y);
    float phaseNoise = (hash11(scanlineY + floor(u_time * 24.0)) - 0.5) * u_phase_jitter * 0.3 * u_intensity;
    float phaseAngle = (sin(u_time * 2.0 + uv.y * 10.0) * 0.15 + phaseNoise);

    // Rotation matrix for I and Q chroma channels
    mat2 chromaRotate = mat2(vec2(cos(phaseAngle), -sin(phaseAngle)), vec2(sin(phaseAngle), cos(phaseAngle)
    ));

    // 2. High-Resolution Luma (Y) Sample
    vec3 centerRgb = sample_visual_panel(tDiffuse, uv).rgb;
    vec3 centerYiq = RGB_TO_YIQ * centerRgb;
    float lumaY = centerYiq.x;

    // 3. Low-Pass Chroma Filtering (Horizontal bleeding of I and Q)
    // In NTSC, Q bandwidth is restricted to ~400kHz and I to ~1.3MHz
    vec2 chromaIQ = vec2(0.0);
    float chromaWeights = 0.0;
    float bleedSpread = (14.0 * u_intensity + 2.0) * pixelX * (u_ring_samples / 8.0);

    for (int i = -8; i <= 8; i++) {
        float fi = float(i);
        // Non-symmetric filter simulating low-pass delay line
        float sampleX = uv.x + fi * bleedSpread * 0.125;
        vec3 tapRgb = sample_visual_panel(tDiffuse, vec2(clamp(sampleX, 0.0, 1.0), uv.y)).rgb;
        vec3 tapYiq = RGB_TO_YIQ * tapRgb;

        // Gaussian decaying weight
        float weight = exp(-0.5 * (fi * fi) / 8.0);
        chromaIQ += tapYiq.yz * weight;
        chromaWeights += weight;
    }
    chromaIQ /= max(chromaWeights, 0.0001);

    // Apply subcarrier phase rotation
    chromaIQ = chromaRotate * chromaIQ;

    // 4. Luma-Chroma Crosstalk (Cross-Color Rainbow Fringes)
    // High-frequency luma transitions leak into the 3.58MHz color subcarrier
    float lumaLeft  = (RGB_TO_YIQ * sample_visual_panel(tDiffuse, uv - vec2(pixelX * 2.0, 0.0)).rgb).x;
    float lumaRight = (RGB_TO_YIQ * sample_visual_panel(tDiffuse, uv + vec2(pixelX * 2.0, 0.0)).rgb).x;
    float lumaDetail = (lumaY * 2.0 - lumaLeft - lumaRight); // Second derivative of luminance

    // Modulate detail at subcarrier frequency
    float subcarrier = sin(uv.x * u_resolution.x * 1.5 + u_time * 30.0);
    vec2 crossColorMod = vec2(cos(subcarrier), sin(subcarrier)) * (lumaDetail * 0.8 * u_cross_color * u_intensity);
    chromaIQ += crossColorMod;

    // 5. Composite Ringing / Edge Notch Filter Artifacts
    float ringing = sin(uv.x * u_resolution.x * 0.7) * (lumaDetail * 0.25 * u_intensity);
    lumaY += ringing;

    // 6. Reconstruct RGB from synthesized YIQ
    vec3 reconstructedYiq = vec3(lumaY, chromaIQ.x, chromaIQ.y);
    vec3 finalRgb = YIQ_TO_RGB * reconstructedYiq;

    out_col = vec4(clamp(finalRgb, 0.0, 1.0), 1.0);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(UV, col);
    COLOR = col;
}
