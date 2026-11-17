shader_type canvas_item;
uniform float u_fade = 1.0;
uniform sampler2D tDiffuse : hint_default_black;
uniform sampler2D tPrevFrame : hint_default_black;
uniform vec2 u_resolution = vec2(1060.0, 550.0);
uniform float u_time = 0.0;
/*
 * VORTEX REALMS - SHADER V06: BISMUTH FRACTAL HOPPER STAIRCASE LABYRINTH
 * ----------------------------------------------------------------------
 * Descent down an infinite, stepped bismuth crystal hopper labyrinth.
 * Features:
 *   - Terraced 90-degree orthogonal square spiral staircases descending forever
 *   - Thin-film optical interference: iridescent rainbow metallic oxide sheen
 *     that shifts with ray incidence angle and oxide layer thickness
 *   - Recursive square hopper crystal geometry with concentric cantilevered terraces
 *   - Continuous downward plunge with smooth rotational orientation shifts
 */






uniform float u_intensity = 1.0;          // Crystal resonance boost (default: 1.0)
uniform float u_descent_speed = 2.2;       // Downward flight velocity (0.5 to 5.0, default: 2.2)
uniform float u_terrace_steps = 12.0;       // Step quantization density (4.0 to 24.0, default: 12.0)
uniform float u_iridescence_freq = 4.5;    // Thin-film interference color cycle (1.0 to 10.0, default: 4.5)
uniform float u_metallic_sheen = 1.6;      // Specular reflectance boost (0.5 to 3.0, default: 1.6)
uniform float u_hopper_angle = 0.785;        // Cantilevered hopper angle slope (0.2 to 1.5, default: 0.785)



vec2 rot(vec2 p, float a) {
    float s = sin(a), c = cos(a);
    return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}

// Bismuth thin-film rainbow interference formula (Air-Bi2O3-Bismuth metal interface)
vec3 bismuthIridescence(float thickness, float cosTheta) {
    float opd = 2.0 * 2.1 * thickness * cosTheta; // Optical Path Difference (n_oxide ~ 2.1)
    vec3 waveLengths = vec3(0.65, 0.53, 0.44);    // Red, Green, Blue wavelengths in microns
    vec3 phase = 6.2831853 * opd / waveLengths;
    return 0.5 + 0.5 * cos(phase);
}

// Distance estimator for recursive stepped hopper crystal
float mapBismuth(vec3 pos, out float oxideThick) {
    // Continuous descent along Y axis
    vec3 p = pos;
    float zRep = 6.0;
    p.z = mod(p.z, zRep) - zRep * 0.5;

    // 90-degree geometric hopper funnel
    float dScene = 1e5;
    
    // Scale and terrace stepping
    float numSteps = max(4.0, u_terrace_steps);
    
    // Orthogonal square bounds: max(|x|, |z|)
    float squareR = max(abs(p.x), abs(p.z));
    
    // Hopper terraced slope: radius expands with y in quantized steps
    float yQuant = floor(p.y * numSteps) / numSteps;
    float expectedR = yQuant * tan(u_hopper_angle) + 0.8;
    
    // Terrace ledge distance
    float dLedge = abs(squareR - expectedR) - 0.08;
    float dFloorStep = abs(fract(p.y * numSteps) - 0.5) / numSteps - 0.02;
    float dStep = max(dLedge, dFloorStep);

    // Cantilevered spiral corners
    vec2 pRot = rot(p.xz, p.y * 0.8);
    float cornerFin = abs(min(abs(pRot.x), abs(pRot.y))) - 0.05;

    dScene = min(dStep, max(cornerFin, abs(p.y) - 8.0));

    // Internal labyrinth corridor walls
    float dWalls = 2.8 - max(abs(p.x), abs(p.z));
    dScene = min(dScene, dWalls);

    // Oxide layer thickness varies along geometric terraces
    oxideThick = yQuant * 0.4 + squareR * 0.3 + sin(p.y * 5.0) * 0.1;

    return dScene;
}

vec3 getNormal(vec3 p) {
    vec2 e = vec2(0.003, 0.0);
    float dummy;
    float d = mapBismuth(p, dummy);
    return normalize(vec3(
        mapBismuth(p + e.xyy, dummy) - d,
        mapBismuth(p + e.yxy, dummy) - d,
        mapBismuth(p + e.yyx, dummy) - d
    ));
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 p = (vUv - 0.5) * 2.0;
    p.x *= u_resolution.x / u_resolution.y;

    // Downward descent flight path
    float yTravel = -u_time * 2.5 * u_descent_speed * u_intensity;
    // Spiral descent rotation
    float spin = yTravel * 0.15;
    vec3 ro = vec3(sin(spin) * 0.5, yTravel, cos(spin) * 0.5);
    vec3 target = vec3(0.0, yTravel - 5.0, 0.0);
    
    vec3 ww = normalize(target - ro);
    vec3 uu = normalize(cross(ww, vec3(0.0, 0.0, 1.0)));
    vec3 vv = cross(uu, ww);
    vec3 rd = normalize(p.x * uu + p.y * vv + 1.35 * ww);

    float t = 0.1;
    float maxDist = 35.0;
    float hit = 0.0;
    float bestOxide = 0.0;

    for (int i = 0; i < 75; i++) {
        vec3 pos = ro + rd * t;
        float oxide;
        float d = mapBismuth(pos, oxide);

        if (d < 0.003) {
            hit = 1.0;
            bestOxide = oxide;
            break;
        }
        t += max(0.015, d * 0.75);
        if (t > maxDist) break;
    }

    vec3 col = vec3(0.01, 0.015, 0.03); // Deep metallic chasm

    if (hit > 0.5) {
        vec3 pos = ro + rd * t;
        vec3 n = getNormal(pos);

        // View incidence angle for thin-film interference
        float cosTheta = clamp(abs(dot(-rd, n)), 0.05, 1.0);

        // Calculate thin-film rainbow iridescence
        vec3 rainbow = bismuthIridescence(bestOxide * u_iridescence_freq * 0.15, cosTheta);

        // Metallic lighting with specular hot spots
        vec3 lightDir = normalize(vec3(0.5, 0.9, -0.4));
        float diff = max(dot(n, lightDir), 0.0);
        float spec = pow(max(dot(reflect(-lightDir, n), -rd), 0.0), 24.0);

        col = rainbow * (0.35 + 0.65 * diff) + vec3(1.0, 0.95, 0.9) * spec * u_metallic_sheen;

        // Sample scene reflection on metallic crystal facets
        vec3 refDir = reflect(rd, n);
        vec2 sampleUv = clamp(vUv + refDir.xy * 0.15, 0.0, 1.0);
        vec3 refTex = texture(tDiffuse, sampleUv).rgb;
        col = mix(col, col + refTex * rainbow, 0.35);
    }

    // Depth fog with golden crystal glow
    float fog = 1.0 - exp(-t * 0.06);
    vec3 fogCol = vec3(0.05, 0.02, 0.08) + vec3(0.8, 0.6, 0.2) * (1.0 - exp(-t * 0.02));
    col = mix(col, fogCol, clamp(fog, 0.0, 1.0));

    out_col = vec4(clamp(col, 0.0, 1.0), 1.0);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(vec2(UV.x, 1.0 - UV.y), col);
    COLOR = vec4(col.rgb, u_fade);
}
