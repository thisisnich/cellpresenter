//! Where the Display window shows: in a normal window, or fullscreen on one
//! of the computer's screens (the projector or TV). The server only sees
//! this trait; the desktop app implements it with real windows, and tests
//! and headless servers have none.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// A screen attached to this computer.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Screen {
    /// Position in the system's list of screens; what `show_on` takes.
    pub index: u32,
    pub name: String,
    pub width: u32,
    pub height: u32,
    pub primary: bool,
}

/// The screens, and which one the Display window fills (None: it's a
/// normal window, or closed).
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Screens {
    pub screens: Vec<Screen>,
    pub output: Option<u32>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct OutputChoice {
    /// Screen index to fill, or null for a normal window.
    pub screen: Option<u32>,
}

pub trait Outputs: Send + Sync {
    fn screens(&self) -> Screens;
    /// Put the Display window fullscreen on `screen`, or back in a normal
    /// window. Opens the window again if it was closed.
    fn show_on(&self, screen: Option<u32>) -> Result<(), String>;
    /// Fullscreen on the screen the Display window is on, or back to a
    /// window if it's fullscreen already (the Display's F key).
    fn toggle_fullscreen(&self) -> Result<(), String> {
        Err("not supported".into())
    }
    /// Use this PNG as the app's icon (its windows, and the Dock on macOS),
    /// so the icon follows the console's colour palette.
    fn set_icon(&self, _png: Vec<u8>) -> Result<(), String> {
        Err("not supported".into())
    }
}
