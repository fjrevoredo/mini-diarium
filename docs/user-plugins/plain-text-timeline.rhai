// @name: Plain Text Timeline
// @type: export
// @extensions: txt

fn format_entries(entries) {
    let output = "";
    let first = true;

    for entry in entries {
        if !first {
            output += "\n---\n";
        }
        first = false;

        let title = if entry.title == "" { "(untitled)" } else { entry.title };
        output += entry.date + " | " + title + "\n";
        output += html_to_markdown(entry.text);
    }

    output
}
