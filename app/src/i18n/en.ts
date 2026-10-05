// English UI text. Every string the UI shows lives here; another language is
// another file with the same keys. Use {name} for values filled in at runtime.
export const en = {
  "app.name": "CellPresenter",

  "mode.show": "Show",
  "mode.edit": "Edit",
  "mode.chords": "Chords",
  "mode.comingSoon": "Coming soon",
  "layout.reset": "Reset layout",
  "header.copied": "Copied",
  "header.remotePin": "Remote PIN",

  "displayLink.button": "Display link",
  "displayLink.title": "Open the display on another device",
  "displayLink.howTo": "Scan with a phone or tablet camera, or type the address into any browser.",
  "displayLink.qrLabel": "QR code for {url}",
  "displayLink.copy": "Copy",
  "displayLink.network": "Network",
  "displayLink.lan": "Wi-Fi / LAN",
  "displayLink.tailscale": "Tailscale",
  "displayLink.noNetwork": "This computer isn't on a network other devices can reach.",
  "displayLink.tipLan": "The device must be on the same Wi-Fi. If it won't load, the network may stop devices reaching each other (common on guest, school and office Wi-Fi): try a phone hotspot, or Tailscale.",
  "displayLink.tipTailscale": "Works from any device signed in to your tailnet, on any network.",
  "displayLink.devNote": "Dev build: other devices get the last built web app. Run npm run build:watch alongside tauri dev to keep it current.",
  "header.remotePinHelp": "Phones and other computers need this PIN to control slides.",

  "panel.setlist": "Setlist",
  "panel.library": "Library",
  "panel.slides": "Slides",
  "panel.chords": "Chords",
  "panel.notes": "Notes",
  "panel.output": "Output",
  "panel.stage": "Stage",
  "panel.media": "Media",

  "setlist.tonight": "Tonight",
  "setlist.comingSoon": "Setlists are coming next. For now, pick songs in the Library.",
  "setlist.nothingOnAir": "Nothing on air yet.",
  "library.search": "Search songs",
  "library.searchCount": "Search {count} songs",
  "library.empty": "No songs yet.",
  "library.noMatches": "No songs match.",
  "library.loadFailed": "Couldn't load the song library.",
  "library.retry": "Try again",
  "chords.comingSoon": "Lyrics with chords, in any key, for musicians.",
  "notes.comingSoon": "Notes for the operator and the band.",
  "stage.comingSoon": "Countdowns and messages to the stage display.",
  "media.comingSoon": "Image and video backgrounds.",

  "slides.count": "{count} slides",
  "slides.empty": "Pick a song in the Library to put it on air.",
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

  "display.noSignal": "No signal",
  "display.waiting": "Waiting for a song",
  "display.reconnecting": "Disconnected — reconnecting",
  "display.slideCount": "{current} / {total}",
} as const;

export type MessageKey = keyof typeof en;
