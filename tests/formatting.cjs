const assert = require('node:assert/strict');
const { DEFAULTS, FIELDS, PRESETS, normalizeSettings, resolveSettings, initialSettings } = require('../src/formatting.cjs');
const { createStyles } = require('../src/styles.cjs');
assert.equal(initialSettings().fontSize, 10);
assert.equal(initialSettings({ compact: false }).fontSize, 11);
assert.equal(initialSettings({ compact: false }).imageHeight, 230);
assert.equal(initialSettings({ noteBreaks: true }).noteBreaks, true);
assert.equal(initialSettings({ compact: false, formatting: { fontSize: 15 } }).fontSize, 15);
assert.equal(resolveSettings('academic', { fontSize: 14 }).fontSize, 14);
assert.equal(resolveSettings('academic').marginLeft, 20);
const modified = resolveSettings('academic'); modified.marginLeft = 39;
assert.equal(resolveSettings('academic').marginLeft, 20);
assert.ok(Object.isFrozen(PRESETS.academic.values));
assert.deepEqual(normalizeSettings({ fontSize: NaN, lineHeight: Infinity, font: 'url(evil)', paper: 'bad', noteBreaks: 'true' }), DEFAULTS);
assert.equal(normalizeSettings({ fontSize: 100 }).fontSize, FIELDS.fontSize.max);
assert.equal(normalizeSettings({ marginLeft: -5 }).marginLeft, FIELDS.marginLeft.min);
assert.deepEqual(normalizeSettings(null), DEFAULTS);
const css = createStyles(resolveSettings('academic', { paper: 'Letter', orientation: 'landscape', marginTop: 15 }));
assert.match(css, /@page\{size:Letter landscape;margin:15mm 20mm 20mm 20mm/);
assert.match(css, /\.print-document\{font:12pt\/1.6 Georgia,serif/);
assert.match(css, /break-before:page/);
assert.ok(!createStyles({ font: '</style><script>bad</script>' }).includes('<script>'));
console.log('PASS: formatting defaults, presets, overrides, legacy options, validation and page CSS');

const fontCss = require('../src/font-css.json');
assert.match(fontCss, /SIL OPEN FONT LICENSE/);
assert.doesNotMatch(fontCss, /url\((?!data:)/);
for (const [key, family] of [['sourceSerif', 'Source Serif 4 Variable'], ['sourceSans', 'Source Sans 3 Variable'], ['inter', 'Inter Variable']]) {
  assert.ok(FIELDS.font.options[key]);
  assert.ok(createStyles({ font: key }).includes(family));
  assert.ok(fontCss.includes(family));
}
assert.equal(normalizeSettings({ fontSize: 6 }).fontSize, 6);
assert.equal(normalizeSettings({ fontSize: 48 }).fontSize, 48);
assert.match(createStyles({ contents: false, titles: false }), /\.note-title\{display:none\}/);
console.log('PASS: embedded font choices, licenses, offline assets and retained preview controls');
