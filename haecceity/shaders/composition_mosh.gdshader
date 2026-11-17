shader_type canvas_item;
// Datamosh, one P-frame per render: the held picture (prev, this shader's own last output) is pushed along
// motion vectors estimated per macroblock from the live t-1 copy (cur), and only blocks that win the
// `refresh` draw repaint from cur. refresh 1 is a clean I-frame; near 0 the old frame smears on and on.
uniform sampler2D cur : filter_linear;
uniform sampler2D prev : filter_linear;
uniform vec2 res = vec2(800.0, 510.0);
uniform float refresh = 1.0;
uniform float time = 0.0;
uniform float push = 1.0;

float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

void fragment() {
	vec2 uv = UV;
	vec2 texel = 1.0 / res;
	float bs = 8.0;
	vec2 blk = floor(uv * res / bs);
	vec2 bc = (blk + 0.5) * bs * texel;
	// One-tap gradient flow at the block centre: brightness change over brightness slope.
	float lc = luma(texture(cur, bc).rgb);
	float lp = luma(texture(prev, bc).rgb);
	float gx = luma(texture(cur, bc + vec2(texel.x * 2.0, 0.0)).rgb) - luma(texture(cur, bc - vec2(texel.x * 2.0, 0.0)).rgb);
	float gy = luma(texture(cur, bc + vec2(0.0, texel.y * 2.0)).rgb) - luma(texture(cur, bc - vec2(0.0, texel.y * 2.0)).rgb);
	vec2 g = vec2(gx, gy);
	vec2 mv = -(lc - lp) * g / (dot(g, g) + 0.02);
	// Codecs reuse a neighbour's vector when theirs is lost; a slow seeded drift keeps every block moving.
	float tq = floor(time * 3.0);
	mv += (vec2(h(blk + tq), h(blk + tq + 9.1)) - 0.5) * 0.6;
	mv = clamp(mv * push, vec2(-3.0), vec2(3.0)) * bs * texel;
	vec3 held = texture(prev, uv - mv).rgb;
	float repaint = step(h(blk * 1.31 + floor(time * 24.0)), refresh);
	COLOR = vec4(mix(held, texture(cur, uv).rgb, max(repaint, step(0.999, refresh))), 1.0);
}
