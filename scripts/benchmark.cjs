// Synthetic warm-cache measurements; times vary by filesystem and machine.
const fs = require('fs'), path = require('path'), os = require('os');
const { performance } = require('perf_hooks');
const source = process.env.PRINT_BENCH_SOURCE || path.join(__dirname, '../src');
const { selectNotes } = require(path.join(source, 'selection.cjs'));
const { render } = require(path.join(source, 'core.cjs'));
const vault = fs.mkdtempSync(path.join(os.tmpdir(), 'print-perf-'));

function measure(name, action) {
  const times = [];
  let counts;
  for (let i = 0; i < 6; i++) {
    counts = { stat: 0, readdir: 0, read: 0, exists: 0, realpath: 0 };
    const originals = {};
    for (const [key, method] of Object.entries({ stat: 'statSync', readdir: 'readdirSync', read: 'readFileSync', exists: 'existsSync', realpath: 'realpathSync' })) {
      originals[method] = fs[method];
      fs[method] = (...args) => { counts[key]++; return originals[method](...args); };
    }
    const start = performance.now();
    try { action(); } finally {
      times.push(performance.now() - start);
      Object.assign(fs, originals);
    }
  }
  times.shift(); // Discard the warm-up run.
  times.sort((a, b) => a - b);
  console.log(JSON.stringify({ name, medianMs: +times[2].toFixed(2), counts }));
}

try {
  fs.mkdirSync(path.join(vault, 'Notes'));
  for (let i = 0; i < 2000; i++) {
    const name = String((i * 733) % 2000).padStart(4, '0') + '.md';
    fs.writeFileSync(path.join(vault, 'Notes', name), '# Note\nPlain text');
  }
  measure('select all 2000 / created', () => selectNotes({ vault }));
  measure('select all 2000 / name', () => selectNotes({ vault, order: 'name' }));
  measure('select 2 of 2000', () => selectNotes({ vault, files: ['Notes/0001.md', 'Notes/0002.md'] }));
  fs.writeFileSync(path.join(vault, 'Repeat.md'), Array(100).fill('![[Notes/0001]]').join('\n\n'));
  measure('render same note embed 100 times', () => render({ vault, files: ['Repeat.md'] }));
  fs.writeFileSync(path.join(vault, 'Missing.md'), Array(100).fill('[[missing-name]]').join('\n\n'));
  measure('render same missing link 100 times', () => render({ vault, files: ['Missing.md'] }));
} finally { fs.rmSync(vault, { recursive: true, force: true }); }
