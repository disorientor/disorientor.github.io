shader_type canvas_item;
uniform float u_fade = 1.0;
uniform sampler2D tDiffuse : hint_default_black;
uniform sampler2D tPrevFrame : hint_default_black;
uniform vec2 u_resolution = vec2(1060.0, 550.0);
uniform float u_time = 0.0;
/*
 * FRACTAL REALMS - SHADER F05: 4D QUATERNION JULIA HYPERSCULPTURE
 * -----------------------------------------------------------------
 * Raymarched 3D cross-section slice of a 4-dimensional Quaternion Julia set:
 *   q = (x, y, z, w) in H
 *   q' = q^2 + C
 * Quaternion multiplication:
 *   q^2 = (x^2 - y^2 - z^2 - w^2, 2*x*y, 2*x*z, 2*x*w)
 * By rotating the 4D slicing hyperplane through hyper-angles (zw, xw, yw planes),
 * the 3D cross section morphs continuously through organic, impossible extraterrestrial geometries.
 */






uniform float u_intensity = 1.0;        // 4D slice morph amplitude (default: 1.0)
uniform float u_c_real = -0.13;           // C real component (-1.5 to 1.5, default: -0.13)
uniform float u_c_i = 0.74;              // C i component (-1.5 to 1.5, default: 0.74)
uniform float u_c_j = 0.22;              // C j component (-1.5 to 1.5, default: 0.22)
uniform float u_c_k = -0.38;              // C k component (-1.5 to 1.5, default: -0.38)
uniform float u_slice_w = 0.0;          // 4th-dimensional W-coordinate slice position (-1.0 to 1.0, default: 0.0)
uniform float u_hyper_rot_speed = 0.8;  // 4D rotation velocity (0.1 to 2.0, default: 0.8)
uniform float u_specular_gloss = 1.2;   // Glossy sheen on bio-organic surfaces (0.5 to 2.5, default: 1.2)



// Quaternion square
vec4 qSquare(vec4 q) {
    return vec4(
        q.x * q.x - dot(q.yzw, q.yzw),
        2.0 * q.x * q.yzw
    );
}

// Distance estimator for 4D Quaternion Julia
float mapQJulia(vec3 pos, out vec4 trap) {
    // 4D rotation of the evaluation coordinate
    float a1 = u_time * 0.25 * max(0.1, u_hyper_rot_speed);
    float a2 = u_time * 0.18 * max(0.1, u_hyper_rot_speed);
    float wVal = u_slice_w + 0.25 * sin(u_time * 0.35) * u_intensity;

    vec4 z = vec4(pos, wVal);

    // 4D Givens rotations (X-W and Y-Z plane rotations)
    float cos1 = cos(a1), sin1 = sin(a1);
    float cos2 = cos(a2), sin2 = sin(a2);
    z.xw = vec2(z.x * cos1 - z.w * sin1, z.x * sin1 + z.w * cos1);
    z.yz = vec2(z.y * cos2 - z.z * sin2, z.y * sin2 + z.z * cos2);

    float cr = (abs(u_c_real) > 0.001) ? u_c_real : -0.13;
    float ci = (abs(u_c_i) > 0.001) ? u_c_i : 0.74;
    float cj = (abs(u_c_j) > 0.001) ? u_c_j : 0.22;
    float ck = (abs(u_c_k) > 0.001) ? u_c_k : -0.38;
    vec4 c = vec4(cr, ci, cj, ck);
    c += vec4(sin(u_time * 0.2) * 0.05, 0.0, cos(u_time * 0.15) * 0.05, 0.0) * u_intensity;

    vec4 minTrap = vec4(1e5);
    float dz2 = 1.0;
    float r2 = 0.0;

    for (int i = 0; i < 11; i++) {
        dz2 *= 4.0 * max(dot(z, z), 1e-4);
        z = qSquare(z) + c;
        r2 = dot(z, z);

        minTrap = min(minTrap, abs(z));
        if (r2 > 5.0) break;
    }

    trap = minTrap;
    if (r2 <= 1.0) return 0.0005;
    return max(0.5 * sqrt(r2 / max(dz2, 1e-6)) * log(max(r2, 1.0001)), 0.0005);
}

vec3 calcNormal(vec3 p) {
    vec4 dummy;
    float eps = 0.002;
    vec2 e = vec2(1.0, -1.0) * eps;
    return normalize(
        e.xyy * mapQJulia(p + e.xyy, dummy) +
        e.yyx * mapQJulia(p + e.yyx, dummy) +
        e.yxy * mapQJulia(p + e.yxy, dummy) +
        e.xxx * mapQJulia(p + e.xxx, dummy)
    );
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 p = (vUv - 0.5) * 2.0;
    p.x *= u_resolution.x / u_resolution.y;

    float camRot = u_time * 0.15;
    vec3 ro = vec3(cos(camRot) * 2.5, 0.6 * sin(camRot * 0.8), sin(camRot) * 2.5);
    vec3 ta = vec3(0.0, 0.0, 0.0);
    vec3 ww = normalize(ta - ro);
    vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
    vec3 vv = normalize(cross(uu, ww));
    vec3 rd = normalize(p.x * uu + p.y * vv + 1.8 * ww);

    float t = 0.05;
    float maxDist = 8.0;
    float hit = 0.0;
    vec4 bestTrap = vec4(0.0);
    float glow = 0.0;

    for (int i = 0; i < 68; i++) {
        vec3 pos = ro + rd * t;
        vec4 trap;
        float d = mapQJulia(pos, trap);
        glow += exp(-d * 14.0) * 0.035;

        if (d < 0.002 * t) {
            hit = 1.0;
            bestTrap = trap;
            break;
        }
        t += max(d, 0.002);
        if (t > maxDist) break;
    }

    vec3 col = vec3(0.015, 0.01, 0.025);

    if (hit > 0.5) {
        vec3 hitPos = ro + rd * t;
        vec3 norm = calcNormal(hitPos);
        vec3 lightDir = normalize(vec3(0.6, 0.8, 0.4));
        vec3 ref = reflect(rd, norm);

        float diff = clamp(dot(norm, lightDir), 0.0, 1.0);
        float spec = pow(clamp(dot(ref, lightDir), 0.0, 1.0), 32.0 * max(0.5, u_specular_gloss));

        // Subsurface scattering & iridescent bio-luminescence
        float rim = 1.0 - clamp(dot(-rd, norm), 0.0, 1.0);
        vec3 bioSkin = mix(vec3(0.9, 0.15, 0.45), vec3(0.2, 0.85, 0.95), bestTrap.y * 3.0);
        vec3 rimCol = mix(vec3(1.0, 0.8, 0.3), vec3(0.6, 0.1, 1.0), rim);

        col = bioSkin * (diff * 0.7 + 0.3) + rimCol * pow(rim, 3.0) * 0.8 + vec3(spec * 0.7);

        col = mix(col, vec3(0.01, 0.01, 0.03), 1.0 - exp(-0.1 * t * t));
    }

    // 4D hyperdimensional halo
    vec3 hyperGlow = vec3(0.7, 0.1, 1.0);
    col += hyperGlow * glow * 1.3 * u_intensity;

    out_col = vec4(clamp(col, 0.0, 1.0), 1.0);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(vec2(UV.x, 1.0 - UV.y), col);
    COLOR = vec4(col.rgb, u_fade);
}
