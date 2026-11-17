shader_type canvas_item;
#include "visual_panel_sampling.gdshaderinc"
#include "kinetic_moves.gdshaderinc"
uniform sampler2D tDiffuse : hint_screen_texture, filter_linear_mipmap;
uniform vec2 u_resolution = vec2(1920.0, 1080.0);
uniform float u_time = 0.0;
/*
 * GLITCH SUITE - SHADER 38: CRYSTAL GLASS & CAUCHY DISPERSION
 * ------------------------------------------------------------
 * Simulates faceted optical crystals, gem refraction, and chromatic
 * dispersion (film prism / glass dispersion).
 * High frequencies (u_rGlow) ignite internal facet sparkle reflections,
 * while melodic drift (u_rRipple) steers the internal refraction vector.
 */

uniform float u_intensity = 1.0;       // Blend of crystal prism over source (default: 1.0)
uniform float u_facet_scale = 14.0;    // Geometric crystal facet scale (default: 14.0)
uniform float u_refraction = 0.04;     // Optical refraction displacement (default: 0.04)
uniform float u_dispersion = 0.025;    // Cauchy chromatic wavelength splitting (default: 0.025)
uniform float u_sparkle = 0.50;        // Internal facet reflection flare (default: 0.50)
uniform float u_facet_edges = 0.40;    // Beveled crystal edge brilliance (default: 0.40)

vec2 hash22(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(443.897, 441.423, 437.195));
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.xx + p3.yz) * p3.zy);
}

// 2D Voronoi facet cells returning distance to center and facet normal vector
vec3 voronoi_facets(vec2 p) {
    vec2 n = floor(p);
    vec2 f = fract(p);

    vec2 mg, mr;
    float md = 8.0;
    for (int j = -1; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
            vec2 g = vec2(float(i), float(j));
            vec2 o = hash22(n + g);
            vec2 r = g + o - f;
            float d = dot(r, r);
            if (d < md) {
                md = d;
                mr = r;
                mg = g;
            }
        }
    }

    // Secondary pass for distance to facet border
    float md2 = 8.0;
    for (int j = -2; j <= 2; j++) {
        for (int i = -2; i <= 2; i++) {
            vec2 g = mg + vec2(float(i), float(j));
            vec2 o = hash22(n + g);
            vec2 r = g + o - f;
            if (dot(mr - r, mr - r) > 0.00001) {
                md2 = min(md2, dot(0.5 * (mr + r), normalize(r - mr)));
            }
        }
    }

    vec2 normal = normalize(mr + vec2(1e-5));
    return vec3(normal, md2);
}

// Cauchy 3-band spectral dispersion
vec3 sample_dispersed(vec2 uv, vec2 dir, float disp_amount) {
    vec2 off_r = dir * disp_amount;
    vec2 off_g = vec2(0.0);
    vec2 off_b = -dir * disp_amount;

    float r = sample_visual_panel(tDiffuse, clamp(uv + off_r, 0.0, 1.0)).r;
    float g = sample_visual_panel(tDiffuse, clamp(uv + off_g, 0.0, 1.0)).g;
    float b = sample_visual_panel(tDiffuse, clamp(uv + off_b, 0.0, 1.0)).b;
    return vec3(r, g, b);
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec4 src = sample_visual_panel(tDiffuse, vUv);
    vec2 aspect_uv = vUv * vec2(u_resolution.x / u_resolution.y, 1.0);

    // Dynamic rotation of crystal grid with melodic ripple
    float angle = u_rRipple * 0.4 + u_time * 0.05;
    mat2 rot_mat = mat2(vec2(cos(angle), -sin(angle)), vec2(sin(angle), cos(angle)));
    vec2 facet_p = rot_mat * (aspect_uv * max(u_facet_scale, 2.0));

    vec3 facet = voronoi_facets(facet_p);
    vec2 normal = facet.xy;
    float dist_to_edge = facet.z;

    // Refraction vector
    vec2 refr_offset = normal * (u_refraction + u_rPulse * 0.02);
    vec2 refr_uv = vUv + refr_offset;

    // Cauchy chromatic dispersion along facet normals
    float disp_power = u_dispersion * (1.0 + u_rSwell * 0.5);
    vec3 dispersed = sample_dispersed(refr_uv, normal, disp_power);

    // Beveled facet edge brilliance
    float edge_line = smoothstep(0.08, 0.0, dist_to_edge) * u_facet_edges;
    vec3 edge_col = vec3(1.0, 0.95, 0.85) * edge_line * (1.0 + u_rGlow * 1.5);

    // Internal sparkle reflection
    float sparkle_dot = max(0.0, dot(normal, vec2(0.7071, 0.7071)));
    float sparkle = pow(sparkle_dot, 8.0) * (u_sparkle + u_rGlow * 0.8);
    vec3 sparkle_col = vec3(0.9, 0.95, 1.0) * sparkle;

    vec3 final_rgb = dispersed + edge_col + sparkle_col;
    out_col = vec4(mix(src.rgb, final_rgb, clamp(u_intensity, 0.0, 1.0)), src.a);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(UV, col);
    COLOR = col;
}
