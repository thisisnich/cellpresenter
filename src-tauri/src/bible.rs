//! Scripture: the bundled public-domain Bibles (KJV and WEB, packaged by
//! `scripts/bibles.py`), passages by reference, and passages as slides.
//!
//! The web app parses what people type ("Jn 3:16-18") into a
//! `ScriptureRef`; the server looks the verses up and splits them into
//! slides, as it does for announcements, so a setlist item can be shown
//! from anywhere.

use std::io::Read;
use std::sync::OnceLock;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::live::Slide;

/// Lyrics are never wrapped on screen, so passages are wrapped here: about
/// this many characters a line…
const LINE_CHARS: usize = 44;
/// …and at most this many lines a slide.
const SLIDE_LINES: usize = 4;

struct Translation {
    id: &'static str,
    name: &'static str,
    short: &'static str,
    data: &'static [u8],
}

const TRANSLATIONS: [Translation; 2] = [
    Translation {
        id: "kjv",
        name: "King James Version",
        short: "KJV",
        data: include_bytes!("../bibles/kjv.tsv.gz"),
    },
    Translation {
        id: "web",
        name: "World English Bible",
        short: "WEB",
        data: include_bytes!("../bibles/web.tsv.gz"),
    },
];

/// The 66 books in order; a book's number is its place here plus one.
const BOOKS: [&str; 66] = [
    "Genesis",
    "Exodus",
    "Leviticus",
    "Numbers",
    "Deuteronomy",
    "Joshua",
    "Judges",
    "Ruth",
    "1 Samuel",
    "2 Samuel",
    "1 Kings",
    "2 Kings",
    "1 Chronicles",
    "2 Chronicles",
    "Ezra",
    "Nehemiah",
    "Esther",
    "Job",
    "Psalms",
    "Proverbs",
    "Ecclesiastes",
    "Song of Songs",
    "Isaiah",
    "Jeremiah",
    "Lamentations",
    "Ezekiel",
    "Daniel",
    "Hosea",
    "Joel",
    "Amos",
    "Obadiah",
    "Jonah",
    "Micah",
    "Nahum",
    "Habakkuk",
    "Zephaniah",
    "Haggai",
    "Zechariah",
    "Malachi",
    "Matthew",
    "Mark",
    "Luke",
    "John",
    "Acts",
    "Romans",
    "1 Corinthians",
    "2 Corinthians",
    "Galatians",
    "Ephesians",
    "Philippians",
    "Colossians",
    "1 Thessalonians",
    "2 Thessalonians",
    "1 Timothy",
    "2 Timothy",
    "Titus",
    "Philemon",
    "Hebrews",
    "James",
    "1 Peter",
    "2 Peter",
    "1 John",
    "2 John",
    "3 John",
    "Jude",
    "Revelation",
];

/// A translation's text: books → chapters → verses (verse 1 at index 0;
/// a verse a translation leaves out is empty).
type Text = Vec<Vec<Vec<String>>>;

fn text_of(t: &Translation) -> &'static Text {
    static TEXTS: [OnceLock<Text>; 2] = [OnceLock::new(), OnceLock::new()];
    let slot = TRANSLATIONS
        .iter()
        .position(|x| x.id == t.id)
        .expect("known translation");
    TEXTS[slot].get_or_init(|| {
        let mut tsv = String::new();
        flate2::read::GzDecoder::new(t.data)
            .read_to_string(&mut tsv)
            .expect("bundled Bible unpacks");
        let mut books: Text = vec![Vec::new(); BOOKS.len()];
        for line in tsv.lines() {
            let mut parts = line.splitn(4, '\t');
            let (Some(b), Some(c), Some(v), Some(words)) =
                (parts.next(), parts.next(), parts.next(), parts.next())
            else {
                continue;
            };
            let (Ok(b), Ok(c), Ok(v)) =
                (b.parse::<usize>(), c.parse::<usize>(), v.parse::<usize>())
            else {
                continue;
            };
            let Some(chapters) = books.get_mut(b.wrapping_sub(1)) else {
                continue;
            };
            if c == 0 || v == 0 {
                continue;
            }
            if chapters.len() < c {
                chapters.resize(c, Vec::new());
            }
            let verses = &mut chapters[c - 1];
            if verses.len() < v {
                verses.resize(v, String::new());
            }
            verses[v - 1] = words.to_string();
        }
        books
    })
}

fn translation(id: &str) -> Option<&'static Translation> {
    TRANSLATIONS.iter().find(|t| t.id == id)
}

// ---------- types shared with the web app ----------

#[derive(Clone, Debug, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct TranslationInfo {
    pub id: String,
    pub name: String,
    /// "KJV", shown beside references.
    pub short: String,
    /// Fetched with the church's own key rather than built in.
    pub online: bool,
}

#[derive(Clone, Debug, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct BookInfo {
    /// 1 (Genesis) to 66 (Revelation).
    pub id: u8,
    pub name: String,
    /// How many verses each chapter has (in the KJV).
    pub verses: Vec<u16>,
}

#[derive(Clone, Debug, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct BibleInfo {
    pub translations: Vec<TranslationInfo>,
    pub books: Vec<BookInfo>,
}

/// A chapter and verse.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct VersePoint {
    pub chapter: u16,
    /// 0 at the end of a range: to the end of the chapter.
    pub verse: u16,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct VerseRange {
    pub from: VersePoint,
    pub to: VersePoint,
}

/// A passage in one book: "John 3:16-18, 20" is book 43 with two ranges.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct ScriptureRef {
    pub book: u8,
    pub ranges: Vec<VerseRange>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Verse {
    pub chapter: u16,
    pub verse: u16,
    pub text: String,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Passage {
    /// "John 3:16–18, 20".
    pub label: String,
    /// The translation's short name, "KJV".
    pub translation: String,
    pub verses: Vec<Verse>,
}

#[derive(Debug, PartialEq)]
pub enum BibleError {
    UnknownTranslation,
    /// No such book, chapter or verse, or nothing in the ranges.
    NotFound,
}

pub fn info() -> BibleInfo {
    let kjv = text_of(&TRANSLATIONS[0]);
    BibleInfo {
        translations: TRANSLATIONS
            .iter()
            .map(|t| TranslationInfo {
                id: t.id.into(),
                name: t.name.into(),
                short: t.short.into(),
                online: false,
            })
            .collect(),
        books: BOOKS
            .iter()
            .enumerate()
            .map(|(i, name)| BookInfo {
                id: i as u8 + 1,
                name: (*name).into(),
                verses: kjv[i].iter().map(|v| v.len() as u16).collect(),
            })
            .collect(),
    }
}

/// USFM book codes ("JHN"), as API.Bible names books.
pub const USFM: [&str; 66] = [
    "GEN", "EXO", "LEV", "NUM", "DEU", "JOS", "JDG", "RUT", "1SA", "2SA", "1KI", "2KI", "1CH",
    "2CH", "EZR", "NEH", "EST", "JOB", "PSA", "PRO", "ECC", "SNG", "ISA", "JER", "LAM", "EZK",
    "DAN", "HOS", "JOL", "AMO", "OBA", "JON", "MIC", "NAM", "HAB", "ZEP", "HAG", "ZEC", "MAL",
    "MAT", "MRK", "LUK", "JHN", "ACT", "ROM", "1CO", "2CO", "GAL", "EPH", "PHP", "COL", "1TH",
    "2TH", "1TI", "2TI", "TIT", "PHM", "HEB", "JAS", "1PE", "2PE", "1JN", "2JN", "3JN", "JUD",
    "REV",
];

/// How many verses a chapter has (KJV versification), 0 if no such chapter.
pub fn verses_in(book: u8, chapter: u16) -> u16 {
    text_of(&TRANSLATIONS[0])
        .get(usize::from(book).wrapping_sub(1))
        .and_then(|b| b.get(usize::from(chapter).wrapping_sub(1)))
        .map_or(0, |c| c.len() as u16)
}

/// The book's name as a reference reads: "Psalm 23" for one psalm.
fn book_name(book: u8, chapters: usize) -> &'static str {
    match (book, chapters) {
        (19, 1) => "Psalm",
        _ => BOOKS[usize::from(book) - 1],
    }
}

/// "John 3:16–18, 20", "Psalm 23", "Ruth 1:16–2:3".
pub fn label(r: &ScriptureRef, verses: &[Verse]) -> String {
    let chapters: std::collections::BTreeSet<u16> = verses.iter().map(|v| v.chapter).collect();
    let mut out = format!("{} ", book_name(r.book, chapters.len()));
    let mut last_chapter = None;
    let parts: Vec<String> = r
        .ranges
        .iter()
        .filter_map(|range| {
            let inside: Vec<&Verse> = verses
                .iter()
                .filter(|v| {
                    let p = VersePoint {
                        chapter: v.chapter,
                        verse: v.verse,
                    };
                    p >= range.from
                        && (range.to.verse == 0 && p.chapter <= range.to.chapter || p <= range.to)
                })
                .collect();
            let (first, last) = (inside.first()?, inside.last()?);
            let whole =
                range.from.verse <= 1 && range.to.verse == 0 && first.chapter == range.from.chapter;
            let text = if whole {
                if first.chapter == last.chapter {
                    format!("{}", first.chapter)
                } else {
                    format!("{}–{}", first.chapter, last.chapter)
                }
            } else {
                let start = if last_chapter == Some(first.chapter) {
                    format!("{}", first.verse)
                } else {
                    format!("{}:{}", first.chapter, first.verse)
                };
                if first.chapter == last.chapter && first.verse == last.verse {
                    start
                } else if first.chapter == last.chapter {
                    format!("{start}–{}", last.verse)
                } else {
                    format!("{start}–{}:{}", last.chapter, last.verse)
                }
            };
            last_chapter = Some(last.chapter);
            Some(text)
        })
        .collect();
    out.push_str(&parts.join(", "));
    out
}

/// The verses a reference names, in the given translation.
pub fn passage(translation_id: &str, r: &ScriptureRef) -> Result<Passage, BibleError> {
    let t = translation(translation_id).ok_or(BibleError::UnknownTranslation)?;
    let book = text_of(t)
        .get(usize::from(r.book).wrapping_sub(1))
        .ok_or(BibleError::NotFound)?;
    let mut verses = Vec::new();
    for range in &r.ranges {
        let (from, to) = (range.from, range.to);
        if from.chapter == 0 || to.chapter < from.chapter {
            continue;
        }
        for chapter in from.chapter..=to.chapter {
            let Some(chapter_verses) = book.get(usize::from(chapter) - 1) else {
                break;
            };
            let first = if chapter == from.chapter {
                from.verse.max(1)
            } else {
                1
            };
            let last = if chapter == to.chapter && to.verse != 0 {
                to.verse.min(chapter_verses.len() as u16)
            } else {
                chapter_verses.len() as u16
            };
            for verse in first..=last {
                let text = &chapter_verses[usize::from(verse) - 1];
                if !text.is_empty()
                    && !verses
                        .iter()
                        .any(|v: &Verse| v.chapter == chapter && v.verse == verse)
                {
                    verses.push(Verse {
                        chapter,
                        verse,
                        text: text.clone(),
                    });
                }
            }
        }
    }
    if verses.is_empty() {
        return Err(BibleError::NotFound);
    }
    Ok(Passage {
        label: label(r, &verses),
        translation: t.short.into(),
        verses,
    })
}

/// Words wrapped to lines of about `width` characters.
fn wrap(text: &str, width: usize) -> Vec<String> {
    let mut lines = Vec::new();
    let mut line = String::new();
    for word in text.split_whitespace() {
        if !line.is_empty() && line.chars().count() + 1 + word.chars().count() > width {
            lines.push(std::mem::take(&mut line));
        }
        if !line.is_empty() {
            line.push(' ');
        }
        line.push_str(word);
    }
    if !line.is_empty() {
        lines.push(line);
    }
    lines
}

/// A passage as slides: whole verses together while they fit, a long verse
/// over several slides. Verse numbers lead each verse when there are
/// several; each slide is labelled with the verses it holds.
pub fn passage_slides(p: &Passage) -> Vec<Slide> {
    let numbered = p.verses.len() > 1;
    let words = |v: &Verse| {
        if numbered {
            format!("{} {}", v.verse, v.text)
        } else {
            v.text.clone()
        }
    };
    let book = p.label.rsplit_once(' ').map(|(b, _)| b).unwrap_or(&p.label);
    let where_ = |first: &Verse, last: &Verse| {
        if first.chapter != last.chapter {
            format!(
                "{book} {}:{}–{}:{}",
                first.chapter, first.verse, last.chapter, last.verse
            )
        } else if first.verse != last.verse {
            format!("{book} {}:{}–{}", first.chapter, first.verse, last.verse)
        } else {
            format!("{book} {}:{}", first.chapter, first.verse)
        }
    };
    let slide = |section: String, lines: &[String]| Slide {
        section,
        text: lines.join("\n"),
        background: None,
        slide_id: None,
        section_id: None,
        section_cue: false,
    };

    let mut slides = Vec::new();
    let mut held: Vec<&Verse> = Vec::new();
    let flush = |held: &mut Vec<&Verse>, slides: &mut Vec<Slide>| {
        if let (Some(first), Some(last)) = (held.first(), held.last()) {
            let text: Vec<String> = held.iter().map(|v| words(v)).collect();
            slides.push(slide(
                where_(first, last),
                &wrap(&text.join(" "), LINE_CHARS),
            ));
        }
        held.clear();
    };
    for verse in &p.verses {
        let alone = wrap(&words(verse), LINE_CHARS);
        if alone.len() > SLIDE_LINES {
            // Too long for one slide: on slides of its own, split evenly.
            flush(&mut held, &mut slides);
            let parts = alone.len().div_ceil(SLIDE_LINES);
            let per = alone.len().div_ceil(parts);
            for chunk in alone.chunks(per) {
                slides.push(slide(where_(verse, verse), chunk));
            }
            continue;
        }
        let mut trial: Vec<String> = held.iter().map(|v| words(v)).collect();
        trial.push(words(verse));
        if !held.is_empty() && wrap(&trial.join(" "), LINE_CHARS).len() > SLIDE_LINES {
            flush(&mut held, &mut slides);
        }
        held.push(verse);
    }
    flush(&mut held, &mut slides);
    slides
}

#[cfg(test)]
mod tests {
    use super::*;

    /// ((from chapter, verse), (to chapter, verse)).
    type Span = ((u16, u16), (u16, u16));

    fn r(book: u8, ranges: &[Span]) -> ScriptureRef {
        ScriptureRef {
            book,
            ranges: ranges
                .iter()
                .map(|&((fc, fv), (tc, tv))| VerseRange {
                    from: VersePoint {
                        chapter: fc,
                        verse: fv,
                    },
                    to: VersePoint {
                        chapter: tc,
                        verse: tv,
                    },
                })
                .collect(),
        }
    }

    #[test]
    fn both_bibles_are_whole() {
        let info = info();
        assert_eq!(info.books.len(), 66);
        assert_eq!(info.books[18].verses.len(), 150); // Psalms
        assert_eq!(info.books[42].verses[2], 36); // John 3
        for t in &TRANSLATIONS {
            let verses: usize = text_of(t)
                .iter()
                .flatten()
                .map(|c| c.iter().filter(|v| !v.is_empty()).count())
                .sum();
            assert!(verses > 31_000, "{} has {verses}", t.id);
        }
    }

    #[test]
    fn passages_by_reference() {
        let p = passage("kjv", &r(43, &[((3, 16), (3, 16))])).unwrap();
        assert_eq!(p.label, "John 3:16");
        assert_eq!(p.translation, "KJV");
        assert!(p.verses[0].text.starts_with("For God so loved the world"));

        let p = passage("web", &r(43, &[((3, 16), (3, 18)), ((3, 20), (3, 20))])).unwrap();
        assert_eq!(p.label, "John 3:16–18, 20");
        assert_eq!(p.verses.len(), 4);

        let p = passage("kjv", &r(19, &[((23, 1), (23, 0))])).unwrap();
        assert_eq!(p.label, "Psalm 23");
        assert_eq!(p.verses.len(), 6);

        let p = passage("kjv", &r(8, &[((1, 16), (2, 3))])).unwrap();
        assert_eq!(p.label, "Ruth 1:16–2:3");

        // Past the end of a chapter stops at its last verse.
        let p = passage("kjv", &r(43, &[((3, 35), (3, 99))])).unwrap();
        assert_eq!(p.label, "John 3:35–36");
        assert_eq!(
            passage("kjv", &r(43, &[((99, 1), (99, 2))])),
            Err(BibleError::NotFound)
        );
        assert_eq!(
            passage("niv", &r(43, &[((3, 16), (3, 16))])),
            Err(BibleError::UnknownTranslation)
        );
    }

    #[test]
    fn passages_become_slides_that_fit() {
        let p = passage("kjv", &r(19, &[((23, 1), (23, 0))])).unwrap();
        let slides = passage_slides(&p);
        assert!(slides.len() >= 3);
        for s in &slides {
            assert!(s.text.lines().count() <= SLIDE_LINES, "{}", s.text);
            assert!(
                s.text.lines().all(|l| l.chars().count() <= LINE_CHARS + 12),
                "{}",
                s.text
            );
            assert!(s.section.starts_with("Psalm 23:"));
        }
        // The psalm's title is part of verse 1 in this text.
        assert!(
            slides[0]
                .text
                .starts_with("1 A Psalm of David. The LORD is my shepherd"),
            "{}",
            slides[0].text
        );
        // Every verse is there, in order.
        let all = slides
            .iter()
            .map(|s| s.text.replace('\n', " "))
            .collect::<Vec<_>>()
            .join(" ");
        assert!(all.contains("6 Surely goodness and mercy"));

        // One verse: no number.
        let one = passage_slides(&passage("kjv", &r(43, &[((3, 16), (3, 16))])).unwrap());
        assert_eq!(one.len(), 1);
        assert!(one[0].text.starts_with("For God"));
        assert_eq!(one[0].section, "John 3:16");

        // A very long verse spreads over slides.
        let long = passage_slides(&passage("kjv", &r(17, &[((8, 9), (8, 9))])).unwrap());
        assert!(long.len() >= 2, "{long:?}");
        assert!(long.iter().all(|s| s.section == "Esther 8:9"));
    }
}
