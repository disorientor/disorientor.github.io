shader_type canvas_item;
render_mode blend_disabled;
// Terrain: composites the 3D Vectrex wireframe mesh with its phosphor gleam, a segmented vector
// horizon sun, horizon haze, and the multi-layer starry sky. Terrain silhouettes occlude the sky
// and bleed soft CRT gleam across mountain ridges.

uniform sampler2D mesh_tex : filter_linear;
uniform sampler2D gleam_tex : filter_linear;
uniform vec2 res = vec2(800.0, 510.0);
uniform float time = 0.0;
uniform float stars = 0.5;
uniform float bass = 0.0;
uniform float highs = 0.0;
uniform float star_fire = 0.0;
uniform float sun_x = 0.0;
uniform float shift = 0.0;
uniform float paper = 0.0;
uniform float mono_paper = 0.0;
uniform vec3 col_a : source_color = vec3(0.29, 0.42, 1.0);
uniform vec3 col_b : source_color = vec3(1.0, 0.42, 0.24);
uniform vec3 col_w : source_color = vec3(0.96);

float h1(vec2 q) { return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453); }

void fragment() {
	vec4 m = texture(mesh_tex, UV);
	vec3 wide_gleam = texture(gleam_tex, UV).rgb;
	vec2 px = 1.0 / max(res, vec2(1.0));
	// Isotropic 8-tap tight inner phosphor hug around the crisp vector core.
	vec3 tight_gleam = vec3(0.0);
	for (int i = 0; i < 8; i++) {
		float a = float(i) * (TAU / 8.0);
		tight_gleam += texture(mesh_tex, UV + vec2(cos(a), sin(a)) * px * 1.8).rgb;
	}
	tight_gleam *= 0.125;
	vec3 gleam = tight_gleam * 0.9 + wide_gleam * 1.55;

	float star_a = 0.0;
	vec3 sun_rgb = vec3(0.0);
	float sun_a = 0.0;
	float haze_a = 0.0;

	if (m.a < 0.999) {
		// Sky coordinates: x aspect-corrected, y positive upward from screen center.
		vec2 uv = (UV - 0.5) * vec2(res.x / max(1.0, res.y), -1.0);

		// Primary glinting starfield; notes fire transient extra glints.
		vec2 g = uv * 9.0;
		vec2 c = floor(g);
		float a = 0.0;
		for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
			vec2 cc = c + vec2(float(x), float(y));
			float pick = h1(cc + 3.0);
			float on = step(1.0 - stars * 0.72 - star_fire * 0.28 * step(0.55, h1(cc + floor(time))), pick);
			vec2 d = g - cc - vec2(h1(cc + 7.0), h1(cc + 11.0));
			float big = step(0.86, h1(cc + 5.0)) * (0.65 + highs * 1.5 + star_fire * 1.2);
			float tw = 0.6 + 0.4 * sin(time * (1.0 + pick * 4.0) + pick * 40.0);
			float core = exp(-dot(d, d) * 850.0);
			float glint = max(exp(-abs(d.x) * 60.0 - abs(d.y) * 2.5), exp(-abs(d.y) * 60.0 - abs(d.x) * 2.5)) * big;
			a = max(a, on * tw * max(core, glint));
		}

		// Secondary fine pinpoint star dust for night-sky depth.
		vec2 g2 = uv * 23.0 + vec2(5.3, -2.1);
		vec2 c2 = floor(g2);
		float pick2 = h1(c2 + 19.0);
		float on2 = step(1.0 - stars * 0.42, pick2);
		vec2 d2 = g2 - c2 - vec2(h1(c2 + 29.0), h1(c2 + 37.0));
		float tw2 = 0.55 + 0.45 * sin(time * (1.4 + pick2 * 3.0) + pick2 * 25.0);
		float fine = on2 * tw2 * exp(-dot(d2, d2) * 320.0) * 0.55;

		star_a = clamp(max(a, fine), 0.0, 1.0);

		// Vectrex segmented vector sun / horizon disc occluded behind the terrain silhouettes.
		float sun_vis = smoothstep(0.02, 0.25, stars);
		if (sun_vis > 0.001) {
			vec2 sun_p = uv - vec2(sun_x, 0.08);
			float sun_r = 0.19 * (0.94 + bass * 0.08);
			float sd = length(sun_p) - sun_r;
			float sun_rim = exp(-abs(sd) * 185.0) * 0.92;
			float slice_phase = fract((sun_p.y + sun_r) * 25.0 - shift * 0.35);
			float cut_w = clamp(0.14 + (0.45 * sun_r - sun_p.y) * 2.15, 0.0, 0.72);
			float slice_mask = sun_p.y < sun_r * 0.45 ? smoothstep(cut_w - 0.06, cut_w + 0.06, slice_phase) : 1.0;
			float sun_body = (1.0 - smoothstep(-0.004, 0.004, sd)) * slice_mask;
			float sun_fill = sun_body * 0.56;
			float sun_t = clamp((sun_p.y / sun_r) * 0.5 + 0.5, 0.0, 1.0);
			vec3 disc_col = mix(col_b, col_a, smoothstep(0.15, 0.85, sun_t));
			sun_a = clamp((sun_fill + sun_rim) * sun_vis, 0.0, 0.96);
			sun_rgb = mix(disc_col, col_w, clamp(sun_rim * 0.75, 0.0, 1.0));
			star_a *= (1.0 - sun_body * sun_vis * 0.92);
		}

		// Subtle horizon atmospheric haze right behind the far ridge line.
		haze_a = exp(-abs(uv.y - 0.01) * 12.0) * 0.14 * (0.5 + 0.5 * stars);
	}

	if (paper > 0.5) {
		vec3 fill = vec3(0.97, 0.96, 0.93);
		vec3 straight_m = m.a > 0.001 ? m.rgb / m.a : vec3(0.0);
		float ink_str = clamp(max(straight_m.r, max(straight_m.g, straight_m.b)), 0.0, 1.0);
		vec3 ink_col = mono_paper > 0.5 ? col_w : straight_m * 0.42;
		float halo = clamp(max(wide_gleam.r, max(wide_gleam.g, wide_gleam.b)) * 0.14, 0.0, 0.14);
		vec4 terrain_px = vec4(mix(fill, ink_col, clamp(ink_str + halo, 0.0, 1.0)), 1.0);
		if (m.a >= 0.999) {
			COLOR = terrain_px;
		} else {
			float sky_ink_a = clamp(max(star_a, sun_a * 0.65), 0.0, 1.0);
			vec3 sky_ink_col = sun_a > star_a && mono_paper < 0.5 ? mix(col_w, sun_rgb * 0.45, 0.6) : col_w;
			float out_a = clamp(m.a + sky_ink_a * (1.0 - m.a), 0.0, 1.0);
			vec3 out_rgb = out_a > 0.0001 ? (terrain_px.rgb * m.a + sky_ink_col * sky_ink_a * (1.0 - m.a)) / out_a : sky_ink_col;
			COLOR = vec4(out_rgb, out_a);
		}
	} else {
		vec3 straight_m = m.a > 0.001 ? m.rgb / m.a : vec3(0.0);
		vec3 terrain_rgb = clamp(straight_m + gleam * (1.0 + highs * 0.25), 0.0, 1.0);
		if (m.a >= 0.999) {
			COLOR = vec4(terrain_rgb, 1.0);
		} else {
			vec3 sky_gleam = tight_gleam * 0.65 + wide_gleam * 1.15;
			float gleam_a = clamp(max(sky_gleam.r, max(sky_gleam.g, sky_gleam.b)) * 0.95, 0.0, 0.88);
			vec3 atm_rgb = sun_rgb * sun_a + col_a * haze_a;
			float atm_a = clamp(sun_a + haze_a * (1.0 - sun_a), 0.0, 0.95);
			vec3 bg_sky_rgb = col_w * star_a + atm_rgb * (1.0 - star_a * 0.6);
			float bg_sky_a = clamp(star_a + atm_a * (1.0 - star_a), 0.0, 1.0);

			float sky_a = clamp(bg_sky_a + gleam_a * (1.0 - bg_sky_a), 0.0, 1.0);
			vec3 gleam_rgb = gleam_a > 0.001 ? clamp(sky_gleam / gleam_a, 0.0, 1.0) : vec3(0.0);
			vec3 sky_rgb = sky_a > 0.0001 ? (bg_sky_rgb * bg_sky_a + gleam_rgb * gleam_a * (1.0 - bg_sky_a)) / sky_a : col_w;

			float out_a = clamp(m.a + sky_a * (1.0 - m.a), 0.0, 1.0);
			vec3 out_rgb = out_a > 0.0001 ? (terrain_rgb * m.a + sky_rgb * sky_a * (1.0 - m.a)) / out_a : sky_rgb;
			COLOR = vec4(out_rgb, out_a);
		}
	}
}
