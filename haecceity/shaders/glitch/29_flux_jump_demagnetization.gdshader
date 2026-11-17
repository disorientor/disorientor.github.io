shader_type canvas_item;
#include "visual_panel_sampling.gdshaderinc"
uniform sampler2D tDiffuse : hint_screen_texture, filter_linear_mipmap;
uniform sampler2D tPrevFrame : hint_screen_texture, filter_linear_mipmap;
uniform vec2 u_resolution = vec2(1920.0, 1080.0);
uniform float u_time = 0.0;
/*
 * GLITCH SUITE - SHADER 29: MAGNETIC FLUX-JUMP & AZIMUTH DEMAGNETIZATION
 * ------------------------------------------------------------------------
 * Simulates severe magnetic degradation in high-density analog tape cartridges:
 *   - Flux-Jumping: High-coercivity magnetic particles flipping magnetic orientation,
 *     producing catastrophic high-frequency signal loss and transient spikes.
 *   - Head Azimuth Misalignment: Angular tilt of magnetic playback head causing
 *     phase cancellation and severe high-frequency roll-off across the horizontal track.
 *   - Magnetic Print-Through Echo: Adjacent tape layers on reel bleeding faint ghost images.
 */






uniform float u_intensity = 1.0;        // Glitch intensity (default: 1.0)
uniform float u_azimuth_angle = 1.0;    // Tape head tilt angle (-10 to +10 degrees)
uniform float u_hf_loss = 0.5;          // High-frequency luma attenuation / blur (0.0 to 1.0)
uniform float u_print_through = 0.25;    // Magnetic layer echo ghost opacity (0.0 to 0.5)
uniform float u_flux_jump_rate = 1.0;   // Frequency of sudden magnetic flips



float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 uv = vUv;

    // 1. Azimuth Head Tilt: Skews horizontal sampling axis
    float rad = radians(u_azimuth_angle * u_intensity);
    vec2 center = vec2(0.5);
    vec2 p = uv - center;
    vec2 tiltedUv = center + vec2(
        p.x * cos(rad) - p.y * sin(rad),
        p.x * sin(rad) + p.y * cos(rad)
    );

    // 2. Sudden Flux Jump Bursts (Catastrophic phase flips across bands)
    float bandIdx = floor(uv.y * 32.0);
    float fluxJump = step(1.0 - 0.08 * u_flux_jump_rate * u_intensity, hash(vec2(bandIdx, floor(u_time * 8.0))));
    if (fluxJump > 0.5) {
        tiltedUv.x += (hash(vec2(bandIdx, 12.4)) - 0.5) * 0.08 * u_intensity;
    }

    // 3. High-Frequency Lowpass Filtering (Magnetic Oxide Slumping)
    // Multi-tap horizontal blur kernel simulating head gap loss
    vec3 col = vec3(0.0);
    float totalW = 0.0;
    float blurRadius = (u_hf_loss * 6.0 + 0.5) / u_resolution.x;
    for (int i = -4; i <= 4; i++) {
        float fi = float(i);
        float w = exp(-0.5 * (fi * fi) / 4.0);
        vec2 samplePos = tiltedUv + vec2(fi * blurRadius, 0.0);
        col += sample_visual_panel(tDiffuse, clamp(samplePos, 0.0, 1.0)).rgb * w;
        totalW += w;
    }
    col /= totalW;

    // 4. Magnetic Print-Through (Pre-echo and post-echo from wound tape layers)
    vec2 preEchoUv = uv - vec2(0.035, 0.015);
    vec2 postEchoUv = uv + vec2(0.035, 0.015);
    vec3 preEcho = sample_visual_panel(tDiffuse, clamp(preEchoUv, 0.0, 1.0)).rgb;
    vec3 postEcho = sample_visual_panel(tDiffuse, clamp(postEchoUv, 0.0, 1.0)).rgb;
    col += (preEcho * 0.6 + postEcho * 0.4) * u_print_through * u_intensity;

    // 5. Demagnetization Bass Rumble / Hiss Floor
    float magneticHiss = hash(uv * 500.0 + u_time) * 0.08 * (1.0 + u_hf_loss);
    col += vec3(magneticHiss);

    // If flux jump triggered on this band, invert or desaturate
    if (fluxJump > 0.5) {
        col = mix(col, vec3(dot(col, vec3(0.333))), 0.8);
    }

    out_col = vec4(clamp(col, 0.0, 1.0), 1.0);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(UV, col);
    COLOR = col;
}
