//! Parsing of the `// @key: value` comment header at the top of a `.rhai` script.

/// Metadata parsed from the comment header of a .rhai script.
pub(super) struct ScriptMeta {
    pub(super) name: String,
    pub(super) plugin_type: String, // "import" or "export"
    pub(super) extensions: Vec<String>,
}

/// Parse `// @key: value` lines from the top of a script.
pub(super) fn parse_metadata(source: &str) -> Option<ScriptMeta> {
    let mut name = None;
    let mut plugin_type = None;
    let mut extensions = None;

    for line in source.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue; // skip blank lines in header
        }
        if !trimmed.starts_with("//") {
            break; // stop at first non-comment, non-blank line
        }
        let comment = trimmed.trim_start_matches("//").trim();
        if let Some(val) = comment.strip_prefix("@name:") {
            name = Some(val.trim().to_string());
        } else if let Some(val) = comment.strip_prefix("@type:") {
            plugin_type = Some(val.trim().to_lowercase());
        } else if let Some(val) = comment.strip_prefix("@extensions:") {
            extensions = Some(
                val.split(',')
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .collect::<Vec<_>>(),
            );
        }
    }

    Some(ScriptMeta {
        name: name?,
        plugin_type: plugin_type?,
        extensions: extensions.unwrap_or_default(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_metadata_complete() {
        let source =
            "// @name: My Plugin\n// @type: import\n// @extensions: json, txt\nfn parse(c) { [] }";
        let meta = parse_metadata(source).unwrap();
        assert_eq!(meta.name, "My Plugin");
        assert_eq!(meta.plugin_type, "import");
        assert_eq!(meta.extensions, vec!["json", "txt"]);
    }

    #[test]
    fn test_parse_metadata_missing_name() {
        let source = "// @type: import\nfn parse(c) { [] }";
        assert!(parse_metadata(source).is_none());
    }

    #[test]
    fn test_parse_metadata_missing_type() {
        let source = "// @name: Test\nfn parse(c) { [] }";
        assert!(parse_metadata(source).is_none());
    }

    #[test]
    fn test_parse_metadata_no_extensions() {
        let source = "// @name: Test\n// @type: export\nfn format_entries(e) { \"\" }";
        let meta = parse_metadata(source).unwrap();
        assert!(meta.extensions.is_empty());
    }

    #[test]
    fn test_parse_metadata_with_blank_lines() {
        let source = "// @name: Test\n\n// @type: import\n// @extensions: json\nfn parse(c) { [] }";
        let meta = parse_metadata(source).unwrap();
        assert_eq!(meta.name, "Test");
        assert_eq!(meta.plugin_type, "import");
        assert_eq!(meta.extensions, vec!["json"]);
    }
}
