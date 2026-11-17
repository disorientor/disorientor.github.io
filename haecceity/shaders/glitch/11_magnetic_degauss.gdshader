shader_type canvas_item;
#include "visual_panel_sampling.gdshaderinc"
uniform sampler2D tDiffuse : hint_screen_texture, filter_linear_mipmap;
uniform sampler2D tPrevFrame : hint_screen_texture, filter_linear_mipmap;
uniform vec2 u_resolution = vec2(1920.0, 1080.0);
uniform float u_time = 0.0;
/*
 * GLITCH SUITE - SHADER 11: MAGNETIC DE-GAUSS & BEAM PURITY TWIST
 * ---------------------------------------------------------------
 * Simulates extreme electromagnetic interference on a CRT display, such as
 * holding a neodymium magnet against the shadow mask or firing a degauss coil.
 * The electron beam deflection coils experience Lorentz torque:
 *   F = q (E + v x B)
 * Resulting in non-linear spatial vortex swirl, electron landing angle deflection,
 * and phosphor purity collapse (pure concentric rings of Red, Green, and Blue
 * around the magnetic pole).
 */






uniform float u_intensity = 1.0;       // Magnetic field strength (default: 1.0)
uniform float u_magnet_x = 0.5;        // Center of magnetic pole X (default: 0.5)
uniform float u_magnet_y = 0.5;        // Center of magnetic pole Y (default: 0.5)
uniform float u_twist_angle = 3.5;     // Rotational torque twist amount (default: 3.5)
uniform float u_degauss_pulse = 0.5;   // Oscillating damped degaussing vibration pulse (0.0 to 1.0)



// 2D Rotation matrix
vec2 rotate(vec2 p, float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 uv = vUv;
    vec2 magPos = vec2(u_magnet_x, u_magnet_y);
    if (u_magnet_x <= 0.001 && u_magnet_y <= 0.001) {
        magPos = vec2(0.5, 0.5);
    }

    // Vector from magnetic pole
    vec2 delta = uv - magPos;
    // Aspect ratio correction for circular field lines
    delta.x *= u_resolution.x / u_resolution.y;
    float dist = length(delta);

    // Magnetic field falloff (Dipole inverse power law ~ 1 / (r^2 + eps))
    float fieldStrength = 1.0 / (1.0 + dist * dist * 14.0) * u_intensity;

    // Degaussing oscillation ripple (damped sine wave traveling outwards)
    float degaussWave = 0.0;
    if (u_degauss_pulse > 0.01) {
        float wavePhase = dist * 25.0 - u_time * 18.0;
        float decay = exp(-dist * 3.5) * exp(-fract(u_time * 0.8) * 3.0);
        degaussWave = sin(wavePhase) * decay * u_degauss_pulse * 0.12;
    }

    // 1. Spatial Lorentz Torque Twisting
    // The electron beam twists around the magnetic field axis
    float totalTwist = (fieldStrength * u_twist_angle + degaussWave);
    vec2 twistedDelta = rotate(delta, totalTwist);

    // Radial pinch / displacement
    float radialPinch = (1.0 - fieldStrength * 0.3);
    twistedDelta *= radialPinch;

    // Reconstruct UV coordinates
    twistedDelta.x /= (u_resolution.x / u_resolution.y);
    vec2 warpedUv = magPos + twistedDelta;

    // 2. Sample RGB with Differential Beam Landing Separation
    // Red, green, and blue electron guns are angled slightly differently,
    // so the magnetic field deflects each color gun by different amounts!
    float gunSplit = fieldStrength * 0.035 * u_intensity;
    vec2 rUv = warpedUv + normalize(delta + vec2(1e-4)) * gunSplit;
    vec2 gUv = warpedUv;
    vec2 bUv = warpedUv - normalize(delta + vec2(1e-4)) * gunSplit * 1.3;

    float r = sample_visual_panel(tDiffuse, clamp(rUv, 0.0, 1.0)).r;
    float g = sample_visual_panel(tDiffuse, clamp(gUv, 0.0, 1.0)).g;
    float b = sample_visual_panel(tDiffuse, clamp(bUv, 0.0, 1.0)).b;
    vec3 col = vec3(r, g, b);

    // 3. Phosphor Purity Failure Rings
    // When electrons hit adjacent phosphor dots, pure colored halos form
    float purityPhase = dist * 35.0 - totalTwist * 2.0;
    vec3 purityMask = vec3(
        sin(purityPhase) * 0.5 + 0.5,
        sin(purityPhase + 2.094) * 0.5 + 0.5, // 120 deg phase
        sin(purityPhase + 4.188) * 0.5 + 0.5  // 240 deg phase
    );

    // Blend purity color tint based on field strength
    col = mix(col, col * purityMask * 2.2, clamp(fieldStrength * 1.8, 0.0, 0.85));

    // Additive phosphor excitation & magnetic beam vortex glow
    vec3 magneticGlow = purityMask * fieldStrength * 0.65;
    col += magneticGlow * u_intensity;

    // Core magnetic saturation glow (near pole center)
    float coreBloom = exp(-dist * 12.0) * u_intensity;
    col += vec3(0.9, 0.2, 0.8) * coreBloom * 0.5;

    out_col = vec4(clamp(col, 0.0, 1.0), 1.0);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(UV, col);
    COLOR = col;
}
