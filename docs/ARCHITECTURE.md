# Current architecture

This cleanup prepares the existing print workflow for later formatting controls. It adds no new formatting UI.

## Module ownership

- `selection.cjs`: vault traversal, bounds checks, selection modes, ordering; exposes `selectNotes(request)` and the existing positional `list` wrapper.
- `core.cjs`: Markdown/KaTeX rendering, note references, embeds, images, and warnings. Keeps `render(config)` and its return shape stable.
- `html.cjs`: shared HTML escaping.
- `styles.cjs`: existing compact/comfortable document styles.
- `document.cjs`: HTML structure, contents list, stylesheet/runtime embedding, exact script CSP hash.
- `browser-runtime.cjs`: self-contained resource readiness, equation fitting, and browser print lifecycle. Its function is serialized into the export, so it must not capture module variables or Node APIs.
- `export-service.cjs`: rendering and HTML/report writes, with filesystem, renderer, clock, and browser handoff supplied as adapters. CLI uses `write`; Obsidian uses `createPreview` and `open`.
- `plugin.cjs`: Obsidian controls, selection menu, option persistence, and user notifications.
- `cli.cjs`: argument parsing and terminal messages.

Both entry points use the same rendering and export service. Browser output remains standalone and offline. Source notes are read only. The public `render` and `list` APIs and existing CLI flags remain supported.

Explicit file selection is resolved before folder/start filters. This also makes direct `list` calls consistent with selected-file rendering: irrelevant folder/start values do not interfere with a selection. Ordering has one implementation.

## Verification

`npm test` includes existing rendering fixtures, multi-file menu tests, and architecture tests for adapter writes/errors, selection compatibility, CSP hashes, and the embedded print lifecycle. `npm run build` regenerates both distributed entry points.

For this cleanup, an additional before/after fixture comparison confirmed identical HTML and CSS across compact/comfortable and note-break combinations after normalizing the intentionally changed runtime source and its CSP hash. Notes and warnings matched. The rebuilt CLI and its minified embedded runtime were also exercised. These checks do not replace live Obsidian or visual browser testing.

See [Engineering standards](ENGINEERING_STANDARDS.md) for the planned formatting feature's requirements.
