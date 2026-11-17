shader_type canvas_item;
uniform float u_fade = 1.0;
uniform sampler2D tDiffuse : hint_default_black;
uniform sampler2D tPrevFrame : hint_default_black;
uniform vec2 u_resolution = vec2(1060.0, 550.0);
uniform float u_time = 0.0;
/*
 * TRIP MATH SUITE - SHADER T05: GYROID & SCHWARZ P MINIMAL SURFACES (TPMS)
 * --------------------------------------------------------------------------
 * Continuous 3D supersonic flight through the interior labyrinthine corridors of
 * Triply Periodic Minimal Surfaces (TPMS):
 *   1. Gyroid (Alan Schoen, 1970):
 *        sin(x)*cos(y) + sin(y)*cos(z) + sin(z)*cos(x) = 0
 *   2. Schwarz P ("Primitive") Surface (Hermann Schwarz, 1865):
 *        cos(x) + cos(y) + cos(z) = 0
 *   3. Neovius Surface:
 *        3*(cos(x) + cos(y) + cos(z)) + 4*cos(x)*cos(y)*cos(z) = 0
 * Features:
 *   - Smooth 3D navigation down the helical zero-mean-curvature tunnels
 *   - Guaranteed camera path clearance preventing any wall clipping
 *   - Iridescent pearlescent ceramic glaze with specular caustics
 *   - Circulating interior bioluminescent fluid streams
 *   - Smooth dynamic Bonnet transformation morphing between minimal surface manifolds
 */

uniform float u_intensity = 1.0;        // Morph factor (default: 1.0)
uniform float u_surface_blend = 0.0;    // 0 = Gyroid, 1 = Schwarz P, 2 = Neovius
uniform float u_wall_thickness = 0.21;   // Shell solid thickness (0.02 to 0.4)
uniform float u_tpms_scale = 1.0;       // Spatial frequency of minimal surface cells
uniform float u_inner_biolum = 1.0;     // Fluid circulation light emission

vec2 rot(vec2 p, float a) {
    float s = sin(a), c = cos(a);
    return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}

// Camera flight corridor path in 3D
vec2 camPath(float z) {
    return vec2(sin(z * 0.35) * 0.65, cos(z * 0.28) * 0.55);
}

// Distance estimator for morphing TPMS with guaranteed channel clearance
float mapTPMS(vec3 pos, out float valOut, out vec3 surfCol) {
    float s = max(0.4, u_tpms_scale * 0.85);
    vec3 p = pos * s;

    // 1. Gyroid equation
    float gyroid = sin(p.x) * cos(p.y) + sin(p.y) * cos(p.z) + sin(p.z) * cos(p.x);

    // 2. Schwarz P surface
    float schwarzP = cos(p.x) + cos(p.y) + cos(p.z);

    // 3. Neovius surface
    float neovius = 3.0 * (cos(p.x) + cos(p.y) + cos(p.z)) + 4.0 * cos(p.x) * cos(p.y) * cos(p.z);

    // Smooth continuous Bonnet transformation morphing
    float mode = clamp(u_surface_blend + sin(u_time * 0.2) * 0.5, 0.0, 2.0);
    float isoVal;
    if (mode < 1.0) {
        isoVal = mix(gyroid, schwarzP, mode);
    } else {
        isoVal = mix(schwarzP, neovius * 0.22, mode - 1.0);
    }

    // Dynamic standing wave resonance
    isoVal += 0.18 * sin(u_time * 0.8 + p.z * 0.5) * u_intensity;
    valOut = isoVal;

    // Shell solid thickness
    float thick = max(0.04, u_wall_thickness * 0.65);
    float dSolid = (abs(isoVal) - thick) / (s * 1.6);

    // Guaranteed clearance envelope around camera path
    vec2 cPos = camPath(pos.z);
    float distFromCamPath = length(pos.xy - cPos);
    float dCorridor = 0.52 - distFromCamPath;

    // Carve open flight corridor so camera never clips into TPMS walls
    float dFinal = max(dSolid, dCorridor);

    // Surface coloration
    vec3 ceramic = mix(vec3(0.08, 0.12, 0.18), vec3(0.85, 0.92, 0.98), clamp(isoVal * 1.5 + 0.5, 0.0, 1.0));
    vec3 irid = 0.5 + 0.5 * cos(pos.z * 0.8 + vec3(0.0, 2.0, 4.0));
    surfCol = mix(ceramic, irid, 0.35);

    return dFinal;
}

vec3 calcNormal(vec3 p) {
    float dummyV; vec3 dummyC;
    vec2 e = vec2(0.005, -0.005);
    return normalize(
        e.xyy * mapTPMS(p + e.xyy, dummyV, dummyC) +
        e.yyx * mapTPMS(p + e.yyx, dummyV, dummyC) +
        e.yxy * mapTPMS(p + e.yxy, dummyV, dummyC) +
        e.xxx * mapTPMS(p + e.xxx, dummyV, dummyC)
    );
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 p = (vUv - 0.5) * 2.0;
    p.x *= u_resolution.x / u_resolution.y;

    // Supersonic 3D flight through the minimal surface labyrinth
    float zTravel = u_time * 2.6 * u_intensity;

    vec2 cCurrent = camPath(zTravel);
    vec2 cTarget = camPath(zTravel + 6.0);
    float bank = -sin(zTravel * 0.35) * 0.16;
    vec2 pRot = rot(p, bank);

    vec3 ro = vec3(cCurrent, zTravel);
    vec3 ta = vec3(cTarget, zTravel + 6.0);
    vec3 ww = normalize(ta - ro);
    vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
    vec3 vv = cross(uu, ww);
    vec3 rd = normalize(pRot.x * uu + pRot.y * vv + 1.25 * ww);

    float t = 0.08;
    float maxDist = 32.0;
    float hit = 0.0;
    float hitVal = 0.0;
    vec3 hitCol = vec3(0.0);
    vec3 hitP = vec3(0.0);
    float fluidGlow = 0.0;

    for (int i = 0; i < 75; i++) {
        vec3 pos = ro + rd * t;
        float val;
        vec3 sCol;
        float d = mapTPMS(pos, val, sCol);

        // Circulating bioluminescent fluid glow along the channels
        float fluidDist = abs(val) - 0.05;
        fluidGlow += exp(-max(fluidDist * 8.0, 0.0)) * 0.04 * exp(-t * 0.06);

        if (d < 0.004) {
            hit = 1.0;
            hitVal = val;
            hitCol = sCol;
            hitP = pos;
            break;
        }
        t += max(0.02, d * 0.75);
        if (t > maxDist) break;
    }

    vec3 col = vec3(0.012, 0.016, 0.028);

    if (hit > 0.5) {
        vec3 norm = calcNormal(hitP);
        vec3 lightDir = normalize(vec3(0.4, 0.8, -0.45));
        vec3 ref = reflect(rd, norm);

        float diff = clamp(dot(norm, lightDir), 0.0, 1.0);
        float spec = pow(clamp(dot(ref, lightDir), 0.0, 1.0), 32.0);
        float fresnel = pow(clamp(1.0 - dot(-rd, norm), 0.0, 1.0), 3.0);

        // Iridescent reflection highlight
        vec3 iridSpec = 0.5 + 0.5 * cos(dot(norm, vec3(1.0)) * 5.0 + u_time + vec3(0.0, 2.0, 4.0));
        col = hitCol * (0.3 + 0.7 * diff) + (vec3(spec * 0.7) + iridSpec * fresnel * 0.6);

        // Distance fog fade
        col = mix(col, vec3(0.015, 0.02, 0.035), 1.0 - exp(-0.035 * t));
    }

    // Emerald & cyan bioluminescent fluid circulation glow
    vec3 bioFluid = mix(vec3(0.0, 1.0, 0.7), vec3(0.1, 0.5, 1.0), sin(zTravel * 0.5) * 0.5 + 0.5);
    col += bioFluid * fluidGlow * u_inner_biolum * 1.5 * u_intensity;

    // Volumetric caustic light streaming down the corridor
    float caustic = pow(max(0.0, sin(pRot.x * 4.0 + pRot.y * 4.0 + u_time * 3.0)), 12.0);
    col += vec3(0.3, 0.85, 1.0) * caustic * 0.25 * exp(-length(pRot) * 1.2);

    // Blending with scene texture
    vec3 sceneTex = texture(tDiffuse, vUv).rgb;
    col = mix(col, col + sceneTex * 0.2, 0.85);

    out_col = vec4(clamp(col, 0.0, 1.0), 1.0);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(vec2(UV.x, 1.0 - UV.y), col);
    COLOR = vec4(col.rgb, u_fade);
}
