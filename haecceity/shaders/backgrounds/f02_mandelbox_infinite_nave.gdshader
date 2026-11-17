shader_type canvas_item;
uniform float u_fade = 1.0;
uniform sampler2D tDiffuse : hint_default_black;
uniform sampler2D tPrevFrame : hint_default_black;
uniform vec2 u_resolution = vec2(1060.0, 550.0);
uniform float u_time = 0.0;
/*
 * FRACTAL REALMS - SHADER F02: MANDELBOX INFINITE GOTHIC NAVE
 * -------------------------------------------------------------
 * Raymarched 3D Mandelbox fractal invented by Tom Lowe (Tglad).
 * Combines two geometric foldings:
 *   1. Box Fold: If |x| > 1, x = 2*sign(x) - x
 *   2. Sphere Fold: If r < min_r: scale by (fixed_r / min_r)^2
 *                   If min_r <= r < fixed_r: scale by (fixed_r / r)^2
 *   3. Scale and Translate: z = scale * z + c
 * Yields mind-bending infinite non-Euclidean gothic halls, arches, and colonnades.
 */






uniform float u_intensity = 1.0;        // Morph factor (default: 1.0)
uniform float u_scale = -2.6;            // Mandelbox scale factor (-3.5 to -1.5, default: -2.6)
uniform float u_folding_limit = 1.0;    // Box folding bound (0.8 to 1.5, default: 1.0)
uniform float u_min_radius = 0.5;       // Sphere fold minimum radius (0.2 to 0.8, default: 0.5)
uniform float u_cam_speed = 1.0;        // Fly-through camera velocity
uniform float u_ambient_glow = 1.0;     // Gothic lantern light bloom



// Box folding operation
void boxFold(inout vec3 z, float foldLimit) {
    z = clamp(z, -foldLimit, foldLimit) * 2.0 - z;
}

// Spherical folding operation
void sphereFold(inout vec3 z, inout float dz, float minR, float fixedR) {
    float r2 = dot(z, z);
    if (r2 < minR * minR) {
        float temp = (fixedR * fixedR) / (minR * minR);
        z *= temp;
        dz *= temp;
    } else if (r2 < fixedR * fixedR) {
        float temp = (fixedR * fixedR) / r2;
        z *= temp;
        dz *= temp;
    }
}

// Distance Estimator for Mandelbox
float mapMandelbox(vec3 pos, out vec3 trap) {
    vec3 offset = pos;
    vec3 z = pos;
    float dr = 1.0;
    float baseScale = (abs(u_scale) > 0.5) ? u_scale : -2.6;
    float scale = baseScale + 0.15 * sin(u_time * 0.3) * u_intensity;
    float fLimit = (u_folding_limit > 0.2) ? u_folding_limit : 1.0;
    float minR = (u_min_radius > 0.1) ? u_min_radius : 0.5;
    float fixedR = 1.0;

    vec3 minTrap = vec3(1e5);

    for (int n = 0; n < 14; n++) {
        boxFold(z, fLimit);
        sphereFold(z, dr, minR, fixedR);
        z = scale * z + offset;
        dr = dr * abs(scale) + 1.0;

        minTrap = min(minTrap, abs(z));
    }

    trap = minTrap;
    float r = length(z);
    return max(r / abs(dr), 0.0005);
}

// Normal calculation
vec3 calcNormal(vec3 p) {
    vec3 dummy;
    float eps = 0.003;
    vec2 e = vec2(1.0, -1.0) * eps;
    return normalize(
        e.xyy * mapMandelbox(p + e.xyy, dummy) +
        e.yyx * mapMandelbox(p + e.yyx, dummy) +
        e.yxy * mapMandelbox(p + e.yxy, dummy) +
        e.xxx * mapMandelbox(p + e.xxx, dummy)
    );
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 p = (vUv - 0.5) * 2.0;
    p.x *= u_resolution.x / u_resolution.y;

    // Stable 360-degree cathedral orbit camera path
    float tCam = u_time * (0.2 * max(0.2, u_cam_speed));
    float camDist = 5.2;
    vec3 ro = vec3(sin(tCam) * camDist, 1.8 + 0.8 * sin(tCam * 0.5), cos(tCam) * camDist);
    vec3 ta = vec3(0.0, 0.2, 0.0);
    vec3 ww = normalize(ta - ro);
    vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
    vec3 vv = normalize(cross(uu, ww));
    vec3 rd = normalize(p.x * uu + p.y * vv + 1.7 * ww);

    // Raymarching
    float t = 0.05;
    float maxDist = 18.0;
    float hit = 0.0;
    vec3 bestTrap = vec3(0.0);
    float volumetricGlow = 0.0;

    for (int i = 0; i < 75; i++) {
        vec3 pos = ro + rd * t;
        vec3 trap;
        float d = mapMandelbox(pos, trap);
        volumetricGlow += exp(-d * 8.0) * 0.035;

        if (d < 0.002 * t) {
            hit = 1.0;
            bestTrap = trap;
            break;
        }
        t += d;
        if (t > maxDist) break;
    }

    vec3 col = vec3(0.02, 0.015, 0.03); // Gothic cathedral shadow

    if (hit > 0.5) {
        vec3 hitPos = ro + rd * t;
        vec3 norm = calcNormal(hitPos);
        vec3 lightPos = ro + vec3(0.0, 1.5, 2.0);
        vec3 lightDir = normalize(lightPos - hitPos);

        float diff = clamp(dot(norm, lightDir), 0.0, 1.0);
        float amb = 0.2;

        // Medieval sandstone / gold leaf colonnade palette
        vec3 stone = mix(vec3(0.2, 0.18, 0.16), vec3(0.85, 0.65, 0.25), clamp(bestTrap.x * 0.4, 0.0, 1.0));
        vec3 gothicAccent = mix(stone, vec3(0.1, 0.5, 0.8), clamp(bestTrap.z * 0.3, 0.0, 1.0));

        col = gothicAccent * (diff * 0.8 + amb);

        // Distance fog / atmospheric haze
        float fog = 1.0 - exp(-0.04 * t * t);
        col = mix(col, vec3(0.03, 0.02, 0.05), fog);
    }

    // Volumetric Lantern / Sanctuary Glow
    vec3 lanternColor = vec3(1.0, 0.6, 0.2); // Warm candelabra gold
    col += lanternColor * volumetricGlow * u_ambient_glow;

    out_col = vec4(clamp(col, 0.0, 1.0), 1.0);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(vec2(UV.x, 1.0 - UV.y), col);
    COLOR = vec4(col.rgb, u_fade);
}
