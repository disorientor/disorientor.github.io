shader_type canvas_item;
uniform float u_fade = 1.0;
uniform sampler2D tDiffuse : hint_default_black;
uniform sampler2D tPrevFrame : hint_default_black;
uniform vec2 u_resolution = vec2(1060.0, 550.0);
uniform float u_time = 0.0;
/*
 * TRIP MATH SUITE - SHADER T13: OCTONIONIC FANO PLANE NEXUS & G2 AUTOMORPHISMS
 * ------------------------------------------------------------------------------
 * Sacred Cathedral Lore Mathematics for the Boss: "Octonionic Demiurge":
 *   - The 8-dimensional normed division algebra of Octonions O (Cayley numbers).
 *   - Non-associative algebra (a*(b*c) != (a*b)*c) governed by the Fano Plane:
 *       PG(2, 2): 7 imaginary units {e_1, e_2, e_3, e_4, e_5, e_6, e_7}
 *       forming 7 directed lines of 3 points each (e_i * e_j = e_k).
 *   - Visualizes the Fano plane projectivity spinning in 3D projective space,
 *     exceptional Lie group G_2 symmetry flows, and the Octonionic Associator:
 *       [x, y, z] = (x*y)*z - x*(y*z)
 *   - Emits prismatic hyper-toroidal gravitational shockwaves.
 */






uniform float u_intensity = 1.0;        // G2 symmetry automorphism flow speed (default: 1.0)
uniform float u_associator_shear = 1.0; // Non-associativity torsion magnitude
uniform float u_fano_ring_radius = 1.0; // Outer Fano circle scale (0.5 to 1.5)
uniform float u_rune_glow = 1.0;        // 7-Point imaginary unit nexus emission
uniform float u_triality_phase = 1.0;   // SO(8) triality rotation phase



void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 p = (vUv - 0.5) * 2.2;
    p.x *= u_resolution.x / u_resolution.y;

    float r = length(p);
    float theta = atan(p.y, p.x);

    // Dynamic G2 Lie group automorphism rotation
    float tRot = u_time * 0.3 * u_intensity;
    float ct = cos(tRot), st = sin(tRot);
    vec2 rotP = vec2(p.x * ct - p.y * st, p.x * st + p.y * ct);

    // 7-fold Fano symmetry points on the outer unit circle:
    // e_1 through e_6 on outer perimeter, e_7 at the central nexus
    float rFano = max(0.4, u_fano_ring_radius);
    float minNodeDist = 1e5;
    int nearestNode = -1;

    // Central unit e_7
    float dCenter = length(rotP);
    if (dCenter < minNodeDist) {
        minNodeDist = dCenter;
        nearestNode = 7;
    }

    // 6 outer perimeter nodes {e_1, e_2, e_3, e_4, e_5, e_6} (regular hexagon / heptagram)
    for (int i = 0; i < 6; i++) {
        float ang = float(i) * (6.2831853 / 6.0);
        vec2 nodePos = vec2(cos(ang), sin(ang)) * rFano;
        float d = length(rotP - nodePos);
        if (d < minNodeDist) {
            minNodeDist = d;
            nearestNode = i + 1;
        }
    }

    // Fano Plane Directed Lines:
    // 3 lines through center (altitudes of the triangle)
    // 3 sides of the equilateral triangle
    // 1 inscribed central circle touching midpoints
    float minLineDist = 1e5;

    // Inscribed central circle line (the 7th line of the Fano plane)
    float rInscribed = rFano * 0.5;
    float dInscribedCircle = abs(length(rotP) - rInscribed);
    minLineDist = min(minLineDist, dInscribedCircle);

    // 3 radiating lines through the central node e_7
    for (int j = 0; j < 3; j++) {
        float ang = float(j) * (3.14159265 / 3.0);
        vec2 norm = vec2(sin(ang), -cos(ang));
        float dLine = abs(dot(rotP, norm));
        minLineDist = min(minLineDist, dLine);
    }

    // Non-associativity Associator Torsion Shear [x, y, z]
    float associatorWarp = sin(theta * 7.0 + r * 14.0 - u_time * 2.0) * u_associator_shear * 0.05 * u_intensity;
    minLineDist = abs(minLineDist - abs(associatorWarp));

    // Base Sacred Geometry Palette: Deep Cosmic Obsidian, Imperial Violet, and Gold
    vec3 obsidian = vec3(0.015, 0.01, 0.03);
    vec3 imperialViolet = vec3(0.35, 0.05, 0.6);
    vec3 alchemicalGold  = vec3(1.0, 0.85, 0.3);
    vec3 cyanNode       = vec3(0.0, 0.95, 1.0);

    vec3 col = obsidian + imperialViolet * exp(-r * 2.0);

    // Glowing Fano Plane Projective Lines
    float lineStroke = smoothstep(0.015, 0.003, minLineDist);
    col = mix(col, alchemicalGold * 1.5, lineStroke * 0.85);

    // Glowing 7 Imaginary Unit Nodes {e_1 ... e_7}
    float nodeRadius = 0.06;
    float nodeGlow = exp(-minNodeDist * 20.0);
    float nodeCore = smoothstep(nodeRadius, 0.01, minNodeDist);
    col += cyanNode * (nodeCore * 2.0 + nodeGlow * 1.2) * u_rune_glow;

    // Triality Phase Ripples (SO(8) Triality representations of quarks/leptons)
    float triality = sin(r * 28.0 - u_time * 3.0 + u_triality_phase * 6.28);
    col += vec3(0.8, 0.2, 0.9) * smoothstep(0.85, 1.0, triality) * 0.35 * u_intensity;

    // Blend with scene
    vec3 scene = texture(tDiffuse, vUv).rgb;
    col = mix(scene * 0.15 + col, col, 0.88);

    out_col = vec4(clamp(col, 0.0, 1.0), 1.0);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(vec2(UV.x, 1.0 - UV.y), col);
    COLOR = vec4(col.rgb, u_fade);
}
