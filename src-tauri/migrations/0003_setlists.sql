-- Setlists: an ordered list of songs and announcement slides for one
-- service or cell night. Sync-ready like the song tables.

CREATE TABLE setlists (
    id            TEXT PRIMARY KEY,
    library_id    TEXT NOT NULL REFERENCES libraries(id),
    name          TEXT NOT NULL,
    service_date  TEXT,              -- ISO date, e.g. 2026-10-09
    created_at    INTEGER NOT NULL,
    updated_at    INTEGER NOT NULL,
    deleted_at    INTEGER
);
CREATE INDEX setlists_by_library ON setlists (library_id, deleted_at, service_date);

CREATE TABLE setlist_items (
    id          TEXT PRIMARY KEY,
    library_id  TEXT NOT NULL REFERENCES libraries(id),
    setlist_id  TEXT NOT NULL REFERENCES setlists(id),
    position    INTEGER NOT NULL,
    kind        TEXT NOT NULL,       -- 'song' | 'announcement'
    song_id     TEXT REFERENCES songs(id),
    title       TEXT,                -- announcements
    body        TEXT,                -- announcements: lines, blank line = new slide
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL,
    deleted_at  INTEGER
);
CREATE INDEX setlist_items_by_setlist ON setlist_items (setlist_id, deleted_at, position);
