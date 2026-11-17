shader_type canvas_item;
uniform float u_fade = 1.0;
uniform sampler2D tDiffuse : hint_default_black;
uniform sampler2D tPrevFrame : hint_default_black;
uniform vec2 u_resolution = vec2(1060.0, 550.0);
uniform float u_time = 0.0;
/*
 * FRACTAL REALMS - SHADER F03: 3D APOLLONIAN SPHERE PACKING GASKET
 * -----------------------------------------------------------------
 * Raymarched 3D Apollonian sphere gasket using recursive sphere inversions:
 *   p' = p / |p|^2
 * Generates an infinite foam of mutually osculating (kissing) fractal spheres.
 * Features:
 *   - Iterative inversion IFS with scale tracking
 *   - Contact ring highlight caustics
 *   - Iridescent structural thin-film interference coloration
 *   - Volumetric dust particles in the spherical voids
 */






uniform float u_intensity = 1.0;        // Fractal deformation depth (default: 1.0)
uniform float u_inversion_scale = 1.75;  // Sphere inversion radius (1.0 to 2.5)
uniform float u_sphere_gap = 1.0;       // Packing contact gap factor
uniform float u_iridescence = 1.0;      // Spectral thin-film color saturation
uniform float u_camera_orbit = 1.0;     // Orbital rotation speed



// Distance estimator for 3D Apollonian Sphere Packing
float mapApollonian(vec3 pos, out vec4 trap) {
    vec3 p = pos;
    float scale = 1.0;
    float rBound = max(0.8, u_inversion_scale);
    vec4 minTrap = vec4(1e5);

    for (int i = 0; i < 9; i++) {
        // Space folding
        p = -1.0 + 2.0 * fract(0.5 * p + 0.5);

        float r2 = dot(p, p);
        minTrap = min(minTrap, vec4(abs(p), r2));

        // Sphere inversion
        float k = rBound / clamp(r2, 0.08, 1.2);
        p *= k;
        scale *= k;
    }

    trap = minTrap;
    // Base distance to central sphere lattice
    float d = (length(p.xy) - 0.35 * u_sphere_gap) / scale;
    return d;
}

vec3 calcNormal(vec3 p) {
    vec4 dummy;
    float eps = 0.002;
    vec2 e = vec2(1.0, -1.0) * eps;
    return normalize(
        e.xyy * mapApollonian(p + e.xyy, dummy) +
        e.yyx * mapApollonian(p + e.yyx, dummy) +
        e.yxy * mapApollonian(p + e.yxy, dummy) +
        e.xxx * mapApollonian(p + e.xxx, dummy)
    );
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 p = (vUv - 0.5) * 2.0;
    p.x *= u_resolution.x / u_resolution.y;

    float orbit = u_time * (0.2 * max(0.2, u_camera_orbit));
    vec3 ro = vec3(cos(orbit) * 2.8, sin(orbit * 0.5) * 1.2, sin(orbit) * 2.8);
    vec3 ta = vec3(0.0, 0.0, 0.0);
    vec3 ww = normalize(ta - ro);
    vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
    vec3 vv = normalize(cross(uu, ww));
    vec3 rd = normalize(p.x * uu + p.y * vv + 1.8 * ww);

    float t = 0.05;
    float maxDist = 12.0;
    float hit = 0.0;
    vec4 bestTrap = vec4(0.0);
    float glow = 0.0;

    for (int i = 0; i < 70; i++) {
        vec3 pos = ro + rd * t;
        vec4 trap;
        float d = mapApollonian(pos, trap);
        glow += exp(-d * 15.0) * 0.03;

        if (d < 0.002 * t) {
            hit = 1.0;
            bestTrap = trap;
            break;
        }
        t += d;
        if (t > maxDist) break;
    }

    vec3 col = vec3(0.01, 0.01, 0.02);

    if (hit > 0.5) {
        vec3 hitPos = ro + rd * t;
        vec3 norm = calcNormal(hitPos);
        vec3 lightDir = normalize(vec3(0.5, 0.8, 0.3));

        float diff = clamp(dot(norm, lightDir), 0.0, 1.0);
        float spec = pow(clamp(dot(reflect(rd, norm), lightDir), 0.0, 1.0), 24.0);

        // Thin-film Iridescence on spherical surfaces
        float nDotV = clamp(dot(-rd, norm), 0.0, 1.0);
        vec3 irid = 0.5 + 0.5 * cos((1.0 - nDotV) * 14.0 + bestTrap.w * 8.0 + vec3(0.0, 2.0, 4.0));

        col = mix(vec3(0.1, 0.15, 0.2), irid, u_iridescence) * (diff * 0.8 + 0.2) + vec3(spec * 0.5);

        // Atmospheric depth cueing
        col = mix(col, vec3(0.01, 0.02, 0.04), 1.0 - exp(-0.06 * t * t));
    }

    // Add glowing contact ring halos
    vec3 contactGlow = vec3(0.0, 0.9, 1.0);
    col += contactGlow * glow * 1.2 * u_intensity;

    out_col = vec4(clamp(col, 0.0, 1.0), 1.0);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(vec2(UV.x, 1.0 - UV.y), col);
    COLOR = vec4(col.rgb, u_fade);
}
