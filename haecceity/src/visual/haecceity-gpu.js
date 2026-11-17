/**
 * Authentic Multi-Pass WebGL2 Haecceity Shader Engine
 * Loads, transpiles, caches, and executes ALL imported Haecceity shaders:
 *  - 52 Backgrounds (shaders/backgrounds/*.gdshader)
 *  - 40 Glitch Shaders (shaders/glitch/*.gdshader)
 *  - Foreground Fields (textmode, terrain, cymatics, glyphs, shards, volume,
 *    automata, reaction, colony, attractor, fluid, temporal, databend)
 */

import {
  QUAD_VERT_SRC,
  transpileCanvasItem,
  transpileInstancedCanvasItem,
  transpileSpatial,
} from './gdshader-transpiler.js';
import {
  TERRAIN_NX,
  TERRAIN_NZ,
  VOWEL_VISEMES,
  buildTerrainGridData,
  buildTerrainHeadData,
  makePerspectiveMatrix,
  makeViewMatrix,
  mulMat4,
} from './terrain-meshes.js';

const BLIT_FRAG_SRC = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_tex;
uniform float u_alpha;
void main() {
  vec4 c = texture(u_tex, v_uv);
  outColor = vec4(c.rgb, c.a * u_alpha);
}`;

const COPY_FLIP_FRAG_SRC = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_tex;
void main() {
  outColor = texture(u_tex, v_uv);
}`;

export const FG_FIELD_NAMES = [
  'textmode',
  'terrain',
  'cymatics',
  'glyphs',
  'shards',
  'volume',
  'automata',
  'reaction',
  'colony',
  'attractor',
  'fluid',
  'temporal',
  'databend',
];

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function glyphForChar(ch) {
  if (!ch) return 0;
  const u = ch.toUpperCase().charCodeAt(0);
  if (u >= 48 && u <= 57) return 20 + (u - 48);
  if (u >= 65 && u <= 90) return 30 + (u - 65);
  if (ch === '.') return 56;
  if (ch === ',') return 57;
  if (ch === '!') return 58;
  if (ch === '?') return 59;
  if (ch === "'") return 60;
  if (ch === '-') return 61;
  if (ch === ':') return 62;
  return 0;
}

export class HaecceityGPUEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl2', {
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.ready = false;
    this.manifest = null;
    this.includes = {};
    this.rawCache = new Map();
    this.progCache = new Map();
    this.pendingFetches = new Set();
    this.startTime = performance.now();
    this.frameCount = 0;

    this.state = {
      x: 0.48,
      y: 0.52,
      dragging: false,
      dragForce: 0,
      kickEnv: 0,
      peakKick: 0,
      peakIdm: 0,
      peakUnstable: 0,
      peakMumble: 0,
      peakMaster: 0,
      idmLocked: false,
      mumbleActive: false,
      mumbleSpeaking: false,
      mumbleText: '',
      mumbleVowel: 0,
      mumbleConsonant: 0,
      mumbleEnv: 0,
      scope: [],
      visual: null,
      mumbleAutoMode: 0,
    };

    this.mumbleFlash = 0;
    this.mumbleSeq = 0;
    this.mumbleChars = new Int32Array(24);
    this.mumbleBox = [-1, -1, 0, 0];
    this.mumbleScale = 1;
    this.lastMumbleWord = '';
    this.lastKickPeak = 0;
    this.terrainTravel = 0;
    this.terrainWave = -1;
    this.terrainShift = 0;
    this.fieldReset = { automata: true, reaction: true, colony: true, attractor: true, fluid: true, textmode: true };

    if (this.gl) {
      this.hasFloatFbo = !!this.gl.getExtension('EXT_color_buffer_float');
      this.initResources();
      this.loadManifestAndCore();
    }
  }

  initResources() {
    const gl = this.gl;
    // Fullscreen quad VAO
    this.quadVao = gl.createVertexArray();
    gl.bindVertexArray(this.quadVao);
    const qb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, qb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    // Instanced unit quad [0..1] / [-0.5..0.5]
    this.instVao = gl.createVertexArray();
    gl.bindVertexArray(this.instVao);
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, ib);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -0.5, -0.5, 0, 0,
       0.5, -0.5, 1, 0,
      -0.5,  0.5, 0, 1,
       0.5,  0.5, 1, 1,
    ]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);

    // Colony points VAO (256x256 = 65536 GPU agents)
    this.colonySide = 256;
    const pts = new Float32Array(this.colonySide * this.colonySide * 2);
    for (let i = 0; i < this.colonySide * this.colonySide; i++) {
      pts[i * 2] = i % this.colonySide;
      pts[i * 2 + 1] = Math.floor(i / this.colonySide);
    }
    this.colonyVao = gl.createVertexArray();
    gl.bindVertexArray(this.colonyVao);
    const cb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cb);
    gl.bufferData(gl.ARRAY_BUFFER, pts, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    // Terrain grid VAO
    const grid = buildTerrainGridData();
    this.terrainVao = gl.createVertexArray();
    gl.bindVertexArray(this.terrainVao);
    const tPos = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, tPos);
    gl.bufferData(gl.ARRAY_BUFFER, grid.positions, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    const tIdx = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, tIdx);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, grid.indices, gl.STATIC_DRAW);
    this.terrainIndexCount = grid.indices.length;

    // Terrain MumbleSpeak Head VAO
    const head = buildTerrainHeadData();
    this.headVao = gl.createVertexArray();
    gl.bindVertexArray(this.headVao);
    const hPos = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, hPos);
    gl.bufferData(gl.ARRAY_BUFFER, head.positions, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    const hUv = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, hUv);
    gl.bufferData(gl.ARRAY_BUFFER, head.uvs, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
    const hCol = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, hCol);
    gl.bufferData(gl.ARRAY_BUFFER, head.colors, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 0, 0);
    this.headVertCount = head.vertexCount;

    gl.bindVertexArray(null);

    this.blitProg = this.compileRaw(QUAD_VERT_SRC, BLIT_FRAG_SRC, { a_pos: 0 });
    this.copyProg = this.compileRaw(QUAD_VERT_SRC, COPY_FLIP_FRAG_SRC, { a_pos: 0 });

    // Empty black fallback texture
    this.blackTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.blackTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));

    this.fbos = {};
  }

  createFbo(name, w, h, { float = false, nearest = false, depth = false, repeat = false } = {}) {
    const gl = this.gl;
    const prev = this.fbos[name];
    if (prev && prev.w === w && prev.h === h) return prev;
    if (prev) {
      gl.deleteFramebuffer(prev.fbo);
      gl.deleteTexture(prev.tex);
      if (prev.depthRb) gl.deleteRenderbuffer(prev.depthRb);
    }

    const useFloat = float && this.hasFloatFbo;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      useFloat ? gl.RGBA16F : gl.RGBA8,
      w,
      h,
      0,
      gl.RGBA,
      useFloat ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE,
      null
    );
    const filt = nearest ? gl.NEAREST : gl.LINEAR;
    const wrap = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filt);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filt);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);

    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);

    let depthRb = null;
    if (depth) {
      depthRb = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, depthRb);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthRb);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const obj = { fbo, tex, depthRb, w, h };
    this.fbos[name] = obj;
    return obj;
  }

  async loadManifestAndCore() {
    const [mRes, inc1, inc2] = await Promise.all([
      fetch('./shaders/manifest.json').then((r) => r.json()),
      fetch('./shaders/glitch/visual_panel_sampling.gdshaderinc').then((r) => r.text()),
      fetch('./shaders/glitch/kinetic_moves.gdshaderinc').then((r) => r.text()),
    ]);
    this.manifest = mRes;
    this.includes = {
      'visual_panel_sampling.gdshaderinc': inc1,
      'kinetic_moves.gdshaderinc': inc2,
    };
    this.ready = true;
    // Prefetch core foreground shaders
    for (const fg of this.manifest.foregrounds) {
      this.ensureShader(fg.path, this.classifyForegroundMode(fg.id));
    }
  }

  classifyForegroundMode(id) {
    if (id === 'composition_terrain_mesh' || id === 'composition_terrain_head') return 'spatial';
    if (id === 'composition_colony_points') return 'points';
    if (id === 'composition_glyphs' || id === 'composition_shards' || id === 'composition_attractor_points') return 'instanced';
    return 'canvas';
  }

  compileRaw(vertSrc, fragSrc, attribMap = { a_pos: 0 }) {
    const gl = this.gl;
    const vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, vertSrc);
    gl.compileShader(vs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
      console.warn('VS compile error:', gl.getShaderInfoLog(vs));
      return null;
    }

    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, fragSrc);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      console.warn('FS compile error:', gl.getShaderInfoLog(fs));
      return null;
    }

    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    for (const [name, loc] of Object.entries(attribMap)) {
      gl.bindAttribLocation(prog, loc, name);
    }
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn('Link error:', gl.getProgramInfoLog(prog));
      return null;
    }
    return { prog, uniforms: new Map() };
  }

  getProg(path, mode = 'canvas') {
    const key = `${mode}:${path}`;
    if (this.progCache.has(key)) return this.progCache.get(key);
    this.ensureShader(path, mode);
    return null;
  }

  async ensureShader(path, mode = 'canvas') {
    const key = `${mode}:${path}`;
    if (this.progCache.has(key) || this.pendingFetches.has(key)) return;
    this.pendingFetches.add(key);
    try {
      let raw = this.rawCache.get(path);
      if (!raw) {
        const res = await fetch(path);
        raw = await res.text();
        this.rawCache.set(path, raw);
      }
      let compiled = null;
      if (mode === 'spatial') {
        const { vert, frag } = transpileSpatial(raw);
        compiled = this.compileRaw(vert, frag, { a_pos: 0, a_uv: 1, a_color: 2 });
      } else if (mode === 'instanced' || mode === 'points') {
        const { vert, frag } = transpileInstancedCanvasItem(raw, { isPoints: mode === 'points' });
        compiled = this.compileRaw(vert, frag, { a_pos: 0, a_uv: 1 });
      } else {
        const frag = transpileCanvasItem(raw, this.includes);
        compiled = this.compileRaw(QUAD_VERT_SRC, frag, { a_pos: 0 });
      }
      if (compiled) {
        this.progCache.set(key, compiled);
      }
    } catch (err) {
      console.warn('Shader load/compile skipped:', path, err);
    } finally {
      this.pendingFetches.delete(key);
    }
  }

  uLoc(entry, name) {
    if (!entry.uniforms.has(name)) {
      entry.uniforms.set(name, this.gl.getUniformLocation(entry.prog, name));
    }
    return entry.uniforms.get(name);
  }

  setUniform(entry, name, val) {
    const gl = this.gl;
    const loc = this.uLoc(entry, name);
    if (loc === null) return;
    if (typeof val === 'number') gl.uniform1f(loc, val);
    else if (Array.isArray(val) || val instanceof Float32Array) {
      if (val.length === 2) gl.uniform2f(loc, val[0], val[1]);
      else if (val.length === 3) gl.uniform3f(loc, val[0], val[1], val[2]);
      else if (val.length === 4) gl.uniform4f(loc, val[0], val[1], val[2], val[3]);
    }
  }

  setInt(entry, name, val) {
    const loc = this.uLoc(entry, name);
    if (loc !== null) this.gl.uniform1i(loc, val | 0);
  }

  bindTex(entry, name, unit, tex) {
    const gl = this.gl;
    const loc = this.uLoc(entry, name);
    if (loc === null) return;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex || this.blackTex);
    gl.uniform1i(loc, unit);
  }

  bindCommonUniforms(entry, w, h, t, diffuseTex, prevTex, extraMap = {}) {
    const s = this.state;
    const v = s.visual;
    this.setUniform(entry, 'u_resolution', [w, h]);
    this.setUniform(entry, 'res', [w, h]);
    this.setUniform(entry, 'u_time', t);
    this.setUniform(entry, 'time', t);
    this.setUniform(entry, 'u_fade', 1.0);
    this.setUniform(entry, 'u_screen_rect', [0, 0, 1, 1]);

    // Kinetic Moves Audio Uniforms
    this.setUniform(entry, 'u_rPulse', clamp(s.kickEnv, 0, 1));
    this.setUniform(entry, 'u_rScatter', clamp(s.peakIdm, 0, 1));
    this.setUniform(entry, 'u_rGlow', clamp(s.peakUnstable, 0, 1));
    this.setUniform(entry, 'u_rSwell', clamp(s.kickEnv * 0.8 + s.peakUnstable * 0.4, 0, 1));
    this.setUniform(entry, 'u_rSway', clamp(s.peakMaster, 0, 1));
    this.setUniform(entry, 'u_rRipple', clamp(s.peakMumble + s.peakIdm * 0.5, 0, 1));

    // Composition common audio uniforms
    this.setUniform(entry, 'kick', s.kickEnv);
    this.setUniform(entry, 'bass', clamp(s.kickEnv * 0.9, 0, 1));
    this.setUniform(entry, 'highs', clamp(s.peakIdm * 0.9, 0, 1));
    this.setUniform(entry, 'flux', clamp(s.peakUnstable + s.dragForce * 0.5, 0, 1));
    this.setUniform(entry, 'energy', clamp(s.peakMaster * 1.4 + s.dragForce, 0, 2.5));
    this.setUniform(entry, 'timbre', s.x);
    this.setUniform(entry, 'shimmer', s.y);
    this.setUniform(entry, 'hit', s.peakKick);

    if (v) {
      this.setUniform(entry, 'col_a', v.palette.b);
      this.setUniform(entry, 'col_b', v.palette.accent);
      this.setUniform(entry, 'col_w', [0.95, 0.96, 0.94]);
      this.setUniform(entry, 'col_k', v.palette.a);
      this.setUniform(entry, 'ink', [...v.palette.b, 1.0]);
      this.setUniform(entry, 'glow', [...v.palette.accent, 1.0]);
    }

    this.bindTex(entry, 'tDiffuse', 0, diffuseTex);
    this.bindTex(entry, 'tPrevFrame', 1, prevTex);
    this.bindTex(entry, 'screen', 0, diffuseTex);
    this.bindTex(entry, 'prev_frame', 1, prevTex);

    for (const [k, val] of Object.entries(extraMap)) {
      if (typeof val === 'number') this.setUniform(entry, k, val);
      else this.setUniform(entry, k, val);
    }
  }

  /**
   * Bind ALL custom uniforms declared in a background or glitch shader from X/Y + scene curves!
   */
  bindXYShaderParams(entry, desc, xyNorms, extraIntensity = 1.0) {
    if (!desc || !desc.uniforms) return;
    const s = this.state;
    const reserved = new Set([
      'u_fade', 'u_resolution', 'u_time', 'u_screen_rect',
      'u_rPulse', 'u_rScatter', 'u_rGlow', 'u_rSwell', 'u_rSway', 'u_rRipple',
    ]);
    let idx = 0;
    for (const u of desc.uniforms) {
      if (reserved.has(u.name) || u.arrayLen > 0) continue;
      if (u.type !== 'float' && u.type !== 'int') continue;

      const t = xyNorms[idx % xyNorms.length];
      idx++;
      let val;
      if (u.name === 'u_intensity' || u.name === 'u_master_intensity') {
        val = clamp(0.25 + t * 1.15 * extraIntensity + s.dragForce * 0.5, 0.0, 2.0);
      } else if (u.name === 'u_magnet_center_x' || u.name === 'u_tear_x' || u.name === 'u_center_x') {
        val = s.x;
      } else if (u.name === 'u_magnet_center_y' || u.name === 'u_tear_y' || u.name === 'u_center_y') {
        val = 1.0 - s.y;
      } else if (u.range) {
        val = u.range[0] + t * (u.range[1] - u.range[0]);
      } else if (typeof u.default === 'number') {
        const d = u.default;
        if (Math.abs(d) < 0.001) val = t;
        else val = d * (0.35 + t * 1.5);
      } else {
        val = t;
      }

      if (u.type === 'int') this.setInt(entry, u.name, Math.round(val));
      else this.setUniform(entry, u.name, val);
    }
  }

  setVisual(visual) {
    this.state.visual = visual;
  }

  setXY(x, y, dragging) {
    this.state.x = x;
    this.state.y = y;
    this.state.dragging = dragging;
    if (dragging) this.state.dragForce = Math.min(1.0, this.state.dragForce + 0.38);
  }

  setMumbleAutoMode(mode) {
    this.state.mumbleAutoMode = mode;
  }

  resetSimulations() {
    this.fieldReset = { automata: true, reaction: true, colony: true, attractor: true, fluid: true, textmode: true };
  }

  updateTelemetry(t) {
    this.state.kickEnv = t.kickEnv ?? 0;
    this.state.peakKick = t.peakKick ?? 0;
    this.state.peakIdm = t.peakIdm ?? 0;
    this.state.peakUnstable = t.peakUnstable ?? 0;
    this.state.peakMumble = t.peakMumble ?? 0;
    this.state.peakMaster = t.peakMaster ?? 0;
    this.state.idmLocked = !!t.idmLocked;
    this.state.mumbleActive = !!t.mumbleActive;
    this.state.mumbleSpeaking = !!t.mumbleSpeaking;
    this.state.mumbleText = t.mumbleText || '';
    this.state.mumbleVowel = t.mumbleVowel ?? 7;
    this.state.mumbleConsonant = t.mumbleConsonant ?? 0;
    this.state.mumbleEnv = t.mumbleEnv ?? 0;
    this.state.scope = t.scope || [];

    if ((t.peakKick || 0) > 0.35 && this.lastKickPeak <= 0.35) {
      this.terrainWave = 0.0;
      this.terrainShift = (this.terrainShift + 0.333) % 1.0;
    }
    this.lastKickPeak = t.peakKick || 0;

    if (t.mumbleSpeaking && t.mumbleText && t.mumbleText !== this.lastMumbleWord) {
      this.lastMumbleWord = t.mumbleText;
      this.mumbleFlash = 1.0;
      this.mumbleSeq++;
      this.mumbleChars.fill(0);
      const word = t.mumbleText.slice(0, 24).toUpperCase();
      for (let i = 0; i < word.length; i++) this.mumbleChars[i] = glyphForChar(word[i]);
      const n = word.length;
      const bw = Math.min(190, n * 8 + 4);
      const bh = 14;
      const ax = [0.5, 0.18, 0.82, 0.32, 0.68][this.mumbleSeq % 5];
      const ay = [0.5, 0.28, 0.72][Math.floor(this.mumbleSeq / 5) % 3];
      this.mumbleBox = [Math.round((200 - bw) * ax), Math.round((72 - bh) * ay), bw, bh];
      this.mumbleScale = n <= 10 ? 2 : 1;
    }
  }

  drawQuad(entry, targetFbo, w, h, { blend = false } = {}) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, targetFbo ? targetFbo.fbo : null);
    gl.viewport(0, 0, w, h);
    if (blend) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    } else {
      gl.disable(gl.BLEND);
    }
    gl.useProgram(entry.prog);
    gl.bindVertexArray(this.quadVao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disable(gl.BLEND);
  }

  // -------------------------------------------------------------------------
  // FOREGROUND FIELD RENDERERS (REAL MULTI-PASS SHADERS)
  // -------------------------------------------------------------------------
  renderForegroundField(name, targetFbo, w, h, t) {
    const gl = this.gl;
    const s = this.state;
    const v = s.visual;

    if (name === 'cymatics') {
      const p = this.getProg('./shaders/composition_cymatics.gdshader', 'canvas');
      if (!p) return;
      gl.useProgram(p.prog);
      this.bindCommonUniforms(p, w, h, t, targetFbo.tex, this.blackTex, {
        amount: 0.92,
        blend: 0.5 + 0.5 * Math.sin(s.x * Math.PI),
        plate: 1.15 + s.y * 0.4,
        grain_amt: 1.0,
        beat: t * (1.2 + s.x * 2.0),
      });
      this.setUniform(p, 'mode_a', [2 + Math.floor(s.x * 5), 3 + Math.floor(s.y * 5), Math.floor(s.x * 2.99)]);
      this.setUniform(p, 'mode_b', [3 + Math.floor(s.y * 5), 2 + Math.floor(s.x * 5), Math.floor(s.y * 2.99)]);
      this.drawQuad(p, targetFbo, w, h, { blend: true });
    }
    else if (name === 'glyphs') {
      const p = this.getProg('./shaders/composition_glyphs.gdshader', 'instanced');
      if (!p) return;
      const cols = 48, rows = 18;
      gl.bindFramebuffer(gl.FRAMEBUFFER, targetFbo.fbo);
      gl.viewport(0, 0, w, h);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(p.prog);
      this.bindCommonUniforms(p, w, h, t, null, null, {
        twist: (s.x - 0.5) * 2.5,
        weight: 0.25 + s.y * 0.75,
        snap: s.peakIdm,
        heading: s.x * Math.PI * 2,
        wave: this.terrainWave,
        amount: 0.88,
        paper: 0.0,
      });
      this.setInt(p, 'cols', cols);
      this.setInt(p, 'rows', rows);
      this.setInt(p, 'mode', Math.floor((s.x + s.y) * 2) % 4);
      this.setInt(p, 'sym', 4 + Math.floor(s.y * 6));
      const bandsLoc = this.uLoc(p, 'bands');
      if (bandsLoc) {
        const b = new Float32Array(16);
        for (let i = 0; i < 16; i++) b[i] = clamp((Math.abs(s.scope[i * 4] || 0)) * 2.5 + s.kickEnv * (1 - i / 16), 0, 1);
        gl.uniform1fv(bandsLoc, b);
      }
      gl.bindVertexArray(this.instVao);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, cols * rows);
      gl.disable(gl.BLEND);
    }
    else if (name === 'shards') {
      const p = this.getProg('./shaders/composition_shards.gdshader', 'instanced');
      if (!p) return;
      gl.bindFramebuffer(gl.FRAMEBUFFER, targetFbo.fbo);
      gl.viewport(0, 0, w, h);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(p.prog);
      this.bindCommonUniforms(p, w, h, t, null, null, {
        burst: clamp(s.kickEnv * 0.9 + s.dragForce * 0.9, 0, 1.8),
        force: 0.8 + s.y * 1.4,
        streaks: 0.35 + s.x * 0.65,
        yaw: (s.x - 0.5) * Math.PI,
        travel: t * 1.4,
        amount: 0.88,
      });
      this.setInt(p, 'mode', Math.floor(s.y * 2.99));
      gl.bindVertexArray(this.instVao);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, 280);
      gl.disable(gl.BLEND);
    }
    else if (name === 'volume') {
      const p = this.getProg('./shaders/composition_volume.gdshader', 'canvas');
      if (!p) return;
      const vfbo = this.createFbo('vol', Math.max(160, w >> 1), Math.max(90, h >> 1));
      gl.useProgram(p.prog);
      this.bindCommonUniforms(p, vfbo.w, vfbo.h, t, null, null, {
        density: 0.35 + s.y * 0.55,
        light: 0.45 + s.peakIdm * 0.55,
        form: 0.4 + s.x * 0.6,
        drift: 0.3 + s.x * 0.7,
        swell: s.kickEnv * 0.9,
        shape_t: 0.5 + 0.5 * Math.sin(t * 0.4),
        sparkle: s.peakUnstable,
      });
      this.setUniform(p, 'light_pos', [s.x * 2 - 1, s.y * 2 - 1, 0.4]);
      this.setInt(p, 'shape_a', Math.floor(s.x * 3.99));
      this.setInt(p, 'shape_b', Math.floor(s.y * 3.99));
      this.drawQuad(p, vfbo, vfbo.w, vfbo.h);
      this.blitTo(vfbo.tex, targetFbo, w, h, 0.85, true);
    }
    else if (name === 'automata') {
      const stepP = this.getProg('./shaders/composition_automata.gdshader', 'canvas');
      const viewP = this.getProg('./shaders/composition_automata_view.gdshader', 'canvas');
      if (!stepP || !viewP) return;
      const aw = 266, ah = 170;
      const f0 = this.createFbo('auto0', aw, ah, { nearest: true, repeat: true });
      const f1 = this.createFbo('auto1', aw, ah, { nearest: true, repeat: true });
      const flip = this.frameCount & 1;
      const read = flip ? f1 : f0;
      const write = flip ? f0 : f1;
      const rule = Math.floor(s.y * 3.99);

      gl.useProgram(stepP.prog);
      this.bindCommonUniforms(stepP, aw, ah, t, read.tex, read.tex, {
        mu: 0.14 + s.x * 0.08,
        sigma: 0.016 + s.y * 0.015,
        trail: 0.92,
        first: (this.fieldReset.automata || s.peakKick > 0.4 || s.dragForce > 0.25) ? 1.0 : 0.0,
      });
      this.bindTex(stepP, 'state', 0, read.tex);
      this.setInt(stepP, 'rule', rule);
      this.setInt(stepP, 'birth', 8);
      this.setInt(stepP, 'survive', 12);
      this.setInt(stepP, 'threshold', 2);
      const dropsLoc = this.uLoc(stepP, 'drops');
      if (dropsLoc) {
        gl.uniform4fv(dropsLoc, new Float32Array([
          s.x, 1.0 - s.y, 0.08 + s.dragForce * 0.08, 1.0,
          0.3, 0.5, 0.06, s.peakKick,
          0.7, 0.4, 0.06, s.peakIdm,
          0.5, 0.7, 0.05, s.peakUnstable,
        ]));
      }
      this.drawQuad(stepP, write, aw, ah);
      this.fieldReset.automata = false;

      gl.useProgram(viewP.prog);
      this.bindCommonUniforms(viewP, aw, ah, t, write.tex, write.tex, { amount: 0.82 });
      this.setInt(viewP, 'rule', rule);
      this.drawQuad(viewP, targetFbo, w, h, { blend: true });
    }
    else if (name === 'reaction') {
      const stepP = this.getProg('./shaders/composition_reaction.gdshader', 'canvas');
      const viewP = this.getProg('./shaders/composition_reaction_view.gdshader', 'canvas');
      if (!stepP || !viewP) return;
      const rw = 320, rh = 204;
      const f0 = this.createFbo('rx0', rw, rh, { float: true, nearest: true, repeat: true });
      const f1 = this.createFbo('rx1', rw, rh, { float: true, nearest: true, repeat: true });
      for (let step = 0; step < 3; step++) {
        const idx = (this.frameCount * 3 + step) & 1;
        const read = idx ? f1 : f0;
        const write = idx ? f0 : f1;
        gl.useProgram(stepP.prog);
        this.bindCommonUniforms(stepP, rw, rh, t, read.tex, read.tex, {
          feed: 0.025 + s.x * 0.04,
          kill: 0.052 + s.y * 0.016,
          spread: 0.65,
          da: 1.0,
          db: 0.5,
          first: (this.fieldReset.reaction || (step === 0 && (s.peakKick > 0.45 || s.dragForce > 0.25))) ? 1.0 : 0.0,
        });
        this.bindTex(stepP, 'state', 0, read.tex);
        const dropsLoc = this.uLoc(stepP, 'drops');
        if (dropsLoc) {
          gl.uniform4fv(dropsLoc, new Float32Array([
            s.x, 1.0 - s.y, 0.07, 1.0,
            0.25, 0.35, 0.05, this.fieldReset.reaction ? 1.0 : s.peakKick,
            0.75, 0.65, 0.05, this.fieldReset.reaction ? 1.0 : s.peakIdm,
            0.5, 0.5, 0.04, 0.0,
          ]));
        }
        this.drawQuad(stepP, write, rw, rh);
        this.fieldReset.reaction = false;
      }
      const latest = ((this.frameCount * 3 + 2) & 1) ? f0 : f1;
      gl.useProgram(viewP.prog);
      this.bindCommonUniforms(viewP, rw, rh, t, latest.tex, latest.tex, { amount: 0.92 });
      this.drawQuad(viewP, targetFbo, w, h, { blend: true });
    }
    else if (name === 'colony') {
      const stepP = this.getProg('./shaders/composition_colony.gdshader', 'canvas');
      const ptsP = this.getProg('./shaders/composition_colony_points.gdshader', 'points');
      const fadeP = this.getProg('./shaders/composition_colony_trail.gdshader', 'canvas');
      const viewP = this.getProg('./shaders/composition_colony_view.gdshader', 'canvas');
      if (!stepP || !ptsP || !fadeP || !viewP) return;
      const side = this.colonySide;
      const tw = Math.max(200, w >> 1), th = Math.max(120, h >> 1);
      const s0 = this.createFbo('colS0', side, side, { float: true, nearest: true });
      const s1 = this.createFbo('colS1', side, side, { float: true, nearest: true });
      const t0 = this.createFbo('colT0', tw, th);
      const t1 = this.createFbo('colT1', tw, th);
      const flip = this.frameCount & 1;
      const sRead = flip ? s1 : s0;
      const sWrite = flip ? s0 : s1;
      const tRead = flip ? t1 : t0;
      const tWrite = flip ? t0 : t1;
      const kind = Math.floor(s.y * 2.99);

      gl.useProgram(stepP.prog);
      this.bindCommonUniforms(stepP, tw, th, t, sRead.tex, tRead.tex, {
        sense_d: 6.0 + s.x * 28.0,
        sense_a: [0.45, 0.7, 0.3][kind],
        turn: [0.35, 0.5, 0.18][kind],
        speed: 0.7 + s.y * 2.2 + s.kickEnv * 0.8,
        scatter: s.peakKick > 0.45 ? 0.35 : 0.0,
        frame: this.frameCount % 9973,
        reset: this.fieldReset.colony ? 1.0 : 0.0,
      });
      this.bindTex(stepP, 'state', 0, sRead.tex);
      this.bindTex(stepP, 'trail', 1, tRead.tex);
      this.setInt(stepP, 'mode', kind);
      this.setUniform(stepP, 'blob', [s.x, 1.0 - s.y, 0.08, s.dragForce * 0.15]);
      this.drawQuad(stepP, sWrite, side, side);
      this.fieldReset.colony = false;

      // Fade trail
      gl.useProgram(fadeP.prog);
      this.bindCommonUniforms(fadeP, tw, th, t, tRead.tex, tRead.tex, { decay: 0.93, diffuse: 0.45 });
      this.bindTex(fadeP, 'prev', 0, tRead.tex);
      this.drawQuad(fadeP, tWrite, tw, th);

      // Additive points splat
      gl.bindFramebuffer(gl.FRAMEBUFFER, tWrite.fbo);
      gl.viewport(0, 0, tw, th);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.useProgram(ptsP.prog);
      this.bindCommonUniforms(ptsP, tw, th, t, sWrite.tex, sWrite.tex, { share: 0.85, size: 1.5, bright: 0.045 });
      this.bindTex(ptsP, 'state', 0, sWrite.tex);
      gl.bindVertexArray(this.colonyVao);
      gl.drawArrays(gl.POINTS, 0, side * side);
      gl.disable(gl.BLEND);

      // View composite
      gl.useProgram(viewP.prog);
      this.bindCommonUniforms(viewP, tw, th, t, tWrite.tex, tWrite.tex, { amount: 0.9, paper: 0.0 });
      this.drawQuad(viewP, targetFbo, w, h, { blend: true });
    }
    else if (name === 'attractor') {
      const stepP = this.getProg('./shaders/composition_attractor.gdshader', 'canvas');
      const ptsP = this.getProg('./shaders/composition_attractor_points.gdshader', 'instanced');
      const fadeP = this.getProg('./shaders/composition_trail_fade.gdshader', 'canvas');
      const viewP = this.getProg('./shaders/composition_glow_view.gdshader', 'canvas');
      if (!stepP || !ptsP || !fadeP || !viewP) return;
      const side = 128;
      const tw = Math.max(200, w >> 1), th = Math.max(120, h >> 1);
      const s0 = this.createFbo('attS0', side, side, { float: true, nearest: true });
      const s1 = this.createFbo('attS1', side, side, { float: true, nearest: true });
      const t0 = this.createFbo('attT0', tw, th);
      const t1 = this.createFbo('attT1', tw, th);
      const flip = this.frameCount & 1;
      const sRead = flip ? s1 : s0;
      const sWrite = flip ? s0 : s1;
      const tRead = flip ? t1 : t0;
      const tWrite = flip ? t0 : t1;

      gl.useProgram(stepP.prog);
      this.bindCommonUniforms(stepP, side, side, t, sRead.tex, sRead.tex, {
        dt: 0.008,
        scatter: s.peakKick > 0.45 ? 0.08 : 0.0,
        frame: this.frameCount % 9973,
        reset: this.fieldReset.attractor ? 1.0 : 0.0,
      });
      this.bindTex(stepP, 'state', 0, sRead.tex);
      this.setInt(stepP, 'kind', Math.floor(s.y * 1.99)); // clifford / dejong
      this.setUniform(stepP, 'coeff', [1.7 - s.x * 0.4, 1.7 + s.y * 0.3, 0.6 + (s.x - 0.5) * 1.5, 1.2 - s.y * 0.8]);
      this.drawQuad(stepP, sWrite, side, side);
      this.fieldReset.attractor = false;

      gl.useProgram(fadeP.prog);
      this.bindCommonUniforms(fadeP, tw, th, t, tRead.tex, tRead.tex, { decay: 0.90 });
      this.bindTex(fadeP, 'prev', 0, tRead.tex);
      this.drawQuad(fadeP, tWrite, tw, th);

      gl.bindFramebuffer(gl.FRAMEBUFFER, tWrite.fbo);
      gl.viewport(0, 0, tw, th);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.useProgram(ptsP.prog);
      this.bindCommonUniforms(ptsP, tw, th, t, sWrite.tex, sWrite.tex, {
        scale: Math.min(tw, th) * 0.22,
        size: 1.8,
        bright: 0.08,
        persp_k: 0.05,
      });
      this.setInt(ptsP, 'side', side);
      this.setUniform(ptsP, 'at', [tw * s.x, th * (1.0 - s.y)]);
      this.setUniform(ptsP, 'centre', [0, 0, 0]);
      const rotLoc = this.uLoc(ptsP, 'rot');
      if (rotLoc) {
        const ca = Math.cos(t * 0.3), sa = Math.sin(t * 0.3);
        gl.uniformMatrix3fv(rotLoc, false, new Float32Array([ca, 0, sa, 0, 1, 0, -sa, 0, ca]));
      }
      this.bindTex(ptsP, 'state', 0, sWrite.tex);
      gl.bindVertexArray(this.instVao);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, side * side);
      gl.disable(gl.BLEND);

      gl.useProgram(viewP.prog);
      this.bindCommonUniforms(viewP, tw, th, t, tWrite.tex, tWrite.tex, { amount: 0.92 });
      this.drawQuad(viewP, targetFbo, w, h, { blend: true });
    }
    else if (name === 'fluid') {
      const velP = this.getProg('./shaders/composition_fluid.gdshader', 'canvas');
      const dyeP = this.getProg('./shaders/composition_fluid_dye.gdshader', 'canvas');
      if (!velP || !dyeP) return;
      const vw = 160, vh = 102;
      const v0 = this.createFbo('flV0', vw, vh, { float: true });
      const v1 = this.createFbo('flV1', vw, vh, { float: true });
      const d0 = this.createFbo('flD0', w, h);
      const d1 = this.createFbo('flD1', w, h);
      const flip = this.frameCount & 1;
      const vRead = flip ? v1 : v0, vWrite = flip ? v0 : v1;
      const dRead = flip ? d1 : d0, dWrite = flip ? d0 : d1;

      gl.useProgram(velP.prog);
      this.bindCommonUniforms(velP, vw, vh, t, vRead.tex, vRead.tex, {
        turbulence: 0.4 + s.y * 1.2,
        scale: 3.0 + s.x * 4.0,
        keep: 0.97,
        first: this.fieldReset.fluid ? 1.0 : 0.0,
      });
      this.bindTex(velP, 'state', 0, vRead.tex);
      this.setInt(velP, 'stage', 0);
      const dropsLoc = this.uLoc(velP, 'drops');
      if (dropsLoc) {
        gl.uniform4fv(dropsLoc, new Float32Array([
          s.x, 1.0 - s.y, s.dragForce * 2.0 + s.kickEnv, 0.25,
          0.5, 0.5, s.peakIdm, 0.2,
          0.25, 0.75, 0, 0,
          0.75, 0.25, 0, 0,
        ]));
      }
      this.drawQuad(velP, vWrite, vw, vh);
      this.fieldReset.fluid = false;

      gl.useProgram(dyeP.prog);
      this.bindCommonUniforms(dyeP, w, h, t, targetFbo.tex, dRead.tex, {
        amount: 0.85,
        step: 1.0 + s.x * 2.5,
        inject: 0.25,
        decay: 0.95,
      });
      this.bindTex(dyeP, 'prev', 0, dRead.tex);
      this.bindTex(dyeP, 'cur', 1, targetFbo.tex);
      this.bindTex(dyeP, 'vel', 2, vWrite.tex);
      this.drawQuad(dyeP, dWrite, w, h);
      this.blitTo(dWrite.tex, targetFbo, w, h, 1.0, false);
    }
    else if (name === 'textmode') {
      const cellsP = this.getProg('./shaders/composition_textmode_cells.gdshader', 'canvas');
      const screenP = this.getProg('./shaders/composition_textmode.gdshader', 'canvas');
      if (!cellsP || !screenP) return;
      const gw = 200, gh = 72;
      const c0 = this.createFbo('tm0', gw, gh, { nearest: true });
      const c1 = this.createFbo('tm1', gw, gh, { nearest: true });
      const flip = this.frameCount & 1;
      const read = flip ? c1 : c0;
      const write = flip ? c0 : c1;

      this.mumbleFlash *= 0.93;
      gl.useProgram(cellsP.prog);
      this.bindCommonUniforms(cellsP, gw, gh, t, targetFbo.tex, read.tex, {
        keep: 0.985,
        frame: this.frameCount,
        scan: (t * 0.45) % 1.0,
        first: this.fieldReset.textmode ? 1.0 : 0.0,
      });
      this.setUniform(cellsP, 'grid', [gw, gh]);
      this.bindTex(cellsP, 'prev', 0, read.tex);
      this.bindTex(cellsP, 'source', 1, targetFbo.tex);
      this.setInt(cellsP, 'mode', (s.x > 0.78 && !s.mumbleActive) ? 1 : 0);

      // Animate 6 brutalist windows driven by X/Y + audio
      const winCount = 6;
      this.setInt(cellsP, 'count', winCount);
      const wins = new Float32Array(24 * 4);
      const wstyle = new Float32Array(24 * 4);
      for (let i = 0; i < winCount; i++) {
        const wx = Math.round(14 + ((i * 29 + s.x * 80 + Math.sin(t * 0.4 + i) * 14) % 130));
        const wy = Math.round(6 + ((i * 11 + (1 - s.y) * 32 + Math.cos(t * 0.3 + i) * 6) % 42));
        const ww = 28 + (i % 3) * 12;
        const wh = 12 + (i % 2) * 8;
        wins.set([wx, wy, ww, wh], i * 4);
        wstyle.set([i % 5, 2 + (i % 3), (i + 1) * 17, 1], i * 4);
      }
      const winsLoc = this.uLoc(cellsP, 'wins');
      if (winsLoc) gl.uniform4fv(winsLoc, wins);
      const wsLoc = this.uLoc(cellsP, 'wstyle');
      if (wsLoc) gl.uniform4fv(wsLoc, wstyle);

      // MumbleSpeak flash overlay uniforms
      const fcLoc = this.uLoc(cellsP, 'flash_chars');
      if (fcLoc) gl.uniform1iv(fcLoc, this.mumbleChars);
      this.setUniform(cellsP, 'flash_box', s.mumbleActive && this.mumbleFlash > 0.03 ? this.mumbleBox : [-1, -1, 0, 0]);
      this.setUniform(cellsP, 'flash_info', [this.lastMumbleWord.length, this.mumbleScale, this.mumbleFlash, this.mumbleSeq]);
      this.setUniform(cellsP, 'flash_span', [0, this.lastMumbleWord.length]);
      const bandsLoc = this.uLoc(cellsP, 'bands');
      if (bandsLoc) {
        const b = new Float32Array(16);
        for (let i = 0; i < 16; i++) b[i] = clamp(Math.abs(s.scope[i * 4] || 0) * 2.5 + s.kickEnv * (1 - i / 16), 0, 1);
        gl.uniform1fv(bandsLoc, b);
      }
      this.drawQuad(cellsP, write, gw, gh);
      this.fieldReset.textmode = false;

      gl.useProgram(screenP.prog);
      this.bindCommonUniforms(screenP, w, h, t, write.tex, write.tex, { amount: 0.92 });
      this.setUniform(screenP, 'grid', [gw, gh]);
      this.bindTex(screenP, 'cells', 0, write.tex);
      this.drawQuad(screenP, targetFbo, w, h, { blend: true });
    }
    else if (name === 'terrain') {
      const meshP = this.getProg('./shaders/composition_terrain_mesh.gdshader', 'spatial');
      const headP = this.getProg('./shaders/composition_terrain_head.gdshader', 'spatial');
      const gleamP = this.getProg('./shaders/composition_terrain_gleam.gdshader', 'canvas');
      const compP = this.getProg('./shaders/composition_terrain.gdshader', 'canvas');
      if (!meshP || !gleamP || !compP) return;

      const mw = Math.max(320, w >> 1), mh = Math.max(180, h >> 1);
      const meshFbo = this.createFbo('terMesh', mw, mh, { depth: true });
      const gleamFbo = this.createFbo('terGleam', Math.max(120, mw >> 2), Math.max(80, mh >> 2));

      this.terrainTravel += 0.045 + s.x * 0.08;
      if (this.terrainWave >= 0) {
        this.terrainWave += 0.38;
        if (this.terrainWave > 17) this.terrainWave = -1;
      }

      const camX = (s.x - 0.5) * 3.0;
      const camY = 0.85 + s.y * 0.65;
      const proj = makePerspectiveMatrix(48.88, mw / mh, 0.05, 32.0);
      const view = makeViewMatrix([camX, camY, 0], -Math.atan2(0.12, 1.1), (s.x - 0.5) * 0.12);
      const mvp = mulMat4(proj, view);

      gl.bindFramebuffer(gl.FRAMEBUFFER, meshFbo.fbo);
      gl.viewport(0, 0, mw, mh);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);

      // Draw 3D wireframe terrain mesh
      gl.useProgram(meshP.prog);
      const mvpLoc = this.uLoc(meshP, 'u_mvp');
      if (mvpLoc) gl.uniformMatrix4fv(mvpLoc, false, mvp);
      this.bindCommonUniforms(meshP, mw, mh, t, null, null, {
        cam_x: camX,
        travel: this.terrainTravel,
        height: 0.85 + s.y * 0.8,
        lines: 0.45 + s.x * 0.5,
        flow: 0.4 + s.y * 0.8,
        wave: this.terrainWave,
        note_pulse: s.peakIdm,
        shift: this.terrainShift,
      });
      this.setInt(meshP, 'mode', v ? (v.terrainMode ?? 0) : 0);
      gl.bindVertexArray(this.terrainVao);
      gl.drawElements(gl.TRIANGLES, this.terrainIndexCount, gl.UNSIGNED_SHORT, 0);

      // Draw 3D Vectrex MumbleSpeak Sky Head when MumbleSpeak is active!
      if (headP && s.mumbleActive) {
        const vis = VOWEL_VISEMES[clamp(s.mumbleVowel | 0, 0, 9)];
        const headModel = new Float32Array([
          2.2, 0, 0, 0,
          0, 2.2, 0, 0,
          0, 0, 2.2, 0,
          camX, 2.15, -9.5, 1,
        ]);
        const headMvp = mulMat4(mvp, headModel);
        gl.useProgram(headP.prog);
        const hMvpLoc = this.uLoc(headP, 'u_mvp');
        if (hMvpLoc) gl.uniformMatrix4fv(hMvpLoc, false, headMvp);
        this.bindCommonUniforms(headP, mw, mh, t, null, null, {
          appear: 1.0,
          jaw_open: s.mumbleSpeaking ? vis[0] * (0.5 + 0.5 * s.mumbleEnv) : 0.05,
          mouth_wide: s.mumbleSpeaking ? vis[1] : 0.5,
          lip_pucker: s.mumbleSpeaking ? vis[2] : 0.0,
          speech_pulse: s.mumbleEnv,
          blink: Math.sin(t * 0.9) > 0.96 ? 1.0 : 0.0,
          paper: 0.0,
        });
        gl.bindVertexArray(this.headVao);
        gl.drawArrays(gl.TRIANGLES, 0, this.headVertCount);
      }
      gl.disable(gl.DEPTH_TEST);

      // Gleam pass
      gl.useProgram(gleamP.prog);
      this.bindCommonUniforms(gleamP, gleamFbo.w, gleamFbo.h, t, meshFbo.tex, null, {});
      this.bindTex(gleamP, 'mesh_tex', 0, meshFbo.tex);
      this.drawQuad(gleamP, gleamFbo, gleamFbo.w, gleamFbo.h);

      // Final Terrain composite (sky, stars, vector horizon sun + terrain)
      gl.useProgram(compP.prog);
      this.bindCommonUniforms(compP, w, h, t, meshFbo.tex, gleamFbo.tex, {
        stars: 0.65,
        star_fire: s.peakIdm,
        sun_x: (s.x - 0.5) * 0.4,
        shift: this.terrainShift,
        paper: 0.0,
        mono_paper: 0.0,
      });
      this.bindTex(compP, 'mesh_tex', 0, meshFbo.tex);
      this.bindTex(compP, 'gleam_tex', 1, gleamFbo.tex);
      this.drawQuad(compP, targetFbo, w, h, { blend: true });
    }
    else if (name === 'databend') {
      const moshP = this.getProg('./shaders/composition_mosh.gdshader', 'canvas');
      const bendP = this.getProg('./shaders/composition_databend.gdshader', 'canvas');
      if (!moshP || !bendP) return;
      const mf0 = this.createFbo('mosh0', w, h);
      const mf1 = this.createFbo('mosh1', w, h);
      const flip = this.frameCount & 1;
      const mRead = flip ? mf1 : mf0, mWrite = flip ? mf0 : mf1;

      gl.useProgram(moshP.prog);
      this.bindCommonUniforms(moshP, w, h, t, targetFbo.tex, mRead.tex, {
        hold: s.kickEnv > 0.35 ? 1.0 : 0.0,
        drift: 0.5 + s.x * 1.5,
        drop_prob: 0.25 + s.y * 0.55,
      });
      this.bindTex(moshP, 'cur', 0, targetFbo.tex);
      this.bindTex(moshP, 'prev', 1, mRead.tex);
      this.drawQuad(moshP, mWrite, w, h);

      gl.useProgram(bendP.prog);
      this.bindCommonUniforms(bendP, w, h, t, targetFbo.tex, mWrite.tex, {
        amount: 0.35 + s.dragForce * 0.55 + s.peakIdm * 0.35,
        sort_angle: s.x * Math.PI,
        mosh: 0.55 + s.y * 0.4,
        sort_amt: 0.8 + s.x * 0.8,
        block_amt: 0.7 + s.y * 0.8,
        crush_amt: 0.8 + s.x * 0.6,
      });
      this.bindTex(bendP, 'screen', 0, targetFbo.tex);
      this.bindTex(bendP, 'mosh_tex', 1, mWrite.tex);
      this.drawQuad(bendP, targetFbo, w, h);
    }
    else if (name === 'temporal') {
      const tempP = this.getProg('./shaders/composition_temporal.gdshader', 'canvas');
      if (!tempP) return;
      const aw = Math.max(320, w), ah = Math.max(180, h);
      const atlas = this.createFbo('tempAtlas', aw, ah);
      const slotIdx = this.frameCount % 16;
      const tx = Math.floor((slotIdx % 4) * (aw / 4));
      const ty = Math.floor(Math.floor(slotIdx / 4) * (ah / 4));
      const tw = Math.floor(aw / 4), th = Math.floor(ah / 4);

      gl.bindFramebuffer(gl.FRAMEBUFFER, atlas.fbo);
      gl.viewport(tx, ty, tw, th);
      gl.disable(gl.BLEND);
      gl.useProgram(this.copyProg.prog);
      this.bindTex(this.copyProg, 'u_tex', 0, targetFbo.tex);
      gl.bindVertexArray(this.quadVao);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      const outTmp = this.createFbo('tempOut', w, h);
      gl.useProgram(tempP.prog);
      this.bindCommonUniforms(tempP, w, h, t, atlas.tex, targetFbo.tex, {
        head: slotIdx,
        amount: 0.55 + s.dragForce * 0.4,
        slit: 0.3 + s.x * 0.7,
        luma_hold: s.y * 0.8,
        ripple: s.kickEnv * 0.85,
        ripple_r: 0.25 + s.kickEnv * 0.45,
        echo: 0.5 + s.y * 0.4,
        flow: s.x * 0.8,
        span: 14.0,
      });
      this.setUniform(tempP, 'slit_dir', [Math.cos(s.x * Math.PI), Math.sin(s.x * Math.PI)]);
      this.setUniform(tempP, 'ripple_at', [s.x, 1.0 - s.y]);
      this.bindTex(tempP, 'atlas', 0, atlas.tex);
      this.bindTex(tempP, 'cur', 1, targetFbo.tex);
      this.drawQuad(tempP, outTmp, w, h);
      this.blitTo(outTmp.tex, targetFbo, w, h, 1.0, false);
    }
  }

  blitTo(tex, targetFbo, w, h, alpha = 1.0, blend = false) {
    const gl = this.gl;
    gl.useProgram(this.blitProg.prog);
    this.bindTex(this.blitProg, 'u_tex', 0, tex);
    this.setUniform(this.blitProg, 'u_alpha', alpha);
    this.drawQuad(this.blitProg, targetFbo, w, h, { blend });
  }

  render() {
    if (!this.gl || !this.ready || !this.manifest || !this.state.visual) return;
    const gl = this.gl;
    const v = this.state.visual;
    const s = this.state;

    const dpr = Math.min(1.5, window.devicePixelRatio || 1) * 0.72;
    const w = Math.max(320, Math.floor(this.canvas.clientWidth * dpr));
    const h = Math.max(180, Math.floor(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }

    const t = (performance.now() - this.startTime) / 1000.0;
    s.dragForce *= 0.91;
    s.kickEnv *= 0.92;
    this.frameCount++;

    const bgFbo0 = this.createFbo('bg0', w, h);
    const bgFbo1 = this.createFbo('bg1', w, h);
    const postA = this.createFbo('postA', w, h);
    const postB = this.createFbo('postB', w, h);
    const prevPost = this.createFbo('prevPost', w, h);

    const flip = this.frameCount & 1;
    const bgWrite = flip ? bgFbo1 : bgFbo0;
    const bgPrev = flip ? bgFbo0 : bgFbo1;

    // 1. RENDER BACKGROUND SHADER (52 imported backgrounds)
    const bgDesc = this.manifest.backgrounds[v.backgroundIndex % this.manifest.backgrounds.length];
    const bgProg = this.getProg(bgDesc.path, 'canvas');
    if (bgProg) {
      gl.useProgram(bgProg.prog);
      this.bindCommonUniforms(bgProg, w, h, t, bgPrev.tex, bgPrev.tex);
      this.bindXYShaderParams(bgProg, bgDesc, v.bgXY, 1.0);
      this.drawQuad(bgProg, bgWrite, w, h);
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, bgWrite.fbo);
      gl.viewport(0, 0, w, h);
      gl.clearColor(0.02, 0.03, 0.04, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }

    // Copy background to postA
    this.blitTo(bgWrite.tex, postA, w, h, 1.0, false);

    // 2. RENDER FOREGROUND FIELDS (Scene fields + Automatic Textmode/Terrain during MumbleSpeak)
    const activeFgs = [...v.foregroundFields];
    if (s.mumbleActive) {
      if (s.mumbleAutoMode === 0 && !activeFgs.includes('textmode')) activeFgs.push('textmode');
      else if (s.mumbleAutoMode === 1 && !activeFgs.includes('terrain')) activeFgs.push('terrain');
      else if (s.mumbleAutoMode === 2) {
        if (!activeFgs.includes('terrain')) activeFgs.push('terrain');
        if (!activeFgs.includes('textmode')) activeFgs.push('textmode');
      }
    }
    for (const fgName of activeFgs) {
      this.renderForegroundField(fgName, postA, w, h, t);
    }

    // 3. RENDER GLITCH SUITE CHAIN (40 imported glitch shaders)
    let curSrc = postA;
    let curDst = postB;
    for (let i = 0; i < v.glitchIndices.length; i++) {
      const gDesc = this.manifest.glitches[v.glitchIndices[i] % this.manifest.glitches.length];
      const gProg = this.getProg(gDesc.path, 'canvas');
      if (!gProg) continue;
      gl.useProgram(gProg.prog);
      this.bindCommonUniforms(gProg, w, h, t, curSrc.tex, prevPost.tex);
      this.bindXYShaderParams(gProg, gDesc, v.glitchXY, v.glitchWeights[i] ?? 0.7);
      this.drawQuad(gProg, curDst, w, h);
      [curSrc, curDst] = [curDst, curSrc];
    }

    // Save frame into prevPost for tPrevFrame temporal glitches
    this.blitTo(curSrc.tex, prevPost, w, h, 1.0, false);

    // 4. PRESENT FINAL IMAGE TO SCREEN
    this.blitTo(curSrc.tex, null, w, h, 1.0, false);
  }
}
