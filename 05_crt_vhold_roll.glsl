/*
 * GLITCH SUITE - SHADER 05: ANALOG CRT V-HOLD SYNC ROLL & BEAM COLLAPSE
 * ----------------------------------------------------------------------
 * Emulates vertical sync oscillator failure in cathode ray tube (CRT) televisions.
 * The frame loses phase lock and rolls continuously down/up, exposing the
 * Vertical Blanking Interval (VBI) with pulse sync bars and test signals.
 * Includes spherical glass pincushion distortion, phosphor scanlines, and an
 * emergency "beam collapse" mode where deflection coils fail into a horizontal line.
 */

#ifdef GL_ES
precision highp float;
#endif

uniform sampler2D tDiffuse;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_intensity;        // Glitch magnitude & roll speed multiplier (default: 1.0)
uniform float u_roll_speed;       // Vertical roll speed (cycles/sec, default: 1.5)
uniform float u_vbi_thickness;    // Height of the black vertical blanking interval bar (default: 0.12)
uniform float u_curvature;        // CRT glass tube barrel distortion (default: 0.18)
uniform float u_beam_collapse;    // 0.0 = Normal roll, 1.0 = Deflection coil failure collapse to center line

varying vec2 vUv;

// CRT glass barrel curvature
vec2 distortCurve(vec2 uv, float k) {
    vec2 p = uv * 2.0 - 1.0;
    vec2 offset = p.yx / vec2(4.0, 3.0);
    p = p + p * offset * offset * k;
    return p * 0.5 + 0.5;
}

// Pseudo-random teletext / VBI test pattern signals
float teletextPattern(vec2 uv, float time) {
    vec2 grid = floor(uv * vec2(64.0, 8.0));
    float n = fract(sin(dot(grid + floor(time * 60.0), vec2(12.9898, 78.233))) * 43758.5453);
    return step(0.5, n);
}

void main() {
    vec2 uv = vUv;

    // 1. CRT Curved Glass Distortion
    vec2 curvedUv = distortCurve(uv, u_curvature * (0.8 + 0.2 * u_intensity));

    // Outside tube border vignette
    if (curvedUv.x < 0.0 || curvedUv.x > 1.0 || curvedUv.y < 0.0 || curvedUv.y > 1.0) {
        gl_FragColor = vec4(0.02, 0.02, 0.03, 1.0);
        return;
    }

    // 2. Deflection Coil Beam Collapse Simulation
    // When u_beam_collapse > 0, the vertical sweep collapses into a thin ultra-bright central line
    if (u_beam_collapse > 0.01) {
        float collapseFactor = clamp(u_beam_collapse * u_intensity, 0.0, 1.0);
        float lineDist = abs(curvedUv.y - 0.5);
        float lineWidth = mix(0.5, 0.003, collapseFactor);
        float beamGlow = exp(-lineDist / lineWidth);
        
        // Horizontal expansion & vertical pinch
        curvedUv.y = mix(curvedUv.y, 0.5, collapseFactor * 0.98);
        vec4 baseCol = texture2D(tDiffuse, clamp(curvedUv, 0.0, 1.0));
        
        vec3 collapsedCol = baseCol.rgb * beamGlow * (1.0 + collapseFactor * 4.0);
        collapsedCol += vec3(0.4, 0.8, 1.0) * exp(-lineDist / 0.002) * collapseFactor * 6.0;
        gl_FragColor = vec4(collapsedCol, 1.0);
        return;
    }

    // 3. V-Hold Loss & Rolling Scan
    float rollSpeed = u_roll_speed * (1.0 + sin(u_time * 0.3) * 0.4) * u_intensity;
    float rollOffset = fract(u_time * rollSpeed);
    
    // Virtual Y coordinate after roll
    float rolledY = fract(curvedUv.y + rollOffset);

    // 4. Vertical Blanking Interval (VBI) & Sync Pulse
    float vbiBarHeight = max(0.04, u_vbi_thickness);
    bool inVbi = (rolledY < vbiBarHeight);

    vec4 color = vec4(0.0);

    if (inVbi) {
        // Render VBI: Black pedestal, white horizontal sync pulse, teletext digital burst
        float localY = rolledY / vbiBarHeight;
        if (localY > 0.35 && localY < 0.65) {
            // White sync pulse and teletext noise
            float burst = teletextPattern(vec2(curvedUv.x, localY), u_time);
            color = vec4(vec3(burst * 0.85), 1.0);
        } else {
            // Dark front/back porch
            color = vec4(0.05, 0.05, 0.07, 1.0);
        }
    } else {
        // Remap rolled Y back to active display area [0, 1]
        float activeY = (rolledY - vbiBarHeight) / (1.0 - vbiBarHeight);
        vec2 activeUv = vec2(curvedUv.x, activeY);

        // Horizontal tear near the VBI edge
        float edgeDist = min(abs(rolledY - vbiBarHeight), abs(1.0 - rolledY));
        float hTear = sin(curvedUv.y * 120.0 + u_time * 40.0) * exp(-edgeDist * 30.0) * 0.04 * u_intensity;
        activeUv.x += hTear;

        // Sample frame
        color = texture2D(tDiffuse, clamp(activeUv, 0.0, 1.0));
    }

    // 5. Phosphor RGB Triad Scanlines & Mask
    float scanline = sin(curvedUv.y * u_resolution.y * 3.14159) * 0.12 * u_intensity;
    color.rgb -= scanline;

    // Subtle phosphor dot shadow mask (Aperture grille triad)
    float triadX = fract(curvedUv.x * u_resolution.x * 0.3333);
    vec3 triadMask = vec3(
        smoothstep(0.0, 0.33, triadX) * smoothstep(0.66, 0.33, triadX),
        smoothstep(0.33, 0.66, triadX) * smoothstep(1.0, 0.66, triadX),
        smoothstep(0.66, 1.0, triadX)
    );
    color.rgb *= mix(vec3(1.0), triadMask * 1.5, 0.15 * u_intensity);

    // Vignette
    float vig = curvedUv.x * curvedUv.y * (1.0 - curvedUv.x) * (1.0 - curvedUv.y);
    vig = clamp(pow(16.0 * vig, 0.25), 0.0, 1.0);
    color.rgb *= vig;

    gl_FragColor = color;
}
