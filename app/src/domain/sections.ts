// Song section helpers: classify section names and shorten them for chips.

export type SectionKind = "verse" | "chorus" | "bridge" | "other";

/** Classify a section name. "Pre-Chorus" counts as other, not chorus. */
export function sectionKind(name: string): SectionKind {
  const n = name.trim().toLowerCase();
  if (/^pre[\s-]?chorus/.test(n)) return "other";
  if (n.startsWith("chorus")) return "chorus";
  if (n.startsWith("verse")) return "verse";
  if (n.startsWith("bridge")) return "bridge";
  return "other";
}

const ABBREVIATIONS: [RegExp, string][] = [
  [/^pre[\s-]?chorus/, "PC"],
  [/^chorus/, "C"],
  [/^verse/, "V"],
  [/^bridge/, "B"],
  [/^intro/, "I"],
  [/^outro/, "O"],
  [/^tag/, "T"],
  [/^interlude/, "IL"],
];

/** "Verse 2" → "V2", "Chorus" → "C", "Pre-Chorus 1" → "PC1". */
export function sectionAbbrev(name: string): string {
  const n = name.trim().toLowerCase();
  const number = /(\d+)\s*$/.exec(n)?.[1] ?? "";
  for (const [re, short] of ABBREVIATIONS) {
    if (re.test(n)) return short + number;
  }
  return (n.charAt(0).toUpperCase() || "?") + number;
}

/** Collapse consecutive slides of the same section into an arrangement. */
export function arrangementOf(sections: string[]): string[] {
  return sections.filter((s, i) => i === 0 || s !== sections[i - 1]);
}

export interface SectionJump {
  /** Short label for a chip, e.g. "V1". */
  label: string;
  section: string;
  /** First slide of this run of the section. */
  index: number;
}

/** Where each section starts in a run of slides, for jump buttons. */
export function sectionJumps(slides: { section: string }[]): SectionJump[] {
  return slides.flatMap((slide, index) =>
    index === 0 || slide.section !== slides[index - 1].section
      ? [{ label: sectionAbbrev(slide.section), section: slide.section, index }]
      : [],
  );
}

/** The jump whose run contains slide `index`. */
export function currentJump(jumps: SectionJump[], index: number): SectionJump | undefined {
  return [...jumps].reverse().find((j) => j.index <= index);
}
