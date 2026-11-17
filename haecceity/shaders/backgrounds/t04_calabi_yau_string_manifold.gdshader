shader_type canvas_item;
uniform float u_fade = 1.0;
uniform sampler2D tDiffuse : hint_default_black;
uniform sampler2D tPrevFrame : hint_default_black;
uniform vec2 u_resolution = vec2(1060.0, 550.0);
uniform float u_time = 0.0;
/*
 * TRIP MATH SUITE - SHADER T04: 6D CALABI-YAU MANIFOLD COMPACTIFICATION
 * ------------------------------------------------------------------------
 * Visualizes 2D/3D cross-sectional projections of a 6-dimensional Calabi-Yau manifold
 * (Ricci-flat Kähler manifold) used in Superstring Theory to compactify extra dimensions:
 *   The quintic threefold in CP^4 defined by the Fermat quintic equation:
 *     z_1^5 + z_2^5 + z_3^5 + z_4^5 + z_5^5 - 5 * psi * (z_1 * z_2 * z_3 * z_4 * z_5) = 0
 * Projected into 3D via 2D complex tori cross sections:
 *   x = Re(z1) * cos(alpha) + Im(z1) * sin(alpha)
 *   y = Re(z2) * cos(beta)  + Im(z2) * sin(beta)
 *   z = Re(z1 * z2)
 * Features continuous complex phase rotation, dimensional shadow projection, and string flux lines.
 */






uniform float u_intensity = 1.0;        // Morph factor (default: 1.0)
uniform float u_psi_modulus = 1.0;      // Complex structure modulus parameter psi (0.0 to 2.0)
uniform float u_string_flux = 1.0;      // Magnetic flux line density
uniform float u_manifold_twist = 1.0;   // Hyper-dimensional rotation velocity
uniform float u_irid_shimmer = 1.0;     // Quantum vacuum polarization glow



// Complex arithmetic
vec2 cMul(vec2 a, vec2 b) {
    return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
}

// Distance estimator for Calabi-Yau 3D cross-section
float mapCalabiYau(vec3 p, out vec3 normalOut) {
    float psi = max(0.0, u_psi_modulus + 0.5 * sin(u_time * 0.3) * u_intensity);
    float tRot = u_time * 0.25 * u_manifold_twist;

    // Rotate coordinates in 3D
    float ca = cos(tRot), sa = sin(tRot);
    vec3 pos = p;
    pos.xz = mat2(vec2(ca, -sa), vec2(sa, ca)) * pos.xz;

    // Parameterize complex coordinates (z1, z2) on the 2-torus cross-section
    float u = pos.x * 1.5;
    float v = pos.y * 1.5;

    // 5th-power root branches (quintic threefold: z1^5 + z2^5 = 1)
    float nBranches = 5.0;
    float r1 = pow(abs(cos(u * 2.0)), 2.0 / nBranches);
    float r2 = pow(abs(sin(v * 2.0)), 2.0 / nBranches);

    // Height deformation in 3D representing real part of quintic hypersurface
    float h = (cos(u * nBranches) - sin(v * nBranches)) * 0.25 * (1.0 + 0.3 * psi);
    float d = abs(pos.z - h) - 0.04;

    // Outer boundary sphere
    float dBound = length(pos) - 2.2;
    d = max(d, dBound);

    normalOut = normalize(vec3(
        -sin(u * nBranches) * 1.25,
        -cos(v * nBranches) * 1.25,
        1.0
    ));

    return d;
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 p = (vUv - 0.5) * 2.0;
    p.x *= u_resolution.x / u_resolution.y;

    float tCam = u_time * 0.18;
    vec3 ro = vec3(cos(tCam) * 3.2, 1.2, sin(tCam) * 3.2);
    vec3 ta = vec3(0.0, 0.0, 0.0);
    vec3 ww = normalize(ta - ro);
    vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
    vec3 vv = normalize(cross(uu, ww));
    vec3 rd = normalize(p.x * uu + p.y * vv + 1.8 * ww);

    float t = 0.1;
    float maxDist = 10.0;
    float hit = 0.0;
    vec3 hitNorm = vec3(0.0);
    float glow = 0.0;

    for (int i = 0; i < 68; i++) {
        vec3 pos = ro + rd * t;
        vec3 norm;
        float d = mapCalabiYau(pos, norm);
        glow += exp(-max(d, 0.0) * 12.0) * 0.035;

        if (d < 0.002 * t) {
            hit = 1.0;
            hitNorm = norm;
            break;
        }
        t += d;
        if (t > maxDist) break;
    }

    vec3 col = vec3(0.01, 0.01, 0.02);

    if (hit > 0.5) {
        vec3 hitPos = ro + rd * t;
        vec3 lightDir = normalize(vec3(0.6, 0.8, 0.4));

        float diff = clamp(dot(hitNorm, lightDir), 0.0, 1.0);
        float spec = pow(clamp(dot(reflect(rd, hitNorm), lightDir), 0.0, 1.0), 32.0);

        // String theory D-brane iridescent tension coloring
        float nDotV = clamp(dot(-rd, hitNorm), 0.0, 1.0);
        vec3 braneCol = 0.5 + 0.5 * cos((1.0 - nDotV) * 10.0 + hitPos.z * 6.0 + vec3(0.0, 2.0, 4.0));

        // String flux lines (concentric isoparametric lines on manifold)
        float flux = sin(hitPos.x * u_string_flux * 8.0) * sin(hitPos.y * u_string_flux * 8.0);
        float fluxLine = smoothstep(0.8, 0.98, abs(flux));

        col = braneCol * (diff * 0.7 + 0.3) + vec3(spec * 0.7);
        col += vec3(0.2, 0.9, 1.0) * fluxLine * 0.6;

        col = mix(col, vec3(0.01, 0.01, 0.03), 1.0 - exp(-0.08 * t * t));
    }

    // Quantum Vacuum Polarization Shimmer
    vec3 vacuumGlow = vec3(0.7, 0.2, 1.0);
    col += vacuumGlow * glow * u_irid_shimmer * u_intensity;

    out_col = vec4(clamp(col, 0.0, 1.0), 1.0);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(vec2(UV.x, 1.0 - UV.y), col);
    COLOR = vec4(col.rgb, u_fade);
}
