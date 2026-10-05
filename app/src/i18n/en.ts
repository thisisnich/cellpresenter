// English UI text. Every string the UI shows lives here; another language is
// another file with the same keys. Use {name} for values filled in at runtime.
export const en = {
  "app.name": "CellPresenter",

  "mode.show": "Show",
  "mode.edit": "Edit",
  "mode.chords": "Chords",
  "mode.comingSoon": "Coming soon",
  "layout.reset": "Reset layout",
  "header.copyDisplayLink": "Copy display link",
  "header.copied": "Copied",

  "panel.setlist": "Setlist",
  "panel.library": "Library",
  "panel.slides": "Slides",
  "panel.chords": "Chords",
  "panel.notes": "Notes",
  "panel.output": "Output",
  "panel.stage": "Stage",
  "panel.media": "Media",

  "setlist.tonight": "Tonight",
  "setlist.comingSoon": "Setlists arrive with the song library.",
  "library.comingSoon": "Search and add songs once the song library lands.",
  "chords.comingSoon": "Lyrics with chords, in any key, for musicians.",
  "notes.comingSoon": "Notes for the operator and the band.",
  "stage.comingSoon": "Countdowns and messages to the stage display.",
  "media.comingSoon": "Image and video backgrounds.",

  "slides.count": "{count} slides",
  "slides.arrangement": "Arrangement",
  "slides.live": "LIVE",
  "slides.next": "NEXT",
  "slides.goTo": "Show slide {number}: {section}",

  "output.live": "Live output",
  "output.next": "Next · {section}",
  "output.blackedOut": "Screen is blacked out",

  "transport.prev": "← Prev",
  "transport.next": "Next →",
  "transport.blackOut": "Black out",
  "transport.show": "Show screen",
  "transport.textSize": "Text",
  "transport.requestFailed": "Couldn't reach the presenter: {message}",

  "connection.open": "Connected",
  "connection.connecting": "Connecting…",
  "connection.closed": "Disconnected",

  "display.blackedOut": "Blacked out",
  "display.noSignal": "No signal",
  "display.reconnecting": "Disconnected — reconnecting",
  "display.slideCount": "{current} / {total}",
} as const;

export type MessageKey = keyof typeof en;
