-- Song library. Every table is sync-ready: UUIDv7 text ids, a library_id so
-- one account can hold several libraries later, millisecond timestamps, and
-- soft deletes (deleted_at) so a deletion can be synced like any other change.

CREATE TABLE libraries (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL,
    deleted_at  INTEGER
);

CREATE TABLE songs (
    id           TEXT PRIMARY KEY,
    library_id   TEXT NOT NULL REFERENCES libraries(id),
    title        TEXT NOT NULL,
    artist       TEXT,
    song_key     TEXT,
    capo         INTEGER NOT NULL DEFAULT 0,
    ccli_number  TEXT,
    copyright    TEXT,
    -- JSON array of section ids, in play order. NULL = sections in order.
    arrangement  TEXT,
    created_at   INTEGER NOT NULL,
    updated_at   INTEGER NOT NULL,
    deleted_at   INTEGER
);
CREATE INDEX songs_by_library ON songs (library_id, deleted_at, title);

CREATE TABLE sections (
    id          TEXT PRIMARY KEY,
    library_id  TEXT NOT NULL REFERENCES libraries(id),
    song_id     TEXT NOT NULL REFERENCES songs(id),
    name        TEXT NOT NULL,
    position    INTEGER NOT NULL,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL,
    deleted_at  INTEGER
);
CREATE INDEX sections_by_song ON sections (song_id, deleted_at, position);

CREATE TABLE slides (
    id          TEXT PRIMARY KEY,
    library_id  TEXT NOT NULL REFERENCES libraries(id),
    song_id     TEXT NOT NULL REFERENCES songs(id),
    section_id  TEXT NOT NULL REFERENCES sections(id),
    position    INTEGER NOT NULL,
    -- JSON array of { text, chords: [{ at, chord }] }: explicit lines, never
    -- auto-wrapped, with optional chords anchored to character positions.
    lines       TEXT NOT NULL,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL,
    deleted_at  INTEGER
);
CREATE INDEX slides_by_section ON slides (section_id, deleted_at, position);
