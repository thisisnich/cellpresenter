use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// One slide of the song currently on air.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Slide {
    /// Section name as written in the song ("Verse 1", "Chorus", …).
    pub section: String,
    /// Lyric lines, separated by `\n`.
    pub text: String,
    /// Background cue: when this slide goes on screen, the background layer
    /// switches to this image. `None` leaves the background as it is.
    #[serde(default)]
    pub background: Option<String>,
    /// The stored song slide this came from (None for announcements), so the
    /// console can attach a background cue to it.
    #[serde(default)]
    pub slide_id: Option<String>,
}

/// Live presentation state. The server owns it; every client renders from it.
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct LiveState {
    /// Changes every time the server starts, so clients know to reset.
    pub session: String,
    /// Increases with every change in a session; clients drop anything older
    /// than what they already show.
    #[ts(type = "number")]
    pub version: u64,
    /// Library song on air, if any.
    pub song_id: Option<String>,
    /// The setlist being run, and which of its items is on air. Next on an
    /// item's last slide moves to the following item.
    pub setlist_id: Option<String>,
    pub item_id: Option<String>,
    /// Title of the song on air.
    pub title: String,
    pub slides: Vec<Slide>,
    /// Index of the currently shown slide within `slides`.
    pub slide_index: usize,
    /// Black-out toggle: display clients render nothing when false.
    pub visible: bool,
    /// "Clear text": the words are off screen until the next slide.
    pub text_hidden: bool,
    /// The background layer: an image URL shown behind the words. It stays
    /// across slides and songs until another image is cued or it's cleared.
    pub background: Option<String>,
    /// Operator's proportional lyric-size control. Part of the shared live
    /// state so every display scales identically.
    pub text_scale: f64,
}

/// Every change to live state, from any client. Local buttons, the phone
/// remote and (later) the cloud live room all send these same messages.
#[derive(Clone, Debug, PartialEq, Deserialize, TS)]
#[serde(tag = "type", rename_all = "snake_case")]
#[ts(export)]
pub enum Command {
    Next,
    Prev,
    /// Jump to the next / previous setlist item (handled by the server,
    /// which knows the setlist).
    NextItem,
    PrevItem,
    GoTo {
        index: usize,
    },
    ToggleVisible,
    SetVisible {
        visible: bool,
    },
    /// Take the words off screen until the next slide.
    ClearText,
    /// Empty the background layer.
    ClearBackground,
    SetTextScale {
        scale: f64,
    },
}

pub const TEXT_SCALE_MIN: f64 = 0.5;
pub const TEXT_SCALE_MAX: f64 = 2.0;

impl LiveState {
    pub fn new(session: String) -> Self {
        Self {
            session,
            visible: true,
            text_scale: 1.0,
            ..Self::default()
        }
    }

    /// Put slides on air, starting at `slide_index` (clamped). `song_id` is
    /// the library song they come from, if any (announcements have none).
    /// `cue` is the song's or announcement's own background: it takes over
    /// the background layer; without one the layer stays as it is.
    pub fn show(
        &mut self,
        song_id: Option<String>,
        title: String,
        slides: Vec<Slide>,
        slide_index: usize,
        cue: Option<String>,
    ) {
        self.slide_index = slide_index.min(slides.len().saturating_sub(1));
        self.song_id = song_id;
        self.title = title;
        self.slides = slides;
        if cue.is_some() {
            self.background = cue;
        }
        self.slide_changed();
    }

    /// A (possibly new) slide is on screen: its words come back, and its
    /// background cue, if any, takes over the background layer.
    fn slide_changed(&mut self) {
        self.text_hidden = false;
        if let Some(cue) = self
            .slides
            .get(self.slide_index)
            .and_then(|s| s.background.clone())
        {
            self.background = Some(cue);
        }
    }

    /// Apply one command. Invalid input (out-of-range index, NaN scale) is
    /// ignored rather than rejected, so a stale client can never wedge state.
    pub fn apply(&mut self, command: Command) {
        match command {
            Command::Next => self.step(1),
            Command::Prev => self.step(-1),
            Command::NextItem | Command::PrevItem => {}
            Command::GoTo { index } => {
                if index < self.slides.len() {
                    self.slide_index = index;
                    self.slide_changed();
                }
            }
            Command::ToggleVisible => self.visible = !self.visible,
            Command::SetVisible { visible } => self.visible = visible,
            Command::ClearText => self.text_hidden = true,
            Command::ClearBackground => self.background = None,
            Command::SetTextScale { scale } => {
                if scale.is_finite() {
                    self.text_scale = scale.clamp(TEXT_SCALE_MIN, TEXT_SCALE_MAX);
                }
            }
        }
    }

    /// Move by `delta` slides, stopping at the first and last slide (the
    /// projector should never jump from the end back to the start).
    fn step(&mut self, delta: isize) {
        let n = self.slides.len() as isize;
        if n > 0 {
            let to = (self.slide_index as isize + delta).clamp(0, n - 1) as usize;
            if to != self.slide_index {
                self.slide_index = to;
                self.slide_changed();
            }
        }
    }

    pub fn at_last_slide(&self) -> bool {
        self.slide_index + 1 >= self.slides.len()
    }

    pub fn at_first_slide(&self) -> bool {
        self.slide_index == 0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture() -> LiveState {
        let mut s = LiveState::new("test".into());
        let slides = (1..=4)
            .map(|i| Slide {
                section: format!("Verse {i}"),
                text: format!("line {i}"),
                background: None,
                slide_id: None,
            })
            .collect();
        s.show(Some("song".into()), "Song".into(), slides, 0, None);
        s
    }

    fn applied(commands: &[Command]) -> LiveState {
        let mut s = fixture();
        for c in commands {
            s.apply(c.clone());
        }
        s
    }

    #[test]
    fn next_and_prev_stop_at_the_ends() {
        let n = fixture().slides.len();
        assert_eq!(applied(&[Command::Prev]).slide_index, 0);
        assert_eq!(applied(&[Command::Next, Command::Next]).slide_index, 2);
        let mut s = fixture();
        for _ in 0..10 {
            s.apply(Command::Next);
        }
        assert_eq!(s.slide_index, n - 1);
        assert!(s.at_last_slide());
        assert!(fixture().at_first_slide());
    }

    #[test]
    fn stepping_an_empty_song_is_a_noop() {
        let mut s = LiveState::new("test".into());
        s.apply(Command::Next);
        assert_eq!(s.slide_index, 0);
    }

    #[test]
    fn go_to_ignores_out_of_range() {
        let s = applied(&[Command::GoTo { index: 2 }, Command::GoTo { index: 99 }]);
        assert_eq!(s.slide_index, 2);
    }

    #[test]
    fn visibility_toggles_and_sets() {
        assert!(!applied(&[Command::ToggleVisible]).visible);
        assert!(applied(&[Command::ToggleVisible, Command::ToggleVisible]).visible);
        assert!(!applied(&[Command::SetVisible { visible: false }]).visible);
    }

    #[test]
    fn text_scale_is_clamped_and_rejects_nan() {
        assert_eq!(
            applied(&[Command::SetTextScale { scale: 10.0 }]).text_scale,
            TEXT_SCALE_MAX
        );
        let s = applied(&[
            Command::SetTextScale { scale: 0.0 },
            Command::SetTextScale { scale: f64::NAN },
        ]);
        assert_eq!(s.text_scale, TEXT_SCALE_MIN);
    }

    #[test]
    fn show_song_clamps_the_start_slide() {
        let mut s = fixture();
        let slides = s.slides.clone();
        s.show(Some("b".into()), "B".into(), slides, 99, None);
        assert_eq!(s.slide_index, 3);
        assert_eq!(s.song_id.as_deref(), Some("b"));
        s.show(Some("c".into()), "C".into(), vec![], 5, None);
        assert_eq!(s.slide_index, 0);
    }

    fn cued(section: &str, cue: Option<&str>) -> Slide {
        Slide {
            section: section.into(),
            text: section.into(),
            background: cue.map(String::from),
            slide_id: None,
        }
    }

    #[test]
    fn background_layer_follows_cues_and_stays_without_them() {
        let mut s = LiveState::new("t".into());
        s.background = Some("/media/manual.jpg".into());
        let slides = vec![
            cued("A", None),
            cued("B", Some("/media/b.jpg")),
            cued("C", None),
        ];
        s.show(None, "Song".into(), slides, 0, None);
        // No cue on the first slide: the picture already showing stays.
        assert_eq!(s.background.as_deref(), Some("/media/manual.jpg"));
        s.apply(Command::Next);
        assert_eq!(s.background.as_deref(), Some("/media/b.jpg"));
        s.apply(Command::Next);
        assert_eq!(s.background.as_deref(), Some("/media/b.jpg"));
        s.apply(Command::ClearBackground);
        assert_eq!(s.background, None);
        s.apply(Command::GoTo { index: 1 });
        assert_eq!(s.background.as_deref(), Some("/media/b.jpg"));
    }

    #[test]
    fn clear_text_lasts_until_the_next_slide() {
        let mut s = fixture();
        s.apply(Command::ClearText);
        assert!(s.text_hidden);
        s.apply(Command::Prev); // already on the first slide: nothing changes
        assert!(s.text_hidden);
        s.apply(Command::Next);
        assert!(!s.text_hidden);
    }

    #[test]
    fn commands_parse_from_json() {
        let c: Command = serde_json::from_str(r#"{"type":"go_to","index":3}"#).unwrap();
        assert_eq!(c, Command::GoTo { index: 3 });
        let c: Command = serde_json::from_str(r#"{"type":"next"}"#).unwrap();
        assert_eq!(c, Command::Next);
        assert!(serde_json::from_str::<Command>(r#"{"type":"explode"}"#).is_err());
    }
}
