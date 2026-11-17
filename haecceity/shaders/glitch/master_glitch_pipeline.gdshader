shader_type canvas_item;
#include "visual_panel_sampling.gdshaderinc"
uniform sampler2D tDiffuse : hint_screen_texture, filter_linear_mipmap;
uniform sampler2D tPrevFrame : hint_screen_texture, filter_linear_mipmap;
uniform vec2 u_resolution = vec2(1920.0, 1080.0);
uniform float u_time = 0.0;
/*
 * ============================================================================
 * GLITCH SUITE - MASTER GLITCH PIPELINE COMPOSITOR (UBER-SHADER)
 * ============================================================================
 * Unifies all 15 glitch shader archetypes into a single, high-performance,
 * configurable post-processing shader pass.
 *
 * PIPELINE ORDER:
 * 1.  Geometric / Vector Distortions:
 *     - CRT V-Hold Sync Roll & Curvature (Shader 05)
 *     - Magnetic De-Gauss & Beam Twist (Shader 11)
 *     - Macroblock Scramble Displacement (Shader 04)
 *     - VRAM Stride Misalignment (Shader 09)
 * 2.  Line & Scanline Shears:
 *     - Interlace Field Combing & Jitter (Shader 07)
 *     - Raster Drift & 60Hz Hum Bar (Shader 12)
 *     - VHS Tape Tracking & Wobble (Shader 03)
 *     - Hardware Fault Voltage Brownout (Shader 14)
 * 3.  Color Space & Spectral Transformations:
 *     - Chromatic Aberration & Spectral Prism (Shader 01)
 *     - NTSC Composite & YIQ Chroma Bleed (Shader 08)
 *     - Datamosh Motion Vector Smear (Shader 02)
 *     - Real-Time Pixel Sorting (Shader 13)
 *     - Bitcrush & ALU Bitwise Logic (Shader 06)
 * 4.  Optical & Subpixel Overlay:
 *     - Temporal Feedback Trails (Shader 10)
 *     - Moiré Subpixel Aliasing (Shader 15)
 * ============================================================================
 */






uniform float u_master_intensity = 1.0; // Master blend weight [0.0, 2.0]

// Individual Glitch Enable Flags & Weights
uniform float u_enable_chroma = 1.0;       // 01. Chromatic Aberration
uniform float u_enable_datamosh = 1.0;    // 02. Datamosh
uniform float u_enable_vhs = 1.0;         // 03. VHS Static
uniform float u_enable_macroblock = 1.0;  // 04. Macroblock Scramble
uniform float u_enable_crt_roll = 1.0;    // 05. CRT V-Hold Roll
uniform float u_enable_bitcrush = 1.0;    // 06. Bitcrush ALU
uniform float u_enable_interlace = 1.0;   // 07. Interlace Jitter
uniform float u_enable_ntsc = 1.0;        // 08. NTSC Composite
uniform float u_enable_vram = 1.0;        // 09. VRAM Stride Dump
uniform float u_enable_feedback = 1.0;    // 10. Temporal Feedback
uniform float u_enable_magnetic = 1.0;    // 11. Magnetic De-Gauss
uniform float u_enable_raster = 1.0;      // 12. Raster Drift
uniform float u_enable_pixelsort = 1.0;   // 13. Pixel Sort
uniform float u_enable_fault = 1.0;       // 14. Voltage Fault
uniform float u_enable_moire = 1.0;       // 15. Moiré Aliasing

// Key tuning parameters
uniform float u_glitch_seed = 1.0;        // Seed for randomized burst triggering
uniform float u_magnet_center_x = 1.0;    // Pole for magnetic de-gauss X (default 0.5)
uniform float u_magnet_center_y = 1.0;    // Pole for magnetic de-gauss Y (default 0.5)



// ----------------------------------------------------------------------------
// Mathematical Helpers
// ----------------------------------------------------------------------------
float hash11(float p) {
    p = fract(p * 0.1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
}

float hash21(vec2 p) {
    p = fract(p * vec2(233.34, 851.73));
    p += dot(p, p + 23.45);
    return fract(p.x * p.y);
}

vec2 rotate(vec2 p, float a) {
    float s = sin(a), c = cos(a);
    return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}

// NTSC YIQ Conversion matrices
const mat3 RGB_TO_YIQ = mat3(vec3(0.299, 0.587, 0.114), vec3(0.596, -0.274, -0.322), vec3(0.211, -0.523, 0.312));
const mat3 YIQ_TO_RGB = mat3(vec3(1.0, 0.956, 0.621), vec3(1.0, -0.272, -0.647), vec3(1.0, -1.106, 1.703));

void mainImage(vec2 vUv, out vec4 out_col) {
    float master = clamp(u_master_intensity, 0.0, 3.0);
    if (master <= 0.001) {
        out_col = sample_visual_panel(tDiffuse, vUv);
        return;
    }

    vec2 uv = vUv;
    vec2 res = u_resolution;
    float t = u_time;

    // ========================================================================
    // STAGE 1: GEOMETRIC & COORDINATE WARPING
    // ========================================================================

    // Shader 05: CRT Barrel Curvature & V-Hold Roll
    if (u_enable_crt_roll > 0.01) {
        float crtWeight = u_enable_crt_roll * master;
        vec2 p = uv * 2.0 - 1.0;
        p = p + p * (p.yx / vec2(4.0, 3.0)) * (p.yx / vec2(4.0, 3.0)) * 0.15 * crtWeight;
        vec2 crtUv = p * 0.5 + 0.5;

        // V-Hold Roll
        float roll = fract(t * 1.2 * crtWeight);
        crtUv.y = fract(crtUv.y + roll);
        uv = mix(uv, crtUv, crtWeight);
    }

    // Shader 11: Magnetic De-Gauss Swirl
    if (u_enable_magnetic > 0.01) {
        float magWeight = u_enable_magnetic * master;
        vec2 magPos = vec2(u_magnet_center_x, u_magnet_center_y);
        if (u_magnet_center_x <= 0.001 && u_magnet_center_y <= 0.001) magPos = vec2(0.5);
        vec2 d = uv - magPos;
        d.x *= res.x / res.y;
        float dist = length(d);
        float force = 1.0 / (1.0 + dist * dist * 12.0) * magWeight;
        vec2 twisted = rotate(d, force * 3.0);
        twisted.x /= (res.x / res.y);
        uv = mix(uv, magPos + twisted, clamp(force, 0.0, 1.0));
    }

    // Shader 04: Macroblock Scramble Displacement
    if (u_enable_macroblock > 0.01) {
        float mbWeight = u_enable_macroblock * master;
        float bSize = 32.0;
        vec2 bCoord = floor(uv * res / bSize);
        float bHash = hash21(bCoord + floor(t * 8.0));
        if (bHash > 1.0 - 0.25 * mbWeight) {
            vec2 bOffset = (vec2(hash21(bCoord * 1.3), hash21(bCoord * 2.7)) - 0.5) * 0.08 * mbWeight;
            uv += bOffset;
        }
    }

    // Shader 09: VRAM Stride Misalignment
    if (u_enable_vram > 0.01) {
        float vramWeight = u_enable_vram * master;
        float stride = sin(t * 0.5) * 0.08 * vramWeight;
        float linearX = fract(uv.x + uv.y * stride);
        uv.x = mix(uv.x, linearX, 0.6 * vramWeight);
    }

    // ========================================================================
    // STAGE 2: SCANLINE SHEARS & PHASE JITTER
    // ========================================================================

    // Shader 07: Interlace Field Combing & Scanline Tears
    if (u_enable_interlace > 0.01) {
        float intWeight = u_enable_interlace * master;
        float lineY = floor(uv.y * res.y);
        float fieldSign = mod(lineY, 2.0) * 2.0 - 1.0;
        uv.x += fieldSign * 0.012 * intWeight;

        // Line micro-burst
        float burstHash = hash11(lineY + floor(t * 20.0));
        if (burstHash > 1.0 - 0.06 * intWeight) {
            uv.x += (hash11(lineY * 2.1) - 0.5) * 0.06 * intWeight;
        }
    }

    // Shader 12: Raster Drift & 60Hz Hum Bar
    float humBarGlow = 0.0;
    if (u_enable_raster > 0.01) {
        float rastWeight = u_enable_raster * master;
        float humPhase = fract(uv.y - t * 0.25);
        humBarGlow = pow(sin(humPhase * 6.28318) * 0.5 + 0.5, 3.0) * rastWeight;
        float ripple = sin(uv.y * 40.0 + t * 10.0) * 0.006 * rastWeight;
        uv.x += ripple + sin(humPhase * 6.28318) * 0.015 * rastWeight;
    }

    // Shader 03: VHS Tape Tracking & Capstan Wobble
    float vhsTrackGlow = 0.0;
    if (u_enable_vhs > 0.01) {
        float vhsWeight = u_enable_vhs * master;
        float trackPos = mod(t * 0.08, 1.2) - 0.1;
        float trackMask = smoothstep(0.1, 0.0, abs(uv.y - trackPos)) * vhsWeight;
        vhsTrackGlow = trackMask;
        float wobble = sin(uv.y * 4.0 + t * 2.0) * 0.003 * vhsWeight;
        uv.x += wobble + trackMask * (hash11(uv.y * 400.0 + t) - 0.5) * 0.03;
    }

    // Shader 14: Hardware Fault Injection Voltage Drop
    float isFaultActive = 0.0;
    if (u_enable_fault > 0.01) {
        float faultWeight = u_enable_fault * master;
        float fTime = floor(t * 4.0);
        if (hash11(fTime * 17.1) > 1.0 - 0.35 * faultWeight) {
            isFaultActive = 1.0;
            float slice = floor(uv.y * 14.0);
            if (hash11(slice + fTime) > 0.5) {
                uv.x += (hash11(slice * 3.7) - 0.5) * 0.12 * faultWeight;
            }
        }
    }

    // Clamp distorted UV
    vec2 clampedUv = clamp(uv, 0.0, 1.0);

    // ========================================================================
    // STAGE 3: COLOR SAMPLING & SPECTRAL DISPERSION
    // ========================================================================

    vec3 col = vec3(0.0);

    // Shader 01: Chromatic Aberration
    if (u_enable_chroma > 0.01) {
        float chrWeight = u_enable_chroma * master;
        vec2 dir = normalize(clampedUv - 0.5 + vec2(1e-4)) * pow(length(clampedUv - 0.5), 1.4) * 0.04 * chrWeight;
        float r = sample_visual_panel(tDiffuse, clamp(clampedUv + dir, 0.0, 1.0)).r;
        float g = sample_visual_panel(tDiffuse, clampedUv).g;
        float b = sample_visual_panel(tDiffuse, clamp(clampedUv - dir, 0.0, 1.0)).b;
        col = vec3(r, g, b);
    } else {
        col = sample_visual_panel(tDiffuse, clampedUv).rgb;
    }

    // Shader 08: NTSC Composite & YIQ Chroma Bleed
    if (u_enable_ntsc > 0.01) {
        float ntscWeight = u_enable_ntsc * master;
        vec3 yiq = RGB_TO_YIQ * col;
        float pixelX = 1.0 / res.x;
        // Horizontal chroma lowpass bleed
        vec2 bleedIQ = vec2(0.0);
        for (int i = -4; i <= 4; i++) {
            float fi = float(i);
            vec3 tap = sample_visual_panel(tDiffuse, clamp(clampedUv + vec2(fi * pixelX * 3.0 * ntscWeight, 0.0), 0.0, 1.0)).rgb;
            bleedIQ += (RGB_TO_YIQ * tap).yz;
        }
        bleedIQ /= 9.0;
        col = YIQ_TO_RGB * vec3(yiq.x, bleedIQ);
    }

    // Shader 02: Datamosh Color Smear & Sticky Blocks
    if (u_enable_datamosh > 0.01) {
        float dmWeight = u_enable_datamosh * master;
        vec2 dmBlock = floor(clampedUv * res / 16.0) * 16.0 / res;
        vec3 dmSample = sample_visual_panel(tDiffuse, dmBlock).rgb;
        col = mix(col, dmSample, 0.35 * dmWeight);
    }

    // Shader 13: Real-Time Luminance Pixel Sorting
    if (u_enable_pixelsort > 0.01) {
        float psWeight = u_enable_pixelsort * master;
        float luma = dot(col, vec3(0.299, 0.587, 0.114));
        if (luma > 0.4 && luma < 0.95) {
            vec3 bestCol = col;
            float maxL = luma;
            for (int i = 1; i <= 10; i++) {
                vec2 sUv = clampedUv - vec2(0.0, float(i) * 3.0 / res.y * psWeight);
                if (sUv.y < 0.0) break;
                vec3 sCol = sample_visual_panel(tDiffuse, sUv).rgb;
                float sL = dot(sCol, vec3(0.299, 0.587, 0.114));
                if (sL > maxL) { maxL = sL; bestCol = sCol; }
            }
            col = mix(col, bestCol, 0.8 * psWeight);
        }
    }

    // Shader 06: Bitcrush & ALU Bitwise Logic
    if (u_enable_bitcrush > 0.01) {
        float bcWeight = u_enable_bitcrush * master;
        float steps = mix(255.0, 7.0, clamp(bcWeight, 0.0, 1.0));
        col = floor(col * steps + 0.5) / steps;
        // Solarize overflow
        if (bcWeight > 0.7) {
            col = fract(col * (1.0 + (bcWeight - 0.7) * 2.0));
        }
    }

    // Apply Voltage Fault Inversion / Strobe
    if (isFaultActive > 0.5) {
        col = abs(vec3(1.0) - col * 1.3) * vec3(1.2, 0.7, 1.4);
    }

    // ========================================================================
    // STAGE 4: OPTICAL OVERLAY & SUBPIXEL ARTIFACTS
    // ========================================================================

    // Shader 10: Optical Feedback Trails
    if (u_enable_feedback > 0.01) {
        float fbWeight = u_enable_feedback * master;
        vec2 pFb = (clampedUv - 0.5) * 0.97 + 0.5;
        vec3 fbCol = sample_visual_panel(tDiffuse, clamp(pFb, 0.0, 1.0)).rgb;
        col = mix(col, max(col, fbCol * vec3(0.4, 1.1, 0.7)), 0.35 * fbWeight);
    }

    // Shader 15: Moiré Subpixel Aliasing
    if (u_enable_moire > 0.01) {
        float moireWeight = u_enable_moire * master;
        vec2 pM = (clampedUv - 0.5) * vec2(res.x / res.y, 1.0);
        float w1 = sin(pM.x * 120.0 + t * 2.0);
        float w2 = sin((pM.x * 0.95 + pM.y * 0.31) * 120.0);
        float beat = w1 * w2;
        col *= (1.0 + beat * 0.5 * moireWeight);
    }

    // Luminance modulation from hum bars & VHS tracking
    col += humBarGlow * vec3(0.2, 0.25, 0.3);
    col += vhsTrackGlow * vec3(0.1, 0.15, 0.1);

    // Subtle CRT scanlines
    float scanline = sin(clampedUv.y * res.y * 3.14159) * 0.05 * master;
    col -= scanline;

    out_col = vec4(clamp(col, 0.0, 1.0), 1.0);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(UV, col);
    COLOR = col;
}
