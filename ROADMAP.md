# CellPresenter Desktop — Build Roadmap

Free, open-source worship lyrics presentation. Cell groups first; built so it can grow into a ProPresenter alternative for bands and churches. North-star spec: `.cursor/scopes/TauriDesktop.md`. Live planning page (picks, build flow, open questions): https://claude.ai/artifact/HATbm1KBkEFxuebpVW1aqP

Every step ends in something you can demo or verify from outside the code. Built solo at about an hour a day, so releases stay small.

## Done

- **M0** — Tauri v2 + axum + React SPA dev loop.
- **M1** — Live state over WebSocket; a phone on the LAN and the native window stay in sync. Fixed 1920×1080 stage renders identically across devices.

## R1 — "My cell group runs on it"

Goal: run a cell group night on the new app instead of the web app. ~200–240 h estimated.

| Step | Items | Status |
|---|---|---|
| 1. Groundwork | Bundled UI in release builds · server binds before windows open, port fallback in release · Tauri's async runtime · real page addresses (`/display`) · tests + CI · translatable UI text · parity list | **done** |
| 2. Backend core + workspace | Split backend into a tested reducer · Dockview workspace shell with the A1 default layout and theme tokens (colours, radius, borders as CSS variables) · transpose + capo (TS) · smarter caching | **done** |
| 3. Song library | SQLite with sync-ready ids (UUIDv7, `updated_at`, soft delete, `library_id`) · versioned live updates · PIN for controls · keyboard + clicker control · generated TS types | **done** |
| 4. Content + live state | Paste lyrics → slides (explicit lines, font fits the longest line) · setlists + announcements · song arrangements · image backgrounds · live state holds pointers, not content | **done**: song editor (paste → slides), arrangements, fit-to-width, setlists + announcements, preview before going live, Next runs through the setlist, image backgrounds (per song, per announcement, default) with Clear text / Clear background |
| 5. Screens + search | Live/Next previews · phone remote page · audience phone view · chords view for musicians · song search (own library, paste/URL import, public-domain hymns) | Live/Next previews, audience view, **phone remote**, **chords view** (tap a chord for its guitar shapes) and **song search done**: Find songs searches LRCLIB for lyrics and imports a pasted Ultimate Guitar link (Ultimate Guitar itself is searched in the browser: its robots.txt bars programs from its search page); imports are cleaned up and split into sections, repeats and evenly sized slides |

Releases: v0.1.0 ships as a preview before step 5 is finished (AGPL-3.0, installers for Mac, Windows and Linux built by the Release workflow). Song search and import ship in v0.2.

**Test for R1:** build a setlist from pasted chord sheets, run it from the console and a phone, and a musician's phone shows lyrics + chords in the transposed key.

## v1.0 — "Another church can run it without us"

The bar: a volunteer at another church installs it and runs a Sunday with no help. Roughly 80–120 h after R1, so early to mid 2027.

| Release | Items |
|---|---|
| v0.2 | Song search and import (**done**) |
| v0.3 | Copyright footer on slides (**done**: copyright and CCLI song # in the editor; licence number and first slide / every slide / off in the Screen panel) · text style (**done**: five bundled fonts, bold, ALL CAPS, colour, shadow, top / middle / lower third, margins, in the Screen panel) · backups (**done**: daily automatic backups to Documents/CellPresenter Backups, Back up now, restore from the list or a file, which also moves a library to another computer; copyright line can sit in the bottom corner) · ChordPro and OpenLyrics file import (**done**: ChordPro, SongSelect ChordPro / text / .usr, OpenLyrics, plain text; one file opens in the editor, several are saved; SongSelect no longer offers an integration, so its downloads are the way in) · recycle bin (**done**) |
| v0.4 | Scripture (**done**: KJV and WEB built in, references like "Jn 3:16-18" or picking book / chapter / verses, passages split into slides with the reference on screen, shown live or added to a setlist; ESV, NIV, NASB and more with the church's own key from api.esv.org or API.Bible, passages kept for offline use) |
| v0.5 | Auto-update (**done**: the app checks GitHub's latest release every 6 hours and offers "Update to …" on the computer running it; updates are signed, releases are no longer marked pre-release so the updater finds them) |
| v0.7 | Video backgrounds (**done**: MP4, WebM or MOV up to 1 GB, streamed to disk; byte ranges; loop muted; stills in thumbnails; live preview plays; AppImage bundles GStreamer) |
| v1.0 | First-run guide (**done**; **v1.0.1:** a tour of each page, Show, Edit and Chords, explaining every panel and setting) · Notes and Stage panels (**done**) · polish (**done** for editor split/join, accessibility, layout; still to do on real Mac/Windows and .deb/.rpm updates) · song order per setlist (**done**) · **smooth video** (**done**: 4K scaled to 1080p, one thumbnail decoder at a time, GPU compositing kept on) · **launch video** (**done**: [`/brag`](https://github.com/latent-spaces/brag) film in the README) · **v1.0.2:** new logo and app icon, a Settings page with colour palettes (pick one, change any colour, save your own; the logo and app icon follow them) · **v1.0.3:** About shows the version and licence, and a privacy note lists every time the app goes online · **v1.0.4:** Report a bug and video stills work in the AppImage, hover colours, no black gap when changing video backgrounds · **v1.1.0:** title slides, drag the words and copyright line into place (or pick presets), background fades and preloading so changes are instant |
| v1.2 | Mac signing and notarisation (Apple Developer, US$99/yr) · Windows signing (Azure Trusted Signing) |

Until v1.2 the installers are unsigned, so Mac and Windows warn on first open (the README says how to open them anyway). After v1.0: countdown timer and messages, confidence monitor, video backgrounds, several outputs at different sizes, then R2.

## R2 — "Share with the team"

Accounts + cloud library (text and thumbnails always synced; full media stays on the home laptop) · setlist share links with chords · remote live control (sign-in + per-session room code; LAN stays the default) · ChordPro / OpenLyrics / plain-text import · Operate / Prepare modes · first-run guide · contributor docs.

## R3 — "Other churches"

Remote editing from another PC · team invites · opt-in media upload with temporary cloud copies · self-hostable cloud server (same Rust server, headless, one Docker image) · multiple output looks · undo · templates · timer + operator notes · more languages and scripts.

## Ideas to plan

Written down so they aren't lost; not scheduled yet.

- **Licensed song sources.** Bundled public-domain hymns, and any song service that offers an official API or licence for apps.

- **Panels in their own windows.** Drag a tab out of the console to open it in a new window, like a browser tab (for example a dedicated Chords window on a second screen). Every panel already gets its data from the embedded server, so a panel can be its own page (`/panel/chords`) in a native window. Dragging a tab past the window edge opens that window. About one or two sessions. Dockview's built-in popout uses `window.open`, which Tauri blocks by default, so our own windows are the sturdier route. A plain "Open in new window" tab action comes first.
- **Confidence monitor (stage display).** A screen for the band and speaker: current and next slide, chords, clock, timer and notes. Its layout can be rearranged by dragging blocks, like ProPresenter's stage layouts, and saved as presets.
- **New windows and pages.** Any view can be opened as a window on this computer or as a page on another device, from the Layout menu or the Display link.
- **Several screens of different sizes.** Configure each output separately: projector, stage monitor, TV or livestream. Each gets its own aspect ratio (16:9, 4:3, 16:10, ultrawide), resolution, look and what it shows, and the app remembers which screen gets which output. This builds on the screen picker and R3's "multiple output looks".
- **Several languages.** The UI comes in more languages (all text already goes through `t()`). Lyrics can show in two languages at once, e.g. English with Chinese, with a font and size per language. This extends R3's "more languages and scripts".

## Principles

- **LAN first.** Live control never needs the internet; the cloud is a fallback and a sharing layer.
- **The desktop app owns live state.** Every screen, including the app's own windows, is a web client of its embedded server.
- **Domain logic in TypeScript** (`app/src/domain/`), unit-tested. Rust stays a thin layer for state, storage and serving.
- **One data-access module.** UI components never call `fetch` or the WebSocket directly.
- **All UI text goes through `t()`** (`app/src/i18n/`).

## Known issues (KIV — deferred)

- **Dev builds need port 9100.** The Vite proxy targets it. Release builds fall back to other ports automatically.
