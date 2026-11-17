shader_type canvas_item;
#include "visual_panel_sampling.gdshaderinc"
uniform sampler2D tDiffuse : hint_screen_texture, filter_linear_mipmap;
uniform sampler2D tPrevFrame : hint_screen_texture, filter_linear_mipmap;
uniform vec2 u_resolution = vec2(1920.0, 1080.0);
uniform float u_time = 0.0;
/*
 * GLITCH SUITE - SHADER 22: TMDS HDMI SPARKLES & LINE LOCK DROP
 * --------------------------------------------------------------
 * Simulates high-speed digital video link failure over HDMI/DVI (TMDS encoding):
 *   - Digital "Sparkles": Single-pixel pseudorandom bit-error flashes (white, magenta, green)
 *     caused by marginal signal eye-diagram attenuation over long cable runs.
 *   - TMDS Clock Jitter / Eye Closure: Horizontal phase slewing and differential skew.
 *   - H-Sync / Line Lock Loss: Intermittent horizontal scanline blackouts and channel desync.
 */






uniform float u_intensity = 1.0;        // Glitch intensity (default: 1.0)
uniform float u_sparkle_density = 0.255;  // Probability of single-pixel bit errors (0.01 to 0.5)
uniform float u_clock_jitter = 1.0;     // TMDS channel clock phase skew (0.0 to 2.0)
uniform float u_line_drop_rate = 0.5;   // Frequency of H-Sync lock drops (0.0 to 1.0)



float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float hash3(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 uv = vUv;
    vec2 px = floor(uv * u_resolution);

    // 1. Line Lock Drop (Horizontal scanlines lose TMDS 10-bit word alignment)
    float lineRand = hash(vec2(px.y, floor(u_time * 30.0)));
    float isLineDropped = step(1.0 - 0.04 * u_line_drop_rate * u_intensity, lineRand);
    
    // TMDS Channel Skew: Red, Green, and Blue lanes experience differential transit delay
    float skewAmount = sin(px.y * 0.1 + u_time * 10.0) * 0.003 * u_clock_jitter * u_intensity;
    vec2 uvR = uv + vec2(skewAmount, 0.0);
    vec2 uvG = uv;
    vec2 uvB = uv - vec2(skewAmount, 0.0);

    // If line lock is lost, displace the line violently or blank it
    if (isLineDropped > 0.5) {
        float lineShift = (hash(vec2(px.y, u_time)) - 0.5) * 0.3 * u_intensity;
        uvR.x += lineShift;
        uvG.x += lineShift;
        uvB.x += lineShift;
    }

    // Sample channels with differential skew
    float r = sample_visual_panel(tDiffuse, clamp(uvR, 0.0, 1.0)).r;
    float g = sample_visual_panel(tDiffuse, clamp(uvG, 0.0, 1.0)).g;
    float b = sample_visual_panel(tDiffuse, clamp(uvB, 0.0, 1.0)).b;
    vec3 col = vec3(r, g, b);

    // If line lock dropped completely, introduce blanking porch or bright TMDS word sync bar
    if (isLineDropped > 0.5) {
        if (hash(vec2(px.y, 88.3)) > 0.6) {
            col = vec3(0.0); // Complete sync loss black line
        } else {
            col = vec3(1.0, 0.0, 1.0); // Magenta sync error bar
        }
    }

    // 2. TMDS Sparkles (Single-pixel bit flips due to marginal eye pattern)
    // In TMDS 10b/8b coding, single-bit errors cause dramatic color jumps
    float sparkleSeed = hash3(vec3(px, floor(u_time * 60.0)));
    float sparkleThresh = 1.0 - (0.005 + 0.035 * u_sparkle_density * u_intensity);
    
    if (sparkleSeed > sparkleThresh) {
        float sparkleType = hash(px + vec2(u_time));
        if (sparkleType < 0.35) {
            col = vec3(1.0, 1.0, 1.0); // White sparkle (most common in HDMI cables)
        } else if (sparkleType < 0.65) {
            col = vec3(0.0, 1.0, 1.0); // Cyan bit-flip
        } else if (sparkleType < 0.85) {
            col = vec3(1.0, 0.0, 1.0); // Magenta bit-flip
        } else {
            col = vec3(1.0, 1.0, 0.0); // Yellow bit-flip
        }
    }

    out_col = vec4(col, 1.0);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(UV, col);
    COLOR = col;
}
