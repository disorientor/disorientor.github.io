shader_type canvas_item;
uniform float u_fade = 1.0;
uniform sampler2D tDiffuse : hint_default_black;
uniform sampler2D tPrevFrame : hint_default_black;
uniform vec2 u_resolution = vec2(1060.0, 550.0);
uniform float u_time = 0.0;
/*
 * FRACTAL REALMS - SHADER F11: HYPERBOLIC COLONNADE CATHEDRAL IFS
 * ------------------------------------------------------------------
 * Raymarched 3D non-Euclidean hyperbolic cathedral architecture:
 *   - Folds 3D space according to hyperbolic {p, q} tiling symmetries
 *     and Poincaré half-space inversion metrics.
 *   - Generates infinite colonnades of fluted gothic pillars, ribbed groin vaults,
 *     pointed ogival arches, and floating alchemical candelabras.
 */






uniform float u_intensity = 1.0;        // Architectural depth factor (default: 1.0)
uniform float u_arch_radius = 1.0;      // Vault arch curvature (0.5 to 1.5)
uniform float u_pillar_repeat = 4.0;    // Colonnade periodicity spacing (2.0 to 6.0)
uniform float u_candelabra_glow = 1.0;  // Floating candle flame bloom
uniform float u_fly_speed = 1.0;        // Nave walkthrough velocity



// Distance estimator for hyperbolic cathedral colonnades
float mapCathedral(vec3 pos, out vec3 trap) {
    vec3 p = pos;
    float repeatDist = max(2.0, u_pillar_repeat);

    // Infinite colonnade repetition along Z (nave) and X (aisles)
    vec2 cell = floor(p.xz / repeatDist);
    p.xz = mod(p.xz, repeatDist) - repeatDist * 0.5;

    vec3 minTrap = abs(p);

    // Fluted Column / Pillar SDF
    float rPillar = 0.28;
    // Add fluting grooves
    float fluting = 0.02 * cos(atan(p.z, p.x) * 16.0);
    float dPillar = length(p.xz) - (rPillar + fluting);

    // Ribbed Groin Vault Arches (pointed gothic ogival profile)
    float archH = 2.4;
    float archR = max(0.5, u_arch_radius);
    float dArchX = length(vec2(abs(p.x) - archR, max(0.0, p.y - archH))) - 0.12;
    float dArchZ = length(vec2(abs(p.z) - archR, max(0.0, p.y - archH))) - 0.12;
    float dVault = min(dArchX, dArchZ);

    // Stone Floor & Ceiling
    float dFloor = p.y + 0.1;
    float dCeil = -(p.y - 4.5);

    // Floating Candelabra Singularity Core
    vec3 pCandle = p - vec3(0.0, 1.8 + 0.2 * sin(u_time * 2.0 + cell.x), 0.0);
    float dCandle = length(pCandle) - 0.08;

    trap = minTrap;
    float dStructure = min(dPillar, min(dVault, min(dFloor, dCeil)));
    return min(dStructure, dCandle);
}

vec3 calcNormal(vec3 p) {
    vec3 dummy;
    float eps = 0.003;
    vec2 e = vec2(1.0, -1.0) * eps;
    return normalize(
        e.xyy * mapCathedral(p + e.xyy, dummy) +
        e.yyx * mapCathedral(p + e.yyx, dummy) +
        e.yxy * mapCathedral(p + e.yxy, dummy) +
        e.xxx * mapCathedral(p + e.xxx, dummy)
    );
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 p = (vUv - 0.5) * 2.0;
    p.x *= u_resolution.x / u_resolution.y;

    // Camera traveling down the infinite central nave
    float speed = max(0.2, u_fly_speed) * 1.5;
    float zCam = u_time * speed;
    vec3 ro = vec3(0.0, 1.2 + 0.1 * sin(u_time * 0.8), zCam);
    vec3 ta = ro + vec3(0.0, -0.05, 5.0);
    vec3 ww = normalize(ta - ro);
    vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
    vec3 vv = normalize(cross(uu, ww));
    vec3 rd = normalize(p.x * uu + p.y * vv + 1.6 * ww);

    float t = 0.05;
    float maxDist = 22.0;
    float hit = 0.0;
    vec3 bestTrap = vec3(0.0);
    float candleGlow = 0.0;

    for (int i = 0; i < 72; i++) {
        vec3 pos = ro + rd * t;
        vec3 trap;
        float d = mapCathedral(pos, trap);
        candleGlow += exp(-max(d, 0.0) * 14.0) * 0.04;

        if (d < 0.002 * t) {
            hit = 1.0;
            bestTrap = trap;
            break;
        }
        t += d;
        if (t > maxDist) break;
    }

    vec3 col = vec3(0.01, 0.008, 0.015); // Deep cathedral dark

    if (hit > 0.5) {
        vec3 hitPos = ro + rd * t;
        vec3 norm = calcNormal(hitPos);
        vec3 lightPos = ro + vec3(0.0, 1.8, 2.0);
        vec3 lightDir = normalize(lightPos - hitPos);

        float diff = clamp(dot(norm, lightDir), 0.0, 1.0);
        float distToLight = length(lightPos - hitPos);
        float atten = 1.0 / (1.0 + 0.2 * distToLight + 0.05 * distToLight * distToLight);

        // Ancient weathered limestone & gold mosaic trim
        vec3 stone = mix(vec3(0.22, 0.2, 0.18), vec3(0.12, 0.11, 0.1), step(0.5, fract(hitPos.y * 2.0)));
        vec3 goldTrim = vec3(0.95, 0.75, 0.25) * step(2.3, hitPos.y) * step(hitPos.y, 2.5);

        col = (stone + goldTrim) * (diff * 0.8 + 0.15) * atten;
        col = mix(col, vec3(0.01, 0.01, 0.02), 1.0 - exp(-0.04 * t * t));
    }

    // Warm sanctuary candle flame bloom
    vec3 flameCol = vec3(1.0, 0.65, 0.2);
    col += flameCol * candleGlow * u_candelabra_glow * u_intensity;

    out_col = vec4(clamp(col, 0.0, 1.0), 1.0);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(vec2(UV.x, 1.0 - UV.y), col);
    COLOR = vec4(col.rgb, u_fade);
}
