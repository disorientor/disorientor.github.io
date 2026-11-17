shader_type canvas_item;
uniform float u_fade = 1.0;
uniform sampler2D tDiffuse : hint_default_black;
uniform sampler2D tPrevFrame : hint_default_black;
uniform vec2 u_resolution = vec2(1060.0, 550.0);
uniform float u_time = 0.0;
/*
 * VORTEX REALMS - SHADER V20: CHRONOS TEMPORAL SINGULARITY WORMHOLE
 * -----------------------------------------------------------------
 * Relativistic 3D plunge down an Einstein-Rosen spacetime bridge into the
 * Chronos temporal continuum.
 * Features:
 *   - Continuous 3D transit through the Morris-Thorne hyperbolic wormhole throat
 *   - Relativistic causality ripples and gravitational time dilation wave fronts
 *   - Swirling temporal accretion flux filaments with spectral chromatic cycling
 *   - Blinding white-hole exit singularity illuminating the forward horizon
 *   - Hyperspace coordinate grid distortions and guaranteed flight clearance
 */

uniform float u_intensity = 1.0;           // Hyperspace warp factor (default: 1.0)
uniform float u_plunge_speed = 3.0;        // Temporal transit velocity (0.5 to 6.0, default: 3.0)
uniform float u_throat_radius = 2.0;       // Wormhole minimum aperture (1.0 to 4.0, default: 2.0)
uniform float u_causality_ripples = 1.8;   // Temporal dilation wave frequency (0.5 to 3.5, default: 1.8)
uniform float u_spectral_shift = 1.5;      // Relativistic Doppler chromatic rate (0.5 to 3.0, default: 1.5)

vec2 rot(vec2 p, float a) {
    float s = sin(a), c = cos(a);
    return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}

float hash3(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
}

// Distance estimator for Einstein-Rosen temporal wormhole
float mapWormhole(vec3 p, out vec3 emitCol) {
    emitCol = vec3(0.0);

    // Wormhole throat profile: r(z) = r0 * (1.0 + 0.08 * z_local^2)
    float zRepeat = 24.0;
    float zLocal = mod(p.z + zRepeat * 0.5, zRepeat) - zRepeat * 0.5;
    float r0 = max(1.5, u_throat_radius);
    float throatR = r0 + 0.06 * zLocal * zLocal;

    // Twist along spacetime geodesics
    float twist = p.z * 0.4 + u_time * 1.2;
    vec2 pRot = rot(p.xy, twist);

    float r = length(pRot);
    float theta = atan(pRot.y, pRot.x);

    // Distance to wormhole throat wall from inside: throatR - r
    float dThroat = throatR - r;

    // Temporal causality ripples & accretion streamlines along the throat wall
    float ripple = sin(p.z * 1.5 - u_time * 8.0 * u_causality_ripples) * 0.12;
    float stream = sin(theta * 8.0 + p.z * 0.8 - u_time * 4.0);

    float dFinalWall = dThroat - ripple;

    // Guaranteed clearance: keep flight path clear (r < 0.6)
    float dCorridor = 0.6 - r;
    float dScene = max(dFinalWall, dCorridor);

    // Emissive relativistic flux lines
    float isStreamLine = step(0.7, stream);
    float isRing = step(0.9, sin(p.z * 3.0 - u_time * 6.0));

    // Relativistic spectral cycling
    float colorPhase = p.z * 0.12 * u_spectral_shift - u_time * 0.5;
    vec3 colA = 0.5 + 0.5 * cos(colorPhase + vec3(0.0, 2.0, 4.0));
    vec3 colB = vec3(0.0, 0.95, 1.0); // Electric cyan

    if (isStreamLine > 0.5) {
        emitCol = mix(colA, colB, 0.5) * 3.8;
    } else if (isRing > 0.5) {
        emitCol = vec3(1.0, 0.88, 0.35) * 4.2; // Golden temporal barrier rings
    } else {
        // Deep indigo/void spacetime metric grid
        float grid = step(0.94, fract(p.z * 0.5)) + step(0.94, fract(theta * (12.0 / 6.2831853)));
        emitCol = vec3(0.1, 0.4, 0.8) * grid * 1.2;
    }

    return dScene;
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 uv = (vUv - 0.5) * 2.0;
    uv.x *= u_resolution.x / u_resolution.y;

    // Relativistic optical aberration (Lorentz contraction towards forward cone)
    float rUv = length(uv);
    float beta = 0.45; // Relativistic velocity fraction
    uv = normalize(uv + 1e-5) * pow(rUv, 1.0 / (1.0 + beta));

    // Plunge velocity along temporal throat Z
    float zTravel = u_time * 6.5 * u_plunge_speed * u_intensity;

    // Corkscrew flight path down the wormhole center
    float camSway = sin(zTravel * 0.15) * 0.32;
    float camBob = cos(zTravel * 0.15) * 0.32;
    float camRoll = sin(zTravel * 0.12) * 0.22;
    vec2 pRot = rot(uv, camRoll);

    vec3 ro = vec3(camSway, camBob, zTravel);
    vec3 target = vec3(sin((zTravel + 8.0) * 0.15) * 0.32, cos((zTravel + 8.0) * 0.15) * 0.32, zTravel + 8.0);
    vec3 fwd = normalize(target - ro);
    vec3 right = normalize(cross(fwd, vec3(0.0, 1.0, 0.0)));
    vec3 up = cross(right, fwd);
    vec3 rd = normalize(pRot.x * right + pRot.y * up + 1.2 * fwd);

    float t = 0.08;
    float maxDist = 48.0;
    vec3 totalEmit = vec3(0.0);
    float hit = 0.0;
    vec3 hitEmit = vec3(0.0);

    for (int i = 0; i < 75; i++) {
        vec3 p = ro + rd * t;
        vec3 eCol;
        float d = mapWormhole(p, eCol);

        totalEmit += eCol * exp(-t * 0.045) * 0.058;

        if (d < 0.005) {
            hit = 1.0;
            hitEmit = eCol;
            break;
        }
        t += max(0.02, d * 0.82);
        if (t > maxDist) break;
    }

    vec3 col = vec3(0.012, 0.015, 0.038);

    if (hit > 0.5) {
        col += hitEmit * 1.5;
        col = mix(col, vec3(0.015, 0.02, 0.045), 1.0 - exp(-0.022 * t));
    }

    col += totalEmit;

    // Blinding White-Hole Exit Singularity at vanishing point
    float rVignette = length(pRot);
    float whiteHole = exp(-rVignette * 4.2) * 2.8 * u_intensity;
    vec3 divineCore = vec3(1.0, 0.96, 0.88) * whiteHole;
    col += divineCore;

    // Relativistic Doppler speed streamers
    vec2 pGrid = fract(pRot * 14.0 + vec2(0.0, u_time * 28.0 * u_plunge_speed)) - 0.5;
    float streak = smoothstep(0.06, 0.0, abs(pGrid.x)) * step(0.9, hash3(vec3(floor(pRot * 14.0), floor(u_time * 10.0))));
    col += vec3(0.6, 0.9, 1.0) * streak * 0.4 * u_intensity;

    // Chronos wave resonance rings
    float waveRing = pow(sin(rVignette * 16.0 - u_time * 8.0) * 0.5 + 0.5, 6.0);
    col += vec3(0.2, 0.8, 1.0) * waveRing * exp(-rVignette * 1.5) * 0.35 * u_intensity;

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
