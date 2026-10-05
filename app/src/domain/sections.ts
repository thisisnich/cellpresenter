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
