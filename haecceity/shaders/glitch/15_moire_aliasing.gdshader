shader_type canvas_item;
#include "visual_panel_sampling.gdshaderinc"
uniform sampler2D tDiffuse : hint_screen_texture, filter_linear_mipmap;
uniform sampler2D tPrevFrame : hint_screen_texture, filter_linear_mipmap;
uniform vec2 u_resolution = vec2(1920.0, 1080.0);
uniform float u_time = 0.0;
/*
 * GLITCH SUITE - SHADER 15: MOIRÉ SUBPIXEL ALIASING & NYQUIST SHIMMER
 * -------------------------------------------------------------------
 * Simulates optical spatial frequency aliasing and subpixel matrix interference.
 * When high-frequency image details beat against the discrete sampling grid of a
 * digital sensor or display panel (violating the Nyquist-Shannon sampling limit),
 * mesmerizing undulating interference fringes and iridescent rainbow diffraction rings
 * erupt across surfaces and planar projections.
 */






uniform float u_intensity = 1.0;        // Moiré amplitude and contrast (default: 1.0)
uniform float u_grid_frequency = 120.0;   // Spatial frequency of the sampling grating (default: 120.0)
uniform float u_angle_offset = 1.0;     // Rotation angle between overlapping gratings (radians)
uniform float u_subpixel_mode = 0.0;    // 0.0 = Linear dual-grating, 1.0 = Radial zone plate, 2.0 = Bayer matrix



// 2D Rotation
vec2 rotate(vec2 p, float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 uv = vUv;
    vec2 p = (uv - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0);
    float t = u_time * 0.5;

    // 1. Base Image Sample
    vec4 baseColor = sample_visual_panel(tDiffuse, uv);
    vec3 col = baseColor.rgb;

    // 2. High-Frequency Sampling Grating Wavefields
    float freq = max(30.0, u_grid_frequency);
    float angle = (u_angle_offset > 0.0 ? u_angle_offset : 0.08) + sin(t * 0.4) * 0.04;

    float waveA = 0.0;
    float waveB = 0.0;
    vec3 rainbowFringe = vec3(0.0);

    if (u_subpixel_mode < 0.5) {
        // Mode 0: Dual Linear Rotated Gratings (Classic Textile / Screen Print Moiré)
        vec2 rotP1 = rotate(p, angle * 0.5);
        vec2 rotP2 = rotate(p, -angle * 0.5 + 0.2);

        waveA = sin(rotP1.x * freq * 6.28318 + t * 4.0);
        waveB = sin(rotP2.x * freq * 6.28318 - t * 3.0);

        // Rainbow diffraction fringes along interference beats
        float beat = waveA * waveB;
        rainbowFringe = vec3(
            sin(beat * 3.1415 + 0.0) * 0.5 + 0.5,
            sin(beat * 3.1415 + 2.094) * 0.5 + 0.5,
            sin(beat * 3.1415 + 4.188) * 0.5 + 0.5
        );
    } else if (u_subpixel_mode < 1.5) {
        // Mode 1: Radial Fresnel Zone Plate (Concentric Circular Interference)
        float r1 = length(p);
        vec2 pShift = p + vec2(sin(t * 1.5), cos(t * 1.2)) * 0.08 * u_intensity;
        float r2 = length(pShift);

        // Quadratic chirp frequency (r^2 causes frequency to rise toward edge)
        waveA = sin(r1 * r1 * freq * 8.0);
        waveB = sin(r2 * r2 * freq * 8.0);

        float beat = waveA * waveB;
        rainbowFringe = vec3(
            cos(beat * 4.0 + r1 * 12.0) * 0.5 + 0.5,
            cos(beat * 4.0 + r1 * 12.0 + 1.5) * 0.5 + 0.5,
            cos(beat * 4.0 + r1 * 12.0 + 3.0) * 0.5 + 0.5
        );
    } else {
        // Mode 2: Bayer CFA (Color Filter Array) Subpixel Aliasing
        vec2 bayerCoord = floor(uv * u_resolution * 0.5);
        float bayerGrid = mod(bayerCoord.x + bayerCoord.y, 2.0);
        
        vec2 highFreqDetail = sin(uv * freq * 20.0 + t * 8.0);
        float aliasedBeat = (highFreqDetail.x * highFreqDetail.y) * (bayerGrid * 2.0 - 1.0);
        waveA = aliasedBeat;
        waveB = sin(uv.x * freq * 15.0);

        rainbowFringe = vec3(
            step(0.5, fract(uv.x * freq * 0.5)),
            step(0.5, fract(uv.y * freq * 0.5)),
            step(0.5, fract((uv.x + uv.y) * freq * 0.25))
        );
    }

    // 3. Modulate Interference Patterns with Local Image Luminance
    // High-contrast, high-frequency image areas trigger intense moiré
    float luma = dot(col, vec3(0.299, 0.587, 0.114));
    float moireBeat = (waveA * waveB) * (0.5 + 0.5 * luma);

    // 4. Modulate Original Image Color
    // Interference darkens destructive nodes and blooms constructive nodes
    vec3 modulatedColor = col * (1.0 + moireBeat * 0.85 * u_intensity);

    // Add rainbow diffraction fringes
    modulatedColor = mix(modulatedColor, rainbowFringe * luma * 1.6, 0.35 * u_intensity * abs(moireBeat));

    // 5. Subpixel Horizontal Screen Grille Overlay
    float subpixelLine = sin(uv.y * u_resolution.y * 3.14159) * 0.08 * u_intensity;
    modulatedColor -= subpixelLine;

    out_col = vec4(clamp(modulatedColor, 0.0, 1.0), baseColor.a);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(UV, col);
    COLOR = col;
}
