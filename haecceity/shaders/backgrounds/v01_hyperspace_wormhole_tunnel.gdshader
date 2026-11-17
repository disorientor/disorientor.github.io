shader_type canvas_item;
uniform float u_fade = 1.0;
uniform sampler2D tDiffuse : hint_default_black;
uniform sampler2D tPrevFrame : hint_default_black;
uniform vec2 u_resolution = vec2(1060.0, 550.0);
uniform float u_time = 0.0;
/*
 * VORTEX REALMS - SHADER V01: HYPERSPACE WORMHOLE WARP TUNNEL
 * -----------------------------------------------------------
 * Simulates superluminal transit through a Morris-Thorne traversable wormhole.
 * Space-time curvature contracts radial light rays according to hyperbolic throat
 * geometry: r(z) = sqrt(b0^2 + (z - v*t)^2).
 * Features:
 *   - Continuous forward hyper-velocity flight with corkscrew frame-dragging
 *   - Relativistic Doppler chromatic blueshift along the forward horizon
 *   - Logarithmic spiral gravitational caustic rings
 *   - Streaking relativistic star-trails converging at the celestial exit singularity
 */






uniform float u_intensity = 1.0;           // Warp velocity boost (default: 1.0)
uniform float u_flight_speed = 2.2;        // Forward transit velocity (0.5 to 5.0, default: 2.2)
uniform float u_twist_rate = 2.5;          // Frame-dragging spacetime rotation (0.0 to 6.0, default: 2.5)
uniform float u_throat_radius = 1.1;       // Wormhole metric throat pinch (0.4 to 2.5, default: 1.1)
uniform float u_chroma_warp = 1.4;         // Chromatic dispersion intensity (0.2 to 3.0, default: 1.4)
uniform float u_starlight_density = 20.0;   // Relativistic starlight streak frequency (5.0 to 40.0, default: 20.0)



// Rotation matrix
vec2 rot(vec2 p, float a) {
    float s = sin(a), c = cos(a);
    return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}

// Pseudo-random hash
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 p = (vUv - 0.5) * 2.0;
    p.x *= u_resolution.x / u_resolution.y;

    float r = max(length(p), 0.001);
    float theta = atan(p.y, p.x);

    // Hyperbolic Wormhole Coordinate Transformation
    float zCoord = 1.0 / (r * u_throat_radius);
    float transit = u_time * u_flight_speed * u_intensity;
    float z = zCoord + transit;

    // Relativistic Spacetime Frame Dragging (Twist increases near singularity)
    float twist = theta + zCoord * 0.45 * u_twist_rate + sin(z * 0.3) * 0.8;
    vec2 polarUv = vec2(twist / 6.2831853, z * 0.15);

    // Caustic Gravitational Rings (Lensed photon rings around throat)
    float ringPhase = z * 2.5 - u_time * 4.0;
    float causticRing = pow(sin(ringPhase) * 0.5 + 0.5, 4.0);
    float ripple = sin(twist * 8.0 + z * 1.5) * 0.5 + 0.5;

    // Relativistic Star Trails (Radial streaking towards center)
    float streakAngle = floor((theta + 3.14159) / 6.2831853 * u_starlight_density);
    float streakSeed = hash(vec2(streakAngle, 19.4));
    float streakZ = fract(z * 0.08 + streakSeed);
    float starStreak = smoothstep(0.02, 0.0, abs(fract(theta * u_starlight_density / 6.28318) - 0.5))
                     * pow(streakZ, 6.0) * step(0.3, streakSeed);

    // Chromatic dispersion multi-tap sampling of scene texture
    vec3 col = vec3(0.0);
    int CHROMA_TAPS = 4;
    for (int i = 0; i < CHROMA_TAPS; i++) {
        float fTap = float(i) / float(CHROMA_TAPS - 1);
        float shift = (fTap - 0.5) * 0.06 * u_chroma_warp;
        vec2 sampleUv = vUv + normalize(p) * shift * (1.0 / (r + 0.15));
        vec3 texCol = texture(tDiffuse, clamp(sampleUv, 0.0, 1.0)).rgb;

        vec3 tapHue = vec3(
            smoothstep(0.0, 0.5, 1.0 - abs(fTap - 0.2)),
            smoothstep(0.0, 0.5, 1.0 - abs(fTap - 0.5)),
            smoothstep(0.0, 0.5, 1.0 - abs(fTap - 0.8))
        );
        col += texCol * tapHue;
    }
    col *= 1.2;

    // Color Palette: Deep Space Singularity & Cyan Caustic Glow
    vec3 throatGlow = vec3(0.0, 0.95, 1.0) * causticRing * (0.8 + 0.5 * ripple);
    vec3 eventHorizonCore = vec3(1.0, 0.1, 0.7) * exp(-r * 3.5);
    vec3 starStreakCol = vec3(0.8, 0.9, 1.0) * starStreak * 3.0;

    col += throatGlow * u_intensity;
    col += eventHorizonCore * 1.5;
    col += starStreakCol;

    // Central Singularity exit portal
    float coreDisc = smoothstep(0.06, 0.02, r);
    vec3 singularityCol = vec3(1.0, 0.98, 0.9) * 2.0;
    col = mix(col, singularityCol, coreDisc);

    // Peripheral vignette
    col *= smoothstep(1.8, 0.3, r);

    out_col = vec4(clamp(col, 0.0, 1.0), 1.0);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(vec2(UV.x, 1.0 - UV.y), col);
    COLOR = vec4(col.rgb, u_fade);
}
