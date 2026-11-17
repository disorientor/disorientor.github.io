shader_type canvas_item;
#include "visual_panel_sampling.gdshaderinc"
uniform sampler2D tDiffuse : hint_screen_texture, filter_linear_mipmap;
uniform sampler2D tPrevFrame : hint_screen_texture, filter_linear_mipmap;
uniform vec2 u_resolution = vec2(1920.0, 1080.0);
uniform float u_time = 0.0;
/*
 * GLITCH SUITE - SHADER 24: POINT CLOUD & Z-BUFFER PRECISION SHRED
 * -----------------------------------------------------------------
 * Simulates depth-buffer quantization collapse and 3D vertex pipeline breakdowns:
 *   - Z-Buffer Fighting: Two overlapping spatial planes fighting for raster dominance,
 *     producing chaotic high-frequency black-and-white striation moiré bands.
 *   - Vertex Floating-Point Truncation: Fixed-point vertex coordinate jitter snapping
 *     polygonal geometry into sharp pixel needles and sheared tessellation shards.
 *   - Depth Disintegration: Fragments shred along simulated depth contours into point clouds.
 */






uniform float u_intensity = 1.0;        // Glitch intensity (default: 1.0)
uniform float u_z_precision = 4.0;      // Simulated depth bits (e.g. 4.0 to 16.0 bits)
uniform float u_shred_scale = 1.0;      // Needle shard length / elongation
uniform float u_vertex_snap = 1.0;      // Fixed-point vertex grid snapping (px)
uniform float u_z_fight_speed = 1.0;    // Z-fighting interference phase velocity



float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float getLuma(vec3 c) {
    return dot(c, vec3(0.299, 0.587, 0.114));
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 uv = vUv;
    vec2 px = uv * u_resolution;

    // 1. Vertex Fixed-Point Snapping / Geometry Jitter
    float snapGrid = max(1.0, u_vertex_snap);
    vec2 snappedPx = floor(px / snapGrid) * snapGrid;
    vec2 jitteredUv = mix(uv, snappedPx / u_resolution, 0.4 * u_intensity);

    // Initial base sample to extract pseudo-depth from luminance
    vec3 baseCol = sample_visual_panel(tDiffuse, jitteredUv).rgb;
    float pseudoDepth = getLuma(baseCol);

    // 2. Low-Precision Z-Buffer Quantization
    float zLevels = pow(2.0, clamp(u_z_precision, 3.0, 16.0));
    float quantZ = floor(pseudoDepth * zLevels + 0.5) / zLevels;
    float zDelta = abs(pseudoDepth - quantZ);

    // 3. Z-Fighting Striae (Two co-planar surfaces alternating per-pixel)
    float zFightPhase = (px.x * 0.707 + px.y * 0.707) * 0.35 + u_time * u_z_fight_speed * 15.0;
    float zFightStriae = sin(zFightPhase + quantZ * 80.0);
    float isFighting = step(0.0, zFightStriae) * step(0.015, zDelta * 10.0);

    // 4. Polygon Shredding into Flying Needle Pixels
    // Displace UV coordinates along depth gradient direction
    vec2 depthGrad = vec2(
        dFdx(pseudoDepth),
        dFdy(pseudoDepth)
    );
    if (length(depthGrad) < 1e-5) depthGrad = vec2(0.0, 1.0);
    depthGrad = normalize(depthGrad);

    // Needle stretch factor
    float needleNoise = hash(floor(px / vec2(2.0, 12.0)));
    float needleDisplacement = needleNoise * u_shred_scale * 0.05 * u_intensity;
    vec2 shreddedUv = jitteredUv + depthGrad * needleDisplacement;

    // Sample final color
    vec3 col = sample_visual_panel(tDiffuse, clamp(shreddedUv, 0.0, 1.0)).rgb;

    // Inject Z-fighting planar interference
    if (isFighting > 0.5 && u_intensity > 0.2) {
        float altPlane = hash(floor(px * 0.5) + floor(u_time * 20.0));
        vec3 fightCol = (altPlane > 0.5) ? vec3(0.02) : vec3(0.95);
        col = mix(col, fightCol, 0.65 * u_intensity);
    }

    // Point-cloud needle wire highlight
    float needleEdge = step(0.88, fract(px.x / 4.0)) * step(0.5, needleNoise);
    col += vec3(0.1, 0.8, 1.0) * needleEdge * 0.5 * u_intensity;

    out_col = vec4(col, 1.0);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(UV, col);
    COLOR = col;
}
