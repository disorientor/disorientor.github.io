shader_type canvas_item;
uniform float u_fade = 1.0;
uniform sampler2D tDiffuse : hint_default_black;
uniform sampler2D tPrevFrame : hint_default_black;
uniform vec2 u_resolution = vec2(1060.0, 550.0);
uniform float u_time = 0.0;
/*
 * VORTEX REALMS - SHADER V10: QUANTUM CHROMODYNAMIC GLUON FLUX TUBE
 * ------------------------------------------------------------------
 * Diving through the relativistic SU(3) color-confinement flux tube connecting a
 * quark-antiquark pair within a hadron.
 * Features:
 *   - Triple-braided helical color-charge vortex lines (Red, Green, Blue quarks)
 *   - Instanton quantum vacuum foam fluctuations boiling along the tube perimeter
 *   - Strong-force gluon field energy density concentrating toward the central axis
 *   - Relativistic Lorentz contraction warping the approaching subatomic field
 *   - Blinding subatomic particle collision caustics and Cherenkov emission
 */






uniform float u_intensity = 1.0;              // Subatomic excitation factor (default: 1.0)
uniform float u_flight_speed = 3.2;           // Relativistic dive velocity (1.0 to 8.0, default: 3.2)
uniform float u_braid_frequency = 2.1;        // Helical strand winding rate (0.5 to 5.0, default: 2.1)
uniform float u_flux_thickness = 0.45;         // Gluon cord thickness (0.1 to 1.2, default: 0.45)
uniform float u_vacuum_fluctuation = 1.2;     // Zero-point energy foam turbulence (0.2 to 2.5, default: 1.2)
uniform float u_color_charge_glow = 2.2;      // SU(3) primary charge brightness (0.5 to 4.0, default: 2.2)



vec2 rot(vec2 p, float a) {
    float s = sin(a), c = cos(a);
    return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 p = (vUv - 0.5) * 2.0;
    p.x *= u_resolution.x / u_resolution.y;

    float r = max(length(p), 0.001);
    float theta = atan(p.y, p.x);

    // Relativistic transit along the flux tube Z axis
    float zTravel = u_time * 6.0 * u_flight_speed * u_intensity;
    float zCoord = 1.0 / max(r, 0.05) + zTravel;

    // Relativistic corkscrew frame dragging
    theta += zCoord * 0.25;

    // SU(3) Triple Helical Color Braid (120-degree phase separation)
    float braidPhase = zCoord * u_braid_frequency * 0.5;
    float braidR = 0.65; // Helical braid radius

    // Distances to each of the 3 color flux cords
    vec2 posR = vec2(cos(braidPhase), sin(braidPhase)) * braidR;
    vec2 posG = vec2(cos(braidPhase + 2.094395), sin(braidPhase + 2.094395)) * braidR;
    vec2 posB = vec2(cos(braidPhase + 4.188790), sin(braidPhase + 4.188790)) * braidR;

    vec2 pTube = vec2(cos(theta), sin(theta)) * (r * 2.0);

    float distR = length(pTube - posR);
    float distG = length(pTube - posG);
    float distB = length(pTube - posB);

    // Gluon flux cord emission profiles
    float cordR = exp(-distR * distR / (u_flux_thickness * 0.25));
    float cordG = exp(-distG * distG / (u_flux_thickness * 0.25));
    float cordB = exp(-distB * distB / (u_flux_thickness * 0.25));

    // Instanton Quantum Vacuum Fluctuations (Foam boiling along tube boundaries)
    float foamNoise = hash(floor(p * 25.0) + floor(u_time * 18.0));
    float foamRing = smoothstep(0.4, 0.8, r) * step(0.7, foamNoise) * u_vacuum_fluctuation;

    // Strong-Force Confinement Potential: V(r) = -4/3 * (alpha_s / r) + sigma * r
    float confinementV = 1.2 / r + r * 1.5;
    float confinementGlow = exp(-abs(sin(confinementV * 3.0 - u_time * 6.0)) * 4.0);

    // Primary SU(3) Color Charges: Red, Green, Blue
    vec3 colRed   = vec3(1.0, 0.05, 0.15); // Red quark charge
    vec3 colGreen = vec3(0.05, 1.0, 0.3);  // Green quark charge
    vec3 colBlue  = vec3(0.1, 0.45, 1.0);  // Blue quark charge

    vec3 col = vec3(0.015, 0.01, 0.03); // Quantum chromodynamic vacuum

    // Additive color charge braiding
    col += colRed * cordR * u_color_charge_glow;
    col += colGreen * cordG * u_color_charge_glow;
    col += colBlue * cordB * u_color_charge_glow;

    // Inter-strand Gluon Exchange Bridges (Braided electric field lines)
    float gluonExchange = sin(distR * 12.0) * sin(distG * 12.0) * sin(distB * 12.0);
    col += vec3(1.0, 0.9, 0.3) * max(0.0, gluonExchange) * 1.5;

    // Vacuum polarization fluctuations (Virtual quark-antiquark bubbling)
    col += vec3(0.8, 0.2, 0.9) * foamRing * 0.8;

    // Confinement wall caustic rings
    col += vec3(0.0, 0.95, 1.0) * confinementGlow * 0.6;

    // Central asymptotic freedom portal (Forward quark collision target)
    float coreHit = exp(-r * 5.0);
    col += vec3(1.0, 1.0, 1.0) * coreHit * 3.5;

    // Peripheral chromatic lens flare / aberration
    vec2 sampleUv = vUv + p * (0.035 / (r + 0.1));
    vec3 sceneTex = texture(tDiffuse, clamp(sampleUv, 0.0, 1.0)).rgb;
    col = mix(col, col + sceneTex * 0.25, 0.7);

    out_col = vec4(clamp(col, 0.0, 1.0), 1.0);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(vec2(UV.x, 1.0 - UV.y), col);
    COLOR = vec4(col.rgb, u_fade);
}
