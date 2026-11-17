shader_type canvas_item;
render_mode blend_disabled;
// The text-mode screen's memory, one texel per character cell: r glyph, g foreground, b background (palette
// indices). Each frame keeps what was there (so moving windows leave their stamps behind), lets a share of old
// cells dissolve, wipes the cleared bar, then stamps every window on top in order.
uniform sampler2D prev : filter_nearest;
uniform sampler2D source : filter_linear;
uniform vec2 grid = vec2(200.0, 72.0);
uniform vec4 wins[24];
// x style, y colour index, z seed
uniform vec4 wstyle[24];
uniform int count = 0;
uniform float keep = 0.99;
uniform float frame = 0.0;
uniform float time = 0.0;
uniform vec4 clear_rect = vec4(-1.0);
uniform float bands[16];
// 0 windows, 1 scan
uniform int mode = 0;
uniform float scan = 0.0;
uniform float first = 0.0;
// MumbleSpeak flash overlay
uniform int flash_chars[24];
uniform vec4 flash_box = vec4(-1.0);
// x = len, y = pixel scale (1..3), z = env (0..1), w = seq
uniform vec4 flash_info = vec4(0.0);
uniform vec2 flash_span = vec2(0.0);

const int FONT_CELL[36] = int[36](31599, 11415, 29671, 29647, 23497, 31183, 31215, 29257, 31727, 31695, 31725, 27566, 31015, 27502, 31207, 31204,
	31087, 23533, 29847, 4719, 23469, 18727, 24557, 27501, 31599, 31716, 31609, 31661, 31183, 29842, 23407, 23402, 23549, 23213, 23186, 29351);

int font_bit(int g, int fx, int fy) {
	if (fx < 0 || fx >= 3 || fy < 0 || fy >= 5) return 0;
	if (g >= 20 && g < 56) return (FONT_CELL[g - 20] >> (14 - (fy * 3 + fx))) & 1;
	if (g >= 56 && g < 63) {
		const int PUNCT[7] = int[7](2, 20, 9346, 29314, 9216, 448, 1040);
		return (PUNCT[g - 56] >> (14 - (fy * 3 + fx))) & 1;
	}
	return 0;
}

float h1(vec2 q) { return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453); }
vec4 put(float glyph, float fg, float bg) { return vec4(glyph / 255.0, fg / 8.0, bg / 8.0, 1.0); }
float lum(vec2 uv) {
	vec4 c = texture(source, uv);
	return max(c.r, max(c.g, c.b)) * c.a;
}
vec4 shade(float l, float fg) {
	if (l < 0.04) return put(0.0, 0.0, 1.0);
	if (l < 0.12) return put(11.0, fg, 1.0);
	if (l < 0.28) return put(8.0, fg, 1.0);
	if (l < 0.5) return put(9.0, fg, 1.0);
	if (l < 0.75) return put(10.0, fg, 1.0);
	return put(1.0, fg, 1.0);
}

void fragment() {
	vec2 cell = floor(UV * grid);
	vec4 o = texture(prev, UV);
	if (h1(cell + frame * 0.37) > keep) o = vec4(0.0, 0.0, 0.0, 1.0);
	if (cell.x >= clear_rect.x && cell.y >= clear_rect.y && cell.x < clear_rect.x + clear_rect.z && cell.y < clear_rect.y + clear_rect.w) o = vec4(0.0, 0.0, 0.0, 1.0);
	if (mode == 1) {
		float l = lum(UV);
		vec4 s = shade(l, l > 0.6 ? 4.0 : 2.0);
		if (l >= 0.04) o = vec4(s.rg, 0.0, 1.0);
		float row = floor(scan * grid.y);
		if (cell.y == row) o = put(1.0, 3.0, 0.0);
		else if (cell.y == row + 1.0 && h1(cell + floor(time * 12.0)) > 0.5) o = put(20.0 + floor(h1(cell + 9.0) * 36.0), 3.0, 0.0);
	}
	for (int i = 0; i < count; i++) {
		vec4 r = vec4(floor(wins[i].xy), max(vec2(4.0, 3.0), floor(wins[i].zw)));
		vec2 l = cell - r.xy;
		if (l.x < 0.0 || l.y < 0.0 || l.x >= r.z || l.y >= r.w) continue;
		float style = wstyle[i].x;
		float col = wstyle[i].y;
		float seed = wstyle[i].z;
		bool left = l.x < 0.5, right = l.x > r.z - 1.5, top = l.y < 0.5, bottom = l.y > r.w - 1.5;
		if (left || right || top || bottom) {
			float g = top || bottom ? 2.0 : 3.0;
			if (top && left) g = 4.0;
			else if (top && right) g = 5.0;
			else if (bottom && left) g = 6.0;
			else if (bottom && right) g = 7.0;
			o = put(g, style < 0.5 ? 1.0 : col, style < 0.5 ? col : 1.0);
			if (top && r.z > 8.0) {
				if (l.x == 2.0) o = put(13.0, 3.0, 1.0);
				else if (l.x == 3.0) o = put(20.0 + floor(h1(vec2(seed, 1.0)) * 36.0), 3.0, 1.0);
				else if (l.x == 4.0) o = put(14.0, 3.0, 1.0);
			}
			continue;
		}
		vec2 q = (l - 1.0) / max(vec2(1.0), r.zw - 2.0);
		if (style < 0.5) o = put(0.0, 0.0, col);
		else if (style < 1.5) o = put(0.0, 0.0, 1.0);
		else if (style < 2.5) {
			float b = bands[int(clamp(q.x * 16.0, 0.0, 15.0))];
			o = 1.0 - q.y < b * 1.6 ? put(1.0, col, 1.0) : put(0.0, 0.0, 1.0);
		} else if (style < 3.5) o = shade(lum((cell + 0.5) / grid), 4.0);
		else if (style < 4.5) o = put(12.0, 4.0, 1.0);
		else {
			vec2 t = vec2(l.x, l.y + floor(time * 6.0));
			o = h1(t + seed) > 0.45 ? put(20.0 + floor(h1(t + seed + 3.0) * 36.0), col, 1.0) : put(0.0, 0.0, 1.0);
		}
	}
	if (flash_info.z > 0.03 && flash_info.x > 0.5) {
		vec4 fb = floor(flash_box);
		vec2 fl = cell - fb.xy;
		if (fl.x >= 0.0 && fl.y >= 0.0 && fl.x < fb.z && fl.y < fb.w) {
			float env = flash_info.z;
			bool hit = env > 0.62;
			bool left = fl.x < 0.5, right = fl.x > fb.z - 1.5, top = fl.y < 0.5, bottom = fl.y > fb.w - 1.5;
			if (left || right || top || bottom) {
				float g = top || bottom ? 2.0 : 3.0;
				if (top && left) g = 4.0;
				else if (top && right) g = 5.0;
				else if (bottom && left) g = 6.0;
				else if (bottom && right) g = 7.0;
				o = put(g, hit ? 1.0 : 3.0, hit ? 3.0 : 1.0);
			} else {
				int ix = int(fl.x) - 2;
				int iy = int(fl.y) - 2;
				int len = int(flash_info.x + 0.5);
				int sc = max(1, int(flash_info.y + 0.5));
				if (sc == 1) {
					bool syl = float(ix) >= flash_span.x && float(ix) < flash_span.y;
					float fg = hit ? 1.0 : (syl ? 3.0 : 4.0);
					float bg = hit ? (syl ? 4.0 : 3.0) : 1.0;
					if (iy == 0 && ix >= 0 && ix < len && ix < 24) {
						o = put(float(flash_chars[ix]), fg, bg);
					} else {
						o = put(0.0, 0.0, bg);
					}
				} else {
					int stride = 4 * sc;
					int ci = ix >= 0 ? ix / stride : -1;
					int lx = ix - ci * stride;
					int cw = 3 * sc;
					int ch = 5 * sc;
					bool syl = float(ci) >= flash_span.x && float(ci) < flash_span.y;
					float fg = hit ? 1.0 : (syl ? 3.0 : 4.0);
					float bg = hit ? (syl ? 4.0 : 3.0) : 1.0;
					if (ci >= 0 && ci < len && ci < 24 && lx < cw && iy >= 0 && iy < ch) {
						int bit = font_bit(flash_chars[ci], lx / sc, iy / sc);
						o = bit > 0 ? put(env < 0.22 ? 10.0 : 1.0, fg, bg) : put(0.0, 0.0, bg);
					} else {
						o = put(0.0, 0.0, bg);
					}
				}
			}
		}
	}
	if (first > 0.5) o = vec4(0.0, 0.0, 0.0, 1.0);
	COLOR = o;
}
