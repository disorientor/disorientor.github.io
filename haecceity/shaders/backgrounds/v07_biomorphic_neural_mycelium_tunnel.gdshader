shader_type canvas_item;
uniform float u_fade = 1.0;
uniform sampler2D tDiffuse : hint_default_black;
uniform sampler2D tPrevFrame : hint_default_black;
uniform vec2 u_resolution = vec2(1060.0, 550.0);
uniform float u_time = 0.0;
/*
 * VORTEX REALMS - SHADER V07: BIOMORPHIC NEURAL MYCELIUM TUNNEL
 * -------------------------------------------------------------
 * Gliding through a bioluminescent alien neural cortex and fungal mycelium labyrinth.
 * Features:
 *   - Continuous forward flight through organic Gyroid minimal-surface cavern tubes
 *   - Synaptic electrical action-potential wave-packets racing forward along axonal walls
 *   - Cellular Worley membrane textures with pulsating biological respiration
 *   - Dual-tone bioluminescence: electric axon cyan and deep phosphorescent emerald
 *   - Atmospheric spore fog scattering light throughout the organic network
 */






uniform float u_intensity = 1.0;            // Neural excitation factor (default: 1.0)
uniform float u_flight_speed = 2.0;         // Gliding flight speed (0.5 to 5.0, default: 2.0)
uniform float u_synapse_pulse_speed = 5.0;  // Axon action potential velocity (1.0 to 10.0, default: 5.0)
uniform float u_gyroid_thickness = 0.35;     // Wall density threshold (0.1 to 1.0, default: 0.35)
uniform float u_bioluminescence = 1.8;      // Phosphorescent nerve glow (0.5 to 3.5, default: 1.8)
uniform float u_cellular_scale = 3.5;       // Membrane pore frequency (1.0 to 8.0, default: 3.5)



vec2 rot(vec2 p, float a) {
    float s = sin(a), c = cos(a);
    return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}

// 3D Cellular Worley noise for organic tissue
float hash3(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
}

float worley3D(vec3 p) {
    vec3 id = floor(p);
    vec3 fd = fract(p);
    float minDist = 1.0;
    for (int k = -1; k <= 1; k++) {
        for (int j = -1; j <= 1; j++) {
            for (int i = -1; i <= 1; i++) {
                vec3 g = vec3(float(i), float(j), float(k));
                vec3 o = vec3(hash3(id + g), hash3(id + g + vec3(1.3, 4.7, 9.1)), hash3(id + g + vec3(5.1, 2.3, 8.4)));
                vec3 r = g + o - fd;
                minDist = min(minDist, dot(r, r));
            }
        }
    }
    return sqrt(minDist);
}

// Organic Gyroid cave distance estimator
float mapNeural(vec3 pos, out vec3 bioGlow) {
    // Serpentine spine deformation
    vec3 p = pos;
    p.xy += vec2(sin(p.z * 0.3), cos(p.z * 0.25)) * 0.6;
    p.xy = rot(p.xy, p.z * 0.15);

    // Gyroid minimal surface equation: sin(x)*cos(y) + sin(y)*cos(z) + sin(z)*cos(x)
    vec3 gP = p * 1.2;
    float gyroid = sin(gP.x) * cos(gP.y) + sin(gP.y) * cos(gP.z) + sin(gP.z) * cos(gP.x);
    
    // Cellular membrane texture bump
    float cell = worley3D(p * u_cellular_scale);
    float dGyroid = abs(gyroid) - (u_gyroid_thickness + cell * 0.1);

    // Tunnel boundary cylinder (keeps camera within the central lumen)
    float dCyl = length(p.xy) - 2.2;
    float dScene = max(dGyroid, dCyl);

    // Synaptic Action Potentials: electric pulses travelling down the nerve walls
    float pulseDist = mod(p.z - u_time * u_synapse_pulse_speed * u_intensity, 8.0) - 4.0;
    float actionPotential = exp(-pulseDist * pulseDist * 2.0);

    // Bioluminescent emission colors
    vec3 axonCyan = vec3(0.0, 1.0, 0.85);
    vec3 nerveMagenta = vec3(0.9, 0.1, 0.8);
    vec3 bioEmerald = vec3(0.1, 1.0, 0.3);

    bioGlow = mix(bioEmerald, axonCyan, sin(p.z * 0.4) * 0.5 + 0.5);
    bioGlow += nerveMagenta * actionPotential * 4.0;
    bioGlow *= (1.0 - cell * 0.6) * u_bioluminescence;

    return dScene * 0.6; // Scale step for gyroid lips
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 p = (vUv - 0.5) * 2.0;
    p.x *= u_resolution.x / u_resolution.y;

    // Camera flight along the central axonal channel
    float zTravel = u_time * 3.2 * u_flight_speed * u_intensity;
    vec3 ro = vec3(sin(zTravel * 0.3) * 0.3, cos(zTravel * 0.25) * 0.3, zTravel);
    vec3 target = vec3(sin((zTravel + 4.0) * 0.3) * 0.3, cos((zTravel + 4.0) * 0.25) * 0.3, zTravel + 4.0);
    
    vec3 ww = normalize(target - ro);
    vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
    vec3 vv = cross(uu, ww);
    vec3 rd = normalize(p.x * uu + p.y * vv + 1.2 * ww);

    float t = 0.1;
    float maxDist = 30.0;
    vec3 accGlow = vec3(0.0);
    float hit = 0.0;
    vec3 hitCol = vec3(0.0);

    for (int i = 0; i < 70; i++) {
        vec3 pos = ro + rd * t;
        vec3 glow;
        float d = mapNeural(pos, glow);

        // Volumetric nerve glow accumulation
        accGlow += glow * exp(-abs(d) * 5.0) * exp(-t * 0.1) * 0.04;

        if (d < 0.005) {
            hit = 1.0;
            hitCol = glow;
            break;
        }
        t += max(0.02, d * 0.7);
        if (t > maxDist) break;
    }

    vec3 col = vec3(0.01, 0.02, 0.03); // Deep organic void

    if (hit > 0.5) {
        col += hitCol * 0.8 + vec3(0.08, 0.05, 0.12);
    }

    col += accGlow;

    // Pulsating biological respiration vignette
    float breath = sin(u_time * 2.0) * 0.08;
    float vig = smoothstep(1.5 + breath, 0.3, length(p));
    col *= vig;

    // Blend scene texture into synaptic glow
    vec3 sceneTex = texture(tDiffuse, vUv).rgb;
    col = mix(col, col + sceneTex * 0.2, 0.8);

    out_col = vec4(clamp(col, 0.0, 1.0), 1.0);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(vec2(UV.x, 1.0 - UV.y), col);
    COLOR = vec4(col.rgb, u_fade);
}
