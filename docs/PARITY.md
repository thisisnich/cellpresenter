# Parity with cellpresenter-web

What the Tauri app must match before it replaces the web app (`cellpresenter-web`, `main`), and where each piece lands. Source: the web app's Convex schema and pages, plus which features are actually used.

## Must match (used today)

| Web app feature | Where it lives in the web app | Tauri app | Release |
|---|---|---|---|
| Song editing (sections, slides, lyrics) | `songs`, `sections`, `slides` tables; `/songs` | SQLite library + paste-lyrics editor | R1 |
| Chord display + transpose / capo | `slides.chords`, song `key`/`capo`; chords display | Chords view for musicians, TS transpose | R1 |
| Setlists | `setlists` table; `/setlist` | Setlists + announcements | R1 |
| Setlist display | Setlist display renderer | Setlist on the audience / musician views | R1 |
| Backgrounds | `backgrounds` (R2/S3 storage) | Images on local disk, content-hash names, thumbnails | R1 (images), R3 (video, cloud copies) |
| Display links | `displayLinks` (token, expiry) | `/display` on the LAN; tokened links | R1 (LAN), R2 (remote) |
| Control slides from a phone | `/mobile-console`, `/share-console` | Phone remote page behind a PIN | R1 (LAN), R2 (remote room) |
| Share console with someone | `consoleShareLinks` → `consoleAccessRequests` → `consoleAccessGrants` → `notifications` | Team invites on the cloud library | R3 |

## Also in the web app (lower priority)

| Feature | Release |
|---|---|
| Song arrangements (`presentations.sectionOrder`, `songPreferences`) | R1 |
| Templates (text position, font, caps, CCLI, watermark) | R3 |
| Announcements | R1 (with setlists) |
| Timer + operator notes | R3 |
| PPTX / PDF export | R3 |
| Per-user theme palettes (`userSettings`) | not planned |
| Categories / tags for songs and backgrounds | not planned yet |

## Dropped

Ads and rewarded ads, Gemini lyrics AI (already removed from the web app), Stripe plans and quotas, the feature-request board and roadmap sync, admin tooling.

## Migration

There's little data to move, so a dedicated web-app importer is R3 at most. Good song import (paste, URL, ChordPro) covers it.
