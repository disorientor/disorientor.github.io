shader_type canvas_item;
uniform float u_fade = 1.0;
uniform sampler2D tDiffuse : hint_default_black;
uniform sampler2D tPrevFrame : hint_default_black;
uniform vec2 u_resolution = vec2(1060.0, 550.0);
uniform float u_time = 0.0;
/*
 * FRACTAL REALMS - SHADER F13: KALEIDOSCOPIC DODECAHEDRON IFS (H3 COXETER)
 * --------------------------------------------------------------------------
 * Raymarched 3D Kaleidoscopic Iterated Function System (KIFS) based on the
 * H3 Coxeter reflection group (icosahedral / dodecahedral symmetry):
 *   - Reflects 3D coordinates across golden-ratio mirror planes:
 *       phi = (1 + sqrt(5)) / 2  (~1.6180339887)
 *       Normal vectors n = (1, phi, 0) / sqrt(1 + phi^2)
 *   - Creates shimmering polyhedral crystals, sacred stellated dodecahedra,
 *     and nested kaleidoscopic mirror chambers with internal prismatic laser beams.
 */






uniform float u_intensity = 1.0;        // Recursion morph factor (default: 1.0)
uniform float u_scale = 2.0;            // KIFS expansion scale (1.5 to 2.5)
uniform float u_rotation_speed = 1.0;   // Polyhedral rotation velocity
uniform float u_facet_shine = 1.0;      // Crystalline specular reflection
uniform float u_inner_lasers = 1.0;     // Prismatic core beam brightness



// Distance estimator for Dodecahedral / Icosahedral KIFS
float mapDodeca(vec3 pos, out vec3 trap) {
    vec3 p = pos;
    float scale = 1.0;
    float s = max(1.4, u_scale);
    float phi = 1.6180339887; // Golden ratio

    // Polyhedral folding normals based on icosahedral reflection planes
    vec3 n1 = normalize(vec3(1.0, phi, 0.0));
    vec3 n2 = normalize(vec3(0.0, 1.0, phi));
    vec3 n3 = normalize(vec3(phi, 0.0, 1.0));

    vec3 minTrap = vec3(1e5);

    for (int i = 0; i < 8; i++) {
        // Absolute value folds
        p = abs(p);

        // Mirror reflections across golden-ratio facet planes
        float d1 = dot(p, n1);
        if (d1 < 0.0) p -= 2.0 * d1 * n1;

        float d2 = dot(p, n2);
        if (d2 < 0.0) p -= 2.0 * d2 * n2;

        float d3 = dot(p, n3);
        if (d3 < 0.0) p -= 2.0 * d3 * n3;

        // Scale and translate
        p = p * s - vec3(1.2, 1.0, 0.8) * (s - 1.0);
        scale *= s;

        minTrap = min(minTrap, abs(p));
    }

    trap = minTrap;
    // Bounding stellated dodecahedron surface
    return (length(p) - 1.4) / scale;
}

vec3 calcNormal(vec3 p) {
    vec3 dummy;
    float eps = 0.002;
    vec2 e = vec2(1.0, -1.0) * eps;
    return normalize(
        e.xyy * mapDodeca(p + e.xyy, dummy) +
        e.yyx * mapDodeca(p + e.yyx, dummy) +
        e.yxy * mapDodeca(p + e.yxy, dummy) +
        e.xxx * mapDodeca(p + e.xxx, dummy)
    );
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 p = (vUv - 0.5) * 2.0;
    p.x *= u_resolution.x / u_resolution.y;

    float tCam = u_time * 0.22 * max(0.2, u_rotation_speed);
    vec3 ro = vec3(cos(tCam) * 3.4, sin(tCam * 0.6) * 1.5, sin(tCam) * 3.4);
    vec3 ta = vec3(0.0, 0.0, 0.0);
    vec3 ww = normalize(ta - ro);
    vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
    vec3 vv = normalize(cross(uu, ww));
    vec3 rd = normalize(p.x * uu + p.y * vv + 1.8 * ww);

    float t = 0.05;
    float maxDist = 12.0;
    float hit = 0.0;
    vec3 bestTrap = vec3(0.0);
    float laserGlow = 0.0;

    for (int i = 0; i < 68; i++) {
        vec3 pos = ro + rd * t;
        vec3 trap;
        float d = mapDodeca(pos, trap);
        laserGlow += exp(-d * 14.0) * 0.04;

        if (d < 0.002 * t) {
            hit = 1.0;
            bestTrap = trap;
            break;
        }
        t += d;
        if (t > maxDist) break;
    }

    vec3 col = vec3(0.01, 0.015, 0.025);

    if (hit > 0.5) {
        vec3 hitPos = ro + rd * t;
        vec3 norm = calcNormal(hitPos);
        vec3 lightDir = normalize(vec3(0.6, 0.8, 0.4));
        vec3 ref = reflect(rd, norm);

        float diff = clamp(dot(norm, lightDir), 0.0, 1.0);
        float spec = pow(clamp(dot(ref, lightDir), 0.0, 1.0), 40.0 * max(0.5, u_facet_shine));

        // Sacred crystal facet coloring
        vec3 crystalHue = 0.5 + 0.5 * cos(bestTrap.x * 2.5 + vec3(0.0, 2.0, 4.0));
        vec3 gemSurface = mix(vec3(0.1, 0.25, 0.4), crystalHue, 0.7);

        col = gemSurface * (diff * 0.8 + 0.25) + vec3(spec * 0.8);
        col = mix(col, vec3(0.01, 0.02, 0.04), 1.0 - exp(-0.07 * t * t));
    }

    // Concentrated interior prismatic laser rays
    vec3 laserCol = vec3(0.2, 0.9, 1.0); // Cyan-violet laser
    col += laserCol * laserGlow * u_inner_lasers * u_intensity;

    out_col = vec4(clamp(col, 0.0, 1.0), 1.0);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(vec2(UV.x, 1.0 - UV.y), col);
    COLOR = vec4(col.rgb, u_fade);
}
