//! The few outside pages the app opens in the browser: a GitHub issue (bug
//! or idea) with the version and computer already filled in, the tip jar,
//! and this version's licence and privacy note.

use serde::Deserialize;

const REPO: &str = "https://github.com/thisisnich/cellpresenter";
const NEW_ISSUE: &str = "https://github.com/thisisnich/cellpresenter/issues/new";
pub const TIP_JAR: &str = "https://ko-fi.com/ndubs";

#[derive(Clone, Copy, Debug, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum Link {
    Bug,
    Feature,
    Tip,
    License,
    Privacy,
}

/// Where `link` goes, with the fields the app knows filled in.
pub fn url(link: Link, version: &str, os: &str) -> String {
    let template = match link {
        Link::Bug => "bug.yml",
        Link::Feature => "feature.yml",
        Link::Tip => return TIP_JAR.to_string(),
        Link::License => return format!("{REPO}/blob/v{version}/LICENSE"),
        Link::Privacy => return format!("{REPO}/blob/v{version}/PRIVACY.md"),
    };
    let mut url = reqwest::Url::parse(NEW_ISSUE).expect("valid issue url");
    url.query_pairs_mut()
        .append_pair("template", template)
        .append_pair("version", version);
    if link == Link::Bug {
        url.query_pairs_mut().append_pair("os", os);
    }
    url.to_string()
}

/// This computer, as people would name it.
pub fn this_os() -> &'static str {
    match std::env::consts::OS {
        "macos" => "macOS",
        "linux" => "Linux",
        "windows" => "Windows",
        other => other,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bug_url_carries_version_and_os() {
        assert_eq!(
            url(Link::Bug, "1.0.1", "macOS"),
            "https://github.com/thisisnich/cellpresenter/issues/new?template=bug.yml&version=1.0.1&os=macOS"
        );
    }

    #[test]
    fn feature_url_carries_version_only() {
        assert_eq!(
            url(Link::Feature, "1.0.1", "Linux"),
            "https://github.com/thisisnich/cellpresenter/issues/new?template=feature.yml&version=1.0.1"
        );
    }

    #[test]
    fn license_is_this_versions() {
        assert_eq!(
            url(Link::License, "1.0.2", "Linux"),
            "https://github.com/thisisnich/cellpresenter/blob/v1.0.2/LICENSE"
        );
    }

    #[test]
    fn privacy_is_this_versions() {
        assert_eq!(
            url(Link::Privacy, "1.0.2", "Linux"),
            "https://github.com/thisisnich/cellpresenter/blob/v1.0.2/PRIVACY.md"
        );
    }

    #[test]
    fn tip_jar_is_plain() {
        assert_eq!(url(Link::Tip, "1.0.1", "Linux"), TIP_JAR);
    }
}
