shader_type canvas_item;
uniform float u_fade = 1.0;
uniform sampler2D tDiffuse : hint_default_black;
uniform sampler2D tPrevFrame : hint_default_black;
uniform vec2 u_resolution = vec2(1060.0, 550.0);
uniform float u_time = 0.0;
/*
 * TRIP MATH SUITE - SHADER T02: POINCARÉ HYPERBOLIC DISK {p, q} TESSELLATION
 * ----------------------------------------------------------------------------
 * Visualizes the Poincaré Disk model of hyperbolic 2-space H^2:
 *   - Distance metric: ds^2 = 4 * (dx^2 + dy^2) / (1 - (x^2 + y^2))^2
 *   - The ideal boundary circle |z| = 1 represents infinity.
 *   - Regular {p, q} Schläfli tessellations (e.g. {7, 3} Heptagonal or {8, 3} Octagonal):
 *     p-sided regular hyperbolic polygons meeting q at each vertex.
 *   - Dynamic hyperbolic isometry / Möbius transformations:
 *       z' = (z - a) / (1 - conj(a) * z) * e^{i * theta}
 *   - Visualizes infinite recursive boundary chambers, geodesic flows, and horocycles.
 */






uniform float u_intensity = 1.0;        // Möbius flow speed (default: 1.0)
uniform float u_p_sides = 5.0;          // Schläfli symbol p (5, 7, 8)
uniform float u_tessellation_depth = 8.0; // Recursive tiling reflection generations (4 to 12)
uniform float u_geodesic_width = 1.0;   // Border stroke thickness of hyperbolic geodesics
uniform float u_horocycle_rings = 1.0;  // Concentric horocycle wave frequency



// Complex arithmetic
vec2 cMul(vec2 a, vec2 b) {
    return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
}

vec2 cDiv(vec2 a, vec2 b) {
    float d = dot(b, b);
    return vec2(dot(a, b), a.y * b.x - a.x * b.y) / max(d, 1e-8);
}

// Möbius boost isometry in the Poincaré disk
vec2 mobiusBoost(vec2 z, vec2 a) {
    vec2 num = z - a;
    vec2 conjA = vec2(a.x, -a.y);
    vec2 den = vec2(1.0, 0.0) - cMul(conjA, z);
    return cDiv(num, den);
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 p = (vUv - 0.5) * 2.2;
    p.x *= u_resolution.x / u_resolution.y;

    float r = length(p);

    // Outside the ideal boundary disk |z| = 1
    if (r >= 1.0) {
        // Void outside hyperbolic universe
        out_col = vec4(0.01, 0.01, 0.02, 1.0);
        return;
    }

    // Dynamic hyperbolic geodesic flow via continuous Möbius transformation
    float flowSpeed = u_time * 0.3 * u_intensity;
    vec2 boostA = vec2(sin(flowSpeed) * 0.55, cos(flowSpeed * 0.7) * 0.4);
    vec2 z = mobiusBoost(p, boostA);

    // Schläfli {p, 3} symmetry setup
    float pSides = max(5.0, floor(u_p_sides));
    float sectorAngle = 6.2831853 / pSides;

    // Iterative hyperbolic reflections across fundamental domain boundaries
    int maxDepth = int(clamp(u_tessellation_depth, 4.0, 12.0));
    float reflections = 0.0;
    float minGeodesicDist = 1.0;

    for (int i = 0; i < 12; i++) {
        if (i >= maxDepth) break;

        // Polar angle in disk
        float ang = atan(z.y, z.x);
        float rZ = length(z);

        // Fold into primary angular wedge
        ang = mod(ang + sectorAngle * 0.5, sectorAngle) - sectorAngle * 0.5;
        z = vec2(cos(ang), sin(ang)) * rZ;

        // Geodesic orthogonal mirror circle in Poincaré disk
        // Radius and center of orthogonal geodesic circle for {p, 3}
        float piOverP = 3.14159265 / pSides;
        float piOverQ = 3.14159265 / 3.0;
        float chB = cos(piOverQ) / sin(piOverP);
        float circleR = sqrt(max(chB * chB - 1.0, 0.01));
        vec2 circleCenter = vec2(chB, 0.0);

        // Inversion in orthogonal circle (hyperbolic reflection)
        vec2 delta = z - circleCenter;
        float d2 = dot(delta, delta);
        float distToGeodesic = abs(sqrt(d2) - circleR);
        minGeodesicDist = min(minGeodesicDist, distToGeodesic);

        if (d2 < circleR * circleR) {
            // Point is outside fundamental domain; reflect across geodesic
            z = circleCenter + delta * (circleR * circleR / d2);
            reflections += 1.0;
        } else {
            break;
        }
    }

    // Alternating Escher-style tiling coloration
    float parity = mod(reflections, 2.0);
    vec3 tileColorA = vec3(0.08, 0.35, 0.75); // Royal Hyperbolic Cobalt
    vec3 tileColorB = vec3(0.95, 0.65, 0.15); // Solar Gold
    vec3 col = mix(tileColorA, tileColorB, parity);

    // Hyperbolic Horocycles (Concentric circles touching ideal boundary)
    float horocycle = sin(log((1.0 + r) / max(1.0 - r, 1e-4)) * u_horocycle_rings - u_time * 2.0);
    col *= (0.8 + 0.2 * horocycle);

    // Geodesic Boundary Ribbons
    float gWidth = max(0.005, u_geodesic_width * 0.02);
    float isGeodesic = smoothstep(gWidth, 0.0, minGeodesicDist);
    col = mix(col, vec3(0.95, 0.98, 1.0), isGeodesic * 0.85);

    // Ideal Boundary Horizon Ring (|z| = 1 glowing white boundary)
    float boundaryRing = smoothstep(0.97, 1.0, r);
    col = mix(col, vec3(1.0, 0.2, 0.6), boundaryRing * 0.9);

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
