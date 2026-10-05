import type { LiveState } from "./ws";

/**
 * Whether `next` should replace `current`. Within one server session only a
 * same-or-newer version wins, so a slow response can't undo a newer change;
 * a new session (the app restarted) always wins.
 */
export function isNewer(current: LiveState | null, next: LiveState): boolean {
  return !current || current.session !== next.session || next.version >= current.version;
}
