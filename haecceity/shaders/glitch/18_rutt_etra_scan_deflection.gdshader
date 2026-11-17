shader_type canvas_item;
#include "visual_panel_sampling.gdshaderinc"
uniform sampler2D tDiffuse : hint_screen_texture, filter_linear_mipmap;
uniform sampler2D tPrevFrame : hint_screen_texture, filter_linear_mipmap;
uniform vec2 u_resolution = vec2(1920.0, 1080.0);
uniform float u_time = 0.0;
/*
 * GLITCH SUITE - SHADER 18: RUTT-ETRA SCAN DEFLECTION (ANALOG VIDEO SYNTH)
 * -------------------------------------------------------------------------
 * Emulates the legendary 1973 Rutt-Etra video synthesizer invented by Steve Rutt
 * and Bill Etra. The analog video signal's luminance voltage is injected into the
 * cathode ray oscilloscope's vertical deflection coils, turning flat 2D raster
 * scanlines into an undulating 3D topographic relief landscape.
 */






uniform float u_intensity = 1.0;        // Master glitch depth (default: 1.0)
uniform float u_scanline_count = 175.0;   // Number of discrete deflected scanlines (50 to 300)
uniform float u_z_depth = 0.5;          // Height displacement magnitude (0.0 to 1.0)
uniform float u_line_thickness = 1.0;   // Stroke thickness of glowing raster lines
uniform float u_wireframe_mode = 0.0;   // 0.0 = Shaded Surface, 1.0 = Pure Laser Wireframe, 2.0 = Phosphor Green



float getLuma(vec3 c) {
    return dot(c, vec3(0.299, 0.587, 0.114));
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 uv = vUv;
    float numLines = max(30.0, u_scanline_count);
    
    // Nearest discrete scanline index
    float lineIndex = floor(uv.y * numLines);
    float lineBaseY = (lineIndex + 0.5) / numLines;
    
    // Multi-tap luma search along the column to find deflected beam intersections
    float minDistanceToBeam = 1.0;
    vec3 sampledColor = vec3(0.0);
    float beamIntensity = 0.0;

    // Search adjacent scanlines that might deflect across this pixel's Y coordinate
    for (int i = -3; i <= 3; i++) {
        float testLineIdx = lineIndex + float(i);
        float testBaseY = (testLineIdx + 0.5) / numLines;
        if (testBaseY < 0.0 || testBaseY > 1.0) continue;

        // Sample luminance at this line's base coordinate
        vec3 colAtLine = sample_visual_panel(tDiffuse, vec2(uv.x, testBaseY)).rgb;
        float luma = getLuma(colAtLine);

        // Calculate deflected Y position (analog raster beam displacement)
        float deflectedY = testBaseY + (luma - 0.5) * (0.25 * u_z_depth * u_intensity);
        
        // Distance in screen pixels
        float distPx = abs(uv.y - deflectedY) * u_resolution.y;
        float lineThick = max(0.5, u_line_thickness * (1.0 + 0.5 * luma));

        if (distPx < minDistanceToBeam) {
            minDistanceToBeam = distPx;
            sampledColor = colAtLine;
        }

        // Additive laser beam profile
        float beamGlow = exp(-0.5 * (distPx * distPx) / (lineThick * lineThick));
        beamIntensity += beamGlow;
    }

    vec3 finalColor = vec3(0.0);

    if (u_wireframe_mode < 0.5) {
        // Mode 0: Shaded 3D topographic relief with glowing beam overlay
        vec3 base = sample_visual_panel(tDiffuse, uv).rgb * 0.2;
        finalColor = base + sampledColor * clamp(beamIntensity, 0.0, 2.0);
    } else if (u_wireframe_mode < 1.5) {
        // Mode 1: Pure Laser Wireframe (Oscilloscope lines)
        finalColor = sampledColor * clamp(beamIntensity, 0.0, 2.5);
    } else {
        // Mode 2: Retro Monochrome P1 Green Oscilloscope
        vec3 p1Green = vec3(0.15, 1.0, 0.35);
        finalColor = p1Green * clamp(beamIntensity, 0.0, 3.0);
    }

    // Blend with original frame according to intensity
    vec3 original = sample_visual_panel(tDiffuse, uv).rgb;
    finalColor = mix(original, finalColor, clamp(u_intensity, 0.0, 1.0));

    out_col = vec4(finalColor, 1.0);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(UV, col);
    COLOR = col;
}
