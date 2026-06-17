## What's Changed

You can now export your journal as a PDF. Bullet points and numbered lists are properly visible in the editor again, and the export dialog no longer carries over old errors when reopened.

### Added
- **Print / PDF export**: journal entries can now be exported as a PDF file directly from the app. In the Export dialog, select **Print / PDF** from the format dropdown and optionally filter by date range or month; clicking **Print** opens a native save dialog and writes a formatted PDF to the chosen path. Output is A4 portrait with 2 cm margins, entries grouped by date with titles, tags, and full formatted content including images.
    - **Page breaks**: each page break is placed at natural blank rows so text lines are never cut in half, and images stay intact without splitting across page boundaries.
    - **Default filename**: the save dialog suggests `mini-diarium-export-YYYY-MM-DD_HH-MM.pdf` instead of a plain `mini-diarium-export.pdf`.

### Fixed
- **Bullet and numbered lists now display markers in the editor**: the Tailwind CSS reset (`list-style: none`) was stripping bullet dots and ordinal numbers from all list elements. The editor stylesheet now explicitly restores `list-style-type: disc` for unordered lists and `list-style-type: decimal` for ordered lists inside the ProseMirror container. Most noticeable on Linux where the WebKit renderer enforces the reset strictly (issue #163).
- **Export dialog state clears when reopened**: error and success messages now reset whenever the dialog becomes visible, so reopening after a failed or successful export always shows a clean state.
