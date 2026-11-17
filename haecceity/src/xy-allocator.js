/**
 * Radical Scene & X/Y Coordinate Allocation Engine
 * Clicking `haecceity` rerolls a radical new scene across:
 *   - 51 Imported Background Shaders
 *   - 13 Imported Multi-Pass GPU Foreground Fields
 *   - 40 Imported Glitch Shaders (stacked chains + parameter sweeps)
 *   - Imported Genre_Bin Projects (Dark Ambient, Illbient, Digital Hardcore,
 *     Microsound, Lowercase, Flashcore, Breakcore, Power Electronics,
 *     Death Industrial, Deconstruction, Crossbreed, Industrial Techno)
 *   - 12 Procedural Drumkits, 8 Kick Recipes, IDM Plugin, Unstable Path, MumbleSpeak
 *   - Coarse Cross-Pollination on random generation + Fine Cross-Pollination on X/Y sweep
 */

import { makePrng, splitmix32, formatHex16 } from './chaos-seed.js';
import { FG_FIELD_NAMES } from './visual/haecceity-gpu.js';
import { DARK_AMBIENT_PRESETS, GENRE_BIN_PROJECTS, projectsForArchetype } from './genre-projects.js';

export const COMPOSITION_ARCHETYPES = [
  'DECONSTRUCTION',
  'MICROSOUND',
  'DIGITAL_HARDCORE',
  'DEATH_INDUSTRIAL',
  'DARK_AMBIENT',
  'POWER_ELECTRONICS',
];

export const AMBIENT_PAD_PRESETS = DARK_AMBIENT_PRESETS;

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

function makePatternFromDensity(rng, kDens, dDens, isBeat) {
  const kick = Array.from({ length: 16 }, (_, i) => {
    if (kDens <= 0.01) return 0;
    if (isBeat && i === 0) return 2;
    return rng.nextFloat() < kDens ? (rng.nextFloat() < 0.42 ? 2 : 1) : 0;
  });
  const drums = Array.from({ length: 8 }, (_, slot) => {
    // Weight kick/snare/hat/perc slots realistically while preserving sparse/microsound holes
    const slotScale = [0.6, 0.85, 0.75, 1.25, 0.55, 0.8, 0.7, 0.95][slot];
    const dens = clamp(dDens * slotScale, 0, 0.92);
    return Array.from({ length: 16 }, () =>
      rng.nextFloat() < dens ? Number(rng.range(0.38, 1.0).toFixed(2)) : 0
    );
  });
  return { kick, drums };
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

  const fgBase = [fgOrder[0], fgOrder[1]];
  const fgBonus = fgOrder[2];
  const fgBonus2 = fgOrder[3];

  const paletteIndex = rng.int(0, PALETTES.length - 1);
  const palette = PALETTES[paletteIndex];

  // Equal 50/50 split between Beat/Microsound/Hardcore/Deconstruction (0..2) and Industrial/Dark Ambient/PE (3..5)
  const isHeavyDarkFamily = rng.nextFloat() < 0.5;
  const rolledArchetype = isHeavyDarkFamily ? rng.int(3, 5) : rng.int(0, 2);
  const tempoArchetype = typeof archetype === 'number' ? clamp(Math.round(archetype), 0, 5) : rolledArchetype;
  const archetypeName = COMPOSITION_ARCHETYPES[tempoArchetype];

  // Primary Genre_Bin project + Coarse Cross-Pollination donor project
  const primaryPool = projectsForArchetype(tempoArchetype);
  const primaryProject = primaryPool[rng.int(0, primaryPool.length - 1)] || GENRE_BIN_PROJECTS[0];

  const donorPool = GENRE_BIN_PROJECTS.filter((p) => p.id !== primaryProject.id);
  const crossGenrePool = donorPool.filter((p) => p.genre !== primaryProject.genre);
  const useCrossGenre = rng.nextFloat() < 0.82 && crossGenrePool.length > 0;
  const donorCandidates = useCrossGenre ? crossGenrePool : donorPool;
  const donorProject = donorCandidates[rng.int(0, donorCandidates.length - 1)] || primaryProject;

  // Coarse cross-pollination amount determined at scene generation
  const coarseCrossAmt = rng.range(0.18, 0.55);

  const bpmMin = Math.round(lerp(primaryProject.bpm[0], donorProject.bpm[0], coarseCrossAmt * 0.45));
  const bpmMax = Math.round(Math.max(bpmMin + 8, lerp(primaryProject.bpm[1], donorProject.bpm[1], coarseCrossAmt * 0.55)));

  const bases = Array.from({ length: 24 }, () => ({
    wx: rng.range(-2.4, 2.4),
    wy: rng.range(-2.4, 2.4),
    phase: rng.range(0, Math.PI * 2),
    freq: rng.range(1.2, 5.5),
    cx: rng.range(0.08, 0.92),
    cy: rng.range(0.08, 0.92),
    mode: rng.int(0, 2),
  }));

  // 4 Quadrant patterns: Q0 leans Primary, Q1/Q2 cross-breed, Q3 leans Donor hybrid
  const isBeatPrimary = tempoArchetype < 3;
  const cornerKick = [];
  const cornerDrums = [];
  for (let q = 0; q < 4; q++) {
    const qMix = [0.0, coarseCrossAmt * 0.55, coarseCrossAmt * 0.85, Math.min(0.95, coarseCrossAmt + 0.35)][q];
    const kDens = lerp(
      lerp(primaryProject.kickDensity[0], primaryProject.kickDensity[1], q * 0.28),
      lerp(donorProject.kickDensity[0], donorProject.kickDensity[1], 0.35 + q * 0.2),
      qMix
    );
    const dDens = lerp(
      lerp(primaryProject.drumDensity[0], primaryProject.drumDensity[1], q * 0.3),
      lerp(donorProject.drumDensity[0], donorProject.drumDensity[1], 0.35 + q * 0.2),
      qMix
    );
    const pat = makePatternFromDensity(rng, kDens, dDens, isBeatPrimary);
    cornerKick.push(pat.kick);
    cornerDrums.push(pat.drums);
  }

  // Coarse-hybridized kit & kick orders across all 12 kits and 8 kick recipes
  const kitOrder = [
    primaryProject.kits[0],
    primaryProject.kits[1],
    donorProject.kits[0],
    donorProject.kits[1] ?? primaryProject.kits[2] ?? 0,
  ];
  const kickOrder = [
    primaryProject.kickRecipes[0],
    primaryProject.kickRecipes[1] ?? primaryProject.kickRecipes[0],
    donorProject.kickRecipes[0],
    donorProject.kickRecipes[1] ?? donorProject.kickRecipes[0],
  ];

  const droneRoots = shuffle([...new Set([...primaryProject.roots, ...donorProject.roots])]);
  const fmRatios = shuffle([...new Set([...primaryProject.fmRatios, ...donorProject.fmRatios])]);

  // Coarse cross-pollinated Ambient/Pad DNA
  const pa = primaryProject.ambientPreset || DARK_AMBIENT_PRESETS[0];
  const da = donorProject.ambientPreset || pa;
  const ambientPreset = {
    ...pa,
    name: `${pa.name} × ${donorProject.name}`,
    rootMidi: Math.round(lerp(pa.rootMidi, da.rootMidi, coarseCrossAmt * 0.35)),
    shape: lerp(pa.shape, da.shape, coarseCrossAmt * 0.5),
    pulseMix: lerp(pa.pulseMix, da.pulseMix, coarseCrossAmt * 0.5),
    subMix: lerp(pa.subMix, da.subMix, coarseCrossAmt * 0.4),
    cutoff: Math.round(lerp(pa.cutoff, da.cutoff, coarseCrossAmt * 0.45)),
    res: lerp(pa.res, da.res, coarseCrossAmt * 0.45),
    detune: lerp(pa.detune, da.detune, coarseCrossAmt * 0.5),
    padDelayMs: lerp(pa.padDelayMs, da.padDelayMs, coarseCrossAmt * 0.5),
    padFeedback: lerp(pa.padFeedback, da.padFeedback, coarseCrossAmt * 0.45),
    padWet: lerp(pa.padWet, da.padWet, coarseCrossAmt * 0.45),
    drive: lerp(pa.drive, da.drive, coarseCrossAmt * 0.5),
    metalMix: lerp(pa.metalMix ?? 0.3, da.metalMix ?? 0.3, coarseCrossAmt * 0.5),
    subGrind: lerp(pa.subGrind ?? 0.3, da.subGrind ?? 0.3, coarseCrossAmt * 0.5),
    vowelAlt: da.vowel >= 0 ? da.vowel : (pa.vowelAlt ?? 7),
  };

  return {
    seed16: s16,
    hex: formatHex16(s16),
    tempoArchetype,
    archetypeName,
    primaryProject,
    donorProject,
    coarseCrossAmt,
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
    kickOrder,
    idmOrder: shuffle([0, 1, 2, 3, 4, 5, 6]),
    routingOrder: shuffle([0, 1, 2, 3, 4, 5, 6, 7]),
    shaperOrder: shuffle([0, 1, 2, 3, 4]),
    droneRoots,
    fmRatios,
    bases,
    cornerKick,
    cornerDrums,
    terrainMode: rng.int(0, 3),
    bgSwapOnDrag: rng.nextFloat() < 0.45,
    darkInterval: [1.4983, 1.4142, 1.0595, 0.7492, 1.618][rng.int(0, 4)],
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

  const prim = scene.primaryProject || GENRE_BIN_PROJECTS[0];
  const don = scene.donorProject || prim;
  const arch = scene.tempoArchetype ?? prim.archetype ?? 1;
  const isBeatArch = arch < 3;
  const isAmbient = arch === 4;

  // Fine Cross-Pollination blend factor swept continuously by X/Y + spatial basis
  const fineCross = clamp(0.50 * x + 0.35 * y + (b(19) - 0.5) * 0.30, 0, 1);
  const crossMix = clamp((scene.coarseCrossAmt || 0.25) * 0.35 + fineCross * 0.85, 0, 1);

  // Rhythm & Tempo (fine interpolation across Primary -> Donor + XY sweep)
  const targetMin = lerp(prim.bpm[0], don.bpm[0], fineCross * 0.65);
  const targetMax = Math.max(targetMin + 8, lerp(prim.bpm[1], don.bpm[1], fineCross * 0.65));
  const bpm = Math.round(clamp(lerp(targetMin, targetMax, clamp(0.62 * x + 0.38 * b(0), 0, 1)), 28, 240));

  const rhythmicDensity = isBeatArch
    ? clamp(0.25 + 0.75 * (0.5 * y + 0.5 * b(1)), 0.15, 1.0)
    : clamp(0.14 + 0.68 * (0.45 * y + 0.35 * x + 0.2 * b(1)), 0.08, 0.86);
  const polymeterSkew = Math.floor(b(2) * 4);

  const baseK = scene.cornerKick[quad];
  const kickPattern = baseK.map((v, i) => {
    if (!isBeatArch) {
      return (v > 0 && b((i + 5) % 24) > (1 - rhythmicDensity) * 0.55) ? v : 0;
    }
    if (i === 0 && prim.genre !== 'MICROSOUND' && prim.genre !== 'LOWERCASE') return 2;
    const threshold = (1 - rhythmicDensity) * 0.75;
    if (v > 0) return (b((i + 3) % 24) > threshold * 0.5) ? v : 0;
    return (rhythmicDensity > 0.70 && (i % 4 === 2 || i % 3 === 0) && b(i % 24) > 0.66) ? 1 : 0;
  });

  const baseD = scene.cornerDrums[quad];
  const drumPattern = baseD.map((row, slot) =>
    row.map((v, step) => {
      const gate = ((slot * 5 + step * 3) % 17) / 17;
      if (!isBeatArch) {
        if (v > 0 && gate < rhythmicDensity + 0.35) return v;
        return (fineCross > 0.62 && rhythmicDensity > 0.52 && gate < (fineCross - 0.55) * 0.45) ? 0.55 : 0;
      }
      if (v > 0) return gate < rhythmicDensity + 0.22 ? v : 0;
      return (rhythmicDensity > 0.62 && gate < (rhythmicDensity - 0.52) * 0.72) ? 0.68 : 0;
    })
  );

  // Kick Engine (cross-pollinates across primary & donor recipes)
  const kickRecipe = scene.kickOrder[Math.min(scene.kickOrder.length - 1, Math.floor(clamp(fineCross * 0.6 + b(3) * 0.4, 0, 0.99) * scene.kickOrder.length))];
  const isMicro = prim.genre === 'MICROSOUND' || prim.genre === 'LOWERCASE';
  const kick = isAmbient ? {
    recipe: kickRecipe,
    pitchMidi: Math.round(lerp(24, 34, b(4))),
    drop: Math.round(lerp(12, 32, y)),
    glide: Math.round(lerp(6, 20, b(5))),
    shape: lerp(0.0, 0.55, fineCross * y),
    sub: lerp(0.72, 1.08, 1 - y * 0.25),
    click: lerp(0.08, 0.95, x * fineCross),
    drive1: lerp(0.10, 0.62, clamp(0.5 * fineCross + 0.5 * b(7), 0, 1)),
    screechHz: Math.round(lerp(90, 950, fineCross * b(8))),
    decayMs: Math.round(lerp(360, 920, 1 - x * 0.35)),
  } : {
    recipe: kickRecipe,
    pitchMidi: Math.round(lerp(isMicro ? 24 : 28, isMicro ? 38 : 46, b(4))),
    drop: Math.round(lerp(isMicro ? 12 : 22, 56, y)),
    glide: Math.round(lerp(2, 20, b(5))),
    shape: lerp(isMicro ? 0.0 : 0.1, 0.92, clamp(b(6) * 0.6 + fineCross * 0.4, 0, 1)),
    sub: lerp(0.36, 1.08, 1 - y * 0.4),
    click: lerp(0.45, 2.1, x),
    drive1: lerp(isMicro ? 0.08 : 0.28, 0.96, clamp(0.55 * y + 0.45 * b(7), 0, 1)),
    screechHz: Math.round(lerp(130, 2800, b(8))),
    decayMs: Math.round(lerp(145, 640, 1 - x * 0.45)),
  };

  // Drumkit (12 kits, morphing from primary kits to donor kits across X/Y)
  const kitIndex = scene.kitOrder[Math.min(scene.kitOrder.length - 1, Math.floor(clamp(fineCross * 0.65 + b(9) * 0.35, 0, 0.99) * scene.kitOrder.length))];
  const drumPitchShift = lerp(-12, 10, clamp(0.5 * b(10) + 0.5 * (y - 0.5 + 0.5), 0, 1));

  // IDM Plugin
  const idmModel = scene.idmOrder[Math.min(scene.idmOrder.length - 1, Math.floor((y * 0.5 + b(11) * 0.5) * scene.idmOrder.length))];
  const idmAlt = (x > 0.66 || y > 0.76 || b(12) > 0.72) ? 1 : 0;
  const idmAmtRange = [
    lerp(prim.idmAmount[0], don.idmAmount[0], fineCross),
    lerp(prim.idmAmount[1], don.idmAmount[1], fineCross),
  ];
  const idm = {
    model: idmModel,
    alt: isAmbient && fineCross < 0.4 ? 0 : idmAlt,
    wet: lerp(0.74, 1.0, clamp(x + 0.22, 0, 1)),
    amount: lerp(idmAmtRange[0], idmAmtRange[1], clamp(0.5 * x + 0.5 * y, 0, 1)),
    p0: lerp(isAmbient ? 0.16 : 0.35, 0.98, clamp(0.6 * x + 0.4 * b(13), 0, 1)),
    p1: lerp(0.35, 1.0, b(14)),
    p2: lerp(0.15, 0.95, b(15)),
    p3: lerp(0.10, 0.95, b(16)),
    p4: lerp(0.25, 0.95, b(17)),
    p5: lerp(0.12, 0.96, y),
    p6: isAmbient ? lerp(0.65, 0.96, b(1)) : lerp(0.24, 0.92, b(1)),
    p7: lerp(0.18, 0.95, x),
    p8: isAmbient ? lerp(0.74, 0.98, clamp(0.6 * y + 0.4 * b(4), 0, 1)) : lerp(0.36, 0.98, clamp(0.6 * y + 0.4 * b(4), 0, 1)),
    p9: lerp(0.12, 0.95, b(6)),
    p10: isBeatArch ? lerp(0.22, 0.95, clamp(0.7 * x + 0.3 * b(9), 0, 1)) : lerp(0.08, 0.68, clamp(0.6 * x + 0.4 * fineCross, 0, 1)),
    p11: lerp(0.20, 0.95, b(7)),
    p12: lerp(0.28, 0.95, b(2)),
    p13: lerp(0.10, 0.68, b(10)),
    p16: lerp(0.12, 0.72, b(12)),
    p18: lerp(0.12, 0.92, x),
    p20: lerp(0.10, 0.54, 1 - x),
  };

  // Unstable Signal Path + Fine Cross-Pollination between Primary & Donor textures
  const routingIndex = scene.routingOrder[Math.min(scene.routingOrder.length - 1, Math.floor(b(5) * scene.routingOrder.length))];
  const shaperModeIndex = scene.shaperOrder[Math.min(scene.shaperOrder.length - 1, Math.floor(b(8) * scene.shaperOrder.length))];
  const droneBaseHz = pick(scene.droneRoots, b(11));
  const fmRatio = pick(scene.fmRatios, b(14));
  const preset = scene.ambientPreset || DARK_AMBIENT_PRESETS[0];

  const bitMin = Math.round(lerp(prim.bitDepth[0], don.bitDepth[0], fineCross));
  const bitMax = Math.round(lerp(prim.bitDepth[1], don.bitDepth[1], fineCross));
  const srMin = Math.round(lerp(prim.srDivider[0], don.srDivider[0], fineCross));
  const srMax = Math.round(lerp(prim.srDivider[1], don.srDivider[1], fineCross));

  const unstableDsp = {
    textureMode: prim.texMode,
    donorTextureMode: don.texMode,
    crossMix,
    darkInterval: scene.darkInterval || 1.4983,
    routingIndex,
    shaperModeIndex,
    bitDepth: Math.round(lerp(bitMax, bitMin, clamp(x * 0.7 + b(16) * 0.3, 0, 1))),
    srDivider: Math.max(1, Math.round(lerp(srMin, srMax, clamp(x * 0.75 + b(16) * 0.25, 0, 1)))),
    xorMask: Math.floor(b(13) * 31),
    droneBaseHz,
    fmRatio,
    subInterval: pick([0.5, 0.75, 1.0, 1.5], b(3)),
    lfsrMask: (scene.seed16 ^ (quad * 0x1337)) | 0x8001,
    pulseEuclidK: isBeatArch ? Math.round(lerp(3, 11, b(6))) : Math.round(lerp(1, 6, b(6))),
    pulseEuclidN: pick([12, 14, 16, 18], b(7)),
    mangleSliceMs: isAmbient ? Math.round(lerp(65, 290, 1 - x * 0.55)) : Math.round(lerp(12, 160, 1 - x * 0.7)),
    mangleRevProb: lerp(0.18, 0.92, b(9)),
    fbDelayLMs: isAmbient
      ? Number(lerp(140, 460, clamp(0.5 * b(10) + 0.5 * x, 0, 1)).toFixed(1))
      : Number(lerp(18, 220, b(10)).toFixed(1)),
    fbDelayRMs: isAmbient
      ? Number(lerp(190, 560, clamp(0.5 * b(12) + 0.5 * y, 0, 1)).toFixed(1))
      : Number(lerp(24, 260, b(12)).toFixed(1)),
    fbPolarity: b(15) > 0.5 ? 1 : -1,
    combBaseHz: Math.round(lerp(90, 640, y)),
    ambientPreset: {
      ...preset,
      cutoff: Math.round(preset.cutoff * lerp(0.45, 2.2, clamp(0.7 * y + 0.3 * x, 0, 1))),
      res: clamp(preset.res + x * 0.18 + y * 0.10, 0.08, 0.48),
      padWet: clamp(preset.padWet * lerp(0.55, 1.45, x), 0.14, 0.62),
      padFeedback: clamp(preset.padFeedback * lerp(0.72, 1.18, y), 0.22, 0.72),
      detune: preset.detune * lerp(0.55, 1.75, clamp(0.6 * x + 0.4 * b(17), 0, 1)),
    },
  };

  const unstableParams = {
    sceneBoost: isAmbient ? 1.42 : isBeatArch ? 1.24 : 1.44,
    droneLevel: lerp(
      lerp(prim.droneLevel[0], don.droneLevel[0], fineCross),
      lerp(prim.droneLevel[1], don.droneLevel[1], fineCross),
      b(0)
    ),
    pulseLevel: 0,
    fmIndex: lerp(
      lerp(prim.fmIndex[0], don.fmIndex[0], fineCross),
      lerp(prim.fmIndex[1], don.fmIndex[1], fineCross),
      clamp(0.65 * y + 0.35 * b(4), 0, 1)
    ),
    mangleMix: lerp(
      lerp(prim.mangleMix[0], don.mangleMix[0], fineCross),
      lerp(prim.mangleMix[1], don.mangleMix[1], fineCross),
      clamp(0.7 * x + 0.3 * y, 0, 1)
    ),
    shaperDrive: lerp(
      lerp(prim.shaperDrive[0], don.shaperDrive[0], fineCross),
      lerp(prim.shaperDrive[1], don.shaperDrive[1], fineCross),
      clamp(0.55 * y + 0.45 * b(17), 0, 1)
    ),
    fbGain: lerp(
      lerp(prim.fbGain[0], don.fbGain[0], fineCross),
      lerp(prim.fbGain[1], don.fbGain[1], fineCross),
      clamp(0.6 * y + 0.4 * b(2), 0, 1)
    ),
    fbDampHz: Math.round(lerp(
      lerp(prim.fbDampHz[0], don.fbDampHz[0], fineCross),
      lerp(prim.fbDampHz[1], don.fbDampHz[1], fineCross),
      clamp(0.6 * x + 0.4 * (1 - y * 0.4), 0, 1)
    )),
    scDepth: lerp(prim.scDepth, don.scDepth, fineCross),
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
    primaryGenre: prim.genre,
    donorGenre: don.genre,
    crossMix,
    ambientPresetName: preset.name,
  };
}
