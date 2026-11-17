shader_type canvas_item;
#include "visual_panel_sampling.gdshaderinc"
uniform sampler2D tDiffuse : hint_screen_texture, filter_linear_mipmap;
uniform sampler2D tPrevFrame : hint_screen_texture, filter_linear_mipmap;
uniform vec2 u_resolution = vec2(1920.0, 1080.0);
uniform float u_time = 0.0;
/*
 * GLITCH SUITE - SHADER 14: HARDWARE FAULT INJECTION & VOLTAGE BROWNOUT
 * ---------------------------------------------------------------------
 * Emulates physical silicon hardware fault injection (crowbar circuit voltage dipping,
 * clock frequency glitching, and power rail brownouts).
 * The processor skips instruction cycles, causing sudden violent strobe flashes,
 * inverted solarized luminance bursts, instruction register shear fractures,
 * and arithmetic bit-flips across parallel compute units.
 */






uniform float u_intensity = 1.0;        // Glitch severity and fault burst magnitude (default: 1.0)
uniform float u_burst_frequency = 3.5;  // How often brownouts trigger (default: 3.5)
uniform float u_strobe_intensity = 0.8; // Brightness flash / inversion strength (default: 0.8)
uniform float u_shear_strength = 1.0;   // Magnitude of horizontal register slice displacement



// Pseudo-random hash
float hash11(float p) {
    p = fract(p * 0.1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
}

float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 uv = vUv;
    float t = u_time;

    // 1. Fault Trigger Detection (Stochastic micro-bursts of voltage collapse)
    float timeSlot = floor(t * max(1.0, u_burst_frequency));
    float faultRand = hash11(timeSlot * 19.3);
    
    // Check if current moment is in a brownout state
    float isFaultActive = step(1.0 - (0.45 * u_intensity), faultRand);
    float burstPhase = fract(t * u_burst_frequency);

    // 2. Hardware Register Slice Displacement (Program Counter / DMA jump)
    vec2 distortedUv = uv;
    float sliceY = floor(uv.y * 18.0);
    float sliceSeed = sliceY + timeSlot * 7.7;
    float sliceFault = hash11(sliceSeed);

    if (isFaultActive > 0.5 && sliceFault > 0.4) {
        float shearAmount = (hash11(sliceSeed * 2.3) - 0.5) * 0.15 * (u_shear_strength > 0.0 ? u_shear_strength : 1.0) * u_intensity;
        distortedUv.x += shearAmount;
    }

    // High-frequency single-scanline jitter
    if (isFaultActive > 0.5 && hash11(floor(uv.y * u_resolution.y) + t * 60.0) > 0.88) {
        distortedUv.x += (hash11(uv.y * 999.0 + t) - 0.5) * 0.05 * u_intensity;
    }

    // 3. Sample Distorted Frame with Bounds Clamping
    vec4 baseColor = sample_visual_panel(tDiffuse, clamp(distortedUv, 0.0, 1.0));
    vec3 col = baseColor.rgb;

    // 4. Voltage Brownout Electrical Strobe & Solarization
    if (isFaultActive > 0.5) {
        float faultType = hash11(timeSlot * 5.1);

        if (faultType < 0.35) {
            // Mode A: Negative Voltage Spike (Full color inversion & neon solarization)
            col = abs(vec3(1.0) - col * 1.4);
            col *= vec3(1.2, 0.6, 1.4); // Magenta/amber solarized cast
        } else if (faultType < 0.70) {
            // Mode B: Power Rail Sag (Luminance drops into harsh clipped shadows with color tint)
            col = pow(col, vec3(2.5)) * 1.8;
            col.g *= 0.3; // Green rail dropout
            col.b *= 1.4; // Blue capacitor discharge
        } else {
            // Mode C: Over-Voltage Flare Strobe (White blowout flash)
            float flashDecay = exp(-burstPhase * 6.0);
            col += vec3(flashDecay * u_strobe_intensity * 1.8);
        }

        // 5. Arithmetic ALU Bit-Flip Stutter
        // Pseudo-random channel bits invert
        if (hash21(floor(distortedUv * 32.0) + timeSlot) > 0.82) {
            col.r = 1.0 - col.r;
            col.b = fract(col.b * 2.0);
        }
    }

    // 6. Jagged Ground-Plane Noise Bar
    float groundBar = step(0.95, hash11(uv.y * 8.0 + t * 14.0)) * isFaultActive * u_intensity;
    col = mix(col, vec3(1.0), groundBar * 0.7);

    out_col = vec4(clamp(col, 0.0, 1.0), baseColor.a);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(UV, col);
    COLOR = col;
}
