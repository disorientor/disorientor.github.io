shader_type canvas_item;
#include "visual_panel_sampling.gdshaderinc"
#include "kinetic_moves.gdshaderinc"
uniform sampler2D tDiffuse : hint_screen_texture, filter_linear_mipmap;
uniform vec2 u_resolution = vec2(1920.0, 1080.0);
uniform float u_time = 0.0;
/*
 * GLITCH SUITE - SHADER 37: ADAPTIVE QUADTREE MATRIX
 * ---------------------------------------------------
 * Hierarchical quadtree spatial subdivision. Flat, uniform regions
 * remain large macro-blocks, while active edges and 3D sculptures
 * recursively fracture into multi-level micro-quads.
 * Mid-range snare crackle (u_rScatter) drops the variance threshold,
 * shattering the screen into thousands of technical cell partitions.
 */

uniform float u_intensity = 1.0;       // Blend of quadtree matrix over source (default: 1.0)
uniform float u_max_block = 32.0;      // Coarse root cell size in pixels (16.0 to 96.0, default: 32.0)
uniform float u_variance_th = 0.08;    // Edge threshold triggering quadtree split (default: 0.08)
uniform float u_wireframe = 0.65;      // Sub-quad boundary wireframe visibility (default: 0.65)
uniform float u_style = 0.0;           // 0.0: Source Colors, 1.0: Technical Blueprint, 2.0: Thermal HUD

float luma_at(vec2 uv) {
    return dot(sample_visual_panel(tDiffuse, clamp(uv, 0.0, 1.0)).rgb, vec3(0.299, 0.587, 0.114));
}

// Distance to bounding box border of cell in local coordinates [0,1]^2
float cell_border(vec2 local, float width_norm) {
    vec2 d = min(local, 1.0 - local);
    float edge = min(d.x, d.y);
    return smoothstep(width_norm, 0.0, edge);
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 px = vUv * u_resolution;
    vec4 src = sample_visual_panel(tDiffuse, vUv);

    // Audio-reactive threshold: snare hits (scatter) make the quadtree hypersensitive
    float dynamic_th = max(0.01, u_variance_th * (1.0 - u_rScatter * 0.75));

    // Hierarchical Quadtree Levels: Level 0 (max_block), Level 1 (max_block/2), Level 2 (max_block/4)
    float b0 = max(u_max_block, 8.0);
    float b1 = b0 * 0.5;
    float b2 = b0 * 0.25;

    // Level 0 Cell
    vec2 c0 = floor(px / b0);
    vec2 uv0 = (c0 + 0.5) * b0 / u_resolution;
    vec2 local0 = fract(px / b0);

    // Sample 4 sub-quadrants of Level 0
    vec2 half_b0 = vec2(b1) / u_resolution;
    float l_tl = luma_at(uv0 + vec2(-half_b0.x * 0.5, -half_b0.y * 0.5));
    float l_tr = luma_at(uv0 + vec2( half_b0.x * 0.5, -half_b0.y * 0.5));
    float l_bl = luma_at(uv0 + vec2(-half_b0.x * 0.5,  half_b0.y * 0.5));
    float l_br = luma_at(uv0 + vec2( half_b0.x * 0.5,  half_b0.y * 0.5));

    float max_l0 = max(max(l_tl, l_tr), max(l_bl, l_br));
    float min_l0 = min(min(l_tl, l_tr), min(l_bl, l_br));
    float var0 = max_l0 - min_l0;

    bool split0 = var0 > dynamic_th;

    vec2 active_uv = uv0;
    float active_block = b0;
    vec2 active_local = local0;

    if (split0) {
        // Level 1 Sub-quad
        vec2 c1 = floor(px / b1);
        vec2 uv1 = (c1 + 0.5) * b1 / u_resolution;
        vec2 local1 = fract(px / b1);

        // Evaluate Level 1 variance
        vec2 half_b1 = vec2(b2) / u_resolution;
        float l1_tl = luma_at(uv1 + vec2(-half_b1.x * 0.5, -half_b1.y * 0.5));
        float l1_tr = luma_at(uv1 + vec2( half_b1.x * 0.5, -half_b1.y * 0.5));
        float l1_bl = luma_at(uv1 + vec2(-half_b1.x * 0.5,  half_b1.y * 0.5));
        float l1_br = luma_at(uv1 + vec2( half_b1.x * 0.5,  half_b1.y * 0.5));

        float var1 = max(max(l1_tl, l1_tr), max(l1_bl, l1_br)) - min(min(l1_tl, l1_tr), min(l1_bl, l1_br));
        bool split1 = var1 > dynamic_th * 1.25;

        if (split1) {
            // Level 2 Sub-quad
            vec2 c2 = floor(px / b2);
            active_uv = (c2 + 0.5) * b2 / u_resolution;
            active_block = b2;
            active_local = fract(px / b2);
        } else {
            active_uv = uv1;
            active_block = b1;
            active_local = local1;
        }
    }

    vec4 block_sample = sample_visual_panel(tDiffuse, clamp(active_uv, 0.0, 1.0));
    vec3 result = block_sample.rgb;

    // Style Palettes
    if (u_style > 0.5 && u_style < 1.5) {
        // Technical Blueprint
        float l = dot(result, vec3(0.299, 0.587, 0.114));
        result = mix(vec3(0.04, 0.10, 0.22), vec3(0.30, 0.75, 1.00), l);
    } else if (u_style > 1.5) {
        // Thermal HUD
        float l = dot(result, vec3(0.299, 0.587, 0.114));
        vec3 heat = mix(vec3(0.05, 0.0, 0.15), vec3(1.0, 0.2, 0.1), smoothstep(0.0, 0.5, l));
        heat = mix(heat, vec3(1.0, 0.95, 0.4), smoothstep(0.5, 1.0, l));
        result = heat;
    }

    // Border Wireframe Lines
    float border_w = 1.0 / active_block;
    float border = cell_border(active_local, border_w) * u_wireframe;
    vec3 wire_col = (u_style > 0.5 && u_style < 1.5) ? vec3(0.2, 0.9, 1.0) : vec3(0.0, 0.0, 0.0);
    result = mix(result, wire_col, border);

    out_col = vec4(mix(src.rgb, result, clamp(u_intensity, 0.0, 1.0)), src.a);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(UV, col);
    COLOR = col;
}
