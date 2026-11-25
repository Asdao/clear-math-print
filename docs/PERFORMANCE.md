# Performance changes

Implemented on top of `355c33404a0fdee2b15c6870e7e9026da6478c32`.

## Changes

- Cache creation timestamps once per selection request; use a set to validate selected paths.
- Cache reference hits and misses per source directory within a render. Build vault-relative/basename indexes lazily, preserving first-match traversal order.
- Cache normalized note text per render. Keep rendered embeds contextual so circular/deep embed warnings remain correct.
- Reset equation font sizes together, measure widths together, then apply sizes together.
- Debounce folder/start edits for 150 ms. Disable export while the list is pending; cancel timers on close or immediate order refresh.

No caches survive an export, so subsequent exports see changed notes and previously missing files. Existing image byte caching remains in place.

## Measurements

Synthetic local fixtures, warm-up excluded, median of five synchronous runs:

| Workload | Before | After |
| --- | --- | --- |
| Select 2,000 notes by creation date | about 55 ms; 38,118 stat calls | about 20 ms; 2,000 stat calls |
| Resolve 100 repeated missing links in a 2,000-note vault | about 163 ms; 400 existence checks | about 7 ms; 4 existence checks |
| Embed one note 100 times | 101 note reads including parent | 2 note reads including parent |

These are measured fixture results, not speed guarantees for real vaults. Name ordering and two-file selection were already inexpensive and did not show a reliable timing improvement. Lazy index construction avoids imposing the full fallback index cost on exports whose references resolve directly.

Chromium tests with 30 overflowing equations reduced fitting from 31 layout passes to 2. Elapsed browser timings varied between runs, so no fixed percentage improvement is claimed.

## Reproduction and correctness

Run `npm run benchmark` for the filesystem fixtures. `PRINT_BENCH_SOURCE` can point to another source directory for comparison; that directory must be able to resolve the declared dependencies. The benchmark prints call counts as well as timings and removes its temporary vault.

`npm test` covers bounded operation counts, cache freshness, duplicate filename precedence, source-relative lookup isolation, cycles, and dialog timer cleanup. `npm run test:browser` exercises fitting, formatting/reset, printing/PDF, offline behavior, and limits layout passes for 30 equations. Build both bundles with `npm run build`.

A separate before/after comparison matched HTML, notes, and warnings for embeds, headings, duplicate basenames, missing references, and cycles after normalizing the deliberately changed browser script and CSP hash. Live Obsidian interaction remains untested.
