/**
 * Radical Scene & X/Y Coordinate Allocation Engine
 * Clicking `haecceity` rerolls a radical new scene across:
 *   - 51 Imported Background Shaders
 *   - 13 Imported Multi-Pass GPU Foreground Fields
 *   - 40 Imported Glitch Shaders (stacked chains + parameter sweeps)
 *   - Tempo extremes, Polymeters, Kick Engine, 4 Drumkits, IDM Plugin, Unstable Path, MumbleSpeak
 */

import { makePrng, splitmix32, formatHex16 } from './chaos-seed.js';
import { FG_FIELD_NAMES } from './visual/haecceity-gpu.js';

export const COMPOSITION_ARCHETYPES = [
  'DOOM_TECHNO',
  'BROKEN_IDM',
  'BREAKCORE',
  'DEATH_INDUSTRIAL',
  'DARK_AMBIENT',
  'POWER_ELECTRONICS',
];

// Authored Haecceity Ambient & Pad presets ported from build_ambient_presets.py / build_ambient_pad_voice2.py
export const AMBIENT_PAD_PRESETS = [
  { name: 'Evening Reels',    rootMidi: 48, chord: [0, 7, 12],     prog: [0, 7, 0, 5],  shape: 0.12, pulseMix: 0.0,  pw: 0.50, subMix: 0.25, cutoff: 1850, res: 0.14, detune: 11, lfoRate: 0.045, warpDepth: 0.8,  padDelayMs: 32, padFeedback: 0.54, padWet: 0.36, vowel: -1, noise: 0.012, drive: 0.22 },
  { name: 'Lichen Chords',    rootMidi: 48, chord: [0, 5, 7, 12],  prog: [0, -2, 0, 5], shape: 0.08, pulseMix: 0.25, pw: 0.45, subMix: 0.30, cutoff: 1550, res: 0.12, detune: 13, lfoRate: 0.038, warpDepth: 0.7,  padDelayMs: 22, padFeedback: 0.42, padWet: 0.28, vowel: -1, noise: 0.008, drive: 0.18 },
  { name: 'Distant Strings',  rootMidi: 48, chord: [0, 7, 12, 19], prog: [0, 5, 7, 3],  shape: 0.35, pulseMix: 0.15, pw: 0.50, subMix: 0.28, cutoff: 1650, res: 0.12, detune: 16, lfoRate: 0.052, warpDepth: 0.9,  padDelayMs: 24, padFeedback: 0.46, padWet: 0.32, vowel: -1, noise: 0.010, drive: 0.20 },
  { name: 'Low Sun Ensemble', rootMidi: 43, chord: [0, 7, 12],     prog: [0, 5, 3, 7],  shape: 0.22, pulseMix: 0.10, pw: 0.48, subMix: 0.45, cutoff: 1150, res: 0.16, detune: 14, lfoRate: 0.035, warpDepth: 0.8,  padDelayMs: 28, padFeedback: 0.48, padWet: 0.30, vowel: 4,  noise: 0.014, drive: 0.28 },
  { name: 'Memory Glass',     rootMidi: 55, chord: [0, 7, 12],     prog: [0, 7, 5, 0],  shape: 0.06, pulseMix: 0.0,  pw: 0.50, subMix: 0.20, cutoff: 2400, res: 0.18, detune: 9,  lfoRate: 0.060, warpDepth: 0.6,  padDelayMs: 19, padFeedback: 0.52, padWet: 0.40, vowel: -1, noise: 0.006, drive: 0.16 },
  { name: 'Sleep Terminal',   rootMidi: 52, chord: [0, 5, 12],     prog: [0, 3, 5, 7],  shape: 0.15, pulseMix: 0.20, pw: 0.42, subMix: 0.30, cutoff: 1900, res: 0.14, detune: 12, lfoRate: 0.048, warpDepth: 1.2,  padDelayMs: 26, padFeedback: 0.50, padWet: 0.34, vowel: 7,  noise: 0.018, drive: 0.22 },
  { name: 'Blue Hour',        rootMidi: 48, chord: [0, 7, 11, 12], prog: [0, -3, 2, 5], shape: 0.28, pulseMix: 0.35, pw: 0.40, subMix: 0.38, cutoff: 920,  res: 0.15, detune: 12, lfoRate: 0.042, warpDepth: 0.7,  padDelayMs: 21, padFeedback: 0.40, padWet: 0.28, vowel: -1, noise: 0.010, drive: 0.25 },
  { name: 'Ion Voyager',      rootMidi: 43, chord: [0, 7, 12],     prog: [0, 7, 5, 2],  shape: 0.32, pulseMix: 0.55, pw: 0.36, subMix: 0.45, cutoff: 1250, res: 0.18, detune: 14, lfoRate: 0.055, warpDepth: 0.8,  padDelayMs: 29, padFeedback: 0.52, padWet: 0.38, vowel: -1, noise: 0.012, drive: 0.26 },
  { name: 'Phaedra Mist',     rootMidi: 48, chord: [0, 5, 7],      prog: [0, 3, 7, 5],  shape: 0.30, pulseMix: 0.30, pw: 0.44, subMix: 0.35, cutoff: 1650, res: 0.24, detune: 15, lfoRate: 0.050, warpDepth: 1.1,  padDelayMs: 25, padFeedback: 0.48, padWet: 0.34, vowel: -1, noise: 0.012, drive: 0.24 },
  { name: 'Rubycon Drift',    rootMidi: 48, chord: [0, 7, 12],     prog: [0, 5, 2, 7],  shape: 0.24, pulseMix: 0.60, pw: 0.32, subMix: 0.32, cutoff: 1450, res: 0.16, detune: 13, lfoRate: 0.040, warpDepth: 1.3,  padDelayMs: 31, padFeedback: 0.56, padWet: 0.40, vowel: -1, noise: 0.010, drive: 0.24 },
  { name: 'Ravine Organ',     rootMidi: 43, chord: [0, 7, 12],     prog: [0, 1, 5, 0],  shape: 0.28, pulseMix: 0.20, pw: 0.50, subMix: 0.48, cutoff: 980,  res: 0.18, detune: 16, lfoRate: 0.036, warpDepth: 1.5,  padDelayMs: 27, padFeedback: 0.50, padWet: 0.34, vowel: -1, noise: 0.014, drive: 0.38 },
  { name: 'Glacial Radio',    rootMidi: 46, chord: [0, 5, 12],     prog: [0, -2, 3, 0], shape: 0.18, pulseMix: 0.15, pw: 0.46, subMix: 0.34, cutoff: 1750, res: 0.14, detune: 14, lfoRate: 0.032, warpDepth: 1.8,  padDelayMs: 34, padFeedback: 0.54, padWet: 0.36, vowel: -1, noise: 0.025, drive: 0.24 },
  { name: 'Warm Analog Swell',rootMidi: 48, chord: [0, 4, 7, 11],  prog: [0, -3, 5, 7], shape: 0.48, pulseMix: 0.25, pw: 0.45, subMix: 0.36, cutoff: 1120, res: 0.22, detune: 16, lfoRate: 0.065, warpDepth: 0.6,  padDelayMs: 20, padFeedback: 0.36, padWet: 0.26, vowel: -1, noise: 0.008, drive: 0.28 },
  { name: 'Glass Cathedral',  rootMidi: 52, chord: [0, 7, 12, 19], prog: [0, 5, 7, 2],  shape: 0.10, pulseMix: 0.10, pw: 0.50, subMix: 0.25, cutoff: 2350, res: 0.20, detune: 10, lfoRate: 0.055, warpDepth: 0.5,  padDelayMs: 23, padFeedback: 0.50, padWet: 0.38, vowel: -1, noise: 0.006, drive: 0.18 },
  { name: 'Solaris Strings',  rootMidi: 48, chord: [0, 3, 7, 12],  prog: [0, 5, 3, -2], shape: 0.44, pulseMix: 0.20, pw: 0.50, subMix: 0.32, cutoff: 1750, res: 0.15, detune: 18, lfoRate: 0.058, warpDepth: 0.8,  padDelayMs: 24, padFeedback: 0.44, padWet: 0.32, vowel: -1, noise: 0.010, drive: 0.24 },
  { name: 'Cyberpunk Neon',   rootMidi: 45, chord: [0, 7, 10, 12], prog: [0, 3, 5, -2], shape: 0.38, pulseMix: 0.55, pw: 0.34, subMix: 0.42, cutoff: 1380, res: 0.26, detune: 14, lfoRate: 0.075, warpDepth: 0.9,  padDelayMs: 22, padFeedback: 0.46, padWet: 0.32, vowel: 3,  noise: 0.010, drive: 0.32 },
];

function pick(arr, t) {
  return arr[Math.min(arr.length - 1, Math.max(0, Math.floor(t * arr.length)))];
}

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

export function createScene(seed16, { backgroundCount = 51, glitchCount = 40, archetype = null } = {}) {
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

  // Equal 50/50 split between Beat/IDM/Breakcore (0..2) and Death Industrial / Dark Ambient / Power Electronics (3..5)
  const isHeavyDarkFamily = rng.nextFloat() < 0.5;
  const rolledArchetype = isHeavyDarkFamily ? rng.int(3, 5) : rng.int(0, 2);
  const tempoArchetype = typeof archetype === 'number' ? clamp(Math.round(archetype), 0, 5) : rolledArchetype;
  const archetypeName = COMPOSITION_ARCHETYPES[tempoArchetype];

  let bpmMin;
  let bpmMax;
  if (tempoArchetype === 0) {
    bpmMin = rng.int(78, 102);
    bpmMax = rng.int(128, 152);
  } else if (tempoArchetype === 1) {
    bpmMin = rng.int(118, 138);
    bpmMax = rng.int(162, 188);
  } else if (tempoArchetype === 2) {
    bpmMin = rng.int(150, 174);
    bpmMax = rng.int(190, 224);
  } else if (tempoArchetype === 3) {
    // DEATH_INDUSTRIAL: tectonic, slow machinery / sub-crush
    bpmMin = rng.int(38, 52);
    bpmMax = rng.int(58, 76);
  } else if (tempoArchetype === 4) {
    // DARK_AMBIENT: glacial drift
    bpmMin = rng.int(30, 44);
    bpmMax = rng.int(48, 66);
  } else {
    // POWER_ELECTRONICS: unstable throbbing / harsh noise pulse
    bpmMin = rng.int(48, 72);
    bpmMax = rng.int(84, 118);
  }

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
    if (tempoArchetype === 3) {
      // Death industrial: sparse heavy slams, not a 4/4 dance groove
      const dens = [0.06, 0.14, 0.10, 0.22][q];
      return Array.from({ length: 16 }, (__, i) => {
        if (i === 0 && q % 2 === 0) return 2;
        return rng.nextFloat() < dens ? (rng.nextFloat() < 0.55 ? 2 : 1) : 0;
      });
    }
    if (tempoArchetype === 4) {
      // Dark ambient: beatless
      return Array.from({ length: 16 }, () => 0);
    }
    if (tempoArchetype === 5) {
      // Power electronics: beatless (pure feedback/noise/sub synth)
      return Array.from({ length: 16 }, () => 0);
    }
    const dens = [0.22, 0.48, 0.34, 0.64][q];
    return Array.from({ length: 16 }, (__, i) => {
      if (i === 0) return 2;
      return rng.nextFloat() < dens ? (rng.nextFloat() < 0.38 ? 2 : 1) : 0;
    });
  });

  const cornerDrums = Array.from({ length: 4 }, (_, q) =>
    Array.from({ length: 8 }, (__, slot) => {
      if (tempoArchetype === 3) {
        // Death industrial: sparse echoing metallic impacts (avoid busy hi-hats)
        const diDens = [0.08, 0.14, 0.12, 0.04, 0.04, 0.10, 0.08, 0.18][slot] * (0.6 + q * 0.25);
        return Array.from({ length: 16 }, () =>
          rng.nextFloat() < diDens ? Number(rng.range(0.55, 1.0).toFixed(2)) : 0
        );
      }
      if (tempoArchetype === 4) {
        // Dark ambient: ultra-sparse distant metallic/wire resonances (max 1-2 subtle ghosts)
        const ambDens = [0.0, 0.0, 0.015, 0.0, 0.0, 0.015, 0.0, 0.04][slot] * (0.5 + q * 0.2);
        return Array.from({ length: 16 }, () =>
          rng.nextFloat() < ambDens ? Number(rng.range(0.22, 0.42).toFixed(2)) : 0
        );
      }
      if (tempoArchetype === 5) {
        // Power electronics: rare harsh static/metal blasts, no conventional beat
        const peDens = [0.0, 0.03, 0.02, 0.02, 0.0, 0.02, 0.0, 0.04][slot] * (0.5 + q * 0.25);
        return Array.from({ length: 16 }, () =>
          rng.nextFloat() < peDens ? Number(rng.range(0.55, 0.90).toFixed(2)) : 0
        );
      }
      const baseDens = [0.24, 0.28, 0.22, 0.58, 0.20, 0.28, 0.25, 0.22][slot] * (0.65 + q * 0.3);
      return Array.from({ length: 16 }, () =>
        rng.nextFloat() < baseDens ? Number(rng.range(0.45, 1.0).toFixed(2)) : 0
      );
    })
  );

  const droneRootsPool = tempoArchetype >= 3
    ? [46.25, 55.00, 61.74, 73.42, 82.41, 98.00, 110.00, 130.81]
    : [55.00, 61.74, 73.42, 82.41, 98.00, 110.00, 130.81, 146.83];

  const fmRatiosPool = tempoArchetype >= 3
    ? [0.5, 0.7071, 1.0, 1.0595, 1.4142, 1.4983, 2.31, 3.1415, 4.71]
    : [0.5, 1.0, 1.4142, 1.5, 2.0, 2.718, 3.1415, 4.33, 5.66];

  const kitOrder = tempoArchetype === 3
    ? shuffle([1, 2, 1, 3])
    : tempoArchetype === 4
      ? shuffle([2, 3, 2, 1])
      : shuffle([0, 1, 2, 3]);

  const ambientPreset = AMBIENT_PAD_PRESETS[rng.int(0, AMBIENT_PAD_PRESETS.length - 1)];

  return {
    seed16: s16,
    hex: formatHex16(s16),
    tempoArchetype,
    archetypeName,
    ambientPreset,
    bgOrder,
    fgBase,
    fgBonus,
    fgBonus2,
    glitchOrder,
    paletteIndex,
    palette,
    bpmMin,
    bpmMax,
    kitOrder,
    kickOrder: shuffle([0, 1, 2, 3, 4]),
    idmOrder: shuffle([0, 1, 2, 3, 4, 5, 6]),
    routingOrder: shuffle([0, 1, 2, 3, 4, 5, 6, 7]),
    shaperOrder: shuffle([0, 1, 2, 3, 4]),
    droneRoots: shuffle(droneRootsPool),
    fmRatios: shuffle(fmRatiosPool),
    bases,
    cornerKick,
    cornerDrums,
    terrainMode: rng.int(0, 3),
    bgSwapOnDrag: rng.nextFloat() < 0.45,
    darkInterval: [1.4983, 1.4142, 1.0595, 0.7492][rng.int(0, 3)],
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

  const arch = scene.tempoArchetype ?? 1;
  const isBeatArch = arch < 3;
  const isDeathInd = arch === 3;
  const isAmbient = arch === 4;
  const isPowerElec = arch === 5;
  const textureMode = isDeathInd ? 1 : isAmbient ? 2 : isPowerElec ? 3 : 0;

  // Rhythm & Tempo
  const bpm = Math.round(lerp(scene.bpmMin, scene.bpmMax, clamp(0.6 * x + 0.4 * b(0), 0, 1)));
  const rhythmicDensity = isBeatArch
    ? clamp(0.25 + 0.75 * (0.5 * y + 0.5 * b(1)), 0.15, 1.0)
    : clamp(0.12 + 0.45 * (0.5 * y + 0.5 * b(1)), 0.08, 0.65);
  const polymeterSkew = Math.floor(b(2) * 4);

  const baseK = scene.cornerKick[quad];
  const kickPattern = baseK.map((v, i) => {
    if (!isBeatArch) {
      if (isAmbient) return (v > 0 && b((i + 5) % 24) > 0.35) ? v : 0;
      return (v > 0 && b((i + 3) % 24) > (1 - rhythmicDensity) * 0.45) ? v : 0;
    }
    if (i === 0) return 2;
    const threshold = (1 - rhythmicDensity) * 0.8;
    if (v > 0) return (b((i + 3) % 24) > threshold * 0.5) ? v : 0;
    return (rhythmicDensity > 0.72 && (i % 4 === 2 || i % 3 === 0) && b(i % 24) > 0.68) ? 1 : 0;
  });

  const baseD = scene.cornerDrums[quad];
  const drumPattern = baseD.map((row, slot) =>
    row.map((v, step) => {
      const gate = ((slot * 5 + step * 3) % 17) / 17;
      if (!isBeatArch) {
        return (v > 0 && gate < rhythmicDensity + 0.45) ? v : 0;
      }
      if (v > 0) return gate < rhythmicDensity + 0.2 ? v : 0;
      return (rhythmicDensity > 0.65 && gate < (rhythmicDensity - 0.55) * 0.7) ? 0.65 : 0;
    })
  );

  // Kick Engine
  const kickRecipe = scene.kickOrder[Math.min(scene.kickOrder.length - 1, Math.floor(b(3) * scene.kickOrder.length))];
  const kick = isAmbient ? {
    recipe: 3,
    pitchMidi: Math.round(lerp(22, 32, b(4))),
    drop: Math.round(lerp(10, 24, y)),
    glide: Math.round(lerp(6, 18, b(5))),
    shape: 0.0,
    sub: lerp(0.75, 1.08, 1 - y * 0.3),
    click: lerp(0.04, 0.22, x),
    drive1: lerp(0.08, 0.26, b(7)),
    screechHz: Math.round(lerp(80, 260, b(8))),
    decayMs: Math.round(lerp(620, 960, 1 - x * 0.3)),
  } : isDeathInd ? {
    recipe: kickRecipe,
    pitchMidi: Math.round(lerp(22, 33, b(4))),
    drop: Math.round(lerp(18, 46, y)),
    glide: Math.round(lerp(8, 22, b(5))),
    shape: lerp(0.25, 0.95, b(6)),
    sub: lerp(0.55, 1.12, 1 - y * 0.35),
    click: lerp(0.35, 1.85, x),
    drive1: lerp(0.58, 0.98, clamp(0.55 * y + 0.45 * b(7), 0, 1)),
    screechHz: Math.round(lerp(160, 2200, b(8))),
    decayMs: Math.round(lerp(420, 880, 1 - x * 0.35)),
  } : {
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
  const drumPitchShift = isDeathInd
    ? lerp(-14, -4, b(10))
    : isAmbient
      ? lerp(-12, 2, b(10))
      : lerp(-8, 10, b(10));

  // IDM Plugin
  const idmModel = scene.idmOrder[Math.min(scene.idmOrder.length - 1, Math.floor((y * 0.5 + b(11) * 0.5) * scene.idmOrder.length))];
  const idmAlt = (x > 0.66 || y > 0.76 || b(12) > 0.72) ? 1 : 0;
  const idm = isAmbient ? {
    model: idmModel,
    alt: 0,
    wet: lerp(0.75, 0.98, b(0)),
    amount: lerp(0.35, 0.72, y),
    p0: lerp(0.08, 0.32, b(13)),
    p1: lerp(0.20, 0.55, b(14)),
    p2: lerp(0.15, 0.45, b(15)),
    p3: lerp(0.10, 0.45, b(16)),
    p4: lerp(0.20, 0.55, b(17)),
    p5: lerp(0.12, 0.58, y),
    p6: lerp(0.76, 0.96, b(1)),
    p7: lerp(0.12, 0.48, x),
    p8: lerp(0.84, 0.98, clamp(0.6 * y + 0.4 * b(4), 0, 1)),
    p9: lerp(0.15, 0.55, b(6)),
    p10: lerp(0.04, 0.20, x),
    p11: lerp(0.25, 0.75, b(7)),
    p12: lerp(0.20, 0.55, b(2)),
    p13: lerp(0.15, 0.55, b(10)),
    p16: lerp(0.10, 0.45, b(12)),
    p18: lerp(0.05, 0.35, x),
    p20: lerp(0.10, 0.35, 1 - x),
  } : {
    model: idmModel,
    alt: idmAlt,
    wet: lerp(0.70, 1.0, clamp(x + 0.25, 0, 1)),
    amount: lerp(0.58, 1.0, clamp(0.5 * x + 0.5 * y, 0, 1)),
    p0: lerp(0.35, 0.98, clamp(0.6 * x + 0.4 * b(13), 0, 1)),
    p1: lerp(0.45, 1.0, b(14)),
    p2: lerp(0.15, 0.95, b(15)),
    p3: lerp(0.10, 0.95, b(16)),
    p4: lerp(0.25, 0.95, b(17)),
    p5: isDeathInd ? lerp(0.10, 0.55, y) : lerp(0.15, 0.98, y),
    p6: isDeathInd ? lerp(0.55, 0.95, b(1)) : lerp(0.20, 0.90, b(1)),
    p7: lerp(0.20, 0.95, x),
    p8: isDeathInd ? lerp(0.68, 0.98, clamp(0.6 * y + 0.4 * b(4), 0, 1)) : lerp(0.32, 0.98, clamp(0.6 * y + 0.4 * b(4), 0, 1)),
    p9: lerp(0.10, 0.95, b(6)),
    p10: isBeatArch ? lerp(0.25, 0.95, clamp(0.7 * x + 0.3 * b(9), 0, 1)) : lerp(0.12, 0.55, x),
    p11: lerp(0.20, 0.95, b(7)),
    p12: lerp(0.30, 0.95, b(2)),
    p13: lerp(0.10, 0.72, b(10)),
    p16: lerp(0.15, 0.75, b(12)),
    p18: lerp(0.12, 0.92, x),
    p20: lerp(0.10, 0.58, 1 - x),
  };

  // Unstable Signal Path
  const routingIndex = pick(scene.routingOrder, b(5));
  const shaperModeIndex = pick(scene.shaperOrder, b(8));
  const droneBaseHz = pick(scene.droneRoots, b(11));
  const fmRatio = pick(scene.fmRatios, b(14));
  const preset = scene.ambientPreset || AMBIENT_PAD_PRESETS[0];

  const unstableDsp = {
    textureMode,
    darkInterval: scene.darkInterval || 1.4983,
    routingIndex,
    shaperModeIndex,
    bitDepth: isAmbient ? Math.round(lerp(12, 16, 1 - x * 0.25)) : Math.round(lerp(4, 15, 1 - x * 0.65)),
    srDivider: isAmbient ? 1 : Math.round(lerp(1, 14, clamp(x * 0.75 + b(16) * 0.25, 0, 1))),
    xorMask: Math.floor(b(13) * 31),
    droneBaseHz,
    fmRatio,
    subInterval: pick([0.5, 0.75, 1.0, 1.5], b(3)),
    lfsrMask: (scene.seed16 ^ (quad * 0x1337)) | 0x8001,
    pulseEuclidK: isBeatArch ? Math.round(lerp(3, 11, b(6))) : Math.round(lerp(1, 5, b(6))),
    pulseEuclidN: pick([12, 14, 16, 18], b(7)),
    mangleSliceMs: isDeathInd ? Math.round(lerp(60, 260, 1 - x * 0.6)) : Math.round(lerp(12, 140, 1 - x * 0.7)),
    mangleRevProb: lerp(0.15, 0.90, b(9)),
    fbDelayLMs: isAmbient
      ? Number(lerp(180, 460, b(10)).toFixed(1))
      : isDeathInd
        ? Number(lerp(110, 380, b(10)).toFixed(1))
        : isPowerElec
          ? Number(lerp(18, 180, b(10)).toFixed(1))
          : Number(lerp(16, 180, b(10)).toFixed(1)),
    fbDelayRMs: isAmbient
      ? Number(lerp(240, 560, b(12)).toFixed(1))
      : isDeathInd
        ? Number(lerp(160, 480, b(12)).toFixed(1))
        : isPowerElec
          ? Number(lerp(24, 240, b(12)).toFixed(1))
          : Number(lerp(24, 210, b(12)).toFixed(1)),
    fbPolarity: b(15) > 0.5 ? 1 : -1,
    combBaseHz: Math.round(lerp(90, 640, y)),
    ambientPreset: {
      ...preset,
      cutoff: Math.round(preset.cutoff * lerp(0.55, 1.65, y)),
      res: clamp(preset.res + x * 0.14, 0.06, 0.42),
      padWet: clamp(preset.padWet * lerp(0.65, 1.35, x), 0.12, 0.55),
      padFeedback: clamp(preset.padFeedback * lerp(0.75, 1.15, y), 0.18, 0.68),
      detune: preset.detune * lerp(0.65, 1.45, b(17)),
    },
  };

  const unstableParams = {
    sceneBoost: isBeatArch ? 1.22 : isAmbient ? 1.48 : isDeathInd ? 1.45 : 1.45,
    droneLevel: isBeatArch ? lerp(0.58, 0.94, b(0)) : lerp(0.84, 1.0, 0.35 + 0.65 * b(0)),
    pulseLevel: isAmbient ? lerp(0.14, 0.34, b(4)) : isPowerElec ? lerp(0.45, 0.95, b(4)) : lerp(0.45, 0.92, b(4)),
    fmIndex: isAmbient ? lerp(0.16, 0.58, y) : lerp(0.24, 0.92, y),
    mangleMix: isAmbient ? 0.0 : lerp(0.30, 0.85, x),
    shaperDrive: isAmbient
      ? lerp(0.14, 0.36, y)
      : isPowerElec
        ? lerp(0.55, 0.92, clamp(0.55 * y + 0.45 * b(17), 0, 1))
        : lerp(0.28, 0.88, clamp(0.5 * y + 0.5 * b(17), 0, 1)),
    fbGain: isAmbient
      ? lerp(0.42, 0.72, clamp(0.5 * y + 0.5 * b(2), 0, 1))
      : isDeathInd
        ? lerp(0.42, 0.74, clamp(0.55 * y + 0.45 * b(2), 0, 1))
        : isPowerElec
          ? lerp(0.45, 0.74, clamp(0.6 * y + 0.4 * b(2), 0, 1))
          : lerp(0.35, 0.76, clamp(0.6 * y + 0.4 * b(2), 0, 1)),
    fbDampHz: isAmbient
      ? Math.round(lerp(1100, 3400, 1 - y * 0.35))
      : isDeathInd
        ? Math.round(lerp(750, 2400, 1 - y * 0.35))
        : isPowerElec
          ? Math.round(lerp(900, 2600, 1 - y * 0.35))
          : Math.round(lerp(1200, 6800, 1 - y * 0.4)),
    scDepth: isAmbient ? 0.0 : isPowerElec ? 0.08 : isDeathInd ? lerp(0.16, 0.38, b(1)) : lerp(0.22, 0.48, b(1)),
    scMode: isBeatArch ? (b(14) > 0.75 ? 1 : 0) : 0,
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

  // Visual Scene + X/Y Uniform Allocation across ALL 51 Backgrounds, 13 Foregrounds, 40 Glitch Shaders
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
    tempoArchetype: scene.tempoArchetype,
    archetypeName: scene.archetypeName,
    ambientPresetName: preset.name,
  };
}
