//! Bug reports and feature requests: GitHub issues, opened from the app with
//! the version and computer already filled in.

use serde::Deserialize;

const NEW_ISSUE: &str = "https://github.com/thisisnich/cellpresenter/issues/new";

#[derive(Clone, Copy, Debug, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum Kind {
    Bug,
    Feature,
}

/// The issue form for `kind`, with the fields the app knows filled in.
pub fn issue_url(kind: Kind, version: &str, os: &str) -> String {
    let template = match kind {
        Kind::Bug => "bug.yml",
        Kind::Feature => "feature.yml",
    };
    let mut url = reqwest::Url::parse(NEW_ISSUE).expect("valid issue url");
    url.query_pairs_mut()
        .append_pair("template", template)
        .append_pair("version", version);
    if kind == Kind::Bug {
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
            issue_url(Kind::Bug, "1.0.1", "macOS"),
            "https://github.com/thisisnich/cellpresenter/issues/new?template=bug.yml&version=1.0.1&os=macOS"
        );
    }

    #[test]
    fn feature_url_carries_version_only() {
        assert_eq!(
            issue_url(Kind::Feature, "1.0.1", "Linux"),
            "https://github.com/thisisnich/cellpresenter/issues/new?template=feature.yml&version=1.0.1"
        );
    }
}
