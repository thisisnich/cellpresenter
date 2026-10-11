//! Starter songs for a brand-new library. All public-domain hymn texts.

use crate::db::{new_id, Db, DbResult};
use crate::song::{ChordMark, LyricLine, SectionInput, SlideInput, SongInput};

/// A line written with inline chords, `[C]` before the syllable the chord
/// starts on. Positions count characters, like the editor does.
fn line(inline: &str) -> LyricLine {
    let mut text = String::new();
    let mut chords = vec![];
    let mut rest = inline;
    while let Some(open) = rest.find('[') {
        text.push_str(&rest[..open]);
        let close = open + rest[open..].find(']').expect("unclosed chord");
        chords.push(ChordMark {
            at: text.chars().count() as u32,
            chord: rest[open + 1..close].into(),
        });
        rest = &rest[close + 1..];
    }
    text.push_str(rest);
    LyricLine { text, chords }
}

fn slides(groups: &[&[&str]]) -> Vec<SlideInput> {
    groups
        .iter()
        .map(|lines| SlideInput {
            id: None,
            background_id: None,
            lines: lines.iter().map(|t| line(t)).collect(),
        })
        .collect()
}

fn section(id: &str, name: &str, groups: &[&[&str]]) -> SectionInput {
    SectionInput {
        id: Some(id.into()),
        name: name.into(),
        background_id: None,
        slides: slides(groups),
    }
}

fn hymn(
    title: &str,
    artist: &str,
    key: &str,
    sections: Vec<SectionInput>,
    arrangement: Option<Vec<String>>,
) -> SongInput {
    SongInput {
        title: title.into(),
        artist: Some(artist.into()),
        key: Some(key.into()),
        capo: 0,
        ccli_number: None,
        copyright: Some("Public domain".into()),
        arrangement,
        sections,
    }
}

fn it_is_well() -> SongInput {
    let [v1, c, v2, v3] = [new_id(), new_id(), new_id(), new_id()];
    let sections = vec![
        section(
            &v1,
            "Verse 1",
            &[
                &[
                    "When [C]peace like a river at[F]tendeth my [C]way,",
                    "When [C]sorrows like sea billows [G]roll;",
                ],
                &[
                    "What[C]ever my lot, Thou hast [F]taught me to [C]say,",
                    "It is [G]well, it is [G7]well with my [C]soul.",
                ],
            ],
        ),
        section(
            &c,
            "Chorus",
            &[&[
                "It is [G7]well [C]with my soul,",
                "It is [F]well, it is [G7]well with my [C]soul.",
            ]],
        ),
        section(
            &v2,
            "Verse 2",
            &[
                &[
                    "Though [C]Satan should buffet, though [F]trials should [C]come,",
                    "Let [C]this blest assurance con[G]trol,",
                ],
                &[
                    "That [C]Christ has regarded my [F]helpless es[C]tate,",
                    "And hath [G]shed His own [G7]blood for my [C]soul.",
                ],
            ],
        ),
        section(
            &v3,
            "Verse 3",
            &[
                &[
                    "My [C]sin, oh, the bliss of this [F]glorious [C]thought!",
                    "My [C]sin, not in part but the [G]whole,",
                ],
                &[
                    "Is [C]nailed to the cross, and I [F]bear it no [C]more,",
                    "Praise the [G]Lord, praise the [G7]Lord, O my [C]soul!",
                ],
            ],
        ),
    ];
    let arrangement = vec![v1, c.clone(), v2, c.clone(), v3, c];
    hymn(
        "It Is Well",
        "Horatio Spafford",
        "C",
        sections,
        Some(arrangement),
    )
}

fn amazing_grace() -> SongInput {
    let sections = vec![
        section(
            &new_id(),
            "Verse 1",
            &[
                &[
                    "A[G]mazing [G7]grace! How [C]sweet the [G]sound",
                    "That [G]saved a wretch like [D]me!",
                ],
                &[
                    "I [G]once was [G7]lost, but [C]now am [G]found;",
                    "Was [Em]blind, but [D]now I [G]see.",
                ],
            ],
        ),
        section(
            &new_id(),
            "Verse 2",
            &[
                &[
                    "'Twas [G]grace that [G7]taught my [C]heart to [G]fear,",
                    "And [G]grace my fears re[D]lieved;",
                ],
                &[
                    "How [G]precious [G7]did that [C]grace ap[G]pear",
                    "The [Em]hour I [D]first be[G]lieved.",
                ],
            ],
        ),
        section(
            &new_id(),
            "Verse 3",
            &[
                &[
                    "Through [G]many [G7]dangers, [C]toils and [G]snares,",
                    "I [G]have already [D]come;",
                ],
                &[
                    "'Tis [G]grace hath [G7]brought me [C]safe thus [G]far,",
                    "And [Em]grace will [D]lead me [G]home.",
                ],
            ],
        ),
        section(
            &new_id(),
            "Verse 4",
            &[
                &[
                    "When [G]we've been [G7]there ten [C]thousand [G]years,",
                    "Bright [G]shining as the [D]sun,",
                ],
                &[
                    "We've [G]no less [G7]days to [C]sing God's [G]praise",
                    "Than [Em]when we'd [D]first be[G]gun.",
                ],
            ],
        ),
    ];
    hymn("Amazing Grace", "John Newton", "G", sections, None)
}

fn holy_holy_holy() -> SongInput {
    let sections = vec![
        section(
            &new_id(),
            "Verse 1",
            &[
                &[
                    "[D]Holy, holy, [Bm]holy! [D]Lord God Al[A]mighty!",
                    "[D]Early in the [Bm]morning our [E]song shall rise to [A]Thee;",
                ],
                &[
                    "[D]Holy, holy, [Bm]holy, [G]merciful and [D]mighty!",
                    "[G]God in three [D]Persons, [A7]blessed [D]Trinity!",
                ],
            ],
        ),
        section(
            &new_id(),
            "Verse 2",
            &[
                &[
                    "[D]Holy, holy, [Bm]holy! [D]All the saints a[A]dore Thee,",
                    "[D]Casting down their [Bm]golden crowns a[E]round the glassy [A]sea;",
                ],
                &[
                    "[D]Cherubim and [Bm]seraphim [G]falling down be[D]fore Thee,",
                    "[G]Which wert, and [D]art, and [A7]evermore shalt [D]be.",
                ],
            ],
        ),
        section(
            &new_id(),
            "Verse 3",
            &[
                &[
                    "[D]Holy, holy, [Bm]holy! [D]Though the darkness [A]hide Thee,",
                    "[D]Though the eye of [Bm]sinful man Thy [E]glory may not [A]see;",
                ],
                &[
                    "[D]Only Thou art [Bm]holy; there is [G]none beside [D]Thee,",
                    "[G]Perfect in [D]power, in [A7]love, and [D]purity.",
                ],
            ],
        ),
        section(
            &new_id(),
            "Verse 4",
            &[
                &[
                    "[D]Holy, holy, [Bm]holy! [D]Lord God Al[A]mighty!",
                    "[D]All Thy works shall [Bm]praise Thy name, in [E]earth, and sky, and [A]sea;",
                ],
                &[
                    "[D]Holy, holy, [Bm]holy; [G]merciful and [D]mighty!",
                    "[G]God in three [D]Persons, [A7]blessed [D]Trinity!",
                ],
            ],
        ),
    ];
    hymn("Holy, Holy, Holy", "Reginald Heber", "D", sections, None)
}

/// Add the starter songs if this library has never had any.
pub async fn seed_if_empty(db: &Db) -> DbResult<()> {
    if !db.is_empty().await? {
        return Ok(());
    }
    for song in [it_is_well(), amazing_grace(), holy_holy_holy()] {
        db.create_song(&song).await?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn seeds_once_with_arrangement_intact() {
        let db = Db::in_memory().await.unwrap();
        seed_if_empty(&db).await.unwrap();
        seed_if_empty(&db).await.unwrap();
        let songs = db.list_songs().await.unwrap();
        assert_eq!(songs.len(), 3);

        let well = songs.iter().find(|s| s.title == "It Is Well").unwrap();
        let song = db.get_song(&well.id).await.unwrap().unwrap();
        let sections: Vec<_> = song
            .live_slides(|_| None)
            .into_iter()
            .map(|s| s.section)
            .collect();
        assert_eq!(
            sections,
            [
                "Verse 1", "Verse 1", "Chorus", "Verse 2", "Verse 2", "Chorus", "Verse 3",
                "Verse 3", "Chorus"
            ]
        );
        assert_eq!(song.key.as_deref(), Some("C"));
        let first = &song.sections[0].slides[0].lines[0];
        assert_eq!(first.text, "When peace like a river attendeth my way,");
        assert_eq!(
            first.chords,
            [
                ChordMark {
                    at: 5,
                    chord: "C".into()
                },
                ChordMark {
                    at: 26,
                    chord: "F".into()
                },
                ChordMark {
                    at: 37,
                    chord: "C".into()
                },
            ]
        );
    }
}
