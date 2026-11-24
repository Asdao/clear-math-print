const assert = require('node:assert/strict');
const Module = require('node:module');
const original = Module._load;
let handler, modal;
const controls = new Map();
let disabled;
class Setting {
  constructor() {}
  setName(name) { this.name = name; return this; }
  setDesc() { return this; }
  addText(callback) { callback({ setValue() { return this; }, onChange: fn => controls.set(this.name, fn) }); return this; }
  addDropdown(callback) { callback({ addOption() { return this; }, setValue() { return this; }, onChange: fn => controls.set(this.name, fn) }); return this; }
  addToggle(callback) { callback({ setValue() { return this; }, onChange() {} }); return this; }
  addButton(callback) { callback({ setDisabled(value) { disabled = value; return this; }, setButtonText() { return this; }, setCta() { return this; }, onClick() {} }); return this; }
}
class Plugin {
  async loadData() { return {}; }
  addCommand() {}
  addRibbonIcon() {}
  registerEvent(event) { this.event = event; }
}
class Modal {
  constructor(app) { this.app = app; }
  open() { modal = this; }
}
Module._load = function(id, ...args) {
  if (id === 'obsidian') return { Plugin, Modal, Setting };
  if (id === 'electron') return { shell: {} };
  return original.call(this, id, ...args);
};
const PrintPlugin = require('../src/plugin.cjs');
Module._load = original;
(async () => {
  const plugin = new PrintPlugin();
  plugin.app = { workspace: { getActiveFile: () => null, on: (name, cb) => {
    assert.equal(name, 'files-menu'); handler = cb; return 'registered';
  } } };
  await plugin.onload();
  assert.equal(plugin.event, 'registered');
  let action, count = 0;
  const item = { setTitle() { return this; }, setIcon() { return this; }, onClick(cb) { action = cb; return this; } };
  const menu = { addItem(cb) { count++; cb(item); } };
  handler(menu, [{ path: 'Course/A.md', extension: 'md' }, { path: 'Other/B.md', extension: 'md' }, { path: 'Course/A.md', extension: 'md' }, { path: 'photo.png', extension: 'png' }, { path: 'Folder' }]);
  action();
  assert.deepEqual(modal.files, ['Course/A.md', 'Other/B.md']);
  assert.equal(modal.options.folder, '');
  handler(menu, [{ path: 'Folder' }]);
  assert.equal(count, 1);
  const fs = require('fs'), path = require('path'), os = require('os');
  const vault = fs.mkdtempSync(path.join(os.tmpdir(), 'print-debounce-'));
  fs.writeFileSync(path.join(vault, 'A.md'), 'Note');
  plugin.app.vault = { adapter: { getBasePath: () => vault } };
  modal.files = undefined;
  modal.contentEl = { createEl: () => ({ style: {}, setText() {} }), empty() {} };
  const originalRead = fs.readdirSync, originalSet = global.setTimeout, originalClear = global.clearTimeout;
  const timers = new Map();
  let scans = 0, next = 0;
  try {
    fs.readdirSync = (...args) => { scans++; return originalRead(...args); };
    global.setTimeout = callback => { timers.set(++next, callback); return next; };
    global.clearTimeout = id => timers.delete(id);
    modal.onOpen();
    assert.equal(scans, 1);
    controls.get('Folder')('C'); controls.get('Folder')('Co'); controls.get('Folder')('');
    assert.equal(scans, 1);
    assert.equal(disabled, true);
    assert.equal(timers.size, 1);
    [...timers.values()][0]();
    assert.equal(scans, 2);
    assert.equal(disabled, false);
    controls.get('Folder')('');
    controls.get('Order')('name'); // Immediate refresh cancels queued text refresh.
    assert.equal(timers.size, 0);
    controls.get('Folder')('');
    modal.onClose();
    assert.equal(timers.size, 0);
  } finally {
    fs.readdirSync = originalRead; global.setTimeout = originalSet; global.clearTimeout = originalClear;
    fs.rmSync(vault, { recursive: true, force: true });
  }
  console.log('PASS: debounced dialog refresh and timer cleanup');
  console.log('PASS: multi-file context action, mixed selections and empty selection');
})().catch(e => { console.error(e); process.exitCode = 1; });
