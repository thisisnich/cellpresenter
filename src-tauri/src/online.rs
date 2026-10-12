//! Finding songs online: chord sheets from Ultimate Guitar and plain lyrics
//! from LRCLIB. The server only fetches and unpacks what the sites send; the
//! web app turns the text into sections and slides (`domain/importing.ts`).
//!
//! Requests only ever go to these fixed sites, built from ids the server
//! checks, so a client can't use this to reach anything else.

use std::sync::OnceLock;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use ts_rs::TS;

const UG_SEARCH: &str = "https://www.ultimate-guitar.com/search.php";
const UG_TABS: &str = "https://tabs.ultimate-guitar.com/tab/";
const LRCLIB: &str = "https://lrclib.net/api/";
const USER_AGENT: &str = concat!(
    "CellPresenter/",
    env!("CARGO_PKG_VERSION"),
    " (+https://github.com/thisisnich/cellpresenter)"
);
/// Results kept per site, best first.
const MAX_HITS: usize = 20;

/// Where a song comes from.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum Source {
    /// Chord sheets (chords above the lyrics), written by users.
    UltimateGuitar,
    /// Plain lyrics, no chords.
    Lrclib,
}

/// One search result.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct SearchHit {
    pub source: Source,
    /// What `fetch` takes: a tab's path on Ultimate Guitar, a track id on LRCLIB.
    pub id: String,
    pub title: String,
    pub artist: Option<String>,
    /// The key the sheet is written in, if the site says.
    pub key: Option<String>,
    /// Average rating out of 5, and how many people rated it.
    pub rating: Option<f32>,
    pub votes: Option<u32>,
    /// Which of several sheets for the same song (Ultimate Guitar numbers them).
    pub version: Option<u32>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct SearchResults {
    pub hits: Vec<SearchHit>,
    /// Sites that couldn't be reached; their results are missing.
    pub failed: Vec<Source>,
}

/// A song as a site has it: the text is the site's own, cleaned up by the
/// web app.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct OnlineSong {
    pub source: Source,
    pub id: String,
    pub title: String,
    pub artist: Option<String>,
    pub key: Option<String>,
    pub capo: Option<u8>,
    pub text: String,
    /// The page to credit or open in a browser.
    pub url: String,
}

#[derive(Debug)]
pub enum OnlineError {
    /// The id isn't one this site uses.
    BadId,
    /// No such song.
    NotFound,
    /// The site couldn't be reached or sent something unexpected.
    Unavailable(String),
}

fn client() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .user_agent(USER_AGENT)
            .timeout(Duration::from_secs(15))
            .build()
            .expect("HTTP client")
    })
}

async fn get_text(url: &str, query: &[(&str, &str)]) -> Result<String, OnlineError> {
    let send = || client().get(url).query(query).send();
    // Busy sites answer 503 now and then; one more try usually gets through.
    let res = match send().await {
        Ok(res) if !res.status().is_server_error() => Ok(res),
        _ => {
            tokio::time::sleep(Duration::from_millis(600)).await;
            send().await
        }
    }
    .map_err(|e| OnlineError::Unavailable(e.to_string()))?;
    if res.status() == reqwest::StatusCode::NOT_FOUND {
        return Err(OnlineError::NotFound);
    }
    let res = res
        .error_for_status()
        .map_err(|e| OnlineError::Unavailable(e.to_string()))?;
    res.text()
        .await
        .map_err(|e| OnlineError::Unavailable(e.to_string()))
}

/// Search every site at once. A site that fails is listed in `failed`.
pub async fn search(query: &str) -> SearchResults {
    let (ug, lrc) = tokio::join!(search_ug(query), search_lrclib(query));
    let mut results = SearchResults {
        hits: Vec::new(),
        failed: Vec::new(),
    };
    for (source, found) in [(Source::UltimateGuitar, ug), (Source::Lrclib, lrc)] {
        match found {
            Ok(hits) => results.hits.extend(hits),
            Err(e) => {
                eprintln!("cellpresenter: song search on {source:?} failed: {e:?}");
                results.failed.push(source);
            }
        }
    }
    results
}

pub async fn fetch(source: Source, id: &str) -> Result<OnlineSong, OnlineError> {
    match source {
        Source::UltimateGuitar => {
            if !valid_ug_path(id) {
                return Err(OnlineError::BadId);
            }
            let url = format!("{UG_TABS}{id}");
            let page = get_text(&url, &[]).await?;
            ug_song(&page, id, url)
        }
        Source::Lrclib => {
            let n: u64 = id.parse().map_err(|_| OnlineError::BadId)?;
            let body = get_text(&format!("{LRCLIB}get/{n}"), &[]).await?;
            let track: Value =
                serde_json::from_str(&body).map_err(|e| OnlineError::Unavailable(e.to_string()))?;
            lrclib_song(&track).ok_or(OnlineError::NotFound)
        }
    }
}

// ---------- Ultimate Guitar ----------

async fn search_ug(query: &str) -> Result<Vec<SearchHit>, OnlineError> {
    let page = get_text(UG_SEARCH, &[("search_type", "title"), ("value", query)]).await?;
    let store = ug_store(&page)?;
    Ok(ug_hits(&store))
}

/// A tab's path, like "leeland/way-maker-chords-2806757": artist and tab.
fn valid_ug_path(path: &str) -> bool {
    let mut parts = path.split('/');
    let ok = |p: Option<&str>| {
        p.is_some_and(|p| {
            !p.is_empty()
                && p.chars()
                    .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
        })
    };
    ok(parts.next()) && ok(parts.next()) && parts.next().is_none()
}

/// Ultimate Guitar pages carry their data as JSON in a `js-store` element.
fn ug_store(page: &str) -> Result<Value, OnlineError> {
    let unexpected = || OnlineError::Unavailable("unexpected page".into());
    let start = page.find("class=\"js-store\"").ok_or_else(unexpected)?;
    let attr = "data-content=\"";
    let from = start + page[start..].find(attr).ok_or_else(unexpected)? + attr.len();
    let len = page[from..].find('"').ok_or_else(unexpected)?;
    serde_json::from_str(&unescape_html(&page[from..from + len]))
        .map_err(|e| OnlineError::Unavailable(e.to_string()))
}

fn page_data(store: &Value) -> &Value {
    &store["store"]["page"]["data"]
}

/// Chord sheets from a search page, most votes first. Tabs, bass and paid
/// "Pro" versions are left out.
fn ug_hits(store: &Value) -> Vec<SearchHit> {
    let mut hits: Vec<SearchHit> = page_data(store)["results"]
        .as_array()
        .map(Vec::as_slice)
        .unwrap_or_default()
        .iter()
        .filter(|r| r["type"].as_str() == Some("Chords"))
        .filter_map(|r| {
            let path = r["tab_url"].as_str()?.strip_prefix(UG_TABS)?;
            if !valid_ug_path(path) {
                return None;
            }
            Some(SearchHit {
                source: Source::UltimateGuitar,
                id: path.to_string(),
                title: r["song_name"].as_str()?.to_string(),
                artist: non_empty(&r["artist_name"]),
                key: non_empty(&r["tonality_name"]),
                rating: r["rating"].as_f64().map(|x| x as f32),
                votes: r["votes"].as_u64().map(|x| x as u32),
                version: r["version"].as_u64().map(|x| x as u32),
            })
        })
        .collect();
    hits.sort_by_key(|h| std::cmp::Reverse(h.votes.unwrap_or(0)));
    hits.truncate(MAX_HITS);
    hits
}

fn ug_song(page: &str, path: &str, url: String) -> Result<OnlineSong, OnlineError> {
    let store = ug_store(page)?;
    let data = page_data(&store);
    let (tab, view) = (&data["tab"], &data["tab_view"]);
    let text = view["wiki_tab"]["content"]
        .as_str()
        .ok_or(OnlineError::NotFound)?;
    Ok(OnlineSong {
        source: Source::UltimateGuitar,
        id: path.to_string(),
        title: non_empty(&tab["song_name"]).unwrap_or_default(),
        artist: non_empty(&tab["artist_name"]),
        key: non_empty(&tab["tonality_name"]).or_else(|| non_empty(&view["meta"]["tonality"])),
        capo: view["meta"]["capo"]
            .as_u64()
            .or_else(|| tab["capo"].as_u64())
            .and_then(|c| u8::try_from(c).ok()),
        text: text.to_string(),
        url,
    })
}

// ---------- LRCLIB ----------

async fn search_lrclib(query: &str) -> Result<Vec<SearchHit>, OnlineError> {
    let body = get_text(&format!("{LRCLIB}search"), &[("q", query)]).await?;
    let tracks: Value =
        serde_json::from_str(&body).map_err(|e| OnlineError::Unavailable(e.to_string()))?;
    Ok(lrclib_hits(&tracks))
}

/// Tracks with lyrics, one per title and artist (the same song is often
/// listed once per album).
fn lrclib_hits(tracks: &Value) -> Vec<SearchHit> {
    let mut seen = std::collections::HashSet::new();
    tracks
        .as_array()
        .map(Vec::as_slice)
        .unwrap_or_default()
        .iter()
        .filter(|t| {
            t["plainLyrics"]
                .as_str()
                .is_some_and(|l| !l.trim().is_empty())
        })
        .filter_map(|t| {
            let title = t["trackName"].as_str()?.trim().to_string();
            let artist = non_empty(&t["artistName"]);
            let id = t["id"].as_u64()?;
            let same = (
                title.to_lowercase(),
                artist.clone().unwrap_or_default().to_lowercase(),
            );
            if !seen.insert(same) {
                return None;
            }
            Some(SearchHit {
                source: Source::Lrclib,
                id: id.to_string(),
                title,
                artist,
                key: None,
                rating: None,
                votes: None,
                version: None,
            })
        })
        .take(MAX_HITS)
        .collect()
}

fn lrclib_song(track: &Value) -> Option<OnlineSong> {
    let id = track["id"].as_u64()?;
    Some(OnlineSong {
        source: Source::Lrclib,
        id: id.to_string(),
        title: non_empty(&track["trackName"])?,
        artist: non_empty(&track["artistName"]),
        key: None,
        capo: None,
        text: track["plainLyrics"].as_str()?.to_string(),
        url: format!("https://lrclib.net/api/get/{id}"),
    })
}

// ---------- helpers ----------

fn non_empty(v: &Value) -> Option<String> {
    v.as_str()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(String::from)
}

/// Undo HTML attribute escaping: &quot; &amp; &#39; &#x27; and friends.
fn unescape_html(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut rest = s;
    while let Some(i) = rest.find('&') {
        out.push_str(&rest[..i]);
        rest = &rest[i..];
        let decoded = rest.find(';').filter(|&end| end <= 10).and_then(|end| {
            let entity = &rest[1..end];
            let c = match entity {
                "quot" => Some('"'),
                "amp" => Some('&'),
                "lt" => Some('<'),
                "gt" => Some('>'),
                "apos" => Some('\''),
                "nbsp" => Some('\u{a0}'),
                _ => entity
                    .strip_prefix("#x")
                    .or_else(|| entity.strip_prefix("#X"))
                    .and_then(|h| u32::from_str_radix(h, 16).ok())
                    .or_else(|| entity.strip_prefix('#').and_then(|d| d.parse().ok()))
                    .and_then(char::from_u32),
            };
            c.map(|c| (c, end))
        });
        match decoded {
            Some((c, end)) => {
                out.push(c);
                rest = &rest[end + 1..];
            }
            None => {
                out.push('&');
                rest = &rest[1..];
            }
        }
    }
    out.push_str(rest);
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn page(data: Value) -> String {
        let store = json!({ "store": { "page": { "data": data } } }).to_string();
        let attr = store
            .replace('&', "&amp;")
            .replace('"', "&quot;")
            .replace('\'', "&#039;");
        format!("<html><div class=\"js-store\" data-content=\"{attr}\"></div></html>")
    }

    #[test]
    fn unescapes_html_entities() {
        assert_eq!(
            unescape_html("&quot;a&quot; &amp; b&#039;s &#x27;c&#x27; &lt;3 &bogus; & done"),
            "\"a\" & b's 'c' <3 &bogus; & done"
        );
    }

    #[test]
    fn ug_paths_are_artist_and_tab_only() {
        assert!(valid_ug_path("leeland/way-maker-chords-2806757"));
        assert!(!valid_ug_path("leeland"));
        assert!(!valid_ug_path("../x/y"));
        assert!(!valid_ug_path("a/b/c"));
        assert!(!valid_ug_path("a/b?x=1"));
        assert!(!valid_ug_path("a/"));
    }

    #[test]
    fn ug_search_keeps_chord_sheets_by_votes() {
        let html = page(json!({ "results": [
            { "song_name": "Way Maker", "artist_name": "Sinach", "type": null, "votes": 166,
              "tab_url": "https://www.ultimate-guitar.com/pro/?tab_id=1" },
            { "song_name": "Way Maker", "artist_name": "Sinach", "type": "Chords", "version": 1,
              "votes": 360, "rating": 4.8, "tonality_name": "",
              "tab_url": "https://tabs.ultimate-guitar.com/tab/sinach/way-maker-chords-1959569" },
            { "song_name": "Way Maker", "artist_name": "Leeland", "type": "Chords", "version": 1,
              "votes": 1046, "rating": 4.9, "tonality_name": "E",
              "tab_url": "https://tabs.ultimate-guitar.com/tab/leeland/way-maker-chords-2806757" },
            { "song_name": "Way Maker", "artist_name": "Sinach", "type": "Bass Tabs", "votes": 4,
              "tab_url": "https://tabs.ultimate-guitar.com/tab/sinach/way-maker-bass-3320315" },
        ]}));
        let hits = ug_hits(&ug_store(&html).unwrap());
        let ids: Vec<_> = hits.iter().map(|h| h.id.as_str()).collect();
        assert_eq!(
            ids,
            [
                "leeland/way-maker-chords-2806757",
                "sinach/way-maker-chords-1959569"
            ]
        );
        assert_eq!(hits[0].key.as_deref(), Some("E"));
        assert_eq!(hits[1].key, None);
        assert_eq!(hits[0].votes, Some(1046));
    }

    #[test]
    fn ug_song_reads_the_sheet() {
        let html = page(json!({
            "tab": { "song_name": "Way Maker", "artist_name": "Leeland", "tonality_name": "E" },
            "tab_view": {
                "wiki_tab": { "content": "[Verse 1]\n[tab]   [ch]A2[/ch]\nYou are here[/tab]" },
                "meta": { "capo": 2, "tonality": "E" }
            }
        }));
        let song = ug_song(&html, "leeland/way-maker", "https://x".into()).unwrap();
        assert_eq!(song.title, "Way Maker");
        assert_eq!(song.artist.as_deref(), Some("Leeland"));
        assert_eq!(song.key.as_deref(), Some("E"));
        assert_eq!(song.capo, Some(2));
        assert!(song.text.contains("[ch]A2[/ch]"));
    }

    #[test]
    fn a_page_without_data_is_unavailable() {
        assert!(matches!(
            ug_store("<html>Just a moment…</html>"),
            Err(OnlineError::Unavailable(_))
        ));
    }

    #[test]
    fn lrclib_drops_duplicates_and_instrumentals() {
        let tracks = json!([
            { "id": 1, "trackName": "Way Maker", "artistName": "Sinach", "plainLyrics": "You are here" },
            { "id": 2, "trackName": "Way Maker ", "artistName": "SINACH", "plainLyrics": "You are here" },
            { "id": 3, "trackName": "Way Maker (Instrumental)", "artistName": "X", "plainLyrics": null },
            { "id": 4, "trackName": "Way Maker", "artistName": "Leeland", "plainLyrics": "You are here" },
        ]);
        let ids: Vec<_> = lrclib_hits(&tracks).into_iter().map(|h| h.id).collect();
        assert_eq!(ids, ["1", "4"]);
        let song = lrclib_song(&tracks[0]).unwrap();
        assert_eq!(song.text, "You are here");
        assert_eq!(song.source, Source::Lrclib);
    }
}
