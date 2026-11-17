shader_type canvas_item;
render_mode blend_disabled;

// Smooth multi-scale phosphor gleam pass for Terrain: creates the lush Vectrex CRT halation and
// peak/vertex flare without ringing or ghost lines.

uniform sampler2D mesh_tex : filter_linear;
uniform vec2 res = vec2(533.0, 340.0);

void fragment() {
	vec2 px = 1.0 / max(res, vec2(1.0));
	vec3 acc = texture(mesh_tex, UV).rgb * 0.32;

	// Ring 1: 8 taps at ~1.25 gleam texels (~3.8 full-res px).
	for (int i = 0; i < 8; i++) {
		float a = float(i) * (TAU / 8.0);
		vec2 o = vec2(cos(a), sin(a)) * px * 1.25;
		acc += texture(mesh_tex, UV + o).rgb * 0.19;
	}
	// Ring 2: 8 taps at ~2.9 gleam texels (~8.7 full-res px), staggered 22.5 deg.
	for (int i = 0; i < 8; i++) {
		float a = (float(i) + 0.5) * (TAU / 8.0);
		vec2 o = vec2(cos(a), sin(a)) * px * 2.9;
		acc += texture(mesh_tex, UV + o).rgb * 0.13;
	}
	// Ring 3: 8 taps at ~5.8 gleam texels (~17.4 full-res px) for wide CRT phosphor aura.
	for (int i = 0; i < 8; i++) {
		float a = float(i) * (TAU / 8.0);
		vec2 o = vec2(cos(a), sin(a)) * px * 5.8;
		acc += texture(mesh_tex, UV + o).rgb * 0.075;
	}
	// Ring 4: 4 diagonal outer veil taps at ~10.0 gleam texels (~30 full-res px).
	for (int i = 0; i < 4; i++) {
		float a = (float(i) + 0.5) * (TAU / 4.0);
		vec2 o = vec2(cos(a), sin(a)) * px * 10.0;
		acc += texture(mesh_tex, UV + o).rgb * 0.055;
	}
	// Subtle axial CRT glass glint from hottest cores/vertices/peaks.
	vec3 glint = vec3(0.0);
	for (int i = 1; i <= 4; i++) {
		float d = float(i) * 2.0;
		float w = exp(-float(i) * 0.55) * 0.24;
		vec3 h1 = texture(mesh_tex, UV + vec2(d * px.x, 0.0)).rgb;
		vec3 h2 = texture(mesh_tex, UV - vec2(d * px.x, 0.0)).rgb;
		vec3 v1 = texture(mesh_tex, UV + vec2(0.0, d * px.y)).rgb;
		vec3 v2 = texture(mesh_tex, UV - vec2(0.0, d * px.y)).rgb;
		vec3 s = h1 + h2 + v1 + v2;
		glint += s * smoothstep(0.42, 0.92, max(s.r, max(s.g, s.b)) * 0.25) * w;
	}

	vec3 raw = acc * 0.72 + glint;
	vec3 soft = 1.0 - exp(-raw * 1.45);
	COLOR = vec4(clamp(soft, vec3(0.0), vec3(1.0)), 1.0);
}
