//! Copyrighted Bibles (ESV, NIV, NASB, …) with the church's own key: the
//! ESV API (api.esv.org) or API.Bible (the American Bible Society). The
//! text is the publishers', so it isn't shipped: each church agrees to the
//! service's terms with its own free key, and only the passages it shows
//! are fetched (and kept, so a prepared service works offline).
//!
//! Keys stay in this computer's library and are never sent to a screen.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use ts_rs::TS;

use crate::bible::{self, Passage, ScriptureRef, TranslationInfo, Verse, USFM};
use crate::online::client;

const ESV_API: &str = "https://api.esv.org/v3/passage/text/";
const API_BIBLE: &str = "https://api.scripture.api.bible/v1/";
/// Translation ids: "esv", or "apib:" and API.Bible's id for the Bible.
pub const ESV_ID: &str = "esv";
const API_BIBLE_PREFIX: &str = "apib:";
/// API.Bible returns at most 200 verses a request.
const MAX_VERSES: usize = 200;

/// A Bible a key gives access to on API.Bible.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct OnlineBible {
    pub id: String,
    /// "NASB", shown beside references.
    pub abbreviation: String,
    pub name: String,
}

/// The keys, as saved (never sent to clients).
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct Keys {
    #[serde(default)]
    pub esv: Option<String>,
    #[serde(default)]
    pub api_bible: Option<String>,
    /// The Bibles chosen from what the API.Bible key allows.
    #[serde(default)]
    pub api_bibles: Vec<OnlineBible>,
}

/// What clients see of the keys: whether one is set, and its last letters.
#[derive(Clone, Debug, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct BibleSources {
    pub esv: Option<String>,
    pub api_bible: Option<String>,
    pub api_bibles: Vec<OnlineBible>,
}

fn hint(key: &Option<String>) -> Option<String> {
    key.as_ref().map(|k| {
        let tail: String = k
            .chars()
            .rev()
            .take(4)
            .collect::<Vec<_>>()
            .into_iter()
            .rev()
            .collect();
        format!("…{tail}")
    })
}

impl Keys {
    pub fn sources(&self) -> BibleSources {
        BibleSources {
            esv: hint(&self.esv),
            api_bible: hint(&self.api_bible),
            api_bibles: if self.api_bible.is_some() {
                self.api_bibles.clone()
            } else {
                Vec::new()
            },
        }
    }

    /// The online translations these keys open, for the translation picker.
    pub fn translations(&self) -> Vec<TranslationInfo> {
        let mut out = Vec::new();
        if self.esv.is_some() {
            out.push(TranslationInfo {
                id: ESV_ID.into(),
                name: "English Standard Version".into(),
                short: "ESV".into(),
                online: true,
            });
        }
        if self.api_bible.is_some() {
            out.extend(self.api_bibles.iter().map(|b| TranslationInfo {
                id: format!("{API_BIBLE_PREFIX}{}", b.id),
                name: b.name.clone(),
                short: b.abbreviation.clone(),
                online: true,
            }));
        }
        out
    }
}

pub fn is_online(translation: &str) -> bool {
    translation == ESV_ID || translation.starts_with(API_BIBLE_PREFIX)
}

#[derive(Debug, PartialEq)]
pub enum OnlineBibleError {
    /// No key for this translation, or the key was refused.
    NoKey,
    BadKey,
    NotFound,
    Unavailable(String),
}

fn unavailable(e: impl std::fmt::Display) -> OnlineBibleError {
    OnlineBibleError::Unavailable(e.to_string())
}

async fn get_json(request: reqwest::RequestBuilder) -> Result<Value, OnlineBibleError> {
    let res = request.send().await.map_err(unavailable)?;
    match res.status().as_u16() {
        401 | 403 => return Err(OnlineBibleError::BadKey),
        404 | 400 => return Err(OnlineBibleError::NotFound),
        _ => {}
    }
    let res = res.error_for_status().map_err(unavailable)?;
    let text = res.text().await.map_err(unavailable)?;
    serde_json::from_str(&text).map_err(unavailable)
}

/// One chapter's part of a reference: (chapter, first verse, last verse).
fn chapter_spans(r: &ScriptureRef) -> Vec<(u16, u16, u16)> {
    let mut spans = Vec::new();
    for range in &r.ranges {
        for chapter in range.from.chapter..=range.to.chapter.max(range.from.chapter) {
            let size = bible::verses_in(r.book, chapter);
            if size == 0 {
                continue;
            }
            let first = if chapter == range.from.chapter {
                range.from.verse.max(1)
            } else {
                1
            };
            let last = if chapter == range.to.chapter && range.to.verse != 0 {
                range.to.verse.min(size)
            } else {
                size
            };
            if first <= last {
                spans.push((chapter, first, last));
            }
        }
    }
    spans
}

/// Verses from text that numbers them "[16] For God… [17] For God sent…".
/// Text before the first number belongs to `first` (a chapter's verse 1
/// may come unnumbered).
pub fn numbered_verses(text: &str, chapter: u16, first: u16) -> Vec<Verse> {
    let mut verses: Vec<Verse> = Vec::new();
    let mut current = first;
    let mut words = String::new();
    let mut rest = text;
    let push = |verses: &mut Vec<Verse>, verse: u16, words: &str| {
        let text = words.split_whitespace().collect::<Vec<_>>().join(" ");
        if !text.is_empty() {
            verses.push(Verse {
                chapter,
                verse,
                text,
            });
        }
    };
    while let Some(open) = rest.find('[') {
        let after = &rest[open + 1..];
        let number = after.find(']').and_then(|close| {
            after[..close]
                .trim()
                .parse::<u16>()
                .ok()
                .map(|n| (n, close))
        });
        match number {
            Some((n, close)) => {
                words.push_str(&rest[..open]);
                push(&mut verses, current, &words);
                words.clear();
                current = n;
                rest = &after[close + 1..];
            }
            None => {
                words.push_str(&rest[..=open]);
                rest = after;
            }
        }
    }
    words.push_str(rest);
    push(&mut verses, current, &words);
    verses
}

async fn esv_verses(key: &str, r: &ScriptureRef) -> Result<Vec<Verse>, OnlineBibleError> {
    let mut verses = Vec::new();
    for (chapter, first, last) in chapter_spans(r) {
        // The ESV API takes numeric ids: book, chapter and verse, BBCCCVVV.
        let id = |v: u16| format!("{:02}{:03}{:03}", r.book, chapter, v);
        let q = format!("{}-{}", id(first), id(last));
        let body = get_json(
            client()
                .get(ESV_API)
                .header("Authorization", format!("Token {key}"))
                .query(&[
                    ("q", q.as_str()),
                    ("include-passage-references", "false"),
                    ("include-verse-numbers", "true"),
                    ("include-first-verse-numbers", "true"),
                    ("include-footnotes", "false"),
                    ("include-headings", "false"),
                    ("include-short-copyright", "false"),
                    ("include-copyright", "false"),
                    ("include-selahs", "true"),
                    ("indent-poetry", "false"),
                    ("indent-paragraphs", "0"),
                ]),
        )
        .await?;
        let text = body["passages"][0].as_str().unwrap_or("");
        verses.extend(numbered_verses(text, chapter, first));
    }
    Ok(verses)
}

async fn api_bible_verses(
    key: &str,
    bible_id: &str,
    r: &ScriptureRef,
) -> Result<Vec<Verse>, OnlineBibleError> {
    let book = USFM
        .get(usize::from(r.book).wrapping_sub(1))
        .ok_or(OnlineBibleError::NotFound)?;
    let mut verses = Vec::new();
    for (chapter, first, last) in chapter_spans(r) {
        // At most MAX_VERSES a request (Psalm 119 has 176, so one is enough).
        let last = last.min(first + MAX_VERSES as u16 - 1);
        let passage = format!("{book}.{chapter}.{first}-{book}.{chapter}.{last}");
        let url = format!("{API_BIBLE}bibles/{bible_id}/passages/{passage}");
        let body = get_json(client().get(url).header("api-key", key).query(&[
            ("content-type", "text"),
            ("include-notes", "false"),
            ("include-titles", "false"),
            ("include-chapter-numbers", "false"),
            ("include-verse-numbers", "true"),
            ("include-verse-spans", "false"),
        ]))
        .await?;
        let text = body["data"]["content"].as_str().unwrap_or("");
        verses.extend(numbered_verses(text, chapter, first));
    }
    Ok(verses)
}

/// The passage from the online translation `translation`.
pub async fn passage(
    keys: &Keys,
    translation: &str,
    r: &ScriptureRef,
) -> Result<Passage, OnlineBibleError> {
    let (verses, short) = if translation == ESV_ID {
        let key = keys.esv.as_deref().ok_or(OnlineBibleError::NoKey)?;
        (esv_verses(key, r).await?, "ESV".to_string())
    } else if let Some(id) = translation.strip_prefix(API_BIBLE_PREFIX) {
        let key = keys.api_bible.as_deref().ok_or(OnlineBibleError::NoKey)?;
        let bible = keys
            .api_bibles
            .iter()
            .find(|b| b.id == id)
            .ok_or(OnlineBibleError::NoKey)?;
        (
            api_bible_verses(key, id, r).await?,
            bible.abbreviation.clone(),
        )
    } else {
        return Err(OnlineBibleError::NoKey);
    };
    if verses.is_empty() {
        return Err(OnlineBibleError::NotFound);
    }
    Ok(Passage {
        label: bible::label(r, &verses),
        translation: short,
        verses,
    })
}

/// Check an ESV key with a one-verse request.
pub async fn check_esv(key: &str) -> Result<(), OnlineBibleError> {
    let john = ScriptureRef {
        book: 43,
        ranges: vec![bible::VerseRange {
            from: bible::VersePoint {
                chapter: 3,
                verse: 16,
            },
            to: bible::VersePoint {
                chapter: 3,
                verse: 16,
            },
        }],
    };
    esv_verses(key, &john).await.map(|_| ())
}

/// The English Bibles an API.Bible key gives access to (also checks the key).
pub async fn api_bibles(key: &str) -> Result<Vec<OnlineBible>, OnlineBibleError> {
    let body = get_json(
        client()
            .get(format!("{API_BIBLE}bibles"))
            .header("api-key", key)
            .query(&[("language", "eng")]),
    )
    .await?;
    let mut bibles: Vec<OnlineBible> = body["data"]
        .as_array()
        .map(Vec::as_slice)
        .unwrap_or_default()
        .iter()
        .filter_map(|b| {
            let text = |k: &str| {
                b[k].as_str()
                    .map(str::trim)
                    .filter(|s| !s.is_empty())
                    .map(String::from)
            };
            Some(OnlineBible {
                id: text("id")?,
                abbreviation: text("abbreviationLocal").or_else(|| text("abbreviation"))?,
                name: text("nameLocal").or_else(|| text("name"))?,
            })
        })
        .collect();
    bibles.sort_by(|a, b| a.name.cmp(&b.name));
    bibles.dedup_by(|a, b| a.id == b.id);
    Ok(bibles)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::bible::{VersePoint, VerseRange};

    #[test]
    fn verses_are_split_on_their_numbers() {
        let verses = numbered_verses(
            "  [16] For God so loved\n the world. [17] For God sent\n [18] He who believes.",
            3,
            16,
        );
        let got: Vec<_> = verses.iter().map(|v| (v.verse, v.text.as_str())).collect();
        assert_eq!(
            got,
            [
                (16, "For God so loved the world."),
                (17, "For God sent"),
                (18, "He who believes.")
            ]
        );
        // An unnumbered start is the first verse; other brackets are words.
        let verses = numbered_verses("In the beginning [the Word] was. [2] He was", 1, 1);
        assert_eq!(verses[0].text, "In the beginning [the Word] was.");
        assert_eq!(verses[1].verse, 2);
    }

    #[test]
    fn references_split_by_chapter() {
        let r = ScriptureRef {
            book: 8,
            ranges: vec![
                VerseRange {
                    from: VersePoint {
                        chapter: 1,
                        verse: 16,
                    },
                    to: VersePoint {
                        chapter: 2,
                        verse: 3,
                    },
                },
                VerseRange {
                    from: VersePoint {
                        chapter: 4,
                        verse: 1,
                    },
                    to: VersePoint {
                        chapter: 4,
                        verse: 0,
                    },
                },
            ],
        };
        assert_eq!(chapter_spans(&r), [(1, 16, 22), (2, 1, 3), (4, 1, 22)]);
    }

    #[test]
    fn keys_are_hinted_never_shown() {
        let keys = Keys {
            esv: Some("abcdef123456".into()),
            api_bible: None,
            api_bibles: vec![OnlineBible {
                id: "x".into(),
                abbreviation: "NASB".into(),
                name: "NASB".into(),
            }],
        };
        let sources = keys.sources();
        assert_eq!(sources.esv.as_deref(), Some("…3456"));
        assert!(sources.api_bibles.is_empty(), "no key, no Bibles");
        let ids: Vec<_> = keys.translations().into_iter().map(|t| t.id).collect();
        assert_eq!(ids, ["esv"]);
        assert!(is_online("esv") && is_online("apib:123") && !is_online("kjv"));
    }
}
