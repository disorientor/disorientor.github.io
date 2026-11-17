shader_type canvas_item;
#include "visual_panel_sampling.gdshaderinc"
#include "kinetic_moves.gdshaderinc"
uniform sampler2D tDiffuse : hint_screen_texture, filter_linear_mipmap;
uniform vec2 u_resolution = vec2(1920.0, 1080.0);
uniform float u_time = 0.0;
/*
 * GLITCH SUITE - SHADER 39: KINETIC TYPOGRAPHY & WORD MOSAIC
 * ----------------------------------------------------------
 * Features Native kinetic typography motion engines:
 *  - Mode 0 (Orbit): Concentric rings of typography circulating 3D sculptures.
 *  - Mode 1 (Slit): Horizontal typographic ribbon strips slipping in opposing directions.
 *  - Mode 2 (Shatter): Words fracture along diagonal stress faults on drum impacts.
 *  - Mode 3 (Flap): Mechanical split-flap departure board stepping on tempo clocks.
 *  - Mode 4 (Word Mosaic): Luminance-mapped cellular word density raster.
 */

uniform float u_intensity = 1.0;       // Blend of kinetic type over source (default: 1.0)
uniform float u_mode = 0.0;            // 0.0: Orbit, 1.0: Slit Bands, 2.0: Shatter Faults, 3.0: Split-Flap, 4.0: Word Mosaic
uniform float u_scale = 16.0;          // Typographic cell / band scale in pixels (default: 16.0)
uniform float u_speed = 1.0;           // Motion velocity (default: 1.0)
uniform float u_ink_color = 0.0;       // 0.0: Phosphor White, 1.0: Neon Cyan, 2.0: Cyber Amber, 3.0: High-Contrast Invert
uniform float u_bleed = 0.25;          // Background scene bleed behind typography (default: 0.25)

float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

// Procedural 5x7 vector glyph renderer (Numbers, uppercase glyphs, punctuation)
float render_char(vec2 g, float char_id) {
    vec2 c = g - 0.5;
    float bound = max(abs(c.x), abs(c.y));
    if (bound > 0.46) return 0.0;

    int id = int(mod(char_id, 12.0));
    float shape = 0.0;

    if (id == 0) {
        // "O"
        shape = smoothstep(0.36, 0.28, abs(length(c * vec2(1.2, 1.0)) - 0.28));
    } else if (id == 1) {
        // "I" / vertical bar
        shape = step(abs(c.x), 0.08) * step(abs(c.y), 0.38);
    } else if (id == 2) {
        // "+" / cross
        shape = max(step(abs(c.x), 0.08) * step(abs(c.y), 0.35),
                    step(abs(c.y), 0.08) * step(abs(c.x), 0.35));
    } else if (id == 3) {
        // "X"
        float d1 = abs(c.x - c.y) * 0.7071;
        float d2 = abs(c.x + c.y) * 0.7071;
        shape = max(step(d1, 0.09), step(d2, 0.09));
    } else if (id == 4) {
        // "="
        shape = max(step(abs(c.y - 0.15), 0.07), step(abs(c.y + 0.15), 0.07)) * step(abs(c.x), 0.35);
    } else if (id == 5) {
        // "T"
        float stem = step(abs(c.x), 0.08) * step(abs(c.y), 0.38);
        float bar = step(abs(c.y - 0.30), 0.07) * step(abs(c.x), 0.35);
        shape = max(stem, bar);
    } else if (id == 6) {
        // "H"
        float s1 = step(abs(c.x - 0.25), 0.07) * step(abs(c.y), 0.38);
        float s2 = step(abs(c.x + 0.25), 0.07) * step(abs(c.y), 0.38);
        float bar = step(abs(c.y), 0.07) * step(abs(c.x), 0.25);
        shape = max(max(s1, s2), bar);
    } else if (id == 7) {
        // "L"
        float stem = step(abs(c.x + 0.20), 0.07) * step(abs(c.y), 0.38);
        float base = step(abs(c.y + 0.30), 0.07) * step(abs(c.x - 0.05), 0.25);
        shape = max(stem, base);
    } else {
        // Box / Block
        shape = step(abs(c.x), 0.38) * step(abs(c.y), 0.38);
    }

    return shape;
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 px = vUv * u_resolution;
    vec4 src = sample_visual_panel(tDiffuse, vUv);
    float luma = dot(src.rgb, vec3(0.299, 0.587, 0.114));

    float ink = 0.0;
    vec2 center = u_resolution * 0.5;
    vec2 to_center = px - center;
    float dist = length(to_center);
    float angle = atan(to_center.y, to_center.x);

    float effective_scale = max(u_scale, 8.0);

    if (u_mode < 0.5) {
        // MODE 0: ORBIT (Nested concentric circular text tracks)
        float track_spacing = effective_scale * 1.5;
        float track_idx = floor(dist / track_spacing);
        float track_rad = (track_idx + 0.5) * track_spacing;
        float circum = 6.28318 * track_rad;

        // Alternating orbital spin speeds
        float dir = mod(track_idx, 2.0) > 0.5 ? 1.0 : -1.0;
        float spin = (u_time * u_speed * 0.8 + u_rRipple * 2.0) * dir;
        float char_dist = (angle + spin) * track_rad;
        float char_idx = floor(char_dist / effective_scale);

        vec2 local = vec2(
            fract(char_dist / effective_scale),
            fract((dist - track_idx * track_spacing) / track_spacing)
        );

        float char_id = hash21(vec2(track_idx, char_idx)) * 12.0;
        ink = render_char(local, char_id);
    } else if (u_mode < 1.5) {
        // MODE 1: SLIT (Slipping horizontal bands of typography)
        float band_h = effective_scale * 1.4;
        float band_idx = floor(px.y / band_h);
        float dir = mod(band_idx, 2.0) > 0.5 ? 1.0 : -1.0;
        float shift = (u_time * u_speed * 60.0 + u_rPulse * 30.0) * dir;

        vec2 shifted_px = vec2(px.x + shift, px.y);
        vec2 cell = floor(shifted_px / effective_scale);
        vec2 local = fract(shifted_px / effective_scale);

        float char_id = hash21(cell) * 12.0;
        ink = render_char(local, char_id);
    } else if (u_mode < 2.5) {
        // MODE 2: SHATTER (Words fracture along angled fault lines)
        vec2 fault_dir = normalize(vec2(1.0, 0.6));
        float fault_proj = dot(px, fault_dir);
        float fault_band = floor(fault_proj / (effective_scale * 4.0));
        float displace = (hash21(vec2(fault_band, 7.1)) - 0.5) * u_rPulse * 40.0;

        vec2 shattered_px = px + fault_dir * displace;
        vec2 cell = floor(shattered_px / effective_scale);
        vec2 local = fract(shattered_px / effective_scale);

        float char_id = hash21(cell) * 12.0;
        ink = render_char(local, char_id);
    } else if (u_mode < 3.5) {
        // MODE 3: SPLIT-FLAP (Departure board cells rotating on beat)
        vec2 cell = floor(px / effective_scale);
        vec2 local = fract(px / effective_scale);

        // Flap split line
        float split_line = step(abs(local.y - 0.5), 0.04);
        float flap_step = floor(u_time * 4.0 * u_speed + u_rPulse * 2.0);
        float char_id = hash21(cell + vec2(flap_step, 0.0)) * 12.0;

        ink = render_char(local, char_id) * (1.0 - split_line);
    } else {
        // MODE 4: WORD MOSAIC (Luminance density maps to glyph complexity)
        vec2 cell = floor(px / effective_scale);
        vec2 local = fract(px / effective_scale);
        vec2 cell_uv = (cell + 0.5) * effective_scale / u_resolution;
        float cell_luma = dot(sample_visual_panel(tDiffuse, clamp(cell_uv, 0.0, 1.0)).rgb, vec3(0.299, 0.587, 0.114));

        float char_id = floor(cell_luma * 11.0);
        ink = render_char(local, char_id);
    }

    // Color Styles
    vec3 type_color = vec3(1.0);
    if (u_ink_color > 0.5 && u_ink_color < 1.5) {
        type_color = vec3(0.0, 0.9, 1.0); // Neon Cyan
    } else if (u_ink_color > 1.5 && u_ink_color < 2.5) {
        type_color = vec3(1.0, 0.7, 0.15); // Cyber Amber
    } else if (u_ink_color > 2.5) {
        type_color = 1.0 - src.rgb; // High-Contrast Invert
    }

    vec3 composite = mix(src.rgb * u_bleed, type_color, ink);
    out_col = vec4(mix(src.rgb, composite, clamp(u_intensity, 0.0, 1.0)), src.a);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(UV, col);
    COLOR = col;
}
