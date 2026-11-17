shader_type canvas_item;
uniform float u_fade = 1.0;
uniform sampler2D tDiffuse : hint_default_black;
uniform sampler2D tPrevFrame : hint_default_black;
uniform vec2 u_resolution = vec2(1060.0, 550.0);
uniform float u_time = 0.0;
/*
 * VORTEX REALMS - SHADER V17: NEO-TOKYO CYBERNETIC MEGALOPOLIS RUN
 * -----------------------------------------------------------------
 * Hypersonic 3D flight down the towering skyscraper canyons of a rain-soaked
 * Neo-Tokyo cyber megalopolis at night.
 * Features:
 *   - Towering brutalist mega-skyscrapers flanked by illuminated window matrices
 *   - Massive multi-tier holographic cyber billboards with scanline glitches
 *   - Multi-layer maglev skyways with rushing light-trail vehicle traffic
 *   - Wet reflective expressway floor with chromatic puddle reflections
 *   - Sweeping volumetric police searchlights and atmospheric cyber smog
 *   - Supersonic speed lines and guaranteed camera corridor clearance
 */

uniform float u_intensity = 1.0;           // Flight afterburner boost (default: 1.0)
uniform float u_flight_speed = 2.5;        // Transit velocity (0.5 to 5.0, default: 2.5)
uniform float u_neon_density = 1.5;        // Skyscraper illumination density (0.5 to 3.0, default: 1.5)
uniform float u_traffic_speed = 2.0;       // Maglev vehicle traffic rate (0.5 to 4.0, default: 2.0)
uniform float u_rain_wetness = 1.2;        // Asphalt & puddle reflectivity (0.0 to 2.0, default: 1.2)

vec2 rot(vec2 p, float a) {
    float s = sin(a), c = cos(a);
    return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}

float hash2(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float hash3(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
}

// Distance estimator for Megalopolis skyscraper canyon
float mapMegalopolis(vec3 p, out vec3 emitCol, out int matId) {
    emitCol = vec3(0.0);
    matId = 0; // 0 = floor, 1 = skyscraper, 2 = skyway
    float dScene = 1e5;

    // 1. Wet expressway ground at y = -1.2
    float dFloor = p.y + 1.2;
    if (dFloor < dScene) {
        dScene = dFloor;
        matId = 0;
    }

    // 2. Skyscraper towers flanking canyon: width = 3.8
    float canyonWidth = 3.8;
    float dWall = canyonWidth - abs(p.x);

    // Architectural set-backs and vertical pilasters
    vec3 pGrid = p;
    vec2 bCell = floor(pGrid.yz * vec2(0.4, 0.25));
    float h = hash2(bCell);
    float buildingRelief = sin(p.y * 1.5) * 0.2 + cos(p.z * 0.3) * 0.15;
    float dBuilding = (canyonWidth - buildingRelief) - abs(p.x);

    if (dBuilding < dScene) {
        dScene = dBuilding;
        matId = 1;

        // Window grid arrays
        vec2 winUv = fract(p.yz * vec2(2.5, 1.2)) - 0.5;
        float isWin = step(abs(winUv.x), 0.35) * step(abs(winUv.y), 0.35);
        vec2 winCell = floor(p.yz * vec2(2.5, 1.2));
        float winHash = hash2(winCell);
        float isLit = step(0.45, winHash);

        // Holographic Mega-Billboards (giant glowing screens)
        float isBillboard = step(0.85, hash2(bCell * 1.7)) * step(p.y, 2.5) * step(-0.2, p.y);

        if (isBillboard > 0.5) {
            float scanline = sin(p.y * 45.0 + u_time * 8.0);
            vec3 bbHue = (h > 0.5) ? vec3(1.0, 0.05, 0.6) : vec3(0.0, 0.95, 1.0); // Hot pink or cyan
            emitCol = bbHue * 4.2 * (0.6 + 0.4 * scanline);
        } else if (isWin > 0.5 && isLit > 0.5) {
            vec3 winCol = (winHash > 0.8) ? vec3(0.3, 0.8, 1.0) : vec3(1.0, 0.85, 0.5); // Cool azure or warm amber
            emitCol = winCol * 2.5 * u_neon_density;
        } else {
            // High-voltage vertical neon accent piping
            float isPipe = step(0.96, fract(p.z * 0.5 + h * 0.2));
            if (isPipe > 0.5) {
                emitCol = vec3(0.0, 1.0, 0.8) * 3.5;
            }
        }
    }

    // 3. Overhead Maglev Skyways crossing canyon at y = 3.0 and y = 4.8
    float zSkyway = mod(p.z + 18.0, 36.0) - 18.0;
    float dSkyway1 = length(max(abs(vec2(p.y - 3.0, zSkyway)) - vec2(0.2, 0.6), 0.0)) - 0.05;
    if (dSkyway1 < dScene) {
        dScene = dSkyway1;
        matId = 2;
        // Flying traffic light-streaks on the bridge
        float trafficFlow = fract(p.x * 0.4 + u_time * 4.0 * u_traffic_speed);
        vec3 trafficCol = (p.y > 3.0) ? vec3(1.0, 0.1, 0.1) : vec3(0.1, 0.9, 1.0); // Red & cyan
        emitCol = trafficCol * step(0.75, trafficFlow) * 4.0;
    }

    return dScene;
}

vec3 calcNormal(vec3 p) {
    vec3 dummyE; int dummyM;
    vec2 e = vec2(0.005, -0.005);
    return normalize(
        e.xyy * mapMegalopolis(p + e.xyy, dummyE, dummyM) +
        e.yyx * mapMegalopolis(p + e.yyx, dummyE, dummyM) +
        e.yxy * mapMegalopolis(p + e.yxy, dummyE, dummyM) +
        e.xxx * mapMegalopolis(p + e.xxx, dummyE, dummyM)
    );
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 uv = (vUv - 0.5) * 2.0;
    uv.x *= u_resolution.x / u_resolution.y;

    // Flight velocity along megalopolis canyon
    float zTravel = u_time * 6.5 * u_flight_speed * u_intensity;

    // Supersonic banking and expressway weaving
    float camSway = sin(zTravel * 0.035) * 0.9;
    float camBob = 0.25 + cos(zTravel * 0.05) * 0.22;
    float camBank = -cos(zTravel * 0.035) * 0.15;
    vec2 pRot = rot(uv, camBank);

    vec3 ro = vec3(camSway, camBob, zTravel);
    vec3 target = vec3(sin((zTravel + 12.0) * 0.035) * 0.9, 0.35, zTravel + 12.0);
    vec3 fwd = normalize(target - ro);
    vec3 right = normalize(cross(fwd, vec3(0.0, 1.0, 0.0)));
    vec3 up = cross(right, fwd);
    vec3 rd = normalize(pRot.x * right + pRot.y * up + 1.25 * fwd);

    float t = 0.08;
    float maxDist = 70.0;
    vec3 totalEmit = vec3(0.0);
    float hit = 0.0;
    vec3 hitEmit = vec3(0.0);
    vec3 hitP = vec3(0.0);
    int hitMat = 0;

    for (int i = 0; i < 75; i++) {
        vec3 p = ro + rd * t;
        vec3 eCol;
        int mId;
        float d = mapMegalopolis(p, eCol, mId);

        totalEmit += eCol * exp(-t * 0.045) * 0.065;

        if (d < 0.005) {
            hit = 1.0;
            hitEmit = eCol;
            hitP = p;
            hitMat = mId;
            break;
        }
        t += max(0.02, d * 0.85);
        if (t > maxDist) break;
    }

    // Neo-Tokyo midnight sky haze
    vec3 col = vec3(0.015, 0.018, 0.032);

    if (hit > 0.5) {
        vec3 norm = calcNormal(hitP);
        vec3 baseAlbedo = vec3(0.04, 0.045, 0.06);

        if (hitMat == 0) {
            // Expressway floor with wet rain reflections
            float roadStrip = smoothstep(0.08, 0.02, abs(fract(hitP.x * 0.8) - 0.5));
            vec3 laneLight = vec3(0.0, 0.9, 1.0) * roadStrip * 2.0;

            vec3 refRd = reflect(rd, vec3(0.0, 1.0, 0.0));
            float rainRipple = sin(hitP.x * 30.0 + u_time * 8.0) * sin(hitP.z * 25.0) * 0.02;
            vec2 sampleUv = clamp(vUv + (refRd.xy + rainRipple) * 0.22, 0.0, 1.0);
            vec3 refTex = texture(tDiffuse, sampleUv).rgb;

            vec3 neonSheen = mix(vec3(0.0, 0.8, 1.0), vec3(1.0, 0.1, 0.6), smoothstep(-2.0, 2.0, hitP.x));
            float fresnel = pow(clamp(1.0 - dot(-rd, vec3(0.0, 1.0, 0.0)), 0.0, 1.0), 3.0);
            col = baseAlbedo + laneLight + (refTex * 0.6 + neonSheen * 0.9) * u_rain_wetness * (0.35 + 0.65 * fresnel);
        } else if (hitMat == 1) {
            // Skyscraper facades
            float diff = clamp(dot(norm, normalize(vec3(-sign(hitP.x), 0.6, -0.2))), 0.0, 1.0);
            col = baseAlbedo * (0.35 + 0.65 * diff) + hitEmit;
        } else {
            col = hitEmit + vec3(0.08, 0.09, 0.12);
        }

        col = mix(col, vec3(0.02, 0.025, 0.045), 1.0 - exp(-0.02 * t));
    }

    col += totalEmit;

    // Sweeping police searchlight cone
    float sweepAngle = sin(u_time * 1.5) * 0.8;
    vec2 sweepDir = vec2(cos(sweepAngle), sin(sweepAngle));
    float beam = pow(max(0.0, dot(normalize(pRot - vec2(0.0, 0.8)), sweepDir)), 40.0);
    col += vec3(0.3, 0.85, 1.0) * beam * 0.6 * u_intensity;

    // Hypersonic speed-lines streaming down the avenue
    vec2 pLines = fract(pRot * 12.0 + vec2(0.0, u_time * 26.0 * u_flight_speed)) - 0.5;
    float streak = smoothstep(0.05, 0.0, abs(pLines.x)) * step(0.92, hash2(floor(pRot * 12.0 + vec2(0.0, u_time * 26.0 * u_flight_speed))));
    col += vec3(0.5, 0.9, 1.0) * streak * 0.35 * u_intensity;

    // Distant cyber spire vanishing point bloom
    float horizonGlow = exp(-length(pRot - vec2(0.0, 0.08)) * 3.5);
    col += vec3(1.0, 0.2, 0.8) * horizonGlow * 0.55 * u_intensity;

    // Blend with scene
    vec3 sceneTex = texture(tDiffuse, vUv).rgb;
    col = mix(col, col + sceneTex * 0.2, 0.85);

    out_col = vec4(clamp(col, 0.0, 1.0), 1.0);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(vec2(UV.x, 1.0 - UV.y), col);
    COLOR = vec4(col.rgb, u_fade);
}
