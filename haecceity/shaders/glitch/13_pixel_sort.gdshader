shader_type canvas_item;
#include "visual_panel_sampling.gdshaderinc"
uniform sampler2D tDiffuse : hint_screen_texture, filter_linear_mipmap;
uniform sampler2D tPrevFrame : hint_screen_texture, filter_linear_mipmap;
uniform vec2 u_resolution = vec2(1920.0, 1080.0);
uniform float u_time = 0.0;
/*
 * GLITCH SUITE - SHADER 13: REAL-TIME LUMINANCE PIXEL SORTING & MELT
 * -------------------------------------------------------------------
 * Real-time GPU parallel implementation of Kim Asendorf's iconic Pixel Sorting algorithm.
 * Evaluates local luminance and saturation thresholds to identify sorting spans.
 * Pixels within threshold bands are displaced and stretched along directional gravity
 * vectors (vertical drip or horizontal shearing), sorting luminance gradients into
 * crystalline melting streaks while locking dark architectural contours in place.
 */






uniform float u_intensity = 1.0;        // Length and intensity of sorted streaks (default: 1.0)
uniform float u_sort_direction = 0.0;   // 0.0 = Downward (drip), 1.0 = Horizontal Right, 2.0 = Slanted / Diagonal
uniform float u_threshold_min = 0.35;    // Minimum luma threshold to trigger sorting (default: 0.35)
uniform float u_threshold_max = 0.95;    // Maximum luma threshold (default: 0.95)
uniform float u_sort_spread = 40.0;      // Max search length in pixels (default: 40.0)



// Relative luminance (Rec. 709)
float getLuma(vec3 c) {
    return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

// Pseudo-random noise for jittered span boundaries
float hash12(vec2 p) {
    vec3 p3  = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 uv = vUv;
    vec2 texel = 1.0 / u_resolution;

    // 1. Determine Sorting Direction Vector
    vec2 dir;
    if (u_sort_direction < 0.5) {
        dir = vec2(0.0, -1.0); // Vertical downward melt
    } else if (u_sort_direction < 1.5) {
        dir = vec2(1.0, 0.0);  // Horizontal rightward streak
    } else {
        dir = normalize(vec2(1.0, -0.6)); // Diagonal crystalline shear
    }

    // Dynamic threshold modulation over time
    float noiseJitter = (hash12(floor(uv * 60.0) + floor(u_time * 6.0)) - 0.5) * 0.15;
    float threshMin = clamp((u_threshold_min > 0.0 ? u_threshold_min : 0.35) + noiseJitter, 0.05, 0.9);
    float threshMax = clamp((u_threshold_max > 0.0 ? u_threshold_max : 0.95), threshMin + 0.05, 1.0);

    // Sample current pixel
    vec4 currentPixel = sample_visual_panel(tDiffuse, uv);
    float baseLuma = getLuma(currentPixel.rgb);

    // If outside the sortable threshold band, keep pixel intact
    if (baseLuma < threshMin || baseLuma > threshMax) {
        out_col = currentPixel;
        return;
    }

    // 2. Real-Time GPU Ray-March Pixel Sort
    // Search backwards and forwards along sorting vector to find the brightest anchor
    int SAMPLES = 20;
    float maxDistance = (u_sort_spread > 0.0 ? u_sort_spread : 35.0) * u_intensity;

    vec3 bestColor = currentPixel.rgb;
    float highestLuma = baseLuma;
    float sortedWeight = 0.0;

    for (int i = 1; i <= SAMPLES; i++) {
        float stepFraction = float(i) / float(SAMPLES);
        float dist = stepFraction * maxDistance;
        vec2 sampleCoord = uv - dir * (dist * texel);

        // Clamp to screen bounds
        if (sampleCoord.x < 0.0 || sampleCoord.x > 1.0 || sampleCoord.y < 0.0 || sampleCoord.y > 1.0) {
            break;
        }

        vec3 tap = sample_visual_panel(tDiffuse, sampleCoord).rgb;
        float tapLuma = getLuma(tap);

        // If we hit an edge below threshold, sorting span boundary is reached
        if (tapLuma < threshMin * 0.8) {
            break;
        }

        // Sort by luminance preference along the streak
        if (tapLuma > highestLuma) {
            highestLuma = tapLuma;
            bestColor = tap;
        }

        // Accumulate trailing crystalline streak
        sortedWeight += (1.0 - stepFraction);
    }

    // Blend between original pixel and sorted streak based on intensity
    vec3 result = mix(currentPixel.rgb, bestColor, 0.75 * u_intensity);

    // Enhance edge contrast at the sorting transition points
    if (highestLuma > threshMin + 0.2) {
        result += vec3(0.08, 0.12, 0.18) * u_intensity;
    }

    out_col = vec4(result, currentPixel.a);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(UV, col);
    COLOR = col;
}
