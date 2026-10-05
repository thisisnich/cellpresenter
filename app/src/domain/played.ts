// The slides a song or announcement puts on screen. Mirrors Song::live_slides
// and announcement_slides in the Rust server, so a preview matches the
// screen exactly.

import type { Slide } from "../generated/Slide";
import type { Song } from "../generated/Song";

/** A song's slides in play order (its arrangement, else section order). */
export function playedSlides(song: Song): Slide[] {
  const byId = new Map(song.sections.map((s) => [s.id, s]));
  const arranged = (song.arrangement ?? []).map((id) => byId.get(id)).filter((s) => s !== undefined);
  const sections = arranged.length > 0 ? arranged : song.sections;
  return sections.flatMap((section) =>
    section.slides.map((slide) => ({ section: section.name, text: slide.lines.map((l) => l.text).join("\n") })),
  );
}

/** An announcement's slides: a blank line starts a new slide. */
export function announcementSlides(title: string, text: string): Slide[] {
  const slides = text
    .replace(/\r\n/g, "\n")
    .split("\n\n")
    .map((block) => block.replace(/^\n+|\n+$/g, "").trimEnd())
    .filter((block) => block.trim() !== "")
    .map((block) => ({ section: title, text: block }));
  return slides.length > 0 ? slides : [{ section: title, text: title }];
}
