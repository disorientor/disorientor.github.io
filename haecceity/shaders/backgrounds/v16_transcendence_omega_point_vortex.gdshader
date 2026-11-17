shader_type canvas_item;
uniform float u_fade = 1.0;
uniform sampler2D tDiffuse : hint_default_black;
uniform sampler2D tPrevFrame : hint_default_black;
uniform vec2 u_resolution = vec2(1060.0, 550.0);
uniform float u_time = 0.0;
/*
 * VORTEX REALMS - SHADER V16: TRANSCENDENCE OMEGA POINT VORTEX SINGULARITY
 * ------------------------------------------------------------------------
 * The ultimate psychedelic climax: accelerating directly into the cosmic Omega Point
 * where all dimensions, timelines, and geometry collapse into pure radiant consciousness.
 * Features:
 *   - Golden-ratio Fibonacci logarithmic spiral vortex expanding to infinite magnification
 *   - Conformal hyperspace warp compression (relativistic optical aberration)
 *   - Multi-dimensional radiant laser god rays bursting outward from the singularity
 *   - Continuous infinite spatial plunge with iridescent hyper-chromatic palette cycling
 *   - Transcendental white-gold core bloom illuminating the entire visual field
 */






uniform float u_intensity = 1.0;            // Transcendental energy factor (default: 1.0)
uniform float u_dive_speed = 2.8;           // Singularity plunge velocity (0.5 to 6.0, default: 2.8)
uniform float u_spiral_arms = 5.0;          // Golden spiral branch count (2.0 to 12.0, default: 5.0)
uniform float u_singularity_flare = 2.5;    // Central divine core radiance (0.5 to 4.0, default: 2.5)
uniform float u_hyperspace_warp = 1.3;      // Relativistic optical compression (0.2 to 2.5, default: 1.3)
uniform float u_rainbow_frequency = 1.8;    // Spectral hue cycle rate (0.5 to 4.0, default: 1.8)



vec2 rot(vec2 p, float a) {
    float s = sin(a), c = cos(a);
    return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}

// Spectral rainbow generator
vec3 spectralRainbow(float t) {
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

    // Relativistic Optical Aberration (Compresses visual field into forward cone)
    float beta = clamp(0.75 * u_hyperspace_warp, 0.0, 0.95);
    float cosTheta = p.x / r;
    float sinTheta = p.y / r;
    r = pow(r, 1.0 / (1.0 + beta)); // Radial relativistic contraction

    // Conformal Logarithmic Spiral Coordinates w = ln(z)
    float phi = 1.6180339887; // Golden ratio
    float transit = u_time * u_dive_speed * u_intensity;
    float depth = -log(r) * 1.6 + transit;

    // Golden Spiral Streamlines
    float numArms = floor(max(2.0, u_spiral_arms));
    float spiralPhase = theta * numArms - depth * phi;

    // Multi-layered nested spiral harmonics
    float spiralArm1 = sin(spiralPhase);
    float spiralArm2 = sin(spiralPhase * 2.0 + depth * 0.5);
    float spiralPattern = spiralArm1 * 0.7 + spiralArm2 * 0.3;

    // Luminous Fibonacci caustic bands
    float caustics = pow(abs(spiralPattern), 0.4);

    // Radiant Divine Light Rays bursting from singularity
    float rays = sin(theta * 16.0 + depth * 2.0 - u_time * 4.0) * 0.5 + 0.5;
    rays = pow(rays, 4.0);

    // Spectral Palette Cycling
    float colorPhase = depth * 0.12 * u_rainbow_frequency - u_time * 0.3;
    vec3 rainbow1 = spectralRainbow(colorPhase);
    vec3 rainbow2 = spectralRainbow(colorPhase + 0.5);

    vec3 col = mix(rainbow1, rainbow2, caustics);
    col *= (0.7 + 0.8 * caustics);

    // Add radiant light rays
    col += vec3(1.0, 0.9, 0.6) * rays * 1.8 * u_singularity_flare;

    // Concentric Harmonic Pulse Rings
    float pulseRing = pow(sin(depth * 4.0 - u_time * 8.0) * 0.5 + 0.5, 6.0);
    col += vec3(1.0, 1.0, 1.0) * pulseRing * 1.5;

    // Omega Point Singularity Core (Blinding incandescent white-gold portal)
    float coreBloom = exp(-r * 4.5) * u_singularity_flare;
    vec3 divineCore = vec3(1.0, 0.98, 0.92) * 3.5;
    col = mix(col, divineCore, clamp(coreBloom, 0.0, 1.0));

    // Peripheral chromatic dispersion
    vec2 sampleUv = vUv + p * (0.04 / (r + 0.15));
    vec3 sceneTex = texture(tDiffuse, clamp(sampleUv, 0.0, 1.0)).rgb;
    col = mix(col, col * 0.7 + sceneTex * 0.4, 0.5);

    // Hyper-saturation and contrast punch
    col = pow(col, vec3(1.1));

    out_col = vec4(clamp(col, 0.0, 1.0), 1.0);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(vec2(UV.x, 1.0 - UV.y), col);
    COLOR = vec4(col.rgb, u_fade);
}
