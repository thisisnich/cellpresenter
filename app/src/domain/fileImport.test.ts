import { describe, expect, it } from "vitest";
import { songFileFormat, songFromFile } from "./fileImport";
import { parseSongText } from "./songText";

const arrangement = (text: string) => parseSongText(text, { linesPerSlide: 2 }).arrangement;

// Shaped like a CCLI SongSelect ChordPro download.
const SONGSELECT_CHORDPRO = `{title: Way Maker}
{key: E}
{time: 4/4}
{tempo: 68}

{comment: Verse 1}
You are [E]here moving in our [B]midst
I [C#m]worship You I [A]worship You

{comment: Chorus}
Way [E]maker miracle [B]worker
Promise [C#m]keeper light in the [A]darkness

{comment: CCLI Song # 7115744}
{comment: Osinachi Kalu Okoro Egbu}
{comment: © 2016 Integrity Music Europe}
{comment: For use solely with the SongSelect® Terms of Use. All rights reserved. www.ccli.com}
{comment: CCLI License # 1234567}`;

const SONGSELECT_TEXT = `Way Maker

Verse 1
You are here moving in our midst
I worship You I worship You

Chorus
Way maker miracle worker
Promise keeper light in the darkness

Verse 2
You are here touching every heart

Chorus

CCLI Song # 7115744
Osinachi Kalu Okoro Egbu
© 2016 Integrity Music Europe
For use solely with the SongSelect® Terms of Use. All rights reserved. www.ccli.com
CCLI License # 1234567
`;

const USR = `[File]
Type=SongSelect Import File
Version=3.0
[S A7115744]
Title=Way Maker
Author=Osinachi Kalu Okoro Egbu | Someone Else
Copyright=© 2016 Integrity Music Europe
Keys=E
Fields=Verse 1/tChorus
Words=You are here moving in our midst/nI worship You/tWay maker miracle worker/nPromise keeper
`;

const OPENLYRICS = `<?xml version="1.0" encoding="UTF-8"?>
<song xmlns="http://openlyrics.info/namespace/2009/song" version="0.9">
  <properties>
    <titles><title>Amazing Grace</title></titles>
    <authors><author>John Newton</author></authors>
    <copyright>Public domain</copyright>
    <ccliNo>4755360</ccliNo>
    <key>G</key>
    <verseOrder>v1 c v2 c</verseOrder>
  </properties>
  <lyrics>
    <verse name="v1"><lines><chord name="G"/>Amazing grace how <chord name="C"/>sweet the sound<br/>That saved a wretch like me</lines></verse>
    <verse name="c"><lines>Praise &amp; glory<br/>To God</lines></verse>
    <verse name="v2"><lines>'Twas grace that taught</lines><lines>My heart to fear</lines></verse>
  </lyrics>
</song>`;

describe("songFileFormat", () => {
  it("tells the formats apart by their content", () => {
    expect(songFileFormat(SONGSELECT_CHORDPRO)).toBe("chordpro");
    expect(songFileFormat(SONGSELECT_TEXT)).toBe("songselect");
    expect(songFileFormat(USR)).toBe("usr");
    expect(songFileFormat(OPENLYRICS)).toBe("openlyrics");
    expect(songFileFormat("Just some words\nOn two lines")).toBe("text");
  });
});

describe("songFromFile", () => {
  it("reads a SongSelect ChordPro download with its credits", () => {
    const song = songFromFile("way-maker.chordpro", SONGSELECT_CHORDPRO)!;
    expect(song).toMatchObject({ title: "Way Maker", key: "E", artist: "Osinachi Kalu Okoro Egbu", ccli: "7115744" });
    expect(song.copyright).toBe("2016 Integrity Music Europe");
    expect(arrangement(song.text)).toEqual(["Verse 1", "Chorus"]);
    expect(song.text).not.toMatch(/CCLI|SongSelect/);
    expect(parseSongText(song.text, { linesPerSlide: 2 }).sections[0].slides[0][0].chords[0]).toEqual({ at: 8, chord: "E" });
  });

  it("reads SongSelect lyrics text", () => {
    const song = songFromFile("Way Maker.txt", SONGSELECT_TEXT)!;
    expect(song).toMatchObject({ title: "Way Maker", ccli: "7115744", copyright: "2016 Integrity Music Europe", format: "songselect" });
    expect(arrangement(song.text)).toEqual(["Verse 1", "Chorus", "Verse 2", "Chorus"]);
  });

  it("reads old SongSelect .usr files", () => {
    const song = songFromFile("way.usr", USR)!;
    expect(song).toMatchObject({
      title: "Way Maker",
      artist: "Osinachi Kalu Okoro Egbu, Someone Else",
      key: "E",
      ccli: "7115744",
      copyright: "2016 Integrity Music Europe",
    });
    expect(arrangement(song.text)).toEqual(["Verse 1", "Chorus"]);
  });

  it("reads OpenLyrics with chords, order and slides", () => {
    const song = songFromFile("amazing.xml", OPENLYRICS)!;
    expect(song).toMatchObject({ title: "Amazing Grace", artist: "John Newton", key: "G", ccli: "4755360", copyright: "Public domain" });
    const parsed = parseSongText(song.text, { linesPerSlide: 2 });
    expect(parsed.arrangement).toEqual(["Verse 1", "Chorus", "Verse 2", "Chorus"]);
    expect(parsed.sections[0].slides[0][0].chords.map((c) => c.chord)).toEqual(["G", "C"]);
    expect(parsed.sections[1].slides[0][0].text).toBe("Praise & glory");
    expect(parsed.sections[2].slides).toHaveLength(2);
  });

  it("names plain text after the file and skips empty files", () => {
    expect(songFromFile("C:\\songs\\Blessed Be.txt", "Blessed be Your name\nIn the land")?.title).toBe("Blessed Be");
    expect(songFromFile("empty.txt", "  \n")).toBeNull();
  });
});
