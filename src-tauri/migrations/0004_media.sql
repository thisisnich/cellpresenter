-- Background images. Files live on disk named by content hash; this table
-- holds what the library knows about them. Sync-ready like everything else.
CREATE TABLE media (
    id          TEXT PRIMARY KEY,
    library_id  TEXT NOT NULL REFERENCES libraries(id),
    name        TEXT NOT NULL,
    hash        TEXT NOT NULL,
    ext         TEXT NOT NULL,
    width       INTEGER NOT NULL,
    height      INTEGER NOT NULL,
    size_bytes  INTEGER NOT NULL,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL,
    deleted_at  INTEGER
);
CREATE INDEX media_by_library ON media (library_id, deleted_at, created_at);
CREATE INDEX media_by_hash ON media (library_id, hash);

ALTER TABLE songs ADD COLUMN background_id TEXT REFERENCES media(id);
ALTER TABLE setlist_items ADD COLUMN background_id TEXT REFERENCES media(id);
