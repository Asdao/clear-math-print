# Engineering standards for browser formatting

Status: implementation standard for the browser formatting controls. See ARCHITECTURE.md for current module ownership.
Reviewed: 2026-11-24.
Review baseline: `60ed19115067edfdc5f59cb531af0f4409ffab8f` on `feat/selected-notes-print`.

## Scope and product contract

Clear Math Print remains an Obsidian plugin with a standalone, offline browser print preview. Formatting controls belong on the exported browser page. They change the exported presentation, never source notes. Preserve selected-note export, folder export, CLI use, embedded local assets, warnings, and independent KaTeX rendering.

The first formatting increment covers presets, font family and size, line spacing, margins, heading scale, image maximum height, paper size/orientation, and note breaks. Advanced CSS, persistent user presets, exact paginated preview, and content editing are separate increments. Do not imply that changing a browser control saves the HTML file or synchronizes plugin settings.

## Findings from the current source

| Location | Observation | Required response before extending that area |
| --- | --- | --- |
| `src/core.cjs:render` | Selects files, resolves assets, transforms Markdown, assembles HTML/CSS, generates browser JavaScript, and hashes it for CSP. | Extract document presentation and browser behavior before adding formatting logic. Preserve its public return contract. |
| `src/core.cjs:list` | Five positional arguments, repeated ordering logic, and folder/cutoff work even when an explicit selection is supplied. | Use a named selection request internally; share ordering logic and choose selection mode before applying filters. Retain a compatibility wrapper for current callers. |
| `src/plugin.cjs:ExportModal.onOpen` | UI construction also performs rendering, filesystem writes, persistence, and browser handoff. | Move export orchestration behind a small service with injected filesystem/browser operations when touching this workflow. |
| `src/core.cjs` browser script | DOM access, resource readiness, equation fitting, and print action are embedded in one string. | Move browser code into a testable entry point; bundle and embed it with a matching CSP hash. |
| Presentation CSS | Sizes, page geometry, colors, and compact/comfortable choices are mixed in one template string. | Define validated formatting data and one CSS generator; screen and print use the same resolved settings. |

This is an architectural review, not a claim that these structures are runtime bugs. Existing functions and the Obsidian-required subclasses are useful starting points. A wholesale class rewrite is unnecessary.

## OOP and SOLID rules

1. **Single responsibility.** Separate selection, note rendering, document assembly, formatting state, DOM controls, and platform I/O. A formatting change must not require edits to vault traversal or Markdown parsing.
2. **Open/closed.** Store presets as data using one formatting schema. Adding a preset must not require a new renderer branch. Add abstractions only for demonstrated variations; do not build a general plugin framework.
3. **Liskov substitution.** Prefer composition. Any interchangeable adapter must preserve the same inputs, results, errors, and asynchronous completion behavior. Do not subclass a renderer solely to change preset values.
4. **Interface segregation.** Consumers receive only operations they use. Browser formatting receives a document root and settings, never an Obsidian app or filesystem object. A print adapter needs resource readiness and a print operation, not an entire application service.
5. **Dependency inversion.** Core policy must not import Obsidian, Electron, or browser globals. Inject platform operations at entry points. The browser runtime must contain no Node dependencies.
6. **Encapsulation.** A stateful formatting controller owns a validated settings snapshot and event cleanup. Callers update it through explicit methods; they cannot mutate shared preset objects.
7. **Composition and simplicity.** Use pure functions for validation, preset resolution, and CSS generation. Use classes only where lifecycle or state ownership benefits clarity. No empty base classes, one-method forwarding layers, or singleton mutable settings.

## Proposed module boundaries

Names are illustrative; responsibilities and dependency direction are the contract.

| Module | Owns | Must not own |
| --- | --- | --- |
| Formatting model | Defaults, schema, immutable preset data, normalization, legacy option mapping | DOM, disk, Obsidian |
| Style generator | Validated settings to document CSS and page rules | Event handlers, file selection |
| Document assembler | Rendered notes, stylesheet/runtime embedding, escaping, CSP hash | Browser events, export writes |
| Browser controller | Formatting state, control bindings, reset/apply, resource readiness, equation refitting | Vault access, Markdown rendering |
| Export service | Calls renderer, writes HTML/report, opens output through injected adapters | Formatting form construction |
| Obsidian/CLI entry points | Platform integration and user-facing errors | Duplicate rendering or formatting rules |

Use CommonJS and the existing esbuild pipeline unless a concrete requirement justifies migration. Keep `render(config) -> { html, notes, warnings }` and current CLI flags compatible.

## Formatting data and behavior

- Maintain one documented schema with explicit units: points for text, millimeters for page geometry and image height, unitless line height and heading scale.
- Define allowed paper sizes, orientations, fonts, and finite numeric ranges in that schema. Reject or normalize invalid persisted/imported data consistently before generating CSS.
- Resolve settings in this order: defaults, selected preset, explicit overrides. Presets are immutable; applying/resetting one produces fresh state.
- Map existing `compact` and `noteBreaks` options to equivalent initial settings. Preserve existing behavior when new settings are absent.
- Generate `@page` from validated geometry. Do not assume body CSS variables resolve inside page rules.
- Keep controls outside the printable content root. Scope typography to the document; hide all controls when printing.
- Apply formatting without rerendering Markdown or re-reading notes. Refit equations after layout changes, font/image readiness, resize, and immediately before printing.
- Changing settings must clear stale fitted equation sizes before measuring again. Prevent overlapping readiness/print actions.
- Use native labeled inputs, keyboard-operable controls, visible focus, understandable units, and useful validation messages.
- Browser settings are session-only in the first increment. Reset must work without storage. If persistence or save/export is later added, make it explicit and tolerate unavailable storage.
- A screen preview is not an exact paginated PDF preview. Browser print-dialog overrides can affect final paper size, margins, and scale; describe the supported workflow accurately.

## Offline output and trust boundaries

- Keep CSS, browser runtime, math fonts, and supported images embedded. No CDN or runtime network requirement.
- Escape note-derived HTML contexts and safely serialize settings. Do not insert user values as executable JavaScript or unvalidated CSS.
- Preserve CSP restrictions. Compute the script hash from the exact embedded runtime; avoid inline event attributes, eval, or widening script permissions.
- Keep Node/Electron capabilities out of the exported page. Formatting controls cannot write to the vault.
- Advanced custom CSS requires a separate design for scoping, external resource handling, and offline behavior before implementation.

## Reuse standards

Use browser CSS, CSS custom properties, native form controls, and the existing Markdown/KaTeX/esbuild dependencies. Do not implement a pagination engine or add a UI framework for this panel.

Research references:
- [Better Export PDF](https://github.com/l1xnan/obsidian-better-export-pdf): selectable print snippets, multi-note export, page configuration. MIT license; retain required notices if code is reused.
- [Advanced PDF Export](https://community.obsidian.md/plugins/advanced-pdf-export): presets with individual overrides and detailed formatting controls. GPL-3.0; assess license compatibility before copying implementation.
- [Obsidian CSS snippets](https://obsidian.md/help/snippets): existing CSS and note-class conventions. Similar conventions do not imply full compatibility with our independent HTML.
- [PDF Export Enhancer](https://community.obsidian.md/plugins/pdf-export-enhancer): formatting controls alongside preview. Documentation is an idea reference, not proof of reusable API or code permissions.

Borrow interaction patterns and standard browser techniques. Record provenance and comply with the actual license of any copied code/assets. Do not claim integration with another plugin without a documented supported interface and a verified use case.

## Implementation order and acceptance

1. Extract presentation generation and browser runtime while preserving current output behavior.
2. Introduce the formatting schema, presets, and legacy mapping.
3. Add the browser controller and accessible panel using that shared schema.
4. Verify offline output and printing, then rebuild the distributed artifacts.

Required checks for the feature:
- Unit tests for preset isolation, precedence, legacy mapping, invalid values, and page CSS.
- Existing renderer and selected-file tests continue to pass.
- Browser interaction tests verify settings changes, reset, equation refitting, and print readiness; include a long equation, image, table, and code block.
- Verify controls are absent from print output and selected notes/assets remain present.
- Verify exported HTML works offline, CSP authorizes the exact runtime, and no external requests are required.
- Exercise both Obsidian and CLI generated output. Run `npm test` and `npm run build`; regenerate `main.js` and `convert.cjs` from source.
- Report automated checks separately from live browser/Obsidian testing. Do not claim exact pagination or live-app compatibility without testing it.

Review changes against these rules rather than counting classes or design patterns. Refactor only the code needed for the feature and preserve independently useful existing APIs.
