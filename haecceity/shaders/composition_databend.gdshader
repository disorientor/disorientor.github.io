shader_type canvas_item;
// Databending over the finished frame: macroblock displacement, pixel sorting along bands, simulated
// compression (luma quantised per 8x8 block, chroma shared per 16x16, ringing at block edges) and the
// datamosh picture from the mosh ping-pong. Kicks raise block hits and drop I-frames (mosh), bass sets the
// displacement reach, highs lower the sort threshold, flux widens the crushed area.
uniform sampler2D screen : hint_screen_texture, filter_linear_mipmap;
uniform sampler2D mosh_tex : filter_linear;
uniform vec2 res = vec2(1600.0, 1020.0);
uniform float time = 0.0;
uniform float amount = 0.0;
uniform float kick = 0.0;
uniform float bass = 0.0;
uniform float highs = 0.0;
uniform float flux = 0.0;
uniform float sort_angle = 0.0;
uniform float mosh = 0.0;
uniform float sort_amt = 1.0;
uniform float block_amt = 1.0;
uniform float crush_amt = 1.0;

float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
vec3 rgb2yuv(vec3 c) { return vec3(luma(c), dot(c, vec3(-0.147, -0.289, 0.436)), dot(c, vec3(0.615, -0.515, -0.100))); }
vec3 yuv2rgb(vec3 y) { return vec3(y.x + 1.140 * y.z, y.x - 0.395 * y.y - 0.581 * y.z, y.x + 2.032 * y.y); }

vec3 frame(vec2 uv) {
	vec3 c = textureLod(screen, uv, 0.0).rgb;
	return mosh > 0.001 ? mix(c, texture(mosh_tex, uv).rgb, mosh) : c;
}

void fragment() {
	vec2 uv = SCREEN_UV;
	vec2 px = uv * res;
	float a = amount;
	// Macroblocks: some jump by whole blocks, more of them on a kick.
	float bs = 16.0;
	vec2 blk = floor(px / bs);
	float tq = floor(time * mix(4.0, 14.0, a));
	float hit = step(1.0 - (0.04 + 0.35 * kick) * a * block_amt, h(blk + tq));
	vec2 jump = floor((vec2(h(blk + tq + 2.0), h(blk + tq + 5.0)) - 0.5) * mix(2.0, 12.0, bass)) * bs;
	vec2 suv = (px + jump * hit) / res;

	// Pixel sorting inside some bands: find the run of bright pixels around this one, then take the colour
	// at the place this pixel's brightness would rank within the run.
	vec2 dir = vec2(cos(sort_angle), sin(sort_angle));
	vec2 perp = vec2(-dir.y, dir.x);
	float band = floor(dot(px, perp) / 6.0);
	vec3 c = frame(suv);
	float thresh = mix(0.75, 0.25, highs) + 0.2 * (1.0 - a);
	if (h(vec2(band, floor(time * 1.5))) < a * 0.55 * sort_amt && luma(c) > thresh) {
		float step_px = 5.0;
		float lo = 0.0, hi = 0.0;
		for (int i = 1; i <= 28; i++) {
			if (luma(frame(suv - dir * step_px * float(i) / res)) < thresh) break;
			lo = float(i);
		}
		for (int i = 1; i <= 28; i++) {
			if (luma(frame(suv + dir * step_px * float(i) / res)) < thresh) break;
			hi = float(i);
		}
		float rank = clamp((luma(c) - thresh) / (1.0 - thresh), 0.0, 1.0);
		float at = mix(-lo, hi, rank);
		c = frame(suv + dir * step_px * at / res);
	}

	// Compression crush in patches that come and go: 8x8 luma steps, 16x16 shared chroma, edge ringing.
	vec2 patch = floor(px / 64.0);
	if (h(patch + floor(time * 2.0) * 3.7) < a * (0.12 + 0.4 * flux) * crush_amt) {
		vec2 b8 = floor(px / 8.0) * 8.0;
		vec3 dc = rgb2yuv(frame((b8 + 4.0) / res));
		vec3 yuv = rgb2yuv(c);
		float q = mix(10.0, 3.0, a);
		yuv.x = mix(dc.x, floor(yuv.x * q + 0.5) / q, 0.5);
		vec3 ch = rgb2yuv(frame((floor(px / 16.0) * 16.0 + 8.0) / res));
		yuv.yz = floor(ch.yz * 12.0 + 0.5) / 12.0;
		vec2 f = fract(px / 8.0);
		yuv.x += (cos(f.x * 3.14159 * 3.0) * cos(f.y * 3.14159 * 2.0)) * 0.04 * a;
		c = yuv2rgb(yuv);
	}
	// Faint block seams on the hit blocks.
	vec2 seam = step(vec2(bs - 1.0), mod(px, bs));
	c *= 1.0 - max(seam.x, seam.y) * hit * 0.35;
	COLOR = vec4(clamp(c, 0.0, 1.0), 1.0);
}
