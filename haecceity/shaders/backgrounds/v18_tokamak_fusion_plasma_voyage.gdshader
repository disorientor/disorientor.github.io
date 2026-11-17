shader_type canvas_item;
uniform float u_fade = 1.0;
uniform sampler2D tDiffuse : hint_default_black;
uniform sampler2D tPrevFrame : hint_default_black;
uniform vec2 u_resolution = vec2(1060.0, 550.0);
uniform float u_time = 0.0;
/*
 * VORTEX REALMS - SHADER V18: TOKAMAK FUSION STELLARATOR PLASMA VOYAGE
 * -------------------------------------------------------------------
 * Supersonic 3D magnetic confinement voyage inside the toroidal vacuum vessel
 * of a futuristic gigawatt nuclear fusion reactor.
 * Features:
 *   - Continuous 3D flight along the magnetic axis of the tokamak torus
 *   - Superconducting D-shaped magnetic field coils pulsing with relativistic currents
 *   - Twisting helical stellarator magnetic flux surfaces
 *   - Superheated deuterium-tritium plasma vortex with blackbody thermal grading
 *   - Cherenkov radiation bursts and electric cobalt magnetic reconnection sparks
 *   - Tungsten divertor heat-shield tiles and guaranteed flight clearance
 */

uniform float u_intensity = 1.0;           // Fusion reaction power boost (default: 1.0)
uniform float u_flight_speed = 2.4;        // Toroidal transit speed (0.5 to 5.0, default: 2.4)
uniform float u_plasma_temp = 1.8;         // Core thermonuclear temperature (0.5 to 3.5, default: 1.8)
uniform float u_magnetic_twist = 2.5;      // Helical field pitch q-factor (1.0 to 6.0, default: 2.5)
uniform float u_cherenkov_glow = 1.5;      // Electric cobalt radiation intensity (0.5 to 3.0, default: 1.5)

vec2 rot(vec2 p, float a) {
    float s = sin(a), c = cos(a);
    return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}

float hash3(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
}

float noise3D(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float n000 = hash3(i);
    float n100 = hash3(i + vec3(1.0, 0.0, 0.0));
    float n010 = hash3(i + vec3(0.0, 1.0, 0.0));
    float n110 = hash3(i + vec3(1.0, 1.0, 0.0));
    float n001 = hash3(i + vec3(0.0, 0.0, 1.0));
    float n101 = hash3(i + vec3(1.0, 0.0, 1.0));
    float n011 = hash3(i + vec3(0.0, 1.0, 1.0));
    float n111 = hash3(i + vec3(1.0, 1.0, 1.0));
    return mix(
        mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
        mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y),
        f.z
    );
}

// Distance estimator for Tokamak vacuum vessel & magnetic coils
float mapTokamak(vec3 p, out vec3 emitCol, out int matId) {
    emitCol = vec3(0.0);
    matId = 0; // 0 = vessel wall, 1 = coil, 2 = divertor
    float dScene = 1e5;

    // Toroidal coordinate transformation: Major radius R = 6.0
    float R = 6.0;
    float rMajor = length(p.xz);
    float phi = atan(p.z, p.x);
    vec2 poloidalCross = vec2(rMajor - R, p.y);
    float rMinor = length(poloidalCross);

    // 1. Vacuum Vessel Chamber Wall: Minor radius r = 2.4
    float dChamber = 2.4 - rMinor;
    if (dChamber < dScene) {
        dScene = dChamber;
        matId = 0;
        // Tungsten armor tiles on chamber walls
        float theta = atan(poloidalCross.y, poloidalCross.x);
        float tileGrid = step(0.08, fract(theta * 8.0)) * step(0.08, fract(phi * 24.0));
        emitCol = mix(vec3(0.08, 0.1, 0.14), vec3(0.02, 0.03, 0.05), tileGrid);
    }

    // 2. Superconducting Toroidal Magnetic Coils (repeating around torus at 16 sectors)
    float coilAngle = mod(phi + 3.14159 / 16.0, 3.14159 / 8.0) - 3.14159 / 16.0;
    float dCoilRib = length(vec2(abs(rMinor - 2.3), coilAngle * rMajor)) - 0.065;
    if (dCoilRib < dScene) {
        dScene = dCoilRib;
        matId = 1;
        // High-voltage blue magnetic containment glow
        emitCol = vec3(0.0, 0.85, 1.0) * 1.8 * u_cherenkov_glow;
    }

    // 3. Lower Divertor Target Plates (at bottom of poloidal cross-section, y ~ -1.9)
    if (poloidalCross.y < -1.6) {
        float dDivertor = length(vec2(poloidalCross.x, poloidalCross.y + 1.9)) - 0.2;
        if (dDivertor < dScene) {
            dScene = dDivertor;
            matId = 2;
            emitCol = vec3(1.0, 0.35, 0.05) * 2.8; // Incandescent plasma heat exhaust
        }
    }

    return dScene;
}

float vesselDistance(vec3 p) {
    vec3 emission;
    int material;
    return mapTokamak(p,emission,material);
}
vec3 vesselNormal(vec3 p) {
    vec2 e=vec2(.003,0.0);
    return normalize(vec3(vesselDistance(p+e.xyy)-vesselDistance(p-e.xyy),
                          vesselDistance(p+e.yxy)-vesselDistance(p-e.yxy),
                          vesselDistance(p+e.yyx)-vesselDistance(p-e.yyx)));
}
void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 uv = (vUv - 0.5) * 2.0;
    uv.x *= u_resolution.x / u_resolution.y;

    // Flight velocity along the toroidal magnetic axis (major radius R = 6.0)
    float R = 6.0;
    float phiCam = u_time * 0.45 * u_flight_speed * u_intensity;

    // Camera stays centered on the magnetic axis with gentle poloidal oscillation
    float poloidalPhase = phiCam * u_magnetic_twist;
    float rMinorCam = 0.35 * sin(poloidalPhase);
    float yCam = 0.35 * cos(poloidalPhase);
    float rMajorCam = R + rMinorCam;

    vec3 ro = vec3(cos(phiCam) * rMajorCam, yCam, sin(phiCam) * rMajorCam);
    
    // Look-ahead vector along the toroidal curve
    float phiTarget = phiCam + 0.18;
    float rMajorTarget = R + 0.35 * sin(phiTarget * u_magnetic_twist);
    float yTarget = 0.35 * cos(phiTarget * u_magnetic_twist);
    vec3 target = vec3(cos(phiTarget) * rMajorTarget, yTarget, sin(phiTarget) * rMajorTarget);

    vec3 fwd = normalize(target - ro);
    vec3 right = normalize(cross(fwd, vec3(0.0, 1.0, 0.0)));
    vec3 up = cross(right, fwd);
    
    // Bank with stellarator magnetic twist
    float bank = -sin(poloidalPhase) * 0.22;
    vec2 pRot = rot(uv, bank);
    vec3 rd = normalize(pRot.x * right + pRot.y * up + 1.25 * fwd);

    float t = 0.08;
    float maxDist = 38.0;
    vec3 accPlasma = vec3(0.0);
    float totalDensity = 0.0;
    float hit = 0.0;
    vec3 hitEmit = vec3(0.0);

    for (int i = 0; i < 70; i++) {
        vec3 pos = ro + rd * t;
        vec3 eCol;
        int mId;
        float d = mapTokamak(pos, eCol, mId);

        // Volumetric Thermonuclear Plasma Core Sampling
        float rMajorP = length(pos.xz);
        float phiP = atan(pos.z, pos.x);
        vec2 polP = vec2(rMajorP - R, pos.y);
        float rMinorP = length(polP);

        // Plasma vortex confined near rMinor ~ 0.8
        float dPlasmaCore = abs(rMinorP - 0.75);
        float helixPhase = atan(polP.y, polP.x) - phiP * u_magnetic_twist * 2.0 - u_time * 1.8;
        float helixCurrent = sin(helixPhase * 4.0);
        
        float turb = noise3D(pos * 2.0 - vec3(0.0, u_time * .8, 0.0));
        float plasmaDens = smoothstep(0.55, 0.0, dPlasmaCore + turb * 0.25);

        // Cherenkov blue radiation discharge arcs
        float cherenkovBurst = pow(sin(phiP * 16.0 + u_time * 10.0) * 0.5 + 0.5, 14.0);
        // Confine discharges to the plasma surface, leaving the vessel legible.
        float filament = pow(.5 + .5 * helixCurrent, 10.0);
        plasmaDens *= .28 + filament * .72;
        plasmaDens += cherenkovBurst * .22 * exp(-dPlasmaCore * 9.0);

        if (plasmaDens > 0.03) {
            // Temperature color gradient:
            // Edge: deep violet & cobalt Cherenkov blue
            // Core: incandescent thermonuclear gold & blinding white
            float temp = clamp(plasmaDens * u_plasma_temp * 0.75, 0.0, 1.4);
            vec3 pCol = mix(vec3(0.05, 0.5, 1.0) * 2.2, vec3(1.0, 0.85, 0.35) * 3.5, smoothstep(0.4, 0.9, temp));
            accPlasma += pCol * plasmaDens * (1.0 - totalDensity) * 0.055;
            totalDensity += plasmaDens * 0.035;
        }

        if (d < 0.005) {
            hit = 1.0;
            hitEmit = eCol;
            break;
        }

        t += max(0.025, min(d * 0.75, 0.3));
        if (t > maxDist || totalDensity > 0.95) break;
    }

    vec3 col = accPlasma;
    if (hit > 0.5) {
        // Vessel grid follows toroidal coordinates; grazing surfaces remain dark.
        vec3 pos = ro + rd * t;
        float phi = atan(pos.z,pos.x);
        float theta = atan(pos.y,length(pos.xz)-R);
        float seams = pow(.5+.5*cos(theta*32.0),24.0)+pow(.5+.5*cos(phi*96.0),24.0);
        vec3 surface = hitEmit;
        if(length(hitEmit)<.5) surface = vec3(.045,.065,.09) + vec3(.05,.11,.16)*seams;
        vec3 normal = vesselNormal(pos);
        float facing = max(0.0,dot(normal,normalize(ro-pos)));
        float rim = pow(1.0-facing,3.0);
        surface *= .18 + .72*facing;
        surface += vec3(.08,.2,.28)*rim;
        col += surface * (1.0 - totalDensity);
    }

    // Vanishing point thermonuclear core bloom
    float horizonGlow = exp(-length(pRot) * 2.5) * 0.24 * u_intensity;
    col += vec3(0.3, 0.85, 1.0) * horizonGlow;

    // Relativistic magnetic flux speed lines
    vec2 pGrid = fract(pRot * 12.0 + vec2(0.0, u_time * 20.0 * u_flight_speed)) - 0.5;
    float streak = smoothstep(0.06, 0.0, abs(pGrid.x)) * step(0.9, hash3(vec3(floor(pRot * 12.0), floor(u_time * 8.0))));
    col += vec3(0.2, 0.9, 1.0) * streak * 0.09 * u_intensity;

    // Blend with scene
    vec3 sceneTex = texture(tDiffuse, vUv).rgb;
    col = mix(col, col + sceneTex * 0.2, 0.85);

    // Exposure rolloff preserves hot filament detail instead of clipping to a white tunnel.
    col = vec3(1.0) - exp(-max(col,vec3(0.0)) * .85);
    col *= 1.0 - .24 * smoothstep(.4,1.8,length(uv));
    out_col = vec4(col, 1.0);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(vec2(UV.x, 1.0 - UV.y), col);
    COLOR = vec4(col.rgb, u_fade);
}
