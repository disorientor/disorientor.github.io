shader_type canvas_item;
uniform float u_fade = 1.0;
uniform sampler2D tDiffuse : hint_default_black;
uniform sampler2D tPrevFrame : hint_default_black;
uniform vec2 u_resolution = vec2(1060.0, 550.0);
uniform float u_time = 0.0;
/*
 * TRIP MATH SUITE - SHADER T07: COMPLEX DOMAIN COLORING & DEDEKIND ETA MODULAR FORM
 * -----------------------------------------------------------------------------------
 * Visualizes holomorphic and modular functions on the complex upper half-plane H:
 *   - The Dedekind Eta Function eta(tau) = q^{1/24} * prod_{n=1}^inf (1 - q^n), where q = e^{2*pi*i*tau}
 *   - Invariance under the modular group PSL(2, Z) (S: tau -> -1/tau, T: tau -> tau + 1)
 *   - Domain Coloring:
 *       Hue = arg(f(z)) (Complex argument / phase angle in [0, 2*pi])
 *       Brightness = log(|f(z)|) modulus contours (conformal orthogonal grid lines)
 *   - Reveals the fractal boundary along the real axis Im(tau) -> 0 and infinite cusps.
 */






uniform float u_intensity = 1.0;        // Modular flow speed (default: 1.0)
uniform float u_contour_density = 17.5;  // Modulus log contour frequency (5.0 to 30.0)
uniform float u_grid_saturation = 1.0;  // Conformal polar grid contrast
uniform float u_zoom = 1.0;             // Complex plane magnification
uniform float u_tau_x = 0.0;            // Upper half-plane center coordinate X (default: 0.0)
uniform float u_tau_y = 0.8;            // Upper half-plane center coordinate Y (default: 0.8)



// Complex arithmetic
vec2 cMul(vec2 a, vec2 b) {
    return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
}

vec2 cExp(vec2 z) {
    float r = exp(clamp(z.x, -25.0, 25.0));
    return vec2(r * cos(z.y), r * sin(z.y));
}

// Approximation of Dedekind eta function via Euler pentagonal number theorem:
// prod_{n=1}^inf (1 - q^n) = sum_{k=-inf}^inf (-1)^k * q^{k*(3k-1)/2}
vec2 dedekindEta(vec2 tau) {
    float pi = 3.14159265;
    // q = exp(2 * pi * i * tau) = exp(-2*pi*tau.y) * exp(i * 2*pi*tau.x)
    vec2 twoPiITau = vec2(-2.0 * pi * tau.y, 2.0 * pi * tau.x);
    vec2 q = cExp(twoPiITau);

    // Initial factor: q^{1/24}
    vec2 q24 = cExp(twoPiITau / 24.0);

    // Sum pentagonal terms for k = -4 to +4
    vec2 sumP = vec2(1.0, 0.0);
    vec2 qPower = q;

    // Direct product approximation
    for (int n = 1; n <= 8; n++) {
        vec2 qN = cExp(twoPiITau * float(n));
        vec2 oneMinusQn = vec2(1.0, 0.0) - qN;
        sumP = cMul(sumP, oneMinusQn);
    }

    return cMul(q24, sumP);
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 p = (vUv - 0.5) * 2.0;
    p.x *= u_resolution.x / u_resolution.y;

    float zoom = max(0.5, u_zoom);
    float cy = (u_tau_y <= 0.001) ? 0.8 : u_tau_y;
    vec2 center = vec2(u_tau_x, cy);

    // Complex tau coordinate in upper half-plane (Im(tau) > 0)
    vec2 tau = center + vec2(p.x, p.y) / zoom;
    tau.y = max(tau.y, 0.02); // Avoid singularity on real line

    // Dynamic horizontal modular flow (T transform translation)
    tau.x += u_time * 0.15 * u_intensity;

    // Evaluate Dedekind eta function
    vec2 eta = dedekindEta(tau);

    // Complex argument (phase) in [0, 2*pi]
    float phase = atan(eta.y, eta.x);
    if (phase < 0.0) phase += 6.2831853;

    // Modulus |f(z)|
    float modulus = length(eta);
    float logMod = log(max(modulus, 1e-6));

    // Phase to RGB Hue (Domain Coloring wheel)
    vec3 phaseColor = 0.5 + 0.5 * cos(phase + vec3(0.0, 2.094, 4.188)); // 120 degree shifts

    // Modulus Equipotential Contour Rings
    float contourFreq = max(5.0, u_contour_density);
    float contour = sin(logMod * contourFreq);
    float contourGrid = 0.8 + 0.2 * smoothstep(-0.3, 0.3, contour);

    // Conformal Iso-Phase Radial Ray Lines
    float phaseGrid = sin(phase * 12.0);
    float isPhaseRay = 0.85 + 0.15 * smoothstep(-0.2, 0.2, phaseGrid);

    // Combine conformal grid
    vec3 col = phaseColor * contourGrid * isPhaseRay;

    // Highlights on poles and zeros
    float zeroGlow = exp(-modulus * 4.0);
    col += vec3(1.0, 1.0, 1.0) * zeroGlow * 0.6;

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
