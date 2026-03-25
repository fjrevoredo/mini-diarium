## What's Changed

### Added

- **Markdown export image handling**: embedded base64 images are no longer silently stripped on export. Two new export options appear in the Export dialog:
    - **Markdown** (`builtin:markdown`) extracts images to a sibling `assets/` folder and replaces `<img>` tags with relative `![Image N](assets/image-N.ext)` references — compatible with Obsidian, Typora, and VS Code
    - **Markdown (inline images)** (`builtin:markdown-inline`) embeds images as `![Image N](data:image/TYPE;base64,…)` data URIs for single-file portability in editors that support them
    - Backend test count: 249 → 265