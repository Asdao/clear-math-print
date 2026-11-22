# Clear Math Print 0.1.0

A desktop Obsidian plugin and standalone converter for combining notes into an offline HTML print preview. KaTeX renders formulas independently of the Obsidian theme. Fonts and local images are embedded, so the generated file can be moved and printed offline.

## Install in Obsidian

1. Copy the `clear-math-print` folder into your vault's `.obsidian/plugins/` folder. The folder must contain `manifest.json` and `main.js` directly.
2. Reload Obsidian, then enable **Clear Math Print** in Settings → Community plugins.
3. Run **Clear Math Print: Create combined print preview** from the command palette, or click the printer ribbon icon.
4. Review the folder, starting note, order and list of matching notes. Choose a layout and click **Create print preview**.
5. In the browser, click **Print / Save as PDF**. Choose A4, scale 100%, enable background graphics, and disable browser headers and footers if unwanted.

The initial folder is the active note’s folder; the starting-note field is empty. A starting note filters by its filesystem creation timestamp; copying or restoring a vault can change these timestamps. Clear the field to include the entire folder. Ordering by filename does not change that filter.

## Layouts

- Compact: 10 pt body text, images capped at 95 mm high, continuous notes by default.
- Comfortable: 11 pt body text, larger diagrams. Prefer this for diagrams with small labels.
- Optional page breaks between notes.
- A linked contents list is included in the preview and PDF.

The plugin opens the browser's print preview workflow rather than generating a PDF inside Obsidian. It does not require Node, Python, a venv, Chrome automation, or a network connection. It writes HTML and a matching JSON report beneath `.obsidian/plugins/clear-math-print/exports/`. Existing source notes are read only. Old exports are retained; delete them manually when no longer needed.

## Supported content and limits

Supports Markdown tables, code, inline/display math, local Markdown images, wiki image embeds (including width), wiki links to included notes, whole-note embeds, heading embeds, and basic callouts rendered as labeled blockquotes. Cyclic embeds stop with a warning.

This is an independent Markdown/KaTeX renderer, not an exact Obsidian preview clone. Block-reference embeds are flagged, not expanded. Heading links navigate to the containing included note. Custom Obsidian plugins, Dataview queries, Mermaid, PDFs embedded as attachments, videos and advanced MathJax-only commands are not rendered. Remote images are flagged; network resources and note-provided scripts are blocked in the exported HTML. Raw HTML may differ from Obsidian. Avoid exporting secrets to a file you plan to share.

Warnings appear in the dialog and companion `.html.json` report. KaTeX parse errors appear in the preview; review before printing. For assets with duplicate filenames, use explicit vault-relative paths.

## Standalone terminal use

Node.js is required only for the terminal converter. Dependencies are bundled into `convert.cjs`.

```powershell
node convert.cjs --vault '/path/to/vault' --folder 'Course' --start 'First Note.md' --out notes.html
```

Options: `--order created|name`, `--comfortable`, `--note-breaks`. Open the resulting HTML in a browser and use its print button. There is no Python dependency.

## Validation

The same renderer generated a 101-page compact PDF from the 16 CS2100 notes, compared with the original 131 pages. It preserved all 186 images and rendered 161 math expressions with zero detected parse errors, broken images or horizontal overflow at A4 print width. Page thumbnails and the originally clipped formula were inspected.

Fixture tests cover math, images, basic callouts, whole-note/heading embeds, circular embeds, links, missing-content warnings and vault path bounds. The bundled plugin command, modal and browser export handoff were tested with a mock Obsidian API. This version has not been installed or interactively tested in the live Obsidian app.

## Source and build

Source is included in `src/`. From this folder, run `npm install`, then `npm run build`. Build dependencies are declared in `package.json`; the distributed `main.js` and `convert.cjs` already include runtime dependencies. Bundled dependency licenses are in `THIRD-PARTY-NOTICES.txt`.
