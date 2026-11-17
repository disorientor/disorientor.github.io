shader_type canvas_item;
render_mode blend_disabled;
// Cellular automata, one generation per buffer. r: the cell (alive 0/1, or Lenia's continuous mass), g: a
// trail that fades after a cell dies, b: the cyclic automaton's state or a Brian's Brain cell dying.
// Rules: 0 Life-like (birth/survive bitmasks), 1 Lenia (ring kernel, Gaussian growth), 2 cyclic (12 states,
// a cell advances when enough neighbours are one ahead), 3 Brian's Brain. Drops seed noise where kicks land.
uniform sampler2D state : filter_nearest, repeat_enable;
uniform vec2 res = vec2(266.0, 170.0);
uniform int rule = 0;
uniform int birth = 8;
uniform int survive = 12;
uniform float mu = 0.15;
uniform float sigma = 0.017;
uniform int threshold = 2;
uniform float trail = 0.9;
uniform float first = 0.0;
uniform float time = 0.0;
uniform vec4 drops[4];

float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec4 at(vec2 uv, vec2 o) { return texture(state, uv + o / res); }

void fragment() {
	vec2 uv = UV;
	vec4 c = texture(state, uv);
	float cell = c.r;
	float b = c.b;
	if (rule == 0 || rule == 3) {
		int n = 0;
		for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
			if (x == 0 && y == 0) continue;
			n += int(at(uv, vec2(float(x), float(y))).r > 0.5);
		}
		if (rule == 0) {
			bool alive = cell > 0.5;
			bool next = alive ? ((survive >> n) & 1) == 1 : ((birth >> n) & 1) == 1;
			cell = next ? 1.0 : 0.0;
		} else {
			// Brian's Brain: on -> dying -> off; off fires with exactly two neighbours on.
			bool on = cell > 0.5;
			bool dying = b > 0.5;
			cell = (!on && !dying && n == 2) ? 1.0 : 0.0;
			b = on ? 1.0 : 0.0;
		}
	} else if (rule == 1) {
		// Ring kernel of radius 6, peaked at half the radius.
		float sum = 0.0, wsum = 0.0;
		for (int y = -6; y <= 6; y++) for (int x = -6; x <= 6; x++) {
			float r = length(vec2(float(x), float(y))) / 6.0;
			if (r > 1.0 || r < 1e-3) continue;
			float w = exp(4.0 - 1.0 / (r * (1.0 - r) + 1e-4));
			sum += at(uv, vec2(float(x), float(y))).r * w;
			wsum += w;
		}
		float u = sum / wsum;
		float g = 2.0 * exp(-pow(u - mu, 2.0) / (2.0 * sigma * sigma)) - 1.0;
		cell = clamp(cell + 0.1 * g, 0.0, 1.0);
	} else {
		float next = mod(floor(b * 12.0 + 0.5) + 1.0, 12.0);
		int n = 0;
		for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
			if (x == 0 && y == 0) continue;
			n += int(abs(floor(at(uv, vec2(float(x), float(y))).b * 12.0 + 0.5) - next) < 0.5);
		}
		if (n >= threshold) b = next / 12.0;
		cell = b;
	}
	float tr = max(c.g * trail, rule == 2 ? 0.0 : cell);
	if (first > 0.5) {
		for (int i = 0; i < 4; i++) {
			vec2 d = (uv - drops[i].xy) * vec2(res.x / res.y, 1.0);
			if (length(d) < drops[i].z) {
				float r = h(floor(uv * res) + time);
				if (rule == 2) b = floor(r * 12.0) / 12.0;
				else if (rule == 1) cell = max(cell, r * drops[i].w);
				else cell = r < 0.4 * drops[i].w ? 1.0 : cell;
			}
		}
	}
	COLOR = vec4(cell, tr, b, 1.0);
}
