const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { ExportService } = require('../src/export-service.cjs');
const { selectNotes, list } = require('../src/selection.cjs');
const { render } = require('../src/core.cjs');

async function main() {
  const vault = fs.mkdtempSync(path.join(os.tmpdir(), 'print-architecture-'));
  try {
    fs.writeFileSync(path.join(vault, 'A.md'), '# Heading\n\n$$x^2$$');
    fs.writeFileSync(path.join(vault, 'B.md'), 'Other note');
    const expected = list(vault, '', '', 'name');
    assert.deepEqual(selectNotes({ vault, order: 'name' }), expected);
    assert.deepEqual(list(vault, '../ignored', 'missing', 'name', ['B.md']).notes, [path.join(vault, 'B.md')]);
    assert.throws(() => selectNotes({ vault, files: [null] }), /paths/);

    const writes = [], calls = [];
    const service = new ExportService({ render: config => { calls.push(config); return { html: 'HTML', notes: ['A.md'], warnings: ['warning'] }; }, fs: {
      mkdirSync: (...args) => writes.push(['mkdir', ...args]),
      writeFileSync: (...args) => writes.push(['write', ...args])
    }, now: () => 42, openPath: async file => { calls.push(file); return ''; } });
    const result = service.createPreview({ vault }, path.join(vault, 'exports'));
    assert.equal(path.basename(result.file), 'notes-42.html');
    assert.equal(writes[1][2], 'HTML');
    assert.deepEqual(JSON.parse(writes[2][2]), { notes: ['A.md'], warnings: ['warning'] });
    await service.open(result.file);
    assert.equal(calls[1], result.file);
    await assert.rejects(new ExportService({ openPath: async () => 'Cannot open' }).open('file'), /Cannot open/);
    assert.throws(() => new ExportService({ render: () => { throw Error('Render failed'); }, fs: {} }).write({}, 'file'), /Render failed/);

    const { html } = render({ vault });
    const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
    const hash = crypto.createHash('sha256').update(script).digest('base64');
    assert.ok(html.includes("script-src 'sha256-" + hash + "'"));
    new vm.Script(script); // Actual execution is covered in Chromium by test:browser.
    assert.ok(html.includes('id="document-styles"'));
    assert.ok(html.includes('class="print-document"'));
    console.log('PASS: selection compatibility, export adapters, CSP and bundled browser syntax');
  } finally { fs.rmSync(vault, { recursive: true, force: true }); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
