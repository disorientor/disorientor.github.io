shader_type canvas_item;
#include "visual_panel_sampling.gdshaderinc"
uniform sampler2D tDiffuse : hint_screen_texture, filter_linear_mipmap;
uniform sampler2D tPrevFrame : hint_screen_texture, filter_linear_mipmap;
uniform vec2 u_resolution = vec2(1920.0, 1080.0);
uniform float u_time = 0.0;
/*
 * GLITCH SUITE - SHADER 07: INTERLACE COMBING & HORIZONTAL LINE JITTER
 * -------------------------------------------------------------------
 * Simulates analog broadcast and CRT interlacing artifacts (480i / 576i / 1080i).
 * Odd and even scanlines represent alternating temporal fields (Field 1 vs Field 2).
 * During motion or signal shudder, high-contrast edges split into iconic "combing teeth".
 * In addition, random horizontal line micro-bursts slice across the screen with
 * high-frequency phase shudder and field inversion.
 */






uniform float u_intensity = 1.0;       // Overall combing & jitter severity (default: 1.0)
uniform float u_comb_strength = 0.015;   // Opposing field horizontal separation offset (default: 0.015)
uniform float u_jitter_freq = 25.0;     // Frequency of random scanline horizontal tears (default: 25.0)
uniform float u_field_invert = 0.0;    // 0.0 = Standard fields, 1.0 = Field dominance inversion shudder



// Fast pseudo-random 1D noise
float hash11(float p) {
    p = fract(p * 0.1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 uv = vUv;
    float pixelY = floor(uv.y * u_resolution.y);

    // Determine field parity: 1.0 for odd scanlines, -1.0 for even scanlines
    float isOddLine = mod(pixelY, 2.0);
    float fieldSign = (isOddLine * 2.0 - 1.0);

    // Field dominance shudder (rapid 60Hz field flipping)
    if (u_field_invert > 0.5) {
        float fieldFlip = step(0.5, mod(floor(u_time * 60.0), 2.0));
        fieldSign *= (fieldFlip * 2.0 - 1.0);
    }

    // 1. Interlace Combing Offset
    // Combing is magnified during dynamic motion or simulated camera panning
    float panMotion = sin(u_time * 3.5) * cos(u_time * 1.7);
    float combOffset = fieldSign * u_comb_strength * (0.6 + 0.4 * abs(panMotion)) * u_intensity;

    // 2. Random Scanline Micro-Burst Jitter (H-Sync phase error)
    // Individual scanlines or small line clusters tear horizontally
    float lineSeed = pixelY + floor(u_time * u_jitter_freq);
    float lineRand = hash11(lineSeed);
    
    // Threshold test for horizontal micro-bursts
    float burstThreshold = 1.0 - (0.08 * u_intensity);
    float burstOffset = 0.0;
    if (lineRand > burstThreshold) {
        float burstDir = (hash11(lineSeed * 1.7) - 0.5) * 2.0;
        burstOffset = burstDir * 0.08 * u_intensity;
    }

    // Secondary wide-band tape slice displacement
    float bandCoord = floor(uv.y * 12.0) + floor(u_time * 10.0);
    if (hash11(bandCoord) > 0.94 && u_intensity > 0.5) {
        burstOffset += (hash11(bandCoord * 3.3) - 0.5) * 0.04 * u_intensity;
    }

    // 3. Combined UV coordinate
    vec2 sampledUv = vec2(uv.x + combOffset + burstOffset, uv.y);

    // Sample texture with bounds clamping
    vec4 col = sample_visual_panel(tDiffuse, clamp(sampledUv, 0.0, 1.0));

    // 4. Subtle Interlaced Phosphor Line Shadowing (Black bar between fields)
    float fieldDimming = mix(1.0, 0.88, isOddLine * 0.5 * u_intensity);
    col.rgb *= fieldDimming;

    // 5. Chromatic fringing on high-intensity line tears
    if (abs(burstOffset) > 0.01) {
        float r = sample_visual_panel(tDiffuse, clamp(sampledUv + vec2(burstOffset * 0.35, 0.0), 0.0, 1.0)).r;
        float b = sample_visual_panel(tDiffuse, clamp(sampledUv - vec2(burstOffset * 0.35, 0.0), 0.0, 1.0)).b;
        col.r = r;
        col.b = b;
    }

    out_col = col;
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(UV, col);
    COLOR = col;
}
