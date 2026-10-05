// Chord and key maths: transpose, capo, spelling. Pure functions, no I/O.

const SHARPS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLATS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const NATURALS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

// How each of the 12 keys is conventionally spelled.
const MAJOR_KEYS = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const MINOR_KEYS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "G#", "A", "Bb", "B"];
// Keys whose scales are written with flats (the rest use sharps).
const FLAT_MAJOR = new Set([1, 3, 5, 8, 10]); // Db Eb F Ab Bb
const FLAT_MINOR = new Set([0, 2, 3, 5, 7, 10]); // Cm Dm Ebm Fm Gm Bbm

// A chord quality is a run of known pieces ("m7b5", "sus4", "maj9", "add2");
// anything else ("mazing" in "Amazing") means the token is a lyric, not a chord.
const QUALITY_RE = /^(?:maj|min|dim|aug|sus|add|alt|m|M|\+|°|ø|[b#♭♯]?\d{1,2}|[()\-,])*$/;
const CHORD_RE = /^([A-G])([#b♯♭]?)([^/\s]*)(?:\/([A-G])([#b♯♭]?))?$/;

export interface Chord {
  /** Pitch class of the root, 0 = C. */
  root: number;
  /** Everything after the root: "m7", "sus4", "maj7"… */
  quality: string;
  /** Pitch class of the bass note for slash chords like D/F#. */
  bass?: number;
}

export interface Key {
  /** Pitch class of the tonic, 0 = C. */
  tonic: number;
  minor: boolean;
}

const mod12 = (n: number) => ((n % 12) + 12) % 12;

function pitch(letter: string, accidental: string): number {
  const shift = accidental === "#" || accidental === "♯" ? 1 : accidental === "b" || accidental === "♭" ? -1 : 0;
  return mod12(NATURALS[letter] + shift);
}

/** Parse a chord symbol like "Em7", "D/F#" or "Bbsus4". Returns null for anything else. */
export function parseChord(symbol: string): Chord | null {
  const m = CHORD_RE.exec(symbol.trim());
  if (!m) return null;
  const [, letter, acc, quality, bassLetter, bassAcc] = m;
  // Reject lyric words that happen to start with A–G ("Amazing", "Be").
  if (!QUALITY_RE.test(quality)) return null;
  return {
    root: pitch(letter, acc),
    quality,
    bass: bassLetter ? pitch(bassLetter, bassAcc ?? "") : undefined,
  };
}

/** Parse a key name like "C", "F#", "Bb", "Am" or "C#m". */
export function parseKey(name: string): Key | null {
  const m = /^([A-G])([#b♯♭]?)(m|min|minor)?$/.exec(name.trim());
  if (!m) return null;
  return { tonic: pitch(m[1], m[2]), minor: Boolean(m[3]) };
}

export function keyName(key: Key): string {
  return key.minor ? `${MINOR_KEYS[key.tonic]}m` : MAJOR_KEYS[key.tonic];
}

/** Whether chords in this key are spelled with flats. */
export function keyUsesFlats(key: Key): boolean {
  return (key.minor ? FLAT_MINOR : FLAT_MAJOR).has(key.tonic);
}

export function spellNote(pitchClass: number, flats: boolean): string {
  return (flats ? FLATS : SHARPS)[mod12(pitchClass)];
}

export function chordName(chord: Chord, flats: boolean): string {
  const bass = chord.bass === undefined ? "" : `/${spellNote(chord.bass, flats)}`;
  return `${spellNote(chord.root, flats)}${chord.quality}${bass}`;
}

export function transposeKey(key: Key, semitones: number): Key {
  return { tonic: mod12(key.tonic + semitones), minor: key.minor };
}

/**
 * Transpose one chord symbol. Spelling follows `flats` (pass the target key's
 * `keyUsesFlats`). Text that isn't a chord comes back unchanged.
 */
export function transposeChord(symbol: string, semitones: number, flats: boolean): string {
  const chord = parseChord(symbol);
  if (!chord) return symbol;
  return chordName(
    {
      root: mod12(chord.root + semitones),
      quality: chord.quality,
      bass: chord.bass === undefined ? undefined : mod12(chord.bass + semitones),
    },
    flats,
  );
}

/**
 * Transpose every chord in a chord line ("G   D/F#  Em7"), keeping the
 * spacing so chords stay above the same syllables where possible.
 */
export function transposeChordLine(line: string, semitones: number, flats: boolean): string {
  return line.replace(/\S+/g, (token) => transposeChord(token, semitones, flats));
}

/** Semitones to go from one key to another, in the range 0–11. */
export function semitonesBetween(from: Key, to: Key): number {
  return mod12(to.tonic - from.tonic);
}

/**
 * The key a guitarist plays shapes in with a capo on `fret`, for a song
 * sounding in `key`. Capo 3 in Eb → play C shapes.
 */
export function capoShapeKey(key: Key, fret: number): Key {
  return transposeKey(key, -fret);
}
