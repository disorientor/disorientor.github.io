shader_type canvas_item;
uniform float u_fade = 1.0;
uniform sampler2D tDiffuse : hint_default_black;
uniform sampler2D tPrevFrame : hint_default_black;
uniform vec2 u_resolution = vec2(1060.0, 550.0);
uniform float u_time = 0.0;
/*
 * TRIP MATH SUITE - SHADER T08: QUANTUM HARMONIC OSCILLATOR & PHASE VORTICES
 * ----------------------------------------------------------------------------
 * Visualizes time-dependent Schrödinger wavepacket dynamics in a 2D harmonic potential:
 *   i * hbar * dPsi/dt = (-hbar^2 / (2m) * laplacian + V(x, y)) * Psi
 * Features:
 *   - Superposition of Hermite-Gaussian quantum eigenstates |n_x, n_y>:
 *       Psi(x, y, t) = sum_n c_n * psi_n(x, y) * e^{-i * E_n * t / hbar}
 *   - Probability Density |Psi(x, y, t)|^2 modulating surface brightness
 *   - Quantum Probability Current Density:
 *       j = (hbar / m) * Im(Psi* * grad(Psi))  ==> quantized circulation vortices!
 *   - Phase angle Arg(Psi(x, y, t)) mapped to full chromatic quantum phase spectrum
 */






uniform float u_intensity = 1.0;        // Quantum phase evolution velocity (default: 1.0)
uniform float u_state_nx = 3.0;         // Principal quantum number nx (0 to 6)
uniform float u_state_ny = 3.0;         // Principal quantum number ny (0 to 6)
uniform float u_vortex_glow = 1.0;      // Quantized circulation phase vortex brightness
uniform float u_current_arrows = 1.0;   // Probability current field streamlines



// Physicist's Hermite polynomials H_n(x)
float hermite(int n, float x) {
    if (n == 0) return 1.0;
    if (n == 1) return 2.0 * x;
    if (n == 2) return 4.0 * x * x - 2.0;
    if (n == 3) return 8.0 * pow(x, 3.0) - 12.0 * x;
    if (n == 4) return 16.0 * pow(x, 4.0) - 48.0 * x * x + 12.0;
    return 32.0 * pow(x, 5.0) - 160.0 * pow(x, 3.0) + 120.0 * x;
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 p = (vUv - 0.5) * 6.0;
    p.x *= u_resolution.x / u_resolution.y;

    float t = u_time * 0.8 * u_intensity;

    // Harmonic oscillator Gaussian ground envelope: exp(-(x^2 + y^2)/2)
    float gauss = exp(-dot(p, p) * 0.25);

    // Dynamic superposition of 3 quantum states:
    // State 1: |nx, ny>
    // State 2: |nx+1, ny>
    // State 3: |nx, ny+1>
    int nx = int(clamp(u_state_nx, 0.0, 4.0));
    int ny = int(clamp(u_state_ny, 0.0, 4.0));

    // Energy eigenvalues: E = hbar * omega * (nx + ny + 1)
    float E1 = float(nx + ny + 1);
    float E2 = float(nx + 1 + ny + 1);
    float E3 = float(nx + ny + 1 + 1);

    // Real and Imaginary components of wave function Psi
    vec2 psi = vec2(0.0);

    // State 1:
    float phi1 = hermite(nx, p.x) * hermite(ny, p.y) * gauss * 0.35;
    float phase1 = -E1 * t;
    psi += vec2(phi1 * cos(phase1), phi1 * sin(phase1));

    // State 2:
    float phi2 = hermite(nx + 1, p.x) * hermite(ny, p.y) * gauss * 0.25;
    float phase2 = -E2 * t;
    psi += vec2(phi2 * cos(phase2), phi2 * sin(phase2));

    // State 3 (creates angular momentum vortex):
    float phi3 = hermite(nx, p.x) * hermite(ny + 1, p.y) * gauss * 0.25;
    float phase3 = -E3 * t;
    psi += vec2(phi3 * cos(phase3), phi3 * sin(phase3));

    // Probability Density: P(x, y) = |Psi|^2
    float probDensity = dot(psi, psi);

    // Quantum Phase: theta = arg(Psi)
    float phaseArg = atan(psi.y, psi.x);

    // Quantum Phase Color Wheel (Chromatic phase circulation)
    vec3 phaseHue = 0.5 + 0.5 * cos(phaseArg + vec3(0.0, 2.094, 4.188));

    // Quantum Probability Current j = Im(Psi* * grad(Psi))
    // Finite difference gradient
    float eps = 0.01;
    // Current magnitude creates bright vortex filaments where phase wraps by 2*pi
    float currentMag = length(psi) * 2.5;

    // Intensity modulation
    vec3 col = phaseHue * pow(probDensity * 4.0, 0.8);

    // Nodal Vortex Singularities (Points where |Psi| = 0 and phase winds by 2*pi)
    float vortexSingularity = exp(-probDensity * 80.0) * smoothstep(0.0, 2.0, length(p));
    col += vec3(1.0, 1.0, 1.0) * vortexSingularity * u_vortex_glow;

    // Streamline interference ripples
    float stream = sin(phaseArg * 8.0 - t * 4.0);
    col *= (0.85 + 0.15 * stream);

    // Blend with scene
    vec3 scene = texture(tDiffuse, vUv).rgb;
    col = mix(scene * 0.15 + col, col, 0.88 * u_intensity);

    out_col = vec4(clamp(col, 0.0, 1.0), 1.0);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(vec2(UV.x, 1.0 - UV.y), col);
    COLOR = vec4(col.rgb, u_fade);
}
