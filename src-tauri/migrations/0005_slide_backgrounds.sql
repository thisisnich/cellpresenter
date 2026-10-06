-- A background cue on a single slide: when the slide goes on screen, the
-- background layer switches to this image (ProPresenter-style media cue).
ALTER TABLE slides ADD COLUMN background_id TEXT REFERENCES media(id);
