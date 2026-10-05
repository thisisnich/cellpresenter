// English UI text. Every string the UI shows lives here; another language is
// another file with the same keys. Use {name} for values filled in at runtime.
export const en = {
  "console.title": "CellPresenter Console",
  "console.subtitle": "Live control",
  "console.preview": "Preview",
  "console.slides": "Slides",
  "console.prev": "← Prev",
  "console.next": "Next →",
  "console.blackOut": "Black out",
  "console.show": "Show",
  "console.blackedOut": "Display blacked out",
  "console.textSize": "Text size",
  "console.displayLink": "Display: {url}",
  "console.requestFailed": "Request failed",
  "connection.open": "Connected",
  "connection.connecting": "Connecting…",
  "connection.closed": "Disconnected",
  "display.blackedOut": "Blacked out",
  "display.noSignal": "No signal",
  "display.reconnecting": "Disconnected — reconnecting",
  "display.slideCount": "{current} / {total}",
} as const;

export type MessageKey = keyof typeof en;
