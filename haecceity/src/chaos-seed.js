/**
 * Deterministic Chaos Engine for Haecceity Web.
 * Maps a 16-bit memory address (0x0000..0xFFFF) or arbitrary string
 * into deterministic DSP routing, bit-depth/clock corruption,
 * drone/pulse harmonic ratios, IDM seed, and WebGL2 shader uniforms.
 */

export const DSP_ROUTINGS = [
  { id: 0, code: '0x00', name: 'SERIAL_FWD',    label: 'GEN -> MANGLER -> SHAPER -> FB' },
  { id: 1, code: '0x01', name: 'PRE_SHAPED',    label: 'GEN -> SHAPER -> MANGLER -> FB' },
  { id: 2, code: '0x02', name: 'FB_CROSS_FM',   label: 'GEN(<-FB) -> MANGLER -> SHAPER -> FB' },
  { id: 3, code: '0x03', name: 'PARALLEL_FOLD', label: 'GEN -> [MANGLER || SHAPER] -> FB' },
  { id: 4, code: '0x04', name: 'LOOP_MANGLE',   label: 'GEN -> SHAPER -> [FB <-> MANGLER]' },
  { id: 5, code: '0x05', name: 'RING_MATRIX',   label: 'GEN * FB -> MANGLER -> SHAPER -> FB' },
  { id: 6, code: '0x06', name: 'REV_COMB_FEED', label: 'GEN -> REV_BUF -> SHAPER -> COMB_FB' },
  { id: 7, code: '0x07', name: 'FULL_INJECT',   label: 'GEN <-> MANGLER <-> SHAPER <-> FB' },
];

export const SHAPER_MODES = [
  'TUBE_BIAS',
  'TRIG_FOLD',
  'DIODE_HARD',
  'XOR_CORRUPT',
  'SLEW_OVERLOAD',
];

export const PALETTES = [
  { name: 'PHOSPHOR_ASH',   a: [0.06, 0.08, 0.07], b: [0.68, 0.96, 0.78], accent: [0.98, 0.34, 0.22] },
  { name: 'OXIDE_RUST',     a: [0.08, 0.05, 0.05], b: [0.95, 0.56, 0.30], accent: [0.35, 0.88, 0.92] },
  { name: 'CRYO_PHOSPHOR',  a: [0.04, 0.06, 0.09], b: [0.58, 0.86, 1.00], accent: [1.00, 0.28, 0.58] },
  { name: 'SULFUR_CRT',     a: [0.07, 0.07, 0.04], b: [0.94, 0.90, 0.44], accent: [0.88, 0.25, 0.85] },
  { name: 'VOID_MONOCHROME',a: [0.04, 0.04, 0.04], b: [0.88, 0.89, 0.86], accent: [0.96, 0.22, 0.22] },
  { name: 'CAUSTIC_VIOLET', a: [0.06, 0.04, 0.09], b: [0.82, 0.62, 1.00], accent: [0.40, 1.00, 0.64] },
];

/**
 * FNV-1a 32-bit string hash, then folded or direct-parsed for hex.
 * @param {string} input
 * @returns {{ rawInput: string, addr16: number, hexAddr: string, seed32: number, isHexLiteral: boolean }}
 */
export function parseMemoryAddress(input) {
  const trimmed = String(input ?? '').trim();
  if (!trimmed) {
    return parseMemoryAddress('0xDEAD');
  }

  // Match 0x0000..0xFFFF or bare 4-digit hex like DEAD / 1337
  const hexMatch = trimmed.match(/^(?:0x)?([0-9a-fA-F]{1,4})$/);
  if (hexMatch && (trimmed.toLowerCase().startsWith('0x') || /^[0-9a-fA-F]{4}$/.test(trimmed))) {
    const addr16 = parseInt(hexMatch[1], 16) & 0xffff;
    const seed32 = splitmix32(addr16 ^ 0x9e3779b9);
    return {
      rawInput: trimmed,
      addr16,
      hexAddr: formatHex16(addr16),
      seed32,
      isHexLiteral: true,
    };
  }

  // Arbitrary string -> FNV-1a 32-bit hash -> fold to 16-bit address
  let h = 0x811c9dc5;
  for (let i = 0; i < trimmed.length; i++) {
    h ^= trimmed.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  const addr16 = ((h >>> 16) ^ (h & 0xffff)) & 0xffff;
  const seed32 = splitmix32(h);
  return {
    rawInput: trimmed,
    addr16,
    hexAddr: formatHex16(addr16),
    seed32,
    isHexLiteral: false,
  };
}

export function formatHex16(n) {
  return '0x' + (n & 0xffff).toString(16).toUpperCase().padStart(4, '0');
}

export function formatHex8(n) {
  return '0x' + (Math.round(n) & 0xff).toString(16).toUpperCase().padStart(2, '0');
}

export function splitmix32(a) {
  let z = (a + 0x9e3779b9) >>> 0;
  z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
  z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
  return (z ^ (z >>> 16)) >>> 0;
}

/**
 * Deterministic PRNG stream from a 32-bit seed.
 */
export function makePrng(seed32) {
  let state = seed32 >>> 0 || 0x1a2b3c4d;
  const nextU32 = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (t ^ (t >>> 14)) >>> 0;
  };
  const nextFloat = () => nextU32() / 4294967296;
  const range = (min, max) => min + nextFloat() * (max - min);
  const int = (min, maxInclusive) => Math.floor(range(min, maxInclusive + 0.999999));
  const pick = (arr) => arr[int(0, arr.length - 1)];
  return { nextU32, nextFloat, range, int, pick };
}

/**
 * Derive full deterministic chaos state for DSP + Shader from input string/hex.
 */
export function deriveChaosState(input) {
  const parsed = parseMemoryAddress(input);
  const rng = makePrng(parsed.seed32);

  // DSP Routing & Degradation
  const routingIndex = rng.int(0, DSP_ROUTINGS.length - 1);
  const routing = DSP_ROUTINGS[routingIndex];
  const shaperModeIndex = rng.int(0, SHAPER_MODES.length - 1);
  const shaperMode = SHAPER_MODES[shaperModeIndex];

  // Bit-depth: 4..16 bits, biased toward gritty 5..12 bit textures on odd seeds
  const bitDepth = rng.int(4, 15);
  // Sample rate clock divider (1 = clean, 2..18 = clock desync hold)
  const srDivider = rng.int(1, 14);
  // Deterministic XOR bitmask applied during bit-corrupt stages
  const xorMask = (rng.nextU32() & 0x1f);

  // Algorithmic Pulse/Drone harmonic configuration
  const droneBaseHz = [36.71, 41.20, 46.25, 49.00, 55.00, 61.74, 65.41, 73.42][rng.int(0, 7)];
  const fmRatio = [0.5, 1.0, 1.4142, 1.5, 2.0, 2.718, 3.1415, 4.33][rng.int(0, 7)];
  const subInterval = [0.5, 0.75, 1.0, 1.333, 1.5][rng.int(0, 4)];
  const lfsrMask = (rng.nextU32() & 0xffff) | 0x8001;
  const pulseEuclidK = rng.int(3, 11);
  const pulseEuclidN = [12, 14, 16, 16, 18][rng.int(0, 4)];

  // Buffer-mangler & Feedback loop defaults scrambled by seed
  const mangleSliceMs = Math.round(rng.range(14, 145));
  const mangleRevProb = Number(rng.range(0.15, 0.85).toFixed(3));
  const fbDelayLMs = Number(rng.range(18, 190).toFixed(1));
  const fbDelayRMs = Number(rng.range(23, 215).toFixed(1));
  const fbPolarity = rng.nextFloat() < 0.5 ? -1 : 1;
  const combBaseHz = Math.round(rng.range(95, 620));

  // IDM Seed (0..999 as used in IdmUnit)
  const idmSeed = parsed.addr16 % 1000;

  // Shader Uniforms deterministically derived
  const paletteIndex = rng.int(0, PALETTES.length - 1);
  const palette = PALETTES[paletteIndex];
  const shaderMask = parsed.addr16 & 0x3f; // 6-bit feature bitmask
  const shader = {
    paletteIndex,
    palette,
    shaderMask,
    enableInterlace: (shaderMask & 0x01) !== 0 || rng.nextFloat() > 0.2,
    enableChroma: true,
    enableDatamosh: (shaderMask & 0x02) !== 0 || rng.nextFloat() > 0.35,
    enableKerr: (shaderMask & 0x04) !== 0 || rng.nextFloat() > 0.3,
    enableVHold: (shaderMask & 0x08) !== 0,
    enableRule30: (shaderMask & 0x10) !== 0 || rng.nextFloat() > 0.45,
    kerrAngle: Number(rng.range(0, Math.PI * 2).toFixed(4)),
    kerrFreq: rng.int(3, 9),
    moshBlocks: rng.int(6, 42),
    chromaGain: Number(rng.range(0.6, 2.2).toFixed(3)),
    scanDensity: rng.int(120, 340),
    fieldFold: Number(rng.range(1.2, 4.8).toFixed(3)),
    fieldSpeed: Number(rng.range(0.25, 1.4).toFixed(3)),
    shaderBits: Math.max(3, Math.min(12, bitDepth - 1)),
  };

  return {
    ...parsed,
    dsp: {
      routingIndex,
      routing,
      shaperModeIndex,
      shaperMode,
      bitDepth,
      srDivider,
      xorMask,
      droneBaseHz,
      fmRatio,
      subInterval,
      lfsrMask,
      pulseEuclidK,
      pulseEuclidN,
      mangleSliceMs,
      mangleRevProb,
      fbDelayLMs,
      fbDelayRMs,
      fbPolarity,
      combBaseHz,
      idmSeed,
    },
    shader,
  };
}
