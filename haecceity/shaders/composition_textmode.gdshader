shader_type canvas_item;
// The text-mode screen: each cell of the memory texture drawn as a glyph in its two palette colours. Box
// lines, blocks and shades are drawn as shapes; letters and digits come from a 3x5 pixel font.
uniform sampler2D cells : filter_nearest;
uniform vec2 grid = vec2(200.0, 72.0);
uniform float amount = 1.0;
uniform vec3 col_a : source_color = vec3(0.25, 0.76, 0.79);
uniform vec3 col_b : source_color = vec3(0.84, 1.0, 0.25);
uniform vec3 col_w : source_color = vec3(0.96);
uniform vec3 col_k : source_color = vec3(0.0);
const int FONT[36] = int[36](31599, 11415, 29671, 29647, 23497, 31183, 31215, 29257, 31727, 31695, 31725, 27566, 31015, 27502, 31207, 31204,
	31087, 23533, 29847, 4719, 23469, 18727, 24557, 27501, 31599, 31716, 31609, 31661, 31183, 29842, 23407, 23402, 23549, 23213, 23186, 29351);

vec4 pal(int i) {
	if (i == 1) return vec4(col_k, 1.0);
	if (i == 2) return vec4(col_a, 1.0);
	if (i == 3) return vec4(col_b, 1.0);
	if (i == 4) return vec4(col_w, 1.0);
	return vec4(0.0);
}

float glyph(int g, vec2 f) {
	float hx = step(abs(f.y - 0.5), 0.07);
	float vx = step(abs(f.x - 0.5), 0.1);
	if (g == 1) return 1.0;
	if (g == 2) return hx;
	if (g == 3) return vx;
	if (g == 4) return max(hx * step(0.4, f.x), vx * step(0.43, f.y));
	if (g == 5) return max(hx * step(f.x, 0.6), vx * step(0.43, f.y));
	if (g == 6) return max(hx * step(0.4, f.x), vx * step(f.y, 0.57));
	if (g == 7) return max(hx * step(f.x, 0.6), vx * step(f.y, 0.57));
	vec2 p = floor(f * vec2(4.0, 8.0));
	if (g == 8) return step(mod(p.x + p.y * 2.0, 4.0), 0.5);
	if (g == 9) return step(mod(p.x + p.y, 2.0), 0.5);
	if (g == 10) return 1.0 - step(mod(p.x + p.y * 2.0, 4.0), 0.5);
	if (g == 11) return step(length((f - 0.5) * vec2(1.0, 1.8)), 0.16);
	if (g == 12) return step(fract(f.x * 2.0), 0.5);
	if (g == 13 || g == 14) {
		float x = g == 13 ? f.x : 1.0 - f.x;
		float bar = step(0.3, x) * step(x, 0.46) * step(0.14, f.y) * step(f.y, 0.86);
		float caps = step(0.3, x) * step(x, 0.76) * (step(0.14, f.y) * step(f.y, 0.26) + step(0.74, f.y) * step(f.y, 0.86));
		return max(bar, caps);
	}
	if (g >= 20 && g < 56) {
		vec2 q = (f - vec2(0.16, 0.14)) / vec2(0.68, 0.72);
		if (q.x < 0.0 || q.y < 0.0 || q.x >= 1.0 || q.y >= 1.0) return 0.0;
		ivec2 c = ivec2(q * vec2(3.0, 5.0));
		return float((FONT[g - 20] >> (14 - (c.y * 3 + c.x))) & 1);
	}
	if (g >= 56 && g < 63) {
		const int PUNCT[7] = int[7](2, 20, 9346, 29314, 9216, 448, 1040);
		vec2 q = (f - vec2(0.16, 0.14)) / vec2(0.68, 0.72);
		if (q.x < 0.0 || q.y < 0.0 || q.x >= 1.0 || q.y >= 1.0) return 0.0;
		ivec2 c = ivec2(q * vec2(3.0, 5.0));
		return float((PUNCT[g - 56] >> (14 - (c.y * 3 + c.x))) & 1);
	}
	return 0.0;
}

void fragment() {
	vec2 g = UV * grid;
	vec2 c = floor(g);
	vec4 s = texture(cells, (c + 0.5) / grid);
	int gl = int(s.r * 255.0 + 0.5);
	int fg = int(s.g * 8.0 + 0.5);
	int bg = int(s.b * 8.0 + 0.5);
	vec4 back = pal(bg);
	vec4 front = pal(fg);
	float m = glyph(gl, fract(g)) * front.a;
	vec4 o = mix(back, vec4(front.rgb, 1.0), m);
	COLOR = vec4(o.rgb, o.a * clamp(amount, 0.0, 1.0));
}
