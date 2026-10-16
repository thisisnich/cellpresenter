//! On Linux the taskbar and the app menu show the icon named by the app's
//! `.desktop` entry, never the window's own icon. So when the console's
//! palette recolours the app icon, write it where those entries look: the
//! user's own icon theme (which wins over the system one) and any icon file
//! in the user's home that a CellPresenter entry points at (AppImage
//! launchers do this).

use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::SystemTime;

use image::{imageops::FilterType, RgbaImage};

const SIZES: [u32; 6] = [32, 48, 64, 128, 256, 512];
/// The icon name the installed packages use.
const NAME: &str = "cellpresenter";

pub fn update(icon: &RgbaImage) {
    let Some(home) = std::env::var_os("HOME").map(PathBuf::from) else {
        return;
    };
    let data_home = std::env::var_os("XDG_DATA_HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|| home.join(".local/share"));
    let data_dirs =
        std::env::var("XDG_DATA_DIRS").unwrap_or_else(|_| "/usr/local/share:/usr/share".into());

    let mut names = vec![NAME.to_string()];
    let mut files = Vec::new();
    let dirs = std::iter::once(data_home.clone()).chain(
        data_dirs
            .split(':')
            .filter(|d| !d.is_empty())
            .map(PathBuf::from),
    );
    for dir in dirs {
        let Ok(entries) = std::fs::read_dir(dir.join("applications")) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().is_none_or(|e| e != "desktop") {
                continue;
            }
            let Ok(text) = std::fs::read_to_string(&path) else {
                continue;
            };
            if !is_ours(&text) {
                continue;
            }
            match field(&text, "Icon") {
                Some(icon) if icon.starts_with('/') => files.push(PathBuf::from(icon)),
                Some(icon) if !names.iter().any(|n| n == icon) => names.push(icon.to_string()),
                _ => {}
            }
        }
    }

    let hicolor = data_home.join("icons/hicolor");
    for size in SIZES {
        let scaled = image::imageops::resize(icon, size, size, FilterType::Lanczos3);
        let dir = hicolor.join(format!("{size}x{size}/apps"));
        if std::fs::create_dir_all(&dir).is_err() {
            continue;
        }
        for name in &names {
            save(&scaled, &dir.join(format!("{name}.png")));
        }
    }
    // Only icon files the user owns; a system package's icon stays as it is.
    let large = image::imageops::resize(icon, 256, 256, FilterType::Lanczos3);
    for file in files.iter().filter(|f| f.starts_with(&home) && f.is_file()) {
        save(&large, file);
    }

    // Tell icon caches something changed: GTK looks at the theme folder's
    // modified time, KDE rebuilds its menu cache.
    if let Ok(dir) = std::fs::File::open(&hicolor) {
        let _ = dir.set_modified(SystemTime::now());
    }
    let _ = crate::host::command("kbuildsycoca6")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn();
}

fn save(image: &RgbaImage, path: &Path) {
    // Write beside it, then swap, so nothing ever reads half an icon.
    let tmp = path.with_extension("cellpresenter-tmp");
    let saved = image
        .save_with_format(&tmp, image::ImageFormat::Png)
        .map_err(|e| e.to_string())
        .and_then(|_| std::fs::rename(&tmp, path).map_err(|e| e.to_string()));
    if let Err(e) = saved {
        let _ = std::fs::remove_file(&tmp);
        eprintln!(
            "cellpresenter: can't write the icon {}: {e}",
            path.display()
        );
    }
}

/// Whether a `.desktop` entry launches CellPresenter.
fn is_ours(text: &str) -> bool {
    let lower = |key| field(text, key).map(str::to_lowercase);
    lower("StartupWMClass").as_deref() == Some(NAME)
        || lower("Name").as_deref() == Some("cellpresenter")
        || lower("Exec").is_some_and(|e| e.contains(NAME))
}

/// A key's value in the `[Desktop Entry]` group (not a translated one).
fn field<'a>(text: &'a str, key: &str) -> Option<&'a str> {
    let mut in_entry = false;
    for line in text.lines().map(str::trim) {
        if line.starts_with('[') {
            in_entry = line == "[Desktop Entry]";
        } else if in_entry {
            if let Some((k, v)) = line.split_once('=') {
                if k.trim() == key {
                    return Some(v.trim());
                }
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    const APPIMAGE: &str = "[Desktop Entry]\nType=Application\nName=CellPresenter\nName[de]=Zellen\nIcon=/home/me/AppImages/.icons/cellpresenter\nExec=env DESKTOPINTEGRATION=1 /home/me/AppImages/cellpresenter.appimage\nStartupWMClass=cellpresenter\n\n[Desktop Action New]\nIcon=other\n";

    #[test]
    fn reads_the_desktop_entry_group_only() {
        assert_eq!(
            field(APPIMAGE, "Icon"),
            Some("/home/me/AppImages/.icons/cellpresenter")
        );
        assert_eq!(field(APPIMAGE, "Name"), Some("CellPresenter"));
        assert_eq!(field(APPIMAGE, "Comment"), None);
    }

    #[test]
    fn knows_its_own_entries() {
        assert!(is_ours(APPIMAGE));
        assert!(is_ours(
            "[Desktop Entry]\nName=Cell Group App\nExec=/usr/bin/cellpresenter\n"
        ));
        assert!(!is_ours(
            "[Desktop Entry]\nName=Obsidian\nExec=/usr/bin/obsidian\nIcon=obsidian\n"
        ));
    }
}
