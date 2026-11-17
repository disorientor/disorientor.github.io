shader_type canvas_item;
#include "visual_panel_sampling.gdshaderinc"
uniform sampler2D tDiffuse : hint_screen_texture, filter_linear_mipmap;
uniform sampler2D tPrevFrame : hint_screen_texture, filter_linear_mipmap;
uniform vec2 u_resolution = vec2(1920.0, 1080.0);
uniform float u_time = 0.0;
/*
 * GLITCH SUITE - SHADER 30: HYPERSPACE TELEMETRY TDM DESYNCHRONIZATION
 * ----------------------------------------------------------------------
 * Emulates high-throughput aerospace & broadcast telemetry multiplexing failure:
 *   - Time-Division Multiplexing (TDM) Channel Interleaving: Video, audio, and radar
 *     telemetry channels desynchronize and interleave across alternating scanline fields.
 *   - Strobe Frame-Drop Phase Slip: Frame drops creating temporal stutter ghosting.
 *   - Oscillating Polar Reticle Glitch: Radially sheared radar coordinates with
 *     green phosphor vector heads-up display (HUD) artifacts.
 */






uniform float u_intensity = 1.0;        // Glitch intensity (default: 1.0)
uniform float u_mux_channels = 5.0;     // Number of multiplexed data streams (2.0 to 8.0)
uniform float u_radar_sweep = 2.25;      // Radar polar deflection speed (0.5 to 4.0)
uniform float u_telemetry_strobe = 1.0; // Temporal stroboscopic pulse rate
uniform float u_channel_shear = 1.0;    // Inter-channel horizontal shear magnitude



float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 uv = vUv;
    float channels = max(2.0, u_mux_channels);
    
    // Scanline TDM stream allocation
    float streamIdx = mod(floor(uv.y * u_resolution.y * 0.5), channels);

    // Differential phase delay for each telemetry channel
    float streamPhase = streamIdx / channels;
    float channelOffset = (hash(vec2(streamIdx, floor(u_time * 10.0))) - 0.5) * u_channel_shear * 0.1 * u_intensity;

    vec2 channelUv = uv;
    channelUv.x += channelOffset;

    // Polar Radar Telemetry Sweep Deformation
    vec2 pRadar = (uv - 0.5) * 2.0;
    pRadar.x *= u_resolution.x / u_resolution.y;
    float rDist = length(pRadar);
    float rAngle = atan(pRadar.y, pRadar.x);
    float sweepAngle = mod(u_time * u_radar_sweep * 3.14159, 6.28318) - 3.14159;
    float sweepDelta = mod(rAngle - sweepAngle + 6.28318, 6.28318);
    float sweepBeam = exp(-sweepDelta * 4.0);

    // Apply radial polar twist during sweep pass
    if (sweepDelta < 0.8) {
        float twist = (0.8 - sweepDelta) * 0.04 * u_intensity;
        channelUv += vec2(cos(rAngle + 1.57), sin(rAngle + 1.57)) * twist;
    }

    // Sample video frame
    vec3 col = sample_visual_panel(tDiffuse, clamp(channelUv, 0.0, 1.0)).rgb;

    // Channel-specific color tinting (simulating multi-spectral sensor channels)
    if (u_intensity > 0.2) {
        if (streamIdx == 0.0) {
            col.r *= 1.25; // Infrared channel
        } else if (streamIdx == 1.0) {
            col.g *= 1.25; // Night-vision green channel
        } else if (streamIdx == 2.0) {
            col.b *= 1.35; // Ultraviolet channel
        }
    }

    // Radar Telemetry Reticle & Green Phosphor Beam
    vec3 hudGreen = vec3(0.0, 1.0, 0.4);
    col += hudGreen * sweepBeam * 0.45 * u_intensity;

    // Concentric Range Rings
    float ring = abs(sin(rDist * 20.0));
    float ringLine = smoothstep(0.92, 0.98, ring) * step(rDist, 1.0);
    col += hudGreen * ringLine * 0.25 * u_intensity;

    // Stroboscopic Telemetry Stutter Flash
    float strobe = step(0.92, sin(u_time * u_telemetry_strobe * 10.0));
    col = mix(col, col * 1.5 + vec3(0.1, 0.2, 0.3), strobe * 0.35 * u_intensity);

    out_col = vec4(clamp(col, 0.0, 1.0), 1.0);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(UV, col);
    COLOR = col;
}
