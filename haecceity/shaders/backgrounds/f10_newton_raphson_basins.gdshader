shader_type canvas_item;
uniform float u_fade = 1.0;
uniform sampler2D tDiffuse : hint_default_black;
uniform sampler2D tPrevFrame : hint_default_black;
uniform vec2 u_resolution = vec2(1060.0, 550.0);
uniform float u_time = 0.0;
/*
 * FRACTAL REALMS - SHADER F10: NEWTON-RAPHSON COMPLEX BASINS OF ATTRACTION
 * --------------------------------------------------------------------------
 * Visualizes the chaotic Julia boundaries between attraction basins for Newton's root-finding method:
 *   z_{n+1} = z_n - alpha * (f(z_n) / f'(z_n))
 * Applied to quintic polynomials with dynamic roots:
 *   f(z) = z^5 - 1 = 0   (Fifth roots of unity)
 * Features:
 *   - Relaxed step-size parameter alpha: introduces period-doubling and Mandelbrot filaments
 *   - Convergence velocity shading (smooth shading based on iteration fraction)
 *   - Basin boundary halos and complex phase contour striations
 */






uniform float u_intensity = 1.0;        // Morph factor (default: 1.0)
uniform float u_relaxation = 1.0;       // Relaxation factor alpha (0.5 to 1.5, default: 1.0)
uniform float u_root_morph = 1.0;       // Root oscillation amplitude
uniform float u_contour_density = 1.0;  // Equipotential contour frequency
uniform float u_zoom = 1.0;             // Complex plane magnification



// Complex arithmetic
vec2 cMul(vec2 a, vec2 b) {
    return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
}

vec2 cDiv(vec2 a, vec2 b) {
    float d = dot(b, b);
    return vec2(dot(a, b), a.y * b.x - a.x * b.y) / max(d, 1e-8);
}

vec2 cPower(vec2 z, int p) {
    vec2 res = vec2(1.0, 0.0);
    for (int i = 0; i < 5; i++) {
        if (i >= p) break;
        res = cMul(res, z);
    }
    return res;
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 p = (vUv - 0.5) * 2.0;
    p.x *= u_resolution.x / u_resolution.y;

    float zoom = max(0.5, u_zoom);
    vec2 z = p / zoom;

    // Define roots of quintic equation: z^5 - 1 = 0
    // Dynamic root modulation
    float morph = u_root_morph * sin(u_time * 0.5) * u_intensity;
    float alpha = max(0.2, u_relaxation);

    int rootIndex = -1;
    float iterCount = 0.0;
    int MAX_IT = 40;

    for (int i = 0; i < MAX_IT; i++) {
        // Evaluate f(z) = z^5 - 1 and f'(z) = 5 * z^4
        vec2 z4 = cPower(z, 4);
        vec2 z5 = cMul(z4, z);

        vec2 f = z5 - vec2(1.0 + morph, 0.0);
        vec2 fPrime = 5.0 * z4;

        // Newton step: z = z - alpha * (f / fPrime)
        vec2 stepDelta = cDiv(f, fPrime);
        z = z - alpha * stepDelta;

        if (dot(stepDelta, stepDelta) < 1e-6) {
            iterCount = float(i);
            break;
        }
    }

    // Identify which 5th root was converged to: e^{i * 2*pi*k / 5}
    float angle = atan(z.y, z.x);
    if (angle < 0.0) angle += 6.2831853;
    float sector = floor(angle / (6.2831853 / 5.0) + 0.5);
    sector = mod(sector, 5.0);

    // 5 Distinct Basin Colors
    vec3 c0 = vec3(0.95, 0.2, 0.3);  // Ruby
    vec3 c1 = vec3(0.1, 0.8, 0.95);  // Cyan
    vec3 c2 = vec3(0.95, 0.75, 0.1); // Amber
    vec3 c3 = vec3(0.2, 0.95, 0.4);  // Jade
    vec3 c4 = vec3(0.7, 0.2, 0.95);  // Amethyst

    vec3 baseColor = c0;
    if (sector == 1.0) baseColor = c1;
    else if (sector == 2.0) baseColor = c2;
    else if (sector == 3.0) baseColor = c3;
    else if (sector == 4.0) baseColor = c4;

    // Convergence Speed Shading
    float speedShade = 1.0 - (iterCount / float(MAX_IT));
    speedShade = pow(speedShade, 1.2);

    // Equipotential Contour Lines
    float contours = sin(iterCount * u_contour_density * 0.5 + angle * 2.0);
    float contourStripe = 0.85 + 0.15 * smoothstep(-0.2, 0.2, contours);

    vec3 col = baseColor * speedShade * contourStripe;

    // Basin Boundary Dark Ring / Edge Highlight
    float edgeGlow = smoothstep(float(MAX_IT) - 3.0, float(MAX_IT), iterCount);
    col = mix(col, vec3(0.0), edgeGlow * 0.9);

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
