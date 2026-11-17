shader_type canvas_item;
uniform float u_fade = 1.0;
uniform sampler2D tDiffuse : hint_default_black;
uniform sampler2D tPrevFrame : hint_default_black;
uniform vec2 u_resolution = vec2(1060.0, 550.0);
uniform float u_time = 0.0;
/*
 * FRACTAL REALMS - SHADER F06: KLEINIAN LIMIT SET HYPERBOLIC CORAL
 * -----------------------------------------------------------------
 * Raymarched 3D Kleinian group limit set fractal:
 *   - Discrete subgroups of PSL(2, C) acting as isometries on hyperbolic 3-space H^3.
 *   - Uses Jos Leys / Knighty's sphere-inversion folding algorithm:
 *       Four mutually touching inversion spheres generating infinite limit set horns,
 *       spiraling seashell mollusks, and bio-mineral coral lattices.
 */






uniform float u_intensity = 1.0;        // Coral growth morph factor (default: 1.0)
uniform float u_box_size = 1.3;         // Kleinian fundamental domain box size (0.8 to 1.8)
uniform float u_sphere_inversion = 1.2; // Inversion radius (0.8 to 1.6)
uniform float u_coral_spiral = 1.0;     // Loxodromic spiral twist rate
uniform float u_deep_sea_glow = 1.0;    // Bioluminescent underwater emission



// Distance estimator for Kleinian limit coral
float mapKleinian(vec3 pos, out vec3 trap) {
    vec3 p = pos;
    float scale = 1.0;
    float bSize = max(0.6, u_box_size);
    float sInv = max(0.7, u_sphere_inversion);

    // Dynamic spiral twist along vertical axis
    float ang = p.y * (0.4 * u_coral_spiral) + u_time * 0.15 * u_intensity;
    float ca = cos(ang), sa = sin(ang);
    p.xz = mat2(vec2(ca, -sa), vec2(sa, ca)) * p.xz;

    vec3 minTrap = vec3(1e5);

    for (int i = 0; i < 12; i++) {
        // Kleinian box fold across domain
        p.x = abs(p.x + bSize) - abs(p.x - bSize) - p.x;
        p.z = abs(p.z + bSize) - abs(p.z - bSize) - p.z;

        // Sphere inversion
        float r2 = dot(p, p);
        minTrap = min(minTrap, abs(p));

        if (r2 < sInv) {
            float k = sInv / r2;
            p *= k;
            scale *= k;
        }

        // Translation offset
        p.y += 0.15 * sin(u_time * 0.3) * u_intensity;
    }

    trap = minTrap;
    // Cylinder boundary to form coral stalks
    float d = (length(p.xz) - 0.28) / scale;
    return d;
}

vec3 calcNormal(vec3 p) {
    vec3 dummy;
    float eps = 0.002;
    vec2 e = vec2(1.0, -1.0) * eps;
    return normalize(
        e.xyy * mapKleinian(p + e.xyy, dummy) +
        e.yyx * mapKleinian(p + e.yyx, dummy) +
        e.yxy * mapKleinian(p + e.yxy, dummy) +
        e.xxx * mapKleinian(p + e.xxx, dummy)
    );
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 p = (vUv - 0.5) * 2.0;
    p.x *= u_resolution.x / u_resolution.y;

    float tCam = u_time * 0.18;
    vec3 ro = vec3(cos(tCam) * 3.2, 1.2 + 0.4 * sin(tCam * 0.7), sin(tCam) * 3.2);
    vec3 ta = vec3(0.0, 0.0, 0.0);
    vec3 ww = normalize(ta - ro);
    vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
    vec3 vv = normalize(cross(uu, ww));
    vec3 rd = normalize(p.x * uu + p.y * vv + 1.8 * ww);

    float t = 0.05;
    float maxDist = 12.0;
    float hit = 0.0;
    vec3 bestTrap = vec3(0.0);
    float glow = 0.0;

    for (int i = 0; i < 68; i++) {
        vec3 pos = ro + rd * t;
        vec3 trap;
        float d = mapKleinian(pos, trap);
        glow += exp(-d * 12.0) * 0.035;

        if (d < 0.002 * t) {
            hit = 1.0;
            bestTrap = trap;
            break;
        }
        t += d;
        if (t > maxDist) break;
    }

    vec3 col = vec3(0.005, 0.02, 0.04); // Deep abyssal ocean blue

    if (hit > 0.5) {
        vec3 hitPos = ro + rd * t;
        vec3 norm = calcNormal(hitPos);
        vec3 lightDir = normalize(vec3(0.4, 0.8, 0.5));

        float diff = clamp(dot(norm, lightDir), 0.0, 1.0);
        float spec = pow(clamp(dot(reflect(rd, norm), lightDir), 0.0, 1.0), 28.0);

        // Abyssal coral polyp and chitin shell coloration
        vec3 deepCoral = mix(vec3(0.05, 0.55, 0.75), vec3(1.0, 0.35, 0.55), bestTrap.x * 2.0);
        vec3 shellRim = mix(deepCoral, vec3(0.9, 0.95, 0.6), clamp(bestTrap.z * 1.5, 0.0, 1.0));

        col = shellRim * (diff * 0.8 + 0.2) + vec3(spec * 0.55);
        col = mix(col, vec3(0.005, 0.02, 0.05), 1.0 - exp(-0.08 * t * t));
    }

    // Bioluminescent Deep-Sea Glow
    vec3 biolum = vec3(0.0, 1.0, 0.85); // Electric aquamarine
    col += biolum * glow * u_deep_sea_glow * u_intensity;

    out_col = vec4(clamp(col, 0.0, 1.0), 1.0);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(vec2(UV.x, 1.0 - UV.y), col);
    COLOR = vec4(col.rgb, u_fade);
}
