/**
 * MumbleSpeak Text-to-Phoneme Engine
 * Ported from Haecceity/standalone/demo/instruments/mumble.gd
 * Turns typed words into a rhythmic stream of vowel/consonant phonemes.
 */

export const CONSONANT = {
  NO_CONSONANT: 0,
  PLOSIVE: 1,
  FRICATIVE: 2,
  NASAL: 3,
  LIQUID: 4,
  PAUSE: 5,
};

// Vowel table indices matching native engine.hpp vowel_formants[10][4]:
// 0:a, 1:e, 2:i, 3:o, 4:u, 5:ɛ, 6:ɔ, 7:ə, 8:æ, 9:ʊ
const VOWELS = {
  a: [0, 8],
  e: [1, 5],
  i: [2, 7],
  y: [2, 7],
  o: [3, 6],
  u: [4, 9],
};

const DIGRAPHS = {
  ee: 2, ea: 2, ie: 2,
  oo: 4, ou: 9, ow: 9,
  ai: 1, ay: 1, oa: 3,
  au: 6, aw: 6, oi: 6,
};

function makeSimpleRng(seed = 0x51a7) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function consonantType(cluster) {
  if (!cluster) return CONSONANT.NO_CONSONANT;
  const first = cluster[0];
  if (cluster.startsWith('sh') || cluster.startsWith('th') || cluster.startsWith('ch') || 'sfvzhjx'.includes(first)) {
    return CONSONANT.FRICATIVE;
  }
  if ('pbtdkgcq'.includes(first)) return CONSONANT.PLOSIVE;
  if ('mn'.includes(first)) return CONSONANT.NASAL;
  return CONSONANT.LIQUID;
}

export function splitSyllables(word) {
  const result = [];
  let onset = '';
  let i = 0;
  while (i < word.length) {
    const c = word[i];
    if (VOWELS[c] && !(c === 'y' && i === 0)) {
      let group = c;
      while (i + 1 < word.length && VOWELS[word[i + 1]] && word[i + 1] !== 'y') {
        i++;
        group += word[i];
      }
      result.push([onset, group, '']);
      onset = '';
    } else if (c !== "'") {
      onset += c;
    }
    i++;
  }
  if (result.length === 0) {
    result.push([onset, 'e', '']);
  } else if (onset.length > 0) {
    result[result.length - 1][2] = onset;
  }
  return result;
}

function vowelIndex(group, rand) {
  if (group.length >= 2 && DIGRAPHS[group.slice(0, 2)] !== undefined) {
    return DIGRAPHS[group.slice(0, 2)];
  }
  const opts = VOWELS[group[0]] || [7, 7];
  return rand() < 0.7 ? opts[0] : opts[1];
}

function applyContour(spoken, start, end, mark, span, rand) {
  const voiced = [];
  for (let i = start; i < end; i++) {
    if (spoken[i].consonant !== CONSONANT.PAUSE) voiced.push(i);
  }
  const count = voiced.length;
  for (let n = 0; n < count; n++) {
    const p = spoken[voiced[n]];
    const pos = n / Math.max(1, count - 1);
    p.pitch = (p.pitch + (2 - 4 * pos) + (rand() * 4 - 2)) * span;
    if (mark === '!') {
      p.pitch += 3 * span;
      p.amp *= 1.2;
    }
  }
  if (count === 0) return;
  if (mark === '?') {
    for (let k = 0; k < Math.min(3, count); k++) {
      spoken[voiced[count - 1 - k]].pitch += (9 - 3 * k) * Math.max(0.5, span);
    }
  } else {
    spoken[voiced[count - 1]].pitch -= 3 * Math.max(0.5, span);
  }
}

/**
 * Convert arbitrary text into a sequence of MumbleSpeak phonemes.
 */
export function textToPhonemes(text, { speed = 130, pitchRange = 7, seed = 0x51a7 } = {}) {
  const cleaned = String(text ?? '').trim();
  if (!cleaned) return [];

  // Hash text into seed so identical phrases produce reproducible syllables
  let h = seed >>> 0;
  for (let i = 0; i < cleaned.length; i++) {
    h = Math.imul(h ^ cleaned.charCodeAt(i), 0x01000193) >>> 0;
  }
  const rand = makeSimpleRng(h);

  const tokens = cleaned.match(/[A-Za-z0-9']+|[.,!?;:]/g) || [];
  const spoken = [];

  for (const raw of tokens) {
    const token = raw.toLowerCase();
    if ('.,!?;:'.includes(token)) {
      const pause = token === ',' ? 160 : (token === ';' || token === ':') ? 200 : 300;
      spoken.push({
        vowel: 7,
        consonant: CONSONANT.PAUSE,
        ms: pause,
        pitch: 0,
        amp: 0,
        mark: token,
        text: token,
      });
      continue;
    }

    // Expand digits or consonant-only tokens into speakable syllables
    const word = token.replace(/[0-9]/g, (d) => ['ze', 'wa', 'tu', 'ri', 'fo', 'fa', 'si', 'se', 'ei', 'na'][Number(d)] || 'ka');
    const parts = splitSyllables(word);
    for (let idx = 0; idx < parts.length; idx++) {
      const part = parts[idx];
      const last = idx === parts.length - 1;
      const ms = speed * (0.78 + 0.44 * rand()) * (last ? 1.25 : 1.0) * (1.0 + 0.1 * part[2].length);
      const stressed = idx === 0 && parts.length > 1;
      spoken.push({
        vowel: vowelIndex(part[1], rand),
        consonant: consonantType(part[0]),
        ms: Math.round(ms),
        pitch: stressed ? 2.5 : 0,
        amp: stressed ? 1.15 : 0.95,
        text: raw.toUpperCase(),
      });
    }
    spoken.push({
      vowel: 7,
      consonant: CONSONANT.PAUSE,
      ms: Math.round(25 + 25 * rand()),
      pitch: 0,
      amp: 0,
      text: '',
    });
  }

  const span = pitchRange / 6.0;
  let sentenceStart = 0;
  for (let i = 0; i < spoken.length; i++) {
    const p = spoken[i];
    if (p.consonant === CONSONANT.PAUSE && p.mark && '.!?'.includes(p.mark)) {
      applyContour(spoken, sentenceStart, i, p.mark, span, rand);
      sentenceStart = i + 1;
    }
  }
  if (sentenceStart < spoken.length) {
    applyContour(spoken, sentenceStart, spoken.length, '.', span, rand);
  }

  for (const p of spoken) delete p.mark;
  while (spoken.length > 0 && spoken[spoken.length - 1].consonant === CONSONANT.PAUSE) {
    spoken.pop();
  }
  return spoken.slice(0, 96);
}
