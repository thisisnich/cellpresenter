// Between stored songs (server types) and the text editor.

import type { Song } from "../generated/Song";
import type { SongInput } from "../generated/SongInput";
import type { ParsedSong, TextSongInput } from "./songText";

export interface SongMeta {
  title: string;
  artist: string;
  key: string;
  capo: number;
}

/** A random v4 UUID. Works on plain-http LAN pages, unlike randomUUID(). */
export function newId(): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** A stored song in the shape `songToText` takes (arrangement by name). */
export function songForText(song: Song): TextSongInput {
  const nameOf = new Map(song.sections.map((s) => [s.id, s.name]));
  return {
    sections: song.sections.map((s) => ({ name: s.name, slides: s.slides.map((sl) => ({ lines: sl.lines })) })),
    arrangement: (song.arrangement ?? []).map((id) => nameOf.get(id)).filter((n): n is string => Boolean(n)),
  };
}

/** The longest slide in a song, so re-editing doesn't re-split its slides. */
export function longestSlide(song: Song): number {
  return Math.max(1, ...song.sections.flatMap((s) => s.slides.map((sl) => sl.lines.length)));
}

/**
 * Build what the server stores. Sections keep their id when their name is
 * unchanged, and slides keep theirs by position, so an edit updates rows
 * rather than replacing them (which keeps future syncing clean).
 */
export function toSongInput(parsed: ParsedSong, meta: SongMeta, existing?: Song): SongInput {
  const oldByName = new Map((existing?.sections ?? []).map((s) => [s.name, s]));
  const idOf = new Map<string, string>();
  const sections = parsed.sections.map((section) => {
    const old = oldByName.get(section.name);
    const id = old?.id ?? newId();
    idOf.set(section.name, id);
    return {
      id,
      name: section.name,
      slides: section.slides.map((lines, i) => ({ id: old?.slides[i]?.id ?? null, lines })),
    };
  });
  const arrangement = parsed.arrangement.map((name) => idOf.get(name)).filter((id): id is string => Boolean(id));
  const naturalOrder = arrangement.length === sections.length && arrangement.every((id, i) => id === sections[i].id);
  const blank = (s: string) => (s.trim() ? s.trim() : null);
  return {
    title: meta.title.trim(),
    artist: blank(meta.artist),
    key: blank(meta.key),
    capo: Math.min(11, Math.max(0, Math.round(meta.capo))),
    ccli_number: existing?.ccli_number ?? null,
    copyright: existing?.copyright ?? null,
    arrangement: naturalOrder ? null : arrangement,
    sections,
  };
}
