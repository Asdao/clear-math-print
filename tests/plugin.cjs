const assert = require('node:assert/strict');
const Module = require('node:module');
const original = Module._load;
let handler, modal;
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
  if (id === 'obsidian') return { Plugin, Modal };
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
  console.log('PASS: multi-file context action, mixed selections and empty selection');
})().catch(e => { console.error(e); process.exitCode = 1; });
