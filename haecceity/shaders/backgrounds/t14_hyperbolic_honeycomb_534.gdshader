shader_type canvas_item;
uniform float u_fade = 1.0;
uniform sampler2D tDiffuse : hint_default_black;
uniform sampler2D tPrevFrame : hint_default_black;
uniform vec2 u_resolution = vec2(1060.0, 550.0);
uniform float u_time = 0.0;
/*
 * TRIP MATH SUITE - SHADER T14: HYPERBOLIC 4-HONEYCOMB {5, 3, 4} POINCARÉ BALL
 * --------------------------------------------------------------------------------
 * Raymarches the interior of the regular hyperbolic 4-space honeycomb {5, 3, 4}
 * projected into the 3D Poincaré ball model:
 *   - Cells are regular 120-cells or dodecahedral hyper-prisms meeting 4 at each ridge.
 *   - Light rays travel along hyperbolic geodesics (arcs of circles orthogonal to the boundary S^2).
 *   - Inside the ball, the observer looks down infinite non-Euclidean corridors of
 *     crystalline dodecahedral mirrors shrinking towards the boundary sphere infinity.
 */






uniform float u_intensity = 1.0;        // Geodesic travel velocity (default: 1.0)
uniform float u_dodeca_scale = 1.4;     // Dodecahedral cell boundary spacing (0.8 to 2.0)
uniform float u_geodesic_bend = 1.0;    // Hyperbolic optical light-ray curvature
uniform float u_crystal_purity = 1.0;   // Specular crystal mirror reflectivity
uniform float u_infinity_glow = 1.0;    // Boundary horizon glow at |p| = 1



// Distance estimator for {5, 3, 4} dodecahedral honeycomb cells
float mapHoneycomb(vec3 pos, out vec3 cellColor) {
    vec3 p = pos;
    float r = length(p);

    // Hyperbolic coordinate folding
    // The Poincaré metric inflates space near the boundary: ds = 2*dx / (1 - r^2)
    float metric = 2.0 / max(1.0 - r * r, 0.05);

    // Dodecahedral mirror planes (golden ratio normals)
    float phi = 1.6180339887;
    vec3 n1 = normalize(vec3(0.0, 1.0, phi));
    vec3 n2 = normalize(vec3(1.0, phi, 0.0));
    vec3 n3 = normalize(vec3(phi, 0.0, 1.0));

    float minFacetDist = 1e5;

    for (int i = 0; i < 4; i++) {
        p = abs(p);
        float d1 = dot(p, n1);
        if (d1 < 0.0) p -= 2.0 * d1 * n1;
        float d2 = dot(p, n2);
        if (d2 < 0.0) p -= 2.0 * d2 * n2;
        float d3 = dot(p, n3);
        if (d3 < 0.0) p -= 2.0 * d3 * n3;
    }

    // Distance to nearest dodecahedron facet boundary
    float cellR = max(0.4, u_dodeca_scale * 0.5);
    float dFacet = abs(dot(p, n1) - cellR);

    // Color based on cell depth
    cellColor = 0.5 + 0.5 * cos(r * 12.0 + vec3(0.0, 2.0, 4.0));

    return dFacet / metric;
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 p = (vUv - 0.5) * 2.0;
    p.x *= u_resolution.x / u_resolution.y;

    float tCam = u_time * 0.25 * u_intensity;
    // Traveling inside the Poincaré ball along a hyperbolic geodesic
    vec3 ro = vec3(0.0, 0.0, sin(tCam) * 0.65);
    vec3 rd = normalize(vec3(p.x, p.y, 1.4));

    // Hyperbolic geodesic light bending: rays curve outward toward boundary
    float bend = u_geodesic_bend * 0.4;
    rd.xy += p * length(p) * bend;
    rd = normalize(rd);

    float t = 0.02;
    float maxDist = 3.0;
    float hit = 0.0;
    vec3 bestCellCol = vec3(0.0);
    float glow = 0.0;

    for (int i = 0; i < 64; i++) {
        vec3 pos = ro + rd * t;
        float rPos = length(pos);

        // Terminate at Poincaré boundary |pos| = 1
        if (rPos >= 0.98) {
            glow += 1.0;
            break;
        }

        vec3 cCol;
        float d = mapHoneycomb(pos, cCol);
        glow += exp(-d * 18.0) * 0.04;

        if (d < 0.003) {
            hit = 1.0;
            bestCellCol = cCol;
            break;
        }

        t += max(0.008, d * 0.6);
        if (t > maxDist) break;
    }

    vec3 col = vec3(0.01, 0.01, 0.02);

    if (hit > 0.5) {
        // Crystalline mirror reflection
        vec3 crystalHue = mix(vec3(0.1, 0.7, 0.95), bestCellCol, 0.6);
        col = crystalHue * u_crystal_purity;
    }

    // Boundary Horizon Singularity Glow (|p| -> 1 represents infinite space!)
    vec3 infinityHorizon = vec3(1.0, 0.4, 0.8); // Luminous cosmic boundary
    col += infinityHorizon * glow * u_infinity_glow * u_intensity;

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
