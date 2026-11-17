shader_type canvas_item;
#include "visual_panel_sampling.gdshaderinc"
uniform sampler2D tDiffuse : hint_screen_texture, filter_linear_mipmap;
uniform sampler2D tPrevFrame : hint_screen_texture, filter_linear_mipmap;
uniform vec2 u_resolution = vec2(1920.0, 1080.0);
uniform float u_time = 0.0;
/*
 * GLITCH SUITE - SHADER 25: OPTICAL KERR NON-LINEAR SOLITON & CAUSTIC TEAR
 * -------------------------------------------------------------------------
 * Simulates non-linear optical propagation in high-power laser dielectric media:
 *   - Optical Kerr Effect: Refractive index is modulated directly by local intensity:
 *       n(I) = n_0 + n_2 * I
 *   - Self-Focusing & Filamentation: Bright areas collapse into intense focal needles.
 *   - Soliton Instability & Caustic Splitting: The beam wavefront ruptures into
 *     birefringent caustic envelopes with severe chromatic phase shifts.
 */






uniform float u_intensity = 1.0;        // Glitch intensity (default: 1.0)
uniform float u_kerr_n2 = 1.0;          // Non-linear refractive index coefficient n2
uniform float u_filament_freq = 1.0;    // Spatial modulation frequency of filaments
uniform float u_caustic_shear = 1.0;    // Caustic envelope tearing magnitude
uniform float u_spectral_split = 1.0;   // Wavelength dispersion separation



float getLuma(vec3 c) {
    return dot(c, vec3(0.299, 0.587, 0.114));
}

vec3 spectrum(float t) {
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

    // Initial luminance probe for Kerr self-focusing
    vec3 baseCol = sample_visual_panel(tDiffuse, uv).rgb;
    float luma = getLuma(baseCol);

    // Non-linear index delta: delta_n = n2 * I
    float deltaN = u_kerr_n2 * pow(luma, 1.8) * 0.12 * u_intensity;

    // Self-focusing inward radial deflection + filamentation ripples
    float filamentPhase = dist * u_filament_freq * 20.0 + atan(toCenter.y, toCenter.x) * 8.0 - u_time * 3.0;
    float filamentWave = sin(filamentPhase) * deltaN * 0.5;

    // Caustic wavefront gradient
    vec2 kerrDisplacement = normalize(toCenter + vec2(1e-5)) * (-deltaN + filamentWave);

    // Caustic cusp shearing
    vec2 causticShear = vec2(
        sin(uv.y * 30.0 + u_time * 2.0) * u_caustic_shear * 0.02,
        cos(uv.x * 30.0 - u_time * 2.0) * u_caustic_shear * 0.02
    ) * pow(luma, 1.2) * u_intensity;

    vec2 totalDisplacement = kerrDisplacement + causticShear;

    // Continuous Spectral Dispersion across Kerr Caustic Shock
    vec3 col = vec3(0.0);
    int TAPS = 5;
    for (int i = 0; i < TAPS; i++) {
        float lambda = float(i) / float(TAPS - 1); // 0 (red) to 1 (violet)
        float dispScale = 1.0 + (lambda - 0.5) * u_spectral_split * 1.5;
        vec2 sampleUv = clamp(uv + totalDisplacement * dispScale, 0.0, 1.0);
        vec3 tapCol = sample_visual_panel(tDiffuse, sampleUv).rgb;
        col += tapCol * spectrum(lambda);
    }
    col /= 2.2;

    // Optical Soliton Shockwave Glow (Intense white-hot core on high-energy filaments)
    float solitonCore = smoothstep(0.7, 1.0, luma) * abs(filamentWave) * 12.0 * u_intensity;
    col += vec3(0.8, 0.9, 1.0) * solitonCore;

    out_col = vec4(clamp(col, 0.0, 1.0), 1.0);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(UV, col);
    COLOR = col;
}
