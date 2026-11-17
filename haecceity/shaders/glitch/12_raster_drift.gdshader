shader_type canvas_item;
#include "visual_panel_sampling.gdshaderinc"
uniform sampler2D tDiffuse : hint_screen_texture, filter_linear_mipmap;
uniform sampler2D tPrevFrame : hint_screen_texture, filter_linear_mipmap;
uniform vec2 u_resolution = vec2(1920.0, 1080.0);
uniform float u_time = 0.0;
/*
 * GLITCH SUITE - SHADER 12: RASTER SCANLINE DRIFT & ROLLING SHUTTER RIPPLE
 * ------------------------------------------------------------------------
 * Simulates AC power ground-loop hum bars (60Hz / 50Hz mains power interference)
 * and CMOS rolling shutter phase artifacts.
 * Broad horizontal luminance swell bars drift continuously down the raster grid,
 * accompanied by sinusoidal horizontal phase modulation, high-frequency RF ripples,
 * and scanning beam sync flutter.
 */






uniform float u_intensity = 1.0;        // Hum bar & ripple severity (default: 1.0)
uniform float u_hum_bar_speed = 0.25;    // Vertical drift speed of the 60Hz hum bar (default: 0.25)
uniform float u_hum_bar_width = 0.35;    // Height of the hum bar swell (default: 0.35)
uniform float u_ripple_freq = 45.0;      // Frequency of high-frequency rolling shutter waves (default: 45.0)
uniform float u_rf_interference = 1.0;  // Radio-frequency interference noise strength



// Noise helper
float hash11(float p) {
    p = fract(p * 0.1031);
    p *= p + 33.33;
    return fract(p * p);
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 uv = vUv;
    float t = u_time;

    // 1. 60Hz AC Power Hum Bar (Slow vertical drift)
    float humSpeed = (u_hum_bar_speed > 0.0 ? u_hum_bar_speed : 0.25) * 0.8;
    float humPos = fract(uv.y - t * humSpeed);
    
    // Smooth sinusoidal / Gaussian swell for the hum bar
    float humBar = sin(humPos * 6.28318) * 0.5 + 0.5;
    humBar = pow(humBar, 2.5); // Narrow down the core swell

    // 2. Rolling Shutter Sinusoidal Horizontal Phase Distortion
    // Horizontal displacement increases drastically across the hum bar peak
    float rippleFreq = max(10.0, u_ripple_freq);
    float ripple = sin(uv.y * rippleFreq + t * 12.0) * 0.008 * u_intensity;
    
    // Additional low-frequency hum displacement
    float humDisplacement = sin(humPos * 6.28318) * 0.025 * u_intensity * (0.5 + 0.5 * humBar);

    // 3. High-Frequency RF Noise Flutter
    float rf = (hash11(floor(uv.y * u_resolution.y * 0.5) + floor(t * 30.0)) - 0.5) * 0.006 * u_rf_interference * u_intensity;

    vec2 distortedUv = vec2(uv.x + ripple + humDisplacement + rf, uv.y);

    // 4. Sample Texture with Slight Horizontal Chroma Lag
    float chromaDelta = (humBar * 0.006 + 0.002) * u_intensity;
    float r = sample_visual_panel(tDiffuse, clamp(distortedUv + vec2(chromaDelta, 0.0), 0.0, 1.0)).r;
    float g = sample_visual_panel(tDiffuse, clamp(distortedUv, 0.0, 1.0)).g;
    float b = sample_visual_panel(tDiffuse, clamp(distortedUv - vec2(chromaDelta, 0.0), 0.0, 1.0)).b;
    vec3 col = vec3(r, g, b);

    // 5. Luminance Modulation (Hum Bar Brightness & Contrast Lift)
    // Hum bars modulate CRT anode voltage, causing localized black-level lift and bloom
    float lumaMod = (humBar * 0.35 - 0.1) * u_intensity;
    col += lumaMod * vec3(0.9, 0.95, 1.0);

    // 6. Traveling Fine Raster Scanlines
    float rasterLine = sin(uv.y * u_resolution.y * 1.5 - t * 4.0) * 0.06 * u_intensity;
    col -= rasterLine;

    out_col = vec4(clamp(col, 0.0, 1.0), 1.0);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(UV, col);
    COLOR = col;
}
