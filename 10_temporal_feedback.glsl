/*
 * GLITCH SUITE - SHADER 10: TEMPORAL OPTICAL FEEDBACK & PHOSPHOR TRAILS
 * ---------------------------------------------------------------------
 * Emulates infinite recursive video feedback (pointing an analog camera at
 * its own monitor) combined with long-persistence CRT phosphor decay (P7 radar tube).
 * Moving elements leave burning optical ghost trails, recursive scale-rotation
 * vortices, chromatic hue precession per echo generation, and luminescent bloom.
 */

#ifdef GL_ES
precision highp float;
#endif

uniform sampler2D tDiffuse;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_intensity;        // Feedback loop gain & trail longevity (default: 1.0)
uniform float u_feedback_zoom;    // Recursive optical zoom factor (> 1.0 = zoom in, < 1.0 = zoom out)
uniform float u_feedback_angle;   // Recursive camera rotation per feedback generation
uniform float u_decay_rate;       // Phosphor persistence decay (default: 0.85)
uniform float u_chroma_spin;      // Hue shift speed per feedback echo (default: 1.2)

varying vec2 vUv;

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
    return mat2(c, -s, s, c);
}

void main() {
    vec2 uv = vUv;
    vec2 center = vec2(0.5);

    // Current live frame
    vec4 currentFrame = texture2D(tDiffuse, uv);
    vec3 accumColor = currentFrame.rgb;

    // Simulation of recursive optical feedback generations (Multi-Tap Temporal Loop)
    const int ECHO_TAPS = 7;
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
            vec3 echoSample = texture2D(tDiffuse, echoUv).rgb;

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

    gl_FragColor = vec4(accumColor, currentFrame.a);
}
