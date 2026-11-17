/**
 * Radical Scene & X/Y Coordinate Allocation Engine
 * Clicking `haecceity` rerolls a radical new scene across:
 *   - 52 Imported Background Shaders
 *   - 13 Imported Multi-Pass GPU Foreground Fields
 *   - 40 Imported Glitch Shaders (stacked chains + parameter sweeps)
 *   - Tempo extremes, Polymeters, Kick Engine, 4 Drumkits, IDM Plugin, Unstable Path, MumbleSpeak
 */

import { makePrng, splitmix32, formatHex16 } from './chaos-seed.js';
import { FG_FIELD_NAMES } from './visual/haecceity-gpu.js';

export const PALETTES = [
  { name: 'TEXTMODE_CYAN',   a: [0.02, 0.03, 0.04], b: [0.28, 0.85, 0.92], accent: [0.95, 0.92, 0.20] },
  { name: 'VECTREX_SUN',     a: [0.03, 0.02, 0.05], b: [0.95, 0.65, 0.35], accent: [0.46, 0.56, 1.00] },
  { name: 'COLONY_AMBER',    a: [0.02, 0.03, 0.04], b: [0.92, 0.68, 0.25], accent: [0.30, 0.72, 0.92] },
  { name: 'PHOSPHOR_ASH',    a: [0.03, 0.04, 0.03], b: [0.58, 0.96, 0.72], accent: [1.00, 0.30, 0.22] },
  { name: 'GLYPH_VIOLET',    a: [0.02, 0.02, 0.04], b: [0.85, 0.86, 0.95], accent: [0.52, 0.54, 1.00] },
  { name: 'OXIDE_SHARD',     a: [0.04, 0.02, 0.02], b: [0.96, 0.42, 0.28], accent: [0.35, 0.95, 0.86] },
  { name: 'ACID_LIME',       a: [0.02, 0.04, 0.02], b: [0.76, 1.00, 0.24], accent: [0.95, 0.25, 0.78] },
  { name: 'CRYSTAL_BLEACH',  a: [0.03, 0.03, 0.04], b: [0.94, 0.96, 0.98], accent: [0.22, 0.88, 1.00] },
];

export const DSP_ROUTINGS = [
  'SERIAL_FWD',
  'PRE_SHAPED',
  'FB_CROSS_FM',
  'PARALLEL_FOLD',
  'LOOP_MANGLE',
  'RING_MATRIX',
  'REV_COMB_FEED',
  'FULL_INJECT',
];

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function createScene(seed16, { backgroundCount = 52, glitchCount = 40 } = {}) {
  const s16 = (seed16 >>> 0) & 0xffff;
  const rng = makePrng(splitmix32(s16 ^ 0x9e3779b9));

  const shuffle = (arr) => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = rng.int(0, i);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  // Pick a radical combination of Background + 2..3 Foreground Fields + 3..4 Glitch Shaders
  const bgOrder = shuffle(Array.from({ length: backgroundCount }, (_, i) => i));
  const fgOrder = shuffle(FG_FIELD_NAMES);
  const glitchOrder = shuffle(Array.from({ length: glitchCount }, (_, i) => i));

  // Choose primary + secondary foreground fields per scene, plus a quadrant-triggered 3rd field
  const fgBase = [fgOrder[0], fgOrder[1]];
  const fgBonus = fgOrder[2];
  const fgBonus2 = fgOrder[3];

  const paletteIndex = rng.int(0, PALETTES.length - 1);
  const palette = PALETTES[paletteIndex];

  // Radical tempo archetypes: slow crushed doom, mid broken techno, fast footwork/breakcore
  const tempoArchetype = rng.int(0, 2);
  const bpmMin = tempoArchetype === 0 ? rng.int(78, 102) : tempoArchetype === 1 ? rng.int(118, 138) : rng.int(150, 174);
  const bpmMax = tempoArchetype === 0 ? rng.int(128, 152) : tempoArchetype === 1 ? rng.int(162, 188) : rng.int(190, 224);

  const bases = Array.from({ length: 24 }, () => ({
    wx: rng.range(-2.4, 2.4),
    wy: rng.range(-2.4, 2.4),
    phase: rng.range(0, Math.PI * 2),
    freq: rng.range(1.2, 5.5),
    cx: rng.range(0.08, 0.92),
    cy: rng.range(0.08, 0.92),
    mode: rng.int(0, 2),
  }));

  const cornerKick = Array.from({ length: 4 }, (_, q) => {
    const dens = [0.22, 0.48, 0.34, 0.64][q];
    return Array.from({ length: 16 }, (__, i) => {
      if (i === 0) return 2;
      return rng.nextFloat() < dens ? (rng.nextFloat() < 0.38 ? 2 : 1) : 0;
    });
  });

  const cornerDrums = Array.from({ length: 4 }, (_, q) =>
    Array.from({ length: 8 }, (__, slot) => {
      const baseDens = [0.24, 0.28, 0.22, 0.58, 0.20, 0.28, 0.25, 0.22][slot] * (0.65 + q * 0.3);
      return Array.from({ length: 16 }, () =>
        rng.nextFloat() < baseDens ? Number(rng.range(0.45, 1.0).toFixed(2)) : 0
      );
    })
  );

  return {
    seed16: s16,
    hex: formatHex16(s16),
    bgOrder,
    fgBase,
    fgBonus,
    fgBonus2,
    glitchOrder,
    paletteIndex,
    palette,
    bpmMin,
    bpmMax,
    kitOrder: shuffle([0, 1, 2, 3]),
    kickOrder: shuffle([0, 1, 2, 3, 4]),
    idmOrder: shuffle([0, 1, 2, 3, 4, 5, 6]),
    routingOrder: shuffle([0, 1, 2, 3, 4, 5, 6, 7]),
    shaperOrder: shuffle([0, 1, 2, 3, 4]),
    droneRoots: shuffle([32.70, 36.71, 41.20, 49.00, 55.00, 61.74, 73.42, 82.41, 98.00]),
    fmRatios: shuffle([0.5, 1.0, 1.4142, 1.5, 2.0, 2.718, 3.1415, 4.33, 5.66]),
    bases,
    cornerKick,
    cornerDrums,
    terrainMode: rng.int(0, 3),
    bgSwapOnDrag: rng.nextFloat() < 0.45,
  };
}

function evalBasis(b, x, y) {
  if (b.mode === 0) {
    return clamp(0.5 + (x - 0.5) * b.wx * 0.65 + (y - 0.5) * b.wy * 0.65, 0, 1);
  } else if (b.mode === 1) {
    return 0.5 + 0.5 * Math.sin((x * b.wx + y * b.wy) * b.freq + b.phase);
  } else {
    const dx = x - b.cx;
    const dy = y - b.cy;
    const d = Math.sqrt(dx * dx + dy * dy);
    return clamp(Math.exp(-d * 2.2) * (0.55 + 0.45 * Math.cos(d * b.freq * 3.2 + b.phase)), 0, 1);
  }
}

export function allocateFromXY(scene, rawX, rawY) {
  const x = clamp(rawX, 0, 1);
  const y = clamp(rawY, 0, 1);
  const b = (i) => evalBasis(scene.bases[i % scene.bases.length], x, y);

  const qx = x < 0.5 ? 0 : 1;
  const qy = y < 0.5 ? 0 : 1;
  const quad = qy * 2 + qx;

  // Rhythm & Tempo
  const bpm = Math.round(lerp(scene.bpmMin, scene.bpmMax, clamp(0.6 * x + 0.4 * b(0), 0, 1)));
  const rhythmicDensity = clamp(0.25 + 0.75 * (0.5 * y + 0.5 * b(1)), 0.15, 1.0);
  const polymeterSkew = Math.floor(b(2) * 4);

  const baseK = scene.cornerKick[quad];
  const kickPattern = baseK.map((v, i) => {
    if (i === 0) return 2;
    const threshold = (1 - rhythmicDensity) * 0.8;
    if (v > 0) return (b((i + 3) % 24) > threshold * 0.5) ? v : 0;
    return (rhythmicDensity > 0.72 && (i % 4 === 2 || i % 3 === 0) && b(i % 24) > 0.68) ? 1 : 0;
  });

  const baseD = scene.cornerDrums[quad];
  const drumPattern = baseD.map((row, slot) =>
    row.map((v, step) => {
      const gate = ((slot * 5 + step * 3) % 17) / 17;
      if (v > 0) return gate < rhythmicDensity + 0.2 ? v : 0;
      return (rhythmicDensity > 0.65 && gate < (rhythmicDensity - 0.55) * 0.7) ? 0.65 : 0;
    })
  );

  // Kick Engine
  const kickRecipe = scene.kickOrder[Math.min(scene.kickOrder.length - 1, Math.floor(b(3) * scene.kickOrder.length))];
  const kick = {
    recipe: kickRecipe,
    pitchMidi: Math.round(lerp(26, 46, b(4))),
    drop: Math.round(lerp(20, 56, y)),
    glide: Math.round(lerp(3, 20, b(5))),
    shape: lerp(0.0, 0.9, b(6)),
    sub: lerp(0.32, 1.08, 1 - y * 0.45),
    click: lerp(0.4, 2.1, x),
    drive1: lerp(0.22, 0.95, clamp(0.55 * y + 0.45 * b(7), 0, 1)),
    screechHz: Math.round(lerp(130, 2800, b(8))),
    decayMs: Math.round(lerp(160, 640, 1 - x * 0.45)),
  };

  // Drumkit
  const kitIndex = scene.kitOrder[Math.min(3, Math.floor((x * 0.65 + b(9) * 0.35) * 4))];
  const drumPitchShift = lerp(-8, 10, b(10));

  // IDM Plugin
  const idmModel = scene.idmOrder[Math.min(scene.idmOrder.length - 1, Math.floor((y * 0.5 + b(11) * 0.5) * scene.idmOrder.length))];
  const idmAlt = (x > 0.66 || y > 0.76 || b(12) > 0.72) ? 1 : 0;
  const idm = {
    model: idmModel,
    alt: idmAlt,
    wet: lerp(0.70, 1.0, clamp(x + 0.25, 0, 1)),
    amount: lerp(0.58, 1.0, clamp(0.5 * x + 0.5 * y, 0, 1)),
    p0: lerp(0.35, 0.98, clamp(0.6 * x + 0.4 * b(13), 0, 1)),
    p1: lerp(0.45, 1.0, b(14)),
    p2: lerp(0.15, 0.95, b(15)),
    p3: lerp(0.10, 0.95, b(16)),
    p4: lerp(0.25, 0.95, b(17)),
    p5: lerp(0.15, 0.98, y),
    p6: lerp(0.20, 0.90, b(1)),
    p7: lerp(0.20, 0.95, x),
    p8: lerp(0.32, 0.98, clamp(0.6 * y + 0.4 * b(4), 0, 1)),
    p9: lerp(0.10, 0.95, b(6)),
    p10: lerp(0.25, 0.95, clamp(0.7 * x + 0.3 * b(9), 0, 1)),
    p11: lerp(0.20, 0.95, b(7)),
    p12: lerp(0.30, 0.95, b(2)),
    p13: lerp(0.10, 0.72, b(10)),
    p16: lerp(0.15, 0.75, b(12)),
    p18: lerp(0.12, 0.92, x),
    p20: lerp(0.10, 0.58, 1 - x),
  };

  // Unstable Signal Path
  const routingIndex = scene.routingOrder[Math.min(7, Math.floor(b(5) * 8))];
  const shaperModeIndex = scene.shaperOrder[Math.min(4, Math.floor(b(8) * 5))];
  const droneBaseHz = scene.droneRoots[Math.floor(b(11) * scene.droneRoots.length)];
  const fmRatio = scene.fmRatios[Math.floor(b(14) * scene.fmRatios.length)];

  const unstableDsp = {
    routingIndex,
    shaperModeIndex,
    bitDepth: Math.round(lerp(4, 15, 1 - x * 0.65)),
    srDivider: Math.round(lerp(1, 14, clamp(x * 0.75 + b(16) * 0.25, 0, 1))),
    xorMask: Math.floor(b(13) * 31),
    droneBaseHz,
    fmRatio,
    subInterval: [0.5, 0.75, 1.0, 1.5][Math.floor(b(3) * 4)],
    lfsrMask: (scene.seed16 ^ (quad * 0x1337)) | 0x8001,
    pulseEuclidK: Math.round(lerp(3, 11, b(6))),
    pulseEuclidN: [12, 14, 16, 18][Math.floor(b(7) * 4)],
    mangleSliceMs: Math.round(lerp(12, 140, 1 - x * 0.7)),
    mangleRevProb: lerp(0.15, 0.90, b(9)),
    fbDelayLMs: Number(lerp(16, 180, b(10)).toFixed(1)),
    fbDelayRMs: Number(lerp(24, 210, b(12)).toFixed(1)),
    fbPolarity: b(15) > 0.5 ? 1 : -1,
    combBaseHz: Math.round(lerp(90, 640, y)),
  };

  const unstableParams = {
    droneLevel: lerp(0.22, 0.78, b(0)),
    pulseLevel: lerp(0.25, 0.85, b(4)),
    fmIndex: lerp(0.18, 0.95, y),
    mangleMix: lerp(0.30, 0.95, x),
    shaperDrive: lerp(0.20, 0.96, clamp(0.5 * y + 0.5 * b(17), 0, 1)),
    fbGain: lerp(0.32, 0.96, clamp(0.6 * y + 0.4 * b(2), 0, 1)),
    fbDampHz: Math.round(lerp(900, 11000, 1 - y * 0.4)),
    scDepth: lerp(0.55, 0.96, b(1)),
    scMode: Math.floor(b(14) * 4),
    padX: x,
    padY: y,
  };

  const mumble = {
    pitchShift: lerp(-9, 12, y),
    speedScale: lerp(0.55, 1.65, 1 - x * 0.5),
    vocalSize: lerp(0.65, 1.55, b(8)),
    fragment: clamp((x - 0.35) * 1.4, 0, 0.92),
    reverseMix: clamp((b(13) - 0.3) * 1.3, 0, 0.88),
    roughness: lerp(0.08, 0.65, y),
    carrierRing: clamp((b(5) - 0.45) * 1.5, 0, 0.75),
  };

  // Visual Scene + X/Y Uniform Allocation across ALL 52 Backgrounds, 13 Foregrounds, 40 Glitch Shaders
  const backgroundIndex = scene.bgSwapOnDrag
    ? scene.bgOrder[quad % scene.bgOrder.length]
    : scene.bgOrder[0];

  const foregroundFields = [...scene.fgBase];
  if (x > 0.6 && !foregroundFields.includes(scene.fgBonus)) {
    foregroundFields.push(scene.fgBonus);
  }
  if (y > 0.65 && !foregroundFields.includes(scene.fgBonus2)) {
    foregroundFields.push(scene.fgBonus2);
  }

  // Always stack 2 core scene glitch shaders + add 3rd/4th glitch passes as X/Y sweeps!
  const glitchIndices = [scene.glitchOrder[0], scene.glitchOrder[1]];
  const glitchWeights = [0.45 + 0.75 * b(18), 0.35 + 0.85 * b(19)];
  if (x > 0.45 || b(20) > 0.55) {
    glitchIndices.push(scene.glitchOrder[2]);
    glitchWeights.push(0.4 + 0.9 * x);
  }
  if (y > 0.55 || b(21) > 0.65) {
    glitchIndices.push(scene.glitchOrder[3]);
    glitchWeights.push(0.4 + 0.9 * y);
  }

  const bgXY = [x, y, b(18), b(19), b(20), b(21), b(22), b(23)];
  const glitchXY = [b(22), b(23), x, y, b(19), b(20), b(18), b(21)];

  const visual = {
    backgroundIndex,
    foregroundFields,
    glitchIndices,
    glitchWeights,
    bgXY,
    glitchXY,
    palette: scene.palette,
    terrainMode: (scene.terrainMode + (x > 0.75 ? 1 : 0)) % 4,
  };

  return {
    x,
    y,
    quad,
    bpm,
    polymeterSkew,
    kickPattern,
    drumPattern,
    kick,
    kitIndex,
    drumPitchShift,
    idm,
    unstableDsp,
    unstableParams,
    mumble,
    visual,
    routingName: DSP_ROUTINGS[routingIndex],
  };
}
