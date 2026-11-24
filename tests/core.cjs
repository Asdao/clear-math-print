const assert = require("node:assert/strict"), fs = require("fs"), path = require("path");
const { render, list } = require("../src/core.cjs");
const v = fs.mkdtempSync(path.join(require("os").tmpdir(), "clear-math-print-test-"));
fs.mkdirSync(path.join(v, "Course"), { recursive: true });
fs.writeFileSync(path.join(v, "Course/A.md"), "# Original\n> [!note] Remember\n> Important\n\n$$x=\\frac{1}{y}$$\n\n![[B#Chosen]]\n\n[[B|Go to B]]\n\n![[pixel.png|80]]");
fs.writeFileSync(path.join(v, "Course/B.md"), "# Chosen\nEMBED_CONTENT\n\n## Details\nDETAIL_CONTENT\n\n# Other\nOUTSIDE_SECTION\n\n![[B]]");
fs.writeFileSync(path.join(v, "pixel.png"), Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64"));
const r = render({ vault: v, folder: "Course", order: "name" });
assert.equal(r.notes.length, 2);
assert.match(r.html, /katex-display/);
assert.match(r.html, /Remember/);
assert.match(r.html, /data:image\/png;base64/);
assert.match(r.html, /href="#note-1"/);
assert.ok(r.warnings.some((w) => w.includes("Circular")));
assert.match(r.html, /<div class="embedded">[\s\S]*EMBED_CONTENT[\s\S]*DETAIL_CONTENT/);
assert.throws(() => list(v, "../"), /inside/);
assert.throws(() => list(v, "Course", "missing"), /not found/);
fs.writeFileSync(path.join(v, "Course/C.md"), "![[absent.png]]\n![[B#^block]]");
const r2 = render({ vault: v, folder: "Course" });
assert.ok(r2.warnings.some((w) => w.includes("Missing embed")));
assert.ok(r2.warnings.some((w) => w.includes("Block embed")));
console.log("PASS: math, images, callouts, embeds, cycles, links, warnings, path bounds");


// Explicit multi-file selection ignores folder/cutoff and retains embed assets.
fs.mkdirSync(path.join(v, "Other"));
fs.writeFileSync(path.join(v, "Other/D.md"), "SELECTED_OTHER_FOLDER");
const selected = render({ vault: v, folder: "missing", start: "missing", order: "name", files: ["Other/D.md", "Course/A.md", "Course/A.md"] });
assert.deepEqual(selected.notes, ["Course/A.md", "Other/D.md"]);
assert.match(selected.html, /EMBED_CONTENT/);
assert.match(selected.html, /data:image\/png;base64/);
assert.match(selected.html, /SELECTED_OTHER_FOLDER/);
assert.throws(() => render({ vault: v, files: [] }), /No notes/);
for (const file of ["../escape.md", "Course/missing.md", "pixel.png"]) {
  assert.throws(() => render({ vault: v, files: [file] }), /Selected note/);
}
console.log("PASS: selected notes across folders, deduplication, assets, invalid selections");
