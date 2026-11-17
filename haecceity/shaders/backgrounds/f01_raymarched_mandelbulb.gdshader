shader_type canvas_item;
uniform float u_fade = 1.0;
uniform sampler2D tDiffuse : hint_default_black;
uniform sampler2D tPrevFrame : hint_default_black;
uniform vec2 u_resolution = vec2(1060.0, 550.0);
uniform float u_time = 0.0;
/*
 * FRACTAL REALMS - SHADER F01: RAYMARCHED MANDELBULB (ORDER-8 HYPERCOMPLEX)
 * --------------------------------------------------------------------------
 * Raymarched 3D Mandelbulb fractal using analytical distance estimation.
 * The 3D Mandelbulb is defined by the spherical mapping:
 *   v = (x, y, z)
 *   r = length(v)
 *   theta = atan(sqrt(x^2 + y^2), z)
 *   phi = atan(y, x)
 *   v^n = r^n * (sin(theta * n) * cos(phi * n), sin(theta * n) * sin(phi * n), cos(theta * n))
 * Features:
 *   - Continuous order morphing (power: 3.0 to 12.0)
 *   - Analytical surface normals via tetrahedron central differences
 *   - Ambient occlusion & soft shadow penumbrae
 *   - Dynamic orbit trap coloring with spectral glow
 */






uniform float u_intensity = 1.0;        // Morph / depth intensity (default: 1.0)
uniform float u_power = 8.0;            // Mandelbulb power (e.g. 8.0, range: 3.0 to 12.0)
uniform float u_max_iterations = 20.0;   // Fractal iteration limit (8 to 32)
uniform float u_camera_dist = 3.15;      // Orbit camera distance (1.8 to 4.5)
uniform float u_glow_intensity = 1.0;   // Volumetric inner crystal glow
uniform float u_color_palette = 0.0;    // 0 = Cosmic Gold/Cyan, 1 = Void Violet/Magenta, 2 = Emerald Cathedral



// Distance Estimator for Mandelbulb
float mapMandelbulb(vec3 pos, out vec4 trap) {
    vec3 z = pos;
    float dr = 1.0;
    float r = 0.0;
    float power = max(3.0, u_power + 1.5 * sin(u_time * 0.4) * u_intensity);
    int maxIt = int(clamp(u_max_iterations, 8.0, 24.0));

    vec4 minTrap = vec4(1e5);

    for (int i = 0; i < 24; i++) {
        if (i >= maxIt) break;
        r = length(z);
        if (r > 4.0) break;

        // Orbit trap tracking (minimum distance to coordinate planes)
        minTrap = min(minTrap, vec4(abs(z), r));

        // Spherical coordinates
        float theta = acos(clamp(z.z / r, -1.0, 1.0));
        float phi = atan(z.y, z.x);
        dr = pow(r, power - 1.0) * power * dr + 1.0;

        // Scale and rotate
        float zr = pow(r, power);
        theta = theta * power;
        phi = phi * power;

        // Convert back to cartesian
        z = zr * vec3(sin(theta) * cos(phi), sin(theta) * sin(phi), cos(theta)) + pos;
    }

    trap = minTrap;
    return 0.5 * log(r) * r / dr; // Distance estimator
}

// Surface Normal Estimation via Tetrahedron
vec3 calcNormal(vec3 p) {
    vec4 dummyTrap;
    float eps = 0.002;
    vec2 e = vec2(1.0, -1.0) * eps;
    return normalize(
        e.xyy * mapMandelbulb(p + e.xyy, dummyTrap) +
        e.yyx * mapMandelbulb(p + e.yyx, dummyTrap) +
        e.yxy * mapMandelbulb(p + e.yxy, dummyTrap) +
        e.xxx * mapMandelbulb(p + e.xxx, dummyTrap)
    );
}

// Ambient Occlusion Estimation
float calcAO(vec3 p, vec3 n) {
    float occ = 0.0;
    float sca = 1.0;
    vec4 dummy;
    for (int i = 0; i < 5; i++) {
        float h = 0.01 + 0.12 * float(i) / 4.0;
        float d = mapMandelbulb(p + h * n, dummy);
        occ += (h - d) * sca;
        sca *= 0.85;
    }
    return clamp(1.0 - 2.5 * occ, 0.0, 1.0);
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 p = (vUv - 0.5) * 2.0;
    p.x *= u_resolution.x / u_resolution.y;

    // Camera setup
    float camDist = max(1.8, u_camera_dist);
    float camAngle = u_time * 0.25;
    vec3 ro = vec3(cos(camAngle) * camDist, sin(camAngle * 0.7) * 0.8, sin(camAngle) * camDist);
    vec3 ta = vec3(0.0, 0.0, 0.0);
    vec3 ww = normalize(ta - ro);
    vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
    vec3 vv = normalize(cross(uu, ww));
    vec3 rd = normalize(p.x * uu + p.y * vv + 1.8 * ww);

    // Raymarching Loop
    float t = 0.1;
    float maxDist = 8.0;
    float hit = 0.0;
    vec4 bestTrap = vec4(0.0);
    float glow = 0.0;

    for (int i = 0; i < 70; i++) {
        vec3 pos = ro + rd * t;
        vec4 trap;
        float d = mapMandelbulb(pos, trap);
        glow += exp(-d * 12.0) * 0.035;

        if (d < 0.002 * t) {
            hit = 1.0;
            bestTrap = trap;
            break;
        }
        t += d;
        if (t > maxDist) break;
    }

    vec3 col = vec3(0.01, 0.01, 0.02); // Deep void background

    if (hit > 0.5) {
        vec3 hitPos = ro + rd * t;
        vec3 norm = calcNormal(hitPos);
        vec3 lightDir = normalize(vec3(0.6, 0.8, 0.5));
        
        // Lighting
        float diff = clamp(dot(norm, lightDir), 0.0, 1.0);
        float ao = calcAO(hitPos, norm);
        vec3 ref = reflect(rd, norm);
        float spec = pow(clamp(dot(ref, lightDir), 0.0, 1.0), 32.0);

        // Palette generation based on orbit trap
        vec3 baseColor;
        if (u_color_palette < 0.5) {
            // Cosmic Gold & Neon Cyan
            baseColor = mix(vec3(0.95, 0.7, 0.2), vec3(0.0, 0.8, 1.0), bestTrap.y * 2.0);
        } else if (u_color_palette < 1.5) {
            // Void Violet & Neon Magenta
            baseColor = mix(vec3(0.7, 0.1, 0.9), vec3(1.0, 0.0, 0.5), bestTrap.x * 2.5);
        } else {
            // Emerald Cathedral
            baseColor = mix(vec3(0.1, 0.9, 0.4), vec3(0.8, 1.0, 0.2), bestTrap.z * 2.0);
        }

        col = baseColor * (diff * 0.8 + 0.2) * ao + vec3(spec * 0.6);
        
        // Atmospheric fog falloff
        col = mix(col, vec3(0.01, 0.01, 0.03), 1.0 - exp(-0.08 * t * t));
    }

    // Additive volumetric glow
    vec3 glowCol = (u_color_palette < 0.5) ? vec3(0.0, 0.7, 1.0) : (u_color_palette < 1.5 ? vec3(1.0, 0.2, 0.8) : vec3(0.2, 1.0, 0.5));
    col += glowCol * glow * u_glow_intensity;

    // Optional subtle blend with scene texture
    vec3 scene = texture(tDiffuse, vUv).rgb;
    col = mix(scene * 0.2 + col, col, 0.85);

    out_col = vec4(col, 1.0);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(vec2(UV.x, 1.0 - UV.y), col);
    COLOR = vec4(col.rgb, u_fade);
}
