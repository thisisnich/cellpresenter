// Song files from other apps, as songs ready to edit or save: ChordPro
// (also what CCLI SongSelect downloads with chords), SongSelect lyrics text
// and old .usr files, OpenLyrics XML (OpenLP and others export it), and
// plain text. Pure functions, no I/O.

import type { SongDraft } from "./importing";
import { tidySongText } from "./importing";
import { parseSongText } from "./songText";

/** Files the import button offers. */
export const SONG_FILE_TYPES = [".cho", ".chopro", ".chordpro", ".crd", ".pro", ".txt", ".usr", ".xml"];

export type SongFileFormat = "chordpro" | "songselect" | "usr" | "openlyrics" | "text";

export interface ImportedSong extends SongDraft {
  format: SongFileFormat;
}

const baseName = (fileName: string) => fileName.replace(/^.*[\\/]/, "").replace(/\.[^.]+$/, "").trim();

/** The format of a song file, judged by its content. */
export function songFileFormat(text: string): SongFileFormat {
  if (/<song[\s>]/.test(text) && /<lyrics[\s>]/.test(text)) return "openlyrics";
  if (/^\s*\[File\]/m.test(text) && /^Words=/m.test(text)) return "usr";
  if (/^\s*\{\s*(title|t|start_of_\w+|so[cvb]|c|comment)\s*[:}]/im.test(text)) return "chordpro";
  if (/^\s*CCLI (Song|License|Licence) ?#/im.test(text)) return "songselect";
  return "text";
}

/** One song file as a song. Null when there are no words in it. */
export function songFromFile(fileName: string, text: string): ImportedSong | null {
  const clean = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const format = songFileFormat(clean);
  const song =
    format === "openlyrics" ? fromOpenLyrics(clean) : format === "usr" ? fromUsr(clean) : fromText(clean, format);
  const body = tidySongText(song.text);
  if (!body.trim()) return null;
  return {
    format,
    title: song.title || baseName(fileName),
    artist: song.artist,
    key: song.key,
    capo: song.capo,
    copyright: song.copyright,
    ccli: song.ccli,
    text: body,
  };
}

type Parts = Omit<SongDraft, "source">;
const empty: Parts = { title: "", artist: "", key: "", capo: 0, copyright: "", ccli: "", text: "" };

// ---------- ChordPro, SongSelect text, plain text ----------

/**
 * SongSelect puts its credits at the end of a song (in ChordPro too, as
 * comments): "CCLI Song # 123", the writers, "© 2016 …", its terms line and
 * "CCLI License # 456". Take them off the words and keep what's useful.
 */
function songSelectFooter(lines: string[]): { lines: string[]; artist?: string; copyright?: string; ccli?: string } {
  const plain = (line: string) => line.replace(/^\s*\{\s*(c|comment|ci)\s*:\s*(.*?)\s*\}\s*$/i, "$2").trim();
  const at = lines.findIndex((l) => /^CCLI Song ?#/i.test(plain(l)));
  if (at < 0) return { lines };
  const footer = lines.slice(at).map(plain).filter(Boolean);
  const ccli = /#\s*(\d+)/.exec(footer[0])?.[1];
  const copyright = footer.find((l) => /^(©|\(c\)|copyright\b)/i.test(l))?.replace(/^(©|\(c\)|copyright)\s*/i, "");
  const writers = footer.slice(1).find((l) => !/^(©|\(c\)|copyright\b|for use|ccli|www\.)/i.test(l));
  return { lines: lines.slice(0, at), artist: writers, copyright, ccli };
}

function fromText(text: string, format: SongFileFormat): Parts {
  let lines = text.split("\n");
  const footer = songSelectFooter(lines);
  lines = footer.lines;
  let title = "";
  // SongSelect text starts with the title on its own line.
  if (format === "songselect") {
    const first = lines.findIndex((l) => l.trim());
    if (first >= 0) {
      title = lines[first].trim();
      lines = lines.slice(first + 1);
    }
  }
  const body = lines.join("\n");
  const parsed = parseSongText(body, { linesPerSlide: 1000 });
  return {
    ...empty,
    title: parsed.title ?? title,
    artist: parsed.artist ?? footer.artist ?? "",
    key: parsed.key ?? "",
    capo: parsed.capo ?? 0,
    copyright: parsed.copyright ?? footer.copyright ?? "",
    ccli: parsed.ccli ?? footer.ccli ?? "",
    text: body,
  };
}

// ---------- SongSelect .usr ----------

function fromUsr(text: string): Parts {
  const field = (name: string) => new RegExp(`^${name}=(.*)$`, "m").exec(text)?.[1]?.trim() ?? "";
  const names = field("Fields").split("/t");
  const words = field("Words").split("/t");
  const body = words
    .map((block, i) => {
      const lines = block.split("/n").map((l) => l.trim()).filter(Boolean);
      return lines.length ? `[${names[i]?.trim() || `Verse ${i + 1}`}]\n${lines.join("\n")}` : "";
    })
    .filter(Boolean)
    .join("\n\n");
  return {
    ...empty,
    title: field("Title"),
    // Several writers are separated by "|".
    artist: field("Author").split("|").map((a) => a.trim()).filter(Boolean).join(", "),
    key: field("Keys").split(/[\s,|]/)[0] ?? "",
    copyright: field("Copyright").replace(/^(©|\(c\))\s*/i, ""),
    ccli: (/\[S A?(\d+)\]/.exec(text)?.[1] ?? field("CCLI")).replace(/\D/g, ""),
    text: body,
  };
}

// ---------- OpenLyrics ----------

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const unescapeXml = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) =>
    e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : (ENTITIES[e] ?? m),
  );
const tag = (xml: string, name: string) => {
  const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`).exec(xml);
  return m ? unescapeXml(m[1].replace(/<[^>]+>/g, "")).trim() : "";
};

const SECTION_LETTER: Record<string, string> = {
  v: "Verse",
  c: "Chorus",
  p: "Pre-Chorus",
  b: "Bridge",
  i: "Intro",
  e: "Ending",
  o: "Outro",
};

/** "v1" → "Verse 1", "c" → "Chorus", "c2" → "Chorus 2". */
function sectionName(name: string): string {
  const m = /^([a-z])(\d*)([a-z]?)$/i.exec(name.trim());
  if (!m) return name.trim();
  const base = SECTION_LETTER[m[1].toLowerCase()] ?? name.trim();
  return m[2] && !(m[1].toLowerCase() !== "v" && m[2] === "1") ? `${base} ${m[2]}` : base;
}

/** A `<lines>` element's text, with chords inline as [C]. */
function linesText(xml: string): string {
  return unescapeXml(
    xml
      .replace(/<chord\b[^>]*?\b(?:name|root)="([^"]+)"[^>]*\/?>(?:<\/chord>)?/g, "[$1]")
      .replace(/<br\s*\/?>/g, "\n")
      .replace(/<comment>[\s\S]*?<\/comment>/g, "")
      .replace(/<[^>]+>/g, ""),
  )
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");
}

function fromOpenLyrics(xml: string): Parts {
  const verses = new Map<string, string>();
  for (const m of xml.matchAll(/<verse\b[^>]*\bname="([^"]+)"[^>]*>([\s\S]*?)<\/verse>/g)) {
    const blocks = [...m[2].matchAll(/<lines\b[^>]*>([\s\S]*?)<\/lines>/g)].map((l) => linesText(l[1])).filter(Boolean);
    verses.set(m[1], blocks.join("\n\n"));
  }
  const order = tag(xml, "verseOrder").split(/\s+/).filter((n) => verses.has(n));
  const sequence = order.length ? order : [...verses.keys()];
  const written = new Set<string>();
  const parts = sequence.map((name) => {
    const header = `[${sectionName(name)}]`;
    if (written.has(name)) return header; // a header on its own repeats it
    written.add(name);
    return `${header}\n${verses.get(name)}`;
  });
  // Verses the order leaves out still come in.
  for (const [name, body] of verses) if (!written.has(name)) parts.push(`[${sectionName(name)}]\n${body}`);
  const authors = [...xml.matchAll(/<author\b[^>]*>([\s\S]*?)<\/author>/g)].map((m) => unescapeXml(m[1]).trim()).filter(Boolean);
  return {
    ...empty,
    title: tag(xml, "title"),
    artist: [...new Set(authors)].join(", "),
    key: tag(xml, "key"),
    copyright: tag(xml, "copyright").replace(/^(©|\(c\))\s*/i, ""),
    ccli: tag(xml, "ccliNo").replace(/\D/g, ""),
    text: parts.join("\n\n"),
  };
}
