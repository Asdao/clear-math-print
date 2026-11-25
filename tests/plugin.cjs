const assert = require("node:assert/strict");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const vm = require("node:vm"), { createRequire } = require("node:module");

async function check(entry) {
  const vault = fs.mkdtempSync(path.join(os.tmpdir(), "clear-math-plugin-"));
  fs.writeFileSync(path.join(vault, "Note.md"), '# Test\n\n$x^2$\n\n<meta http-equiv="refresh" content="0;url=https://example.invalid/">\n\n`[[Note]]`');
  let modal, button, opened, saved;
  const events = {};
  let leaves = [];
  const notices = [];
  const element = () => ({ style: {}, createEl: () => element(), setText(text) { this.text = text; }, empty() {} });
  class Plugin {
    constructor(app, manifest) { this.app = app; this.manifest = manifest; }
    async loadData() { return null; }
    async saveData(data) { saved = data; }
    addCommand(command) { this.command = command; }
    addRibbonIcon(icon, title, callback) { this.ribbon = callback; }
    registerEvent() {}
  }
  class Modal {
    constructor(app) { this.app = app; this.contentEl = element(); modal = this; }
    open() { this.onOpen(); }
    close() { this.closed = true; this.onClose(); }
  }
  class Control {
    setValue() { return this; }
    onChange() { return this; }
    addOption() { return this; }
    setButtonText() { return this; }
    setCta() { return this; }
    setDisabled(value) { this.disabled = value; return this; }
    onClick(callback) { this.click = callback; return this; }
  }
  class Setting {
    setName() { return this; }
    setDesc() { return this; }
    addText(cb) { cb(new Control()); return this; }
    addDropdown(cb) { cb(new Control()); return this; }
    addToggle(cb) { cb(new Control()); return this; }
    addButton(cb) { button = new Control(); cb(button); return this; }
  }
  const file = path.resolve(__dirname, "..", entry);
  const nativeRequire = createRequire(file);
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(file, "utf8"), {
    module, exports: module.exports, setTimeout, clearTimeout, console, Buffer, process,
    require(name) {
      if (name === "obsidian") return { Plugin, Modal, Setting, Notice: class { constructor(text) { notices.push(text); } } };
      if (name === "electron") return { shell: { async openPath(file) { opened = file; return ""; } } };
      return nativeRequire(name);
    }
  }, { filename: file });
  const app = {
    vault: { adapter: { getBasePath: () => vault }, configDir: ".obsidian" },
    workspace: {
      getActiveFile: () => ({ parent: { path: "/" } }),
      getLeavesOfType: () => leaves,
      on(name, callback) { events[name] = callback; return {}; }
    }
  };
  const plugin = new module.exports(app, { id: "clear-math-print" });
  await plugin.onload();
  assert.equal(plugin.options.folder, "", "vault-root active notes must select the vault root");
  plugin.command.callback();
  assert.equal(button.disabled, false);
  await button.click();
  assert.ok(opened, notices.join("\n"));
  assert.equal(path.dirname(opened), path.join(vault, ".obsidian/plugins/clear-math-print/exports"));
  const html = fs.readFileSync(opened, "utf8");
  assert.match(html, /class="katex"/);
  assert.match(html, /<code>\[\[Note\]\]<\/code>/);
  assert.doesNotMatch(html, /<meta http-equiv="refresh"/);
  assert.deepEqual(JSON.parse(fs.readFileSync(opened + ".json", "utf8")).notes, ["Note.md"]);
  assert.equal(saved.folder, "");
  assert.equal(modal.closed, true);
  assert.ok(notices.some((text) => text.includes("Print preview created: 1 notes")));
  fs.writeFileSync(path.join(vault, "Other.md"), "OTHER_NOTE");
  fs.mkdirSync(path.join(vault, "Course"));
  fs.writeFileSync(path.join(vault, "Course/Chosen.md"), "CHOSEN_NOTE");
  const chosen = { path: "Course/Chosen.md" };
  const other = { path: "Other.md" };
  // Explorer selections override stale folder/start filters and exclude other notes.
  plugin.options.folder = "missing-folder";
  plugin.options.start = "missing-note";
  leaves = [{ view: { tree: { getSelection: () => new Set([{ file: chosen }, { file: other }]) } } }];
  plugin.ribbon();
  assert.equal(modal.selected, true);
  assert.equal(modal.files.length, 2);
  await button.click();
  assert.deepEqual(JSON.parse(fs.readFileSync(opened + ".json", "utf8")).notes.sort(), ["Course/Chosen.md", "Other.md"]);
  assert.equal(Object.hasOwn(saved, "files"), false, "selection must not persist into future exports");
  // The public multi-file menu also handles folders, duplicates and attachments.
  let menuItem;
  const menu = { addItem(cb) { menuItem = { setTitle(title) { this.title = title; return this; }, setIcon() { return this; }, onClick(cb) { this.click = cb; return this; } }; cb(menuItem); } };
  events["files-menu"](menu, [{ path: "Course", children: [chosen] }, chosen, { path: "image.png" }]);
  assert.equal(menuItem.title, "Print selected notes (1)");
  menuItem.click();
  await button.click();
  assert.deepEqual(JSON.parse(fs.readFileSync(opened + ".json", "utf8")).notes, ["Course/Chosen.md"]);
  menuItem = null;
  events["file-menu"](menu, { path: "image.png" });
  assert.equal(menuItem, null);
  events["file-menu"](menu, other);
  menuItem.click();
  await button.click();
  assert.deepEqual(JSON.parse(fs.readFileSync(opened + ".json", "utf8")).notes, ["Other.md"]);
  // DOM fallback works when the explorer tree's private API is unavailable.
  app.vault.getAbstractFileByPath = (p) => p === other.path ? other : null;
  leaves = [{ view: { containerEl: { querySelectorAll: () => [{ getAttribute: () => other.path }] } } }];
  plugin.command.callback();
  assert.equal(modal.files[0], "Other.md");
  console.log("PASS: " + entry + " explorer selection, file/folder context menus, exact export scope and DOM fallback");
  console.log("PASS: " + entry + " plugin load, root-folder modal, export, report and browser handoff");
}
(async () => {
  await check("src/plugin.cjs");
  await check("main.js");
})().catch((error) => { console.error(error); process.exitCode = 1; });
