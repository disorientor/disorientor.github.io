shader_type canvas_item;
uniform float u_fade = 1.0;
uniform sampler2D tDiffuse : hint_default_black;
uniform sampler2D tPrevFrame : hint_default_black;
uniform vec2 u_resolution = vec2(1060.0, 550.0);
uniform float u_time = 0.0;
/*
 * VORTEX REALMS - SHADER V11: ESCHER HYPERBOLIC MIRROR CORRIDOR
 * -------------------------------------------------------------
 * Infinite flight through an impossible recursive hall of mirrors where non-Euclidean
 * architecture and multi-directional gravity collapse spatial intuition.
 * Features:
 *   - Recursive orthogonal checkerboard corridors branching across all 3 spatial axes
 *   - Impossible reflection matrices where walls, floors, and ceilings swap roles
 *   - Floating, spinning Platonic dodecahedral octahedrons suspended at gravity null-points
 *   - Continuous forward transit with mind-bending 90-degree axis rotations
 *   - Luminous brass and obsidian marble aesthetic with deep atmospheric depth
 */






uniform float u_intensity = 1.0;            // Spatial paradox boost (default: 1.0)
uniform float u_flight_speed = 1.8;         // Transit velocity (0.5 to 4.0, default: 1.8)
uniform float u_mirror_reflectivity = 0.85;  // Specular mirror bounce strength (0.2 to 1.5, default: 0.85)
uniform float u_corridor_scale = 3.2;       // Hallway cross-section dimension (1.5 to 6.0, default: 3.2)
uniform float u_rotation_warp = 1.1;        // Escherian twist rate (0.0 to 3.0, default: 1.1)
uniform float u_checker_frequency = 3.0;    // Flagstone tiling frequency (1.0 to 8.0, default: 3.0)



vec2 rot(vec2 p, float a) {
    float s = sin(a), c = cos(a);
    return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}

// Distance to an octahedron
float sdOctahedron(vec3 p, float s) {
    p = abs(p);
    return (p.x + p.y + p.z - s) * 0.57735027;
}

// Distance estimator for recursive Escher mirror maze
float mapEscher(vec3 pos, out vec3 tileCol) {
    // Spatial repetition interval
    float cSpan = u_corridor_scale;
    vec3 p = pos;

    // Escher continuous twist along flight path
    float twist = p.z * 0.15 * u_rotation_warp;
    p.xy = rot(p.xy, twist);

    vec3 cellId = floor((p + cSpan * 0.5) / cSpan);
    p = mod(p + cSpan * 0.5, cSpan) - cSpan * 0.5;

    // Orthogonal corridor cross-beams (empty inside, solid walls)
    float dX = max(abs(p.y), abs(p.z)) - cSpan * 0.42;
    float dY = max(abs(p.x), abs(p.z)) - cSpan * 0.42;
    float dZ = max(abs(p.x), abs(p.y)) - cSpan * 0.42;
    
    // Union of cross hallways
    float dCorridors = -min(min(dX, dY), dZ);

    // Floating Platonic Octahedron in chamber center
    vec3 pOct = p;
    pOct.xy = rot(pOct.xy, u_time * 1.5);
    pOct.yz = rot(pOct.yz, u_time * 1.2);
    float dOct = sdOctahedron(pOct, 0.45);

    float dScene = min(dCorridors, dOct);

    // Procedural 3D Escher Checkerboard Pattern
    vec3 checkerCoord = floor(pos * u_checker_frequency);
    float checker = mod(checkerCoord.x + checkerCoord.y + checkerCoord.z, 2.0);

    vec3 ivory = vec3(0.92, 0.90, 0.85);  // Ancient polished bone/marble
    vec3 obsidian = vec3(0.04, 0.04, 0.06); // Polished obsidian mirror
    vec3 brass = vec3(0.95, 0.75, 0.25);   // Gilded brass edge

    if (dScene == dOct) {
        tileCol = brass * 2.0;
    } else {
        tileCol = mix(obsidian, ivory, checker);
    }

    return dScene;
}

vec3 getNormal(vec3 p) {
    vec2 e = vec2(0.003, 0.0);
    vec3 dummy;
    float d = mapEscher(p, dummy);
    return normalize(vec3(
        mapEscher(p + e.xyy, dummy) - d,
        mapEscher(p + e.yxy, dummy) - d,
        mapEscher(p + e.yyx, dummy) - d
    ));
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 uv = (vUv - 0.5) * 2.0;
    uv.x *= u_resolution.x / u_resolution.y;

    // Flight camera motion down the recursive corridor
    float zTravel = u_time * 3.5 * u_flight_speed * u_intensity;
    vec3 ro = vec3(sin(zTravel * 0.1) * 0.4, cos(zTravel * 0.08) * 0.4, zTravel);
    vec3 target = vec3(sin((zTravel + 5.0) * 0.1) * 0.4, cos((zTravel + 5.0) * 0.08) * 0.4, zTravel + 5.0);

    vec3 ww = normalize(target - ro);
    vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
    vec3 vv = cross(uu, ww);
    vec3 rd = normalize(uv.x * uu + uv.y * vv + 1.3 * ww);

    float t = 0.1;
    float maxDist = 45.0;
    float hit = 0.0;
    vec3 hitCol = vec3(0.0);

    for (int i = 0; i < 75; i++) {
        vec3 p = ro + rd * t;
        vec3 tCol;
        float d = mapEscher(p, tCol);

        if (d < 0.004) {
            hit = 1.0;
            hitCol = tCol;
            break;
        }
        t += max(0.015, d * 0.75);
        if (t > maxDist) break;
    }

    vec3 col = vec3(0.02, 0.02, 0.03); // Infinite perspective shadow

    if (hit > 0.5) {
        vec3 p = ro + rd * t;
        vec3 n = getNormal(p);

        // Directional lantern illumination
        vec3 lightDir = normalize(vec3(0.3, 0.8, -0.6));
        float diff = max(dot(n, lightDir), 0.0);
        float spec = pow(max(dot(reflect(-lightDir, n), -rd), 0.0), 32.0);

        col = hitCol * (0.3 + 0.7 * diff) + vec3(1.0, 0.95, 0.8) * spec * 0.7;

        // Recursive mirror reflection bounce
        vec3 refRay = reflect(rd, n);
        vec2 sampleUv = clamp(vUv + refRay.xy * 0.25, 0.0, 1.0);
        vec3 mirrorTex = texture(tDiffuse, sampleUv).rgb;
        col += mirrorTex * u_mirror_reflectivity * 0.45;
    }

    // Depth fog into impossible infinity
    float fog = 1.0 - exp(-t * 0.045);
    vec3 fogCol = vec3(0.08, 0.07, 0.12);
    col = mix(col, fogCol, clamp(fog, 0.0, 1.0));

    // Peripheral vignette
    col *= smoothstep(1.7, 0.4, length(uv));

    out_col = vec4(clamp(col, 0.0, 1.0), 1.0);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(vec2(UV.x, 1.0 - UV.y), col);
    COLOR = vec4(col.rgb, u_fade);
}
