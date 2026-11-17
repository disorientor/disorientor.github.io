/**
 * Godot .gdshader -> WebGL2 GLSL ES 3.00 Transpiler
 * Preserves original Haecceity backgrounds (51), glitch shaders (40),
 * and composition foreground field shaders (34) verbatim without simplifying them.
 */

export const QUAD_VERT_SRC = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function cleanUniforms(src) {
  return src.replace(
    /^(\s*uniform\s+\w+\s+\w+(?:\[\d+\])?)(?:\s*:\s*[^=;]+)?(?:\s*=\s*[^;]+)?;/gm,
    '$1;'
  );
}

function stripLocalConstArrays(src) {
  return src.replace(
    /^([ \t]+)const\s+(\w+\s+\w+\[\d+\]\s*=)/gm,
    '$1$2'
  );
}

function inlineIncludes(src, includes = {}) {
  return src.replace(/#include\s+"([^"]+)"/g, (_m, name) => {
    const key = name.split('/').pop();
    return includes[key] || includes[name] || '';
  });
}

function rewriteTextureCalls(src) {
  return src
    .replace(/\btextureLod\s*\(/g, 'gd_texLod(')
    .replace(/\btexture\s*\(/g, 'gd_tex(');
}

function extractFunctionBlock(src, fnName) {
  const re = new RegExp(`void\\s+${fnName}\\s*\\(\\s*\\)\\s*\\{`);
  const m = re.exec(src);
  if (!m) return null;
  const openIdx = m.index + m[0].length - 1;
  let depth = 0;
  let endIdx = -1;
  for (let i = openIdx; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) {
        endIdx = i;
        break;
      }
    }
  }
  if (endIdx === -1) return null;
  return {
    full: src.slice(m.index, endIdx + 1),
    body: src.slice(openIdx + 1, endIdx),
  };
}

function convertVaryings(src, dir) {
  // Handle `varying flat float x;` -> `flat out float x;` / `flat in float x;`
  return src
    .replace(/^\s*varying\s+(flat|smooth|noperspective)\s+/gm, `$1 ${dir} `)
    .replace(/^\s*varying\s+/gm, `${dir} `);
}

/**
 * Transpile a Godot `canvas_item` fullscreen .gdshader into a WebGL2 Fragment Shader.
 */
export function transpileCanvasItem(rawSrc, includes = {}) {
  let body = inlineIncludes(rawSrc, includes);
  body = stripComments(body);
  body = body.replace(/^\s*shader_type\s+\w+\s*;\s*/gm, '');
  body = body.replace(/^\s*render_mode\s+[^;]+;\s*/gm, '');
  body = cleanUniforms(body);
  body = stripLocalConstArrays(body);
  body = rewriteTextureCalls(body);
  body = body.replace(/\bactive\b/g, 'gd_active').replace(/\bpatch\b/g, 'gd_patch');

  const hasURes = /\buniform\s+vec2\s+u_resolution\b/.test(body);
  const hasUTime = /\buniform\s+float\s+u_time\b/.test(body);
  const hasTDiffuse = /\buniform\s+sampler2D\s+tDiffuse\b/.test(body);
  const usesTextureBuiltin = /\bTEXTURE\b/.test(body);

  const fragBlock = extractFunctionBlock(body, 'fragment');
  if (!fragBlock) {
    throw new Error('transpileCanvasItem: missing void fragment()');
  }

  const preBody = body.replace(fragBlock.full, '');
  const innerFrag = fragBlock.body.replace(/\bCOLOR\b/g, 'gd_out_color');

  const header = `#version 300 es
precision highp float;
precision highp int;

in vec2 v_uv;
out vec4 outColor;

#ifndef PI
#define PI 3.14159265359
#endif
#ifndef TAU
#define TAU 6.28318530718
#endif
#ifndef E
#define E 2.71828182846
#endif

${hasURes ? '' : 'uniform vec2 u_resolution;'}
${hasUTime ? '' : 'uniform float u_time;'}
${(!hasTDiffuse && usesTextureBuiltin) ? 'uniform sampler2D tDiffuse;' : ''}
${usesTextureBuiltin ? '#define TEXTURE tDiffuse' : ''}

vec4 gd_tex(sampler2D s, vec2 uv) {
  return texture(s, vec2(uv.x, 1.0 - uv.y));
}
vec4 gd_texLod(sampler2D s, vec2 uv, float lod) {
  return textureLod(s, vec2(uv.x, 1.0 - uv.y), lod);
}
vec4 gd_out_color;
`;

  return `${header}
${preBody}
void gd_fragment() {
  vec2 UV = vec2(v_uv.x, 1.0 - v_uv.y);
  vec2 SCREEN_UV = UV;
  vec2 SCREEN_PIXEL_SIZE = 1.0 / max(vec2(1.0), u_resolution);
  vec2 TEXTURE_PIXEL_SIZE = SCREEN_PIXEL_SIZE;
  float TIME = u_time;
  vec4 FRAGCOORD = vec4(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y, gl_FragCoord.zw);
  gd_out_color = vec4(0.0);
  ${innerFrag}
}
void main() {
  gd_fragment();
  outColor = gd_out_color;
}
`;
}

/**
 * Transpile an instanced / particle `canvas_item` shader (glyphs, shards, colony_points, attractor_points).
 */
export function transpileInstancedCanvasItem(rawSrc, { isPoints = false } = {}) {
  let body = stripComments(rawSrc);
  body = body.replace(/^\s*shader_type\s+\w+\s*;\s*/gm, '');
  body = body.replace(/^\s*render_mode\s+[^;]+;\s*/gm, '');
  body = cleanUniforms(body);
  body = stripLocalConstArrays(body);

  const vertBlock = extractFunctionBlock(body, 'vertex');
  const fragBlock = extractFunctionBlock(body, 'fragment');
  let shared = body;
  if (vertBlock) shared = shared.replace(vertBlock.full, '');
  if (fragBlock) shared = shared.replace(fragBlock.full, '');

  const hasRes = /\buniform\s+vec2\s+res\b/.test(shared);
  const sharedVert = convertVaryings(shared, 'out');
  const sharedFrag = convertVaryings(shared, 'in');

  const vertBody = (vertBlock ? vertBlock.body : '')
    .replace(/\bINSTANCE_ID\b/g, 'gl_InstanceID')
    .replace(/\bVERTEX\b/g, 'gd_vertex');

  const fragBody = (fragBlock ? fragBlock.body : '')
    .replace(/\bCOLOR\b/g, 'gd_out_color')
    .replace(/\bUV\b/g, 'v_uv');

  const vert = `#version 300 es
precision highp float;
precision highp int;
in vec2 a_pos;
in vec2 a_uv;
out vec2 v_uv;
#ifndef PI
#define PI 3.14159265359
#endif
#ifndef TAU
#define TAU 6.28318530718
#endif
${hasRes ? '' : 'uniform vec2 res;'}
${sharedVert}
void main() {
  vec2 gd_vertex = a_pos;
  v_uv = a_uv;
  ${vertBody}
  vec2 clip = vec2((gd_vertex.x / max(1.0, res.x)) * 2.0 - 1.0, 1.0 - (gd_vertex.y / max(1.0, res.y)) * 2.0);
  gl_Position = vec4(clip, 0.0, 1.0);
  ${isPoints ? 'gl_PointSize = max(1.0, size);' : ''}
}`;

  const frag = `#version 300 es
precision highp float;
precision highp int;
in vec2 v_uv;
out vec4 outColor;
#ifndef PI
#define PI 3.14159265359
#endif
#ifndef TAU
#define TAU 6.28318530718
#endif
${sharedFrag}
void main() {
  vec4 gd_out_color = vec4(0.0);
  ${fragBody}
  outColor = gd_out_color;
}`;

  return { vert, frag };
}

/**
 * Transpile a Godot `spatial` .gdshader (terrain_mesh, terrain_head).
 */
export function transpileSpatial(rawSrc) {
  let body = stripComments(rawSrc);
  body = body.replace(/^\s*shader_type\s+\w+\s*;\s*/gm, '');
  body = body.replace(/^\s*render_mode\s+[^;]+;\s*/gm, '');
  body = cleanUniforms(body);
  body = stripLocalConstArrays(body);

  const vertBlock = extractFunctionBlock(body, 'vertex');
  const fragBlock = extractFunctionBlock(body, 'fragment');
  let shared = body;
  if (vertBlock) shared = shared.replace(vertBlock.full, '');
  if (fragBlock) shared = shared.replace(fragBlock.full, '');

  const sharedVert = convertVaryings(shared, 'out');
  const sharedFrag = convertVaryings(shared, 'in');

  const vertBody = (vertBlock ? vertBlock.body : '')
    .replace(/\bVERTEX\b/g, 'gd_vertex')
    .replace(/\bCOLOR\b/g, 'a_color')
    .replace(/\bUV\b/g, 'a_uv');

  const fragBody = (fragBlock ? fragBlock.body : '')
    .replace(/\bALBEDO\b/g, 'gd_albedo')
    .replace(/\bUV\b/g, 'v_uv')
    .replace(/\bTIME\b/g, 'time');

  const vert = `#version 300 es
precision highp float;
precision highp int;
in vec3 a_pos;
in vec2 a_uv;
in vec4 a_color;
out vec2 v_uv;
uniform mat4 u_mvp;
#ifndef PI
#define PI 3.14159265359
#endif
#ifndef TAU
#define TAU 6.28318530718
#endif
${sharedVert}
void main() {
  vec3 gd_vertex = a_pos;
  v_uv = a_uv;
  ${vertBody}
  gl_Position = u_mvp * vec4(gd_vertex, 1.0);
}`;

  const frag = `#version 300 es
precision highp float;
precision highp int;
in vec2 v_uv;
out vec4 outColor;
#ifndef PI
#define PI 3.14159265359
#endif
#ifndef TAU
#define TAU 6.28318530718
#endif
${sharedFrag}
void main() {
  vec3 gd_albedo = vec3(0.0);
  ${fragBody}
  outColor = vec4(gd_albedo, 1.0);
}`;

  return { vert, frag };
}
