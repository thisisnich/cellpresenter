-- Passages fetched from online Bibles (a church's own ESV or API.Bible key),
-- kept so a service prepared earlier still shows them without internet.
CREATE TABLE scripture_cache (
    key         TEXT PRIMARY KEY,   -- translation id + "|" + the reference as JSON
    passage     TEXT NOT NULL,      -- the Passage as JSON
    fetched_at  INTEGER NOT NULL
);
CREATE INDEX scripture_cache_by_age ON scripture_cache (fetched_at);
