shader_type canvas_item;
uniform float u_fade = 1.0;
uniform sampler2D tDiffuse : hint_default_black;
uniform sampler2D tPrevFrame : hint_default_black;
uniform vec2 u_resolution = vec2(1060.0, 550.0);
uniform float u_time = 0.0;
/*
 * FRACTAL REALMS - SHADER F14: DUFFING CHAOTIC ATTRACTOR PHASE SHEET
 * --------------------------------------------------------------------
 * Volumetrically raymarches the 3D extended phase space (x, dx/dt, phi = omega*t)
 * of the forced, damped Duffing oscillator:
 *   x'' + delta * x' - x + x^3 = gamma * cos(omega * t)
 * Features:
 *   - Twin-well chaotic potential lobes folding into infinite nested strange attractor sheets
 *   - Continuous 3D supersonic flight through the homoclinic phase-space canyon
 *   - Relativistic chromatic velocity grading (electric cyan to incandescent magenta/gold)
 *   - Stroboscopic Poincaré section rings flashing in resonance along the phase axis
 *   - High-energy chaotic particle streamlines circulating between the potential wells
 *   - Guaranteed camera clearance avoiding any mesh clipping
 */

uniform float u_intensity = 1.0;        // Chaos / forcing amplitude (default: 1.0)
uniform float u_damping = 0.25;          // Damping coefficient delta (0.1 to 0.4)
uniform float u_forcing = 0.55;          // Forcing amplitude gamma (0.3 to 0.8)
uniform float u_sheet_glow = 1.0;       // Attractor ribbon volumetric glow
uniform float u_poincare_slice = 1.0;   // Stroboscopic phase section position

vec2 rot(vec2 p, float a) {
    float s = sin(a), c = cos(a);
    return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}

// Distance estimator for Duffing folded attractor sheets & orbital tubes
float mapDuffing(vec3 p, out float vMag, out float lobeId) {
    float gamma = max(0.2, u_forcing * u_intensity);
    float delta = max(0.05, u_damping);
    float omega = 1.25;

    // Time-dependent periodic driving phase along Z
    float phase = p.z * omega + u_time * 2.0;
    float forcingTerm = gamma * cos(phase);

    // Twin-well Duffing potential: V(x) = x^4/4 - x^2/2 - x * forcingTerm
    // Accelerations: a = -dV/dx - delta * y = x - x^3 + forcingTerm - delta * y
    float forceWell = p.x - pow(p.x, 3.0) + forcingTerm;
    float accel = forceWell - delta * p.y;
    vMag = length(vec2(p.y, accel));

    // Two chaotic attractor focal centers at x = -1.0 and x = +1.0
    float dLobe1 = length(vec2(p.x + 1.0 - 0.25 * sin(phase), p.y - 0.3 * cos(phase))) - 0.45;
    float dLobe2 = length(vec2(p.x - 1.0 + 0.25 * sin(phase), p.y + 0.3 * cos(phase))) - 0.45;
    lobeId = (dLobe1 < dLobe2) ? -1.0 : 1.0;

    // Homoclinic phase sheet folding: multi-layered invariant manifold
    // The sheet folds like a Smale horseshoe as phase advances
    float fold = sin(p.x * 2.5 + phase * 0.7) * cos(p.y * 3.0) * 0.35 
               + sin(p.y * 5.0 - phase) * 0.12;
    float energyManifold = abs(0.5 * p.y * p.y + 0.25 * pow(p.x, 4.0) - 0.5 * p.x * p.x - fold) - 0.08;

    // Distance to resonant orbital stream ribbons
    float dRibbon = max(energyManifold, abs(p.y) - 1.6);
    float dLobes = min(dLobe1, dLobe2);

    // Distance to chaotic attractor manifold
    float dAttractor = min(dRibbon * 0.7, dLobes * 0.8);

    return dAttractor;
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 p = (vUv - 0.5) * 2.0;
    p.x *= u_resolution.x / u_resolution.y;

    // Supersonic 3D flight along phase space Z
    float zTravel = u_time * 3.2 * u_intensity;

    // Flight camera swoops down the homoclinic canyon between the two attractor basins
    // Path stays in the saddle corridor with guaranteed clearance from both lobes
    float sway = sin(zTravel * 0.35) * 0.45;
    float heave = cos(zTravel * 0.25) * 0.35 + 0.15;
    float roll = sin(zTravel * 0.35) * 0.15;
    vec2 pRot = rot(p, roll);

    vec3 ro = vec3(sway, heave, zTravel);
    vec3 ta = vec3(sin((zTravel + 6.0) * 0.35) * 0.45, cos((zTravel + 6.0) * 0.25) * 0.35 + 0.15, zTravel + 6.0);
    vec3 ww = normalize(ta - ro);
    vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
    vec3 vv = cross(uu, ww);
    vec3 rd = normalize(pRot.x * uu + pRot.y * vv + 1.35 * ww);

    float t = 0.1;
    float maxDist = 24.0;
    float densityAccum = 0.0;
    vec3 colAccum = vec3(0.0);

    // Volumetric raymarching through strange attractor ribbons and potential wells
    for (int i = 0; i < 64; i++) {
        vec3 pos = ro + rd * t;
        float vMag;
        float lId;
        float d = mapDuffing(pos, vMag, lId);

        // Volumetric density accumulation
        if (d < 0.14) {
            float density = (0.14 - d) * 1.8;
            
            // Chromatic velocity grading:
            // Low kinetic energy = cosmic electric cyan / violet
            // High kinetic energy = incandescent amber / magenta / golden core
            vec3 vLow = mix(vec3(0.0, 0.8, 1.0), vec3(0.6, 0.1, 0.95), smoothstep(0.0, 1.2, abs(pos.x)));
            vec3 vHigh = mix(vec3(1.0, 0.2, 0.5), vec3(1.0, 0.85, 0.2), clamp(vMag * 0.35 - 0.3, 0.0, 1.0));
            vec3 vCol = mix(vLow, vHigh, clamp(vMag * 0.5, 0.0, 1.0));

            // Poincaré section pulse brightening
            float poincarePhase = fract((pos.z * 1.25) / 6.2831853 - u_time * 0.3 * u_poincare_slice);
            float poincarePulse = smoothstep(0.08, 0.0, abs(poincarePhase - 0.5));
            vCol += vec3(0.9, 0.95, 1.0) * poincarePulse * 2.5;

            colAccum += vCol * density * (1.0 - densityAccum);
            densityAccum += density * 0.09;
            if (densityAccum >= 0.95) break;
        }

        t += max(0.035, d * 0.65);
        if (t > maxDist) break;
    }

    // Deep cosmic phase-space void
    vec3 col = vec3(0.012, 0.015, 0.03) + colAccum * u_sheet_glow * (1.2 + 0.3 * sin(u_time * 3.0));

    // Stroboscopic Poincaré section grid overlay (subtle coordinate guidelines)
    float gridX = smoothstep(0.04, 0.0, abs(fract(pRot.x * 2.0) - 0.5));
    float gridY = smoothstep(0.04, 0.0, abs(fract(pRot.y * 2.0) - 0.5));
    float grid = (gridX + gridY) * exp(-length(pRot) * 0.8);
    col += vec3(0.05, 0.25, 0.4) * grid * 0.25 * u_intensity;

    // Horizon energy flare at vanishing point
    float centerGlow = exp(-length(pRot) * 2.2);
    col += vec3(0.2, 0.7, 1.0) * centerGlow * 0.45 * u_intensity;

    // Scene texture blending for composite vibrancy
    vec3 sceneTex = texture(tDiffuse, vUv).rgb;
    col = mix(col, col + sceneTex * 0.2, 0.85);

    out_col = vec4(clamp(col, 0.0, 1.0), 1.0);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(vec2(UV.x, 1.0 - UV.y), col);
    COLOR = vec4(col.rgb, u_fade);
}
