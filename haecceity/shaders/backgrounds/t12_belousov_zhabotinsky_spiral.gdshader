shader_type canvas_item;
uniform float u_fade = 1.0;
uniform sampler2D tDiffuse : hint_default_black;
uniform sampler2D tPrevFrame : hint_default_black;
uniform vec2 u_resolution = vec2(1060.0, 550.0);
uniform float u_time = 0.0;
/*
 * TRIP MATH SUITE - SHADER T12: BELOUSOV-ZHABOTINSKY (BZ) CHEMICAL SPIRAL WAVES
 * --------------------------------------------------------------------------------
 * Simulates non-linear oscillating chemical reactions and excitable biological media:
 *   - The Oregonator model of the Belousov-Zhabotinsky (BZ) reaction:
 *       Rotating spiral scroll waves, autowave pacemakers, and chemical target patterns.
 *   - Dispersion relation: Wavefront velocity omega(k) depends on local wavefront curvature kappa:
 *       N = N_0 - D * kappa
 *   - Unbroken spiral cores form topological defects with quantized phase circulation.
 *   - Dynamic transitions between laminar spiral waves, Doppler drift, and spiral breakup turbulence.
 */






uniform float u_intensity = 1.0;        // Reaction rate / wave speed (default: 1.0)
uniform float u_spiral_arms = 3.5;      // Number of rotating spiral arms (1 to 6)
uniform float u_turbulence = 1.0;       // Spiral core breakup / excitability noise
uniform float u_target_pacemakers = 1.0;// Number of spontaneous circular pacemaker centers
uniform float u_color_scheme = 0.0;     // 0 = Ferroin Crimson/Cobalt, 1 = Emerald Activator, 2 = Neon Cyber



float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 p = (vUv - 0.5) * 2.0;
    p.x *= u_resolution.x / u_resolution.y;

    float r = length(p);
    float theta = atan(p.y, p.x);

    float t = u_time * 1.2 * u_intensity;
    float arms = max(1.0, floor(u_spiral_arms));

    // Archimedian / logarithmic spiral phase: phi = k*r - m*theta - omega*t
    float k = 14.0;
    float spiralPhase = k * r - arms * theta - t;

    // Curvature dispersion modulation
    float curvatureWarp = sin(theta * 3.0 + r * 6.0) * u_turbulence * 0.4;
    spiralPhase += curvatureWarp;

    // Spontaneous circular target patterns (pacemakers)
    vec2 pace1 = vec2(0.45 * cos(u_time * 0.3), 0.35 * sin(u_time * 0.4));
    float dPace1 = length(p - pace1);
    float paceWave1 = sin(dPace1 * 24.0 - t * 2.0);

    // Coupled chemical state (Bromous acid activator concentration)
    float bzWave = sin(spiralPhase);
    if (u_target_pacemakers > 0.5) {
        bzWave = max(bzWave, paceWave1 * 0.85);
    }

    // Sharp chemical reaction wavefront pulse (sawtooth excitation profile)
    float activator = fract((bzWave + 1.0) * 0.5);
    activator = pow(activator, 0.6); // Fast excitation rise

    // Inhibitor phase (ferroin catalyst oxidation state)
    float inhibitor = sin(spiralPhase - 1.2);

    // Color grading based on classic BZ Ferroin redox indicator
    vec3 col = vec3(0.0);

    if (u_color_scheme < 0.5) {
        // Mode 0: Canonical Ferroin Red (reduced) to Cobalt Blue (oxidized)
        vec3 ferroinRed = vec3(0.85, 0.12, 0.15); // Reduced state Fe(phen)_3^{2+}
        vec3 cobaltBlue = vec3(0.1, 0.45, 0.95);  // Oxidized state Fe(phen)_3^{3+}
        vec3 yellowFront = vec3(1.0, 0.9, 0.3);   // Active wavecrest trigger
        col = mix(ferroinRed, cobaltBlue, activator);
        col = mix(col, yellowFront, smoothstep(0.88, 0.98, activator));
    } else if (u_color_scheme < 1.5) {
        // Mode 1: Fluorescent Emerald Biopolymer
        vec3 darkEmerald = vec3(0.02, 0.2, 0.1);
        vec3 neonGreen   = vec3(0.1, 1.0, 0.45);
        vec3 goldSpine   = vec3(1.0, 0.85, 0.2);
        col = mix(darkEmerald, neonGreen, activator);
        col = mix(col, goldSpine, smoothstep(0.85, 0.98, activator));
    } else {
        // Mode 2: Neon Cyber Hyperspace
        col = 0.5 + 0.5 * cos(activator * 6.28318 + vec3(0.0, 2.0, 4.0));
    }

    // Topological vortex core singularity highlight (center where phase is undefined)
    float coreRadius = 0.08;
    float coreGlow = exp(-r / coreRadius);
    col += vec3(1.0, 1.0, 1.0) * coreGlow * 0.8;

    // Blend with scene
    vec3 scene = texture(tDiffuse, vUv).rgb;
    col = mix(scene * 0.15 + col, col, 0.88);

    out_col = vec4(clamp(col, 0.0, 1.0), 1.0);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(vec2(UV.x, 1.0 - UV.y), col);
    COLOR = vec4(col.rgb, u_fade);
}
