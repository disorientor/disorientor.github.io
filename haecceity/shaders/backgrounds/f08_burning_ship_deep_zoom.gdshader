shader_type canvas_item;
uniform float u_fade = 1.0;
uniform sampler2D tDiffuse : hint_default_black;
uniform sampler2D tPrevFrame : hint_default_black;
uniform vec2 u_resolution = vec2(1060.0, 550.0);
uniform float u_time = 0.0;
/*
 * FRACTAL REALMS - SHADER F08: BURNING SHIP DEEP ZOOM & CONTINUOUS POTENTIAL
 * ----------------------------------------------------------------------------
 * Computes the iconic Burning Ship fractal invented by Michael Michelitsch and Otto Rössler:
 *   z_{n+1} = (|Re(z_n)| + i * |Im(z_n)|)^2 + c
 * Non-analytic taking of absolute values creates the famous inverted mast, rigging,
 * and burning embers of the ship.
 * Features:
 *   - Continuous renormalized potential: nu = n + 1 - log(log(|z|)) / log(2)
 *   - Fiery infernal color palette with smooth cosine gradient integration
 *   - Deep zoom panning along the fractal's needle masts
 *   - Interior distance estimation / halo glow
 */






uniform float u_intensity = 1.0;        // Palettization intensity (default: 1.0)
uniform float u_zoom_level = 4.0;       // Zoom magnification (1.0 to 50.0, default: 4.0)
uniform float u_center_x = -1.755;         // Complex center X (-2.0 to 1.0, default: -1.755)
uniform float u_center_y = -0.035;         // Complex center Y (-1.5 to 1.5, default: -0.035)
uniform float u_flame_cycle = 1.0;      // Color cycle velocity (0.1 to 3.0, default: 1.0)
uniform float u_interior_mode = 0.0;    // 0 = Dark Abyss, 1 = Molten Core, 2 = Neon Ghost



// Cosine gradient color mapping
vec3 firePalette(float t) {
    vec3 a = vec3(0.5, 0.5, 0.5);
    vec3 b = vec3(0.5, 0.5, 0.5);
    vec3 c = vec3(1.0, 1.0, 1.0);
    vec3 d = vec3(0.0, 0.33, 0.67);
    return a + b * cos(6.28318 * (c * t + d));
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 uv = (vUv - 0.5) * 2.0;
    uv.x *= u_resolution.x / u_resolution.y;

    // Center on the iconic Burning Ship mast coordinates
    float cX = (abs(u_center_x) > 0.001) ? u_center_x : -1.755;
    float cY = (abs(u_center_y) > 0.001) ? u_center_y : -0.035;
    vec2 center = vec2(cX, cY);

    // Stable smooth zoom
    float zLev = (u_zoom_level > 0.1) ? u_zoom_level : 4.0;
    float zoom = zLev * (1.0 + 0.25 * sin(u_time * 0.25));
    vec2 c = center + uv / zoom;

    // Burning Ship Iteration
    vec2 z = vec2(0.0);
    float n = 0.0;
    int MAX_IT = 100;
    float r2 = 0.0;
    vec2 minZ = vec2(1e5);

    for (int i = 0; i < MAX_IT; i++) {
        z = vec2(abs(z.x), abs(z.y));
        z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;

        r2 = dot(z, z);
        minZ = min(minZ, abs(z));

        if (r2 > 64.0) {
            n = float(i);
            break;
        }
    }

    vec3 col = vec3(0.0);

    if (r2 > 64.0) {
        // Continuous smooth potential formula (stabilized)
        float logR = max(log(sqrt(r2)), 1e-4);
        float nu = n + 1.0 - log(max(logR, 1e-4)) / log(2.0);
        float t = nu * 0.04 + u_time * 0.08 * u_flame_cycle;

        // Fiery Burning Ship palette
        vec3 emberRed = vec3(0.85, 0.12, 0.02);
        vec3 sulfurGold = vec3(1.0, 0.82, 0.2);
        vec3 whiteHot = vec3(1.0, 0.98, 0.9);

        float phase = fract(t);
        if (phase < 0.5) {
            col = mix(emberRed, sulfurGold, phase * 2.0);
        } else {
            col = mix(sulfurGold, whiteHot, (phase - 0.5) * 2.0);
        }

        col *= (0.75 + 0.25 * sin(nu * 0.3));
    } else {
        // Interior Set Points
        if (u_interior_mode < 0.5) {
            col = vec3(0.005, 0.002, 0.01); // Cold void
        } else if (u_interior_mode < 1.5) {
            // Molten Core (orbit trap glow)
            col = vec3(0.9, 0.3, 0.05) * exp(-minZ.x * 20.0);
        } else {
            // Neon Ghost contouring
            col = vec3(0.1, 0.8, 1.0) * exp(-minZ.y * 30.0);
        }
    }

    // Blend with texture for hybrid shader effects
    vec3 scene = texture(tDiffuse, vUv).rgb;
    col = mix(scene * 0.15 + col, col, 0.9 * u_intensity);

    out_col = vec4(clamp(col, 0.0, 1.0), 1.0);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(vec2(UV.x, 1.0 - UV.y), col);
    COLOR = vec4(col.rgb, u_fade);
}
