shader_type canvas_item;
uniform float u_fade = 1.0;
uniform sampler2D tDiffuse : hint_default_black;
uniform sampler2D tPrevFrame : hint_default_black;
uniform vec2 u_resolution = vec2(1060.0, 550.0);
uniform float u_time = 0.0;
/*
 * VORTEX REALMS - SHADER V12: SOLAR CORONA THERMONUCLEAR PROMINENCE VOYAGE
 * ------------------------------------------------------------------------
 * A high-speed, blinding voyage through the magnetic flux ropes and blistering
 * thermonuclear prominences of the solar corona.
 * Features:
 *   - Grand magnetic prominence arches vaulting high over the flight path with ample clearance
 *   - Helical magnetic flux ropes twisting with high-velocity plasma currents
 *   - Convective solar granulation cells boiling across the photosphere below
 *   - Magnetic field line reconnection flares flashing across the field of view
 *   - Hypersonic solar wind streamers and volumetric coronal glow
 *   - Thermonuclear blackbody radiation gradient (infrared ember to incandescent white-gold)
 */

uniform float u_intensity = 1.0;             // Thermonuclear flare boost (default: 1.0)
uniform float u_flight_speed = 2.2;          // Coronal flight velocity (0.5 to 5.0, default: 2.2)
uniform float u_plasma_heat = 1.6;           // Blackbody thermal intensity (0.5 to 3.0, default: 1.6)
uniform float u_magnetic_loops = 3.5;        // Magnetic flux rope density (1.0 to 8.0, default: 3.5)
uniform float u_granulation_scale = 6.0;     // Photosphere convective cell scale (2.0 to 12.0, default: 6.0)
uniform float u_solar_flare_pulse = 1.2;     // Solar flare discharge frequency (0.2 to 2.5, default: 1.2)

vec2 rot(vec2 p, float a) {
    float s = sin(a), c = cos(a);
    return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}

float hash3(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
}

// 3D smooth procedural noise for plasma turbulence
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

// Thermonuclear Blackbody Radiation Gradient (Temperature T)
vec3 blackbody(float t) {
    vec3 col = vec3(0.0);
    col.r = smoothstep(0.02, 0.55, t);
    col.g = smoothstep(0.28, 0.82, t) * 0.95;
    col.b = smoothstep(0.65, 0.98, t) * 1.6;
    return col;
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 p = (vUv - 0.5) * 2.0;
    p.x *= u_resolution.x / u_resolution.y;

    // Flight through solar corona along Z
    float zTravel = u_time * 4.2 * u_flight_speed * u_intensity;
    
    // Smooth flight path gliding above the photosphere with guaranteed arch clearance
    float camSway = sin(zTravel * 0.12) * 0.45;
    float camBob = 0.45 + cos(zTravel * 0.16) * 0.2;
    float camRoll = sin(zTravel * 0.12) * 0.12;
    vec2 pRot = rot(p, camRoll);

    vec3 ro = vec3(camSway, camBob, zTravel);
    vec3 target = vec3(sin((zTravel + 8.0) * 0.12) * 0.45, 0.45, zTravel + 8.0);
    vec3 ww = normalize(target - ro);
    vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
    vec3 vv = cross(uu, ww);
    vec3 rd = normalize(pRot.x * uu + pRot.y * vv + 1.25 * ww);

    // Volumetric plasma raymarch accumulation
    float t = 0.1;
    float maxDist = 32.0;
    vec3 accPlasma = vec3(0.0);
    float totalDensity = 0.0;

    for (int i = 0; i < 54; i++) {
        vec3 pos = ro + rd * t;

        // Grand Coronal Prominence Arches:
        // Spaced every 14 units along Z, bridging across from x = -2.8 to x = +2.8
        // Arch apex is high at y = 2.4 to 3.2, soaring far above flight path at y ~ 0.45!
        float zPeriod = 14.0;
        vec3 pArch = pos;
        pArch.z = mod(pArch.z + zPeriod * 0.5, zPeriod) - zPeriod * 0.5;

        // Semicircular arch curve in the XY plane: center at (0, -0.6), radius = 2.8
        float rXY = length(vec2(pArch.x, pArch.y + 0.6));
        float dArchCore = length(vec2(rXY - 2.8, pArch.z)) - 0.28;

        // Helical magnetic flux rope twisting along the arch
        float archAngle = atan(pArch.y + 0.6, pArch.x);
        float helix = sin(archAngle * 12.0 + atan(pArch.z, rXY - 2.8) * 4.0 - u_time * 8.0);
        
        // Plasma turbulence
        float turb = noise3D(pos * 1.4 - vec3(0.0, 0.0, u_time * 4.0));
        float dArch = dArchCore - helix * 0.08 + turb * 0.18;

        // Flanking smaller flux ropes (density controlled by u_magnetic_loops)
        float sideLoops = sin(pos.x * 0.8 + pos.z * 0.3) * sin(pos.y * 1.2);
        float dSide = abs(sideLoops) - (0.05 * u_magnetic_loops);

        // Keep central corridor completely clear of dense plasma
        float rCorridor = length(vec2(pos.x - camSway, pos.y - camBob));
        float corridorClearance = smoothstep(0.4, 0.9, rCorridor);

        // Solar flare reconnection burst at the arch apex
        float isApex = smoothstep(1.8, 2.8, pos.y);
        float flare = pow(sin(pos.z * 0.35 - u_time * 8.0 * u_solar_flare_pulse) * 0.5 + 0.5, 12.0) * isApex;

        // Calculate volumetric plasma density
        float plasmaDensity = smoothstep(0.45, 0.0, dArch) * corridorClearance;
        plasmaDensity += flare * 1.5 * exp(-t * 0.08);

        if (plasmaDensity > 0.02) {
            float temp = clamp(plasmaDensity * u_plasma_heat * 0.85, 0.0, 1.4);
            vec3 thermCol = blackbody(temp) * 3.2;
            accPlasma += thermCol * plasmaDensity * (1.0 - totalDensity) * 0.14;
            totalDensity += plasmaDensity * 0.075;
        }

        t += max(0.06, 0.42 * (1.0 - totalDensity * 0.45));
        if (t > maxDist || totalDensity > 0.95) break;
    }

    // Photosphere surface below (y < -1.1)
    vec3 col = accPlasma;
    if (rd.y < 0.0) {
        float tFloor = (-1.1 - ro.y) / rd.y;
        if (tFloor > 0.0 && tFloor < maxDist) {
            vec3 floorPos = ro + rd * tFloor;
            // Convective Granulation cells (1000km boiling solar convection cells)
            vec2 granUv = floorPos.xz * (u_granulation_scale * 0.6) + vec2(0.0, u_time * 0.3);
            float gran1 = noise3D(vec3(granUv, u_time * 0.4));
            float gran2 = noise3D(vec3(granUv * 2.5, u_time * 0.6));
            float gran = gran1 * 0.7 + gran2 * 0.3;
            
            // Bright convection centers with darker intergranular lanes
            float granCell = smoothstep(0.35, 0.75, gran);
            vec3 sunSurface = mix(vec3(0.95, 0.28, 0.02), vec3(1.0, 0.92, 0.45), granCell) * 2.6;

            // Occasional dark sunspot magnetic dipoles
            float spotDist = length(fract(floorPos.xz * 0.08) - 0.5);
            float sunspot = smoothstep(0.08, 0.22, spotDist);
            sunSurface = mix(vec3(0.12, 0.03, 0.01), sunSurface, sunspot);

            float floorFog = exp(-tFloor * 0.05);
            col = mix(col, sunSurface, floorFog * (1.0 - totalDensity));
        }
    }

    // Blinding thermonuclear corona radiance
    float coronaGlow = exp(-length(pRot) * 1.6) * 0.85 * u_intensity;
    col += vec3(1.0, 0.75, 0.25) * coronaGlow;

    // Hypersonic solar wind streamer streaks
    vec2 pStreamer = fract(pRot * 10.0 + vec2(0.0, u_time * 18.0 * u_flight_speed)) - 0.5;
    float streamer = smoothstep(0.06, 0.0, abs(pStreamer.x)) * step(0.9, hash3(vec3(floor(pRot * 10.0), floor(u_time * 10.0))));
    col += vec3(1.0, 0.9, 0.6) * streamer * 0.4 * u_intensity;

    // Blend with scene texture
    vec3 sceneTex = texture(tDiffuse, vUv).rgb;
    col = mix(col, col + sceneTex * 0.2, 0.85);

    out_col = vec4(clamp(col, 0.0, 1.0), 1.0);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(vec2(UV.x, 1.0 - UV.y), col);
    COLOR = vec4(col.rgb, u_fade);
}
