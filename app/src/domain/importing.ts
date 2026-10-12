// Songs found online, made ready for the song editor: site markup removed,
// stray lines (tabs, "Capo 2", "Intro: G D") dropped, and the text tidied
// into sections the parser understands. Pure functions, no I/O.

import type { OnlineSong } from "../generated/OnlineSong";
import type { Source } from "../generated/Source";
import { chordLine, parseSongText, songToText } from "./songText";

/** What the editor opens with: a new, unsaved song. */
export interface SongDraft {
  title: string;
  artist: string;
  key: string;
  capo: number;
  text: string;
  /** Where it was found, to remind whoever saves it to check it. */
  source?: Source;
}

// Guitar tab staff lines: "e|---3---0---|", "G|-----2h4---".
const TAB_LINE = /^\s*[A-Ga-g][#b]?\s*[|:][-0-9|hpbrsvx~/\\().^*=\s]*$/;
const CAPO_LINE = /^\s*capo\b\D*(\d+)?/i;
const INFO_LINE = /^\s*(key|tuning|tempo|bpm|time signature|time|strumming|chords? used|difficulty|author|tabbed by)\b\s*[:-]/i;
// "Intro: G D Em C" — a label with only chords after it.
const LABELLED_CHORDS = /^\s*[A-Za-z][\w ]{0,20}:\s*(.+)$/;

export interface CleanSheet {
  text: string;
  capo: number | null;
}

/** An Ultimate Guitar sheet as plain chords-over-lyrics text. */
export function cleanChordSheet(content: string): CleanSheet {
  let capo: number | null = null;
  const lines: string[] = [];
  for (const raw of content.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.replace(/\[\/?(tab|ch)\]/g, "");
    const capoMatch = CAPO_LINE.exec(line);
    if (capoMatch) {
      if (capoMatch[1]) capo = Number(capoMatch[1]);
      continue;
    }
    if (TAB_LINE.test(line) && line.includes("-")) continue;
    if (INFO_LINE.test(line)) continue;
    const labelled = LABELLED_CHORDS.exec(line);
    if (labelled && chordLine(labelled[1])) continue;
    lines.push(line);
  }
  return { text: lines.join("\n").replace(/\n{3,}/g, "\n\n").trim(), capo };
}

/** Sections, slides and arrangement as editor text: stanzas stay whole (the
 *  editor splits them into slides), and sections with no words are dropped. */
export function tidySongText(text: string): string {
  const parsed = parseSongText(text, { linesPerSlide: 1000 });
  const keep = new Set(parsed.sections.filter((s) => s.slides.length > 0).map((s) => s.name));
  const sections = parsed.sections
    .filter((s) => keep.has(s.name))
    .map((s) => ({ name: s.name, slides: s.slides.map((lines) => ({ lines })) }));
  if (sections.length === 0) return "";
  return songToText({ sections, arrangement: parsed.arrangement.filter((n) => keep.has(n)) });
}

/** A song from a site, ready to edit and save. */
export function draftFrom(song: OnlineSong): SongDraft {
  const sheet = song.source === "ultimate_guitar" ? cleanChordSheet(song.text) : { text: song.text, capo: null };
  const parsed = parseSongText(sheet.text, { linesPerSlide: 1000 });
  return {
    title: song.title || parsed.title || "",
    artist: song.artist ?? "",
    key: song.key ?? parsed.key ?? "",
    capo: song.capo ?? sheet.capo ?? 0,
    text: tidySongText(sheet.text),
    source: song.source,
  };
}

/** A pasted link to a song page we can import, e.g. an Ultimate Guitar tab. */
export function songLink(input: string): { source: Source; id: string } | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (!/(^|\.)ultimate-guitar\.com$/.test(url.hostname)) return null;
  const path = /^\/tab\/([\w-]+\/[\w-]+)\/?$/.exec(url.pathname);
  return path ? { source: "ultimate_guitar", id: path[1] } : null;
}
