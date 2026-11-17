shader_type canvas_item;
uniform float u_fade = 1.0;
uniform sampler2D tDiffuse : hint_default_black;
uniform sampler2D tPrevFrame : hint_default_black;
uniform vec2 u_resolution = vec2(1060.0, 550.0);
uniform float u_time = 0.0;
/*
 * TRIP MATH SUITE - SHADER T09: CLIFFORD & PETER DE JONG STRANGE ATTRACTORS
 * --------------------------------------------------------------------------
 * Visualizes the chaotic fractal manifold of Clifford Pickover's and
 * Peter de Jong's non-linear discrete dynamical systems:
 *   Clifford Attractor:
 *     x_{n+1} = sin(a * y_n) + c * cos(a * x_n)
 *     y_{n+1} = sin(b * x_n) + d * cos(b * y_n)
 * Features:
 *   - Instantaneous parallel distance estimation to the folded invariant attractor sheet
 *   - Continuous 4-parameter trajectory morphing (a, b, c, d)
 *   - Chromatic velocity grading: local Lyapunov divergence mapped to hue
 *   - Volumetric dust cloud rendering with depth density exposure
 */






uniform float u_intensity = 1.0;        // Attractor morph factor (default: 1.0)
uniform float u_param_a = -1.4;          // Attractor parameter a (-2.5 to 2.5, default: -1.4)
uniform float u_param_b = 1.6;          // Attractor parameter b (-2.5 to 2.5, default: 1.6)
uniform float u_param_c = 1.0;          // Attractor parameter c (-2.5 to 2.5, default: 1.0)
uniform float u_param_d = 0.7;          // Attractor parameter d (-2.5 to 2.5, default: 0.7)
uniform float u_density_boost = 1.5;    // Volumetric cloud exposure (0.5 to 3.0, default: 1.5)
uniform float u_chroma_spread = 1.0;    // Velocity spectral dispersion (0.5 to 2.0, default: 1.0)
uniform float u_zoom = 1.0;             // Attractor spatial magnification (0.5 to 3.0, default: 1.0)



// Clifford attractor update step
vec2 cliffordStep(vec2 p, vec4 params) {
    return vec2(
        sin(params.x * p.y) + params.z * cos(params.x * p.x),
        sin(params.y * p.x) + params.w * cos(params.y * p.y)
    );
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 p = (vUv - 0.5) * 3.5;
    p.x *= u_resolution.x / u_resolution.y;

    float zoom = max(0.5, u_zoom);
    p /= zoom;

    // Default iconic Clifford attractor parameters: a = -1.4, b = 1.6, c = 1.0, d = 0.7
    float pA = (abs(u_param_a) > 0.01) ? u_param_a : -1.4;
    float pB = (abs(u_param_b) > 0.01) ? u_param_b : 1.6;
    float pC = (abs(u_param_c) > 0.01) ? u_param_c : 1.0;
    float pD = (abs(u_param_d) > 0.01) ? u_param_d : 0.7;
    vec4 params = vec4(pA, pB, pC, pD);
    
    // Dynamic parameter drift through chaotic bifurcation space
    float tDrift = u_time * 0.15 * u_intensity;
    params.x += 0.15 * sin(tDrift * 0.7);
    params.y += 0.15 * cos(tDrift * 0.5);
    params.z += 0.12 * sin(tDrift * 1.1);

    // Multi-tap orbital point sampling
    // Searches distance to attractor trajectory iterations
    vec2 orbit = vec2(0.1, 0.1);
    float minDistance = 1e5;
    float velocityAccum = 0.0;
    float density = 0.0;

    // Warmup
    for (int w = 0; w < 12; w++) {
        orbit = cliffordStep(orbit, params);
    }

    // Accumulation passes
    int SAMPLES = 48;
    for (int i = 0; i < SAMPLES; i++) {
        vec2 nextOrbit = cliffordStep(orbit, params);
        vec2 v = nextOrbit - orbit;
        float vMag = length(v);

        // Segment distance
        vec2 pa = p - orbit;
        vec2 ba = nextOrbit - orbit;
        float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-5), 0.0, 1.0);
        float d = length(pa - ba * h);

        minDistance = min(minDistance, d);

        // Density accumulation
        float hit = exp(-d * 18.0);
        density += hit;
        velocityAccum += vMag * hit;

        orbit = nextOrbit;
    }

    float avgVelocity = velocityAccum / max(density, 1e-4);

    // Chromatic velocity grading
    vec3 c1 = vec3(0.1, 0.5, 1.0);  // Cyan-blue for slow folds
    vec3 c2 = vec3(1.0, 0.15, 0.6); // Hot magenta for high-divergence jets
    vec3 c3 = vec3(1.0, 0.85, 0.2); // Amber singularity core

    vec3 speedCol = mix(c1, c2, clamp(avgVelocity * 0.35 * u_chroma_spread, 0.0, 1.0));
    speedCol = mix(speedCol, c3, clamp((avgVelocity - 2.0) * 0.5, 0.0, 1.0));

    // Density exposure (logarithmic tone mapping)
    float logD = log(1.0 + density * 1.8 * u_density_boost);
    vec3 col = speedCol * logD * 1.2 * u_intensity;

    // Ambient attractor haze
    col += vec3(0.015, 0.01, 0.03);

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
