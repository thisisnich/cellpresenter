use serde::{Deserialize, Serialize};

/// Live presentation state. The server owns it; every client renders from it.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct LiveState {
    /// Index of the currently shown slide within `slides`.
    pub slide_index: usize,
    /// Demo presentation. The song library replaces this with a real lookup.
    pub slides: Vec<String>,
    /// Black-out toggle: display clients render nothing when false.
    pub visible: bool,
    /// Operator's proportional lyric-size control. Part of the shared live
    /// state so every display scales identically.
    pub text_scale: f64,
}

pub const TEXT_SCALE_MIN: f64 = 0.5;
pub const TEXT_SCALE_MAX: f64 = 2.0;

impl Default for LiveState {
    fn default() -> Self {
        Self {
            slide_index: 0,
            slides: vec![
                "Amazing Grace".into(),
                "Verse 1 — Amazing grace, how sweet the sound…".into(),
                "Chorus — Amazing grace! how sweet the sound".into(),
                "Verse 2 — 'Twas grace that taught my heart to fear…".into(),
            ],
            visible: true,
            text_scale: 1.0,
        }
    }
}

impl LiveState {
    /// Move by `delta` slides, wrapping at both ends.
    pub fn step(&mut self, delta: isize) {
        let n = self.slides.len();
        if n > 0 {
            self.slide_index = (self.slide_index as isize + delta).rem_euclid(n as isize) as usize;
        }
    }

    /// Jump to `index`; out-of-range indexes are ignored.
    pub fn go_to(&mut self, index: usize) {
        if index < self.slides.len() {
            self.slide_index = index;
        }
    }

    pub fn toggle_visible(&mut self) {
        self.visible = !self.visible;
    }

    pub fn set_text_scale(&mut self, scale: f64) {
        if scale.is_finite() {
            self.text_scale = scale.clamp(TEXT_SCALE_MIN, TEXT_SCALE_MAX);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn step_wraps_both_ways() {
        let mut s = LiveState::default();
        let n = s.slides.len();
        s.step(-1);
        assert_eq!(s.slide_index, n - 1);
        s.step(1);
        assert_eq!(s.slide_index, 0);
        s.step(n as isize + 2);
        assert_eq!(s.slide_index, 2);
    }

    #[test]
    fn step_on_empty_is_noop() {
        let mut s = LiveState {
            slides: vec![],
            ..LiveState::default()
        };
        s.step(1);
        assert_eq!(s.slide_index, 0);
    }

    #[test]
    fn go_to_ignores_out_of_range() {
        let mut s = LiveState::default();
        s.go_to(2);
        assert_eq!(s.slide_index, 2);
        s.go_to(99);
        assert_eq!(s.slide_index, 2);
    }

    #[test]
    fn text_scale_is_clamped_and_rejects_nan() {
        let mut s = LiveState::default();
        s.set_text_scale(10.0);
        assert_eq!(s.text_scale, TEXT_SCALE_MAX);
        s.set_text_scale(0.0);
        assert_eq!(s.text_scale, TEXT_SCALE_MIN);
        s.set_text_scale(f64::NAN);
        assert_eq!(s.text_scale, TEXT_SCALE_MIN);
    }
}
