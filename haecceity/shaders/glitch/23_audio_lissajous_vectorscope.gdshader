shader_type canvas_item;
#include "visual_panel_sampling.gdshaderinc"
uniform sampler2D tDiffuse : hint_screen_texture, filter_linear_mipmap;
uniform sampler2D tPrevFrame : hint_screen_texture, filter_linear_mipmap;
uniform vec2 u_resolution = vec2(1920.0, 1080.0);
uniform float u_time = 0.0;
/*
 * GLITCH SUITE - SHADER 23: AUDIO LISSAJOUS VECTORSCOPE DEFLECTOR
 * ----------------------------------------------------------------
 * Simulates an audio-rate XY oscilloscope vector monitor (Vectorscope / Goniometer):
 *   - Synthesizes dual-channel harmonic audio signals:
 *       X(t) = A_x * sin(omega_x * t + delta)
 *       Y(t) = A_y * sin(omega_y * t)
 *   - The Lissajous orbital path acts as an electromagnetic deflector coil,
 *     pinching, warping, and shearing the raster video along harmonic orbital loops.
 *   - Superimposes a glowing phosphor electron beam trace of the Lissajous pattern.
 */






uniform float u_intensity = 1.0;        // Glitch intensity (default: 1.0)
uniform float u_freq_x = 5.0;           // Frequency ratio X (1.0 to 9.0)
uniform float u_freq_y = 5.0;           // Frequency ratio Y (1.0 to 9.0)
uniform float u_phase_delta = 3.14;      // Phase difference delta in radians (0.0 to 6.28)
uniform float u_trace_glow = 1.0;       // Lissajous electron beam brightness (0.0 to 2.0)
uniform float u_warp_strength = 1.0;    // Raster frame pinching along orbital trajectory



void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 uv = vUv;
    vec2 p = (uv - 0.5) * 2.0; // Normalized [-1, 1] coordinates
    p.x *= u_resolution.x / u_resolution.y;

    float fx = floor(max(1.0, u_freq_x));
    float fy = floor(max(1.0, u_freq_y));
    float delta = u_phase_delta + u_time * 0.8;

    // Harmonic Lissajous parametric curve sampling
    // We search nearest distance from pixel p to the Lissajous loop over t in [0, 2pi]
    float minBeamDist = 100.0;
    int SAMPLES = 64;
    for (int i = 0; i < SAMPLES; i++) {
        float t = float(i) * (6.2831853 / float(SAMPLES));
        vec2 orbitalPoint = vec2(
            sin(fx * t + delta) * 0.75,
            sin(fy * t) * 0.75
        );
        float d = length(p - orbitalPoint);
        if (d < minBeamDist) {
            minBeamDist = d;
        }
    }

    // Dynamic electromagnetic field warp vector
    // Vectors directed perpendicular to nearest Lissajous curve
    float warpField = exp(-minBeamDist * 3.5);
    vec2 warpDir = vec2(
        sin(p.y * 3.0 + u_time * 2.0),
        cos(p.x * 3.0 + u_time * 2.0)
    );
    vec2 warpedUv = uv + warpDir * warpField * (0.08 * u_warp_strength * u_intensity);

    // Sample video texture through warped field
    vec3 col = sample_visual_panel(tDiffuse, clamp(warpedUv, 0.0, 1.0)).rgb;

    // Lissajous Electron Beam Laser Trace Overlay
    float beamCore = smoothstep(0.025, 0.005, minBeamDist);
    float beamHalo = exp(-minBeamDist * 16.0);
    vec3 beamColor = vec3(0.0, 1.0, 0.7); // Vivid phosphor cyan-green
    vec3 trace = (beamColor * beamCore * 2.0 + vec3(0.1, 0.8, 1.0) * beamHalo) * u_trace_glow * u_intensity;

    // Chromatic dispersion around intense beam fields
    float r = sample_visual_panel(tDiffuse, clamp(warpedUv + vec2(beamHalo * 0.015, 0.0), 0.0, 1.0)).r;
    float b = sample_visual_panel(tDiffuse, clamp(warpedUv - vec2(beamHalo * 0.015, 0.0), 0.0, 1.0)).b;
    col.r = mix(col.r, r, 0.5 * u_intensity);
    col.b = mix(col.b, b, 0.5 * u_intensity);

    col += trace;

    out_col = vec4(col, 1.0);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(UV, col);
    COLOR = col;
}
