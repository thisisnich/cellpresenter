-- Backgrounds belong to sections, not whole songs: when a slide of the
-- section goes on screen, the background layer switches to this image
-- (unless the slide has its own cue). Existing song backgrounds move onto
-- every section of the song, which looks the same on screen.
ALTER TABLE sections ADD COLUMN background_id TEXT REFERENCES media(id);
UPDATE sections SET background_id = (SELECT background_id FROM songs WHERE songs.id = sections.song_id);
-- songs.background_id is no longer read or written.
UPDATE songs SET background_id = NULL;
