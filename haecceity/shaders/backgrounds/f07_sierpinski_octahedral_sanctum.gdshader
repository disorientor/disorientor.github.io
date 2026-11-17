shader_type canvas_item;
uniform float u_fade = 1.0;
uniform sampler2D tDiffuse : hint_default_black;
uniform sampler2D tPrevFrame : hint_default_black;
uniform vec2 u_resolution = vec2(1060.0, 550.0);
uniform float u_time = 0.0;
/*
 * FRACTAL REALMS - SHADER F07: SIERPINSKI OCTAHEDRAL PYRAMID SANCTUM
 * --------------------------------------------------------------------
 * Raymarched 3D Sierpinski Octahedral / Tetrahedral fractal temple:
 *   - Uses folding plane symmetries across Coxeter reflective hyperplanes:
 *       p.xy = (p.x + p.y < 0) ? -p.yx : p.xy
 *       p.xz = (p.x + p.z < 0) ? -p.zx : p.xz
 *       p.yz = (p.y + p.z < 0) ? -p.zy : p.yz
 *   - Creates an infinite sacred geometric temple of interlocking octahedra
 *     and tetrahedral energy vaults enclosing a central glowing singularity.
 */






uniform float u_intensity = 1.0;        // Recursion morph factor (default: 1.0)
uniform float u_scale_factor = 2.05;     // Iterative scale expansion (1.8 to 2.3)
uniform float u_offset_dist = 1.0;      // Apex vertex displacement distance
uniform float u_crystal_core = 1.0;     // Central singularity prism glow
uniform float u_rotation_speed = 1.0;   // Temple rotation rate



// Distance estimator for Sierpinski Octahedron / Tetrahedron
float mapSierpinski(vec3 pos, out vec3 trap) {
    vec3 p = pos;
    float scale = 1.0;
    float sFactor = max(1.7, u_scale_factor);
    float offset = max(1.0, u_offset_dist);

    vec3 minTrap = vec3(1e5);

    for (int i = 0; i < 9; i++) {
        // Reflection folds across octahedral mirror planes
        if (p.x + p.y < 0.0) p.xy = -p.yx;
        if (p.x + p.z < 0.0) p.xz = -p.zx;
        if (p.y + p.z < 0.0) p.yz = -p.zy;

        // Scale and shift toward pyramid apex
        p = p * sFactor - offset * (sFactor - 1.0);
        scale *= sFactor;

        minTrap = min(minTrap, abs(p));
    }

    trap = minTrap;
    // Base tetrahedron/octahedron distance formula
    return (length(p) - 1.2) / scale;
}

vec3 calcNormal(vec3 p) {
    vec3 dummy;
    float eps = 0.002;
    vec2 e = vec2(1.0, -1.0) * eps;
    return normalize(
        e.xyy * mapSierpinski(p + e.xyy, dummy) +
        e.yyx * mapSierpinski(p + e.yyx, dummy) +
        e.yxy * mapSierpinski(p + e.yxy, dummy) +
        e.xxx * mapSierpinski(p + e.xxx, dummy)
    );
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 p = (vUv - 0.5) * 2.0;
    p.x *= u_resolution.x / u_resolution.y;

    float tCam = u_time * 0.2 * max(0.2, u_rotation_speed);
    vec3 ro = vec3(cos(tCam) * 3.5, 1.5 + 0.5 * sin(tCam * 0.8), sin(tCam) * 3.5);
    vec3 ta = vec3(0.0, 0.4, 0.0);
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
        float d = mapSierpinski(pos, trap);
        glow += exp(-d * 10.0) * 0.04;

        if (d < 0.002 * t) {
            hit = 1.0;
            bestTrap = trap;
            break;
        }
        t += d;
        if (t > maxDist) break;
    }

    vec3 col = vec3(0.015, 0.01, 0.02);

    if (hit > 0.5) {
        vec3 hitPos = ro + rd * t;
        vec3 norm = calcNormal(hitPos);
        vec3 lightDir = normalize(vec3(0.5, 0.85, 0.3));

        float diff = clamp(dot(norm, lightDir), 0.0, 1.0);
        float spec = pow(clamp(dot(reflect(rd, norm), lightDir), 0.0, 1.0), 32.0);

        // Sacred geometry lapis lazuli and polished gold palette
        vec3 lapis = vec3(0.05, 0.2, 0.55);
        vec3 gold = vec3(1.0, 0.8, 0.2);
        vec3 surfaceCol = mix(lapis, gold, clamp(bestTrap.x * 0.5, 0.0, 1.0));

        col = surfaceCol * (diff * 0.8 + 0.2) + vec3(spec * 0.65);
        col = mix(col, vec3(0.015, 0.01, 0.03), 1.0 - exp(-0.06 * t * t));
    }

    // Central Singularity Crystal Core Glow
    vec3 crystalGlow = vec3(1.0, 0.4, 0.9); // Sacred magenta ray
    col += crystalGlow * glow * u_crystal_core * u_intensity;

    out_col = vec4(clamp(col, 0.0, 1.0), 1.0);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(vec2(UV.x, 1.0 - UV.y), col);
    COLOR = vec4(col.rgb, u_fade);
}
