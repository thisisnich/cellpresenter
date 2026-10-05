import { useEffect } from "react";
import type { LiveCommand } from "./api";

// Keys that drive the presentation. Presentation clickers send PageDown /
// PageUp, and "b" or "." for their blank-screen button.
const KEYMAP: Record<string, LiveCommand> = {
  " ": { type: "next" },
  ArrowRight: { type: "next" },
  ArrowDown: { type: "next" },
  PageDown: { type: "next" },
  ArrowLeft: { type: "prev" },
  ArrowUp: { type: "prev" },
  PageUp: { type: "prev" },
  Home: { type: "go_to", index: 0 },
  b: { type: "toggle_visible" },
  B: { type: "toggle_visible" },
  ".": { type: "toggle_visible" },
};

export interface KeyLike {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  target: EventTarget | null;
}

function isTyping(target: EventTarget | null): boolean {
  if (!target || typeof (target as Element).closest !== "function") return false;
  return Boolean((target as Element).closest("input, textarea, select, [contenteditable=''], [contenteditable='true']"));
}

/** The command a key press means, or null when it should be left alone. */
export function commandForKey(e: KeyLike): LiveCommand | null {
  if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return null;
  return KEYMAP[e.key] ?? null;
}

/** Send transport commands from the keyboard while `enabled`. */
export function useTransportKeys(send: (command: LiveCommand) => unknown, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat && e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const command = commandForKey(e);
      if (!command) return;
      e.preventDefault();
      void send(command);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [send, enabled]);
}
