use serde::{Deserialize, Serialize};

/// One slide of the song currently on air.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Slide {
    /// Section name as written in the song ("Verse 1", "Chorus", …).
    pub section: String,
    /// Lyric lines, separated by `\n`.
    pub text: String,
}

/// Live presentation state. The server owns it; every client renders from it.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct LiveState {
    /// Title of the song on air. The song library replaces this demo content
    /// with a pointer to a stored song (R1 step 4).
    pub title: String,
    pub slides: Vec<Slide>,
    /// Index of the currently shown slide within `slides`.
    pub slide_index: usize,
    /// Black-out toggle: display clients render nothing when false.
    pub visible: bool,
    /// Operator's proportional lyric-size control. Part of the shared live
    /// state so every display scales identically.
    pub text_scale: f64,
}

/// Every change to live state, from any client. Local buttons, the phone
/// remote and (later) the cloud live room all send these same messages.
#[derive(Clone, Debug, PartialEq, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Command {
    Next,
    Prev,
    GoTo { index: usize },
    ToggleVisible,
    SetVisible { visible: bool },
    SetTextScale { scale: f64 },
}

pub const TEXT_SCALE_MIN: f64 = 0.5;
pub const TEXT_SCALE_MAX: f64 = 2.0;

fn slide(section: &str, text: &str) -> Slide {
    Slide {
        section: section.into(),
        text: text.into(),
    }
}

impl Default for LiveState {
    fn default() -> Self {
        // "It Is Well with My Soul", Horatio Spafford (1873), public domain.
        let chorus = "It is well with my soul,\nIt is well, it is well with my soul.";
        Self {
            title: "It Is Well".into(),
            slides: vec![
                slide(
                    "Verse 1",
                    "When peace like a river attendeth my way,\nWhen sorrows like sea billows roll;",
                ),
                slide(
                    "Verse 1",
                    "Whatever my lot, Thou hast taught me to say,\nIt is well, it is well with my soul.",
                ),
                slide("Chorus", chorus),
                slide(
                    "Verse 2",
                    "Though Satan should buffet, though trials should come,\nLet this blest assurance control,",
                ),
                slide(
                    "Verse 2",
                    "That Christ has regarded my helpless estate,\nAnd hath shed His own blood for my soul.",
                ),
                slide("Chorus", chorus),
                slide(
                    "Verse 3",
                    "My sin, oh, the bliss of this glorious thought!\nMy sin, not in part but the whole,",
                ),
                slide(
                    "Verse 3",
                    "Is nailed to the cross, and I bear it no more,\nPraise the Lord, praise the Lord, O my soul!",
                ),
                slide("Chorus", chorus),
            ],
            slide_index: 0,
            visible: true,
            text_scale: 1.0,
        }
    }
}

impl LiveState {
    /// Apply one command. Invalid input (out-of-range index, NaN scale) is
    /// ignored rather than rejected, so a stale client can never wedge state.
    pub fn apply(&mut self, command: Command) {
        match command {
            Command::Next => self.step(1),
            Command::Prev => self.step(-1),
            Command::GoTo { index } => {
                if index < self.slides.len() {
                    self.slide_index = index;
                }
            }
            Command::ToggleVisible => self.visible = !self.visible,
            Command::SetVisible { visible } => self.visible = visible,
            Command::SetTextScale { scale } => {
                if scale.is_finite() {
                    self.text_scale = scale.clamp(TEXT_SCALE_MIN, TEXT_SCALE_MAX);
                }
            }
        }
    }

    /// Move by `delta` slides, wrapping at both ends.
    fn step(&mut self, delta: isize) {
        let n = self.slides.len();
        if n > 0 {
            self.slide_index = (self.slide_index as isize + delta).rem_euclid(n as isize) as usize;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn applied(commands: &[Command]) -> LiveState {
        let mut s = LiveState::default();
        for c in commands {
            s.apply(c.clone());
        }
        s
    }

    #[test]
    fn next_and_prev_wrap_both_ways() {
        let n = LiveState::default().slides.len();
        assert_eq!(applied(&[Command::Prev]).slide_index, n - 1);
        assert_eq!(applied(&[Command::Prev, Command::Next]).slide_index, 0);
        assert_eq!(applied(&[Command::Next, Command::Next]).slide_index, 2);
    }

    #[test]
    fn stepping_an_empty_song_is_a_noop() {
        let mut s = LiveState {
            slides: vec![],
            ..LiveState::default()
        };
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
    fn commands_parse_from_json() {
        let c: Command = serde_json::from_str(r#"{"type":"go_to","index":3}"#).unwrap();
        assert_eq!(c, Command::GoTo { index: 3 });
        let c: Command = serde_json::from_str(r#"{"type":"next"}"#).unwrap();
        assert_eq!(c, Command::Next);
        assert!(serde_json::from_str::<Command>(r#"{"type":"explode"}"#).is_err());
    }
}
