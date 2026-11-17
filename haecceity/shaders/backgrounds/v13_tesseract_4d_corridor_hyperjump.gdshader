shader_type canvas_item;
uniform float u_fade = 1.0;
uniform sampler2D tDiffuse : hint_default_black;
uniform sampler2D tPrevFrame : hint_default_black;
uniform vec2 u_resolution = vec2(1060.0, 550.0);
uniform float u_time = 0.0;
/*
 * VORTEX REALMS - SHADER V13: 4D TESSERACT HYPER-CORRIDOR TRANSIT
 * ---------------------------------------------------------------
 * Travelling down a 4-dimensional hypercube corridor where 3D architectural rooms
 * unfold and self-intersect along the W-axis.
 * Features:
 *   - Continuous hyper-spatial flight with simultaneous X-W and Z-W 4D rotations
 *   - 8 cubic hyper-cells unfolding through 4-space, casting 3D projected shadow lattices
 *   - Luminous wireframe hyper-edges glowing neon electric cyan and quantum violet
 *   - Translucent hyper-facet portals peering into higher-dimensional manifolds
 *   - Relativistic coordinate folding with hyperspace vanishing singularity
 */






uniform float u_intensity = 1.0;            // Hyper-dimensional resonance (default: 1.0)
uniform float u_flight_speed = 2.2;         // 4D transit velocity (0.5 to 5.0, default: 2.2)
uniform float u_hyper_rot_xw = 1.5;         // 4D X-W plane rotation rate (0.0 to 4.0, default: 1.5)
uniform float u_hyper_rot_zw = 1.2;         // 4D Z-W plane rotation rate (0.0 to 4.0, default: 1.2)
uniform float u_lattice_thickness = 0.08;    // Hyper-edge wireframe width (0.02 to 0.25, default: 0.08)
uniform float u_quantum_flux = 1.8;         // Zero-point hyperspace glow (0.5 to 3.5, default: 1.8)



vec2 rot(vec2 p, float a) {
    float s = sin(a), c = cos(a);
    return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}

// 4D Tesseract Distance Estimator: max(|x|, |y|, |z|, |w|) - size
float map4DTesseract(vec4 p4, out float isEdge) {
    vec4 b = abs(p4) - vec4(1.0);
    float dMax = max(max(b.x, b.y), max(b.z, b.w));

    // Count how many coordinates are near the boundary (Hyper-edges have >= 3 coords near 0)
    vec4 edgeDist = abs(abs(p4) - vec4(1.0));
    float eCount = step(edgeDist.x, u_lattice_thickness) +
                   step(edgeDist.y, u_lattice_thickness) +
                   step(edgeDist.z, u_lattice_thickness) +
                   step(edgeDist.w, u_lattice_thickness);
    isEdge = step(3.0, eCount);

    return dMax;
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 p = (vUv - 0.5) * 2.0;
    p.x *= u_resolution.x / u_resolution.y;

    // 4D Camera trajectory: moving along Z and W simultaneously
    float transit = u_time * 2.5 * u_flight_speed * u_intensity;
    vec3 ro = vec3(0.0, 0.0, transit);
    vec3 rd = normalize(vec3(p.x, p.y, 1.3));

    // 4D Rotation Angles (Rotating through the 4th spatial dimension)
    float aXW = u_time * 0.4 * u_hyper_rot_xw;
    float aZW = u_time * 0.3 * u_hyper_rot_zw;

    // Raymarching through 4D space
    float t = 0.1;
    float maxDist = 32.0;
    vec3 accGlow = vec3(0.0);
    float hit = 0.0;
    float bestEdge = 0.0;

    for (int i = 0; i < 70; i++) {
        vec3 p3 = ro + rd * t;
        
        // Periodic repetition of tesseract cells along Z
        float zCell = mod(p3.z, 3.5) - 1.75;
        float wCoord = sin(transit * 0.4 + p3.z * 0.2) * 1.2;

        // Embed 3D point into 4D space: (x, y, zCell, w)
        vec4 p4 = vec4(p3.x, p3.y, zCell, wCoord);

        // Apply 4D Rotations: X-W plane
        p4.xw = rot(p4.xw, aXW);
        // Apply 4D Rotations: Z-W plane
        p4.zw = rot(p4.zw, aZW);

        float isEdge;
        float d4 = map4DTesseract(p4, isEdge);

        // Volumetric 4D shadow edge glow
        if (isEdge > 0.5) {
            vec3 edgeCol = mix(vec3(0.0, 0.95, 1.0), vec3(0.8, 0.1, 1.0), sin(p3.z * 0.5) * 0.5 + 0.5);
            accGlow += edgeCol * exp(-t * 0.1) * 0.045 * u_quantum_flux;
        }

        if (abs(d4) < 0.005) {
            hit = 1.0;
            bestEdge = isEdge;
            break;
        }
        t += max(0.018, abs(d4) * 0.7);
        if (t > maxDist) break;
    }

    vec3 col = vec3(0.015, 0.01, 0.035); // Hyperspace void

    if (hit > 0.5) {
        if (bestEdge > 0.5) {
            // Hyper-edge neon laser emission
            col += vec3(0.0, 1.0, 0.9) * 2.5;
        } else {
            // Translucent 4D hyper-facet
            col += vec3(0.2, 0.05, 0.4) * 1.2;
        }
    }

    col += accGlow;

    // Vanishing 4D wormhole singularity at screen center
    float r = length(p);
    float core = exp(-r * 4.5);
    col += vec3(1.0, 0.85, 0.4) * core * 2.2;

    // Translucent portals into the active texture feed
    vec2 portalUv = clamp(vUv + vec2(sin(transit), cos(transit)) * 0.04, 0.0, 1.0);
    vec3 sceneTex = texture(tDiffuse, portalUv).rgb;
    col = mix(col, col + sceneTex * 0.3, 0.65);

    // Peripheral dimensional warp vignette
    col *= smoothstep(1.7, 0.35, r);

    out_col = vec4(clamp(col, 0.0, 1.0), 1.0);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(vec2(UV.x, 1.0 - UV.y), col);
    COLOR = vec4(col.rgb, u_fade);
}
