//! Starting other programs on this computer: the browser, the file manager,
//! KDE's menu cache.
//!
//! An AppImage runs with its own copies of GTK, GStreamer and friends, and
//! points `LD_LIBRARY_PATH` and a dozen other variables into its mount
//! (`/tmp/.mount_…`). A browser started with those loads the wrong
//! libraries and quietly fails to open, so programs we start get the
//! variables without anything from inside an AppImage.

use std::ffi::OsString;
use std::process::{Command, Stdio};

/// A command for another program, with a clean environment.
pub fn command(program: &str) -> Command {
    let mut cmd = Command::new(program);
    for (key, value) in foreign_env() {
        match value {
            Some(v) => cmd.env(key, v),
            None => cmd.env_remove(key),
        };
    }
    cmd
}

/// Open a web page or folder with the computer's own app for it.
pub fn open(target: impl AsRef<std::ffi::OsStr>) -> std::io::Result<()> {
    let target = target.as_ref();
    if foreign_env().is_empty() {
        return open::that_detached(target);
    }
    // Inside an AppImage (only ever on Linux).
    let mut child = command("xdg-open")
        .arg(target)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()?;
    std::thread::spawn(move || match child.wait() {
        Ok(status) if !status.success() => eprintln!("cellpresenter: xdg-open failed: {status}"),
        Err(e) => eprintln!("cellpresenter: xdg-open failed: {e}"),
        _ => {}
    });
    Ok(())
}

/// Variables to change for a program we start: a new value, or `None` to
/// unset it. Empty unless running from an AppImage.
fn foreign_env() -> Vec<(OsString, Option<String>)> {
    let Some(appdir) = std::env::var("APPDIR").ok().filter(|d| !d.is_empty()) else {
        return Vec::new();
    };
    let mut changes: Vec<_> = std::env::vars()
        .filter(|(_, v)| is_inside(v, &appdir))
        .map(|(k, v)| (OsString::from(k), without_appimage(&v, &appdir)))
        .collect();
    // The AppImage's GTK hook forces X11; the browser should pick for itself.
    for key in ["APPDIR", "APPIMAGE", "ARGV0", "OWD", "GDK_BACKEND"] {
        changes.push((key.into(), None));
    }
    changes
}

fn is_inside(value: &str, appdir: &str) -> bool {
    value.contains(appdir) || value.contains("/.mount_")
}

/// A path list with the AppImage's entries taken out; `None` if nothing is
/// left. A single path inside the AppImage is dropped the same way.
fn without_appimage(value: &str, appdir: &str) -> Option<String> {
    let kept: Vec<&str> = value
        .split(':')
        .filter(|p| !p.is_empty() && !is_inside(p, appdir))
        .collect();
    (!kept.is_empty()).then(|| kept.join(":"))
}

#[cfg(test)]
mod tests {
    use super::*;

    const APPDIR: &str = "/tmp/.mount_cellprNMdAId";

    #[test]
    fn keeps_the_systems_own_paths() {
        assert_eq!(
            without_appimage(
                "/tmp/.mount_cellprNMdAId/usr/share/:/usr/share:/tmp/.mount_cellprMOaJFb/usr/share/",
                APPDIR
            ),
            Some("/usr/share".to_string())
        );
    }

    #[test]
    fn drops_what_only_points_inside() {
        assert_eq!(
            without_appimage(
                "/tmp/.mount_cellprNMdAId/usr/lib/:/tmp/.mount_old/usr/lib",
                APPDIR
            ),
            None
        );
        assert_eq!(
            without_appimage(
                "/tmp/.mount_cellprNMdAId//usr/lib/gtk-3.0/3.0.0/immodules.cache",
                APPDIR
            ),
            None
        );
    }
}
