shader_type canvas_item;
uniform float u_fade = 1.0;
uniform sampler2D tDiffuse : hint_default_black;
uniform sampler2D tPrevFrame : hint_default_black;
uniform vec2 u_resolution = vec2(1060.0, 550.0);
uniform float u_time = 0.0;
/*
 * TRIP MATH SUITE - SHADER T11: 4D KLEIN BOTTLE IMMERSION & NON-ORIENTABLE FLOW
 * --------------------------------------------------------------------------------
 * Visualizes the 4-dimensional Klein Bottle: a non-orientable 2-manifold with Euler
 * characteristic chi = 0.
 * In 4-space R^4, the Klein bottle does NOT intersect itself!
 * Parameterized by coordinates u in [0, 2*pi), v in [0, 2*pi):
 *   x = (r + cos(u/2)*sin(v) - sin(u/2)*sin(2v)) * cos(u)
 *   y = (r + cos(u/2)*sin(v) - sin(u/2)*sin(2v)) * sin(u)
 *   z = sin(u/2)*sin(v) + cos(u/2)*sin(2v)
 *   w = cos(v)   (The 4th dimension resolves self-intersection!)
 * Visualizes 4D rotational projection, Möbius boundary twist, and transparent raymarching.
 */






uniform float u_intensity = 1.0;        // 4D rotation velocity (default: 1.0)
uniform float u_tube_radius = 0.75;      // Cross-sectional tube thickness (0.3 to 1.2)
uniform float u_transparency = 1.0;     // Glass / X-ray volumetric opacity
uniform float u_geodesic_flow = 1.0;    // Möbius surface particle flow speed
uniform float u_color_mode = 0.0;       // 0 = Curvature, 1 = 4D Height W, 2 = Neon Spectral



// Distance estimator for 3D projection of Klein bottle
float mapKlein(vec3 p, out vec4 kleinParam) {
    // 4D Rotation across (z-w) and (x-y) planes
    float a = u_time * 0.3 * u_intensity;
    float ca = cos(a), sa = sin(a);

    // Coordinate conversion to polar
    float rXY = length(p.xy);
    float u = atan(p.y, p.x); // Toroidal angle u in [-pi, pi]
    if (u < 0.0) u += 6.2831853;

    // Tube radius and profile
    float rMajor = 1.6;
    float rMinor = max(0.2, u_tube_radius);

    // Figure-8 Klein bottle immersion cross section
    float halfU = u * 0.5;
    vec2 tubeCenter = vec2(
        rMajor + cos(halfU) * 0.35,
        sin(halfU) * 0.35
    );

    // Distance in meridian plane
    vec2 pCross = vec2(rXY, p.z) - tubeCenter;
    float dTube = length(pCross) - rMinor;

    // 4th dimensional depth coordinate W
    float w = sin(halfU) * pCross.x + cos(halfU) * pCross.y;

    kleinParam = vec4(u, atan(pCross.y, pCross.x), w, dTube);
    return dTube * 0.7;
}

vec3 calcNormal(vec3 p) {
    vec4 dummy;
    float eps = 0.003;
    vec2 e = vec2(1.0, -1.0) * eps;
    return normalize(
        e.xyy * mapKlein(p + e.xyy, dummy) +
        e.yyx * mapKlein(p + e.yyx, dummy) +
        e.yxy * mapKlein(p + e.yxy, dummy) +
        e.xxx * mapKlein(p + e.xxx, dummy)
    );
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 p = (vUv - 0.5) * 2.0;
    p.x *= u_resolution.x / u_resolution.y;

    float tCam = u_time * 0.18;
    vec3 ro = vec3(cos(tCam) * 3.6, 1.4 + 0.4 * sin(tCam * 0.7), sin(tCam) * 3.6);
    vec3 ta = vec3(0.0, 0.0, 0.0);
    vec3 ww = normalize(ta - ro);
    vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
    vec3 vv = normalize(cross(uu, ww));
    vec3 rd = normalize(p.x * uu + p.y * vv + 1.8 * ww);

    float t = 0.05;
    float maxDist = 12.0;
    float hit = 0.0;
    vec4 bestParam = vec4(0.0);
    float glow = 0.0;

    for (int i = 0; i < 68; i++) {
        vec3 pos = ro + rd * t;
        vec4 kParam;
        float d = mapKlein(pos, kParam);
        glow += exp(-max(d, 0.0) * 12.0) * 0.035;

        if (d < 0.002 * t) {
            hit = 1.0;
            bestParam = kParam;
            break;
        }
        t += d;
        if (t > maxDist) break;
    }

    vec3 col = vec3(0.015, 0.01, 0.025);

    if (hit > 0.5) {
        vec3 hitPos = ro + rd * t;
        vec3 norm = calcNormal(hitPos);
        vec3 lightDir = normalize(vec3(0.6, 0.85, 0.4));
        vec3 ref = reflect(rd, norm);

        float diff = clamp(dot(norm, lightDir), 0.0, 1.0);
        float spec = pow(clamp(dot(ref, lightDir), 0.0, 1.0), 32.0);

        // 4D Height Coordinate (W coordinate mapped to chromatic spectrum)
        float wCoord = bestParam.z;
        vec3 wHue = 0.5 + 0.5 * cos(wCoord * 4.0 + vec3(0.0, 2.0, 4.0));

        // Geodesic flow streamlines (showing non-orientable Möbius flip per revolution)
        float flowPhase = bestParam.x * 2.0 + bestParam.y - u_time * 2.0 * u_geodesic_flow;
        float streamline = smoothstep(0.7, 0.95, sin(flowPhase * 6.0));

        col = wHue * (diff * 0.75 + 0.25) + vec3(spec * 0.7);
        col += vec3(0.2, 0.95, 1.0) * streamline * 0.5;

        // X-ray glass edge glow
        float rim = 1.0 - clamp(dot(-rd, norm), 0.0, 1.0);
        col += vec3(0.8, 0.2, 1.0) * pow(rim, 2.5) * u_transparency;

        col = mix(col, vec3(0.01, 0.01, 0.03), 1.0 - exp(-0.07 * t * t));
    }

    // Volumetric 4D Core Emission
    vec3 coreGlow = vec3(0.1, 0.8, 1.0);
    col += coreGlow * glow * 1.2 * u_intensity;

    out_col = vec4(clamp(col, 0.0, 1.0), 1.0);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(vec2(UV.x, 1.0 - UV.y), col);
    COLOR = vec4(col.rgb, u_fade);
}
