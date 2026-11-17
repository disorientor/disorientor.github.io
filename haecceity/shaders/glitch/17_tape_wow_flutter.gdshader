shader_type canvas_item;
#include "visual_panel_sampling.gdshaderinc"
uniform sampler2D tDiffuse : hint_screen_texture, filter_linear_mipmap;
uniform sampler2D tPrevFrame : hint_screen_texture, filter_linear_mipmap;
uniform vec2 u_resolution = vec2(1920.0, 1080.0);
uniform float u_time = 0.0;
/*
 * GLITCH SUITE - SHADER 17: TAPE WOW & FLUTTER (MECHANICAL TAPE STRETCH)
 * ----------------------------------------------------------------------
 * Accurately models the mechanical speed irregularities of magnetic tape decks:
 *   - Wow: Low-frequency (0.5 - 2 Hz) cyclical speed drift from eccentric capstan flywheel
 *   - Flutter: Higher-frequency (6 - 50 Hz) jitter from pinch roller and motor poles
 *   - Scrape Flutter / Stick-Slip: Micro-stiction friction against tape heads
 *   - Elastic Tape Stretch: Non-linear tension relaxation warping spatial coordinates
 */






uniform float u_intensity = 1.0;        // Glitch intensity (default: 1.0)
uniform float u_wow_depth = 1.0;        // Low-frequency wow amplitude (0.0 to 2.0)
uniform float u_flutter_freq = 33.0;     // Flutter frequency in Hz (6.0 to 60.0)
uniform float u_tape_tension = 1.0;     // Tape elasticity / stretch factor (0.0 to 2.0)
uniform float u_dropouts = 0.5;         // Head oxide dropout transients (0.0 to 1.0)



float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise1d(float t) {
    float i = floor(t);
    float f = fract(t);
    float u = f * f * (3.0 - 2.0 * f);
    return mix(hash(vec2(i, 0.0)), hash(vec2(i + 1.0, 0.0)), u);
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 uv = vUv;

    // 1. Capstan Wow (Low frequency 1.2 Hz sinusoidal drift + noise)
    float wowPhase = u_time * 1.2 * 6.28318;
    float wow = sin(wowPhase) * 0.006 * u_wow_depth;
    wow += (noise1d(u_time * 0.8) - 0.5) * 0.004 * u_wow_depth;

    // 2. Pinch Roller Flutter (Higher frequency 24 Hz motor ripple)
    float flutter = sin(u_time * u_flutter_freq + uv.y * 12.0) * 0.003 * u_intensity;
    flutter += sin(u_time * (u_flutter_freq * 1.7) + uv.y * 30.0) * 0.0015 * u_intensity;

    // 3. Stick-Slip friction jerk against magnetic playback head
    float stickSlip = step(0.92, hash(vec2(floor(u_time * 6.0), 42.1))) * (hash(vec2(u_time * 60.0, 1.0)) - 0.5) * 0.015;

    // 4. Elastic Tape Stretch along vertical tape travel direction
    float stretch = sin(uv.y * 3.14159) * (wow + flutter) * u_tape_tension;

    // Coordinate displacement (predominantly horizontal scanline displacement due to tape speed delta)
    vec2 displacedUv = uv;
    displacedUv.x += (wow + flutter + stickSlip) * u_intensity;
    displacedUv.y += stretch * 0.5 * u_intensity;

    // Sample video frame
    vec3 col = sample_visual_panel(tDiffuse, clamp(displacedUv, 0.0, 1.0)).rgb;

    // High frequency luma loss / tape head azimuth slant
    float azimuthSlant = (uv.x - 0.5) * (wow + flutter) * 2.0;
    vec3 colAzimuth = sample_visual_panel(tDiffuse, clamp(displacedUv + vec2(azimuthSlant * 0.02, 0.0), 0.0, 1.0)).rgb;
    col.b = mix(col.b, colAzimuth.b, 0.6);

    // Magnetic oxide dropouts (temporary loss of RF signal across a horizontal slice)
    float dropoutSlice = step(0.985 - 0.05 * u_dropouts, hash(vec2(floor(uv.y * 180.0), floor(u_time * 12.0))));
    if (dropoutSlice > 0.5) {
        float snow = hash(vec2(uv.x * 400.0, uv.y * 200.0 + u_time));
        col = mix(col, vec3(snow * 0.85), 0.75 * u_dropouts * u_intensity);
    }

    out_col = vec4(col, 1.0);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(UV, col);
    COLOR = col;
}
