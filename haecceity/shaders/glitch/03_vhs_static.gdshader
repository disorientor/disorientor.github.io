shader_type canvas_item;
#include "visual_panel_sampling.gdshaderinc"
uniform sampler2D tDiffuse : hint_screen_texture, filter_linear_mipmap;
uniform sampler2D tPrevFrame : hint_screen_texture, filter_linear_mipmap;
uniform vec2 u_resolution = vec2(1920.0, 1080.0);
uniform float u_time = 0.0;
/*
 * GLITCH SUITE - SHADER 03: VHS TAPE STATIC & HEAD TRACKING FAULT
 * ---------------------------------------------------------------
 * Simulates helical scan VHS / Betamax magnetic tape playback degradation:
 * - Rotary head drum switching noise bar (tracking distortion at screen edges)
 * - Horizontal phase jitter & tape stretch wobble
 * - Magnetic oxide dropout streaks (white/black horizontal speckle blips)
 * - RF tape snow (colored grain noise)
 * - Tape luma/chroma desynchronization & phosphorescent bleeding
 */






uniform float u_intensity = 1.0;       // Overall VHS degradation level (default: 1.0)
uniform float u_tracking_pos = 0.5;    // Vertical position of tracking error bar (0.0 to 1.0)
uniform float u_noise_density = 1.0;   // Density of tape dropout streaks
uniform float u_tape_wobble = 1.0;     // Horizontal tape stretch wobble strength



// Fast hash noise functions
float hash11(float p) {
    p = fract(p * 0.1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
}

float hash12(vec2 p) {
    vec3 p3  = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

float noise(vec2 p) {
    vec2 ip = floor(p);
    vec2 u = fract(p);
    u = u * u * (3.0 - 2.0 * u);
    float res = mix(
        mix(hash12(ip), hash12(ip + vec2(1.0, 0.0)), u.x),
        mix(hash12(ip + vec2(0.0, 1.0)), hash12(ip + vec2(1.0, 1.0)), u.x),
        u.y
    );
    return res * res;
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 uv = vUv;
    float t = u_time * 2.0;

    // 1. Slow vertical tape tracking bar (head drum switching anomaly)
    float trackPos = mod(u_tracking_pos + u_time * 0.08, 1.2) - 0.1;
    float trackDist = abs(uv.y - trackPos);
    float trackMask = smoothstep(0.12, 0.0, trackDist);
    
    // High-frequency tracking tear
    float trackNoise = hash11(uv.y * 500.0 + t);
    float trackTear = trackMask * (sin(uv.y * 80.0 + t * 10.0) * 0.03 + trackNoise * 0.02) * u_intensity;

    // 2. Continuous horizontal phase wobble (capstan motor flutter)
    float wobble = sin(uv.y * 3.5 + t * 1.5) * 0.003 * u_tape_wobble * u_intensity;
    wobble += sin(uv.y * 30.0 + t * 8.0) * 0.0015 * u_intensity;

    // 3. Magnetic dropout streaks (random horizontal scanline bursts)
    float dropoutLine = step(0.985 - 0.05 * u_noise_density, hash11(floor(uv.y * u_resolution.y * 0.5) + floor(t * 30.0)));
    float dropoutX = hash11(floor(uv.x * 20.0) + floor(t * 30.0));
    float dropoutMask = dropoutLine * step(0.3, dropoutX) * u_intensity;

    // Displaced UV coordinate
    vec2 finalUv = uv + vec2(trackTear + wobble, 0.0);

    // 4. Chroma delay (NTSC color subcarrier lag: red shifts right, blue shifts left)
    float chromaShift = (0.0035 + trackMask * 0.008) * u_intensity;
    float r = sample_visual_panel(tDiffuse, clamp(finalUv + vec2(chromaShift, 0.0), 0.0, 1.0)).r;
    float g = sample_visual_panel(tDiffuse, clamp(finalUv, 0.0, 1.0)).g;
    float b = sample_visual_panel(tDiffuse, clamp(finalUv - vec2(chromaShift * 1.2, 0.0), 0.0, 1.0)).b;
    vec3 col = vec3(r, g, b);

    // 5. Tape oxide grain / RF snow
    float snow = hash12(uv * u_resolution * 0.75 + vec2(t * 50.0, t * 123.0));
    col = mix(col, vec3(snow), (0.04 + trackMask * 0.18) * u_intensity);

    // 6. White dropout streak injection
    if (dropoutMask > 0.5) {
        float streakBright = hash11(uv.x * 300.0 + t);
        col = mix(col, vec3(streakBright * 1.5), 0.85);
    }

    // 7. Subtle vertical CRT/tape luma line ripple
    float scanline = sin(uv.y * u_resolution.y * 1.2) * 0.04 * u_intensity;
    col -= scanline;

    // 8. Tracking bar luma wash
    col += trackMask * vec3(0.08, 0.12, 0.08) * u_intensity;

    out_col = vec4(clamp(col, 0.0, 1.0), 1.0);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(UV, col);
    COLOR = col;
}
