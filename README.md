# CellPresenter

Free, open-source worship lyrics presenter, made for cell groups and small churches. Put lyrics on a projector, TV or everyone's phones. Change slides from your phone. Give the musicians chords in their own key. Everything runs on your own computer and Wi-Fi, so no internet or account is needed.

> **Status: early preview (v0.x).** It works for a cell group night, but expect rough edges. Back up your library (see [Your data](#your-data)) and [report problems](https://github.com/thisisnich/cellpresenter/issues).

## What it does

- **Songs:** paste lyrics (with or without chords) and they become slides. Sections (verse, chorus, bridge) are colour-coded, and arrangements can repeat them (V1 C V2 C B C).
- **Find songs online:** search for a song's chords (from Ultimate Guitar) or lyrics (from LRCLIB), or paste an Ultimate Guitar link. The song opens in the editor already split into sections and slides, with repeats worked out, so you only check it and save.
- **Setlists:** build tonight's list of songs and announcements. Preview a song before it goes live, and Next carries on into the next item.
- **Backgrounds:** pictures work like in ProPresenter. Click one to put it on screen, or cue it on a slide or a whole section so it switches when that part comes up.
- **Any screen is a display:** the projector window, a TV, or phones and tablets. Every screen shows the same layout.
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
2. **Add songs.** On the **Edit** page, open **Find songs**, search for the title and pick a result. It opens in the editor, split into slides; check it and press **Save**. Or click **+ New song** in the Library and paste the lyrics yourself. A line like `[Chorus]` starts a section. Chords can sit above the words or inline, like `[G]Amazing [C]grace`. To project songs you may need a licence, such as CCLI.
3. **Make a setlist.** In the Setlist panel press **New**. Add songs from the Library with **+**, and notices with **+ Announcement**.
4. **Present.** Click a slide to show it. Use **Next / Prev**, the arrow keys or a clicker. **Clear text** and **Clear background** clear the screen, and **Black out** blanks it.
5. **Connect phones.** Press **Display link** in the top-right corner. Each device must be on the same Wi-Fi as the computer.
   - **Display:** a phone or TV becomes another screen.
   - **Remote control:** your phone controls the slides. The QR code includes the PIN.
   - **Chords:** musicians get lyrics with chords that follow along.

If phones can't connect, the Wi-Fi may stop devices from reaching each other. This is common on guest, school and office networks. Try a phone hotspot, or [Tailscale](https://tailscale.com).

## Your data

Songs, setlists and settings live in one file, `library.db`. Pictures are in the `media` folder next to it. To back up, copy both while the app is closed.

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
