// The slides a song or announcement puts on screen. Mirrors Song::live_slides
// and announcement_slides in the Rust server, so a preview matches the
// screen exactly. A slide's `background` is its own background cue.

import type { Slide } from "../generated/Slide";
import type { Song } from "../generated/Song";

/** A song's sections in play order: its arrangement, else section order. */
export function playedSections(song: Song): Song["sections"] {
  const byId = new Map(song.sections.map((s) => [s.id, s]));
  const arranged = (song.arrangement ?? []).map((id) => byId.get(id)).filter((s) => s !== undefined);
  return arranged.length > 0 ? arranged : song.sections;
}

/** The song's own play order as section ids (repeats allowed). */
export function songOrder(song: Song): string[] {
  return playedSections(song).map((s) => s.id);
}

/**
 * The song played in another order (a setlist's): ids the song doesn't have
 * are skipped, and an order with none left plays the song's own.
 */
export function withArrangement(song: Song, order: string[] | null | undefined): Song {
  const known = new Set(song.sections.map((s) => s.id));
  const kept = (order ?? []).filter((id) => known.has(id));
  return kept.length > 0 ? { ...song, arrangement: kept } : song;
}

/**
 * The order the song is being played in, read back from the slides on air:
 * each time a section's first slide comes up, that section starts again.
 * Lets a chord sheet follow any order the operator chose.
 */
export function orderFromSlides(song: Song, slides: Pick<Slide, "slide_id" | "section_id">[]): string[] {
  const first = new Map(song.sections.map((s) => [s.id, s.slides[0]?.id]));
  return slides.flatMap((slide) =>
    slide.section_id && slide.slide_id && first.get(slide.section_id) === slide.slide_id ? [slide.section_id] : [],
  );
}

/**
 * A song's slides in play order (its arrangement, else section order).
 * A slide's background cue is its own, else its section's; `urlOf` turns
 * that media id into an image URL.
 */
export function playedSlides(song: Song, urlOf: (mediaId: string) => string | null = () => null): Slide[] {
  return playedSections(song).flatMap((section) =>
    section.slides.map((slide) => ({
      section: section.name,
      text: slide.lines.map((l) => l.text).join("\n"),
      background: (() => {
        const cue = slide.background_id ?? section.background_id;
        return cue ? urlOf(cue) : null;
      })(),
      slide_id: slide.id,
      section_id: section.id,
      section_cue: !slide.background_id && Boolean(section.background_id),
    })),
  );
}

/** An announcement's slides: a blank line starts a new slide. */
export function announcementSlides(title: string, text: string): Slide[] {
  const slides = text
    .replace(/\r\n/g, "\n")
    .split("\n\n")
    .map((block) => block.replace(/^\n+|\n+$/g, "").trimEnd())
    .filter((block) => block.trim() !== "")
    .map((block) => ({ section: title, text: block, background: null, slide_id: null, section_id: null, section_cue: false }));
  return slides.length > 0 ? slides : [{ section: title, text: title, background: null, slide_id: null, section_id: null, section_cue: false }];
}
