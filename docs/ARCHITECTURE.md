# Current architecture

The browser preview includes session-only formatting controls. Rendering, platform operations, formatting policy, and DOM behavior have separate owners.

## Module ownership

- `selection.cjs`: vault traversal, bounds checks, selection modes, ordering; exposes `selectNotes(request)` and the existing positional `list` wrapper.
- `core.cjs`: Markdown/KaTeX rendering, note references, embeds, images, and warnings. Keeps `render(config)` and its return shape stable.
- `html.cjs`: shared HTML escaping.
- `formatting.cjs`: immutable presets, field schema, validation, and legacy option mapping.
- `styles.cjs`: document CSS generated from validated settings and independent panel styles.
- `formatting-panel.cjs`: accessible control markup generated from the shared schema.
- `formatting-controller.cjs`: encapsulated settings, control events, reset, stylesheet updates, and cleanup.
- `document.cjs`: HTML structure, contents list, stylesheet/runtime embedding, exact script CSP hash.
- `browser-runtime.cjs`: resource readiness, equation refitting after formatting/resize/font changes, and print lifecycle.
- `browser-entry.cjs`: browser startup; esbuild bundles it and its browser-safe dependencies into `browser-script.json`. The assembler embeds those exact bytes and computes their CSP hash. No Node APIs are available in the browser bundle.
- `export-service.cjs`: rendering and HTML/report writes, with filesystem, renderer, clock, and browser handoff supplied as adapters. CLI uses `write`; Obsidian uses `createPreview` and `open`.
- `plugin.cjs`: Obsidian controls, selection menu, option persistence, and user notifications.
- `cli.cjs`: argument parsing and terminal messages.

Both entry points use the same rendering and export service. Browser output remains standalone and offline. Source notes are read only. The public `render` and `list` APIs and existing CLI flags remain supported.

Explicit file selection is resolved before folder/start filters. This also makes direct `list` calls consistent with selected-file rendering: irrelevant folder/start values do not interfere with a selection. Ordering has one implementation.

## Verification

`npm test` includes existing rendering fixtures, multi-file menu tests, and architecture tests for adapter writes/errors, selection compatibility, CSP hashes, and formatting validation. `npm run test:browser` exercises controls and the print lifecycle in Chromium. `npm run build` regenerates both distributed entry points.

For this cleanup, an additional before/after fixture comparison confirmed identical HTML and CSS across compact/comfortable and note-break combinations after normalizing the intentionally changed runtime source and its CSP hash. Notes and warnings matched. The rebuilt CLI and its minified embedded runtime were also exercised. These checks do not replace live Obsidian or visual browser testing.

See [Engineering standards](ENGINEERING_STANDARDS.md) for the formatting feature's requirements.

## Formatting state and output

Defaults, preset values, and explicit overrides resolve through one normalization function. Numeric values must be finite and are clamped to schema limits; invalid enums/booleans fall back to defaults. The controls reject invalid input without changing the last applied settings. The controller exposes copies of its state and never mutates presets.

The initial state is HTML-escaped into a hidden data element. Browser changes replace only the generated document stylesheet and refit math; Markdown is not rerendered. Controls live outside `.print-document` and are hidden for print. Page geometry is emitted directly as validated `@page` rules. User settings and presets are not persisted.

Source entry points and browser code share the same formatting schema and CSS generator. Build the browser bundle first whenever those modules change, then rebuild both Node entry points. Generated browser code is tracked so source-level tests also work after checkout. CI rebuilds before testing.
