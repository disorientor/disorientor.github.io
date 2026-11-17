shader_type canvas_item;
uniform float u_fade = 1.0;
uniform sampler2D tDiffuse : hint_default_black;
uniform sampler2D tPrevFrame : hint_default_black;
uniform vec2 u_resolution = vec2(1060.0, 550.0);
uniform float u_time = 0.0;
/*
 * VORTEX REALMS - SHADER V19: HYPERDIMENSIONAL CALABI-YAU CRYSTAL CHASM
 * --------------------------------------------------------------------
 * Supersonic 3D flight down the compactified extra dimensions of a 6D
 * Calabi-Yau quintic threefold crystal manifold.
 * Features:
 *   - 3D projection of complex Calabi-Yau quintic hypersurfaces
 *   - Luminous pearlescent crystal ribs and prismatic rainbow caustics
 *   - Vibrating superstring flux tubes winding down the chasm
 *   - Continuous 3D flight with guaranteed clearance through the crystal folds
 *   - Deep-space cosmic void with higher-dimensional aurora illumination
 */

uniform float u_intensity = 1.0;           // Hyperdimensional warp factor (default: 1.0)
uniform float u_flight_speed = 2.2;        // Chasm transit velocity (0.5 to 5.0, default: 2.2)
uniform float u_crystal_facets = 5.0;      // Quintic symmetry order (3.0 to 8.0, default: 5.0)
uniform float u_superstring_glow = 2.0;    // Vibrating flux tube brightness (0.5 to 4.0, default: 2.0)
uniform float u_prismatic_sheen = 1.6;     // Rainbow thin-film dispersion (0.5 to 3.0, default: 1.6)

vec2 rot(vec2 p, float a) {
    float s = sin(a), c = cos(a);
    return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}

float hash3(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
}

// Distance estimator for Calabi-Yau crystal chasm
float mapCalabiYau(vec3 p, out vec3 emitCol, out float isString) {
    emitCol = vec3(0.0);
    isString = 0.0;

    // Twist along higher-dimensional transit axis Z
    float twist = p.z * 0.25 + u_time * 0.3;
    vec2 p2 = rot(p.xy, twist);

    float r = length(p2);
    float theta = atan(p2.y, p2.x);

    // Guaranteed central flight corridor clearance (radius > 1.25)
    float dCorridor = 1.25 - r;

    // Quintic threefold 5-fold azimuthal symmetry
    float nFacets = floor(max(3.0, u_crystal_facets));
    float facetAngle = sin(theta * nFacets + p.z * 0.5);
    
    // Calabi-Yau manifold distance approximation:
    // r^5 - psi * cos(5 theta) * sin(z) = 0
    float dCrystalWall = (3.2 - 0.5 * facetAngle * cos(p.z * 0.8)) - r;

    // Vibrating superstring flux tubes winding down the chasm flanks
    float stringAngle = mod(theta + 3.14159 / nFacets, 6.2831853 / nFacets) - 3.14159 / nFacets;
    vec2 stringCross = vec2(r - 2.2, stringAngle * r);
    float dSuperstring = length(stringCross) - 0.12;

    float dSolid = min(dCrystalWall, dSuperstring);
    float dFinal = max(dSolid, dCorridor);

    if (dFinal == dSuperstring) {
        // Vibrating superstring glowing with pure coherent energy
        float stringPulse = sin(p.z * 8.0 - u_time * 16.0);
        vec3 stringHue = 0.5 + 0.5 * cos(p.z * 0.4 + vec3(0.0, 2.0, 4.0));
        emitCol = stringHue * 3.8 * (0.6 + 0.4 * stringPulse) * u_superstring_glow;
        isString = 1.0;
    } else {
        // Prismatic iridescent crystal ribs
        float facetBorder = smoothstep(0.7, 1.0, facetAngle);
        vec3 irid = 0.5 + 0.5 * cos(theta * 4.0 + p.z * 0.6 + vec3(0.0, 2.0, 4.0));
        emitCol = irid * facetBorder * 1.8 * u_prismatic_sheen;
    }

    return dFinal;
}

vec3 calcNormal(vec3 p) {
    vec3 dummyE; float dummyS;
    vec2 e = vec2(0.005, -0.005);
    return normalize(
        e.xyy * mapCalabiYau(p + e.xyy, dummyE, dummyS) +
        e.yyx * mapCalabiYau(p + e.yyx, dummyE, dummyS) +
        e.yxy * mapCalabiYau(p + e.yxy, dummyE, dummyS) +
        e.xxx * mapCalabiYau(p + e.xxx, dummyE, dummyS)
    );
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 uv = (vUv - 0.5) * 2.0;
    uv.x *= u_resolution.x / u_resolution.y;

    // Flight velocity along compactified Z
    float zTravel = u_time * 5.0 * u_flight_speed * u_intensity;

    // Smooth graceful banking through the crystal chasm
    float camSway = sin(zTravel * 0.14) * 0.35;
    float camBob = cos(zTravel * 0.11) * 0.35;
    float camRoll = sin(zTravel * 0.10) * 0.16;
    vec2 pRot = rot(uv, camRoll);

    vec3 ro = vec3(camSway, camBob, zTravel);
    vec3 target = vec3(sin((zTravel + 8.0) * 0.14) * 0.35, cos((zTravel + 8.0) * 0.11) * 0.35, zTravel + 8.0);
    vec3 fwd = normalize(target - ro);
    vec3 right = normalize(cross(fwd, vec3(0.0, 1.0, 0.0)));
    vec3 up = cross(right, fwd);
    vec3 rd = normalize(pRot.x * right + pRot.y * up + 1.25 * fwd);

    float t = 0.08;
    float maxDist = 42.0;
    vec3 accLight = vec3(0.0);
    float hit = 0.0;
    vec3 hitEmit = vec3(0.0);
    vec3 hitP = vec3(0.0);

    for (int i = 0; i < 75; i++) {
        vec3 pos = ro + rd * t;
        vec3 eCol;
        float isStr;
        float d = mapCalabiYau(pos, eCol, isStr);

        accLight += eCol * exp(-t * 0.05) * 0.055;

        if (d < 0.005) {
            hit = 1.0;
            hitEmit = eCol;
            hitP = pos;
            break;
        }
        t += max(0.02, d * 0.78);
        if (t > maxDist) break;
    }

    vec3 col = vec3(0.012, 0.015, 0.035);

    if (hit > 0.5) {
        vec3 norm = calcNormal(hitP);
        vec3 lightDir = normalize(vec3(0.5, 0.8, -0.3));
        vec3 ref = reflect(rd, norm);

        float diff = clamp(dot(norm, lightDir), 0.0, 1.0);
        float spec = pow(clamp(dot(ref, lightDir), 0.0, 1.0), 32.0);
        float fresnel = pow(clamp(1.0 - dot(-rd, norm), 0.0, 1.0), 3.0);

        vec3 crystalBase = mix(vec3(0.05, 0.08, 0.14), vec3(0.7, 0.85, 0.95), fresnel);
        col = crystalBase * (0.35 + 0.65 * diff) + hitEmit + vec3(spec * 0.8);
        col = mix(col, vec3(0.015, 0.02, 0.045), 1.0 - exp(-0.025 * t));
    }

    col += accLight;

    // Vanishing point singularity bloom
    float rVignette = length(pRot);
    float coreBloom = exp(-rVignette * 3.0) * 0.85 * u_intensity;
    vec3 coreCol = mix(vec3(0.2, 0.8, 1.0), vec3(1.0, 0.4, 0.9), sin(zTravel * 0.3) * 0.5 + 0.5);
    col += coreCol * coreBloom;

    // Superstring speed streamers
    vec2 pGrid = fract(pRot * 14.0 + vec2(0.0, u_time * 24.0 * u_flight_speed)) - 0.5;
    float streak = smoothstep(0.05, 0.0, abs(pGrid.x)) * step(0.92, hash3(vec3(floor(pRot * 14.0), floor(u_time * 8.0))));
    col += vec3(0.8, 0.95, 1.0) * streak * 0.35 * u_intensity;

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
