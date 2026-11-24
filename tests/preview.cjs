const assert = require("node:assert/strict"), vm = require("node:vm");
const { script, css, toolbar } = require("../src/preview.cjs");
(async () => {
  const controls = {};
  for (const id of ["font-family", "font-size", "margins", "note-breaks", "contents", "titles", "page-settings", "print"]) {
    controls[id] = { value: id === "font-size" ? "10" : "12", checked: id === "titles", addEventListener(event, callback) { this.change = callback; } };
  }
  const classes = new Set(), properties = {};
  let printed = false;
  const equation = { style: {}, clientWidth: 100, querySelector: () => ({ scrollWidth: 200 }) };
  const body = { style: { setProperty(k, v) { properties[k] = v; } }, classList: { toggle(k, v) { if (v) classes.add(k); else classes.delete(k); } }, dataset: {} };
  vm.runInNewContext(script, {
    document: { getElementById: id => controls[id], body, fonts: { ready: Promise.resolve() }, images: [], querySelectorAll: () => [equation] },
    window: { addEventListener() {}, print() { printed = true; } }
  });
  assert.equal(properties["--print-font"], "10pt");
  assert.equal(properties["--print-family"], "Georgia,serif");
  for (const [key, family] of [["serif", "Source Serif 4 Variable"], ["sans", "Source Sans 3 Variable"], ["inter", "Inter Variable"]]) {
    controls["font-family"].value = key;
    controls["font-family"].change();
    assert.ok(properties["--print-family"].includes(family));
    assert.ok(css.includes("font-family: '" + family + "'"));
  }
  assert.match(css, /data:font\/woff2;base64/);
  assert.doesNotMatch(css, /url\((?!data:)/);
  assert.match(css, /SIL OPEN FONT LICENSE/);
  assert.ok(classes.has("hide-contents"));
  controls["font-size"].value = "14";
  controls.margins.value = "18";
  controls["note-breaks"].checked = true;
  controls.contents.checked = true;
  controls.titles.checked = false;
  controls.margins.change();
  assert.equal(properties["--print-font"], "14pt");
  for (const size of [6,8.5,10.5,24,48]) {
    assert.ok(toolbar(true, false).includes('value="' + size + '"'));
    controls["font-size"].value = String(size);
    controls["font-size"].change();
    assert.equal(properties["--print-font"], size + "pt");
  }
  assert.equal(properties["--page-width"], "174mm");
  assert.match(controls["page-settings"].textContent, /margin:18mm/);
  assert.ok(classes.has("note-breaks"));
  assert.ok(classes.has("hide-titles"));
  assert.ok(!classes.has("hide-contents"));
  assert.equal(equation.style.fontSize, "50%");
  await controls.print.onclick();
  assert.equal(body.dataset.ready, "true");
  assert.equal(printed, true);
  assert.match(css, /@media print\{\.toolbar\{display:none!important/);
  assert.match(toolbar(false, true), /value="11" selected/);
  assert.match(toolbar(false, true), /id="note-breaks" type="checkbox" checked/);
  console.log("PASS: live font/margin/page-break/title/contents controls, equation fitting and print handoff");
})().catch(error => { console.error(error); process.exitCode = 1; });
