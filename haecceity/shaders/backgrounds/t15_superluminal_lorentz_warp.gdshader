shader_type canvas_item;
uniform float u_fade = 1.0;
uniform sampler2D tDiffuse : hint_default_black;
uniform sampler2D tPrevFrame : hint_default_black;
uniform vec2 u_resolution = vec2(1060.0, 550.0);
uniform float u_time = 0.0;
/*
 * TRIP MATH SUITE - SHADER T15: SUPERLUMINAL LORENTZ WARP & OPTICAL ABERRATION
 * -----------------------------------------------------------------------------
 * Relativistic electrodynamics and special relativity visual distortion:
 *   - Relativistic Optical Aberration (Einstein 1905):
 *       cos(theta') = (cos(theta) - beta) / (1 - beta * cos(theta))
 *     As velocity beta = v/c -> 1.0, the entire 360-degree cosmos collapses forward
 *     into a concentrated, intensely bright circle ahead (the "Headlight Effect").
 *   - Relativistic Doppler Shift:
 *       nu' = nu * sqrt((1 - beta) / (1 + beta))  (Forward blue shift, rearward red shift)
 *   - Lorentz-FitzGerald Length Contraction: Space shrinks by factor gamma = 1 / sqrt(1 - beta^2)
 *   - Tachyon Warp Inversion: When beta > 1.0, imaginary metric folds into Cherenkov cones.
 */






uniform float u_intensity = 1.0;        // Warp acceleration factor (default: 1.0)
uniform float u_beta_velocity = 0.5495;    // Relative velocity beta = v/c (0.1 to 0.999)
uniform float u_doppler_depth = 1.0;    // Relativistic spectral blue/red shift strength
uniform float u_cherenkov_glow = 1.0;   // Vacuum Cherenkov radiation ring brightness
uniform float u_star_density = 1.0;     // Background cosmic starfield frequency



float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

// Doppler frequency shift to RGB spectrum mapping
vec3 dopplerColor(float dopplerFactor) {
    // factor > 1: blue shift (high energy)
    // factor < 1: red shift (low energy)
    float t = clamp(log2(dopplerFactor) * 0.5 + 0.5, 0.0, 1.0);
    vec3 redEnd  = vec3(0.9, 0.1, 0.0);
    vec3 midSpec = vec3(0.2, 0.9, 0.3);
    vec3 blueEnd = vec3(0.1, 0.4, 1.0);
    vec3 uvEnd   = vec3(0.7, 0.1, 1.0);

    if (t < 0.33) return mix(redEnd, midSpec, t * 3.0);
    if (t < 0.66) return mix(midSpec, blueEnd, (t - 0.33) * 3.0);
    return mix(blueEnd, uvEnd, (t - 0.66) * 3.0);
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 p = (vUv - 0.5) * 2.0;
    p.x *= u_resolution.x / u_resolution.y;

    float r = length(p);

    // Relativistic velocity beta = v/c (drifting dynamically with warp throttle)
    float beta = clamp(u_beta_velocity + 0.08 * sin(u_time * 0.5) * u_intensity, 0.1, 0.995);
    float gamma = 1.0 / sqrt(1.0 - beta * beta);

    // Initial ray angle relative to flight vector (center of screen is forward)
    float theta = r * 1.2; // Angle from forward heading vector in radians
    float cosTheta = cos(theta);

    // Einstein's Relativistic Aberration Formula:
    // cos(theta') = (cos(theta) - beta) / (1 - beta * cos(theta))
    float cosThetaPrime = (cosTheta - beta) / max(1.0 - beta * cosTheta, 1e-4);
    cosThetaPrime = clamp(cosThetaPrime, -1.0, 1.0);
    float thetaPrime = acos(cosThetaPrime);

    // Relativistic Doppler Shift Factor: D = 1 / (gamma * (1 - beta * cos(theta)))
    float dopplerFactor = 1.0 / (gamma * max(1.0 - beta * cosTheta, 0.01));

    // Relativistic Headlight Intensity Beaming: I' = I * D^4
    float headlightBeaming = pow(dopplerFactor, 2.5);

    // Warped coordinate vector based on aberration
    vec2 dir = normalize(p + vec2(1e-5));
    float warpedR = thetaPrime / 1.2;
    vec2 warpedUv = 0.5 + dir * warpedR * 0.5;

    // Sample video texture through relativistic warp
    vec3 col = texture(tDiffuse, clamp(warpedUv, 0.0, 1.0)).rgb;

    // Apply Relativistic Doppler Color Shift
    vec3 shiftHue = dopplerColor(dopplerFactor);
    col = mix(col, col * shiftHue * 1.5, u_doppler_depth);

    // Apply Headlight Beaming Brightness Concentration
    col *= clamp(headlightBeaming * 0.5, 0.1, 4.0);

    // Cherenkov Radiation Ring (Optical shockwave cone boundary)
    // Occurs at the Mach / Cherenkov angle: cos(theta_c) = 1 / (beta * n)
    float cherenkovAngle = acos(clamp(1.0 / (beta * 1.15), 0.0, 1.0));
    float dCherenkov = abs(theta - cherenkovAngle);
    float cherenkovRing = exp(-dCherenkov * 30.0);
    vec3 cherenkovBlue = vec3(0.0, 0.85, 1.0); // Electric vacuum blue
    col += cherenkovBlue * cherenkovRing * u_cherenkov_glow * u_intensity;

    // Background Relativistic Star Streaks
    float starAngle = atan(p.y, p.x);
    float starSeed = hash(vec2(floor(starAngle * 30.0), 42.1));
    float starLine = smoothstep(0.92, 0.98, sin(r * 40.0 - u_time * 20.0 * gamma));
    col += vec3(1.0) * starLine * starSeed * step(0.6, beta) * 0.6;

    out_col = vec4(clamp(col, 0.0, 1.0), 1.0);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(vec2(UV.x, 1.0 - UV.y), col);
    COLOR = vec4(col.rgb, u_fade);
}
