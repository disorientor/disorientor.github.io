shader_type canvas_item;
uniform float u_fade = 1.0;
uniform sampler2D tDiffuse : hint_default_black;
uniform sampler2D tPrevFrame : hint_default_black;
uniform vec2 u_resolution = vec2(1060.0, 550.0);
uniform float u_time = 0.0;
/*
 * FRACTAL REALMS - SHADER F04: MENGER-JERUSALEM SPONGE HYBRID
 * -------------------------------------------------------------
 * Raymarched 3D hybrid of the classic Menger Sponge and the Jerusalem Cube:
 *   - The classic Menger sponge cuts square sub-crosses of size 1/3 at each level.
 *   - The Jerusalem Cube cuts cross-shaped holes of sub-ratio (sqrt(2)-1) and keeps corners.
 *   - Creates recursive gothic cloister vaults, cruciform shrines, and light shafts.
 */






uniform float u_intensity = 1.0;        // Recursion morph factor (default: 1.0)
uniform float u_sponge_scale = 3.0;     // Scale expansion ratio (2.6 to 3.4)
uniform float u_cross_cut_ratio = 0.35;  // Void aperture width (0.25 to 0.45)
uniform float u_crepuscular_rays = 1.0; // Volumetric god-ray density
uniform float u_gold_trim = 1.0;        // Metallic alchemical edge leafing



// Box SDF
float sdBox(vec3 p, vec3 b) {
    vec3 q = abs(p) - b;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

// Distance estimator for Menger / Jerusalem Sponge
float mapSponge(vec3 p, out float trap) {
    float d = sdBox(p, vec3(1.0));
    float s = 1.0;
    float scale = max(2.5, u_sponge_scale);
    float cutRatio = clamp(u_cross_cut_ratio, 0.2, 0.48);

    float minTrap = 1e5;

    for (int m = 0; m < 5; m++) {
        vec3 a = mod(p * s, 2.0) - 1.0;
        s *= scale;
        vec3 r = abs(1.0 - scale * abs(a));

        // Cross-shaped void subtraction along orthogonal axes
        float da = max(r.x, r.y);
        float db = max(r.y, r.z);
        float dc = max(r.z, r.x);
        float c = (min(da, min(db, dc)) - cutRatio * scale) / s;

        minTrap = min(minTrap, length(a));

        if (c > d) {
            d = c;
        }
    }

    trap = minTrap;
    return d;
}

vec3 calcNormal(vec3 p) {
    float dummy;
    float eps = 0.002;
    vec2 e = vec2(1.0, -1.0) * eps;
    return normalize(
        e.xyy * mapSponge(p + e.xyy, dummy) +
        e.yyx * mapSponge(p + e.yyx, dummy) +
        e.yxy * mapSponge(p + e.yxy, dummy) +
        e.xxx * mapSponge(p + e.xxx, dummy)
    );
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 p = (vUv - 0.5) * 2.0;
    p.x *= u_resolution.x / u_resolution.y;

    // Slow cinematic camera sweep inside the sponge nave
    float tCam = u_time * 0.12;
    vec3 ro = vec3(cos(tCam) * 2.2, 0.8 + 0.3 * sin(tCam * 1.5), sin(tCam) * 2.2);
    vec3 ta = vec3(0.0, 0.0, 0.0);
    vec3 ww = normalize(ta - ro);
    vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
    vec3 vv = normalize(cross(uu, ww));
    vec3 rd = normalize(p.x * uu + p.y * vv + 1.7 * ww);

    float t = 0.05;
    float maxDist = 15.0;
    float hit = 0.0;
    float bestTrap = 0.0;
    float godRayAccum = 0.0;

    for (int i = 0; i < 70; i++) {
        vec3 pos = ro + rd * t;
        float trap;
        float d = mapSponge(pos, trap);
        godRayAccum += exp(-max(d, 0.0) * 6.0) * 0.035;

        if (d < 0.002 * t) {
            hit = 1.0;
            bestTrap = trap;
            break;
        }
        t += d;
        if (t > maxDist) break;
    }

    vec3 col = vec3(0.015, 0.015, 0.025);

    if (hit > 0.5) {
        vec3 hitPos = ro + rd * t;
        vec3 norm = calcNormal(hitPos);
        vec3 lightDir = normalize(vec3(0.6, 0.9, 0.4));

        float diff = clamp(dot(norm, lightDir), 0.0, 1.0);
        float spec = pow(clamp(dot(reflect(rd, norm), lightDir), 0.0, 1.0), 32.0);

        // Cathedral stone masonry & alchemical gold edging
        vec3 darkBasalt = vec3(0.08, 0.08, 0.1);
        vec3 goldLeaf = vec3(1.0, 0.78, 0.25);
        vec3 surfaceCol = mix(darkBasalt, goldLeaf, clamp(bestTrap * u_gold_trim, 0.0, 1.0));

        col = surfaceCol * (diff * 0.8 + 0.2) + vec3(spec * 0.6);

        // Atmospheric fog
        col = mix(col, vec3(0.02, 0.02, 0.04), 1.0 - exp(-0.05 * t * t));
    }

    // Volumetric Crepuscular God-Rays
    vec3 lightShaftCol = vec3(1.0, 0.9, 0.6);
    col += lightShaftCol * godRayAccum * u_crepuscular_rays * u_intensity;

    out_col = vec4(clamp(col, 0.0, 1.0), 1.0);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(vec2(UV.x, 1.0 - UV.y), col);
    COLOR = vec4(col.rgb, u_fade);
}
