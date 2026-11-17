shader_type canvas_item;
uniform float u_fade = 1.0;
uniform sampler2D tDiffuse : hint_default_black;
uniform sampler2D tPrevFrame : hint_default_black;
uniform vec2 u_resolution = vec2(1060.0, 550.0);
uniform float u_time = 0.0;
/*
 * VORTEX REALMS - SHADER V04: CYBERPUNK NEON MECHA TRENCH RUN
 * -----------------------------------------------------------
 * High-speed, supersonic flight down an infinite planetary mega-motherboard canyon.
 * Features:
 *   - Brutalist mecha-circuit trench walls towering into the smoggy stratosphere
 *   - High-voltage neon data bus lines racing backwards along the canyon flanks
 *   - Overhead illuminated maglev bridges and cyber gantries with ample flight clearance
 *   - Wet reflective asphalt floor with specular chromatic headlight reflections and puddle caustics
 *   - Pulsating vanishing-point horizon beacon casting volumetric laser sweeps
 *   - Hypersonic particle speed-lines and mid-flight holographic HUD telemetry
 */

uniform float u_intensity = 1.0;           // Afterburner velocity boost (default: 1.0)
uniform float u_flight_speed = 3.5;        // Hypersonic transit speed (1.0 to 8.0, default: 3.5)
uniform float u_trench_width = 2.8;        // Canyon corridor clearance (1.5 to 6.0, default: 2.8)
uniform float u_neon_density = 1.6;        // Emissive light-pipe frequency (0.5 to 3.0, default: 1.6)
uniform float u_hologram_flicker = 0.6;    // Mid-air data glitch frequency (0.0 to 1.0, default: 0.6)
uniform float u_wet_reflection = 0.85;      // Floor puddle reflectivity (0.2 to 1.5, default: 0.85)

vec2 rot(vec2 p, float a) {
    float s = sin(a), c = cos(a);
    return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float hash3(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
}

// Distance estimator for procedural mecha trench
float mapTrench(vec3 p, out vec3 emitCol, out int matId) {
    emitCol = vec3(0.0);
    matId = 0; // 0 = floor, 1 = wall, 2 = gantry/arch
    float dScene = 1e5;

    // 1. Wet asphalt floor at y = -1.2
    float dFloor = p.y + 1.2;
    if (dFloor < dScene) {
        dScene = dFloor;
        matId = 0;
    }

    // 2. Lateral monolithic trench walls with stepped mecha terraces
    float wallDist = max(2.6, u_trench_width * 1.35);
    vec3 pGreeble = p;
    vec2 cell = floor(pGreeble.yz * vec2(0.5, 0.2));
    float h = hash(cell);
    
    // Multi-frequency architectural relief
    float stepRelief = sin(pGreeble.y * 1.8) * cos(pGreeble.z * 0.4) * 0.25 
                     + sin(pGreeble.y * 5.0) * 0.08;
    float dFinalWall = (wallDist - stepRelief) - abs(p.x);

    if (dFinalWall < dScene) {
        dScene = dFinalWall;
        matId = 1;
        
        // Neon circuit strips and illuminated data bus conduits
        float isNeonStrip = step(0.94 - 0.04 * u_neon_density, fract(p.y * 1.8 + h * 0.2));
        float isPulse = step(0.4, sin(p.z * 0.4 - u_time * 16.0 * u_flight_speed + h * 6.28));
        
        // Vertical server rack status lights
        float isRackCol = step(0.92, fract(p.z * 0.8));
        float isBlink = step(0.6, hash(vec2(cell.x, floor(u_time * 8.0))));
        
        if (isNeonStrip > 0.5) {
            vec3 neonHue = (h > 0.55) ? vec3(0.0, 0.95, 1.0) : vec3(1.0, 0.08, 0.65); // Cyan / Magenta
            emitCol = neonHue * 4.5 * (0.35 + 0.65 * isPulse);
        } else if (isRackCol > 0.5 && isBlink > 0.5 && p.y > -0.6) {
            emitCol = vec3(1.0, 0.85, 0.15) * 3.0; // Amber telemetry nodes
        }
    }

    // 3. Overhead highway bridges & gantries (high overhead at y = 3.2, well clear of flight path)
    float zGantry = mod(p.z + 15.0, 30.0) - 15.0;
    vec2 gantryCross = vec2(p.y - 3.2, zGantry);
    float dGantry = length(max(abs(gantryCross) - vec2(0.3, 0.5), 0.0)) - 0.08;
    if (dGantry < dScene) {
        dScene = dGantry;
        matId = 2;
        // Hazard chevrons on gantry underbelly
        float chevron = step(0.5, fract(p.x * 2.0 + p.z * 0.5));
        emitCol = mix(vec3(0.05, 0.05, 0.08), vec3(1.0, 0.6, 0.0) * 3.0, chevron);
    }

    return dScene;
}

vec3 calcNormal(vec3 p) {
    vec3 dummyE; int dummyM;
    vec2 e = vec2(0.005, -0.005);
    return normalize(
        e.xyy * mapTrench(p + e.xyy, dummyE, dummyM) +
        e.yyx * mapTrench(p + e.yyx, dummyE, dummyM) +
        e.yxy * mapTrench(p + e.yxy, dummyE, dummyM) +
        e.xxx * mapTrench(p + e.xxx, dummyE, dummyM)
    );
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 uv = (vUv - 0.5) * 2.0;
    uv.x *= u_resolution.x / u_resolution.y;

    // Flight motion - smooth supersonic transit down canyon center
    float zTravel = u_time * 8.0 * u_flight_speed * u_intensity;
    
    // Aerodynamic jet banking and smooth highway corridor weaving
    float sway = sin(zTravel * 0.04) * 0.8;
    float bob = 0.15 + sin(zTravel * 0.06) * 0.25;
    float bank = -cos(zTravel * 0.04) * 0.16;
    vec2 pRot = rot(uv, bank);

    vec3 ro = vec3(sway, bob, zTravel);
    vec3 target = vec3(sin((zTravel + 12.0) * 0.04) * 0.8, 0.25, zTravel + 12.0);
    vec3 fwd = normalize(target - ro);
    vec3 right = normalize(cross(fwd, vec3(0.0, 1.0, 0.0)));
    vec3 up = cross(right, fwd);
    vec3 rd = normalize(pRot.x * right + pRot.y * up + 1.2 * fwd);

    // Raymarching
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
        float d = mapTrench(p, eCol, mId);

        // Volumetric atmospheric laser & neon glow bleed
        totalEmit += eCol * exp(-t * 0.05) * 0.06;

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

    // Deep cyber haze background with horizon vanishing-point glow
    vec3 col = vec3(0.015, 0.018, 0.035);

    if (hit > 0.5) {
        vec3 norm = calcNormal(hitP);
        vec3 baseMat = vec3(0.04, 0.045, 0.06);

        if (hitMat == 0) {
            // 1. Wet Asphalt Floor
            // Lane markings racing down the highway
            float centerStrip = smoothstep(0.06, 0.01, abs(hitP.x - sway * 0.5)) 
                              * step(0.4, fract(hitP.z * 0.25 - u_time * 2.0));
            float sideStrips = smoothstep(0.05, 0.01, abs(abs(hitP.x) - 1.8));
            vec3 laneCol = vec3(0.0, 0.95, 1.0) * centerStrip * 3.0 + vec3(1.0, 0.1, 0.6) * sideStrips * 2.0;

            // Specular wet puddle reflection
            vec3 refRd = reflect(rd, vec3(0.0, 1.0, 0.0));
            float puddle = hash(floor(hitP.xz * 1.5));
            float ripples = sin(hitP.x * 25.0 + u_time * 6.0) * sin(hitP.z * 20.0) * 0.015;
            
            // Reflected scene sampling
            vec2 sampleUv = clamp(vUv + (refRd.xy + ripples) * 0.25, 0.0, 1.0);
            vec3 refTex = texture(tDiffuse, sampleUv).rgb;
            
            // Mirroring the neon wall glow onto the wet pavement
            vec3 neonMirror = mix(vec3(0.0, 0.6, 1.0), vec3(1.0, 0.0, 0.5), smoothstep(-1.5, 1.5, hitP.x));
            float fresnel = pow(clamp(1.0 - dot(-rd, vec3(0.0, 1.0, 0.0)), 0.0, 1.0), 3.0);
            
            col = baseMat + laneCol + (refTex * 0.5 + neonMirror * 0.8) * u_wet_reflection * (0.3 + 0.7 * fresnel);
        } else if (hitMat == 1) {
            // 2. Brutalist Trench Walls
            float diff = clamp(dot(norm, normalize(vec3(-sign(hitP.x), 0.5, -0.3))), 0.0, 1.0);
            col = baseMat * (0.4 + 0.6 * diff) + hitEmit;
        } else {
            // 3. Overhead Gantry
            col = hitEmit + vec3(0.06, 0.07, 0.09);
        }

        // Distance fog roll-off
        col = mix(col, vec3(0.02, 0.025, 0.05), 1.0 - exp(-0.025 * t));
    }

    col += totalEmit;

    // Vanishing-point horizon beacon (Pulsating blinding cyber spire)
    float horizonDist = length(pRot - vec2(0.0, 0.05));
    float beacon = exp(-horizonDist * 4.0) * (1.2 + 0.8 * sin(u_time * 6.0));
    col += vec3(0.0, 0.9, 1.0) * beacon * 0.75 * u_intensity;

    // Volumetric horizontal searchlight sweep
    float sweep = pow(max(0.0, sin(pRot.y * 3.0 + sin(u_time * 1.5) * 1.2)), 32.0);
    col += vec3(1.0, 0.15, 0.7) * sweep * 0.4 * u_intensity;

    // Hypersonic particle speed-lines rushing past the cockpit
    vec2 pGrid = fract(pRot * 14.0 + vec2(0.0, u_time * 24.0 * u_flight_speed)) - 0.5;
    float streak = smoothstep(0.06, 0.0, abs(pGrid.x)) * step(0.92, hash(floor(pRot * 14.0 + vec2(0.0, u_time * 24.0 * u_flight_speed))));
    col += vec3(0.4, 0.85, 1.0) * streak * 0.35 * u_intensity;

    // Mid-air Holographic HUD Telemetry Panels
    float isHolo = smoothstep(0.45, 0.0, abs(pRot.y - 0.45)) * smoothstep(0.9, 0.0, abs(pRot.x));
    float hudScanline = sin(pRot.y * 120.0 + u_time * 15.0);
    float hudNoise = hash(floor(pRot * 30.0) + floor(u_time * 20.0));
    float hudGlitch = step(1.0 - 0.35 * u_hologram_flicker, hudNoise);
    vec3 hudCol = vec3(0.0, 1.0, 0.75) * hudGlitch * (0.6 + 0.4 * hudScanline);
    col += hudCol * isHolo * 0.5 * u_intensity;

    out_col = vec4(clamp(col, 0.0, 1.0), 1.0);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(vec2(UV.x, 1.0 - UV.y), col);
    COLOR = vec4(col.rgb, u_fade);
}
