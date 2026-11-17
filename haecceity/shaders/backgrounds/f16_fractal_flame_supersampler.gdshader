shader_type canvas_item;
uniform float u_fade = 1.0;
uniform sampler2D tDiffuse : hint_default_black;
uniform sampler2D tPrevFrame : hint_default_black;
uniform vec2 u_resolution = vec2(1060.0, 550.0);
uniform float u_time = 0.0;
/*
 * FRACTAL REALMS - SHADER F16: SCOTT DRAVES' FRACTAL FLAME SUPERSAMPLER
 * ------------------------------------------------------------------------
 * Implementation of Scott Draves' 1992 Fractal Flame algorithm formulated as
 * a vectorized GPU parallel fragment pipeline:
 *   - Iterates non-linear variation functions:
 *       V0 (Linear):       F(x, y) = (x, y)
 *       V1 (Sinusoidal):   F(x, y) = (sin(x), sin(y))
 *       V2 (Spherical):    F(x, y) = (x/r^2, y/r^2)
 *       V3 (Swirl):        F(x, y) = (x*sin(r^2) - y*cos(r^2), x*cos(r^2) + y*sin(r^2))
 *       V4 (Horseshoe):    F(x, y) = ((x-y)*(x+y)/r, 2*x*y/r)
 *       V5 (Handkerchief): F(x, y) = (r*sin(theta + r), r*cos(theta - r))
 *   - Logarithmic tone mapping: color = log(density) / log(max_density)
 *   - Generates mystical, glowing cosmic nebulas and sacred flame mandalas.
 */






uniform float u_intensity = 1.0;        // Morph / evolution factor (default: 1.0)
uniform float u_variation_blend = 0.0;  // 0 = Sinusoidal/Swirl, 1 = Spherical/Horseshoe, 2 = Handkerchief/Polar
uniform float u_flame_symmetry = 5.0;   // N-fold rotational symmetry (2 to 8)
uniform float u_flame_gamma = 1.5;      // Logarithmic density gamma (0.5 to 2.5)
uniform float u_spectral_speed = 1.0;   // Color cycle frequency



// Non-linear variation functions
vec2 varSinusoidal(vec2 p) {
    return sin(p);
}

vec2 varSpherical(vec2 p) {
    float r2 = dot(p, p) + 1e-4;
    return p / r2;
}

vec2 varSwirl(vec2 p) {
    float r2 = dot(p, p);
    float s = sin(r2), c = cos(r2);
    return vec2(p.x * s - p.y * c, p.x * c + p.y * s);
}

vec2 varHorseshoe(vec2 p) {
    float r = length(p) + 1e-4;
    return vec2((p.x - p.y) * (p.x + p.y) / r, 2.0 * p.x * p.y / r);
}

vec2 varHandkerchief(vec2 p) {
    float r = length(p) + 1e-4;
    float theta = atan(p.y, p.x);
    return vec2(r * sin(theta + r), r * cos(theta - r));
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 p = (vUv - 0.5) * 2.0;
    p.x *= u_resolution.x / u_resolution.y;

    // Apply N-fold rotational symmetry
    float sym = max(2.0, floor(u_flame_symmetry));
    float angle = atan(p.y, p.x);
    float r = length(p);
    angle = mod(angle, 6.2831853 / sym) - 3.1415926 / sym;
    p = vec2(cos(angle), sin(angle)) * r;

    // Multi-generational flame variation mapping
    float density = 0.0;
    vec2 currP = p * 1.5;
    vec3 flameCol = vec3(0.0);

    for (int i = 0; i < 8; i++) {
        float fi = float(i);
        vec2 v1, v2;

        if (u_variation_blend < 0.5) {
            v1 = varSinusoidal(currP * 1.2 + vec2(sin(u_time * 0.2), 0.0));
            v2 = varSwirl(currP * 0.8);
        } else if (u_variation_blend < 1.5) {
            v1 = varSpherical(currP * 1.4);
            v2 = varHorseshoe(currP);
        } else {
            v1 = varHandkerchief(currP);
            v2 = varSinusoidal(currP * 1.5);
        }

        currP = mix(v1, v2, 0.5 + 0.3 * sin(u_time * 0.4 + fi));

        // Density sampling near non-linear attractors
        float d = length(currP) - 0.75;
        float hitDensity = exp(-abs(d) * 5.0);
        density += hitDensity;

        // Spectral color mapping per variation stage
        vec3 stageColor = 0.5 + 0.5 * cos(fi * 0.7 + u_time * u_spectral_speed + vec3(0.0, 2.0, 4.0));
        flameCol += stageColor * hitDensity;
    }

    // Logarithmic tone mapping (Scott Draves' flame exposure equation)
    float gamma = max(0.4, u_flame_gamma);
    float logDensity = log(1.0 + density * 2.0);
    logDensity = pow(logDensity, gamma);

    vec3 finalCol = (flameCol / max(density, 1e-4)) * logDensity * u_intensity;

    // Add deep cosmic space dust
    vec3 scene = texture(tDiffuse, vUv).rgb;
    finalCol = mix(scene * 0.15 + finalCol, finalCol, 0.85);

    out_col = vec4(clamp(finalCol, 0.0, 1.0), 1.0);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(vec2(UV.x, 1.0 - UV.y), col);
    COLOR = vec4(col.rgb, u_fade);
}
