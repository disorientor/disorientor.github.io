shader_type spatial;
render_mode unshaded, cull_back, shadows_disabled;

// Low-poly Vectrex wireframe head in Terrain's sky during MumbleSpeak:
// deforms jaw, lips and eyes in real time from phoneme visemes and draws
// isotropic barycentric wireframe edges + vertex beam-dwell hotspots.

uniform float time = 0.0;
uniform float appear = 0.0;
uniform float jaw_open = 0.0;
uniform float mouth_wide = 0.5;
uniform float lip_pucker = 0.0;
uniform float speech_pulse = 0.0;
uniform float blink = 0.0;
uniform float highs = 0.0;
uniform float paper = 0.0;
uniform vec3 col_a : source_color = vec3(0.29, 0.42, 1.0);
uniform vec3 col_b : source_color = vec3(1.0, 0.42, 0.24);
uniform vec3 col_w : source_color = vec3(0.96);

varying vec3 v_pos;
varying float v_tag;

void vertex() {
	float jaw_w = COLOR.r;
	float lip_w = COLOR.g;
	v_tag = COLOR.b;

	vec3 p = VERTEX;
	// Lip spread (E/I) and pucker (O/U).
	p.x *= 1.0 + (mouth_wide - 0.5) * 0.42 * lip_w - lip_pucker * 0.28 * lip_w;
	p.z += lip_pucker * 0.14 * lip_w;

	// Eye blink collapses pupil diamonds vertically toward eye center.
	if (v_tag > 0.42 && v_tag < 0.60) {
		p.y = mix(p.y, 0.29, blink);
	}

	// Mandible rotation around temporomandibular hinge, plus slight upper-lip lift.
	if (lip_w > 0.5 && jaw_w < 0.2) {
		p.y += jaw_open * 0.045;
	}
	float ang = jaw_open * jaw_w * 0.62;
	if (ang > 0.0001) {
		vec3 hinge = vec3(0.0, -0.15, 0.05);
		float dy = p.y - hinge.y;
		float dz = p.z - hinge.z;
		float c = cos(ang);
		float s = sin(ang);
		p.y = hinge.y + dy * c - dz * s;
		p.z = hinge.z + dy * s + dz * c;
	}

	v_pos = p;
	VERTEX = p;
}

void fragment() {
	if (appear < 0.02) discard;
	if (appear < 0.98) {
		float norm_y = clamp((v_pos.y + 1.1) / 2.35, 0.0, 1.0);
		float scan = fract(v_pos.y * 16.0 - time * 3.0);
		if (norm_y > appear * 1.14) discard;
		if (norm_y > appear - 0.14 && scan > clamp((appear - norm_y + 0.14) * 7.5, 0.0, 1.0)) discard;
	}

	vec3 bary = vec3(UV.x, UV.y, 1.0 - UV.x - UV.y);
	vec3 fw = max(fwidth(bary), vec3(0.0005));
	vec3 edge3 = 1.0 - smoothstep(fw * 0.20, fw * 1.05, bary);
	float edge = max(edge3.x, max(edge3.y, edge3.z));
	vec3 core3 = 1.0 - smoothstep(vec3(0.0), fw * 0.55, bary);
	float core = max(core3.x, max(core3.y, core3.z));

	vec3 vd = bary / fw;
	float vdot = exp(-min(length(vd.yz), min(length(vd.xz), length(vd.xy))) * 1.15);

	float h_mix = clamp((v_pos.y + 1.0) / 2.25, 0.0, 1.0);
	vec3 base_col = mix(col_a, col_b, smoothstep(0.15, 0.85, h_mix));
	float shimmer = 1.0 + highs * 0.14 * sin(time * 32.0 + v_pos.y * 8.0);
	float trace = max(edge * 0.78, vdot * 0.62);

	vec3 rgb = vec3(0.0);
	if (v_tag > 0.90) {
		// Deep mouth void: black in ink mode, dark ink in paper mode.
		rgb = paper > 0.5 ? vec3(0.95) : vec3(0.0);
	} else if (v_tag > 0.65) {
		// Lip rim: highlighted during speech without over-blooming the mouth opening.
		vec3 lip_col = mix(col_b, col_w, 0.20 + 0.45 * speech_pulse);
		rgb = lip_col * max(edge * 0.76, vdot * 0.58) + col_w * (core * (0.14 + 0.22 * speech_pulse));
	} else if (v_tag > 0.42) {
		// Glowing diamond eye pupils.
		float eye_glow = (1.0 - blink * 0.85) * (0.30 + 0.38 * speech_pulse);
		vec3 eye_col = mix(col_b, col_w, 0.3 + 0.5 * speech_pulse);
		rgb = eye_col * max(edge * 0.95, eye_glow) + col_w * (core * 0.35 * (1.0 - blink * 0.8));
	} else if (v_tag > 0.18) {
		// Recessed eye socket bevel.
		rgb = col_a * (trace * 0.55) + col_w * (core * 0.12);
	} else {
		// Main low-poly cranium / face wireframe.
		float boost = 0.72 + 0.26 * speech_pulse;
		vec3 wire_col = mix(base_col, col_w, clamp(core * 0.35 + speech_pulse * 0.25, 0.0, 1.0));
		rgb = wire_col * (trace * boost) + col_w * (core * 0.18);
	}

	ALBEDO = clamp(rgb * shimmer, vec3(0.0), vec3(1.0));
}
