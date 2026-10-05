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
| 1. Groundwork | Bundled UI in release builds · server binds before windows open, port fallback in release · Tauri's async runtime · real page addresses (`/display`) · tests + CI · translatable UI text · parity list | **done** (branch `r1/groundwork`) |
| 2. Backend core + workspace | Split backend into a tested reducer · Dockview workspace shell with the A1 default layout and theme tokens (colours, radius, borders as CSS variables) · transpose + capo (TS) · smarter caching | caching done in step 1 |
| 3. Song library | SQLite with sync-ready ids (UUIDv7, `updated_at`, soft delete, `library_id`) · versioned live updates · PIN for controls · keyboard + clicker control · generated TS types | |
| 4. Content + live state | Paste lyrics → slides (explicit lines, font fits the longest line) · setlists + announcements · song arrangements · image backgrounds · live state holds pointers, not content | |
| 5. Screens + search | Live/Next previews · phone remote page · audience phone view · chords view for musicians · song search (own library, paste/URL import, public-domain hymns) | |

**Test for R1:** build a setlist from pasted chord sheets, run it from the console and a phone, and a musician's phone shows lyrics + chords in the transposed key.

## R2 — "Share with the team"

Accounts + cloud library (text and thumbnails always synced; full media stays on the home laptop) · setlist share links with chords · remote live control (sign-in + per-session room code; LAN stays the default) · ChordPro / OpenLyrics / plain-text import · Operate / Prepare modes · first-run guide · open-source licence + contributor docs.

## R3 — "Other churches"

Remote editing from another PC · team invites · opt-in media upload with temporary cloud copies · self-hostable cloud server (same Rust server, headless, one Docker image) · multiple output looks · undo · auto-update · Mac code signing · templates · timer + operator notes · more languages and scripts.

## Principles

- **LAN first.** Live control never needs the internet; the cloud is a fallback and a sharing layer.
- **The desktop app owns live state.** Every screen, including the app's own windows, is a web client of its embedded server.
- **Domain logic in TypeScript** (`app/src/domain/`), unit-tested. Rust stays a thin layer for state, storage and serving.
- **One data-access module.** UI components never call `fetch` or the WebSocket directly.
- **All UI text goes through `t()`** (`app/src/i18n/`).

## Known issues (KIV — deferred)

- **Cross-device line wrapping.** The stage guarantees proportional text size on every screen, but auto-wrapping still depends on font metrics, so engines can break lines differently. Fix lands with the song library in R1 step 4: store slides as explicit lines and size the font to fit the longest line.
- **Dev builds need port 9100.** The Vite proxy targets it. Release builds fall back to other ports automatically.
