shader_type canvas_item;
uniform float u_fade = 1.0;
uniform sampler2D tDiffuse : hint_default_black;
uniform sampler2D tPrevFrame : hint_default_black;
uniform vec2 u_resolution = vec2(1060.0, 550.0);
uniform float u_time = 0.0;
/*
 * VORTEX REALMS - SHADER V05: KERR BLACK HOLE ACCRETION DISK PLUNGE
 * -----------------------------------------------------------------
 * A true 3D relativistic raymarching plunge into the curved spacetime of a rapidly
 * spinning supermassive Kerr black hole.
 * Features:
 *   - Continuous 3D orbital dive with seamless cinematic spiral perspective
 *   - 3D geodesic light bending warping the accretion disk over and under the horizon
 *   - Relativistic Doppler boosting: approaching side blueshifts into blinding cyan-white,
 *     receding side redshifts into dull infrared crimson
 *   - Lense-Thirring frame dragging vortex twisting spacetime
 *   - Concentric Einstein photon rings (n=1, n=2) outlining the shadow
 *   - Collimated relativistic polar plasma jets shooting along the rotation axis
 *   - Warped celestial starfield background with gravitational lensing
 */

uniform float u_intensity = 1.0;          // Gravitational plunge boost (default: 1.0)
uniform float u_dive_speed = 2.0;         // Descent velocity towards horizon (0.5 to 5.0, default: 2.0)
uniform float u_spin_parameter = 0.92;     // Kerr spin a/M (0.1 to 0.99, default: 0.92)
uniform float u_doppler_beaming = 1.8;    // Relativistic beaming exponent (0.5 to 3.0, default: 1.8)
uniform float u_disk_temperature = 1.5;   // Accretion disk brightness (0.5 to 3.0, default: 1.5)
uniform float u_photon_ring_glow = 2.2;   // Photon sphere resonance intensity (0.5 to 4.0, default: 2.2)

vec2 rot(vec2 p, float a) {
    float s = sin(a), c = cos(a);
    return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}

float hash2(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise2(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash2(i);
    float b = hash2(i + vec2(1.0, 0.0));
    float c = hash2(i + vec2(0.0, 1.0));
    float d = hash2(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 uv = (vUv - 0.5) * 2.0;
    uv.x *= u_resolution.x / u_resolution.y;

    // Continuous 3D relativistic spiral plunge
    float tOrbit = u_time * 0.28 * u_dive_speed * u_intensity;
    float rCam = 3.8 + 0.6 * sin(tOrbit * 0.35);
    float yCam = 1.2 + 0.35 * cos(tOrbit * 0.45);
    
    vec3 ro = vec3(cos(tOrbit) * rCam, yCam, sin(tOrbit) * rCam);
    vec3 ta = vec3(0.0, -0.1, 0.0);
    vec3 ww = normalize(ta - ro);
    vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
    vec3 vv = cross(uu, ww);
    vec3 rd = normalize(uv.x * uu + uv.y * vv + 1.35 * ww);

    // Relativistic parameters
    float rs = 0.52; // Schwarzschild radius
    float isco = rs * 1.5; // Innermost stable circular orbit
    float diskOuter = rs * 7.5;
    
    vec3 curP = ro;
    vec3 curD = rd;
    
    vec3 colAcc = vec3(0.0);
    float hitHorizon = 0.0;
    float minR = 1e5;

    // 3D Relativistic raymarching with spacetime light bending
    float stepSize = 0.06;
    for (int i = 0; i < 80; i++) {
        float r = length(curP);
        minR = min(minR, r);

        // Event horizon absorption
        if (r < rs) {
            hitHorizon = 1.0;
            break;
        }

        // Curved spacetime light deflection (Schwarzschild + Kerr frame dragging)
        vec3 toCenter = -normalize(curP);
        float bendForce = (1.5 * rs) / (r * r + 0.05) * stepSize;
        
        // Frame dragging torque around Y spin axis
        vec3 spinAxis = vec3(0.0, 1.0, 0.0);
        vec3 dragDir = normalize(cross(spinAxis, curP));
        float dragForce = (rs * u_spin_parameter * 0.4) / (pow(r, 3.0) + 0.1) * stepSize;

        curD = normalize(curD + toCenter * bendForce + dragDir * dragForce);
        curP += curD * stepSize;

        // Volumetric Accretion Disk Sampling (near equatorial plane y ~ 0)
        float rEquat = length(curP.xz);
        float diskThickness = 0.08 + 0.04 * (rEquat / diskOuter);
        float distToPlane = abs(curP.y);

        if (distToPlane < diskThickness && rEquat > isco && rEquat < diskOuter) {
            float normR = (rEquat - isco) / (diskOuter - isco);
            
            // Keplerian orbital velocity v ~ sqrt(rs / r)
            float vOrb = sqrt(rs / max(rEquat, 0.1));
            float phi = atan(curP.z, curP.x);
            float diskAngle = phi - u_time * 2.8 * vOrb;

            // Plasma turbulence
            float turb = noise2(vec2(rEquat * 10.0, diskAngle * 7.0)) * 0.6
                       + noise2(vec2(rEquat * 20.0, diskAngle * 14.0)) * 0.4;

            // Relativistic Doppler boosting:
            // Tangential velocity vector
            vec3 vDir = normalize(vec3(-curP.z, 0.0, curP.x));
            float cosTheta = dot(vDir, -curD);
            float beta = clamp(vOrb * 0.72, 0.0, 0.88);
            float gamma = 1.0 / sqrt(max(1.0 - beta * beta, 0.01));
            float doppler = 1.0 / (gamma * (1.0 - beta * cosTheta));
            doppler = pow(doppler, u_doppler_beaming);

            // Blackbody temperature profile
            float temp = pow(1.0 - normR, 1.1) * (0.85 + 0.45 * turb);
            vec3 blueTemp = vec3(0.15, 0.85, 1.0) * 2.8; // Blueshifted approaching side
            vec3 redTemp = vec3(1.0, 0.18, 0.04) * 0.75; // Redshifted receding side
            vec3 diskCol = mix(redTemp, blueTemp, clamp((doppler - 0.45) * 0.75, 0.0, 1.0));

            float plasmaDens = (1.0 - distToPlane / diskThickness) * 0.14;
            colAcc += diskCol * temp * doppler * plasmaDens * u_disk_temperature * u_intensity;
        }

        // Collimated relativistic polar plasma jets (along Y axis)
        float rCyl = length(curP.xz);
        if (rCyl < 0.22 && abs(curP.y) > 0.4) {
            float jetTurb = noise2(vec2(curP.y * 8.0 - u_time * 12.0, atan(curP.z, curP.x) * 4.0));
            float jetDens = exp(-rCyl * 16.0) * (0.6 + 0.4 * jetTurb) * 0.08;
            vec3 jetCol = vec3(0.4, 0.9, 1.0) * 2.5;
            colAcc += jetCol * jetDens * u_intensity;
        }

        // Adapt step size based on distance to black hole
        stepSize = max(0.04, min(0.18, r * 0.065));
        if (r > 12.0) break;
    }

    // Einstein Photon Rings (n=1 and n=2 resonance caustics encircling shadow)
    float rPhoton = rs * 1.5;
    float photonRing1 = exp(-abs(minR - rPhoton) * 75.0) * u_photon_ring_glow;
    float photonRing2 = exp(-abs(minR - rPhoton * 0.94) * 140.0) * (u_photon_ring_glow * 0.65);
    vec3 photonCol = vec3(0.8, 0.96, 1.0) * (photonRing1 + photonRing2) * 2.5;
    colAcc += photonCol;

    // Event Horizon Pitch Black Silhouette
    if (hitHorizon > 0.5) {
        colAcc = mix(colAcc, vec3(0.0), smoothstep(rs * 1.05, rs * 0.95, minR));
    }

    // Warped background celestial starfield outside the shadow
    if (hitHorizon < 0.5) {
        vec2 starUv = curD.xy * 2.0;
        float stars = pow(hash2(floor(starUv * 80.0)), 28.0) * 1.5;
        vec3 starCol = vec3(stars) * vec3(0.8, 0.9, 1.0);
        colAcc += starCol * smoothstep(rs, rs * 2.5, minR);
    }

    // Ergosphere frame dragging chromatic glow
    float ergoGlow = exp(-abs(minR - rs * 1.18) * 10.0) * u_spin_parameter;
    colAcc += vec3(0.75, 0.15, 1.0) * ergoGlow * 0.65;

    // Blend with scene texture
    vec3 sceneTex = texture(tDiffuse, vUv).rgb;
    colAcc = mix(colAcc, colAcc + sceneTex * 0.2, 0.85);

    out_col = vec4(clamp(colAcc, 0.0, 1.0), 1.0);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(vec2(UV.x, 1.0 - UV.y), col);
    COLOR = vec4(col.rgb, u_fade);
}
