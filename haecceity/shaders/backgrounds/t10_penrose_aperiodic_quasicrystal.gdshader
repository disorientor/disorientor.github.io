shader_type canvas_item;
uniform float u_fade = 1.0;
uniform sampler2D tDiffuse : hint_default_black;
uniform sampler2D tPrevFrame : hint_default_black;
uniform vec2 u_resolution = vec2(1060.0, 550.0);
uniform float u_time = 0.0;
/*
 * TRIP MATH SUITE - SHADER T10: PENROSE APERIODIC QUASICRYSTAL & DE BRUIJN PENTAGRID
 * ------------------------------------------------------------------------------------
 * Synthesizes Roger Penrose's iconic P3 aperiodic tiling and Dan Shechtman's quasicrystals:
 *   - Constructed via N.G. de Bruijn's algebraic Pentagrid method (dual of 5 intersecting grids
 *     oriented at angles 2*pi*j / 5, j in {0, 1, 2, 3, 4}).
 *   - The intersections of the pentagrid dualize directly to Penrose thick & thin rhombs:
 *       Thick rhomb: angles 72 and 108 degrees
 *       Thin rhomb:  angles 36 and 144 degrees
 *   - Golden Ratio scaling: phi = (1 + sqrt(5)) / 2  (~1.6180339887)
 *   - Displays crystallographically forbidden 5-fold rotational symmetry and inflational waves.
 */






uniform float u_intensity = 1.0;        // Inflation/wave propagation velocity (default: 1.0)
uniform float u_grid_scale = 24.0;       // Pentagrid spatial frequency (8.0 to 40.0)
uniform float u_rhomb_contrast = 1.0;   // Thick vs Thin rhomb shading contrast
uniform float u_golden_inflation = 1.0; // Deflation/inflation scaling wave
uniform float u_wireframe_thick = 1.0;  // Rhomb border line thickness



void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 p = (vUv - 0.5) * 2.0;
    p.x *= u_resolution.x / u_resolution.y;

    float phi = 1.6180339887;
    float scale = max(5.0, u_grid_scale);

    // Dynamic golden inflation pulse
    float inflPulse = pow(phi, sin(u_time * 0.4 * u_intensity) * 1.5);
    vec2 pos = p * scale * inflPulse;

    // Pentagrid phase shifts satisfying de Bruijn constraint
    float tPhase = u_time * 0.2 * u_intensity;

    // 5 grid projection directions e_j = (cos(2*pi*j/5), sin(2*pi*j/5))
    float minGridDist = 1.0;
    float rhombType = 0.0;
    float wireAccum = 0.0;
    float starPhase = 0.0;

    for (int j = 0; j < 5; j++) {
        float theta = float(j) * (6.2831853 / 5.0);
        vec2 dir = vec2(cos(theta), sin(theta));

        // Grid coordinate
        float gridCoord = dot(pos, dir) + float(j) * 0.2 + tPhase;
        float inGrid = fract(gridCoord);
        float dToLine = abs(inGrid - 0.5);

        minGridDist = min(minGridDist, dToLine);

        // Accumulate grid line edges (rhomb perimeter wireframe)
        float wire = smoothstep(0.04 * u_wireframe_thick, 0.0, dToLine);
        wireAccum = max(wireAccum, wire);

        // Rhomb type determination (even/odd parity of grid crossing indices)
        rhombType += floor(gridCoord);
        starPhase += sin(gridCoord * 3.14159);
    }

    // Parity assigns Thick vs Thin Penrose Rhombs
    float isThickRhomb = mod(rhombType, 2.0);

    // Sacred Quasicrystal Palette: Royal Lapis Lazuli, Byzantine Gold, and Jade
    vec3 thickCol = vec3(0.08, 0.35, 0.85);  // Deep Lapis Blue (Thick Rhomb)
    vec3 thinCol  = vec3(0.95, 0.72, 0.18);  // Solar Gold (Thin Rhomb)

    vec3 col = mix(thickCol, thinCol, isThickRhomb * u_rhomb_contrast);

    // Ammann Line Decoration (Continuous quasi-periodic lines cutting across rhombs)
    float ammann = sin(starPhase * 2.0 - u_time * 1.5);
    col *= (0.85 + 0.15 * smoothstep(-0.2, 0.2, ammann));

    // Glowing Rhomb Edges
    vec3 wireColor = vec3(0.2, 0.95, 1.0); // Neon cyan
    col = mix(col, wireColor, wireAccum * 0.85);

    // Central 5-Fold Symmetry Stargate Glow
    float r = length(p);
    float coreGlow = exp(-r * 3.5);
    col += vec3(1.0, 0.85, 0.4) * coreGlow * 0.8 * u_intensity;

    // Blend with scene
    vec3 scene = texture(tDiffuse, vUv).rgb;
    col = mix(scene * 0.15 + col, col, 0.88);

    out_col = vec4(clamp(col, 0.0, 1.0), 1.0);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(vec2(UV.x, 1.0 - UV.y), col);
    COLOR = vec4(col.rgb, u_fade);
}
