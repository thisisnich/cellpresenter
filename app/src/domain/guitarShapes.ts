// Guitar chord shapes: every playable way to finger a chord in standard
// tuning, best first. Pure functions, no I/O.

import { parseChord } from "./chords";

/** Open-string pitch classes, low E to high E. */
const TUNING = [4, 9, 2, 7, 11, 4];
const MAX_FRET = 15;
const SPAN = 4; // frets one hand can cover

export interface GuitarShape {
  /** Fret per string, low E to high E; 0 = open, null = not played. */
  frets: (number | null)[];
  /** Fret shown at the top of the diagram (1 for shapes near the nut). */
  baseFret: number;
  /** One finger flat across several strings. Strings index like `frets`. */
  barre?: { fret: number; from: number; to: number };
}

// Intervals in semitones above the root. The plain fifth (7) may be left out.
const QUALITIES: Record<string, number[]> = {
  "": [0, 4, 7],
  m: [0, 3, 7],
  "5": [0, 7],
  "6": [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  "7": [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  mmaj7: [0, 3, 7, 11],
  "9": [0, 4, 7, 10, 2],
  maj9: [0, 4, 7, 11, 2],
  m9: [0, 3, 7, 10, 2],
  add9: [0, 2, 4, 7],
  madd9: [0, 2, 3, 7],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  "7sus4": [0, 5, 7, 10],
  dim: [0, 3, 6],
  dim7: [0, 3, 6, 9],
  m7b5: [0, 3, 6, 10],
  aug: [0, 4, 8],
};

// Other ways people write the same quality.
const ALIASES: Record<string, string> = {
  M: "",
  maj: "",
  min: "m",
  "-": "m",
  M7: "maj7",
  "Δ": "maj7",
  min7: "m7",
  "-7": "m7",
  "2": "add9",
  add2: "add9",
  sus: "sus4",
  "7sus": "7sus4",
  "°": "dim",
  "°7": "dim7",
  "ø": "m7b5",
  "+": "aug",
  m6: "m6",
};

/** Pitch classes of a chord, which of them must sound, and the lowest note. */
function chordTones(symbol: string): { tones: Set<number>; required: Set<number>; bass: number } | null {
  const chord = parseChord(symbol);
  if (!chord) return null;
  const quality = ALIASES[chord.quality] ?? chord.quality;
  const intervals = QUALITIES[quality];
  if (!intervals) return null;
  const tones = new Set(intervals.map((i) => (chord.root + i) % 12));
  const keepFifth = quality === "5" || quality.startsWith("sus") || quality.includes("sus");
  const required = new Set(intervals.filter((i) => keepFifth || i !== 7).map((i) => (chord.root + i) % 12));
  const bass = chord.bass ?? chord.root;
  tones.add(bass);
  required.add(bass);
  return { tones, required, bass };
}

/** Fingers needed, and the barre if one finger lies across several strings. */
function fingering(frets: (number | null)[]): { fingers: number; barre?: GuitarShape["barre"] } {
  const fretted = frets.flatMap((f, s) => (f ? [{ f, s }] : []));
  if (fretted.length === 0) return { fingers: 0 };
  const low = Math.min(...fretted.map((n) => n.f));
  const atLow = fretted.filter((n) => n.f === low);
  const from = atLow[0].s;
  const to = atLow[atLow.length - 1].s;
  // A barre works when nothing it covers is open or muted.
  const canBarre = atLow.length > 1 && frets.slice(from, to + 1).every((f) => f !== null && f >= low);
  if (!canBarre) return { fingers: fretted.length };
  return { fingers: 1 + fretted.filter((n) => n.f > low).length, barre: { fret: low, from, to } };
}

// Lower is easier. Open strings help near the nut and get awkward higher
// up (x20402 for Bm is worse than the barre x24432); four separate fingers
// are harder than a barre.
function score(frets: (number | null)[], fingers: number, barre: boolean, internalMute: boolean): number {
  const fretted = frets.filter((f): f is number => f !== null && f > 0);
  const top = fretted.length ? Math.max(...fretted) : 0;
  const muted = frets.filter((f) => f === null).length;
  const open = frets.filter((f) => f === 0).length;
  return (
    top * 2 +
    fingers +
    muted * 1.5 -
    (6 - muted) * 0.5 +
    (barre ? 1 : 0) +
    (internalMute ? 6 : 0) +
    (top > 3 ? open * 3 : 0) +
    (fingers === 4 && !barre ? 1.5 : 0)
  );
}

const cache = new Map<string, GuitarShape[]>();

/**
 * Ways to play `symbol` on guitar, easiest first, each at a different place
 * on the neck. Empty for chords it doesn't understand.
 */
export function guitarShapes(symbol: string, limit = 6): GuitarShape[] {
  const key = `${symbol}|${limit}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const tones = chordTones(symbol);
  const result = tones ? search(tones, limit) : [];
  cache.set(key, result);
  return result;
}

function search({ tones, required, bass }: NonNullable<ReturnType<typeof chordTones>>, limit: number): GuitarShape[] {
  const minSounded = tones.size <= 2 ? 3 : 4;
  const found = new Map<string, { shape: GuitarShape; score: number; position: number }>();

  for (let start = 1; start <= MAX_FRET - SPAN + 1; start++) {
    // Choices per string in this window: muted, open (near the nut only), or
    // a fret whose note belongs to the chord.
    const choices = TUNING.map((open) => {
      const options: (number | null)[] = [null];
      if (start <= 5 && tones.has(open)) options.push(0);
      for (let f = start; f < start + SPAN; f++) if (tones.has((open + f) % 12)) options.push(f);
      return options;
    });

    const frets: (number | null)[] = [];
    const walk = (string: number) => {
      if (string < 6) {
        for (const c of choices[string]) {
          frets[string] = c;
          walk(string + 1);
        }
        return;
      }
      const first = frets.findIndex((f) => f !== null);
      if (first < 0) return;
      const inner = frets.slice(first).filter((f) => f === null).length;
      // Mute the bass strings freely; allow one muted string in between
      // (like the A in 2x0232), never the top strings.
      if (inner > 1 || frets[5] === null) return;
      if (6 - frets.filter((f) => f === null).length < minSounded) return;
      if ((TUNING[first] + (frets[first] as number)) % 12 !== bass) return;
      const sounding = new Set(frets.flatMap((f, s) => (f === null ? [] : [(TUNING[s] + f) % 12])));
      for (const tone of required) if (!sounding.has(tone)) return;
      const fretted = frets.filter((f): f is number => f !== null && f > 0);
      if (fretted.length && Math.max(...fretted) - Math.min(...fretted) >= SPAN) return;
      // Open strings only ring true with the hand near the nut.
      if (fretted.length && Math.max(...fretted) > 5 && frets.includes(0)) return;
      const { fingers, barre } = fingering(frets);
      if (fingers > 4) return;
      const id = frets.map((f) => (f === null ? "x" : f)).join(",");
      if (found.has(id)) return;
      const top = fretted.length ? Math.max(...fretted) : 0;
      const low = fretted.length ? Math.min(...fretted) : 0;
      found.set(id, {
        shape: { frets: [...frets], baseFret: top <= 4 ? 1 : low, ...(barre ? { barre } : {}) },
        score: score(frets, fingers, Boolean(barre), inner > 0),
        position: top <= 4 ? 0 : low,
      });
    };
    walk(0);
  }

  // The easiest shape at each position, so the list walks up the neck
  // instead of showing six near-identical open shapes.
  const best = new Map<number, { shape: GuitarShape; score: number }>();
  for (const v of found.values()) {
    const held = best.get(v.position);
    if (!held || v.score < held.score) best.set(v.position, v);
  }
  return [...best.values()]
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((v) => v.shape);
}

/** Shape written the usual way, low E first: "x32010". */
export function shapeName(shape: GuitarShape): string {
  return shape.frets.map((f) => (f === null ? "x" : f > 9 ? `(${f})` : String(f))).join("");
}
