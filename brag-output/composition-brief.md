# Hyperframes Composition Brief: CellPresenter

## Objective
Create a short launch-style brag video for CellPresenter.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape — 1920x1080
- Duration: 21 seconds

## Source Material
- Project root: the CellPresenter repo
- Primary files read: README.md, app/src/theme/tokens.ts, app/src/index.css, app/src/display/SlideBackground.tsx
- Product name: CellPresenter
- Tagline / strongest claim: Free, open-source worship lyrics presenter. Lyrics on a projector. Chords in their own key. On your own Wi-Fi.
- Key UI or visual moment to recreate: a full-frame lyric slide, then the setlist with an amber live ring, then a phone remote and a chord sheet
- Copy that must appear verbatim:
  - Amazing grace
  - how sweet the sound
  - CellPresenter
  - Free. On your own Wi-Fi.

## Creative Direction
- Tone preset: polished
- Creative direction: quiet Sunday-night product film
- Interpretation: four scenes, long holds, soft fades, mixed case
- Angle: show the product in a cell group, not a feature list
- Hook: the lyric, before the name
- Outro / punchline: CellPresenter. Lyrics on the screen. Chords in their key. Free. On your own Wi-Fi.
- Avoid:
  - Generic SaaS language
  - Abstract filler visuals
  - Unrelated visual redesign
  - Real names, real PINs, or church data. The remote PIN 4821 is fictional.

## Visual Identity
- Background: #17181A
- Text: #ECECEE
- Accent: #F5A524
- Next: #6EA8FF
- On live: #1A1206
- Panel: #1B1C1F
- Chrome: #1F2023
- Line: #2C2E33
- Muted: #A0A3AA
- Display font: Lora, from the project's font package
- Body font: Geist, from the project's font package
- Visual references from the project: Graphite theme, amber live ring, lyric slide with a darkened full-bleed field

## Storyboard
Use the storyboard in `brag-output/brag-plan.md` as the creative contract.

Scene summary:
1. Lyric — 5.5s — Amazing Grace on a display, LIVE mark
2. Setlist — 5.0s — three rows, Amazing Grace live
3. Phones — 5.5s — remote and chord sheet
4. Name — 5.0s — CellPresenter and the claim

## Audio
- Audio role: warm bed
- Audio arc: fade in, stay under the picture, fade out on the name
- Music: assets/music/happy-beats-business-moves-vol-11-by-ende-dot-app.mp3
- Music treatment: volume rises over 0.6s to a low bed, holds, falls over the last 1.4s
- Music cue guidance: bundled vol-11 preset. Optional locks at 1.60s (lyric), 5.80s (live row), 17.91s (name).
- Audio-reactive treatment: subtle; bass and RMS drive the amber wash opacity. No waveform.
- Audio-coupled moments:
  - lyric — soft impact
  - live row — click
  - first phone — click
  - name — warm bong
- SFX selection guidance: low high-frequency risk, from the brag analysis. impactSoft_medium_001, click_003, bong_001.
- SFX analysis guidance: skills/brag/assets/sfx/sfx-analysis.md in the brag repo
- Exact SFX choice: those three files, sparse
- Audio files: copied into `brag-output/composition/assets/`

## Hyperframes Instructions
This is a /brag film. Do not reopen the Hyperframes intent interview. Keep it local. Run `npx hyperframes check` before render.
