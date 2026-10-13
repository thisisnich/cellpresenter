//! Updates: a newer release on GitHub, and installing it. The server only
//! sees this trait; the desktop app implements it with Tauri's updater
//! (which checks each update's signature), and tests and headless servers
//! have none.

use std::future::Future;
use std::pin::Pin;

use serde::Serialize;
use ts_rs::TS;

/// A newer release that can be installed.
#[derive(Clone, Debug, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct AvailableUpdate {
    pub version: String,
    /// The release notes, if the release has any.
    pub notes: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct UpdateStatus {
    /// This app's version.
    pub current: String,
    pub available: Option<AvailableUpdate>,
}

pub type Pending<T> = Pin<Box<dyn Future<Output = Result<T, String>> + Send>>;

pub trait Updater: Send + Sync {
    /// Ask GitHub whether a newer release is out.
    fn check(&self) -> Pending<Option<AvailableUpdate>>;
    /// Download and install the update `check` found, then restart the app.
    fn install(&self) -> Pending<()>;
}
