shader_type canvas_item;
uniform float u_fade = 1.0;
uniform sampler2D tDiffuse : hint_default_black;
uniform sampler2D tPrevFrame : hint_default_black;
uniform vec2 u_resolution = vec2(1060.0, 550.0);
uniform float u_time = 0.0;
/*
 * VORTEX REALMS - SHADER V03: DMT HYPERBOLIC KALEIDOSCOPIC VORTEX
 * ---------------------------------------------------------------
 * An accelerating headfirst plunge into a self-transforming hyper-dimensional DMT
 * visionary vortex.
 * Features:
 *   - Poincaré hyperbolic tessellation folded into an infinite logarithmic funnel
 *   - N-fold kaleidoscopic domain folding mirrors (8-fold / 12-fold symmetry)
 *   - Complex inversion w = 1/z creating infinite recursive nested mandalas
 *   - Continuous forward spatial dive with golden ratio phyllotaxis rotations
 *   - Hyper-saturated spectral palette cycling through ultraviolet, neon lime & magenta
 */






uniform float u_intensity = 1.0;           // Transcendental intensity (default: 1.0)
uniform float u_dive_speed = 2.8;          // Inward vortex plunge velocity (0.5 to 6.0, default: 2.8)
uniform float u_fold_symmetry = 7.0;       // Kaleidoscopic mirror sector count (3.0 to 12.0, default: 7.0)
uniform float u_spiral_twist = 2.2;        // Logarithmic spiral twist torque (0.5 to 5.0, default: 2.2)
uniform float u_morph_cycles = 1.5;        // Internal geometric breathing frequency (0.5 to 4.0, default: 1.5)
uniform float u_psychedelic_glow = 1.8;    // Bioluminescent energy bloom (0.5 to 3.0, default: 1.8)



vec2 rot(vec2 p, float a) {
    float s = sin(a), c = cos(a);
    return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}

// Cosine spectral palette generator
vec3 dmtPalette(float t) {
    vec3 a = vec3(0.5, 0.5, 0.5);
    vec3 b = vec3(0.5, 0.5, 0.5);
    vec3 c = vec3(1.0, 1.0, 1.0);
    vec3 d = vec3(0.0, 0.333, 0.667);
    return a + b * cos(6.2831853 * (c * t + d));
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 p = (vUv - 0.5) * 2.0;
    p.x *= u_resolution.x / u_resolution.y;

    float r = max(length(p), 0.0005);
    float theta = atan(p.y, p.x);

    // Hyperbolic logarithmic depth coordinate (inward flight)
    float time = u_time * u_dive_speed * u_intensity;
    float depth = -log(r) * 1.5 + time;

    // Logarithmic spiral vortex twisting
    theta += depth * 0.4 * u_spiral_twist;

    // N-Fold Kaleidoscopic Sector Folding
    float sectors = max(3.0, floor(u_fold_symmetry));
    float sectorAngle = 6.2831853 / sectors;
    theta = mod(theta, sectorAngle) - sectorAngle * 0.5;
    theta = abs(theta); // Mirror fold

    // Reconstruct folded coordinates
    vec2 foldedP = vec2(cos(theta), sin(theta)) * r;

    // Multi-scale Iterated Function System (IFS) fractal folding
    vec2 z = vec2(theta * sectors, depth * 0.5);
    float scale = 1.0;
    float trap = 1e5;

    for (int i = 0; i < 5; i++) {
        z = abs(z) - vec2(0.6, 0.8 + 0.2 * sin(time * 0.5 * u_morph_cycles));
        z = rot(z, 0.6180339 * 3.14159); // Golden ratio rotation
        z *= 1.45;
        scale *= 1.45;
        trap = min(trap, length(z));
    }

    // Concentric hyper-dimensional gear rings and sacred geometry lattices
    float gear = sin(depth * 3.0 + theta * sectors * 2.0);
    float sacredWeb = smoothstep(0.12, 0.02, abs(sin(z.x * 2.0) * cos(z.y * 2.0)));

    // Spectral coloring cycling with depth and fractal trap
    float colorPhase = depth * 0.15 + trap * 0.5 - u_time * 0.4;
    vec3 baseCol = dmtPalette(colorPhase);
    vec3 neonAccent = dmtPalette(colorPhase + 0.5);

    vec3 col = baseCol * (0.6 + 0.6 * gear);
    col += neonAccent * sacredWeb * 2.2 * u_psychedelic_glow;

    // Organic breathing pulsation rings
    float pulse = pow(sin(depth * 6.0 - u_time * 8.0) * 0.5 + 0.5, 8.0);
    col += vec3(1.0, 0.8, 0.2) * pulse * 2.0;

    // Infinite vanishing point singularity illumination
    float coreSingularity = exp(-r * 6.0);
    vec3 coreColor = vec3(1.0, 1.0, 1.0) + dmtPalette(u_time * 2.0) * 0.8;
    col += coreColor * coreSingularity * 3.0;

    // Peripheral chromatic lens flare / aberration
    vec2 sampleUv = vUv + p * (0.02 / (r + 0.1));
    vec3 sceneTex = texture(tDiffuse, clamp(sampleUv, 0.0, 1.0)).rgb;
    col = mix(col, col * 0.7 + sceneTex * 0.35, 0.5);

    // Dynamic contrast boost
    col = pow(col, vec3(1.15));

    out_col = vec4(clamp(col, 0.0, 1.0), 1.0);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(vec2(UV.x, 1.0 - UV.y), col);
    COLOR = vec4(col.rgb, u_fade);
}
