shader_type canvas_item;
uniform float u_fade = 1.0;
uniform sampler2D tDiffuse : hint_default_black;
uniform sampler2D tPrevFrame : hint_default_black;
uniform vec2 u_resolution = vec2(1060.0, 550.0);
uniform float u_time = 0.0;
/*
 * VORTEX REALMS - SHADER V08: HYPER-TORUS CLIFFORD KNOT ROLLERCOASTER
 * -------------------------------------------------------------------
 * High-velocity, hair-raising flight through the neon interior of a (p, q) Torus Knot
 * tube wound around a 4-dimensional Clifford Torus.
 * Features:
 *   - Continuous rollercoaster flight tracing a non-Euclidean trefoil / cinquefoil knot
 *   - Aerodynamic Frenet-Serret camera banking into steep 360-degree helical loops
 *   - Luminous neon laser rings lining the tube interior with chromatic speed trails
 *   - Translucent wireframe lattice window slats revealing the outer cosmic abyss
 *   - Pulsating hyperspace velocity streaks along the central flight spline
 */






uniform float u_intensity = 1.0;            // G-force acceleration factor (default: 1.0)
uniform float u_flight_speed = 2.4;         // Rollercoaster track speed (0.5 to 5.0, default: 2.4)
uniform float u_knot_p = 2.0;               // Toroidal winding integer P (2.0 to 5.0, default: 2.0)
uniform float u_knot_q = 3.0;               // Poloidal winding integer Q (3.0 to 7.0, default: 3.0)
uniform float u_tube_radius = 0.85;          // Tube interior diameter (0.4 to 1.8, default: 0.85)
uniform float u_neon_ring_density = 16.0;    // Neon track rib frequency (5.0 to 30.0, default: 16.0)



vec2 rot(vec2 p, float a) {
    float s = sin(a), c = cos(a);
    return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}

// Parametric Torus Knot Curve gamma(t)
vec3 getKnotPos(float t) {
    float p = floor(max(2.0, u_knot_p));
    float q = floor(max(3.0, u_knot_q));
    float R = 3.2; // Major torus radius
    float r = 1.4; // Minor torus radius

    float rMod = R + r * cos(q * t);
    float x = rMod * cos(p * t);
    float y = rMod * sin(p * t);
    float z = -r * sin(q * t);

    return vec3(x, z, y); // Y is up
}

// Frenet-Serret Tangent vector via finite difference
vec3 getKnotTangent(float t) {
    float dt = 0.01;
    return normalize(getKnotPos(t + dt) - getKnotPos(t - dt));
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 uv = (vUv - 0.5) * 2.0;
    uv.x *= u_resolution.x / u_resolution.y;

    // Flight spline progression
    float tFlight = u_time * 0.35 * u_flight_speed * u_intensity;
    vec3 camPos = getKnotPos(tFlight);
    vec3 camTarget = getKnotPos(tFlight + 0.15);
    
    // Construct orthonormal Frenet frame (Tangent, Normal, Binormal)
    vec3 fwd = normalize(camTarget - camPos);
    vec3 curvature = normalize(getKnotTangent(tFlight + 0.05) - fwd);
    vec3 up = curvature; // Banks into the turn
    vec3 right = normalize(cross(fwd, up));
    up = cross(right, fwd);

    // Ray direction within the Frenet frame
    vec3 rd = normalize(uv.x * right + uv.y * up + 1.25 * fwd);

    // Raymarch the interior of the tube around the knot curve
    // Analytic ray-tube cylinder approximation in moving frame
    float r = length(uv);
    float theta = atan(uv.y, uv.x);

    // Speed-dependent longitudinal tube coordinates
    float zTube = tFlight * 18.0 + 1.0 / max(r, 0.08);

    // 1. Neon Track Rib Rings (transverse glowing bands)
    float ringPhase = zTube * u_neon_ring_density * 0.1;
    float isRing = pow(sin(ringPhase) * 0.5 + 0.5, 12.0);

    // Longitudinal energy rails (4 glowing lines along tube wall: top, bottom, left, right)
    float isRail = pow(cos(theta * 4.0) * 0.5 + 0.5, 20.0);

    // 2. Translucent Diamond Wireframe Lattice
    vec2 lattice = fract(vec2(theta * 3.0 / 3.14159, zTube * 0.8));
    float diamond = smoothstep(0.08, 0.02, abs(lattice.x - lattice.y));

    // Dynamic Spectral Neon Palette (Ultraviolet, Hot Pink, Cyan)
    vec3 colPink = vec3(1.0, 0.05, 0.65);
    vec3 colCyan = vec3(0.0, 0.95, 1.0);
    vec3 colGold = vec3(1.0, 0.85, 0.2);

    float colorShift = tFlight * 2.0 + zTube * 0.05;
    vec3 trackColor = mix(colCyan, colPink, sin(colorShift) * 0.5 + 0.5);

    vec3 col = vec3(0.02, 0.015, 0.04); // Deep cosmic void

    // Inner tube surface lighting
    float tubeDist = smoothstep(0.1, 1.2, r);
    col += trackColor * isRing * tubeDist * 3.0;
    col += colGold * isRail * tubeDist * 2.5;
    col += vec3(0.3, 0.5, 1.0) * diamond * tubeDist * 0.8;

    // Vanishing Point Singularity (Forward headlight tunnel core)
    float coreLight = exp(-r * 4.0);
    col += vec3(1.0, 0.98, 0.9) * coreLight * 2.8;

    // Translucent windows: sample scene texture in the gaps
    float windowGap = (1.0 - isRing) * (1.0 - isRail);
    vec2 windowUv = clamp(vUv + vec2(sin(tFlight * 2.0), cos(tFlight * 2.0)) * 0.05, 0.0, 1.0);
    vec3 outerSpace = texture(tDiffuse, windowUv).rgb;
    col += outerSpace * windowGap * 0.45;

    // Relativistic velocity streaking
    float streak = pow(fract(zTube * 0.15 + sin(theta * 8.0) * 0.2), 8.0);
    col += colCyan * streak * 1.5;

    // Peripheral bank vignette
    col *= smoothstep(1.7, 0.4, r);

    out_col = vec4(clamp(col, 0.0, 1.0), 1.0);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(vec2(UV.x, 1.0 - UV.y), col);
    COLOR = vec4(col.rgb, u_fade);
}
