# User Plugin Guide (Rhai)

This guide is for users writing local `.rhai` import/export plugins.

This file is also the source used to generate `{diary_dir}/plugins/README.md` at runtime.

This guide covers both plugin types:

1. **Import plugins** (`@type: import`, `fn parse(content)`)
2. **Export plugins** (`@type: export`, `fn format_entries(entries)`)

Use this together with:

- `docs/USER_GUIDE.md` (general user docs)
- `PHILOSOPHY.md` (project constraints and boundaries)

## Official Example in This Folder

Mini Diarium ships an official example user plugin in this same folder:

- `docs/user-plugins/plain-text-timeline.rhai`

This is an **export** example. Import plugins are equally supported; see sections below for import contract and testing.

Use this file as your starting point for export plugins. It demonstrates:

1. Required metadata header
2. Correct export entry-point function (`format_entries`)
3. Safe use of helper functions (`html_to_markdown`)
4. Deterministic, portable output formatting

## Philosophy Alignment (Required)

User plugins should stay aligned with Mini Diarium's philosophy:

1. **Local-only by design**: no network behavior.
2. **No marketplace model**: plugins are local files you control.
3. **Easy in, easy out**: prefer open/portable formats.
4. **Focused scope**: journaling import/export, not unrelated app behavior.
5. **Simple is good**: small, explicit scripts are easier to audit.

## Required Script Contract

Each plugin is one `.rhai` file with metadata comments.

Required metadata:

1. `// @name: ...`
2. `// @type: import` or `// @type: export`
3. Optional: `// @extensions: json,txt,...`

Required entry points:

1. Import plugin: `fn parse(content)` returning an array of entry maps.
2. Export plugin: `fn format_entries(entries)` returning a string.
3. Do not use `fn export(...)` for exports (`export` is reserved in Rhai).

## Data Requirements

Import maps returned by `parse(content)`:

1. `date` is required and must be `YYYY-MM-DD`.
2. `title` should be a string (can be empty).
3. `text` should be HTML (TipTap-compatible).

Export entries passed to `format_entries(entries)` include:

1. `date`
2. `title`
3. `text`
4. `word_count`
5. `date_created`
6. `date_updated`

## Available Helper Functions

Plugins can call:

1. `parse_json(string)`
2. `count_words(string)`
3. `now_rfc3339()`
4. `html_to_markdown(string)`

## Security and Runtime Constraints

Scripts run in a sandbox:

1. No filesystem access from Rhai script code.
2. No network access from Rhai script code.
3. Operation limits are enforced to prevent runaway scripts.

Important:

1. Exported files are plaintext unless you encrypt them separately.
2. Keep secrets out of exported files and logs.

## How To Test the Official Export Example Plugin

Use this flow to validate `plain-text-timeline.rhai` end-to-end.

1. Find your diary directory.
   - Default:
     - Windows: `%APPDATA%\\com.minidiarium\\`
     - macOS: `~/Library/Application Support/com.minidiarium/`
     - Linux: `~/.local/share/com.minidiarium/`
   - If you changed location in Preferences, use that directory.
2. Create a `plugins/` folder there if it does not exist.
3. Copy `docs/user-plugins/plain-text-timeline.rhai` into `{diary_dir}/plugins/`.
4. Restart Mini Diarium (plugins load at startup).
5. Open **Diary → Export...** and select **Plain Text Timeline** from the format list.
6. Export to a `.txt` file and verify:
   - each block starts with `YYYY-MM-DD | title`
   - empty titles show `(untitled)`
   - entry body is Markdown-converted text
   - entries are separated by `---`

## How To Test Import Plugins

Use this flow to validate any import plugin you create.

1. Copy your import `.rhai` file into `{diary_dir}/plugins/`.
2. Prepare a small input file matching your plugin's expected format (start with 1-2 entries).
3. Restart Mini Diarium (plugins load at startup).
4. Open **Diary → Import...**.
5. Select your import plugin from the format dropdown.
6. Select your input file and run import.
7. Verify results:
   - imported dates appear in the calendar
   - titles/content match expected transformation
   - merge behavior is correct when a date already exists
   - no malformed/empty entries were unexpectedly created

Safety recommendation:

1. Test imports first on a disposable diary or recent backup.
2. Increase sample size gradually after initial validation.

## Recommended Validation for Your Own Plugins (Both Types)

Before regular use (import or export):

1. Test with a tiny sample first (1-2 entries).
2. Test edge cases:
   - empty title
   - unicode/special characters
   - multiline rich-text content
3. Verify determinism if you need reproducible exports.
4. Re-open output in your target app/tool to confirm compatibility.

For import plugins specifically:

1. Start with one-entry fixtures, then larger files.
2. Verify date format and merge behavior when dates already exist.

## Adapt the Official Example

Recommended workflow:

1. Copy `plain-text-timeline.rhai` to a new filename.
2. Change only `@name`, `@extensions`, and formatting rules first.
3. Keep function signature and metadata structure unchanged.
4. Iterate in small steps and retest from the export overlay.

## Minimal Import Plugin Template

Use this as a starting point for import plugins:

```rhai
// @name: My Import
// @type: import
// @extensions: json

fn parse(content) {
    let data = parse_json(content);
    let entries = [];
    for item in data {
        entries += #{
            date: item.date,
            title: item.title,
            text: item.text,
        };
    }
    entries
}
```
