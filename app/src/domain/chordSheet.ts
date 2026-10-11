// A song as a chord sheet: chords above the words, transposed to any key and
// shown as capo shapes. Pure functions; the chords view renders the result.

import type { LyricLine } from "../generated/LyricLine";
import type { Song } from "../generated/Song";
import { capoShapeKey, keyName, keyUsesFlats, parseKey, transposeChord, transposeKey } from "./chords";
import { playedSections } from "./played";

/** A piece of a lyric line, with the chord that starts on it (if any). */
export interface ChordChunk {
  chord: string | null;
  text: string;
}

export interface SheetLine {
  chunks: ChordChunk[];
  hasChords: boolean;
}

/** One slide of the sheet, in play order (index matches the live slides). */
export interface SheetSlide {
  section: string;
  lines: SheetLine[];
}

export interface SheetOptions {
  /** Semitones up from the song's key (what the band hears). */
  semitones: number;
  /** Capo fret: chords are shown as the shapes to play with the capo on. */
  capo: number;
}

/** Split a line at its chord positions, each chord rendered by `render`. */
export function chunksOf(line: LyricLine, render: (chord: string) => string = (c) => c): ChordChunk[] {
  const chords = [...line.chords].sort((a, b) => a.at - b.at);
  if (chords.length === 0) return [{ chord: null, text: line.text }];
  const chunks: ChordChunk[] = [];
  const first = Math.min(chords[0].at, line.text.length);
  if (first > 0) chunks.push({ chord: null, text: line.text.slice(0, first) });
  chords.forEach((c, i) => {
    const start = Math.min(c.at, line.text.length);
    const end = i + 1 < chords.length ? Math.min(chords[i + 1].at, line.text.length) : line.text.length;
    chunks.push({ chord: render(c.chord), text: line.text.slice(start, Math.max(start, end)) });
  });
  return chunks;
}

/** How far to move every chord, and how to spell the result. */
function shift(songKey: string | null, o: SheetOptions): { by: number; flats: boolean } {
  const by = o.semitones - o.capo;
  const key = songKey ? parseKey(songKey) : null;
  if (!key) return { by, flats: false };
  return { by, flats: keyUsesFlats(capoShapeKey(transposeKey(key, o.semitones), o.capo)) };
}

/** The song's slides in play order, with chords transposed for these options. */
export function sheetOf(song: Song, o: SheetOptions): SheetSlide[] {
  const { by, flats } = shift(song.key, o);
  const render = (chord: string) => transposeChord(chord, by, flats);
  return playedSections(song).flatMap((section) =>
    section.slides.map((slide) => ({
      section: section.name,
      lines: slide.lines.map((line) => ({ chunks: chunksOf(line, render), hasChords: line.chords.length > 0 })),
    })),
  );
}

export interface KeyInfo {
  /** The key the band hears, e.g. "A". Null if the song has no key set. */
  sounding: string | null;
  /** The key of the shapes played with the capo on; null without a capo. */
  shapes: string | null;
}

export function keyInfo(songKey: string | null, o: SheetOptions): KeyInfo {
  const key = songKey ? parseKey(songKey) : null;
  if (!key) return { sounding: null, shapes: null };
  const sounding = transposeKey(key, o.semitones);
  return {
    sounding: keyName(sounding),
    shapes: o.capo > 0 ? keyName(capoShapeKey(sounding, o.capo)) : null,
  };
}

/** Whether a song has any chords at all. */
export function hasChords(song: Song): boolean {
  return song.sections.some((s) => s.slides.some((sl) => sl.lines.some((l) => l.chords.length > 0)));
}
