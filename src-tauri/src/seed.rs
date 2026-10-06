//! Starter songs for a brand-new library. All public-domain hymn texts.

use crate::db::{new_id, Db, DbResult};
use crate::song::{LyricLine, SectionInput, SlideInput, SongInput};

fn slides(groups: &[&[&str]]) -> Vec<SlideInput> {
    groups
        .iter()
        .map(|lines| SlideInput {
            id: None,
            background_id: None,
            lines: lines
                .iter()
                .map(|t| LyricLine {
                    text: (*t).into(),
                    chords: vec![],
                })
                .collect(),
        })
        .collect()
}

fn section(id: &str, name: &str, groups: &[&[&str]]) -> SectionInput {
    SectionInput {
        id: Some(id.into()),
        name: name.into(),
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
        background_id: None,
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
                    "When peace like a river attendeth my way,",
                    "When sorrows like sea billows roll;",
                ],
                &[
                    "Whatever my lot, Thou hast taught me to say,",
                    "It is well, it is well with my soul.",
                ],
            ],
        ),
        section(
            &c,
            "Chorus",
            &[&[
                "It is well with my soul,",
                "It is well, it is well with my soul.",
            ]],
        ),
        section(
            &v2,
            "Verse 2",
            &[
                &[
                    "Though Satan should buffet, though trials should come,",
                    "Let this blest assurance control,",
                ],
                &[
                    "That Christ has regarded my helpless estate,",
                    "And hath shed His own blood for my soul.",
                ],
            ],
        ),
        section(
            &v3,
            "Verse 3",
            &[
                &[
                    "My sin, oh, the bliss of this glorious thought!",
                    "My sin, not in part but the whole,",
                ],
                &[
                    "Is nailed to the cross, and I bear it no more,",
                    "Praise the Lord, praise the Lord, O my soul!",
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
                    "Amazing grace! How sweet the sound",
                    "That saved a wretch like me!",
                ],
                &[
                    "I once was lost, but now am found;",
                    "Was blind, but now I see.",
                ],
            ],
        ),
        section(
            &new_id(),
            "Verse 2",
            &[
                &[
                    "'Twas grace that taught my heart to fear,",
                    "And grace my fears relieved;",
                ],
                &[
                    "How precious did that grace appear",
                    "The hour I first believed.",
                ],
            ],
        ),
        section(
            &new_id(),
            "Verse 3",
            &[
                &[
                    "Through many dangers, toils and snares,",
                    "I have already come;",
                ],
                &[
                    "'Tis grace hath brought me safe thus far,",
                    "And grace will lead me home.",
                ],
            ],
        ),
        section(
            &new_id(),
            "Verse 4",
            &[
                &[
                    "When we've been there ten thousand years,",
                    "Bright shining as the sun,",
                ],
                &[
                    "We've no less days to sing God's praise",
                    "Than when we'd first begun.",
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
                    "Holy, holy, holy! Lord God Almighty!",
                    "Early in the morning our song shall rise to Thee;",
                ],
                &[
                    "Holy, holy, holy, merciful and mighty!",
                    "God in three Persons, blessed Trinity!",
                ],
            ],
        ),
        section(
            &new_id(),
            "Verse 2",
            &[
                &[
                    "Holy, holy, holy! All the saints adore Thee,",
                    "Casting down their golden crowns around the glassy sea;",
                ],
                &[
                    "Cherubim and seraphim falling down before Thee,",
                    "Which wert, and art, and evermore shalt be.",
                ],
            ],
        ),
        section(
            &new_id(),
            "Verse 3",
            &[
                &[
                    "Holy, holy, holy! Though the darkness hide Thee,",
                    "Though the eye of sinful man Thy glory may not see;",
                ],
                &[
                    "Only Thou art holy; there is none beside Thee,",
                    "Perfect in power, in love, and purity.",
                ],
            ],
        ),
        section(
            &new_id(),
            "Verse 4",
            &[
                &[
                    "Holy, holy, holy! Lord God Almighty!",
                    "All Thy works shall praise Thy name, in earth, and sky, and sea;",
                ],
                &[
                    "Holy, holy, holy; merciful and mighty!",
                    "God in three Persons, blessed Trinity!",
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
    }
}
