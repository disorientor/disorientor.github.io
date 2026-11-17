shader_type canvas_item;
uniform float u_fade = 1.0;
uniform sampler2D tDiffuse : hint_default_black;
uniform sampler2D tPrevFrame : hint_default_black;
uniform vec2 u_resolution = vec2(1060.0, 550.0);
uniform float u_time = 0.0;
/*
 * VORTEX REALMS - SHADER V09: RETRO SYNTHWAVE WIREFRAME HORIZON FLIGHT
 * --------------------------------------------------------------------
 * High-speed infinite flight towards a massive, segmented neon sun over an undulating
 * retro-futuristic wireframe cyber-grid.
 * Features:
 *   - Relativistic perspective ground plane racing backwards into infinite horizon
 *   - Rolling synthwave mountain ridges with glowing laser coordinate lines
 *   - Colossal dual-tone neon sun with horizontal eighties venetian-blind cutouts
 *   - Mirrored chrome lake reflections at the base of the horizon
 *   - Twinkling digital starfield with deep purple-to-crimson dusk gradient
 */






uniform float u_intensity = 1.0;          // Outrun turbo boost (default: 1.0)
uniform float u_flight_speed = 2.8;       // Grid forward velocity (0.5 to 6.0, default: 2.8)
uniform float u_grid_density = 22.0;       // Wireframe grid lines frequency (5.0 to 40.0, default: 22.0)
uniform float u_mountain_height = 1.1;    // Lateral ridge amplitude (0.2 to 2.5, default: 1.1)
uniform float u_sun_radius = 0.52;         // Massive horizon sun size (0.2 to 0.9, default: 0.52)
uniform float u_sun_blinds_count = 10.0;   // Horizontal sun blind strips (4.0 to 20.0, default: 10.0)



float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

// Procedural undulating synthwave mountain ridge function
float getTerrain(vec2 p) {
    float xDist = abs(p.x);
    float ridge = pow(max(0.0, xDist - 1.2), 1.5) * u_mountain_height;
    float wave = (sin(p.x * 1.5) * cos(p.y * 0.8) + sin(p.x * 3.2 + p.y * 1.6) * 0.5) * 0.4;
    return ridge * (0.8 + 0.4 * wave);
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 p = (vUv - 0.5) * 2.0;
    p.x *= u_resolution.x / u_resolution.y;

    // Horizon line position
    float horizonY = -0.05 + 0.05 * sin(u_time * 0.5);
    vec3 col = vec3(0.0);

    if (p.y > horizonY) {
        // -------------------------------------------------------------
        // UPPER HALF: Retro Sunset Sky, Massive Sun & Starfield
        // -------------------------------------------------------------
        float skyY = (p.y - horizonY) / (1.0 - horizonY);
        
        // Deep purple to fiery dusk orange sky gradient
        vec3 skyTop = vec3(0.08, 0.02, 0.18);   // Midnight neon violet
        vec3 skyMid = vec3(0.45, 0.05, 0.35);   // Hot magenta dusk
        vec3 skyLow = vec3(0.95, 0.25, 0.15);   // Molten horizon ember
        vec3 skyCol = mix(skyLow, skyMid, pow(skyY, 0.6));
        skyCol = mix(skyCol, skyTop, pow(skyY, 1.8));

        // Digital twinkling stars
        vec2 starGrid = floor((vUv + vec2(0.0, u_time * 0.01)) * 120.0);
        float starRand = hash(starGrid);
        float starTwinkle = step(0.985, starRand) * (sin(u_time * 8.0 + starRand * 20.0) * 0.5 + 0.5);
        skyCol += vec3(0.9, 0.95, 1.0) * starTwinkle * smoothstep(0.15, 0.6, skyY);

        // Massive Segmented Retro Sun
        vec2 sunCenter = vec2(0.0, horizonY + 0.15);
        vec2 sunDelta = p - sunCenter;
        float sunDist = length(sunDelta);

        if (sunDist < u_sun_radius) {
            float normSunY = (sunDelta.y / u_sun_radius) * 0.5 + 0.5; // [0, 1] bottom to top
            
            // Horizontal venetian blind slats (thicker gap near bottom)
            float blinds = fract(normSunY * u_sun_blinds_count);
            float gapWidth = mix(0.45, 0.05, normSunY); // Gaps taper towards top
            float isSolid = step(gapWidth, blinds);

            // Sun color: Golden yellow at top, neon hot-magenta at bottom
            vec3 sunTop = vec3(1.0, 0.9, 0.15);
            vec3 sunBot = vec3(1.0, 0.05, 0.55);
            vec3 sunColor = mix(sunBot, sunTop, normSunY) * 2.2;

            skyCol = mix(skyCol, sunColor, isSolid);
        }

        // Sun corona bloom
        float sunGlow = exp(-sunDist * 2.5) * 0.6;
        skyCol += vec3(1.0, 0.3, 0.5) * sunGlow;

        col = skyCol;

    } else {
        // -------------------------------------------------------------
        // LOWER HALF: Infinite Racing Wireframe Grid & Mountain Canyon
        // -------------------------------------------------------------
        float depth = 1.0 / max(abs(p.y - horizonY), 0.001); // Perspective projection
        float zTravel = u_time * 6.0 * u_flight_speed * u_intensity;
        
        vec2 worldPos = vec2(p.x * depth * 0.7, depth + zTravel);
        float terrainH = getTerrain(worldPos);

        // Wireframe grid lines (X and Z coordinates)
        vec2 grid = fract(worldPos * (u_grid_density * 0.1));
        vec2 gridLineWidth = fwidth(worldPos * (u_grid_density * 0.1)) * 1.5;
        vec2 gridLine = smoothstep(gridLineWidth, vec2(0.0), abs(grid - 0.5));
        float isGrid = max(gridLine.x, gridLine.y);

        // Ground base color: reflective obsidian lake
        vec3 groundBase = vec3(0.02, 0.01, 0.05);

        // Mirrored reflection of the sun and sky on the ground
        vec2 reflectUv = vec2(vUv.x, 1.0 - vUv.y);
        vec3 reflection = texture(tDiffuse, clamp(reflectUv, 0.0, 1.0)).rgb * 0.3;
        groundBase += reflection;

        // Grid lines glow neon cyan / hot magenta based on distance and mountains
        vec3 gridCyan = vec3(0.0, 0.95, 1.0);
        vec3 gridPink = vec3(1.0, 0.05, 0.65);
        vec3 gridCol = mix(gridCyan, gridPink, clamp(terrainH * 0.8, 0.0, 1.0));

        col = groundBase + gridCol * isGrid * 2.5;

        // Mountain silhouette edge highlight
        float isRidge = smoothstep(0.08, 0.0, abs(terrainH - 0.5));
        col += vec3(1.0, 0.85, 0.2) * isRidge * 1.5;

        // Depth fog / haze toward the horizon line
        float depthFog = exp(-depth * 0.04);
        vec3 horizonGlow = vec3(0.95, 0.15, 0.5) * 1.2;
        col = mix(horizonGlow, col, clamp(depthFog, 0.0, 1.0));
    }

    // Horizon glowing laser dividing line
    float horizonLine = smoothstep(0.015, 0.002, abs(p.y - horizonY));
    col += vec3(1.0, 0.95, 0.8) * horizonLine * 2.5;

    // Atmospheric CRT scanlines & vignette
    float scanline = sin(vUv.y * u_resolution.y * 1.2) * 0.04;
    col -= scanline;
    col *= smoothstep(1.8, 0.4, length(p));

    out_col = vec4(clamp(col, 0.0, 1.0), 1.0);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(vec2(UV.x, 1.0 - UV.y), col);
    COLOR = vec4(col.rgb, u_fade);
}
