//! Song types shared with the web app (exported to TypeScript by ts-rs).

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::live::{Credits, Slide};

/// A chord placed above a lyric line, anchored to a character index.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct ChordMark {
    pub at: u32,
    pub chord: String,
}

/// One explicit lyric line. Slides are never auto-wrapped: each line is
/// shown as written, which keeps every screen identical.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct LyricLine {
    pub text: String,
    #[serde(default)]
    pub chords: Vec<ChordMark>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct SongSlide {
    pub id: String,
    pub lines: Vec<LyricLine>,
    /// Background cue (a media id): when this slide goes on screen the
    /// background layer switches to it.
    pub background_id: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct SongSection {
    pub id: String,
    pub name: String,
    /// Background cue (a media id) for every slide in the section that has
    /// no cue of its own.
    pub background_id: Option<String>,
    pub slides: Vec<SongSlide>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Song {
    pub id: String,
    pub title: String,
    pub artist: Option<String>,
    pub key: Option<String>,
    pub capo: u8,
    pub ccli_number: Option<String>,
    pub copyright: Option<String>,
    /// Section ids in play order; `None` plays sections in order.
    pub arrangement: Option<Vec<String>>,
    pub sections: Vec<SongSection>,
    #[ts(type = "number")]
    pub updated_at: i64,
}

/// A row in the song list.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct SongSummary {
    pub id: String,
    pub title: String,
    pub artist: Option<String>,
    pub key: Option<String>,
    #[ts(type = "number")]
    pub updated_at: i64,
}

/// What a client sends to create or replace a song. Ids are optional:
/// clients may generate them (useful offline), otherwise the server does.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct SongInput {
    pub title: String,
    #[serde(default)]
    pub artist: Option<String>,
    #[serde(default)]
    pub key: Option<String>,
    #[serde(default)]
    pub capo: u8,
    #[serde(default)]
    pub ccli_number: Option<String>,
    #[serde(default)]
    pub copyright: Option<String>,
    #[serde(default)]
    pub arrangement: Option<Vec<String>>,
    pub sections: Vec<SectionInput>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct SectionInput {
    #[serde(default)]
    pub id: Option<String>,
    pub name: String,
    #[serde(default)]
    pub background_id: Option<String>,
    pub slides: Vec<SlideInput>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct SlideInput {
    #[serde(default)]
    pub id: Option<String>,
    pub lines: Vec<LyricLine>,
    #[serde(default)]
    pub background_id: Option<String>,
}

impl Song {
    /// Sections in play order: the arrangement if it names any known section,
    /// otherwise the sections as stored.
    pub fn played_sections(&self) -> Vec<&SongSection> {
        if let Some(order) = &self.arrangement {
            let played: Vec<&SongSection> = order
                .iter()
                .filter_map(|id| self.sections.iter().find(|s| &s.id == id))
                .collect();
            if !played.is_empty() {
                return played;
            }
        }
        self.sections.iter().collect()
    }

    /// The copyright details shown with the song.
    pub fn credits(&self) -> Credits {
        Credits {
            title: self.title.clone(),
            artist: self.artist.clone(),
            copyright: self.copyright.clone(),
            ccli_number: self.ccli_number.clone(),
            translation: None,
        }
    }

    /// The slides a display shows for this song, in play order. A slide's
    /// background cue is its own, else its section's; `url_of` turns that
    /// media id into an image URL.
    pub fn live_slides(&self, url_of: impl Fn(&str) -> Option<String>) -> Vec<Slide> {
        self.played_sections()
            .into_iter()
            .flat_map(|section| {
                section.slides.iter().map(|slide| Slide {
                    background: slide
                        .background_id
                        .as_deref()
                        .or(section.background_id.as_deref())
                        .and_then(&url_of),
                    section_cue: slide.background_id.is_none() && section.background_id.is_some(),
                    slide_id: Some(slide.id.clone()),
                    section_id: Some(section.id.clone()),
                    section: section.name.clone(),
                    text: slide
                        .lines
                        .iter()
                        .map(|l| l.text.as_str())
                        .collect::<Vec<_>>()
                        .join("\n"),
                })
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn line(text: &str) -> LyricLine {
        LyricLine {
            text: text.into(),
            chords: vec![],
        }
    }

    fn section(id: &str, name: &str, slides: &[&[&str]]) -> SongSection {
        SongSection {
            id: id.into(),
            name: name.into(),
            background_id: None,
            slides: slides
                .iter()
                .enumerate()
                .map(|(i, lines)| SongSlide {
                    id: format!("{id}-{i}"),
                    lines: lines.iter().map(|l| line(l)).collect(),
                    background_id: None,
                })
                .collect(),
        }
    }

    fn song(arrangement: Option<Vec<&str>>) -> Song {
        Song {
            id: "s".into(),
            title: "T".into(),
            artist: None,
            key: None,
            capo: 0,
            ccli_number: None,
            copyright: None,
            arrangement: arrangement.map(|a| a.into_iter().map(String::from).collect()),
            sections: vec![
                section("v1", "Verse 1", &[&["a", "b"]]),
                section("c", "Chorus", &[&["c"]]),
            ],
            updated_at: 0,
        }
    }

    #[test]
    fn live_slides_follow_section_order_without_arrangement() {
        let slides = song(None).live_slides(|_| None);
        assert_eq!(slides.len(), 2);
        assert_eq!(slides[0].text, "a\nb");
        assert_eq!(slides[1].section, "Chorus");
    }

    #[test]
    fn arrangement_repeats_sections_and_skips_unknown_ids() {
        let slides = song(Some(vec!["v1", "c", "nope", "c"])).live_slides(|_| None);
        let sections: Vec<_> = slides.iter().map(|s| s.section.as_str()).collect();
        assert_eq!(sections, ["Verse 1", "Chorus", "Chorus"]);
    }

    #[test]
    fn an_arrangement_of_only_unknown_ids_falls_back_to_order() {
        assert_eq!(song(Some(vec!["gone"])).live_slides(|_| None).len(), 2);
    }

    #[test]
    fn a_slide_cue_beats_its_section_background() {
        let mut s = song(None);
        s.sections[0].background_id = Some("hills".into());
        s.sections[0].slides.push(SongSlide {
            id: "own".into(),
            lines: vec![line("d")],
            background_id: Some("sea".into()),
        });
        let url = |id: &str| Some(format!("/media/{id}.jpg"));
        let backgrounds: Vec<_> = s
            .live_slides(url)
            .into_iter()
            .map(|s| s.background)
            .collect();
        assert_eq!(
            backgrounds,
            [
                Some("/media/hills.jpg".into()),
                Some("/media/sea.jpg".into()),
                None
            ]
        );
        let slides = s.live_slides(url);
        assert!(slides[0].section_cue);
        assert!(!slides[1].section_cue);
        assert_eq!(slides[0].section_id.as_deref(), Some("v1"));
    }
}
