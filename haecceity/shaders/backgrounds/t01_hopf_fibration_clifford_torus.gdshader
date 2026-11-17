shader_type canvas_item;
uniform float u_fade = 1.0;
uniform sampler2D tDiffuse : hint_default_black;
uniform sampler2D tPrevFrame : hint_default_black;
uniform vec2 u_resolution = vec2(1060.0, 550.0);
uniform float u_time = 0.0;
/*
 * TRIP MATH SUITE - SHADER T01: HOPF FIBRATION & CLIFFORD TORUS 4D
 * ------------------------------------------------------------------
 * Visualizes the Hopf Fibration: mapping the 3-sphere S^3 in R^4 to the 2-sphere S^2
 * via great circles (Hopf fibers).
 * Features:
 *   - Stereographic projection from R^4 to R^3:
 *       (x, y, z, w) in S^3  ==>  P = (x, y, z) / (1 - w)
 *   - The fibers corresponding to constant latitudes on S^2 form nested Clifford Tori.
 *   - Villarceau circles: doubly ruled nested torus families rotating through 4D phase space.
 *   - Chromatic fiber bundle phase coloration: base S^2 coordinates mapped to smooth RGB hues.
 */






uniform float u_intensity = 1.0;        // 4D rotation velocity (default: 1.0)
uniform float u_fiber_density = 3.5;    // Number of nested Clifford torus shells (1.0 to 6.0)
uniform float u_bundle_twist = 3.0;     // Fiber twist winding number (1.0 to 5.0)
uniform float u_villarceau_glow = 1.0;  // Core singularity fiber beam intensity
uniform float u_cam_distance = 3.0;     // Viewing distance



// Distance estimator for nested Clifford tori fibers
float mapHopf(vec3 pos, out vec3 fiberCol) {
    vec3 p = pos;
    float r = length(p);

    // Inverse stereographic projection from R^3 to S^3 in R^4
    // (x, y, z, w) = (2*X, 2*Y, 2*Z, r^2 - 1) / (r^2 + 1)
    float denom = r * r + 1.0;
    vec4 q = vec4(2.0 * p, r * r - 1.0) / denom;

    // 4D rotation across (x-w) and (y-z) planes
    float rotA = u_time * 0.4 * u_intensity;
    float rotB = u_time * 0.25 * u_intensity;
    float ca = cos(rotA), sa = sin(rotA);
    float cb = cos(rotB), sb = sin(rotB);

    q.xw = vec2(q.x * ca - q.w * sa, q.x * sa + q.w * ca);
    q.yz = vec2(q.y * cb - q.z * sb, q.y * sb + q.z * cb);

    // Hopf map: S^3 -> S^2
    // z0 = q.x + i*q.y,  z1 = q.z + i*q.w
    // base sphere coords:
    // S_x = 2 * (q.x * q.z + q.y * q.w)
    // S_y = 2 * (q.y * q.z - q.x * q.w)
    // S_z = q.x^2 + q.y^2 - q.z^2 - q.w^2
    vec3 baseS2 = vec3(
        2.0 * (q.x * q.z + q.y * q.w),
        2.0 * (q.y * q.z - q.x * q.w),
        q.x * q.x + q.y * q.y - q.z * q.z - q.w * q.w
    );

    // Map base sphere position to fiber color
    fiberCol = 0.5 + 0.5 * baseS2;

    // Distance to nearest nested Clifford torus shell
    float shells = max(1.0, u_fiber_density);
    float torusPhase = asin(clamp(baseS2.z, -1.0, 1.0)) * shells;
    float dShell = abs(sin(torusPhase));

    // Distance to Villarceau circle fiber stream lines
    float fiberPhase = atan(baseS2.y, baseS2.x) * u_bundle_twist + atan(q.y, q.x);
    float dFiber = abs(sin(fiberPhase));

    float distToFilament = (dShell * 0.3 + dFiber * 0.2) * (denom * 0.5);
    return distToFilament;
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 p = (vUv - 0.5) * 2.0;
    p.x *= u_resolution.x / u_resolution.y;

    float camDist = max(2.0, u_cam_distance);
    float camA = u_time * 0.15;
    vec3 ro = vec3(cos(camA) * camDist, 1.2 + 0.4 * sin(camA * 0.7), sin(camA) * camDist);
    vec3 ta = vec3(0.0, 0.0, 0.0);
    vec3 ww = normalize(ta - ro);
    vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
    vec3 vv = normalize(cross(uu, ww));
    vec3 rd = normalize(p.x * uu + p.y * vv + 1.8 * ww);

    float t = 0.1;
    float maxDist = 12.0;
    vec3 colAccum = vec3(0.0);
    float density = 0.0;

    for (int i = 0; i < 64; i++) {
        vec3 pos = ro + rd * t;
        vec3 fCol;
        float d = mapHopf(pos, fCol);

        if (d < 0.15) {
            float dens = (0.15 - d) * 1.8;
            colAccum += fCol * dens * (1.0 - density);
            density += dens * 0.14;
            if (density >= 0.95) break;
        }

        t += max(0.03, d * 0.5);
        if (t > maxDist) break;
    }

    vec3 col = vec3(0.01, 0.01, 0.02) + colAccum * u_villarceau_glow * u_intensity;

    // Background cosmic star dust
    vec3 scene = texture(tDiffuse, vUv).rgb;
    col = mix(scene * 0.15 + col, col, 0.88);

    out_col = vec4(clamp(col, 0.0, 1.0), 1.0);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(vec2(UV.x, 1.0 - UV.y), col);
    COLOR = vec4(col.rgb, u_fade);
}
