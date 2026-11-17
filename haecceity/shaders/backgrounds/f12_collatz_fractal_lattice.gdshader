shader_type canvas_item;
uniform float u_fade = 1.0;
uniform sampler2D tDiffuse : hint_default_black;
uniform sampler2D tPrevFrame : hint_default_black;
uniform vec2 u_resolution = vec2(1060.0, 550.0);
uniform float u_time = 0.0;
/*
 * FRACTAL REALMS - SHADER F12: COLLATZ CONJECTURE COMPLEX FRACTAL LATTICE
 * --------------------------------------------------------------------------
 * Visualizes the analytic continuation of the famous 3n + 1 Collatz function
 * into the complex plane:
 *   f(z) = (1/4) * (1 + 4*z - (1 + 2*z) * cos(pi * z))
 * Reimagined as a continuous 3D supersonic voyage through the infinite Collatz
 * cosmic dendritic lattice:
 *   - 3D raymarched fractal tree conduits and convergence whirlpools
 *   - Supersonic camera transit with guaranteed corridor clearance
 *   - Glowing energy pulses cascading along number-theory branch conduits
 *   - Rich multi-spectral color grading (electric cobalt, neon violet, radiant gold)
 */

uniform float u_intensity = 1.0;        // Morph factor (default: 1.0)
uniform float u_zoom = 10.25;             // Complex plane magnification (0.5 to 20.0)
uniform float u_center_x = 0.0;         // Complex plane center X (default: 0.0)
uniform float u_center_y = 0.0;         // Complex plane center Y (default: 0.0)
uniform float u_tendril_glow = 1.0;     // Brightness of branching dendritic tendrils
uniform float u_phase_speed = 1.0;      // Phase rotation velocity

vec2 rot(vec2 p, float a) {
    float s = sin(a), c = cos(a);
    return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}

// Complex cosine
vec2 cCos(vec2 z) {
    float x = z.x;
    float y = clamp(z.y, -8.0, 8.0);
    float coshY = 0.5 * (exp(y) + exp(-y));
    float sinhY = 0.5 * (exp(y) - exp(-y));
    return vec2(cos(x) * coshY, -sin(x) * sinhY);
}

// Complex multiplication
vec2 cMul(vec2 a, vec2 b) {
    return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
}

// Collatz holomorphic step
vec2 collatzMap(vec2 z) {
    float pi = 3.14159265;
    vec2 clampedZ = clamp(z, -15.0, 15.0);
    vec2 piZ = clampedZ * pi;
    vec2 cosPiZ = cCos(piZ);
    vec2 onePlus2z = vec2(1.0 + 2.0 * clampedZ.x, 2.0 * clampedZ.y);
    vec2 term = cMul(onePlus2z, cosPiZ);
    vec2 num = vec2(1.0 + 4.0 * clampedZ.x, 4.0 * clampedZ.y) - term;
    return num * 0.25;
}

// Distance estimator for 3D Collatz crystal lattice network
float mapCollatz3D(vec3 p, out vec3 branchCol, out float pulseVal) {
    branchCol = vec3(0.0);
    pulseVal = 0.0;

    // Twist along Z transit axis
    float twist = p.z * 0.35 + u_time * 0.4 * u_phase_speed;
    vec2 p2 = rot(p.xy, twist);

    // Keep camera corridor open: smooth cylindrical tunnel at center
    float r = length(p2);
    float dTunnel = max(0.55 - r, 0.0);

    // Complex plane mapping modulated by scale and center
    float scale = max(0.8, u_zoom * 0.18);
    vec2 cCenter = vec2(u_center_x, u_center_y) * 0.5;
    vec2 z = cCenter + p2 * scale;

    // Iterate Collatz holomorphic dynamics
    vec2 zIter = z;
    float iter = 0.0;
    float minMod = 1e5;
    const int STEPS = 8;
    for (int i = 0; i < STEPS; i++) {
        zIter = collatzMap(zIter);
        float m = dot(zIter, zIter);
        minMod = min(minMod, m);
        if (m > 36.0) {
            iter = float(i);
            break;
        }
        iter = float(i);
    }

    // Branching lattice arms radiating outwards
    float armAngle = atan(p2.y, p2.x);
    float armCount = 6.0;
    float armSymmetry = abs(sin(armAngle * armCount * 0.5 + p.z * 0.8));
    
    // Distance to radial lattice tendrils
    float dLatticeArm = (r - 0.45) - 0.12 * armSymmetry * (1.0 + 0.3 * sin(p.z * 3.0));
    float dTendril = max(dLatticeArm, -dTunnel);

    // Fractal ripple contour from complex Collatz dynamics
    float fractalRelief = sin(minMod * 2.5 - u_time * 3.0) * 0.06;
    float dFinal = dTendril + fractalRelief;

    // Energy pulse travelling along the Collatz tendrils towards the 4-2-1 attractor
    float pulsePhase = fract(p.z * 0.4 - u_time * 2.5 * u_intensity);
    pulseVal = smoothstep(0.12, 0.0, abs(pulsePhase - 0.5)) * step(0.6, armSymmetry);

    // Chromatic coloring:
    // Cyan/cobalt exterior branches, magenta convergence nodes, golden core pulses
    float tColor = iter / float(STEPS);
    vec3 cCobalt = vec3(0.05, 0.4, 0.95);
    vec3 cMagenta = vec3(0.85, 0.1, 0.7);
    vec3 cGold = vec3(1.0, 0.85, 0.25);
    
    branchCol = mix(cCobalt, cMagenta, tColor);
    branchCol = mix(branchCol, cGold, pulseVal * 0.85);

    return max(dFinal, 0.015);
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 p = (vUv - 0.5) * 2.0;
    p.x *= u_resolution.x / u_resolution.y;

    // 3D hypersonic flight through the Collatz lattice
    float zTravel = u_time * 3.0 * u_phase_speed * u_intensity;

    // Smooth banking camera that weaves gracefully through the fractal corridor
    float camSway = sin(zTravel * 0.3) * 0.25;
    float camBob = cos(zTravel * 0.25) * 0.25;
    float camRoll = sin(zTravel * 0.2) * 0.12;
    vec2 pRot = rot(p, camRoll);

    vec3 ro = vec3(camSway, camBob, zTravel);
    vec3 ta = vec3(sin((zTravel + 6.0) * 0.3) * 0.25, cos((zTravel + 6.0) * 0.25) * 0.25, zTravel + 6.0);
    vec3 ww = normalize(ta - ro);
    vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
    vec3 vv = cross(uu, ww);
    vec3 rd = normalize(pRot.x * uu + pRot.y * vv + 1.25 * ww);

    float t = 0.08;
    float maxDist = 28.0;
    float densityAccum = 0.0;
    vec3 colAccum = vec3(0.0);

    for (int i = 0; i < 64; i++) {
        vec3 pos = ro + rd * t;
        vec3 bCol;
        float pulse;
        float d = mapCollatz3D(pos, bCol, pulse);

        if (d < 0.12) {
            float density = (0.12 - d) * 2.2;
            vec3 emit = bCol * (1.2 + 2.0 * pulse);
            colAccum += emit * density * (1.0 - densityAccum);
            densityAccum += density * 0.08;
            if (densityAccum >= 0.95) break;
        }

        t += max(0.03, d * 0.65);
        if (t > maxDist) break;
    }

    // Deep cosmic fractal void
    vec3 col = vec3(0.012, 0.015, 0.03) + colAccum * u_tendril_glow * u_intensity;

    // 4-2-1 Attractor singularity core glow at the horizon
    float rVignette = length(pRot);
    float horizonGlow = exp(-rVignette * 3.0) * 0.7;
    vec3 coreCol = vec3(0.2, 0.9, 1.0) * horizonGlow * u_intensity;
    col += coreCol;

    // Dynamic dendritic diffraction rays
    float rays = sin(atan(pRot.y, pRot.x) * 12.0 + zTravel * 1.5) * 0.5 + 0.5;
    col += vec3(0.4, 0.2, 0.8) * pow(rays, 6.0) * exp(-rVignette * 1.5) * 0.35 * u_intensity;

    // Scene texture blending for integrated contrast
    vec3 sceneTex = texture(tDiffuse, vUv).rgb;
    col = mix(col, col + sceneTex * 0.2, 0.85);

    out_col = vec4(clamp(col, 0.0, 1.0), 1.0);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(vec2(UV.x, 1.0 - UV.y), col);
    COLOR = vec4(col.rgb, u_fade);
}
