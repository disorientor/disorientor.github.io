shader_type canvas_item;
#include "visual_panel_sampling.gdshaderinc"
uniform sampler2D tDiffuse : hint_screen_texture, filter_linear_mipmap;
uniform sampler2D tPrevFrame : hint_screen_texture, filter_linear_mipmap;
uniform vec2 u_resolution = vec2(1920.0, 1080.0);
uniform float u_time = 0.0;
/*
 * GLITCH SUITE - SHADER 10: TEMPORAL OPTICAL FEEDBACK & PHOSPHOR TRAILS
 * ---------------------------------------------------------------------
 * Emulates infinite recursive video feedback (pointing an analog camera at
 * its own monitor) combined with long-persistence CRT phosphor decay (P7 radar tube).
 * Moving elements leave burning optical ghost trails, recursive scale-rotation
 * vortices, chromatic hue precession per echo generation, and luminescent bloom.
 */






uniform float u_intensity = 1.0;        // Feedback loop gain & trail longevity (default: 1.0)
uniform float u_feedback_zoom = 1.0;    // Recursive optical zoom factor (> 1.0 = zoom in, < 1.0 = zoom out)
uniform float u_feedback_angle = 1.0;   // Recursive camera rotation per feedback generation
uniform float u_decay_rate = 0.85;       // Phosphor persistence decay (default: 0.85)
uniform float u_chroma_spin = 1.2;      // Hue shift speed per feedback echo (default: 1.2)



// HSV to RGB conversion
vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - 1.0, 0.0, 1.0), c.y);
}

// 2D Rotation matrix
mat2 rotate2D(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat2(vec2(c, -s), vec2(s, c));
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 uv = vUv;
    vec2 center = vec2(0.5);

    // Current live frame
    vec4 currentFrame = sample_visual_panel(tDiffuse, uv);
    vec3 accumColor = currentFrame.rgb;

    // Simulation of recursive optical feedback generations (Multi-Tap Temporal Loop)
    int ECHO_TAPS = 7;
    float zoomFactor = 1.0 + (u_feedback_zoom - 1.0) * 0.04 * u_intensity;
    float rotAngle = (u_feedback_angle > 0.0 ? u_feedback_angle : 0.02) * u_intensity;
    float decay = clamp(u_decay_rate > 0.0 ? u_decay_rate : 0.82, 0.5, 0.96);

    vec2 echoUv = uv;
    float currentWeight = 1.0;
    float totalWeight = 1.0;

    for (int i = 1; i <= ECHO_TAPS; i++) {
        float fi = float(i);
        currentWeight *= decay;

        // Recursive transform: scale around center and rotate
        vec2 p = echoUv - center;
        p = rotate2D(rotAngle * fi) * p;
        p *= pow(zoomFactor, fi);
        echoUv = p + center;

        // Sample feedback generation
        if (echoUv.x >= 0.0 && echoUv.x <= 1.0 && echoUv.y >= 0.0 && echoUv.y <= 1.0) {
            vec3 echoSample = sample_visual_panel(tDiffuse, echoUv).rgb;

            // Chromatic hue precession per echo iteration
            float hueShift = fi * 0.12 * u_chroma_spin;
            float luma = dot(echoSample, vec3(0.299, 0.587, 0.114));
            vec3 phosphorTint = hsv2rgb(vec3(fract(hueShift + luma * 0.5), 0.85, 1.0));

            // Long-persistence phosphor bloom
            vec3 blendedEcho = mix(echoSample, echoSample * phosphorTint * 1.5, 0.45);
            accumColor += blendedEcho * currentWeight * u_intensity;
            totalWeight += currentWeight;
        }
    }

    accumColor /= totalWeight;

    // Optical burn & luma threshold glow (analog video feedback hotspot)
    float lumaBurn = max(0.0, dot(accumColor, vec3(0.299, 0.587, 0.114)) - 0.7);
    accumColor += vec3(0.2, 0.8, 1.0) * pow(lumaBurn, 2.0) * 1.5 * u_intensity;

    out_col = vec4(accumColor, currentFrame.a);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(UV, col);
    COLOR = col;
}
