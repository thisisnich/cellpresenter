// Bible references as people type them ("Jn 3:16-18", "1 Cor 13",
// "Ps 23:1-4, 6", "Jude 3"), turned into the passage the server looks up.
// Pure functions, no I/O.

import type { ScriptureRef } from "../generated/ScriptureRef";
import type { VerseRange } from "../generated/VerseRange";

/** The 66 books in order; a book's number is its place here plus one. */
export const BOOK_NAMES = [
  "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua", "Judges", "Ruth",
  "1 Samuel", "2 Samuel", "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra",
  "Nehemiah", "Esther", "Job", "Psalms", "Proverbs", "Ecclesiastes", "Song of Songs", "Isaiah",
  "Jeremiah", "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel", "Amos", "Obadiah", "Jonah",
  "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi", "Matthew", "Mark",
  "Luke", "John", "Acts", "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians",
  "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians", "1 Timothy", "2 Timothy",
  "Titus", "Philemon", "Hebrews", "James", "1 Peter", "2 Peter", "1 John", "2 John", "3 John",
  "Jude", "Revelation",
];

/** Books with one chapter: "Jude 3" is verse 3. */
const ONE_CHAPTER = new Set([31, 57, 63, 64, 65]);

// Short forms people use that a prefix of the name wouldn't find (or would
// find the wrong book for).
const ALIASES: Record<string, number> = {
  gn: 1, ex: 2, exod: 2, lv: 3, nm: 4, dt: 5, jos: 6, jdg: 7, jg: 7, jgs: 7, rth: 8,
  ps: 19, psa: 19, pss: 19, psalm: 19, pr: 20, prv: 20, qoh: 21, eccl: 21, song: 22, sos: 22,
  sng: 22, songofsolomon: 22, canticles: 22, is: 23, jer: 24, lam: 25, ezek: 26, eze: 26, ezk: 26,
  dn: 27, ho: 28, jl: 29, am: 30, ob: 31, jon: 32, jnh: 32, mi: 33, na: 34, hab: 35, zep: 36,
  zeph: 36, hg: 37, zec: 38, zech: 38, mal: 39, mt: 40, mk: 41, mrk: 41, lk: 42, luk: 42, jn: 43,
  jhn: 43, ac: 44, rm: 45, rom: 45, ga: 48, eph: 49, phil: 50, php: 50, col: 51, ti: 56, tit: 56,
  phm: 57, philem: 57, heb: 58, jas: 59, jm: 59, jud: 65, jude: 65, rev: 66, rv: 66, revelations: 66,
  "1jn": 62, "2jn": 63, "3jn": 64, "1pt": 60, "2pt": 61, "1th": 52, "2th": 53, "1tm": 54, "2tm": 55,
  "1sm": 9, "2sm": 10, "1kgs": 11, "2kgs": 12, "1chr": 13, "2chr": 14, "1cor": 46, "2cor": 47,
};

const key = (s: string) =>
  s
    .toLowerCase()
    .replace(/^(iii|ii|i)(?=\s|[a-z])/, (r) => String(r.length))
    .replace(/^(first|second|third)\s+/, (w) => String(["first", "second", "third"].indexOf(w.trim()) + 1))
    .replace(/[\s.]/g, "");
const KEYS = BOOK_NAMES.map(key);

/** The book a name or abbreviation means (1-66), or null if none or several. */
export function findBook(name: string): number | null {
  const k = key(name.trim());
  if (!k) return null;
  if (ALIASES[k]) return ALIASES[k];
  const exact = KEYS.indexOf(k);
  if (exact >= 0) return exact + 1;
  const matches = KEYS.flatMap((full, i) => (full.startsWith(k) ? [i + 1] : []));
  return matches.length === 1 ? matches[0] : null;
}

export type ParsedReference = { ok: true; passage: ScriptureRef } | { ok: false; reason: "book" | "numbers" };

const point = (chapter: number, verse: number) => ({ chapter, verse });

/** "John 3:16-18, 20" → book 43, verses 16-18 and 20 of chapter 3. */
export function parseReference(input: string): ParsedReference {
  const m = /^\s*((?:[1-3]|i{1,3})?\s*[a-z][a-z .]*?)\s*(\d[\d\s:,;.\-–—]*)?\s*$/i.exec(input.replace(/ /g, " "));
  if (!m) return { ok: false, reason: "book" };
  const book = findBook(m[1]);
  if (!book) return { ok: false, reason: "book" };
  const numbers = (m[2] ?? "").replace(/[–—]/g, "-").replace(/\s+/g, "").replace(/\./g, ":");
  // Just a book: its first chapter.
  if (!numbers) return { ok: true, passage: { book, ranges: [{ from: point(1, 1), to: point(1, 0) }] } };

  const ranges: VerseRange[] = [];
  let chapter: number | null = ONE_CHAPTER.has(book) ? 1 : null;
  // After a verse ("3:16, 18"), a bare number is another verse.
  let inVerses = ONE_CHAPTER.has(book);
  for (const part of numbers.split(/[,;]/).filter(Boolean)) {
    const [startText, endText] = part.split("-");
    const parse = (text: string | undefined) => {
      if (!text) return null;
      const [a, b] = text.split(":");
      if (!/^\d+$/.test(a ?? "") || (b !== undefined && !/^\d+$/.test(b))) return undefined;
      return b !== undefined
        ? ({ kind: "point", chapter: Number(a), verse: Number(b) } as const)
        : ({ kind: "number", number: Number(a) } as const);
    };
    const start = parse(startText);
    const end = parse(endText);
    if (!start || end === undefined) return { ok: false, reason: "numbers" };

    let from: { chapter: number; verse: number };
    if (start.kind === "point") {
      from = point(start.chapter, start.verse);
      chapter = start.chapter;
      inVerses = true;
    } else if (inVerses && chapter !== null) {
      from = point(chapter, start.number);
    } else {
      // A whole chapter (or chapters: "Ps 1-2").
      chapter = start.number;
      const last = end?.kind === "number" ? end.number : chapter;
      ranges.push({ from: point(chapter, 1), to: point(last, 0) });
      chapter = last;
      continue;
    }

    let to = from;
    if (end) {
      to = end.kind === "point" ? point(end.chapter, end.verse) : point(from.chapter, end.number);
      chapter = to.chapter;
    }
    if (to.chapter < from.chapter || (to.chapter === from.chapter && to.verse < from.verse)) {
      return { ok: false, reason: "numbers" };
    }
    ranges.push({ from, to });
  }
  if (ranges.length === 0 || ranges.some((r) => r.from.chapter < 1 || r.from.verse < 1 && r.to.verse !== 0)) {
    return { ok: false, reason: "numbers" };
  }
  return { ok: true, passage: { book, ranges } };
}

/** The reference as typed text, for the input after clicking verses: "John 3:16-18". */
export function referenceText(book: number, chapter: number, from?: number, to?: number): string {
  const name = BOOK_NAMES[book - 1] ?? "";
  if (from === undefined) return `${name} ${chapter}`;
  if (to === undefined || to === from) return `${name} ${chapter}:${from}`;
  return `${name} ${chapter}:${Math.min(from, to)}-${Math.max(from, to)}`;
}
