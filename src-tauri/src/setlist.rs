//! Setlist types shared with the web app (exported to TypeScript by ts-rs).

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::bible::ScriptureRef;
use crate::live::Slide;

/// One entry in a setlist.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
#[serde(tag = "kind", rename_all = "snake_case")]
#[ts(export)]
pub enum SetlistItem {
    Song {
        id: String,
        song_id: String,
        /// Filled in from the library when read.
        title: String,
        key: Option<String>,
        /// The song was deleted from the library.
        missing: bool,
        /// The operator's note on this item, shown in the Notes panel.
        #[serde(default)]
        notes: String,
    },
    Announcement {
        id: String,
        title: String,
        /// Lines of text; a blank line starts a new slide.
        text: String,
        /// Background image (a media id); `None` uses the default.
        background_id: Option<String>,
        /// The operator's note on this item, shown in the Notes panel.
        #[serde(default)]
        notes: String,
    },
    Scripture {
        id: String,
        /// "kjv" or "web".
        translation: String,
        passage: ScriptureRef,
        /// "John 3:16–18", as it was when added.
        title: String,
        /// The operator's note on this item, shown in the Notes panel.
        #[serde(default)]
        notes: String,
    },
}

impl SetlistItem {
    pub fn id(&self) -> &str {
        match self {
            SetlistItem::Song { id, .. }
            | SetlistItem::Announcement { id, .. }
            | SetlistItem::Scripture { id, .. } => id,
        }
    }
}

impl SetlistItemInput {
    pub fn notes(&self) -> Option<&str> {
        match self {
            SetlistItemInput::Song { notes, .. }
            | SetlistItemInput::Announcement { notes, .. }
            | SetlistItemInput::Scripture { notes, .. } => notes.as_deref(),
        }
    }
}

/// How a scripture item is kept in a setlist row's `body`.
#[derive(Serialize, Deserialize)]
pub struct StoredScripture {
    pub translation: String,
    pub passage: ScriptureRef,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Setlist {
    pub id: String,
    pub name: String,
    pub service_date: Option<String>,
    pub items: Vec<SetlistItem>,
    #[ts(type = "number")]
    pub updated_at: i64,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct SetlistSummary {
    pub id: String,
    pub name: String,
    pub service_date: Option<String>,
    pub item_count: u32,
    #[ts(type = "number")]
    pub updated_at: i64,
}

/// An item as a client sends it. Ids are optional, as for songs.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
#[serde(tag = "kind", rename_all = "snake_case")]
#[ts(export)]
pub enum SetlistItemInput {
    Song {
        #[serde(default)]
        id: Option<String>,
        song_id: String,
        #[serde(default)]
        #[ts(optional)]
        notes: Option<String>,
    },
    Announcement {
        #[serde(default)]
        id: Option<String>,
        title: String,
        text: String,
        #[serde(default)]
        background_id: Option<String>,
        #[serde(default)]
        #[ts(optional)]
        notes: Option<String>,
    },
    Scripture {
        #[serde(default)]
        id: Option<String>,
        translation: String,
        passage: ScriptureRef,
        title: String,
        #[serde(default)]
        #[ts(optional)]
        notes: Option<String>,
    },
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct SetlistInput {
    pub name: String,
    #[serde(default)]
    pub service_date: Option<String>,
    #[serde(default)]
    pub items: Vec<SetlistItemInput>,
}

/// An announcement's slides: blank lines split slides.
pub fn announcement_slides(title: &str, text: &str) -> Vec<Slide> {
    let slides: Vec<Slide> = text
        .replace("\r\n", "\n")
        .split("\n\n")
        .map(|block| block.trim_matches('\n').trim_end())
        .filter(|block| !block.trim().is_empty())
        .map(|block| Slide {
            section: title.to_string(),
            text: block.to_string(),
            background: None,
            slide_id: None,
            section_id: None,
            section_cue: false,
        })
        .collect();
    if slides.is_empty() {
        vec![Slide {
            section: title.to_string(),
            text: title.to_string(),
            background: None,
            slide_id: None,
            section_id: None,
            section_cue: false,
        }]
    } else {
        slides
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn announcements_split_on_blank_lines_and_never_come_out_empty() {
        let slides = announcement_slides(
            "Potluck",
            "Potluck next Friday\nBring a dish\n\n\n7 pm at Sam's",
        );
        assert_eq!(slides.len(), 2);
        assert_eq!(slides[0].text, "Potluck next Friday\nBring a dish");
        assert_eq!(slides[1].section, "Potluck");
        assert_eq!(announcement_slides("Welcome", "  ")[0].text, "Welcome");
    }
}
