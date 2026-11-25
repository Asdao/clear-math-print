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

// Wiki syntax must only expand in prose, never code, escaped text, or math.
fs.mkdirSync(path.join(v, "Regression"));
fs.writeFileSync(path.join(v, "Regression/Target.md"), "TARGET_CONTENT");
fs.writeFileSync(path.join(v, "Regression/Code.md"), [
  "```md", "![[Target]]", "[[Target|literal]]", "> [!note] Literal", "```", "",
  "    ![[Target]]", "", "`[[Target]]`", "", "\\[\\[Target]]", "",
  "$\\text{[[Target]]}$", "", "PRINTPLACEHOLDER0END", "", "[[Target|Real link]]",
  "", "> [!note] Real callout", "> Contents", "", "![[Target]]"
].join("\n"));
const code = render({ vault: v, folder: "Regression", order: "name" });
const codeArticle = code.html.match(/<article[^>]*><h1 class="note-title">Code<\/h1>([\s\S]*?)<\/article>/)[1];
assert.match(codeArticle, /<code class="language-md">!\[\[Target\]\]\n\[\[Target\|literal\]\]\n&gt; \[!note\] Literal/);
assert.match(codeArticle, /<pre><code>!\[\[Target\]\]/);
assert.match(codeArticle, /<code>\[\[Target\]\]<\/code>/);
assert.match(codeArticle, /<p>\[\[Target\]\]<\/p>/);
assert.match(codeArticle, /PRINTPLACEHOLDER0END/);
assert.match(codeArticle, /<strong>Real callout<\/strong>/);
assert.match(codeArticle, /href="#note-1">Real link/);
assert.equal((codeArticle.match(/TARGET_CONTENT/g) || []).length, 1);
assert.deepEqual(code.warnings, []);

// Raw note HTML must not become active browser markup, including through embeds.
fs.writeFileSync(path.join(v, "Regression/Target.md"), [
  '<meta http-equiv="refresh" content="0;url=https://example.invalid/">',
  '<script>alert(1)</script>', '<img src=x onerror="alert(1)">',
  '<iframe src="https://example.invalid/"></iframe>',
  '<svg onload="alert(1)"></svg>', '<style>body{display:none}</style>',
  '[unsafe](javascript:alert(1))', '[[Code|<img src=x onerror=alert(1)>]]'
].join("\n\n"));
const safe = render({ vault: v, folder: "Regression" });
assert.doesNotMatch(safe.html, /<meta http-equiv="refresh"|<script>alert|<img src=x|<iframe|<svg onload|<style>body/);
assert.doesNotMatch(safe.html, /href="javascript:/);
assert.match(safe.html, /&lt;meta http-equiv=/);
assert.match(safe.html, /&lt;img src=x onerror/);
assert.equal((safe.html.match(/<script>/g) || []).length, 1);
const script = safe.html.match(/<script>([\s\S]*?)<\/script>/)[1];
const hash = require("crypto").createHash("sha256").update(script).digest("base64");
assert.ok(safe.html.includes("script-src 'sha256-" + hash + "'"));
console.log("PASS: code/math literals, escaped wiki links, placeholders, raw HTML isolation and print-script CSP");
const selected = render({ vault: v, folder: "does-not-exist", start: "absent", files: ["Course/A.md", "Course/A.md"], order: "name" });
assert.deepEqual(selected.notes, ["Course/A.md"]);
assert.match(selected.html, /EMBED_CONTENT/, "selected notes can still resolve embedded notes outside the selection");
assert.throws(() => render({ vault: v, files: [] }), /No notes matched/);
assert.throws(() => render({ vault: v, files: ["../outside.md"] }), /inside the vault/);
assert.throws(() => render({ vault: v, files: ["Course/missing.md"] }), /not found/);
assert.throws(() => render({ vault: v, files: ["pixel.png"] }), /Selected note/);
console.log("PASS: explicit selected notes, deduplication, embed resolution and selection path bounds");
fs.writeFileSync(path.join(v, "Regression/Duplicate.md"), "# Duplicate\n\nKeep this text.\n\n## Important\n\nKeep this too.");
const clean = render({ vault: v, files: ["Regression/Duplicate.md"] });
assert.equal((clean.html.match(/<h1\b/g) || []).length, 1);
assert.match(clean.html, /Keep this text/);
assert.match(clean.html, /<h2>Important<\/h2>/);
assert.match(clean.html, /id="format-fontSize"/);
assert.match(clean.html, /id="format-marginLeft"/);
assert.match(clean.html, /&quot;contents&quot;:false/);
assert.doesNotMatch(clean.html, /Choose A4/);
console.log("PASS: duplicate title removal, content preservation and compact layout toolbar");
