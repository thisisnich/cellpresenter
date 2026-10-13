//! Backups: the whole library — songs, setlists, settings and pictures — in
//! one `.cpbackup` file (a zip) in a folder people can find, by default
//! "CellPresenter Backups" in their Documents. Inside:
//!
//! - `backup.json`: what made it (app version, format).
//! - `library.db`: a consistent copy of the database.
//! - `media/` and `media/thumbs/`: the pictures, by content hash.
//!
//! Restoring brings a backup into the current library (see
//! `Db::merge_backup`), so it also moves a library to another computer.

use std::fs::File;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use ts_rs::TS;
use uuid::Uuid;
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};

use crate::db::{Db, RestoredCounts};
use crate::media::is_media_file_name;

const EXTENSION: &str = "cpbackup";
const FORMAT: u32 = 1;
/// Automatic backups kept; older ones are removed.
const KEEP_AUTO: usize = 7;
const AUTO_PREFIX: &str = "auto-";
/// An automatic backup is made when the newest one is older than this.
const AUTO_EVERY_MS: i64 = 20 * 60 * 60 * 1000;

/// A backup file in the backups folder.
#[derive(Clone, Debug, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct BackupInfo {
    pub name: String,
    #[ts(type = "number")]
    pub size: u64,
    /// When it was made (ms since 1970).
    #[ts(type = "number")]
    pub created_at: i64,
    /// Made automatically at start-up rather than by someone.
    pub auto: bool,
}

#[derive(Clone, Debug, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct BackupList {
    /// The folder the backups are in, to show people where to look.
    pub folder: String,
    pub backups: Vec<BackupInfo>,
}

#[derive(Serialize, Deserialize)]
struct Manifest {
    app: String,
    version: String,
    format: u32,
}

#[derive(Debug)]
pub enum BackupError {
    /// Not a CellPresenter backup, or one from a newer version.
    NotABackup,
    NotFound,
    Io(String),
    Db(String),
}

impl From<std::io::Error> for BackupError {
    fn from(e: std::io::Error) -> Self {
        Self::Io(e.to_string())
    }
}
impl From<zip::result::ZipError> for BackupError {
    fn from(e: zip::result::ZipError) -> Self {
        match e {
            zip::result::ZipError::Io(e) => Self::Io(e.to_string()),
            _ => Self::NotABackup,
        }
    }
}
impl From<sqlx::Error> for BackupError {
    fn from(e: sqlx::Error) -> Self {
        Self::Db(e.to_string())
    }
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// "2026-10-13-084512" (UTC) from ms since 1970: sorts by time, safe in file names.
fn stamp(ms: i64) -> String {
    let secs = ms.div_euclid(1000);
    let (days, rest) = (secs.div_euclid(86_400), secs.rem_euclid(86_400));
    // Civil date from days since 1970 (Howard Hinnant's algorithm).
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = yoe + era * 400 + i64::from(month <= 2);
    format!(
        "{year:04}-{month:02}-{day:02}-{:02}{:02}{:02}",
        rest / 3600,
        rest % 3600 / 60,
        rest % 60
    )
}

pub struct Backups {
    dir: PathBuf,
}

impl Backups {
    pub fn new(dir: PathBuf) -> std::io::Result<Self> {
        std::fs::create_dir_all(&dir)?;
        Ok(Self { dir })
    }

    pub fn folder(&self) -> &Path {
        &self.dir
    }

    /// Backups in the folder, newest first.
    pub fn list(&self) -> BackupList {
        let mut backups: Vec<BackupInfo> = std::fs::read_dir(&self.dir)
            .into_iter()
            .flatten()
            .flatten()
            .filter_map(|entry| {
                let name = entry.file_name().into_string().ok()?;
                if !valid_name(&name) {
                    return None;
                }
                let meta = entry.metadata().ok()?;
                let created_at = meta
                    .modified()
                    .ok()
                    .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                    .map(|d| d.as_millis() as i64)
                    .unwrap_or(0);
                Some(BackupInfo {
                    auto: name.starts_with(AUTO_PREFIX),
                    name,
                    size: meta.len(),
                    created_at,
                })
            })
            .collect();
        backups.sort_by_key(|b| std::cmp::Reverse(b.created_at));
        BackupList {
            folder: self.dir.display().to_string(),
            backups,
        }
    }

    /// A backup in the folder by name; None for anything else.
    pub fn path_of(&self, name: &str) -> Option<PathBuf> {
        let path = self.dir.join(name);
        (valid_name(name) && path.is_file()).then_some(path)
    }

    /// Back up the library and its pictures into a new file in the folder.
    pub async fn create(
        &self,
        db: &Db,
        media_dir: &Path,
        auto: bool,
    ) -> Result<BackupInfo, BackupError> {
        let name = format!(
            "{}cellpresenter-{}.{EXTENSION}",
            if auto { AUTO_PREFIX } else { "" },
            stamp(now_ms())
        );
        let work = self.dir.join(format!(".work-{}", Uuid::new_v4().simple()));
        std::fs::create_dir_all(&work)?;
        let db_copy = work.join("library.db");
        let result = async {
            db.copy_to(&db_copy).await?;
            let (dir, media_dir, name) = (self.dir.clone(), media_dir.to_path_buf(), name.clone());
            tokio::task::spawn_blocking(move || write_zip(&dir, &name, &db_copy, &media_dir))
                .await
                .map_err(|e| BackupError::Io(e.to_string()))?
        }
        .await;
        let _ = std::fs::remove_dir_all(&work);
        result?;
        if auto {
            self.prune_auto();
        }
        self.list()
            .backups
            .into_iter()
            .find(|b| b.name == name)
            .ok_or(BackupError::NotFound)
    }

    /// Make an automatic backup if the newest is older than a day or so
    /// (or there is none). Returns the new backup, if one was made.
    pub async fn auto_backup(
        &self,
        db: &Db,
        media_dir: &Path,
    ) -> Result<Option<BackupInfo>, BackupError> {
        let newest = self.list().backups.first().map(|b| b.created_at);
        if newest.is_some_and(|t| now_ms() - t < AUTO_EVERY_MS) {
            return Ok(None);
        }
        self.create(db, media_dir, true).await.map(Some)
    }

    fn prune_auto(&self) {
        for old in self
            .list()
            .backups
            .iter()
            .filter(|b| b.auto)
            .skip(KEEP_AUTO)
        {
            let _ = std::fs::remove_file(self.dir.join(&old.name));
        }
    }

    /// Bring a backup file (anywhere) into the library and its pictures into
    /// the media folder.
    pub async fn restore(
        &self,
        file: &Path,
        db: &Db,
        media_dir: &Path,
    ) -> Result<RestoredCounts, BackupError> {
        let work = self.dir.join(format!(".work-{}", Uuid::new_v4().simple()));
        std::fs::create_dir_all(&work)?;
        let result = async {
            let (file, media, work_db) = (
                file.to_path_buf(),
                media_dir.to_path_buf(),
                work.join("library.db"),
            );
            let extracted = work_db.clone();
            tokio::task::spawn_blocking(move || read_zip(&file, &extracted, &media))
                .await
                .map_err(|e| BackupError::Io(e.to_string()))??;
            // Opening runs this app's migrations, so an older backup's
            // tables match before they're merged.
            let backup = Db::open(&work_db).await?;
            backup.close().await;
            Ok(db.merge_backup(&work_db).await?)
        }
        .await;
        let _ = std::fs::remove_dir_all(&work);
        result
    }

    /// Where an uploaded backup is kept while it's restored.
    pub fn upload_path(&self) -> PathBuf {
        self.dir
            .join(format!(".upload-{}.{EXTENSION}", Uuid::new_v4().simple()))
    }
}

fn valid_name(name: &str) -> bool {
    name.ends_with(&format!(".{EXTENSION}"))
        && !name.starts_with('.')
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.' | ' ' | '(' | ')'))
}

fn write_zip(dir: &Path, name: &str, db_copy: &Path, media_dir: &Path) -> Result<(), BackupError> {
    let partial = dir.join(format!(".{name}.partial"));
    let mut zip = ZipWriter::new(File::create(&partial)?);
    let packed = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
    // Pictures are already compressed.
    let stored = SimpleFileOptions::default().compression_method(CompressionMethod::Stored);
    let manifest = Manifest {
        app: "CellPresenter".into(),
        version: env!("CARGO_PKG_VERSION").into(),
        format: FORMAT,
    };
    zip.start_file("backup.json", packed)?;
    zip.write_all(&serde_json::to_vec_pretty(&manifest).expect("manifest"))?;
    zip.start_file("library.db", packed)?;
    std::io::copy(&mut File::open(db_copy)?, &mut zip)?;
    for (folder, prefix) in [
        (media_dir.to_path_buf(), "media/"),
        (media_dir.join("thumbs"), "media/thumbs/"),
    ] {
        for entry in std::fs::read_dir(&folder).into_iter().flatten().flatten() {
            let file_name = entry.file_name();
            let Some(file_name) = file_name.to_str() else {
                continue;
            };
            if !is_media_file_name(file_name) || !entry.path().is_file() {
                continue;
            }
            zip.start_file(format!("{prefix}{file_name}"), stored)?;
            std::io::copy(&mut File::open(entry.path())?, &mut zip)?;
        }
    }
    zip.finish()?;
    std::fs::rename(&partial, dir.join(name))?;
    Ok(())
}

/// Check a backup, write its database to `db_out` and any pictures the media
/// folder doesn't have yet into it. Entries are matched by exact name, so a
/// crafted file can't write anywhere else.
fn read_zip(file: &Path, db_out: &Path, media_dir: &Path) -> Result<(), BackupError> {
    let mut zip = ZipArchive::new(File::open(file)?)?;
    let manifest: Manifest = {
        let mut entry = zip
            .by_name("backup.json")
            .map_err(|_| BackupError::NotABackup)?;
        let mut text = String::new();
        entry.read_to_string(&mut text)?;
        serde_json::from_str(&text).map_err(|_| BackupError::NotABackup)?
    };
    if manifest.app != "CellPresenter" || manifest.format > FORMAT {
        return Err(BackupError::NotABackup);
    }
    {
        let mut entry = zip
            .by_name("library.db")
            .map_err(|_| BackupError::NotABackup)?;
        std::io::copy(&mut entry, &mut File::create(db_out)?)?;
    }
    std::fs::create_dir_all(media_dir.join("thumbs"))?;
    for i in 0..zip.len() {
        let mut entry = zip.by_index(i)?;
        let name = entry.name().to_string();
        let target = if let Some(file) = name.strip_prefix("media/thumbs/") {
            is_media_file_name(file).then(|| media_dir.join("thumbs").join(file))
        } else if let Some(file) = name.strip_prefix("media/") {
            is_media_file_name(file).then(|| media_dir.join(file))
        } else {
            None
        };
        let Some(target) = target else { continue };
        if target.exists() {
            continue;
        }
        let tmp = target.with_extension("restoring");
        std::io::copy(&mut entry, &mut File::create(&tmp)?)?;
        std::fs::rename(tmp, target)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::seed::seed_if_empty;

    #[test]
    fn stamps_sort_and_read_as_dates() {
        assert_eq!(stamp(0), "1970-01-01-000000");
        assert_eq!(stamp(1_791_880_000_000), "2026-10-13-082640");
    }

    #[test]
    fn only_backup_names_are_accepted() {
        assert!(valid_name("cellpresenter-2026-10-13-084512.cpbackup"));
        assert!(valid_name("My backup (2).cpbackup"));
        assert!(!valid_name("../evil.cpbackup"));
        assert!(!valid_name(".upload-x.cpbackup"));
        assert!(!valid_name("library.db"));
    }

    fn temp_dir() -> PathBuf {
        let dir = std::env::temp_dir().join(format!("cp-backup-test-{}", Uuid::new_v4().simple()));
        std::fs::create_dir_all(dir.join("thumbs")).unwrap();
        dir
    }

    #[tokio::test]
    async fn a_backup_restores_into_another_library() {
        // This computer: the starter songs, one of them edited, and a picture.
        let (here_dir, media) = (temp_dir(), temp_dir());
        let here = Db::open(&here_dir.join("library.db")).await.unwrap();
        seed_if_empty(&here).await.unwrap();
        let ours: crate::song::SongInput =
            serde_json::from_value(serde_json::json!({ "title": "Our own song", "sections": [] }))
                .unwrap();
        here.create_song(&ours).await.unwrap();
        let picture = format!("{}.jpg", "a".repeat(64));
        std::fs::write(media.join(&picture), b"jpeg").unwrap();
        std::fs::write(media.join("not-media.txt"), b"skip").unwrap();

        let backups = Backups::new(temp_dir()).unwrap();
        let made = backups.create(&here, &media, false).await.unwrap();
        assert!(!made.auto && made.size > 0);
        assert_eq!(backups.list().backups.len(), 1);

        // Another computer: its own starter songs.
        let (there_dir, there_media) = (temp_dir(), temp_dir());
        let there = Db::open(&there_dir.join("library.db")).await.unwrap();
        seed_if_empty(&there).await.unwrap();
        let before = there.list_songs().await.unwrap().len();
        let path = backups.path_of(&made.name).unwrap();
        let counts = backups.restore(&path, &there, &there_media).await.unwrap();
        assert_eq!(counts.songs as usize, before + 1);

        let titles: Vec<String> = there
            .list_songs()
            .await
            .unwrap()
            .into_iter()
            .map(|s| s.title)
            .collect();
        // Untouched starter songs aren't doubled; our own song came across.
        assert_eq!(titles.len(), before + 1, "{titles:?}");
        assert!(titles.iter().any(|t| t == "Our own song"));
        assert!(there_media.join(&picture).exists());
        assert!(!there_media.join("not-media.txt").exists());

        // Restoring twice changes nothing.
        backups.restore(&path, &there, &there_media).await.unwrap();
        assert_eq!(there.list_songs().await.unwrap().len(), before + 1);
    }

    #[tokio::test]
    async fn other_files_are_refused() {
        let backups = Backups::new(temp_dir()).unwrap();
        let fake = backups.folder().join("fake.cpbackup");
        std::fs::write(&fake, b"not a zip").unwrap();
        let db = Db::in_memory().await.unwrap();
        let err = backups.restore(&fake, &db, &temp_dir()).await.unwrap_err();
        assert!(matches!(err, BackupError::NotABackup), "{err:?}");
    }

    #[tokio::test]
    async fn automatic_backups_are_daily_and_pruned() {
        let backups = Backups::new(temp_dir()).unwrap();
        let db = Db::open(&temp_dir().join("library.db")).await.unwrap();
        let media = temp_dir();
        assert!(backups.auto_backup(&db, &media).await.unwrap().is_some());
        // A fresh one exists, so not again today.
        assert!(backups.auto_backup(&db, &media).await.unwrap().is_none());
        for i in 0..KEEP_AUTO + 2 {
            std::fs::write(
                backups.folder().join(format!("auto-old-{i}.cpbackup")),
                b"x",
            )
            .unwrap();
        }
        backups.prune_auto();
        assert_eq!(
            backups.list().backups.iter().filter(|b| b.auto).count(),
            KEEP_AUTO
        );
    }
}
