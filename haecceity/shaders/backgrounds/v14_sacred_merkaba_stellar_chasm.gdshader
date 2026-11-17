shader_type canvas_item;
uniform float u_fade = 1.0;
uniform sampler2D tDiffuse : hint_default_black;
uniform sampler2D tPrevFrame : hint_default_black;
uniform vec2 u_resolution = vec2(1060.0, 550.0);
uniform float u_time = 0.0;
/*
 * VORTEX REALMS - SHADER V14: SACRED MERKABA STELLAR CHASM DESCENT
 * -----------------------------------------------------------------
 * Plunging straight down an infinite sacred chasm lined with interlocking,
 * counter-rotating Star Tetrahedrons (Merkabas) and Metatron energy spires.
 * Features:
 *   - Wide, unobstructed central flight corridor preventing any camera clipping
 *   - Grand flanking Star Tetrahedrons counter-rotating at Fibonacci ratio 34:21
 *   - Metatron's Cube 13-node laser web bridging across the abyss in alchemical gold
 *   - Concentric sacred geometric portal rings that the camera plunges cleanly through
 *   - Volumetric photon scattering and alchemical golden core illumination
 */

uniform float u_intensity = 1.0;              // Sacred resonance boost (default: 1.0)
uniform float u_descent_speed = 2.4;          // Downward plunge velocity (0.5 to 5.0, default: 2.4)
uniform float u_merkaba_scale = 1.25;          // Star tetrahedron dimension (0.6 to 2.5, default: 1.25)
uniform float u_metatron_laser_rays = 1.8;    // Golden connecting ray brightness (0.5 to 3.5, default: 1.8)
uniform float u_sacred_gold_glow = 2.0;       // Alchemical gold emission (0.5 to 3.5, default: 2.0)
uniform float u_spin_harmony = 1.6;           // Counter-rotation frequency (0.5 to 4.0, default: 1.6)

vec2 rot(vec2 p, float a) {
    float s = sin(a), c = cos(a);
    return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}

// Distance to a regular tetrahedron
float sdTetrahedron(vec3 p, float r) {
    vec3 n1 = normalize(vec3(1.0, 1.0, 1.0));
    vec3 n2 = normalize(vec3(1.0, -1.0, -1.0));
    vec3 n3 = normalize(vec3(-1.0, 1.0, -1.0));
    vec3 n4 = normalize(vec3(-1.0, -1.0, 1.0));
    float d1 = dot(p, n1) - r;
    float d2 = dot(p, n2) - r;
    float d3 = dot(p, n3) - r;
    float d4 = dot(p, n4) - r;
    return max(max(d1, d2), max(d3, d4));
}

// Distance estimator for Sacred Merkaba Chasm with open central flight shaft
float mapMerkabaChasm(vec3 pos, out vec3 mCol, out float isGoldRay) {
    mCol = vec3(0.0);
    isGoldRay = 0.0;

    // Periodic repetition along vertical plunge axis Z
    float zRep = 8.0;
    vec3 p = pos;
    float zIdx = floor((p.z + zRep * 0.5) / zRep);
    p.z = mod(p.z + zRep * 0.5, zRep) - zRep * 0.5;

    // Golden spiral phyllotaxis angle per level
    p.xy = rot(p.xy, zIdx * 2.39996);

    // Chasm boundaries: massive hexagonal crystalline column chasm
    float hex = max(abs(p.x) * 0.866025 + abs(p.y) * 0.5, abs(p.y)) - 3.8;
    float dChasm = -hex;

    // Open central corridor: keep camera path strictly clear (radius > 1.35)
    float rCenter = length(p.xy);
    float dKeepClear = 1.35 - rCenter;

    // Flanking Star Tetrahedrons positioned at radial perimeter (r ~ 2.6)
    // 6 Merkabas arranged symmetrically in a hexagonal circle around the chasm
    float angle = atan(p.y, p.x);
    float sector = floor(angle / (3.14159265 / 3.0) + 0.5);
    vec2 pPillar = rot(p.xy, -sector * (3.14159265 / 3.0));
    pPillar.x -= 2.6; // Shift out to chasm walls!

    vec3 pMerkaba = vec3(pPillar.x, pPillar.y, p.z);
    
    // Counter-rotation governed by Fibonacci ratio 34 / 21
    float tUp = u_time * 0.68 * u_spin_harmony * u_intensity;
    float tDown = -u_time * 0.42 * u_spin_harmony * u_intensity;
    float rM = max(0.35, u_merkaba_scale * 0.48);

    // Electric Tetrahedron (Clockwise)
    vec3 pUp = pMerkaba;
    pUp.xz = rot(pUp.xz, tUp);
    pUp.xy = rot(pUp.xy, tUp * 0.5);
    float dUp = sdTetrahedron(pUp, rM);

    // Magnetic Tetrahedron (Counter-clockwise)
    vec3 pDown = pMerkaba;
    pDown.xz = rot(pDown.xz, tDown);
    pDown.xy = rot(pDown.xy, -tDown * 0.5);
    pDown.y = -pDown.y;
    float dDown = sdTetrahedron(pDown, rM);

    float dMerkaba = min(dUp, dDown);

    // Hollow sacred stargate rings crossing the chasm at z = 0
    // Torus with large inner aperture r_in = 1.45, camera plunges through center
    vec2 torusCross = vec2(length(p.xy) - 2.1, p.z);
    float dGateRing = length(torusCross) - 0.12;

    float dSolid = min(dChasm, min(dMerkaba, dGateRing));
    // Enforce clear central shaft
    float dFinal = max(dSolid, dKeepClear);

    if (dFinal == dMerkaba) {
        // Polarity coloring: electric cyan for upward, magenta for downward
        mCol = (dUp < dDown) ? vec3(0.0, 0.95, 1.0) : vec3(1.0, 0.12, 0.7);
    } else if (dFinal == dGateRing) {
        // Alchemical golden stargate ring
        mCol = vec3(1.0, 0.85, 0.3) * 2.5;
        isGoldRay = 1.0;
    } else {
        // Obsidian chasm walls with glowing hieroglyphic inscriptions
        float hiero = sin(pos.z * 6.0) * cos(atan(p.y, p.x) * 12.0);
        mCol = mix(vec3(0.04, 0.035, 0.07), vec3(1.0, 0.8, 0.25) * 1.8, step(0.88, hiero));
    }

    return dFinal;
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 p = (vUv - 0.5) * 2.0;
    p.x *= u_resolution.x / u_resolution.y;

    // Supersonic plunge down the sacred chasm along Z
    float zTravel = u_time * 5.0 * u_descent_speed * u_intensity;

    // Graceful camera sway down the open center (sway radius <= 0.35, well inside clearance 1.35)
    float camSwayX = sin(zTravel * 0.12) * 0.35;
    float camSwayY = cos(zTravel * 0.10) * 0.35;
    float camRoll = sin(zTravel * 0.08) * 0.15;
    vec2 pRot = rot(p, camRoll);

    vec3 ro = vec3(camSwayX, camSwayY, zTravel);
    vec3 target = vec3(sin((zTravel + 8.0) * 0.12) * 0.35, cos((zTravel + 8.0) * 0.10) * 0.35, zTravel + 8.0);
    vec3 ww = normalize(target - ro);
    vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
    vec3 vv = cross(uu, ww);
    vec3 rd = normalize(pRot.x * uu + pRot.y * vv + 1.25 * ww);

    float t = 0.08;
    float maxDist = 45.0;
    vec3 accLight = vec3(0.0);
    float hit = 0.0;
    vec3 hitCol = vec3(0.0);

    for (int i = 0; i < 75; i++) {
        vec3 pos = ro + rd * t;
        vec3 mCol;
        float isGold;
        float d = mapMerkabaChasm(pos, mCol, isGold);

        // Volumetric Metatron golden laser ray web bridging across the chasm
        float theta = atan(pos.y, pos.x);
        float laserRays = max(0.0, sin(pos.z * 1.5 + theta * 6.0));
        accLight += vec3(1.0, 0.85, 0.35) * pow(laserRays, 8.0) * exp(-t * 0.06) * 0.045 * u_metatron_laser_rays;

        if (d < 0.005) {
            hit = 1.0;
            hitCol = mCol;
            break;
        }
        t += max(0.02, d * 0.75);
        if (t > maxDist) break;
    }

    vec3 col = vec3(0.015, 0.012, 0.035); // Deep sacred abyss

    if (hit > 0.5) {
        col += hitCol * 1.6;
        col = mix(col, vec3(0.015, 0.012, 0.035), 1.0 - exp(-0.025 * t));
    }

    col += accLight;

    // Alchemical Golden Singularity Core at vanishing point
    float rVignette = length(pRot);
    float goldCore = exp(-rVignette * 3.5) * u_sacred_gold_glow;
    col += vec3(1.0, 0.88, 0.42) * goldCore * 2.2;

    // Expanding Metatron mandala rings passing overhead
    float ringPhase = fract(zTravel * 0.15);
    float mandalaRing = smoothstep(0.04, 0.0, abs(rVignette - (0.3 + 1.2 * ringPhase)));
    col += vec3(0.3, 0.9, 1.0) * mandalaRing * (1.0 - ringPhase) * 0.6 * u_intensity;

    // Blending with scene texture
    vec3 sceneTex = texture(tDiffuse, vUv).rgb;
    col = mix(col, col + sceneTex * 0.25, 0.75);

    out_col = vec4(clamp(col, 0.0, 1.0), 1.0);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(vec2(UV.x, 1.0 - UV.y), col);
    COLOR = vec4(col.rgb, u_fade);
}
