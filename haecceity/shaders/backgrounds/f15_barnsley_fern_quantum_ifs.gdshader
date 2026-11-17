shader_type canvas_item;
uniform float u_fade = 1.0;
uniform sampler2D tDiffuse : hint_default_black;
uniform sampler2D tPrevFrame : hint_default_black;
uniform vec2 u_resolution = vec2(1060.0, 550.0);
uniform float u_time = 0.0;
/*
 * FRACTAL REALMS - SHADER F15: BARNSLEY FERN QUANTUM DENSITY IFS
 * ----------------------------------------------------------------
 * Evaluates Michael Barnsley's canonical 4-affine-transform fern IFS
 * reformulated as an instantaneous GPU parallel quantum density field:
 *   W1 (Stem):      x = 0, y = 0.16 * y
 *   W2 (Leaflets):  x = 0.85*x + 0.04*y, y = -0.04*x + 0.85*y + 1.6
 *   W3 (Left Pinna): x = 0.20*x - 0.26*y, y =  0.23*x + 0.22*y + 1.6
 *   W4 (Right Pinna): x = -0.15*x + 0.28*y, y = 0.26*x + 0.24*y + 0.44
 * Superimposes quantum mechanical de Broglie wave interference across fronds
 * and dynamic multi-spectral biological chlorophyl fluorescence.
 */






uniform float u_intensity = 1.0;        // Morph / growth factor (default: 1.0)
uniform float u_quantum_wave = 1.0;     // De Broglie phase interference frequency
uniform float u_wind_sway = 1.0;        // Fractal frond oscillating wind deflection
uniform float u_fluor_color = 0.0;      // 0 = Chlorophyl Emerald, 1 = Bioluminescent Cyan, 2 = Alien Amethyst



// Inverses of Barnsley's 4 affine maps to compute multi-generational density
vec2 invW2(vec2 p) {
    // Inverse of main stem leaflet
    mat2 m = mat2(vec2(0.85, -0.04), vec2(0.04, 0.85));
    float det = 0.85 * 0.85 + 0.04 * 0.04;
    mat2 invM = mat2(vec2(0.85, 0.04), vec2(-0.04, 0.85)) / det;
    return invM * (p - vec2(0.0, 1.6));
}

vec2 invW3(vec2 p) {
    // Inverse of left side frond
    mat2 m = mat2(vec2(0.20, 0.23), vec2(-0.26, 0.22));
    float det = 0.20 * 0.22 + 0.23 * 0.26;
    mat2 invM = mat2(vec2(0.22, -0.23), vec2(0.26, 0.20)) / det;
    return invM * (p - vec2(0.0, 1.6));
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 uv = vUv;
    // Map screen to fern coordinate space: X in [-3, 3], Y in [0, 10.5]
    vec2 p = vec2((uv.x - 0.5) * 6.0 * (u_resolution.x / u_resolution.y), (uv.y * 10.5));

    // Dynamic wind sway deflection
    float sway = sin(u_time * 1.5 + p.y * 0.4) * (p.y / 10.5) * 0.4 * u_wind_sway * u_intensity;
    p.x += sway;

    // Multi-generation density accumulation
    float density = 0.0;
    vec2 currP = p;

    for (int g = 0; g < 14; g++) {
        // Distance to stem line (W1)
        float dStem = length(vec2(currP.x, max(0.0, currP.y - 1.6))) - 0.04;
        density += exp(-max(dStem, 0.0) * 12.0) * 0.35;

        // Propagate backwards through affine leaflet contractions
        if (currP.x < 0.0) {
            currP = invW3(currP);
        } else {
            currP = invW2(currP);
        }

        // Bound check
        if (length(currP) > 15.0) break;
    }

    // Quantum Wave Interference Pattern (Phase-coherent de Broglie ripples)
    float qWave = sin(p.y * u_quantum_wave * 10.0 - u_time * 4.0) * sin(p.x * u_quantum_wave * 8.0);
    density *= (0.7 + 0.3 * qWave);

    // Color grading based on biological fluorescence mode
    vec3 col = vec3(0.005, 0.015, 0.02);

    vec3 bioCol;
    if (u_fluor_color < 0.5) {
        // Mode 0: Chlorophyl Emerald & Sun Gold
        bioCol = mix(vec3(0.05, 0.85, 0.3), vec3(0.9, 1.0, 0.2), clamp(density * 0.5, 0.0, 1.0));
    } else if (u_fluor_color < 1.5) {
        // Mode 1: Bioluminescent Electric Cyan
        bioCol = mix(vec3(0.0, 0.5, 0.9), vec3(0.2, 1.0, 0.8), clamp(density * 0.6, 0.0, 1.0));
    } else {
        // Mode 2: Alien Deep Amethyst
        bioCol = mix(vec3(0.6, 0.1, 0.95), vec3(1.0, 0.3, 0.7), clamp(density * 0.5, 0.0, 1.0));
    }

    col += bioCol * density * 1.4 * u_intensity;

    // Blend with scene
    vec3 scene = texture(tDiffuse, vUv).rgb;
    col = mix(scene * 0.15 + col, col, 0.85);

    out_col = vec4(clamp(col, 0.0, 1.0), 1.0);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(vec2(UV.x, 1.0 - UV.y), col);
    COLOR = vec4(col.rgb, u_fade);
}
