# CellPresenter

Free, open-source worship lyrics presenter, made for cell groups and small churches. Put lyrics on a projector, TV or everyone's phones. Change slides from your phone. Give the musicians chords in their own key. Everything runs on your own computer and Wi-Fi, so no internet or account is needed.

> **Status: early preview (v0.x).** It works for a cell group night, but expect rough edges. Back up your library (see [Your data](#your-data)) and [report problems](https://github.com/thisisnich/cellpresenter/issues).

## What it does

- **Songs:** paste lyrics (with or without chords) and they become slides. Sections (verse, chorus, bridge) are colour-coded, and arrangements can repeat them (V1 C V2 C B C).
- **Find songs online:** search for a song's lyrics (from LRCLIB), or paste a link to a chord sheet on Ultimate Guitar. The song opens in the editor already split into sections and slides, with repeats worked out, so you only check it and save.
- **Scripture:** the King James Version and the World English Bible are built in, so they work offline. Type a reference like `John 3:16-18`, `1 Cor 13` or `Ps 23:1-4, 6`, or pick a book, chapter and verses; the passage is split into slides with the reference on screen. Show it straight away or add it to the setlist.
- **Setlists:** build tonight's list of songs and announcements. Preview a song before it goes live, and Next carries on into the next item.
- **Backgrounds:** pictures work like in ProPresenter. Click one to put it on screen, or cue it on a slide or a whole section so it switches when that part comes up.
- **Any screen is a display:** the projector window, a TV, or phones and tablets. Every screen shows the same layout. Press **F** on the Display (or double-click it) to fill the screen; **F** or **Esc** again brings the window back.
- **Your look:** the **Screen** panel sets the font (five included), bold, ALL CAPS, colour, shadow, where the words sit (top, middle or lower third for livestreams) and the margins, for every screen at once.
- **Phone remote:** scan a QR code, and your phone becomes the clicker and song picker. It's protected by a 4-digit PIN.
- **Chords for musicians:** each musician opens the chords view on their own phone and picks their key and capo. The view follows the live slide, and tapping a chord shows the guitar shapes for it.
- **Clickers and keyboard:** arrow keys, Space and Page Up/Down change slides, so most presentation clickers work too. **N** and **P** jump to the next or previous setlist item, and **B** blanks the screen.

Starter songs (public-domain hymns) are included so you can try it straight away.

## Install

Download the installer for your computer from the [latest release](https://github.com/thisisnich/cellpresenter/releases).

| Computer | File |
|---|---|
| Mac with Apple Silicon (M1 and later) | `CellPresenter_x.y.z_aarch64.dmg` |
| Mac with Intel | `CellPresenter_x.y.z_x64.dmg` |
| Windows 10/11 | `CellPresenter_x.y.z_x64-setup.exe` |
| Linux, any distro | `CellPresenter_x.y.z_amd64.AppImage` |
| Ubuntu / Debian | `.deb` |
| Fedora | `.rpm` |

The apps aren't code-signed yet, so your computer will warn you the first time:

- **Mac:** open the `.dmg` and drag CellPresenter to Applications. The first time, right-click the app, choose **Open**, then **Open** again. If macOS says the app "is damaged", run this once in Terminal:
  ```sh
  xattr -cr /Applications/CellPresenter.app
  ```
- **Windows:** if SmartScreen says "Windows protected your PC", click **More info**, then **Run anyway**.
- **Linux (AppImage):** make it executable with `chmod +x CellPresenter_*.AppImage`, then run it.

When the app first starts, allow it through the firewall if asked, so phones and tablets can connect. It listens on port 9100 (or the next free port up to 9109).

## Using it

1. **Open CellPresenter.** Two windows open: the **Console**, where you run everything, and the **Display**, which is what the audience sees. Plug in the projector or TV. Then, at the top of the Console's **Live output** panel, choose **Fullscreen on screen 2** (or whichever screen it is). Choosing it again also brings the Display back if you closed it.
2. **Add songs.** On the **Edit** page, open **Find songs**:
   - **Lyrics:** type the title, press **Search** and pick a result.
   - **Chords:** press **Search on Ultimate Guitar**, find the song in your browser, copy the page's link and paste it into the search box.

   The song opens in the editor, split into slides; check it and press **Save**. Or click **+ New song** in the Library and paste the song yourself.

   **Song files:** press **Import…** in the Library (or drop files on it) to bring in ChordPro, CCLI SongSelect downloads (ChordPro, lyrics text or `.usr`), OpenLyrics (exported by OpenLP and others) or plain text. One file opens in the editor; several are saved straight to the library. Titles, writers, keys, copyright and CCLI numbers come along. A line like `[Chorus]` starts a section. Chords can sit above the words or inline, like `[G]Amazing [C]grace`.
3. **Make a setlist.** In the Setlist panel press **New**. Add songs from the Library with **+**, and notices with **+ Announcement**.
4. **Present.** Click a slide to show it. Use **Next / Prev**, the arrow keys or a clicker. **Clear text** and **Clear background** clear the screen, and **Black out** blanks it.
5. **Connect phones.** Press **Display link** in the top-right corner. Each device must be on the same Wi-Fi as the computer.
   - **Display:** a phone or TV becomes another screen.
   - **Remote control:** your phone controls the slides. The QR code includes the PIN.
   - **Chords:** musicians get lyrics with chords that follow along.

If phones can't connect, the Wi-Fi may stop devices from reaching each other. This is common on guest, school and office networks. Try a phone hotspot, or [Tailscale](https://tailscale.com).

Deleted songs and setlists go to the **Recycle bin** panel (Edit page), where **Restore** brings them back.

## Song licences

Songs belong to their writers and publishers. Projecting a song at church usually needs a licence, such as a [CCLI](https://ccli.com) Church Copyright Licence; check what applies where you are. Only import songs you have the rights to use.

CCLI asks for a copyright line on screen. Fill in each song's **Copyright** and **CCLI song #** in the song editor, and your church's licence number in the **Screen** panel (next to Live output). The line shows on a song's first slide, every slide, or not at all, centred along the bottom or small in the bottom corner.

Bible translations: the World English Bible is public domain, and the King James Version is public domain everywhere except the UK, where the Crown's letters patent cover it. Both come from [eBible.org](https://ebible.org) (`scripts/bibles.py` rebuilds them).

CellPresenter isn't affiliated with Ultimate Guitar or LRCLIB. It fetches only the song you pick, when you pick it; it never searches Ultimate Guitar itself, and it ships no song content except public-domain hymns. Ultimate Guitar's terms allow personal, non-commercial use of its content, so whether you may use a sheet from there is between you and them.

## Your data

**Backups:** everything (songs, setlists, settings and pictures) is backed up once a day when the app starts, to `CellPresenter Backups` in your Documents folder; the last 7 automatic backups are kept. On the **Edit** page, the **Backups** panel has **Back up now**, a list of backups to restore, and **Restore from a file…** to bring a `.cpbackup` file from another computer. Restoring brings back the songs, setlists and pictures in the backup as they were, and keeps anything added since.

The library itself is one file, `library.db`, with pictures in the `media` folder next to it:

| System | Folder |
|---|---|
| Mac | `~/Library/Application Support/dev.cellpresenter.desktop/` |
| Windows | `%APPDATA%\dev.cellpresenter.desktop\` |
| Linux | `~/.local/share/dev.cellpresenter.desktop/` |

## Roadmap

R1 (now) gets a cell group night running. R2 adds sharing with the team: a cloud library, setlist links and remote control from anywhere. R3 is about other churches: team invites, a self-hostable server and more. See [ROADMAP.md](ROADMAP.md).

## Building from source

You need [Node.js](https://nodejs.org) 22+, [Rust](https://rustup.rs) (stable) and the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your system.

```sh
npm ci
npm run tauri dev       # run the app with hot reload
npm run tauri build     # build installers into src-tauri/target/release/bundle
```

Checks (CI runs the same):

```sh
npm run check && npm run build                       # typecheck, tests, web build
cd src-tauri && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test
```

How it fits together:

- `src-tauri/` holds the desktop app (Tauri v2). It embeds a small web server (axum) that owns the live state and the SQLite song library, and serves the web app to the app's own windows and to every phone on the network.
- `app/` holds the web app (React, Vite, Tailwind), one build for every view: console `/`, display `/display`, phone remote `/remote` and chords `/chords`.
  - `app/src/domain/` has the song, chord and setlist logic as unit-tested TypeScript.
  - `app/src/i18n/` holds all UI text.
  - `app/src/theme/` holds every colour and size as a theme token.
- `app/src/generated/` contains TypeScript types generated from the Rust types by `cargo test`. Commit them when they change.

### Releasing

Bump the version in `package.json`, `src-tauri/Cargo.toml` and `src-tauri/tauri.conf.json`, then tag and push it:

```sh
git tag v0.1.0 && git push origin v0.1.0
```

The [Release workflow](.github/workflows/release.yml) builds the Mac, Windows and Linux installers and attaches them to a **draft** release. Check the draft, then publish it. Running the workflow by hand ("Run workflow") builds the installers without a release, to test a build.

## Licence

CellPresenter is free software under the [GNU Affero General Public License v3.0 or later](LICENSE). You may use, share and change it. If you distribute it, or run a changed version for others over a network, you must share your source code under the same licence.
