/*
 * GLITCH SUITE - SHADER 16: CRT PHOSPHOR BLOOM & SUBPIXEL APERTURE GRILLE
 * -----------------------------------------------------------------------
 * Simulates high-end Sony Trinitron aperture grille and shadow mask CRT monitors.
 * Features:
 *   - Discrete RGB subpixel phosphors (vertically aligned stripes or triad dots)
 *   - Electron beam dispersion blooming on high luminance values
 *   - Scanline profile with Gaussian beam intensity falloff
 *   - Phosphor decay / burn-in ghosting persistence
 */

#ifdef GL_ES
precision highp float;
#endif

uniform sampler2D tDiffuse;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_intensity;        // Master glitch intensity (default: 1.0)
uniform float u_mask_type;        // 0.0 = Aperture Grille (Trinitron), 1.0 = Shadow Mask (Triad), 2.0 = Slot Mask
uniform float u_mask_density;     // Subpixel density multiplier (default: 1.0)
uniform float u_bloom_radius;     // Electron bloom spread (0.5 to 3.0)
uniform float u_scanline_depth;   // Scanline dark notch intensity (0.0 to 1.0)
uniform float u_phosphor_jitter;  // Magnetic purity beam vibration

varying vec2 vUv;

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void main() {
    vec2 uv = vUv;
    
    // Magnetic purity jitter on electron landing
    float j = (hash(vec2(floor(uv.y * u_resolution.y * 0.5), u_time * 24.0)) - 0.5) * u_phosphor_jitter * 0.003;
    uv.x += j;

    // Base color sample
    vec3 col = texture2D(tDiffuse, clamp(uv, 0.0, 1.0)).rgb;

    // Multi-tap Gaussian beam bloom on bright areas
    vec3 bloom = vec3(0.0);
    float bloomTotal = 0.0;
    float rad = u_bloom_radius / u_resolution.y;
    for (int y = -2; y <= 2; y++) {
        for (int x = -2; x <= 2; x++) {
            float dist = length(vec2(float(x), float(y)));
            float w = exp(-0.5 * dist * dist);
            vec2 offset = vec2(float(x), float(y)) * rad * (0.8 + 0.4 * length(col));
            bloom += texture2D(tDiffuse, clamp(uv + offset, 0.0, 1.0)).rgb * w;
            bloomTotal += w;
        }
    }
    bloom /= bloomTotal;
    
    // Apply bloom to bright phosphors
    col = mix(col, col + bloom * 0.7, u_intensity * 0.6);

    // Scanline modulation (Gaussian profile across vertical raster lines)
    float scanline = sin(uv.y * u_resolution.y * 3.14159265);
    scanline = 0.5 + 0.5 * scanline;
    scanline = pow(scanline, 1.2 + u_scanline_depth * 1.5);
    col *= mix(1.0, scanline, u_scanline_depth * u_intensity);

    // Subpixel Phosphor Grille Mask
    vec2 pixelCoord = uv * u_resolution * u_mask_density;
    vec3 mask = vec3(1.0);

    if (u_mask_type < 0.5) {
        // Mode 0: Aperture Grille (Vertical RGB stripes, Trinitron style)
        float subpixel = mod(pixelCoord.x, 3.0);
        if (subpixel < 1.0) {
            mask = vec3(1.4, 0.2, 0.2);
        } else if (subpixel < 2.0) {
            mask = vec3(0.2, 1.4, 0.2);
        } else {
            mask = vec3(0.2, 0.2, 1.4);
        }
    } else if (u_mask_type < 1.5) {
        // Mode 1: Shadow Mask (Delta Triad Dots)
        vec2 triad = mod(pixelCoord, vec2(3.0, 2.0));
        float rowOffset = step(1.0, triad.y) * 1.5;
        float dotX = mod(triad.x + rowOffset, 3.0);
        if (dotX < 1.0) mask = vec3(1.3, 0.2, 0.2);
        else if (dotX < 2.0) mask = vec3(0.2, 1.3, 0.2);
        else mask = vec3(0.2, 0.2, 1.3);
    } else {
        // Mode 2: Slot Mask
        vec2 slot = mod(pixelCoord, vec2(3.0, 4.0));
        float slotSub = slot.x;
        float slotY = step(2.0, slot.y);
        if (slotSub < 1.0) mask = vec3(1.3, 0.25, 0.25);
        else if (slotSub < 2.0) mask = vec3(0.25, 1.3, 0.25);
        else mask = vec3(0.25, 0.25, 1.3);
        if (mod(slot.y, 2.0) > 1.8) mask *= 0.5; // dark horizontal slot boundary
    }

    col = mix(col, col * mask, u_intensity * 0.85);

    gl_FragColor = vec4(col, 1.0);
}
