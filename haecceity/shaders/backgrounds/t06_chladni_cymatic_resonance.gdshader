shader_type canvas_item;
uniform float u_fade = 1.0;
uniform sampler2D tDiffuse : hint_default_black;
uniform sampler2D tPrevFrame : hint_default_black;
uniform vec2 u_resolution = vec2(1060.0, 550.0);
uniform float u_time = 0.0;
/*
 * TRIP MATH SUITE - SHADER T06: CHLADNI CYMATIC RESONANCE NODAL FIELDS
 * ----------------------------------------------------------------------
 * Evaluates Ernst Chladni's 1787 acoustic vibration nodal equations:
 *   w(x, y) = a * sin(n*pi*x / L) * sin(m*pi*y / L) - b * sin(m*pi*x / L) * sin(n*pi*y / L) = 0
 * Physics:
 *   - Sound vibration excites a resonant square or circular metal plate.
 *   - Particulate matter (sand/salt) is repelled from vibrating anti-nodes
 *     and settles into quiet nodal boundary lines (w(x, y) = 0).
 *   - Multi-harmonic mode beating transitions between modal integers (m, n).
 *   - Produces sacred cymatic mandalas, Tibetan singing bowl standing wave forms,
 *     and acoustic levitation interference fringes.
 */






uniform float u_intensity = 1.0;        // Vibration frequency sweep rate (default: 1.0)
uniform float u_mode_m = 6.0;           // Harmonic integer m (1 to 10)
uniform float u_mode_n = 6.0;           // Harmonic integer n (1 to 10)
uniform float u_nodal_sharpness = 1.0;  // Sand grain settling concentration
uniform float u_cymatic_plate = 0.0;    // 0 = Square Plate, 1 = Circular Drumhead, 2 = Hexagonal Resonator



void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 p = (vUv - 0.5) * 2.0;
    p.x *= u_resolution.x / u_resolution.y;

    float r = length(p);
    float theta = atan(p.y, p.x);

    // Harmonic mode integers
    float m = max(1.0, floor(u_mode_m));
    float n = max(1.0, floor(u_mode_n));

    // Dynamic mode beating (smooth morphing between adjacent modes)
    float beat = sin(u_time * 0.8 * u_intensity);
    float a = cos(u_time * 0.4);
    float b = sin(u_time * 0.4);

    float w = 0.0;

    if (u_cymatic_plate < 0.5) {
        // Mode 0: Classic Square Chladni Plate
        float pi = 3.14159265;
        w = a * sin(n * pi * p.x) * sin(m * pi * p.y) - b * sin(m * pi * p.x) * sin(n * pi * p.y);
    } else if (u_cymatic_plate < 1.5) {
        // Mode 1: Circular Drumhead (Bessel function nodal lines approximation)
        // w(r, theta) = J_m(k * r) * cos(m * theta)
        float bessel = cos(r * n * 3.14159 - m * 1.57079) / sqrt(max(r * n * 3.14159, 0.5));
        w = bessel * cos(m * theta + u_time * 0.5);
    } else {
        // Mode 2: Hexagonal Resonator (3 coupled wave vectors at 120 degrees)
        vec2 k1 = vec2(1.0, 0.0);
        vec2 k2 = vec2(-0.5, 0.866025);
        vec2 k3 = vec2(-0.5, -0.866025);
        w = sin(dot(p, k1) * n * 3.14) + sin(dot(p, k2) * m * 3.14) + sin(dot(p, k3) * (n + m) * 1.57);
    }

    // Nodal line extraction: where amplitude w(x, y) = 0
    float sharpness = max(2.0, u_nodal_sharpness);
    float sandConcentration = exp(-abs(w) * sharpness * 6.0);

    // Anti-node kinetic energy (vibrating blur regions)
    float kineticEnergy = abs(w);

    // Cymatic Palette: Dark resonant bronze plate with glowing gold sand grains
    vec3 bronzePlate = vec3(0.08, 0.06, 0.05);
    vec3 antiNodeVibration = vec3(0.1, 0.35, 0.5) * kineticEnergy * 0.6;
    vec3 goldSand = vec3(1.0, 0.88, 0.4); // Fine luminous quartz sand

    vec3 col = bronzePlate + antiNodeVibration;
    col = mix(col, goldSand * 1.8, sandConcentration);

    // High-frequency acoustic micro-chatter
    float grainNoise = fract(sin(dot(p + vec2(u_time * 0.01), vec2(127.1, 311.7))) * 43758.5453);
    col += (grainNoise - 0.5) * 0.1 * sandConcentration;

    // Outer boundary damping ring
    float boundaryMask = smoothstep(1.0, 0.96, r);
    col *= boundaryMask;

    // Blend with scene
    vec3 scene = texture(tDiffuse, vUv).rgb;
    col = mix(scene * 0.15 + col, col, 0.88 * u_intensity);

    out_col = vec4(clamp(col, 0.0, 1.0), 1.0);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(vec2(UV.x, 1.0 - UV.y), col);
    COLOR = vec4(col.rgb, u_fade);
}
