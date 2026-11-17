shader_type canvas_item;
uniform float u_fade = 1.0;
uniform sampler2D tDiffuse : hint_default_black;
uniform sampler2D tPrevFrame : hint_default_black;
uniform vec2 u_resolution = vec2(1060.0, 550.0);
uniform float u_time = 0.0;
/*
 * FRACTAL REALMS - SHADER F09: LYAPUNOV EXPONENT BIOMORPH SPACE
 * ---------------------------------------------------------------
 * Maps the orbital stability of the forced logistic map:
 *   x_{n+1} = r_n * x_n * (1 - x_n)
 * where the growth parameter r_n alternates between two values (A and B)
 * according to a periodic binary sequence (e.g., "AB", "AABAB", "ABBB").
 * The Lyapunov exponent:
 *   lambda = lim_{N -> inf} (1/N) * sum_{n=1}^N ln |r_n * (1 - 2*x_n)|
 * - lambda < 0: Stable periodic cycle (crystalline stained-glass biomorphs)
 * - lambda > 0: Deterministic chaos (turbulent void)
 * - lambda = 0: Super-stable boundary bifucations
 */






uniform float u_intensity = 1.0;        // Morph factor (default: 1.0)
uniform float u_sequence_type = 0.0;    // 0 = "AB", 1 = "AABAB", 2 = "ABB"
uniform float u_param_a = 3.5;          // Logistic parameter A center (2.5 to 4.0, default: 3.5)
uniform float u_param_b = 3.5;          // Logistic parameter B center (2.5 to 4.0, default: 3.5)
uniform float u_zoom = 1.0;             // Parameter domain zoom (0.5 to 4.0, default: 1.0)
uniform float u_exponent_gamma = 0.8;   // Gamma contrast of stability bands (0.4 to 2.0, default: 0.8)



void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 uv = vUv;
    
    // Parameter plane mapping with safe bounds [2.5, 4.0]
    float cA = (u_param_a > 1.0) ? u_param_a : 3.5;
    float cB = (u_param_b > 1.0) ? u_param_b : 3.5;
    float zoom = max(0.5, u_zoom);
    float a = clamp(cA + (uv.x - 0.5) * (1.5 / zoom), 2.0, 4.0);
    float b = clamp(cB + (uv.y - 0.5) * (1.5 / zoom), 2.0, 4.0);

    // Initial state
    float x = 0.5;
    float lambda = 0.0;
    int WARMUP = 24;
    int SAMPLES = 48;

    // Sequence generator warmup cycles
    for (int i = 0; i < WARMUP; i++) {
        float r = (mod(float(i), 2.0) < 1.0) ? a : b;
        if (u_sequence_type > 0.5 && u_sequence_type < 1.5) {
            float step5 = mod(float(i), 5.0);
            r = (step5 == 0.0 || step5 == 1.0 || step5 == 3.0) ? a : b;
        } else if (u_sequence_type >= 1.5) {
            float step4 = mod(float(i), 4.0);
            r = (step4 == 0.0) ? a : b;
        }
        x = clamp(r * x * (1.0 - x), 0.0001, 0.9999);
    }

    // Accumulate Lyapunov exponent sum
    for (int i = 0; i < SAMPLES; i++) {
        float r = (mod(float(i), 2.0) < 1.0) ? a : b;
        if (u_sequence_type > 0.5 && u_sequence_type < 1.5) {
            float step5 = mod(float(i), 5.0);
            r = (step5 == 0.0 || step5 == 1.0 || step5 == 3.0) ? a : b;
        } else if (u_sequence_type >= 1.5) {
            float step4 = mod(float(i), 4.0);
            r = (step4 == 0.0) ? a : b;
        }

        // Logistic update with clamping against NaN divergence
        x = clamp(r * x * (1.0 - x), 0.0001, 0.9999);

        // Derivative: f'(x) = r * (1 - 2x)
        float deriv = abs(r * (1.0 - 2.0 * x));
        lambda += log(clamp(deriv, 1e-4, 10.0));
    }
    lambda = clamp(lambda / float(SAMPLES), -3.0, 2.0);

    vec3 col = vec3(0.0);

    // Color mapping
    float gamma = max(0.2, u_exponent_gamma);
    if (lambda < 0.0) {
        // Stable order (Stained-glass crystalline regime)
        float t = pow(clamp(-lambda * 0.7, 0.0, 1.0), gamma);
        // Rich iridescent cathedral palette: deep blue -> gold -> emerald
        vec3 c1 = vec3(0.05, 0.2, 0.85); // Cobalt
        vec3 c2 = vec3(1.0, 0.75, 0.1);  // Byzantine Gold
        vec3 c3 = vec3(0.1, 0.95, 0.5);  // Emerald
        col = (t < 0.5) ? mix(c1, c2, t * 2.0) : mix(c2, c3, (t - 0.5) * 2.0);
        col *= (0.8 + 0.2 * sin(lambda * 40.0)); // Equi-stability contour ripples
    } else {
        // Chaotic regime (Dark turbulent space with amber boundary filaments)
        float t = pow(clamp(lambda * 1.5, 0.0, 1.0), gamma);
        col = mix(vec3(0.3, 0.05, 0.0), vec3(0.02, 0.01, 0.03), t);
    }

    // Blend with texture for hybrid shader effects
    vec3 scene = texture(tDiffuse, vUv).rgb;
    col = mix(scene * 0.2 + col, col, 0.85 * u_intensity);

    out_col = vec4(clamp(col, 0.0, 1.0), 1.0);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(vec2(UV.x, 1.0 - UV.y), col);
    COLOR = vec4(col.rgb, u_fade);
}
