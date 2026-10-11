import { useEffect, useState } from "react";
import type { Song } from "../generated/Song";
import { api } from "../lib/api";
import type { LiveState } from "../lib/ws";

/**
 * The full library song on air (with chords), reloaded when another song
 * goes on air or the one on air is edited. Null for announcements.
 */
export function useLiveSong(state: LiveState | null): Song | null {
  const [song, setSong] = useState<Song | null>(null);
  const songId = state?.song_id ?? null;
  // Live slides change when the song on air is edited: reload then too.
  const contentKey = state ? state.slides.map((s) => s.text).join("\u0000") : "";
  useEffect(() => {
    if (!songId) {
      setSong(null);
      return;
    }
    let cancelled = false;
    api
      .getSong(songId)
      .then((s) => !cancelled && setSong(s))
      .catch(() => !cancelled && setSong(null));
    return () => {
      cancelled = true;
    };
  }, [songId, contentKey]);
  return song && song.id === songId ? song : null;
}
