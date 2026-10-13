-- A song's arrangement for one setlist (section ids as a JSON array, in
-- play order); NULL plays the song's own arrangement.
ALTER TABLE setlist_items ADD COLUMN arrangement TEXT;
