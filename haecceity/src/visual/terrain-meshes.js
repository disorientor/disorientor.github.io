/**
 * Exact 3D Mesh Builders for Terrain & MumbleSpeak Vectrex Sky Head
 * Ported from Haecceity/standalone/demo/instruments/composition_terrain.gd & composition_terrain_head.gd
 */

export const TERRAIN_NX = 80;
export const TERRAIN_NZ = 64;

export function buildTerrainGridData() {
  const verts = [];
  for (let iz = 0; iz <= TERRAIN_NZ; iz++) {
    for (let ix = 0; ix <= TERRAIN_NX; ix++) {
      verts.push(ix, 0, iz);
    }
  }
  const indices = [];
  for (let iz = 0; iz < TERRAIN_NZ; iz++) {
    for (let ix = 0; ix < TERRAIN_NX; ix++) {
      const a = iz * (TERRAIN_NX + 1) + ix;
      const b = a + 1;
      const c = a + (TERRAIN_NX + 1);
      const d = c + 1;
      if (((ix + iz) & 1) === 0) {
        indices.push(a, b, d, a, d, c);
      } else {
        indices.push(a, b, c, b, d, c);
      }
    }
  }
  return {
    positions: new Float32Array(verts),
    indices: new Uint16Array(indices),
  };
}

// Vowel visemes: [jaw_open, mouth_wide, lip_pucker]
export const VOWEL_VISEMES = [
  [0.95, 0.58, 0.10], // 0: a
  [0.58, 0.88, 0.00], // 1: e
  [0.32, 1.00, 0.00], // 2: i
  [0.78, 0.22, 0.85], // 3: o
  [0.40, 0.10, 1.00], // 4: u
  [0.65, 0.80, 0.05], // 5: ɛ
  [0.84, 0.30, 0.72], // 6: ɔ
  [0.48, 0.52, 0.18], // 7: ə
  [0.88, 0.78, 0.05], // 8: æ
  [0.46, 0.20, 0.82], // 9: ʊ
];

export function buildTerrainHeadData() {
  const pts = {
    crown:       [[0.0,  1.24, -0.08], [0.0, 0.0, 0.0, 1.0]],
    f_top:       [[0.0,  1.02,  0.52], [0.0, 0.0, 0.0, 1.0]],
    brow_c:      [[0.0,  0.50,  0.80], [0.0, 0.0, 0.0, 1.0]],
    nose_bridge: [[0.0,  0.28,  0.78], [0.0, 0.0, 0.0, 1.0]],
    nose_tip:    [[0.0, -0.05,  1.06], [0.0, 0.0, 0.0, 1.0]],
    nose_base:   [[0.0, -0.17,  0.80], [0.0, 0.0, 0.0, 1.0]],
    ulip_c:      [[0.0, -0.32,  0.81], [0.0, 0.85, 0.75, 1.0]],
    llip_c:      [[0.0, -0.36,  0.79], [1.0, 0.90, 0.75, 1.0]],
    chin_dip:    [[0.0, -0.56,  0.72], [1.0, 0.0, 0.0, 1.0]],
    chin_front:  [[0.0, -0.74,  0.75], [1.0, 0.0, 0.0, 1.0]],
    chin_bot:    [[0.0, -0.90,  0.52], [1.0, 0.0, 0.0, 1.0]],
    throat:      [[0.0, -0.84,  0.12], [0.70, 0.0, 0.0, 1.0]],
    neck_f:      [[0.0, -1.06,  0.02], [0.0, 0.0, 0.0, 1.0]],
    b_top:       [[0.0,  0.96, -0.68], [0.0, 0.0, 0.0, 1.0]],
    b_mid:       [[0.0,  0.24, -0.90], [0.0, 0.0, 0.0, 1.0]],
    b_occ:       [[0.0, -0.45, -0.72], [0.0, 0.0, 0.0, 1.0]],
    neck_b:      [[0.0, -1.04, -0.50], [0.0, 0.0, 0.0, 1.0]],
    in_top_c:    [[0.0, -0.33,  0.56], [0.0, 0.0, 1.0, 1.0]],
    in_bot_c:    [[0.0, -0.39,  0.55], [1.0, 0.0, 1.0, 1.0]],
    in_back_c:   [[0.0, -0.36,  0.34], [0.50, 0.0, 1.0, 1.0]],
    f_side:      [[0.46,  0.92,  0.40], [0.0, 0.0, 0.0, 1.0]],
    temple:      [[0.70,  0.50,  0.12], [0.0, 0.0, 0.0, 1.0]],
    ear_top:     [[0.76,  0.16, -0.18], [0.0, 0.0, 0.0, 1.0]],
    b_side_top:  [[0.58,  0.76, -0.56], [0.0, 0.0, 0.0, 1.0]],
    b_side_mid:  [[0.72,  0.18, -0.68], [0.0, 0.0, 0.0, 1.0]],
    b_side_low:  [[0.52, -0.42, -0.54], [0.0, 0.0, 0.0, 1.0]],
    neck_s:      [[0.38, -1.05, -0.24], [0.0, 0.0, 0.0, 1.0]],
    brow_in:     [[0.18,  0.52,  0.79], [0.0, 0.0, 0.0, 1.0]],
    brow_out:    [[0.56,  0.46,  0.54], [0.0, 0.0, 0.0, 1.0]],
    eye_in:      [[0.15,  0.30,  0.67], [0.0, 0.0, 0.25, 1.0]],
    eye_top:     [[0.34,  0.39,  0.59], [0.0, 0.0, 0.25, 1.0]],
    eye_out:     [[0.54,  0.28,  0.50], [0.0, 0.0, 0.25, 1.0]],
    eye_bot:     [[0.34,  0.17,  0.61], [0.0, 0.0, 0.25, 1.0]],
    pupil_c:     [[0.34,  0.29,  0.63], [0.0, 0.0, 0.50, 1.0]],
    pupil_in:    [[0.22,  0.29,  0.60], [0.0, 0.0, 0.50, 1.0]],
    pupil_top:   [[0.34,  0.35,  0.58], [0.0, 0.0, 0.50, 1.0]],
    pupil_out:   [[0.46,  0.28,  0.54], [0.0, 0.0, 0.50, 1.0]],
    pupil_bot:   [[0.34,  0.22,  0.59], [0.0, 0.0, 0.50, 1.0]],
    nose_side:   [[0.15, -0.08,  0.79], [0.0, 0.0, 0.0, 1.0]],
    cheek_hi:    [[0.62,  0.08,  0.50], [0.0, 0.0, 0.0, 1.0]],
    cheek_mid:   [[0.44, -0.14,  0.64], [0.0, 0.0, 0.0, 1.0]],
    cheek_side:  [[0.68, -0.18,  0.10], [0.0, 0.0, 0.0, 1.0]],
    ulip_side:   [[0.20, -0.32,  0.75], [0.0, 0.85, 0.75, 1.0]],
    m_corner:    [[0.33, -0.34,  0.63], [0.45, 1.0, 0.75, 1.0]],
    cheek_low:   [[0.48, -0.40,  0.36], [0.35, 0.0, 0.0, 1.0]],
    llip_side:   [[0.19, -0.36,  0.73], [1.0, 0.90, 0.75, 1.0]],
    chin_side:   [[0.25, -0.74,  0.52], [1.0, 0.0, 0.0, 1.0]],
    jaw_angle:   [[0.52, -0.58,  0.06], [0.75, 0.0, 0.0, 1.0]],
    jaw_under:   [[0.30, -0.82,  0.16], [0.85, 0.0, 0.0, 1.0]],
    in_top_s:    [[0.18, -0.33,  0.52], [0.0, 0.0, 1.0, 1.0]],
    in_bot_s:    [[0.17, -0.39,  0.51], [1.0, 0.0, 1.0, 1.0]],
  };

  const outerTris = [
    ['crown','f_top','f_side'], ['crown','f_side','temple'], ['crown','temple','b_side_top'], ['crown','b_side_top','b_top'],
    ['f_top','brow_c','brow_in'], ['f_top','brow_in','f_side'], ['f_side','brow_in','brow_out'], ['f_side','brow_out','temple'],
    ['temple','brow_out','cheek_hi'], ['temple','cheek_hi','cheek_side'], ['temple','cheek_side','ear_top'],
    ['temple','ear_top','b_side_mid'], ['temple','b_side_mid','b_side_top'], ['b_side_top','b_side_mid','b_mid'],
    ['b_side_top','b_mid','b_top'], ['b_side_mid','ear_top','b_side_low'], ['b_side_mid','b_side_low','b_occ'], ['b_side_mid','b_occ','b_mid'],
    ['brow_c','nose_bridge','eye_in'], ['brow_c','eye_in','brow_in'], ['brow_in','eye_in','eye_top'],
    ['brow_in','eye_top','brow_out'], ['brow_out','eye_top','eye_out'], ['brow_out','eye_out','cheek_hi'],
    ['eye_in','eye_top','pupil_top'], ['eye_in','pupil_top','pupil_in'],
    ['eye_top','eye_out','pupil_out'], ['eye_top','pupil_out','pupil_top'],
    ['eye_out','eye_bot','pupil_bot'], ['eye_out','pupil_bot','pupil_out'],
    ['eye_bot','eye_in','pupil_in'], ['eye_bot','pupil_in','pupil_bot'],
    ['pupil_in','pupil_top','pupil_c'], ['pupil_top','pupil_out','pupil_c'],
    ['pupil_out','pupil_bot','pupil_c'], ['pupil_bot','pupil_in','pupil_c'],
    ['nose_bridge','nose_tip','nose_side'], ['nose_bridge','nose_side','eye_in'],
    ['eye_in','nose_side','cheek_mid'], ['eye_in','cheek_mid','eye_bot'],
    ['eye_bot','cheek_mid','cheek_hi'], ['eye_bot','cheek_hi','eye_out'], ['nose_tip','nose_base','nose_side'],
    ['nose_base','ulip_c','ulip_side'], ['nose_base','ulip_side','nose_side'],
    ['nose_side','ulip_side','cheek_mid'], ['cheek_mid','ulip_side','m_corner'],
    ['cheek_mid','m_corner','cheek_low'], ['cheek_mid','cheek_low','cheek_hi'],
    ['cheek_hi','cheek_low','cheek_side'], ['cheek_side','cheek_low','jaw_angle'],
    ['cheek_side','jaw_angle','ear_top'], ['ear_top','jaw_angle','b_side_low'],
    ['llip_c','chin_dip','llip_side'], ['llip_side','chin_dip','chin_side'],
    ['llip_side','chin_side','m_corner'], ['m_corner','chin_side','cheek_low'], ['cheek_low','chin_side','jaw_angle'],
    ['chin_dip','chin_front','chin_side'], ['chin_front','chin_bot','chin_side'],
    ['chin_side','chin_bot','throat'], ['chin_side','throat','jaw_under'], ['chin_side','jaw_under','jaw_angle'],
    ['throat','neck_f','neck_s'], ['throat','neck_s','jaw_under'], ['jaw_under','neck_s','jaw_angle'],
    ['jaw_angle','neck_s','b_side_low'], ['b_side_low','neck_s','neck_b'], ['b_side_low','neck_b','b_occ'],
  ];

  const mouthTris = [
    ['ulip_c','ulip_side','in_top_s'], ['ulip_c','in_top_s','in_top_c'], ['ulip_side','m_corner','in_top_s'],
    ['llip_c','in_bot_c','in_bot_s'], ['llip_c','in_bot_s','llip_side'], ['llip_side','in_bot_s','m_corner'],
    ['in_top_c','in_top_s','in_back_c'], ['in_top_s','m_corner','in_back_c'],
    ['m_corner','in_bot_s','in_back_c'], ['in_bot_s','in_bot_c','in_back_c'],
  ];

  const positions = [];
  const uvs = [];
  const colors = [];

  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];

  const addTri = (ka, kb, kc, side, ref, inward) => {
    const pa = [...pts[ka][0]]; pa[0] *= side;
    const pb = [...pts[kb][0]]; pb[0] *= side;
    const pc = [...pts[kc][0]]; pc[0] *= side;
    const ca = pts[ka][1];
    const cb = pts[kb][1];
    const cc = pts[kc][1];
    const n = cross(sub(pa, pc), sub(pa, pb));
    if (dot(n, n) < 1e-12) return;
    const mid = [(pa[0]+pb[0]+pc[0])/3 - ref[0], (pa[1]+pb[1]+pc[1])/3 - ref[1], (pa[2]+pb[2]+pc[2])/3 - ref[2]];
    const d = dot(n, mid);
    const flip = inward ? (d > 0) : (d < 0);
    if (flip) {
      positions.push(...pa, ...pc, ...pb);
      colors.push(...ca, ...cc, ...cb);
    } else {
      positions.push(...pa, ...pb, ...pc);
      colors.push(...ca, ...cb, ...cc);
    }
    uvs.push(1, 0, 0, 1, 0, 0);
  };

  for (const side of [1, -1]) {
    for (const t of outerTris) addTri(t[0], t[1], t[2], side, [0, 0.05, -0.05], false);
    for (const t of mouthTris) addTri(t[0], t[1], t[2], side, [0, -0.35, 0.90], true);
  }

  return {
    positions: new Float32Array(positions),
    uvs: new Float32Array(uvs),
    colors: new Float32Array(colors),
    vertexCount: positions.length / 3,
  };
}

export function makePerspectiveMatrix(fovDeg, aspect, near, far) {
  const f = 1.0 / Math.tan((fovDeg * Math.PI / 180) * 0.5);
  const nf = 1 / (near - far);
  return new Float32Array([
    f / Math.max(0.01, aspect), 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ]);
}

export function mulMat4(a, b) {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] =
        a[0 * 4 + r] * b[c * 4 + 0] +
        a[1 * 4 + r] * b[c * 4 + 1] +
        a[2 * 4 + r] * b[c * 4 + 2] +
        a[3 * 4 + r] * b[c * 4 + 3];
    }
  }
  return out;
}

export function makeViewMatrix(pos, pitch, roll = 0) {
  const cp = Math.cos(-pitch), sp = Math.sin(-pitch);
  const cr = Math.cos(-roll), sr = Math.sin(-roll);
  // Rotate Z(roll) * Rotate X(pitch) * Translate(-pos)
  const rx = new Float32Array([
    1, 0, 0, 0,
    0, cp, sp, 0,
    0, -sp, cp, 0,
    0, 0, 0, 1,
  ]);
  const rz = new Float32Array([
    cr, sr, 0, 0,
    -sr, cr, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ]);
  const tr = new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    -pos[0], -pos[1], -pos[2], 1,
  ]);
  return mulMat4(rz, mulMat4(rx, tr));
}
