# Formatting settings

All settings are session-only in the browser. Units and bounds are shared by the renderer, controls, and stylesheet generator.

| Setting | Allowed values | Default |
| --- | --- | --- |
| `font` | serif, sans, mono, sourceSerif, sourceSans, inter | serif |
| `fontSize` | 8–24; step 0.5 | 10 |
| `lineHeight` | 1–2.5; step 0.05 | 1.4 |
| `marginTop` | 5–40; step 1 | 12 |
| `marginRight` | 5–40; step 1 | 12 |
| `marginBottom` | 5–40; step 1 | 14 |
| `marginLeft` | 5–40; step 1 | 12 |
| `headingScale` | 0.75–1.5; step 0.05 | 1 |
| `imageHeight` | 30–250; step 5 | 95 |
| `paper` | A4, Letter | A4 |
| `orientation` | portrait, landscape | portrait |
| `noteBreaks` | true / false | false |
| `contents` | true / false | false |
| `titles` | true / false | true |

Resolution order is defaults → preset → explicit overrides. Existing `compact: false` selects Comfortable initially, and `noteBreaks` is preserved. Programmatic callers may pass a `formatting` object to `render(config)`; existing CLI flags are unchanged.

Compact uses the defaults. Comfortable sets text size to 11 pt and maximum image height to 230 mm. Academic uses 12 pt text, 1.6 line spacing, 20 mm margins, 180 mm maximum image height, and note breaks. Image height is additionally limited to the available page height.

Invalid enums/booleans use defaults. Non-finite/non-numeric values use defaults; finite numbers are clamped to their range. Unknown fields are discarded. Browser number controls show validation messages instead of applying invalid input. Source Serif 4, Source Sans 3, and Inter are embedded, including bold and italic. Georgia, Arial, and Courier use system fonts. Font data and licenses stay in a static stylesheet so changing formatting never removes them.
