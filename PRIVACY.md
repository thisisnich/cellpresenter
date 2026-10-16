# Privacy

CellPresenter runs on your own computer. There are no accounts, no
analytics and no tracking, and nothing you make in it is sent to the
people who make it. This page lists everything the app does that reaches
beyond your computer, so you can check.

## What stays on your computer

Your songs, setlists, settings, pictures and videos are kept on the
computer running CellPresenter, in the folders listed under
[Your data](README.md#your-data) in the README, with daily backups in
`CellPresenter Backups` in your Documents folder.

Colour settings are kept in each device's own browser storage.

On Linux, choosing a colour palette also rewrites CellPresenter's own icon
files in your home folder (`~/.local/share/icons/hicolor/…/cellpresenter.png`,
and the icon an AppImage launcher points to), so the taskbar shows the new
colours.

## Your local network

Phones, tablets and other screens connect straight to the computer running
CellPresenter over your Wi-Fi or local network. Nothing goes through the
internet. Changing slides or songs from a phone needs the 4-digit PIN shown
on the console. Anyone on the same network who opens the display or chords
link can see what's on screen, as they could in the room.

## When the app goes online

CellPresenter only reaches the internet for these things. Each one sends
only what it needs, with no information about you or your church.

| What | When | Sent to | What it sends |
|---|---|---|---|
| Update check | When the console opens, then every 6 hours, on the computer running the app | GitHub (`github.com`) | A request for the latest release's details |
| Downloading an update | Only when you press **Update to …** | GitHub | A request for the installer |
| Song lyrics search | When you search in **Find songs** | [LRCLIB](https://lrclib.net) | The words you searched for |
| Chord sheet from a link | When you paste an Ultimate Guitar link | [Ultimate Guitar](https://www.ultimate-guitar.com) | A request for that one page |
| Copyrighted Bibles (ESV, NIV, NASB, …) | When you look up a passage that isn't kept yet | [api.esv.org](https://api.esv.org) or [API.Bible](https://api.bible) | The reference, and your church's own API key |

Song searches and chord-sheet requests identify themselves as CellPresenter
and its version. Like any website, these services see your internet
address. Their own privacy policies apply to what they do with requests.

Bible passages you've looked up are kept on your computer, so a prepared
service works offline. API keys you paste in are stored in your library on
your computer (and so in its backups), and sent only to the service they
belong to.

The built-in Bibles (King James Version and World English Bible) work
entirely offline.

## Links that open your browser

**Report a bug**, **Suggest a feature**, **Buy me a coffee**, **Read the
licence**, **Privacy** and the Ultimate Guitar search button open a page in
your web browser (GitHub, Ko-fi or Ultimate Guitar). The app sends
nothing itself. A bug report form arrives with your CellPresenter version
and operating system filled in, and you can see and change everything
before you submit it. Those sites' own privacy policies apply.

## Changes

If a new version of CellPresenter starts reaching anywhere else, this page
will say so first.

Questions: [open an issue](https://github.com/thisisnich/cellpresenter/issues).
