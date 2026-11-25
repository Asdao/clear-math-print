const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { selectNotes } = require('../src/selection.cjs');
const { render } = require('../src/core.cjs');
const vault = fs.mkdtempSync(path.join(os.tmpdir(), 'print-cache-tests-'));
function countIO(action) {
  const methods = ['statSync', 'readFileSync', 'existsSync'];
  const original = Object.fromEntries(methods.map(name => [name, fs[name]]));
  const counts = Object.fromEntries(methods.map(name => [name, 0]));
  try {
    for (const name of methods) fs[name] = (...args) => { counts[name]++; return original[name](...args); };
    return { result: action(), counts };
  } finally { Object.assign(fs, original); }
}
try {
  for (let i = 0; i < 200; i++) fs.writeFileSync(path.join(vault, i + '.md'), 'Note ' + i);
  const selected = countIO(() => selectNotes({ vault, start: '0.md' }));
  assert.equal(selected.counts.statSync, 200); // Includes the cutoff file; no comparator I/O.
  const expected = fs.readdirSync(vault).map(name => path.join(vault, name)).sort((a, b) => fs.statSync(a).birthtimeMs - fs.statSync(b).birthtimeMs || a.localeCompare(b));
  assert.deepEqual(selected.result.notes, expected);
  fs.writeFileSync(path.join(vault, 'Repeat.md'), Array(100).fill('![[0]]\n[[missing]]').join('\n\n'));
  const repeated = countIO(() => render({ vault, files: ['Repeat.md'] }));
  assert.equal(repeated.counts.readFileSync, 2);
  assert.ok(repeated.counts.existsSync <= 6);
  fs.writeFileSync(path.join(vault, '0.md'), 'FRESH_CONTENT');
  assert.match(render({ vault, files: ['Repeat.md'] }).html, /FRESH_CONTENT/);
  fs.writeFileSync(path.join(vault, 'missing.md'), 'FOUND_AFTER_PREVIOUS_MISS');
  const fresh = render({ vault, files: ['Repeat.md', 'missing.md'] });
  assert.ok(fresh.html.includes('<a href="#note-' + fresh.notes.indexOf('missing.md') + '">missing</a>'));
  for (const dir of ['A', 'B']) {
    fs.mkdirSync(path.join(vault, dir));
    fs.writeFileSync(path.join(vault, dir, 'dup.md'), dir + '_LOCAL_CONTENT');
    fs.writeFileSync(path.join(vault, dir, 'source.md'), '![[dup]]');
  }
  fs.writeFileSync(path.join(vault, 'Sources.md'), '![[A/source]]\n\n![[B/source]]');
  const local = render({ vault, files: ['Sources.md'] }).html;
  assert.match(local, /A_LOCAL_CONTENT/);
  assert.match(local, /B_LOCAL_CONTENT/); // Cache keys include source directory.
  fs.writeFileSync(path.join(vault, 'Fallback.md'), '![[dup]]');
  const fallback = render({ vault, files: ['Fallback.md'] }).html;
  assert.match(fallback, /A_LOCAL_CONTENT/);
  assert.ok(!fallback.includes('B_LOCAL_CONTENT')); // Retains first traversal match.
  fs.writeFileSync(path.join(vault, 'Cycle.md'), '![[Cycle]]');
  assert.ok(render({ vault, files: ['Cycle.md'] }).warnings.some(w => w.includes('Circular')));
  console.log('PASS: bounded metadata/reference I/O, fresh per-export caches, duplicate-name precedence and cycles');
} finally { fs.rmSync(vault, { recursive: true, force: true }); }
