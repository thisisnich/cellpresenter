//! SQLite song library. All writes stamp `updated_at`; deletes are soft.

use std::collections::{HashMap, HashSet};
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;
use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePool, SqlitePoolOptions};
use sqlx::{FromRow, Sqlite, Transaction};
use ts_rs::TS;
use uuid::Uuid;

use crate::media::{image_url, thumb_url, Media};
use crate::setlist::{
    Setlist, SetlistInput, SetlistItem, SetlistItemInput, SetlistSummary, StoredScripture,
};
use crate::song::{LyricLine, SectionInput, Song, SongInput, SongSection, SongSlide, SongSummary};

pub type DbResult<T> = Result<T, sqlx::Error>;

/// Something in the recycle bin.
#[derive(Clone, Debug, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct Deleted {
    pub id: String,
    pub title: String,
    /// The artist of a song, the date of a setlist.
    pub detail: Option<String>,
    #[ts(type = "number")]
    pub deleted_at: i64,
}

#[derive(Clone, Debug, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct RecycleBin {
    pub songs: Vec<Deleted>,
    pub setlists: Vec<Deleted>,
}

#[derive(Clone, Copy)]
enum Undeletable {
    Song,
    Setlist,
}

/// What a restore brought back.
#[derive(Clone, Debug, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct RestoredCounts {
    pub songs: u32,
    pub setlists: u32,
    pub pictures: u32,
}

pub fn new_id() -> String {
    Uuid::now_v7().to_string()
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn decode_err(e: serde_json::Error) -> sqlx::Error {
    sqlx::Error::Decode(Box::new(e))
}

/// A client-supplied id is used only if it looks sane; otherwise we mint one.
fn usable_id(id: &Option<String>) -> Option<&str> {
    id.as_deref().filter(|s| {
        !s.is_empty() && s.len() <= 64 && s.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
    })
}

#[derive(Clone)]
pub struct Db {
    pool: SqlitePool,
    library_id: String,
}

#[derive(FromRow)]
struct SongRow {
    id: String,
    title: String,
    artist: Option<String>,
    song_key: Option<String>,
    capo: i64,
    ccli_number: Option<String>,
    copyright: Option<String>,
    arrangement: Option<String>,
    updated_at: i64,
}

#[derive(FromRow)]
struct SectionRow {
    id: String,
    name: String,
    background_id: Option<String>,
}

#[derive(FromRow)]
struct SlideRow {
    id: String,
    section_id: String,
    lines: String,
    background_id: Option<String>,
}

impl Db {
    /// Open (creating if needed) the library database file and migrate it.
    pub async fn open(path: &Path) -> DbResult<Self> {
        let options = SqliteConnectOptions::new()
            .filename(path)
            .create_if_missing(true)
            .journal_mode(SqliteJournalMode::Wal)
            .foreign_keys(true);
        let pool = SqlitePoolOptions::new()
            .max_connections(4)
            .connect_with(options)
            .await?;
        Self::init(pool).await
    }

    /// A private in-memory database, for tests.
    #[cfg(test)]
    pub async fn in_memory() -> DbResult<Self> {
        let options = <SqliteConnectOptions as std::str::FromStr>::from_str("sqlite::memory:")?
            .foreign_keys(true);
        // One connection: each in-memory connection is its own database.
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect_with(options)
            .await?;
        Self::init(pool).await
    }

    async fn init(pool: SqlitePool) -> DbResult<Self> {
        sqlx::migrate!("./migrations").run(&pool).await?;
        let library_id = Self::ensure_library(&pool).await?;
        Ok(Self { pool, library_id })
    }

    async fn ensure_library(pool: &SqlitePool) -> DbResult<String> {
        let existing: Option<(String,)> = sqlx::query_as(
            "SELECT id FROM libraries WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1",
        )
        .fetch_optional(pool)
        .await?;
        if let Some((id,)) = existing {
            return Ok(id);
        }
        let id = new_id();
        let now = now_ms();
        sqlx::query("INSERT INTO libraries (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)")
            .bind(&id)
            .bind("My library")
            .bind(now)
            .bind(now)
            .execute(pool)
            .await?;
        Ok(id)
    }

    /// True if this library has never had a song (deleted ones count, so
    /// deleting every seed song doesn't bring them back).
    pub async fn is_empty(&self) -> DbResult<bool> {
        let (count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM songs WHERE library_id = ?")
            .bind(&self.library_id)
            .fetch_one(&self.pool)
            .await?;
        Ok(count == 0)
    }

    /// Read an app-wide value saved with `set_state`.
    pub async fn get_state(&self, key: &str) -> DbResult<Option<String>> {
        let row: Option<(String,)> = sqlx::query_as("SELECT value FROM app_state WHERE key = ?")
            .bind(key)
            .fetch_optional(&self.pool)
            .await?;
        Ok(row.map(|(v,)| v))
    }

    pub async fn set_state(&self, key: &str, value: &str) -> DbResult<()> {
        sqlx::query(
            "INSERT INTO app_state (key, value, updated_at) VALUES (?, ?, ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
        )
        .bind(key)
        .bind(value)
        .bind(now_ms())
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    // ---------- backups ----------

    /// Write a consistent copy of the whole database to `path` (which must
    /// not exist yet), even while the app is using it.
    pub async fn copy_to(&self, path: &Path) -> DbResult<()> {
        sqlx::query("VACUUM INTO ?")
            .bind(path.to_string_lossy().into_owned())
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    /// Close the database (e.g. a backup opened to bring it up to date).
    pub async fn close(self) {
        self.pool.close().await;
    }

    /// Bring everything in the backup database at `path` into this library:
    /// songs, setlists and pictures it has are added or replaced (the
    /// backup's copy wins); anything added here since is kept. The backup
    /// must already be migrated to this app's schema (open it with `open`).
    pub async fn merge_backup(&self, path: &Path) -> DbResult<RestoredCounts> {
        let mut conn = self.pool.acquire().await?;
        sqlx::query("ATTACH DATABASE ? AS backup")
            .bind(path.to_string_lossy().into_owned())
            .execute(&mut *conn)
            .await?;
        let merged = Self::merge_attached(&mut conn, &self.library_id).await;
        // Detach even if the merge failed, so the connection is clean.
        let detached = sqlx::query("DETACH DATABASE backup")
            .execute(&mut *conn)
            .await;
        let counts = merged?;
        detached?;
        Ok(counts)
    }

    async fn merge_attached(
        conn: &mut sqlx::SqliteConnection,
        library_id: &str,
    ) -> DbResult<RestoredCounts> {
        let count = |sql: &'static str| sqlx::query_as::<_, (i64,)>(sql);
        let songs = count("SELECT COUNT(*) FROM backup.songs WHERE deleted_at IS NULL")
            .fetch_one(&mut *conn)
            .await?
            .0;
        let setlists = count("SELECT COUNT(*) FROM backup.setlists WHERE deleted_at IS NULL")
            .fetch_one(&mut *conn)
            .await?
            .0;
        let pictures = count("SELECT COUNT(*) FROM backup.media WHERE deleted_at IS NULL")
            .fetch_one(&mut *conn)
            .await?
            .0;

        let mut tx = sqlx::Connection::begin(&mut *conn).await?;
        // A new computer starts with the starter hymns; drop the untouched
        // ones the backup has its own copy of, so they don't appear twice.
        let now = now_ms();
        sqlx::query(
            "UPDATE main.songs SET deleted_at = ?, updated_at = ?
             WHERE library_id = ? AND deleted_at IS NULL AND created_at = updated_at
               AND id NOT IN (SELECT id FROM backup.songs)
               AND lower(title) IN (SELECT lower(title) FROM backup.songs WHERE deleted_at IS NULL)",
        )
        .bind(now)
        .bind(now)
        .bind(library_id)
        .execute(&mut *tx)
        .await?;
        // A song or setlist in the backup comes back exactly as it was, so
        // parts added here since (a new verse, another item) go.
        for sql in [
            "DELETE FROM main.slides WHERE song_id IN (SELECT id FROM backup.songs)",
            "DELETE FROM main.sections WHERE song_id IN (SELECT id FROM backup.songs)",
            "DELETE FROM main.setlist_items WHERE setlist_id IN (SELECT id FROM backup.setlists)",
        ] {
            sqlx::query(sql).execute(&mut *tx).await?;
        }
        // Parents before children, so every reference already exists.
        for table in [
            "media",
            "songs",
            "sections",
            "slides",
            "setlists",
            "setlist_items",
        ] {
            let columns: Vec<(String,)> = sqlx::query_as("SELECT name FROM pragma_table_info(?)")
                .bind(table)
                .fetch_all(&mut *tx)
                .await?;
            let names: Vec<&str> = columns.iter().map(|(c,)| c.as_str()).collect();
            // Rows join this library, whichever library they were backed up from.
            let select: Vec<String> = names
                .iter()
                .map(|c| {
                    if *c == "library_id" {
                        "?".into()
                    } else {
                        format!("\"{c}\"")
                    }
                })
                .collect();
            let update: Vec<String> = names
                .iter()
                .filter(|c| **c != "id")
                .map(|c| format!("\"{c}\" = excluded.\"{c}\""))
                .collect();
            let sql =
                format!(
                "INSERT INTO main.{table} ({cols}) SELECT {select} FROM backup.{table} WHERE true
                 ON CONFLICT(id) DO UPDATE SET {update}",
                cols = names.iter().map(|c| format!("\"{c}\"")).collect::<Vec<_>>().join(", "),
                select = select.join(", "),
                update = update.join(", "),
            );
            // Safe: table names are the fixed list above, column names come
            // from the schema itself.
            sqlx::query(sqlx::AssertSqlSafe(sql))
                .bind(library_id)
                .execute(&mut *tx)
                .await?;
        }
        // The screens' look comes back too; what was on air doesn't.
        sqlx::query(
            "INSERT INTO main.app_state (key, value, updated_at)
             SELECT key, value, updated_at FROM backup.app_state WHERE key = 'look'
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
        )
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(RestoredCounts {
            songs: songs as u32,
            setlists: setlists as u32,
            pictures: pictures as u32,
        })
    }

    // ---------- scripture cache ----------

    /// A passage fetched before, by key (translation and reference).
    pub async fn cached_passage(&self, key: &str) -> DbResult<Option<String>> {
        let row: Option<(String,)> =
            sqlx::query_as("SELECT passage FROM scripture_cache WHERE key = ?")
                .bind(key)
                .fetch_optional(&self.pool)
                .await?;
        Ok(row.map(|(p,)| p))
    }

    /// Keep a fetched passage; ones not fetched for 90 days are let go.
    pub async fn cache_passage(&self, key: &str, passage: &str) -> DbResult<()> {
        let now = now_ms();
        sqlx::query(
            "INSERT INTO scripture_cache (key, passage, fetched_at) VALUES (?, ?, ?)
             ON CONFLICT(key) DO UPDATE SET passage = excluded.passage, fetched_at = excluded.fetched_at",
        )
        .bind(key)
        .bind(passage)
        .bind(now)
        .execute(&self.pool)
        .await?;
        sqlx::query("DELETE FROM scripture_cache WHERE fetched_at < ?")
            .bind(now - 90 * 24 * 60 * 60 * 1000)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    // ---------- recycle bin ----------

    /// Deleted songs and setlists, most recently deleted first.
    pub async fn recycle_bin(&self) -> DbResult<RecycleBin> {
        let songs: Vec<(String, String, Option<String>, i64)> = sqlx::query_as(
            "SELECT id, title, artist, deleted_at FROM songs
             WHERE library_id = ? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT 500",
        )
        .bind(&self.library_id)
        .fetch_all(&self.pool)
        .await?;
        let setlists: Vec<(String, String, Option<String>, i64)> = sqlx::query_as(
            "SELECT id, name, service_date, deleted_at FROM setlists
             WHERE library_id = ? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT 500",
        )
        .bind(&self.library_id)
        .fetch_all(&self.pool)
        .await?;
        let deleted = |rows: Vec<(String, String, Option<String>, i64)>| {
            rows.into_iter()
                .map(|(id, title, detail, deleted_at)| Deleted {
                    id,
                    title,
                    detail,
                    deleted_at,
                })
                .collect()
        };
        Ok(RecycleBin {
            songs: deleted(songs),
            setlists: deleted(setlists),
        })
    }

    /// Bring back a deleted song or setlist with the parts deleted along
    /// with it (same moment); parts removed earlier by edits stay removed.
    async fn undelete(&self, table: Undeletable, id: &str) -> DbResult<bool> {
        let (parent, children): (&str, &[(&str, &str)]) = match table {
            Undeletable::Song => ("songs", &[("sections", "song_id"), ("slides", "song_id")]),
            Undeletable::Setlist => ("setlists", &[("setlist_items", "setlist_id")]),
        };
        let mut tx = self.pool.begin().await?;
        let when: Option<(i64,)> = sqlx::query_as(sqlx::AssertSqlSafe(format!(
            "SELECT deleted_at FROM {parent} WHERE id = ? AND library_id = ? AND deleted_at IS NOT NULL"
        )))
        .bind(id)
        .bind(&self.library_id)
        .fetch_optional(&mut *tx)
        .await?;
        let Some((when,)) = when else {
            return Ok(false);
        };
        let now = now_ms();
        // Safe: table and column names come from the fixed lists above.
        sqlx::query(sqlx::AssertSqlSafe(format!(
            "UPDATE {parent} SET deleted_at = NULL, updated_at = ? WHERE id = ?"
        )))
        .bind(now)
        .bind(id)
        .execute(&mut *tx)
        .await?;
        for (table, key) in children {
            sqlx::query(sqlx::AssertSqlSafe(format!(
                "UPDATE {table} SET deleted_at = NULL, updated_at = ? WHERE {key} = ? AND deleted_at = ?"
            )))
            .bind(now)
            .bind(id)
            .bind(when)
            .execute(&mut *tx)
            .await?;
        }
        tx.commit().await?;
        Ok(true)
    }

    pub async fn undelete_song(&self, id: &str) -> DbResult<bool> {
        self.undelete(Undeletable::Song, id).await
    }

    pub async fn undelete_setlist(&self, id: &str) -> DbResult<bool> {
        self.undelete(Undeletable::Setlist, id).await
    }

    pub async fn list_songs(&self) -> DbResult<Vec<SongSummary>> {
        let rows: Vec<SongRow> = sqlx::query_as(
            "SELECT id, title, artist, song_key, capo, ccli_number, copyright, arrangement, updated_at
             FROM songs WHERE library_id = ? AND deleted_at IS NULL
             ORDER BY title COLLATE NOCASE",
        )
        .bind(&self.library_id)
        .fetch_all(&self.pool)
        .await?;
        Ok(rows
            .into_iter()
            .map(|r| SongSummary {
                id: r.id,
                title: r.title,
                artist: r.artist,
                key: r.song_key,
                updated_at: r.updated_at,
            })
            .collect())
    }

    pub async fn get_song(&self, id: &str) -> DbResult<Option<Song>> {
        let row: Option<SongRow> = sqlx::query_as(
            "SELECT id, title, artist, song_key, capo, ccli_number, copyright, arrangement, updated_at
             FROM songs WHERE id = ? AND library_id = ? AND deleted_at IS NULL",
        )
        .bind(id)
        .bind(&self.library_id)
        .fetch_optional(&self.pool)
        .await?;
        let Some(row) = row else { return Ok(None) };

        let sections: Vec<SectionRow> = sqlx::query_as(
            "SELECT id, name, background_id FROM sections WHERE song_id = ? AND deleted_at IS NULL ORDER BY position",
        )
        .bind(id)
        .fetch_all(&self.pool)
        .await?;
        let slide_rows: Vec<SlideRow> = sqlx::query_as(
            "SELECT id, section_id, lines, background_id FROM slides WHERE song_id = ? AND deleted_at IS NULL ORDER BY position",
        )
        .bind(id)
        .fetch_all(&self.pool)
        .await?;

        let mut slides_by_section: HashMap<String, Vec<SongSlide>> = HashMap::new();
        for s in slide_rows {
            let lines: Vec<LyricLine> = serde_json::from_str(&s.lines).map_err(decode_err)?;
            slides_by_section
                .entry(s.section_id)
                .or_default()
                .push(SongSlide {
                    id: s.id,
                    lines,
                    background_id: s.background_id,
                });
        }
        let arrangement = row
            .arrangement
            .as_deref()
            .map(serde_json::from_str::<Vec<String>>)
            .transpose()
            .map_err(decode_err)?;

        Ok(Some(Song {
            id: row.id,
            title: row.title,
            artist: row.artist,
            key: row.song_key,
            capo: row.capo.clamp(0, 11) as u8,
            ccli_number: row.ccli_number,
            copyright: row.copyright,
            arrangement,
            sections: sections
                .into_iter()
                .map(|s| SongSection {
                    slides: slides_by_section.remove(&s.id).unwrap_or_default(),
                    id: s.id,
                    name: s.name,
                    background_id: s.background_id,
                })
                .collect(),
            updated_at: row.updated_at,
        }))
    }

    pub async fn create_song(&self, input: &SongInput) -> DbResult<Song> {
        let id = new_id();
        let now = now_ms();
        let mut tx = self.pool.begin().await?;
        sqlx::query(
            "INSERT INTO songs (id, library_id, title, artist, song_key, capo, ccli_number, copyright, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(&self.library_id)
        .bind(input.title.trim())
        .bind(&input.artist)
        .bind(&input.key)
        .bind(i64::from(input.capo.min(11)))
        .bind(&input.ccli_number)
        .bind(&input.copyright)
        .bind(now)
        .bind(now)
        .execute(&mut *tx)
        .await?;
        self.write_children(&mut tx, &id, input, now).await?;
        tx.commit().await?;
        Ok(self.get_song(&id).await?.expect("song just created"))
    }

    /// Replace a song's fields, sections and slides. Rows whose ids are sent
    /// again are updated in place; rows left out are soft-deleted.
    pub async fn update_song(&self, id: &str, input: &SongInput) -> DbResult<Option<Song>> {
        let now = now_ms();
        let mut tx = self.pool.begin().await?;
        let updated = sqlx::query(
            "UPDATE songs SET title = ?, artist = ?, song_key = ?, capo = ?, ccli_number = ?, copyright = ?, updated_at = ?
             WHERE id = ? AND library_id = ? AND deleted_at IS NULL",
        )
        .bind(input.title.trim())
        .bind(&input.artist)
        .bind(&input.key)
        .bind(i64::from(input.capo.min(11)))
        .bind(&input.ccli_number)
        .bind(&input.copyright)
        .bind(now)
        .bind(id)
        .bind(&self.library_id)
        .execute(&mut *tx)
        .await?
        .rows_affected();
        if updated == 0 {
            return Ok(None);
        }
        self.write_children(&mut tx, id, input, now).await?;
        tx.commit().await?;
        self.get_song(id).await
    }

    /// Set or clear a section's background. False if the section isn't
    /// part of that song.
    pub async fn set_section_background(
        &self,
        song_id: &str,
        section_id: &str,
        media_id: Option<&str>,
    ) -> DbResult<bool> {
        let now = now_ms();
        let updated = sqlx::query(
            "UPDATE sections SET background_id = ?, updated_at = ?
             WHERE id = ? AND song_id = ? AND library_id = ? AND deleted_at IS NULL",
        )
        .bind(media_id)
        .bind(now)
        .bind(section_id)
        .bind(song_id)
        .bind(&self.library_id)
        .execute(&self.pool)
        .await?
        .rows_affected();
        if updated > 0 {
            sqlx::query("UPDATE songs SET updated_at = ? WHERE id = ?")
                .bind(now)
                .bind(song_id)
                .execute(&self.pool)
                .await?;
        }
        Ok(updated > 0)
    }

    /// Set or clear one slide's background cue. False if the slide isn't
    /// part of that song.
    pub async fn set_slide_background(
        &self,
        song_id: &str,
        slide_id: &str,
        media_id: Option<&str>,
    ) -> DbResult<bool> {
        let now = now_ms();
        let updated = sqlx::query(
            "UPDATE slides SET background_id = ?, updated_at = ?
             WHERE id = ? AND song_id = ? AND library_id = ? AND deleted_at IS NULL",
        )
        .bind(media_id)
        .bind(now)
        .bind(slide_id)
        .bind(song_id)
        .bind(&self.library_id)
        .execute(&self.pool)
        .await?
        .rows_affected();
        if updated > 0 {
            sqlx::query("UPDATE songs SET updated_at = ? WHERE id = ?")
                .bind(now)
                .bind(song_id)
                .execute(&self.pool)
                .await?;
        }
        Ok(updated > 0)
    }

    pub async fn delete_song(&self, id: &str) -> DbResult<bool> {
        let now = now_ms();
        let mut tx = self.pool.begin().await?;
        let deleted = sqlx::query(
            "UPDATE songs SET deleted_at = ?, updated_at = ? WHERE id = ? AND library_id = ? AND deleted_at IS NULL",
        )
        .bind(now)
        .bind(now)
        .bind(id)
        .bind(&self.library_id)
        .execute(&mut *tx)
        .await?
        .rows_affected();
        if deleted > 0 {
            sqlx::query("UPDATE sections SET deleted_at = ?, updated_at = ? WHERE song_id = ? AND deleted_at IS NULL")
                .bind(now)
                .bind(now)
                .bind(id)
                .execute(&mut *tx)
                .await?;
            sqlx::query("UPDATE slides SET deleted_at = ?, updated_at = ? WHERE song_id = ? AND deleted_at IS NULL")
                .bind(now)
                .bind(now)
                .bind(id)
                .execute(&mut *tx)
                .await?;
        }
        tx.commit().await?;
        Ok(deleted > 0)
    }

    /// Upsert sections and slides for a song, soft-delete the ones not sent,
    /// and store the arrangement (dropping ids that don't name a section).
    async fn write_children(
        &self,
        tx: &mut Transaction<'_, Sqlite>,
        song_id: &str,
        input: &SongInput,
        now: i64,
    ) -> DbResult<()> {
        let own_sections: HashSet<String> =
            sqlx::query_as::<_, (String,)>("SELECT id FROM sections WHERE song_id = ?")
                .bind(song_id)
                .fetch_all(&mut **tx)
                .await?
                .into_iter()
                .map(|(id,)| id)
                .collect();
        let own_slides: HashSet<String> =
            sqlx::query_as::<_, (String,)>("SELECT id FROM slides WHERE song_id = ?")
                .bind(song_id)
                .fetch_all(&mut **tx)
                .await?
                .into_iter()
                .map(|(id,)| id)
                .collect();

        let mut kept_sections = HashSet::new();
        let mut kept_slides = HashSet::new();
        // Client id → stored id, for translating the arrangement.
        let mut section_ids: HashMap<String, String> = HashMap::new();

        for (position, section) in input.sections.iter().enumerate() {
            let section_id = self
                .claim_id(tx, &section.id, &own_sections, "sections")
                .await?;
            if own_sections.contains(&section_id) {
                sqlx::query("UPDATE sections SET name = ?, position = ?, background_id = ?, updated_at = ?, deleted_at = NULL WHERE id = ?")
                    .bind(section.name.trim())
                    .bind(position as i64)
                    .bind(&section.background_id)
                    .bind(now)
                    .bind(&section_id)
                    .execute(&mut **tx)
                    .await?;
            } else {
                sqlx::query(
                    "INSERT INTO sections (id, library_id, song_id, name, position, background_id, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                )
                .bind(&section_id)
                .bind(&self.library_id)
                .bind(song_id)
                .bind(section.name.trim())
                .bind(position as i64)
                .bind(&section.background_id)
                .bind(now)
                .bind(now)
                .execute(&mut **tx)
                .await?;
            }
            if let Some(client_id) = &section.id {
                section_ids.insert(client_id.clone(), section_id.clone());
            }
            self.write_slides(
                tx,
                song_id,
                &section_id,
                section,
                &own_slides,
                &mut kept_slides,
                now,
            )
            .await?;
            kept_sections.insert(section_id);
        }

        for id in own_sections.difference(&kept_sections) {
            sqlx::query("UPDATE sections SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL")
                .bind(now)
                .bind(now)
                .bind(id)
                .execute(&mut **tx)
                .await?;
        }
        for id in own_slides.difference(&kept_slides) {
            sqlx::query("UPDATE slides SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL")
                .bind(now)
                .bind(now)
                .bind(id)
                .execute(&mut **tx)
                .await?;
        }

        let arrangement = input
            .arrangement
            .as_ref()
            .map(|order| {
                order
                    .iter()
                    .filter_map(|id| section_ids.get(id).or(kept_sections.get(id)).cloned())
                    .collect::<Vec<_>>()
            })
            .filter(|order| !order.is_empty())
            .map(|order| serde_json::to_string(&order))
            .transpose()
            .map_err(decode_err)?;
        sqlx::query("UPDATE songs SET arrangement = ? WHERE id = ?")
            .bind(arrangement)
            .bind(song_id)
            .execute(&mut **tx)
            .await?;
        Ok(())
    }

    #[allow(clippy::too_many_arguments)]
    async fn write_slides(
        &self,
        tx: &mut Transaction<'_, Sqlite>,
        song_id: &str,
        section_id: &str,
        section: &SectionInput,
        own_slides: &HashSet<String>,
        kept_slides: &mut HashSet<String>,
        now: i64,
    ) -> DbResult<()> {
        for (position, slide) in section.slides.iter().enumerate() {
            let slide_id = self.claim_id(tx, &slide.id, own_slides, "slides").await?;
            let lines = serde_json::to_string(&slide.lines).map_err(decode_err)?;
            if own_slides.contains(&slide_id) {
                sqlx::query(
                    "UPDATE slides SET section_id = ?, position = ?, lines = ?, background_id = ?, updated_at = ?, deleted_at = NULL WHERE id = ?",
                )
                .bind(section_id)
                .bind(position as i64)
                .bind(&lines)
                .bind(&slide.background_id)
                .bind(now)
                .bind(&slide_id)
                .execute(&mut **tx)
                .await?;
            } else {
                sqlx::query(
                    "INSERT INTO slides (id, library_id, song_id, section_id, position, lines, background_id, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                )
                .bind(&slide_id)
                .bind(&self.library_id)
                .bind(song_id)
                .bind(section_id)
                .bind(position as i64)
                .bind(&lines)
                .bind(&slide.background_id)
                .bind(now)
                .bind(now)
                .execute(&mut **tx)
                .await?;
            }
            kept_slides.insert(slide_id);
        }
        Ok(())
    }

    /// The id to store a row under: the client's id if it is this song's own
    /// or unused anywhere, otherwise a fresh one (never hijack another song's row).
    async fn claim_id(
        &self,
        tx: &mut Transaction<'_, Sqlite>,
        requested: &Option<String>,
        own: &HashSet<String>,
        table: &'static str,
    ) -> DbResult<String> {
        let Some(id) = usable_id(requested) else {
            return Ok(new_id());
        };
        if own.contains(id) {
            return Ok(id.to_string());
        }
        let taken: Option<(i64,)> = match table {
            "sections" => sqlx::query_as("SELECT 1 FROM sections WHERE id = ?"),
            "setlist_items" => sqlx::query_as("SELECT 1 FROM setlist_items WHERE id = ?"),
            _ => sqlx::query_as("SELECT 1 FROM slides WHERE id = ?"),
        }
        .bind(id)
        .fetch_optional(&mut **tx)
        .await?;
        Ok(if taken.is_some() {
            new_id()
        } else {
            id.to_string()
        })
    }
}

#[derive(FromRow)]
struct SetlistRow {
    id: String,
    name: String,
    service_date: Option<String>,
    updated_at: i64,
}

#[derive(FromRow)]
struct SetlistSummaryRow {
    id: String,
    name: String,
    service_date: Option<String>,
    updated_at: i64,
    item_count: i64,
}

#[derive(FromRow)]
struct SetlistItemRow {
    id: String,
    kind: String,
    song_id: Option<String>,
    title: Option<String>,
    body: Option<String>,
    background_id: Option<String>,
    notes: Option<String>,
    song_title: Option<String>,
    song_key: Option<String>,
    song_deleted: Option<i64>,
}

impl Db {
    pub async fn list_setlists(&self) -> DbResult<Vec<SetlistSummary>> {
        let rows: Vec<SetlistSummaryRow> = sqlx::query_as(
            "SELECT s.id, s.name, s.service_date, s.updated_at,
                    (SELECT COUNT(*) FROM setlist_items i WHERE i.setlist_id = s.id AND i.deleted_at IS NULL) AS item_count
             FROM setlists s WHERE s.library_id = ? AND s.deleted_at IS NULL
             ORDER BY s.service_date IS NULL, s.service_date DESC, s.updated_at DESC",
        )
        .bind(&self.library_id)
        .fetch_all(&self.pool)
        .await?;
        Ok(rows
            .into_iter()
            .map(|r| SetlistSummary {
                id: r.id,
                name: r.name,
                service_date: r.service_date,
                item_count: r.item_count.max(0) as u32,
                updated_at: r.updated_at,
            })
            .collect())
    }

    pub async fn get_setlist(&self, id: &str) -> DbResult<Option<Setlist>> {
        let row: Option<SetlistRow> = sqlx::query_as(
            "SELECT id, name, service_date, updated_at FROM setlists
             WHERE id = ? AND library_id = ? AND deleted_at IS NULL",
        )
        .bind(id)
        .bind(&self.library_id)
        .fetch_optional(&self.pool)
        .await?;
        let Some(row) = row else { return Ok(None) };
        let items: Vec<SetlistItemRow> = sqlx::query_as(
            "SELECT i.id, i.kind, i.song_id, i.title, i.body, i.background_id, i.notes,
                    s.title AS song_title, s.song_key AS song_key, s.deleted_at AS song_deleted
             FROM setlist_items i LEFT JOIN songs s ON s.id = i.song_id
             WHERE i.setlist_id = ? AND i.deleted_at IS NULL ORDER BY i.position",
        )
        .bind(id)
        .fetch_all(&self.pool)
        .await?;
        Ok(Some(Setlist {
            id: row.id,
            name: row.name,
            service_date: row.service_date,
            updated_at: row.updated_at,
            items: items
                .into_iter()
                .map(|i| match i.kind.as_str() {
                    "song" => SetlistItem::Song {
                        id: i.id,
                        song_id: i.song_id.unwrap_or_default(),
                        missing: i.song_title.is_none() || i.song_deleted.is_some(),
                        title: i.song_title.unwrap_or_default(),
                        key: i.song_key,
                        notes: i.notes.unwrap_or_default(),
                    },
                    "scripture" => match serde_json::from_str::<StoredScripture>(
                        i.body.as_deref().unwrap_or(""),
                    ) {
                        Ok(stored) => SetlistItem::Scripture {
                            id: i.id,
                            translation: stored.translation,
                            passage: stored.passage,
                            title: i.title.unwrap_or_default(),
                            notes: i.notes.unwrap_or_default(),
                        },
                        // Unreadable: keep it visible as a note rather than lose it.
                        Err(_) => SetlistItem::Announcement {
                            id: i.id,
                            title: i.title.unwrap_or_default(),
                            text: String::new(),
                            background_id: None,
                            notes: i.notes.unwrap_or_default(),
                        },
                    },
                    _ => SetlistItem::Announcement {
                        id: i.id,
                        title: i.title.unwrap_or_default(),
                        text: i.body.unwrap_or_default(),
                        background_id: i.background_id,
                        notes: i.notes.unwrap_or_default(),
                    },
                })
                .collect(),
        }))
    }

    pub async fn create_setlist(&self, input: &SetlistInput) -> DbResult<Setlist> {
        let id = new_id();
        let now = now_ms();
        let mut tx = self.pool.begin().await?;
        sqlx::query(
            "INSERT INTO setlists (id, library_id, name, service_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(&self.library_id)
        .bind(input.name.trim())
        .bind(&input.service_date)
        .bind(now)
        .bind(now)
        .execute(&mut *tx)
        .await?;
        self.write_setlist_items(&mut tx, &id, &input.items, now)
            .await?;
        tx.commit().await?;
        Ok(self.get_setlist(&id).await?.expect("setlist just created"))
    }

    pub async fn update_setlist(
        &self,
        id: &str,
        input: &SetlistInput,
    ) -> DbResult<Option<Setlist>> {
        let now = now_ms();
        let mut tx = self.pool.begin().await?;
        let updated = sqlx::query(
            "UPDATE setlists SET name = ?, service_date = ?, updated_at = ?
             WHERE id = ? AND library_id = ? AND deleted_at IS NULL",
        )
        .bind(input.name.trim())
        .bind(&input.service_date)
        .bind(now)
        .bind(id)
        .bind(&self.library_id)
        .execute(&mut *tx)
        .await?
        .rows_affected();
        if updated == 0 {
            return Ok(None);
        }
        self.write_setlist_items(&mut tx, id, &input.items, now)
            .await?;
        tx.commit().await?;
        self.get_setlist(id).await
    }

    pub async fn delete_setlist(&self, id: &str) -> DbResult<bool> {
        let now = now_ms();
        let mut tx = self.pool.begin().await?;
        let deleted = sqlx::query(
            "UPDATE setlists SET deleted_at = ?, updated_at = ? WHERE id = ? AND library_id = ? AND deleted_at IS NULL",
        )
        .bind(now)
        .bind(now)
        .bind(id)
        .bind(&self.library_id)
        .execute(&mut *tx)
        .await?
        .rows_affected();
        if deleted > 0 {
            sqlx::query("UPDATE setlist_items SET deleted_at = ?, updated_at = ? WHERE setlist_id = ? AND deleted_at IS NULL")
                .bind(now)
                .bind(now)
                .bind(id)
                .execute(&mut *tx)
                .await?;
        }
        tx.commit().await?;
        Ok(deleted > 0)
    }

    async fn write_setlist_items(
        &self,
        tx: &mut Transaction<'_, Sqlite>,
        setlist_id: &str,
        items: &[SetlistItemInput],
        now: i64,
    ) -> DbResult<()> {
        let own: HashSet<String> =
            sqlx::query_as::<_, (String,)>("SELECT id FROM setlist_items WHERE setlist_id = ?")
                .bind(setlist_id)
                .fetch_all(&mut **tx)
                .await?
                .into_iter()
                .map(|(id,)| id)
                .collect();
        let mut kept = HashSet::new();
        for (position, item) in items.iter().enumerate() {
            let stored;
            let (requested, kind, song_id, title, body, background_id) = match item {
                SetlistItemInput::Song { id, song_id, .. } => {
                    (id, "song", Some(song_id.as_str()), None, None, None)
                }
                SetlistItemInput::Scripture {
                    id,
                    translation,
                    passage,
                    title,
                    ..
                } => {
                    stored = serde_json::to_string(&StoredScripture {
                        translation: translation.clone(),
                        passage: passage.clone(),
                    })
                    .map_err(|e| sqlx::Error::Encode(Box::new(e)))?;
                    (
                        id,
                        "scripture",
                        None,
                        Some(title.trim()),
                        Some(stored.as_str()),
                        None,
                    )
                }
                SetlistItemInput::Announcement {
                    id,
                    title,
                    text,
                    background_id,
                    ..
                } => (
                    id,
                    "announcement",
                    None,
                    Some(title.trim()),
                    Some(text.as_str()),
                    background_id.as_deref(),
                ),
            };
            let item_id = self.claim_id(tx, requested, &own, "setlist_items").await?;
            let notes = item.notes().map(str::trim).filter(|n| !n.is_empty());
            if own.contains(&item_id) {
                sqlx::query(
                    "UPDATE setlist_items SET position = ?, kind = ?, song_id = ?, title = ?, body = ?, background_id = ?, notes = ?, updated_at = ?, deleted_at = NULL
                     WHERE id = ?",
                )
                .bind(position as i64)
                .bind(kind)
                .bind(song_id)
                .bind(title)
                .bind(body)
                .bind(background_id)
                .bind(notes)
                .bind(now)
                .bind(&item_id)
                .execute(&mut **tx)
                .await?;
            } else {
                sqlx::query(
                    "INSERT INTO setlist_items (id, library_id, setlist_id, position, kind, song_id, title, body, background_id, notes, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                )
                .bind(&item_id)
                .bind(&self.library_id)
                .bind(setlist_id)
                .bind(position as i64)
                .bind(kind)
                .bind(song_id)
                .bind(title)
                .bind(body)
                .bind(background_id)
                .bind(notes)
                .bind(now)
                .bind(now)
                .execute(&mut **tx)
                .await?;
            }
            kept.insert(item_id);
        }
        for id in own.difference(&kept) {
            sqlx::query("UPDATE setlist_items SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL")
                .bind(now)
                .bind(now)
                .bind(id)
                .execute(&mut **tx)
                .await?;
        }
        Ok(())
    }
}

#[derive(FromRow)]
struct MediaRow {
    id: String,
    name: String,
    hash: String,
    ext: String,
    width: i64,
    height: i64,
    created_at: i64,
}

impl From<MediaRow> for Media {
    fn from(r: MediaRow) -> Self {
        Media {
            url: image_url(&r.hash, &r.ext),
            thumb_url: thumb_url(&r.hash),
            id: r.id,
            name: r.name,
            hash: r.hash,
            width: r.width.max(0) as u32,
            height: r.height.max(0) as u32,
            created_at: r.created_at,
        }
    }
}

/// What the library knows about a newly stored image.
pub struct NewMedia<'a> {
    pub name: &'a str,
    pub hash: &'a str,
    pub ext: &'a str,
    pub width: u32,
    pub height: u32,
    pub size_bytes: usize,
}

impl Db {
    pub async fn list_media(&self) -> DbResult<Vec<Media>> {
        let rows: Vec<MediaRow> = sqlx::query_as(
            "SELECT id, name, hash, ext, width, height, created_at FROM media
             WHERE library_id = ? AND deleted_at IS NULL ORDER BY created_at DESC",
        )
        .bind(&self.library_id)
        .fetch_all(&self.pool)
        .await?;
        Ok(rows.into_iter().map(Media::from).collect())
    }

    pub async fn get_media(&self, id: &str) -> DbResult<Option<Media>> {
        let row: Option<MediaRow> = sqlx::query_as(
            "SELECT id, name, hash, ext, width, height, created_at FROM media
             WHERE id = ? AND library_id = ? AND deleted_at IS NULL",
        )
        .bind(id)
        .bind(&self.library_id)
        .fetch_optional(&self.pool)
        .await?;
        Ok(row.map(Media::from))
    }

    /// Record an image. Uploading the same picture again returns the
    /// existing entry instead of a duplicate.
    pub async fn add_media(&self, m: &NewMedia<'_>) -> DbResult<Media> {
        let existing: Option<MediaRow> = sqlx::query_as(
            "SELECT id, name, hash, ext, width, height, created_at FROM media
             WHERE library_id = ? AND hash = ? AND deleted_at IS NULL",
        )
        .bind(&self.library_id)
        .bind(m.hash)
        .fetch_optional(&self.pool)
        .await?;
        if let Some(row) = existing {
            return Ok(row.into());
        }
        let id = new_id();
        let now = now_ms();
        sqlx::query(
            "INSERT INTO media (id, library_id, name, hash, ext, width, height, size_bytes, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(&self.library_id)
        .bind(m.name)
        .bind(m.hash)
        .bind(m.ext)
        .bind(i64::from(m.width))
        .bind(i64::from(m.height))
        .bind(m.size_bytes as i64)
        .bind(now)
        .bind(now)
        .execute(&self.pool)
        .await?;
        Ok(self.get_media(&id).await?.expect("media just added"))
    }

    /// Soft-delete. The file stays on disk (another library entry or a
    /// synced copy may still use the same hash).
    pub async fn delete_media(&self, id: &str) -> DbResult<bool> {
        let now = now_ms();
        let deleted = sqlx::query(
            "UPDATE media SET deleted_at = ?, updated_at = ? WHERE id = ? AND library_id = ? AND deleted_at IS NULL",
        )
        .bind(now)
        .bind(now)
        .bind(id)
        .bind(&self.library_id)
        .execute(&self.pool)
        .await?
        .rows_affected();
        Ok(deleted > 0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::song::SlideInput;

    fn input(title: &str, sections: &[(&str, Option<&str>, &[&str])]) -> SongInput {
        SongInput {
            title: title.into(),
            artist: None,
            key: Some("C".into()),
            capo: 0,
            ccli_number: None,
            copyright: None,
            arrangement: None,
            sections: sections
                .iter()
                .map(|(name, id, lines)| SectionInput {
                    id: id.map(String::from),
                    name: (*name).into(),
                    background_id: None,
                    slides: vec![SlideInput {
                        id: None,
                        background_id: None,
                        lines: lines
                            .iter()
                            .map(|t| LyricLine {
                                text: (*t).into(),
                                chords: vec![],
                            })
                            .collect(),
                    }],
                })
                .collect(),
        }
    }

    #[tokio::test]
    async fn create_and_read_back_a_song() {
        let db = Db::in_memory().await.unwrap();
        assert!(db.is_empty().await.unwrap());
        let song = db
            .create_song(&input(
                "Amazing Grace",
                &[("Verse 1", None, &["Amazing grace", "How sweet"])],
            ))
            .await
            .unwrap();
        assert_eq!(song.title, "Amazing Grace");
        assert_eq!(song.sections[0].slides[0].lines[1].text, "How sweet");
        assert_eq!(db.list_songs().await.unwrap().len(), 1);
        assert!(!db.is_empty().await.unwrap());
    }

    #[tokio::test]
    async fn update_keeps_ids_it_was_sent_and_soft_deletes_the_rest() {
        let db = Db::in_memory().await.unwrap();
        let song = db
            .create_song(&input(
                "S",
                &[("Verse 1", None, &["a"]), ("Chorus", None, &["b"])],
            ))
            .await
            .unwrap();
        let verse_id = song.sections[0].id.clone();

        let mut next = input("S2", &[("Verse 1 (new)", Some(&verse_id), &["a2"])]);
        next.arrangement = Some(vec![verse_id.clone(), verse_id.clone(), "missing".into()]);
        let updated = db.update_song(&song.id, &next).await.unwrap().unwrap();

        assert_eq!(updated.title, "S2");
        assert_eq!(updated.sections.len(), 1);
        assert_eq!(updated.sections[0].id, verse_id);
        assert_eq!(updated.sections[0].name, "Verse 1 (new)");
        assert_eq!(updated.arrangement, Some(vec![verse_id.clone(), verse_id]));
        assert!(updated.updated_at >= song.updated_at);
    }

    #[tokio::test]
    async fn a_client_cannot_steal_another_songs_section() {
        let db = Db::in_memory().await.unwrap();
        let a = db
            .create_song(&input("A", &[("V", None, &["a"])]))
            .await
            .unwrap();
        let stolen = a.sections[0].id.clone();
        let b = db
            .create_song(&input("B", &[("V", Some(&stolen), &["b"])]))
            .await
            .unwrap();
        assert_ne!(b.sections[0].id, stolen);
        let a_again = db.get_song(&a.id).await.unwrap().unwrap();
        assert_eq!(a_again.sections[0].slides[0].lines[0].text, "a");
    }

    #[tokio::test]
    async fn delete_hides_the_song_but_keeps_the_library_non_empty() {
        let db = Db::in_memory().await.unwrap();
        let song = db
            .create_song(&input("S", &[("V", None, &["a"])]))
            .await
            .unwrap();
        assert!(db.delete_song(&song.id).await.unwrap());
        assert!(!db.delete_song(&song.id).await.unwrap());
        assert!(db.get_song(&song.id).await.unwrap().is_none());
        assert!(db.list_songs().await.unwrap().is_empty());
        assert!(!db.is_empty().await.unwrap());
        assert!(db
            .update_song(&song.id, &input("X", &[]))
            .await
            .unwrap()
            .is_none());
    }

    #[tokio::test]
    async fn the_recycle_bin_brings_songs_back_as_they_were_deleted() {
        let db = Db::in_memory().await.unwrap();
        let song = db
            .create_song(&input("S", &[("V1", None, &["a"]), ("V2", None, &["b"])]))
            .await
            .unwrap();
        // An edit removes V2 first; that stays removed.
        db.update_song(&song.id, &input("S", &[("V1", None, &["a"])]))
            .await
            .unwrap();
        tokio::time::sleep(std::time::Duration::from_millis(5)).await;
        db.delete_song(&song.id).await.unwrap();
        let bin = db.recycle_bin().await.unwrap();
        assert_eq!(bin.songs.len(), 1);
        assert_eq!(bin.songs[0].title, "S");

        assert!(db.undelete_song(&song.id).await.unwrap());
        assert!(!db.undelete_song(&song.id).await.unwrap());
        let back = db.get_song(&song.id).await.unwrap().unwrap();
        let names: Vec<_> = back.sections.iter().map(|s| s.name.as_str()).collect();
        assert_eq!(names, ["V1"]);
        assert_eq!(back.sections[0].slides.len(), 1);
        assert!(db.recycle_bin().await.unwrap().songs.is_empty());

        let setlist = db
            .create_setlist(&SetlistInput {
                name: "Friday".into(),
                service_date: None,
                items: vec![SetlistItemInput::Song {
                    id: None,
                    song_id: song.id.clone(),
                    notes: None,
                }],
            })
            .await
            .unwrap();
        db.delete_setlist(&setlist.id).await.unwrap();
        assert_eq!(db.recycle_bin().await.unwrap().setlists.len(), 1);
        assert!(db.undelete_setlist(&setlist.id).await.unwrap());
        assert_eq!(
            db.get_setlist(&setlist.id)
                .await
                .unwrap()
                .unwrap()
                .items
                .len(),
            1
        );
    }

    #[tokio::test]
    async fn ids_are_uuid_v7() {
        let id = new_id();
        assert_eq!(Uuid::parse_str(&id).unwrap().get_version_num(), 7);
    }

    #[tokio::test]
    async fn setlists_round_trip_reorder_and_flag_deleted_songs() {
        let db = Db::in_memory().await.unwrap();
        let a = db
            .create_song(&input("Alpha", &[("V", None, &["a"])]))
            .await
            .unwrap();
        let b = db
            .create_song(&input("Beta", &[("V", None, &["b"])]))
            .await
            .unwrap();
        let list = db
            .create_setlist(&SetlistInput {
                name: " Friday ".into(),
                service_date: Some("2026-10-09".into()),
                items: vec![
                    SetlistItemInput::Song {
                        id: None,
                        song_id: a.id.clone(),
                        notes: Some("  Key change after chorus 2 ".into()),
                    },
                    SetlistItemInput::Announcement {
                        id: None,
                        title: "Potluck".into(),
                        text: "Next Friday".into(),
                        background_id: None,
                        notes: None,
                    },
                    SetlistItemInput::Song {
                        id: None,
                        song_id: b.id.clone(),
                        notes: None,
                    },
                ],
            })
            .await
            .unwrap();
        assert!(
            matches!(&list.items[0], SetlistItem::Song { notes, .. } if notes == "Key change after chorus 2")
        );
        assert!(
            matches!(&list.items[1], SetlistItem::Announcement { notes, .. } if notes.is_empty())
        );
        assert_eq!(list.name, "Friday");
        assert_eq!(list.items.len(), 3);
        assert!(matches!(&list.items[0], SetlistItem::Song { title, .. } if title == "Alpha"));

        // Reorder: Beta first, drop the announcement; ids are kept.
        let beta_id = list.items[2].id().to_string();
        let alpha_id = list.items[0].id().to_string();
        let updated = db
            .update_setlist(
                &list.id,
                &SetlistInput {
                    name: "Friday".into(),
                    service_date: None,
                    items: vec![
                        SetlistItemInput::Song {
                            id: Some(beta_id.clone()),
                            song_id: b.id.clone(),
                            notes: None,
                        },
                        SetlistItemInput::Song {
                            id: Some(alpha_id.clone()),
                            song_id: a.id.clone(),
                            notes: None,
                        },
                    ],
                },
            )
            .await
            .unwrap()
            .unwrap();
        assert_eq!(
            updated
                .items
                .iter()
                .map(|i| i.id().to_string())
                .collect::<Vec<_>>(),
            [beta_id, alpha_id]
        );
        assert_eq!(db.list_setlists().await.unwrap()[0].item_count, 2);

        db.delete_song(&a.id).await.unwrap();
        let after = db.get_setlist(&list.id).await.unwrap().unwrap();
        assert!(matches!(
            &after.items[1],
            SetlistItem::Song { missing: true, .. }
        ));

        assert!(db.delete_setlist(&list.id).await.unwrap());
        assert!(db.list_setlists().await.unwrap().is_empty());
    }

    #[tokio::test]
    async fn media_dedupes_by_hash_and_soft_deletes() {
        let db = Db::in_memory().await.unwrap();
        let new = NewMedia {
            name: "sunrise.jpg",
            hash: "abc",
            ext: "jpg",
            width: 1920,
            height: 1080,
            size_bytes: 1000,
        };
        let first = db.add_media(&new).await.unwrap();
        let again = db
            .add_media(&NewMedia {
                name: "copy.jpg",
                ..new
            })
            .await
            .unwrap();
        assert_eq!(first.id, again.id);
        assert_eq!(first.url, "/media/abc.jpg");
        assert_eq!(first.thumb_url, "/media/thumbs/abc.jpg");
        assert_eq!(db.list_media().await.unwrap().len(), 1);
        assert!(db.delete_media(&first.id).await.unwrap());
        assert!(db.get_media(&first.id).await.unwrap().is_none());
        // After deleting, the same picture can be added again as a new entry.
        let readded = db.add_media(&new).await.unwrap();
        assert_ne!(readded.id, first.id);
    }
}
