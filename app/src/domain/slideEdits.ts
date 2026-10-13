// Changing where a song's slides break, from the editor's preview: join a
// slide with the next, or split one in two. Each returns the song as text
// with every break written as a blank line, so the text shows exactly what
// the slides are ("as written"). Pure functions, no I/O.

import { songToText, type ParsedSong, type TextLine } from "./songText";

type Slides = TextLine[][];

function rewrite(p: ParsedSong, section: string, change: (slides: Slides) => Slides | null): string | null {
  const target = p.sections.find((s) => s.name === section);
  if (!target) return null;
  const slides = change(target.slides);
  if (!slides) return null;
  return songToText({
    sections: p.sections.map((s) => ({
      name: s.name,
      slides: (s.name === section ? slides : s.slides).map((lines) => ({ lines })),
    })),
    arrangement: p.arrangement,
  });
}

/** Slide `index` of `section` and the one after it, as one slide. */
export function joinWithNext(p: ParsedSong, section: string, index: number): string | null {
  return rewrite(p, section, (slides) =>
    index + 1 < slides.length ? [...slides.slice(0, index), [...slides[index], ...slides[index + 1]], ...slides.slice(index + 2)] : null,
  );
}

/** Slide `index` of `section` as two slides, split at its middle. */
export function splitInTwo(p: ParsedSong, section: string, index: number): string | null {
  return rewrite(p, section, (slides) => {
    const lines = slides[index];
    if (!lines || lines.length < 2) return null;
    const at = Math.ceil(lines.length / 2);
    return [...slides.slice(0, index), lines.slice(0, at), lines.slice(at), ...slides.slice(index + 1)];
  });
}

/** The arrangement with runs of the same section folded: Bridge ×4. */
export function arrangementRuns(arrangement: string[]): { name: string; times: number }[] {
  const runs: { name: string; times: number }[] = [];
  for (const name of arrangement) {
    const last = runs[runs.length - 1];
    if (last?.name === name) last.times++;
    else runs.push({ name, times: 1 });
  }
  return runs;
}
