// Songs as plain text: parse what people paste (lyrics, chord sheets,
// ChordPro) into sections and slides, and write a song back out as text for
// editing. Pure functions, no I/O.
//
// The text format:
//   [Verse 1]            section header ("Verse 1:" and ChordPro {c: …} work too)
//   C        F    C      chord line: chords sit above the syllable they start on
//   When peace like a river attendeth my way
//                        blank line = next slide
//   [Chorus]             a header with no lines under it repeats that section
//
// Inline chords ("[C]When peace like a [F]river") are understood as well.
// The order of headers is the arrangement.

import { parseChord } from "./chords";

export interface ChordAt {
  /** Character index in the lyric line the chord starts on. */
  at: number;
  chord: string;
}

export interface TextLine {
  text: string;
  chords: ChordAt[];
}

export interface TextSection {
  name: string;
  slides: TextLine[][];
}

export interface ParsedSong {
  sections: TextSection[];
  /** Section names in play order; repeats allowed. */
  arrangement: string[];
  /** Picked up from ChordPro {title:} / {key:} directives, if present. */
  title?: string;
  key?: string;
}

export interface ParseOptions {
  /** Longer blocks are split into slides of at most this many lines. */
  linesPerSlide: number;
}

const SECTION_WORDS =
  "verse|chorus|pre[- ]?chorus|bridge|intro|outro|tag|ending|interlude|instrumental|refrain|hook|vamp|turnaround|coda";
const HEADER_RE = new RegExp(`^(${SECTION_WORDS})\\s*(\\d+)?\\s*:?\\s*(\\(?x\\d+\\)?)?$`, "i");
const CHORDPRO_RE = /^\{\s*([a-z_]+)\s*(?::\s*(.*?))?\s*\}$/i;
// Tokens allowed on a chord line besides chords: bar lines, repeat marks…
const CHORD_LINE_EXTRAS = /^(\|+|\/|-+|%|x\d+|\(x\d+\)|n\.?c\.?|\(|\))$/i;

function titleCase(s: string): string {
  return s.toLowerCase().replace(/(^|[\s-])\S/g, (m) => m.toUpperCase());
}

function normalizeSectionName(word: string, number?: string): string {
  const base = /^pre[- ]?chorus$/i.test(word) ? "Pre-Chorus" : titleCase(word);
  return number ? `${base} ${number}` : base;
}

/** If the line is a section header, its normalized name. */
export function sectionHeader(line: string): string | null {
  const s = line.trim();
  if (!s) return null;
  const bracket = /^\[([^\]]+)\]$/.exec(s);
  if (bracket) {
    const inner = bracket[1].trim();
    if (parseChord(inner)) return null; // "[G]" is a chord, not a header
    const known = HEADER_RE.exec(inner);
    return known ? normalizeSectionName(known[1], known[2]) : titleCase(inner);
  }
  const known = HEADER_RE.exec(s);
  return known ? normalizeSectionName(known[1], known[2]) : null;
}

/** Chords on a chord-only line, with the column each starts at. */
export function chordLine(line: string): ChordAt[] | null {
  const chords: ChordAt[] = [];
  let sawToken = false;
  for (const m of line.matchAll(/\S+/g)) {
    sawToken = true;
    const token = m[0].replace(/^\((.+)\)$/, "$1");
    if (parseChord(token)) chords.push({ at: m.index ?? 0, chord: token });
    else if (!CHORD_LINE_EXTRAS.test(token)) return null;
  }
  return sawToken && chords.length > 0 ? chords : null;
}

/** Pull inline [C] chords out of a lyric line. */
export function inlineChords(line: string): TextLine {
  const chords: ChordAt[] = [];
  let text = "";
  let last = 0;
  for (const m of line.matchAll(/\[([^\]]+)\]/g)) {
    const index = m.index ?? 0;
    if (!parseChord(m[1])) continue;
    text += line.slice(last, index);
    chords.push({ at: text.length, chord: m[1].trim() });
    last = index + m[0].length;
  }
  text += line.slice(last);
  return { text, chords };
}

function attachChords(lyric: string, above: ChordAt[]): TextLine {
  const inline = inlineChords(lyric);
  const chords = [...above, ...inline.chords].sort((a, b) => a.at - b.at);
  return { text: inline.text, chords };
}

function splitBlock(lines: TextLine[], max: number): TextLine[][] {
  const out: TextLine[][] = [];
  for (let i = 0; i < lines.length; i += max) out.push(lines.slice(i, i + max));
  return out;
}

const blockKey = (lines: TextLine[]) => lines.map((l) => l.text.trim().toLowerCase()).join("\n");

interface RawSection {
  name: string | null; // null = no header (auto-named later)
  blocks: TextLine[][];
}

/** Turn pasted or typed song text into sections, slides and an arrangement. */
export function parseSongText(input: string, options: ParseOptions): ParsedSong {
  const perSlide = Math.max(1, Math.floor(options.linesPerSlide));
  const raw: RawSection[] = [];
  const result: ParsedSong = { sections: [], arrangement: [] };
  let current: RawSection | null = null;
  let block: TextLine[] = [];
  let pendingChords: ChordAt[] | null = null;

  const endBlock = () => {
    if (block.length) {
      if (!current) raw.push((current = { name: null, blocks: [] }));
      current.blocks.push(block);
    }
    block = [];
    pendingChords = null;
  };
  const startSection = (name: string | null) => {
    endBlock();
    raw.push((current = { name, blocks: [] }));
  };

  for (const rawLine of input.replace(/\r\n?/g, "\n").replace(/\t/g, "    ").split("\n")) {
    const line = rawLine.replace(/\s+$/, "");
    const directive = CHORDPRO_RE.exec(line.trim());
    if (directive) {
      const [, name, value] = directive;
      const d = name.toLowerCase();
      if (d === "title" || d === "t") result.title = value;
      else if (d === "key") result.key = value;
      else if (["c", "comment", "ci"].includes(d) && value) startSection(sectionHeader(`[${value}]`));
      else if (d === "soc" || d === "start_of_chorus") startSection("Chorus");
      else if (d === "sov" || d === "start_of_verse") startSection(value ? titleCase(value) : null);
      else if (d === "sob" || d === "start_of_bridge") startSection("Bridge");
      else if (/^eo[cvb]$|^end_of_/.test(d)) endBlock();
      continue;
    }
    const header = sectionHeader(line);
    if (header) {
      startSection(header);
      continue;
    }
    if (!line.trim()) {
      endBlock();
      continue;
    }
    const chords = chordLine(line);
    if (chords) {
      // A chord line with no lyric under it (an instrumental bar) is dropped.
      pendingChords = chords;
      continue;
    }
    block.push(attachChords(line, pendingChords ?? []));
    pendingChords = null;
  }
  endBlock();

  // Name unheaded sections: a block that repeats is the chorus, others are
  // numbered verses. Identical repeats become one section played twice.
  const byKey = new Map<string, string>();
  const counts = new Map<string, number>();
  for (const s of raw) if (s.name === null) for (const b of s.blocks) counts.set(blockKey(b), (counts.get(blockKey(b)) ?? 0) + 1);
  let verse = 0;
  let chorusNamed = false;
  const sections = new Map<string, TextSection>();
  const contentOf = new Map<string, string>();

  const addOccurrence = (name: string, blocks: TextLine[][]) => {
    if (blocks.length === 0) {
      if (sections.has(name)) result.arrangement.push(name);
      else {
        sections.set(name, { name, slides: [] }); // header with nothing yet
        result.arrangement.push(name);
      }
      return;
    }
    const key = blocks.map(blockKey).join("\n\n");
    let finalName = name;
    if (sections.has(name) && sections.get(name)!.slides.length > 0 && contentOf.get(name) !== key) {
      // Same header, different words: keep both ("Chorus 2").
      let n = 2;
      while (sections.has(`${name} ${n}`)) n++;
      finalName = `${name} ${n}`;
    }
    if (!sections.has(finalName) || sections.get(finalName)!.slides.length === 0) {
      sections.set(finalName, { name: finalName, slides: blocks.flatMap((b) => splitBlock(b, perSlide)) });
      contentOf.set(finalName, key);
    }
    result.arrangement.push(finalName);
  };

  for (const s of raw) {
    if (s.name !== null) {
      addOccurrence(s.name, s.blocks);
      continue;
    }
    for (const b of s.blocks) {
      const key = blockKey(b);
      let name = byKey.get(key);
      if (!name) {
        name = (counts.get(key) ?? 0) > 1 && !chorusNamed ? "Chorus" : `Verse ${++verse}`;
        if (name === "Chorus") chorusNamed = true;
        byKey.set(key, name);
      }
      addOccurrence(name, [b]);
    }
  }

  result.sections = [...sections.values()];
  return result;
}

/** A chord line laid out above `text` (chords never overlap). */
export function renderChordLine(chords: ChordAt[]): string {
  let out = "";
  for (const { at, chord } of [...chords].sort((a, b) => a.at - b.at)) {
    const col = out.length === 0 ? at : Math.max(at, out.length + 1);
    out = out.padEnd(col, " ") + chord;
  }
  return out;
}

export interface TextSongInput {
  sections: { name: string; slides: { lines: TextLine[] }[] }[];
  /** Section names in play order. Empty = sections in order. */
  arrangement: string[];
}

/** Write a song out as editable text that parses back to the same song. */
export function songToText(song: TextSongInput): string {
  const order = song.arrangement.length ? song.arrangement : song.sections.map((s) => s.name);
  const written = new Set<string>();
  const parts: string[] = [];
  const write = (name: string) => {
    const section = song.sections.find((s) => s.name === name);
    if (!section) return;
    if (written.has(name)) {
      parts.push(`[${name}]`);
      return;
    }
    written.add(name);
    const slides = section.slides.map((slide) =>
      slide.lines
        .flatMap((line) => (line.chords.length ? [renderChordLine(line.chords), line.text] : [line.text]))
        .join("\n"),
    );
    parts.push([`[${name}]`, slides.join("\n\n")].filter(Boolean).join("\n"));
  };
  order.forEach(write);
  // Sections the arrangement skips still need to survive an edit.
  song.sections.forEach((s) => !written.has(s.name) && write(s.name));
  return parts.join("\n\n") + "\n";
}
