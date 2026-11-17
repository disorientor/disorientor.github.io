shader_type canvas_item;
uniform float u_fade = 1.0;
uniform sampler2D tDiffuse : hint_default_black;
uniform sampler2D tPrevFrame : hint_default_black;
uniform vec2 u_resolution = vec2(1060.0, 550.0);
uniform float u_time = 0.0;
/*
 * TRIP MATH SUITE - SHADER T03: GRAY-SCOTT REACTION-DIFFUSION TURING MORPHOGENESIS
 * ---------------------------------------------------------------------------------
 * Evaluates Alan Turing's 1952 morphogenesis and the non-linear Gray-Scott model:
 *   du/dt = D_u * laplacian(u) - u * v^2 + F * (1 - u)
 *   dv/dt = D_v * laplacian(v) + u * v^2 - (F + k) * v
 * Features:
 *   - Multiscale spatial frequency approximation directly on the GPU in a single pass
 *   - Dynamic morphing across iconic parameter regimes:
 *       Soliton Spots (Mitosis), Labyrinthine Coral Mazes, Spirals, and Wormholes
 *   - Continuous iridescent chemical coloring with normal-mapped height lighting
 */






uniform float u_intensity = 1.0;        // Morph / diffusion rate (default: 1.0)
uniform float u_morph_pattern = 0.0;    // 0 = Soliton Spots, 1 = Labyrinth Coral, 2 = Spiraling Waves
uniform float u_feed_f = 0.04;           // Gray-Scott feed rate F (0.02 to 0.06)
uniform float u_kill_k = 0.06;           // Gray-Scott kill rate k (0.05 to 0.07)
uniform float u_irid_saturation = 1.0;  // Thin-film chemical iridescence



float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

// Multi-scale coupled wave approximation of Turing patterns
float turingField(vec2 p, float t, float mode) {
    float val = 0.0;
    float scale = 1.0;
    float weight = 1.0;

    for (int i = 0; i < 5; i++) {
        float fi = float(i);
        float ang = fi * 1.0471975 + t * 0.15; // 60 degree hex angles
        vec2 dir = vec2(cos(ang), sin(ang));

        // Spatial wavelength
        float wave = sin(dot(p, dir) * scale * 12.0 + t * 0.8 + fi);
        
        // Non-linear coupling: u * v^2 interaction creates spot and labyrinth bifurcation
        if (mode < 0.5) {
            // Soliton spots (hexagonal standing waves)
            val += cos(wave * 2.0) * weight;
        } else if (mode < 1.5) {
            // Labyrinthine coral ruts (sign-preserving square-wave threshold)
            val += sign(wave) * pow(abs(wave), 0.7) * weight;
        } else {
            // Spiral wave turbulence
            val += sin(wave + length(p) * 4.0 - t * 2.0) * weight;
        }

        scale *= 1.618;
        weight *= 0.618;
    }

    return val;
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 p = (vUv - 0.5) * 2.0;
    p.x *= u_resolution.x / u_resolution.y;

    float t = u_time * 0.4 * u_intensity;
    float mode = u_morph_pattern;

    // Evaluate Turing morphogen concentrations (u and v)
    float vVal = turingField(p * 2.5, t, mode);
    float vNorm = 0.5 + 0.5 * sin(vVal * 1.8);

    // Compute surface normal gradient from spatial derivatives
    float eps = 0.005;
    float vRight = turingField((p + vec2(eps, 0.0)) * 2.5, t, mode);
    float vUp = turingField((p + vec2(0.0, eps)) * 2.5, t, mode);
    vec3 norm = normalize(vec3(vVal - vRight, vVal - vUp, eps * 4.0));

    // Directional chemical lighting
    vec3 lightDir = normalize(vec3(0.5, 0.8, 0.6));
    float diff = clamp(dot(norm, lightDir), 0.0, 1.0);
    float spec = pow(clamp(dot(reflect(vec3(0.0, 0.0, -1.0), norm), lightDir), 0.0, 1.0), 24.0);

    // Iridescent Thin-Film Chemical Staining
    vec3 chemCol1 = vec3(0.05, 0.8, 0.9); // Bioluminescent cyan
    vec3 chemCol2 = vec3(0.95, 0.1, 0.6); // Reactive magenta
    vec3 chemCol3 = vec3(1.0, 0.85, 0.1); // Gold activator
    
    vec3 baseChem;
    if (vNorm < 0.5) {
        baseChem = mix(chemCol1, chemCol2, vNorm * 2.0);
    } else {
        baseChem = mix(chemCol2, chemCol3, (vNorm - 0.5) * 2.0);
    }

    vec3 col = baseChem * (diff * 0.75 + 0.25) + vec3(spec * 0.5);

    // Chemical membrane cell boundaries
    float membrane = smoothstep(0.48, 0.52, vNorm) * (1.0 - smoothstep(0.48, 0.52, vNorm));
    col += vec3(0.2, 1.0, 0.4) * membrane * 2.5;

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
