shader_type canvas_item;
uniform float u_fade = 1.0;
uniform sampler2D tDiffuse : hint_default_black;
uniform sampler2D tPrevFrame : hint_default_black;
uniform vec2 u_resolution = vec2(1060.0, 550.0);
uniform float u_time = 0.0;
/*
 * VORTEX REALMS - SHADER V02: INFINITE GOTHIC CATHEDRAL NAVE COLONNADE
 * --------------------------------------------------------------------
 * Endless, high-speed flight down the monumental central nave of a hyper-dimensional
 * gothic cathedral. 
 * Features:
 *   - Continuous forward camera motion down endless clustered stone colonnades
 *   - Pointed ogival rib vaults intersecting in golden groins overhead
 *   - Volumetric stained-glass rose window god rays sweeping across the chasm
 *   - Specular reflections across polished mirror-obsidian marble flagstones
 *   - Atmospheric holy incense depth haze with sacred spectral dispersion
 */






uniform float u_intensity = 1.0;        // Atmospheric grandeur boost (default: 1.0)
uniform float u_flight_speed = 1.8;     // Flight velocity down the nave (0.5 to 4.0, default: 1.8)
uniform float u_vault_height = 4.8;     // Height of pointed rib arches (2.0 to 8.0, default: 4.8)
uniform float u_stained_glass = 1.3;    // Stained glass color saturation (0.2 to 2.5, default: 1.3)
uniform float u_god_ray_boost = 1.5;    // Volumetric ray shaft illumination (0.2 to 3.0, default: 1.5)
uniform float u_fog_density = 0.045;      // Incense mist extinction coefficient (0.01 to 0.15, default: 0.045)



vec2 rot(vec2 p, float a) {
    float s = sin(a), c = cos(a);
    return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}

// Distance to pointed gothic ogival arch in 2D
float sdGothicArch(vec2 p, float w, float h) {
    p.x = abs(p.x);
    vec2 c = vec2(w * 0.5, 0.0);
    float r = length(vec2(w * 0.5, h));
    return length(p - c) - r;
}

// Map the infinite cathedral nave geometry
float mapCathedral(vec3 pos, out vec3 matCol) {
    // Continuous forward motion along Z
    float zRep = 4.0;
    float zIdx = floor(pos.z / zRep);
    vec3 p = pos;
    p.z = mod(p.z, zRep) - zRep * 0.5;

    // Sinuous gentle camera path roll
    float roll = sin(pos.z * 0.08) * 0.15;
    p.xy = rot(p.xy, roll);

    float dScene = 1e5;
    matCol = vec3(0.12, 0.11, 0.15); // Weathered basalt stone

    // 1. Polished Obsidian Marble Floor (y = -1.5)
    float dFloor = pos.y + 1.5;
    if (dFloor < dScene) {
        dScene = dFloor;
        // Flagstone tile pattern
        vec2 tile = fract(vec2(pos.x, pos.z * 0.5));
        float border = step(0.04, min(tile.x, tile.y));
        matCol = mix(vec3(0.02, 0.02, 0.03), vec3(0.15, 0.12, 0.18), border);
    }

    // 2. Colonnade Pillars (Rows at x = -2.5 and x = +2.5)
    vec3 pCol = p;
    float colX = abs(pCol.x) - 2.5;
    // Clustered gothic shaft: main cylinder plus 4 decorative shafts
    float dMainCol = length(vec2(colX, pCol.z)) - 0.38;
    vec2 pSub = vec2(abs(colX) - 0.32, abs(pCol.z) - 0.32);
    float dSubCol = length(pSub) - 0.12;
    float dPillars = min(dMainCol, dSubCol);
    if (dPillars < dScene) {
        dScene = dPillars;
        matCol = vec3(0.25, 0.22, 0.28); // Carved limestone capital
    }

    // 3. Vaulted Gothic Rib Arches overhead
    float archH = u_vault_height;
    float dArch = sdGothicArch(vec2(p.x, p.y - 1.0), 5.0, archH);
    float dRibThickness = max(dArch, -(dArch + 0.35));
    float dRibZ = abs(p.z) - 0.18;
    float dRib = max(dRibThickness, dRibZ);
    if (dRib < dScene) {
        dScene = dRib;
        matCol = vec3(0.85, 0.72, 0.4); // Gilded rib edge
    }

    // 4. Stained Glass Clerestory Windows (Upper lateral walls)
    float dWindowWall = abs(p.x) - 3.2;
    if (dWindowWall < dScene && p.y > 0.5) {
        dScene = dWindowWall;
        float rosePattern = sin(pos.z * 4.0) * sin(p.y * 3.0);
        vec3 glass = 0.5 + 0.5 * cos(rosePattern * 6.0 + vec3(0.0, 2.0, 4.0));
        matCol = glass * u_stained_glass * 2.0;
    }

    return dScene;
}

// Surface normal
vec3 getNormal(vec3 p) {
    vec2 e = vec2(0.003, 0.0);
    vec3 dummy;
    float d = mapCathedral(p, dummy);
    return normalize(vec3(
        mapCathedral(p + e.xyy, dummy) - d,
        mapCathedral(p + e.yxy, dummy) - d,
        mapCathedral(p + e.yyx, dummy) - d
    ));
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 p = (vUv - 0.5) * 2.0;
    p.x *= u_resolution.x / u_resolution.y;

    // Flight camera origin and ray direction
    float zTravel = u_time * 3.5 * u_flight_speed * u_intensity;
    // Camera weaves slightly side to side as if floating through the nave
    vec3 ro = vec3(sin(zTravel * 0.12) * 0.6, -0.1 + sin(zTravel * 0.2) * 0.2, zTravel);
    vec3 target = vec3(sin((zTravel + 6.0) * 0.12) * 0.6, 0.0, zTravel + 6.0);
    vec3 ww = normalize(target - ro);
    vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
    vec3 vv = cross(uu, ww);
    vec3 rd = normalize(p.x * uu + p.y * vv + 1.4 * ww);

    // Volumetric raymarching loop
    float t = 0.1;
    float maxDist = 45.0;
    vec3 hitCol = vec3(0.0);
    float hit = 0.0;
    vec3 objCol = vec3(0.0);
    float godRays = 0.0;

    for (int i = 0; i < 75; i++) {
        vec3 pos = ro + rd * t;
        float d = mapCathedral(pos, objCol);

        // Volumetric stained glass shaft accumulation
        float shaft = sin(pos.z * 0.8 + pos.x * 1.5 - u_time * 1.2) * sin(pos.y * 1.2);
        godRays += max(0.0, shaft) * exp(-t * 0.06) * 0.025 * u_god_ray_boost;

        if (d < 0.004) {
            hit = 1.0;
            break;
        }
        t += max(0.015, d * 0.7);
        if (t > maxDist) break;
    }

    vec3 col = vec3(0.02, 0.015, 0.03); // Deep sanctuary chasm shadow

    if (hit > 0.5) {
        vec3 pos = ro + rd * t;
        vec3 n = getNormal(pos);

        // Directional sanctuary lantern light
        vec3 lightDir = normalize(vec3(0.4, 0.8, -0.5));
        float diff = max(dot(n, lightDir), 0.0);
        float spec = pow(max(dot(reflect(-lightDir, n), -rd), 0.0), 16.0);

        col = objCol * (0.2 + 0.8 * diff) + vec3(1.0, 0.9, 0.7) * spec * 0.6;

        // Subtle reflection on polished floor
        if (pos.y < -1.48) {
            vec3 refDir = reflect(rd, n);
            vec2 sampleUv = clamp(vUv + refDir.xy * 0.1, 0.0, 1.0);
            col += texture(tDiffuse, sampleUv).rgb * 0.25;
        }
    }

    // Volumetric Stained Glass Light Beams (Magenta, Cobalt, Amber)
    vec3 rayColor = 0.5 + 0.5 * cos(u_time * 0.5 + vec3(0.0, 1.8, 3.6));
    col += rayColor * godRays * u_stained_glass;

    // Atmospheric incense fog depth falloff
    float fog = 1.0 - exp(-t * u_fog_density);
    vec3 fogColor = vec3(0.08, 0.05, 0.12) + rayColor * 0.15;
    col = mix(col, fogColor, clamp(fog, 0.0, 1.0));

    // Blend scene texture into ambient architecture
    vec3 sceneTex = texture(tDiffuse, vUv).rgb;
    col = mix(col, col + sceneTex * 0.18, 0.75);

    out_col = vec4(clamp(col, 0.0, 1.0), 1.0);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(vec2(UV.x, 1.0 - UV.y), col);
    COLOR = vec4(col.rgb, u_fade);
}
