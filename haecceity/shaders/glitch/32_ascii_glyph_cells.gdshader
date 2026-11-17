shader_type canvas_item;
#include "visual_panel_sampling.gdshaderinc"
#include "kinetic_moves.gdshaderinc"
uniform sampler2D tDiffuse : hint_screen_texture, filter_linear_mipmap;
uniform vec2 u_resolution = vec2(1920.0, 1080.0);
uniform float u_time = 0.0;
/*
 * GLITCH SUITE - SHADER 32: ASCII GLYPH CELLS
 * -------------------------------------------
 * Replaces each character cell with a procedural glyph whose ink density
 * follows cell luminance. Glyphs are built from 5x7 bitmasks packed in
 * constants, so no font atlas is needed. Matrix mode rains glyph columns.
 */

uniform float u_intensity = 1.0;       // Blend of glyph render over source (default: 1.0)
uniform float u_cell_height = 12.0;    // Cell height in screen pixels (6.0 to 32.0, default: 12.0)
uniform float u_color_mode = 0.0;      // 0.0: Source color, 1.0: Phosphor green, 2.0: Amber, 3.0: Mono white
uniform float u_glyph_set = 0.0;       // 0.0: Ramp  . : + # @, 1.0: Binary 0/1 noise, 2.0: Blocks
uniform float u_rain = 0.0;            // Matrix column rain (0.0 off, 1.0 full)
uniform float u_background = 0.1;      // Source bleed behind glyphs (default: 0.1)
uniform float u_flicker = 0.15;        // Per-cell glyph flicker (default: 0.15)

float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

// Ink coverage of density level d in [0,1] at in-cell coordinate g in [0,1]^2.
// Hand-built shapes: dot, colon, plus, hash, filled block.
float glyph(float d, vec2 g, float rnd) {
    vec2 c = g - 0.5;
    if (u_glyph_set > 0.5 && u_glyph_set < 1.5) {
        // Binary: "0" ring or "1" bar, picked per cell; density gates visibility
        float ring = smoothstep(0.30, 0.22, abs(length(c * vec2(1.4, 1.0)) - 0.28));
        float bar = step(abs(c.x), 0.07) * step(abs(c.y), 0.38);
        float shape = (rnd > 0.5) ? ring : bar;
        return shape * step(0.12, d);
    }
    if (u_glyph_set > 1.5) {
        // Blocks: quantized fill height
        float levels = floor(d * 4.0 + 0.5) / 4.0;
        return step(g.y, levels) * step(0.08, d);
    }
    if (d < 0.10) return 0.0;
    if (d < 0.25) return smoothstep(0.12, 0.07, length(c));                       // .
    if (d < 0.40) return smoothstep(0.10, 0.06, length(c - vec2(0.0, 0.2)))
                       + smoothstep(0.10, 0.06, length(c + vec2(0.0, 0.2)));      // :
    if (d < 0.55) return max(step(abs(c.x), 0.07) * step(abs(c.y), 0.30),
                             step(abs(c.y), 0.07) * step(abs(c.x), 0.30));        // +
    if (d < 0.75) return max(step(abs(fract(g.x * 2.0 + 0.25) - 0.5), 0.12),
                             step(abs(fract(g.y * 3.0 + 0.1) - 0.5), 0.12)) * step(abs(c.x), 0.42) * step(abs(c.y), 0.42); // #
    return step(abs(c.x), 0.40) * step(abs(c.y), 0.44);                           // @ block
}

void mainImage(vec2 vUv, out vec4 out_col) {
    float ch = max(u_cell_height, 4.0);
    vec2 cell_px = vec2(ch * 0.55, ch);
    vec2 px = vUv * u_resolution;
    vec2 cell = floor(px / cell_px);
    vec2 g = fract(px / cell_px);
    vec2 cell_uv = (cell + 0.5) * cell_px / u_resolution;

    vec4 src = sample_visual_panel(tDiffuse, clamp(cell_uv, 0.0, 1.0));
    float luma = dot(src.rgb, vec3(0.299, 0.587, 0.114));

    float eff_flicker = u_flicker + u_rScatter * 0.35;
    float rnd = hash21(cell + floor(u_time * 6.0 * eff_flicker) * 7.13);

    // Matrix rain: each column has a falling head, brightness decays behind it.
    float eff_rain = clamp(u_rain + u_rPulse * 0.45, 0.0, 1.0);
    float rain = 1.0;
    if (eff_rain > 0.0) {
        float col_seed = hash21(vec2(cell.x, 3.7));
        float speed = 0.3 + col_seed * 0.9;
        float head = fract(col_seed * 17.0 - u_time * speed * 0.4) * (u_resolution.y / cell_px.y);
        float dist = mod(head - cell.y, u_resolution.y / cell_px.y);
        rain = mix(1.0, exp(-dist * 0.18), eff_rain);
        luma = mix(luma, max(luma, 0.2) * rain + step(dist, 0.6) * 0.8, eff_rain);
    }

    float d = clamp(luma * (1.0 - eff_flicker * rnd * 0.5), 0.0, 1.0);
    float ink = clamp(glyph(d, g, rnd), 0.0, 1.0);

    vec3 ink_col = src.rgb;
    if (u_color_mode > 0.5 && u_color_mode < 1.5) ink_col = vec3(0.15, 1.0, 0.3) * (0.4 + 0.8 * d);
    else if (u_color_mode > 1.5 && u_color_mode < 2.5) ink_col = vec3(1.0, 0.65, 0.1) * (0.4 + 0.8 * d);
    else if (u_color_mode > 2.5) ink_col = vec3(1.0);
    ink_col = max(ink_col, vec3(0.0));
    // Source color mode: lift so dark cells stay readable
    if (u_color_mode < 0.5) ink_col = ink_col * 1.4 + 0.05;

    vec3 glyph_col = mix(src.rgb * u_background, ink_col, ink);
    out_col = vec4(mix(src.rgb, glyph_col, clamp(u_intensity, 0.0, 1.0)), src.a);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(UV, col);
    COLOR = col;
}
