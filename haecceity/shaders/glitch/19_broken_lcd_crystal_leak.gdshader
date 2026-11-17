shader_type canvas_item;
#include "visual_panel_sampling.gdshaderinc"
uniform sampler2D tDiffuse : hint_screen_texture, filter_linear_mipmap;
uniform sampler2D tPrevFrame : hint_screen_texture, filter_linear_mipmap;
uniform vec2 u_resolution = vec2(1920.0, 1080.0);
uniform float u_time = 0.0;
/*
 * GLITCH SUITE - SHADER 19: BROKEN LCD LIQUID CRYSTAL LEAK & GLASS FRACTURE
 * --------------------------------------------------------------------------
 * Models physical mechanical damage to a TFT / IPS liquid crystal display:
 *   - Glass substrate spiderweb fracture fissures with refractive offset
 *   - Nematic liquid crystal breach: black isotropic pool expanding outward
 *   - Capillary birefringence edge halos (rainbow chromatic polarization fringes)
 *   - Dead / stuck subpixel columns and rows originating from the impact site
 */






uniform float u_intensity = 1.0;        // Glitch intensity (default: 1.0)
uniform float u_impact_x = 0.5;         // Impact origin X in UV space (default: 0.5)
uniform float u_impact_y = 0.45;         // Impact origin Y in UV space (default: 0.45)
uniform float u_crack_density = 17.5;    // Glass fissure branching density (5.0 to 30.0)
uniform float u_fluid_radius = 0.275;     // Liquid crystal leak pool size (0.05 to 0.5)
uniform float u_dead_lines = 0.5;       // Stuck subpixel column frequency (0.0 to 1.0)

float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 uv = vUv;
    float amount = clamp(u_intensity, 0.0, 1.0);
    vec2 aspect = vec2(u_resolution.x / max(1.0, u_resolution.y), 1.0);
    vec2 delta = (uv - vec2(u_impact_x, u_impact_y)) * aspect;
    float radius = length(delta);
    float angle = atan(delta.y, delta.x);
    // Irregular capillary lobes, with a slow meniscus rather than a pulsating circular stamp.
    float lobes = .12 * sin(angle * 5.0 + .3 * sin(u_time * .13)) + .07 * sin(angle * 11.0 + 1.2) + .035 * sin(angle * 23.0);
    float boundary = max(.001, u_fluid_radius) * (.86 + lobes);
    float signedPool = radius - boundary;
    float pool = 1.0 - smoothstep(-.012, .008, signedPool);
    float halo = exp(-abs(signedPool) * 110.0);
    vec3 fringe = .5 + .5 * cos(signedPool * 390.0 + angle * 2.0 + vec3(0.0, 2.1, 4.2));
    // Sparse radial fractures get a different angle and branching at each sector.
    float sectors = max(5.0, floor(u_crack_density));
    float sector = floor((angle + 3.141593) / 6.283185 * sectors);
    float center = (sector + .25 + .5 * hash(vec2(sector, 3.0))) / sectors * 6.283185 - 3.141593;
    float crackD = abs(sin(angle - center + .025 * sin(radius * 47.0 + sector))) * radius;
    float crack = (1.0 - smoothstep(.0008, .003, crackD)) * (1.0 - smoothstep(.2, .85, radius));
    vec2 src = clamp(uv + delta / max(radius, .001) * crack * .009 * amount / aspect, 0.0, 1.0);
    vec3 col = sample_visual_panel(tDiffuse, src).rgb;
    col += crack * vec3(.30, .38, .42) * amount;
    float column = floor(uv.x * u_resolution.x);
    float dead = step(.997 - .009 * u_dead_lines, hash(vec2(column, 17.0))) * (1.0 - smoothstep(.08, .4, abs(delta.x)));
    vec3 subpixel = .5 + .5 * cos(column * 2.094 + vec3(0.0, 2.094, 4.188));
    col = mix(col, subpixel * .65, dead * amount * step(0.0, delta.y));
    col = mix(col, fringe * .75, halo * .8 * amount);
    col = mix(col, vec3(.003, .004, .008) + fringe * .012, pool * amount);
    out_col = vec4(clamp(col, 0.0, 1.0), 1.0);
}

void fragment() {
    vec4 col;
    mainImage(UV, col);
    COLOR = col;
}
