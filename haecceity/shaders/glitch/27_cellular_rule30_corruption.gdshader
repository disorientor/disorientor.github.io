shader_type canvas_item;
#include "visual_panel_sampling.gdshaderinc"
uniform sampler2D tDiffuse : hint_screen_texture, filter_linear_mipmap;
uniform sampler2D tPrevFrame : hint_screen_texture, filter_linear_mipmap;
uniform vec2 u_resolution = vec2(1920.0, 1080.0);
uniform float u_time = 0.0;
/*
 * GLITCH SUITE - SHADER 27: WOLFRAM RULE 30 CELLULAR AUTOMATA CORRUPTION
 * ------------------------------------------------------------------------
 * Emulates algorithmic hardware state corruption driven by Stephen Wolfram's
 * elementary cellular automata (Rule 30, Rule 90, and Rule 110):
 *   - Rule 30: p' = p_left XOR (p_center OR p_right) - famous for Class 3 chaotic behavior.
 *   - The cellular automaton state evolves line-by-line downward across the screen,
 *     forming organic triangular fractal Sierpinski webs that carve into the framebuffer.
 *   - Corrupted cells bitwise XOR or mask active RGB color channels.
 */






uniform float u_intensity = 1.0;        // Glitch intensity (default: 1.0)
uniform float u_cell_size = 9.0;        // Automaton grid pixel size (2.0 to 16.0 px)
uniform float u_rule_type = 0.0;        // 0.0 = Rule 30 (Chaos), 1.0 = Rule 90 (Sierpinski), 2.0 = Rule 110 (Turing complete)
uniform float u_decay_blend = 0.5;      // Blending weight into RGB frame (0.0 to 1.0)

// Evolve an actual 32-cell periodic register. Each fragment evaluates the same row.
float evaluateCA(vec2 cell) {
    uint state = uint(65536);
    int generation = int(mod(cell.y + floor(u_time * 5.0), 32.0));
    for (int i = 0; i < 32; i++) {
        if (i >= generation) break;
        uint left = (state << uint(1)) | (state >> uint(31));
        uint right = (state >> uint(1)) | (state << uint(31));
        if (u_rule_type < .5) state = left ^ (state | right);
        else if (u_rule_type < 1.5) state = left ^ right;
        else state = (state | right) ^ (left & state & right);
    }
    return float((state >> uint(int(mod(cell.x, 32.0)))) & uint(1));
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 uv = vUv;
    float amount = clamp(u_intensity, 0.0, 1.0);
    float size = max(2.0, u_cell_size);
    vec2 cell = floor(uv * u_resolution / size);
    float active = evaluateCA(cell);
    vec3 base = sample_visual_panel(tDiffuse, uv).rgb;
    vec2 src = clamp(uv + vec2((active - .5) * .018 * amount, 0.0), 0.0, 1.0);
    vec3 col = sample_visual_panel(tDiffuse, src).rgb;
    vec3 tint = u_rule_type < .5 ? vec3(.15, .8, .55) : (u_rule_type < 1.5 ? vec3(.8, .25, .55) : vec3(.2, .65, .9));
    vec2 inside = fract(uv * u_resolution / size);
    float inset = smoothstep(.04, .15, inside.x) * (1.0-smoothstep(.85,.96,inside.x));
    float weight = active * inset * clamp(u_decay_blend, 0.0, 1.0) * amount;
    col = mix(col, col * .65 + tint * .3, weight);
    out_col = vec4(mix(base, clamp(col, 0.0, 1.0), amount), 1.0);
}

void fragment() {
    vec4 col;
    mainImage(UV, col);
    COLOR = col;
}
