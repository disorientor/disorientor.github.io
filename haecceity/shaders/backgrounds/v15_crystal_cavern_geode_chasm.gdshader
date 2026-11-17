shader_type canvas_item;
uniform float u_fade = 1.0;
uniform sampler2D tDiffuse : hint_default_black;
uniform sampler2D tPrevFrame : hint_default_black;
uniform vec2 u_resolution = vec2(1060.0, 550.0);
uniform float u_time = 0.0;
/*
 * VORTEX REALMS - SHADER V15: CRYSTAL CAVERN AMETHYST GEODE EXPEDITION
 * --------------------------------------------------------------------
 * High-speed expedition through the crystalline interior of a colossal subterranean
 * amethyst and smoky-quartz geode chasm.
 * Features:
 *   - Hexagonal quartz & amethyst crystal monoliths jutting inwards from cavern walls
 *   - Internal light caustics with prismatic spectral dispersion across crystal facets
 *   - Rugged organic cave walls embedded with micro-crystalline druzy quartz shimmer
 *   - Floating luminescent dust motes dancing in crystal light shafts
 *   - Royal amethyst violet, electric cobalt, and translucent quartz highlights
 */






uniform float u_intensity = 1.0;            // Crystalline resonance boost (default: 1.0)
uniform float u_flight_speed = 1.8;         // Expedition flight velocity (0.5 to 4.0, default: 1.8)
uniform float u_crystal_density = 3.2;      // Hexagonal prism density (1.0 to 6.0, default: 3.2)
uniform float u_amethyst_hue = 1.4;         // Violet chromatic saturation (0.5 to 2.5, default: 1.4)
uniform float u_caustic_intensity = 1.6;    // Internal light caustics brightness (0.2 to 3.0, default: 1.6)
uniform float u_cave_roughness = 0.75;       // Wall druzy bump amplitude (0.2 to 1.5, default: 0.75)



vec2 rot(vec2 p, float a) {
    float s = sin(a), c = cos(a);
    return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}

float hash3(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
}

// Distance to hexagonal crystal prism
float sdHexPrism(vec3 p, vec2 h) {
    vec3 q = abs(p);
    return max(q.y - h.y, max((q.x * 0.866025 + q.z * 0.5), q.z) - h.x);
}

// Distance estimator for geode cave
float mapGeode(vec3 pos, out vec3 crystalCol) {
    vec3 p = pos;
    // Cave spine deformation
    p.xy += vec2(sin(p.z * 0.2), cos(p.z * 0.25)) * 0.5;

    // Outer cylindrical cavern wall
    float rWall = 2.4 + sin(p.z * 0.4) * 0.3;
    float dCave = rWall - length(p.xy);

    // Wall roughness (druzy quartz texture)
    float druzy = sin(p.x * 8.0) * sin(p.y * 8.0) * sin(p.z * 8.0) * 0.08 * u_cave_roughness;
    dCave += druzy;

    // Crystal clusters: periodic polar instancing along walls
    float theta = atan(p.y, p.x);
    float nCrystals = 6.0;
    float thSector = mod(theta + 3.14159 / nCrystals, 6.28318 / nCrystals) - 3.14159 / nCrystals;
    
    // Local crystal coordinate
    vec3 pCryst = vec3(length(p.xy) - rWall + 0.6, thSector * rWall, mod(p.z, 2.5) - 1.25);
    pCryst.xy = rot(pCryst.xy, 0.45);
    pCryst.yz = rot(pCryst.yz, 0.35);

    // Hexagonal crystal with pointed tip
    float dHex = sdHexPrism(pCryst, vec2(0.28, 0.9));
    float dTip = (pCryst.x + abs(pCryst.y) + abs(pCryst.z) - 1.2) * 0.577;
    float dCrystal = max(dHex, dTip);

    float dScene = min(dCave, dCrystal);

    if (dScene == dCrystal) {
        // Amethyst color gradient: dark royal violet at base, clear pale quartz at tip
        float tipFactor = clamp((pCryst.x + 0.5) * 0.8, 0.0, 1.0);
        vec3 deepAmethyst = vec3(0.45, 0.05, 0.85); // Imperial violet
        vec3 clearQuartz = vec3(0.85, 0.95, 1.0);   // Translucent crystal
        crystalCol = mix(deepAmethyst, clearQuartz, tipFactor) * u_amethyst_hue * 2.0;
    } else {
        // Dark rocky geode matrix with glittering quartz micro-crystals
        float sparkle = pow(hash3(floor(pos * 16.0)), 12.0) * 2.5;
        crystalCol = vec3(0.06, 0.05, 0.08) + vec3(0.9, 0.85, 1.0) * sparkle;
    }

    return dScene;
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 p = (vUv - 0.5) * 2.0;
    p.x *= u_resolution.x / u_resolution.y;

    // Expedition flight camera motion
    float zTravel = u_time * 3.0 * u_flight_speed * u_intensity;
    vec3 ro = vec3(sin(zTravel * 0.2) * 0.3, cos(zTravel * 0.25) * 0.3, zTravel);
    vec3 target = vec3(sin((zTravel + 5.0) * 0.2) * 0.3, cos((zTravel + 5.0) * 0.25) * 0.3, zTravel + 5.0);

    vec3 ww = normalize(target - ro);
    vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
    vec3 vv = cross(uu, ww);
    vec3 rd = normalize(p.x * uu + p.y * vv + 1.25 * ww);

    float t = 0.1;
    float maxDist = 32.0;
    vec3 accCaustic = vec3(0.0);
    float hit = 0.0;
    vec3 hitCol = vec3(0.0);

    for (int i = 0; i < 70; i++) {
        vec3 pos = ro + rd * t;
        vec3 cCol;
        float d = mapGeode(pos, cCol);

        // Volumetric crystal caustics
        float caustic = sin(pos.x * 6.0 + pos.y * 4.0) * sin(pos.z * 5.0 - u_time * 2.0);
        accCaustic += vec3(0.6, 0.3, 1.0) * max(0.0, caustic) * exp(-t * 0.09) * 0.035 * u_caustic_intensity;

        if (d < 0.005) {
            hit = 1.0;
            hitCol = cCol;
            break;
        }
        t += max(0.02, d * 0.7);
        if (t > maxDist) break;
    }

    vec3 col = vec3(0.015, 0.01, 0.03); // Deep geode core

    if (hit > 0.5) {
        col += hitCol;
    }

    col += accCaustic;

    // Floating Luminescent Dust Motes
    vec3 moteCoord = ro + rd * 4.0;
    float moteHash = hash3(floor(moteCoord * 6.0) + floor(u_time * 3.0));
    float isMote = step(0.96, moteHash) * (sin(u_time * 6.0 + moteHash * 30.0) * 0.5 + 0.5);
    col += vec3(0.8, 0.95, 1.0) * isMote * 1.8;

    // Amethyst depth fog
    float fog = 1.0 - exp(-t * 0.05);
    vec3 fogCol = vec3(0.08, 0.03, 0.14) + vec3(0.4, 0.1, 0.6) * 0.2;
    col = mix(col, fogCol, clamp(fog, 0.0, 1.0));

    // Blend scene texture into crystal facets
    vec3 sceneTex = texture(tDiffuse, vUv).rgb;
    col = mix(col, col + sceneTex * 0.22, 0.75);

    out_col = vec4(clamp(col, 0.0, 1.0), 1.0);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(vec2(UV.x, 1.0 - UV.y), col);
    COLOR = vec4(col.rgb, u_fade);
}
