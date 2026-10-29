/* ---------- shader engine ----------
   Runs the ported Haecceity shaders. Godot's built-ins are plain globals here: main() sets them, calls the
   shader's own fragment()/vertex() unchanged, then reads COLOR (canvas) or ALBEDO/EMISSION/ALPHA (spatial).
   Orientation follows Godot: UV (0,0) is the top-left of the picture, which sits at row 0 of every texture
   and render target, so passes chain without flips; only the final blit to the screen flips. */
const SP_INSTANCES = {
  composition_points: u => (u.grid ? u.grid[0] * u.grid[1] : 16000),
  composition_attractor_points: u => (u.side ? u.side[0] * u.side[0] : 16384)
};
const SP_CENTRED = { composition_window: 1 };

function spSource(s, stage) {
  const spatial = s.kind === 'spatial';
  const vs = stage === 'vs';
  const vary = s.varyings.map(v => {
    const m = v.match(/^(flat\s+|smooth\s+)?(.*)$/);
    return `${m[1] || ''}${vs ? 'out' : 'in'} ${m[2]};`;
  }).join('\n');
  const head = `#version 300 es
precision highp float; precision highp int; precision highp sampler2D;
uniform vec2 sp_res; uniform float TIME; uniform sampler2D TEXTURE; uniform float sp_centred;
vec2 UV; vec2 UV2; vec4 COLOR; vec4 FRAGCOORD; vec2 SCREEN_UV; vec2 SCREEN_PIXEL_SIZE; vec2 TEXTURE_PIXEL_SIZE;
${spatial ? 'vec3 VERTEX; vec3 NORMAL; vec3 TANGENT; vec3 BINORMAL; vec3 VIEW; vec3 ALBEDO; float ALPHA; vec3 EMISSION; float ROUGHNESS; float METALLIC; float SPECULAR; float AO; float RIM; vec3 NORMAL_MAP; bool FRONT_FACING; mat4 MODEL_MATRIX; mat4 VIEW_MATRIX; mat4 PROJECTION_MATRIX; mat4 INV_VIEW_MATRIX; vec3 CAMERA_POSITION_WORLD; vec4 POSITION;'
           : 'vec2 VERTEX; vec2 POINT_COORD; float POINT_SIZE; mat4 MODEL_MATRIX; mat4 CANVAS_MATRIX; mat4 SCREEN_MATRIX;'}
int INSTANCE_ID; vec4 INSTANCE_CUSTOM; vec4 CUSTOM0; vec4 CUSTOM1; int VERTEX_ID;
${vary}
${vs ? '#define dFdx(x) ((x) * 0.0)\n#define dFdy(x) ((x) * 0.0)\n#define fwidth(x) ((x) * 0.0)\nin vec2 sp_pos; out vec2 sp_uv; out vec4 sp_col;' : 'in vec2 sp_uv; in vec4 sp_col; out vec4 sp_out;'}
`;
  const strip = (src, fn) => {
    const i = src.indexOf(`void ${fn}()`);
    if (i < 0) return src;
    let j = src.indexOf('{', i), depth = 0, k = j;
    for (; k < src.length; k++) { if (src[k] === '{') depth++; else if (src[k] === '}' && --depth === 0) break; }
    return src.slice(0, i) + src.slice(k + 1);
  };
  // A vertex() body only belongs in the vertex stage, a fragment() body only in the fragment stage.
  const code = strip(s.body, vs ? 'godot_fragment' : 'godot_vertex');
  const init = `UV = sp_uv; UV2 = sp_uv; INSTANCE_ID = 0; INSTANCE_CUSTOM = vec4(0.0); CUSTOM0 = vec4(0.0); CUSTOM1 = vec4(0.0);
  SCREEN_PIXEL_SIZE = 1.0 / sp_res; TEXTURE_PIXEL_SIZE = 1.0 / vec2(textureSize(TEXTURE, 0)); MODEL_MATRIX = mat4(1.0);`;
  if (vs) {
    const inst = !!SP_INSTANCES[s.id];
    return head + code + `
void main() {
  sp_uv = sp_pos * 0.5 + 0.5; sp_col = vec4(1.0);
  ${init}
  INSTANCE_ID = gl_InstanceID; VERTEX_ID = gl_VertexID; COLOR = vec4(1.0);
  ${spatial ? 'VERTEX = vec3((sp_uv - 0.5) * vec2(2.0 * sp_res.x / sp_res.y, -2.0), 0.0); NORMAL = vec3(0.0, 0.0, 1.0); VIEW = NORMAL; VIEW_MATRIX = mat4(1.0); PROJECTION_MATRIX = mat4(1.0); INV_VIEW_MATRIX = mat4(1.0);'
            : inst ? 'VERTEX = sp_pos * 0.5;' : 'VERTEX = sp_centred > 0.5 ? (sp_uv - 0.5) * sp_res : sp_uv * sp_res;'}
  ${s.vertex ? 'godot_vertex(); sp_col = COLOR;' : ''}
  gl_Position = ${!spatial && inst ? 'vec4(VERTEX / sp_res * 2.0 - 1.0, 0.0, 1.0)' : 'vec4(sp_pos, 0.0, 1.0)'};
}`;
  }
  return head + code + `
void main() {
  ${init}
  FRAGCOORD = gl_FragCoord; SCREEN_UV = gl_FragCoord.xy / sp_res;
  ${spatial ? 'VERTEX = vec3((sp_uv - 0.5) * 2.0, 0.0); NORMAL = vec3(0.0, 0.0, 1.0); VIEW = NORMAL; FRONT_FACING = true; ALBEDO = vec3(1.0); ALPHA = 1.0; EMISSION = vec3(0.0); ROUGHNESS = 1.0; METALLIC = 0.0; SPECULAR = 0.5; AO = 1.0; COLOR = sp_col;'
            : 'COLOR = sp_col * texture(TEXTURE, UV); POINT_COORD = UV;'}
  godot_fragment();
  ${spatial ? (s.unshaded ? 'sp_out = vec4(ALBEDO, ALPHA);' : 'sp_out = vec4(ALBEDO * 0.85 + EMISSION, ALPHA);') : 'sp_out = COLOR;'}
}`;
}

class SpEngine {
  constructor(canvas) {
    const gl = this.gl = canvas.getContext('webgl2', { premultipliedAlpha: false, preserveDrawingBuffer: true, antialias: false });
    if (!gl) throw new Error('WebGL2 is not available in this browser.');
    this.float = !!gl.getExtension('EXT_color_buffer_float');
    gl.getExtension('OES_texture_float_linear');
    this.programs = new Map();
    this.errors = {};
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.white = this.texture(1, 1, new Uint8Array([255, 255, 255, 255]));
    this.black = this.texture(1, 1, new Uint8Array([0, 0, 0, 0]));
    this.blitShader = { id: 'sp_blit', kind: 'canvas_item', varyings: [], uniforms: [], samplers: { src: 'src' }, vertex: false,
      body: 'uniform sampler2D src; uniform float flip; void godot_fragment() { COLOR = texture(src, vec2(UV.x, flip > 0.5 ? 1.0 - UV.y : UV.y)); }' };
  }
  texture(w, h, data, float) {
    const gl = this.gl, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    const f = float && this.float;
    gl.texImage2D(gl.TEXTURE_2D, 0, f ? gl.RGBA16F : gl.RGBA8, w, h, 0, gl.RGBA, f ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, data || null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    t.w = w; t.h = h;
    return t;
  }
  // Pictures (photo, type layer) upload with their top row first, matching Godot UV.
  upload(source, tex) {
    const gl = this.gl;
    const w = source.naturalWidth || source.videoWidth || source.width, h = source.naturalHeight || source.videoHeight || source.height;
    if (!tex || tex.w !== w || tex.h !== h) { if (tex) gl.deleteTexture(tex); tex = this.texture(w, h); }
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, source);
    tex.w = w; tex.h = h;
    return tex;
  }
  target(w, h, float) {
    const gl = this.gl, tex = this.texture(w, h, null, float), fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { fb, tex, w, h };
  }
  free(t) { if (t) { this.gl.deleteFramebuffer(t.fb); this.gl.deleteTexture(t.tex); } }
  program(s) {
    let p = this.programs.get(s.id);
    if (p !== undefined) return p;
    const gl = this.gl;
    const compile = (type, src) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error((type === gl.VERTEX_SHADER ? 'vertex: ' : 'fragment: ') + gl.getShaderInfoLog(sh));
      return sh;
    };
    try {
      p = gl.createProgram();
      gl.attachShader(p, compile(gl.VERTEX_SHADER, spSource(s, 'vs')));
      gl.attachShader(p, compile(gl.FRAGMENT_SHADER, spSource(s, 'fs')));
      gl.bindAttribLocation(p, 0, 'sp_pos');
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p));
      p.loc = {};
      const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) {
        const info = gl.getActiveUniform(p, i), name = info.name.replace(/\[0\]$/, '');
        p.loc[name] = { at: gl.getUniformLocation(p, info.name), type: info.type, size: info.size };
      }
    } catch (e) {
      this.errors[s.id] = String(e.message || e);
      p = null;
    }
    this.programs.set(s.id, p);
    return p;
  }
  /* Draws shader s into target (null = the canvas). opts: src/prev textures, bind {sampler: texture},
     values {name: [..]}, time, res, frame, clear, blend. */
  run(s, target, opts = {}) {
    const gl = this.gl, p = this.program(s);
    if (!p) return false;
    const w = target ? target.w : gl.canvas.width, h = target ? target.h : gl.canvas.height;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fb : null);
    gl.viewport(0, 0, w, h);
    gl.useProgram(p);
    gl.bindVertexArray(this.vao);
    const res = opts.res || [w, h], time = opts.time || 0, vals = opts.values || {};
    let unit = 0;
    const inst = SP_INSTANCES[s.id];
    for (const [name, l] of Object.entries(p.loc)) {
      if (l.type === gl.SAMPLER_2D) {
        const role = name === 'TEXTURE' ? (inst ? 'white' : 'src') : (s.samplers[name] || 'src');
        const tex = (opts.bind && opts.bind[name]) || (role === 'white' ? this.white : (opts[role] || opts.src || this.black));
        gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.uniform1i(l.at, unit++);
        continue;
      }
      let v;
      if (name === 'sp_res' || /^(u_resolution|res|resolution)$/.test(name)) v = res;
      else if (/^(TIME|u_time|time|motion_time)$/.test(name)) v = [time];
      else if (name === 'sp_centred') v = [SP_CENTRED[s.id] ? 1 : 0];
      else if (name === 'u_screen_rect') v = [0, 0, 1, 1];
      else if (name === 'half_size') v = [res[0] / 2, res[1] / 2];
      else if (name === 'frame') v = [opts.frame || 0];
      else if (name === 'first') v = [opts.frame ? 0 : 1];
      else if (name === 'has_prev') v = [opts.prev ? 1 : 0];
      else if (vals[name] !== undefined) v = vals[name];
      else { const u = s.uniforms.find(u => u.n === name); v = u ? u.def : null; }
      if (v) this.set(l, v);
    }
    gl.disable(gl.BLEND);
    if (opts.blend !== false && s.blend !== 'none' && (s.blend === 'add' || s.blend === 'mix')) {
      gl.enable(gl.BLEND);
      if (s.blend === 'add') gl.blendFunc(gl.ONE, gl.ONE); else gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }
    if (opts.clear) { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
    if (inst) gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, Math.min(200000, inst(vals) || 1));
    else gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.disable(gl.BLEND);
    return true;
  }
  set(l, v) {
    const gl = this.gl, a = Array.isArray(v) ? v : [v], T = l.type;
    if (T === gl.FLOAT) gl.uniform1fv(l.at, a);
    else if (T === gl.FLOAT_VEC2) gl.uniform2fv(l.at, a);
    else if (T === gl.FLOAT_VEC3) gl.uniform3fv(l.at, a);
    else if (T === gl.FLOAT_VEC4) gl.uniform4fv(l.at, a);
    else if (T === gl.INT || T === gl.BOOL) gl.uniform1iv(l.at, a.map(Math.round));
    else if (T === gl.INT_VEC2 || T === gl.BOOL_VEC2) gl.uniform2iv(l.at, a.map(Math.round));
    else if (T === gl.INT_VEC3) gl.uniform3iv(l.at, a.map(Math.round));
    else if (T === gl.INT_VEC4) gl.uniform4iv(l.at, a.map(Math.round));
    else if (T === gl.UNSIGNED_INT) gl.uniform1uiv(l.at, a.map(x => Math.max(0, Math.round(x))));
    else if (T === gl.FLOAT_MAT3) gl.uniformMatrix3fv(l.at, false, a);
    else if (T === gl.FLOAT_MAT2) gl.uniformMatrix2fv(l.at, false, a);
    else if (T === gl.FLOAT_MAT4) gl.uniformMatrix4fv(l.at, false, a);
  }
  blit(tex, target, flip) { return this.run(this.blitShader, target || null, { src: tex, values: { flip: [flip ? 1 : 0] } }); }
}
