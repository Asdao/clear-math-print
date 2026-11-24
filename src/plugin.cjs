const { Plugin, Modal, Setting, Notice } = require("obsidian");
const fs = require("fs"), path = require("path"), { shell } = require("electron");
const { render, list } = require("./core.cjs");
class ExportModal extends Modal {
  constructor(plugin, files) {
    super(plugin.app);
    this.plugin = plugin;
    this.options = { ...plugin.options };
    this.files = files?.slice();
  }
  onOpen() {
    const el = this.contentEl;
    el.createEl("h2", { text: "Clear Math Print" });
    el.createEl("p", { text: "Choose notes, review the list, then open an offline print preview." });
    const o = this.options;
    const refresh = () => {
      try {
        const result = list(this.app.vault.adapter.getBasePath(), this.files ? "" : o.folder, this.files ? "" : o.start, o.order, this.files);
        preview.setText(result.notes.length + " notes\n" + result.notes.map((p, i) => i + 1 + ". " + path.basename(p, ".md")).join("\n"));
        button.setDisabled(result.notes.length === 0);
      } catch (e) {
        preview.setText(e.message);
        button.setDisabled(true);
      }
    };
    if (this.files) el.createEl("p", { text: "Printing selected Markdown notes only (including notes from different folders)." });
    if (!this.files) new Setting(el).setName("Folder").setDesc("Vault-relative folder; includes subfolders.").addText((t) => t.setValue(o.folder).onChange((v) => {
      o.folder = v.trim();
      refresh();
    }));
    if (!this.files) new Setting(el).setName("Starting note (optional)").setDesc("Filename relative to the folder. Includes notes created at or after it.").addText((t) => t.setValue(o.start).onChange((v) => {
      o.start = v.trim();
      refresh();
    }));
    new Setting(el).setName("Order").addDropdown((d) => d.addOption("created", "Creation date").addOption("name", "Filename").setValue(o.order).onChange((v) => {
      o.order = v;
      refresh();
    }));
    new Setting(el).setName("Compact layout").setDesc("Smaller text and images capped at 95 mm high. Turn off for detailed diagrams.").addToggle((t) => t.setValue(o.compact).onChange((v) => o.compact = v));
    new Setting(el).setName("Start each note on a new page").addToggle((t) => t.setValue(o.noteBreaks).onChange((v) => o.noteBreaks = v));
    const preview = el.createEl("pre");
    preview.style.maxHeight = "220px";
    preview.style.overflow = "auto";
    preview.style.whiteSpace = "pre-wrap";
    let button;
    new Setting(el).addButton((b) => {
      button = b;
      b.setButtonText("Create print preview").setCta().onClick(async () => {
        b.setDisabled(true);
        try {
          await new Promise((r) => setTimeout(r, 20));
          const base = this.app.vault.adapter.getBasePath();
          const result = render({ ...o, files: this.files, vault: base, title: "Vault Print Notes" });
          const folder = path.join(base, this.app.vault.configDir, "plugins", this.plugin.manifest.id, "exports");
          fs.mkdirSync(folder, { recursive: true });
          const file = path.join(folder, "notes-" + Date.now() + ".html");
          fs.writeFileSync(file, result.html);
          fs.writeFileSync(file + ".json", JSON.stringify({ notes: result.notes, warnings: result.warnings }, null, 2));
          this.plugin.options = { ...o };
          await this.plugin.saveData(o);
          const error = await shell.openPath(file);
          if (error) throw Error(error);
          new Notice("Print preview created: " + result.notes.length + " notes" + (result.warnings.length ? ". " + result.warnings.length + " warnings; see preview report." : ""), 1e4);
          if (result.warnings.length) {
            preview.setText(result.warnings.join("\n"));
          } else this.close();
        } catch (e) {
          new Notice("Export failed: " + e.message, 1e4);
        } finally {
          b.setDisabled(false);
        }
      });
    });
    refresh();
  }
  onClose() {
    this.contentEl.empty();
  }
}
module.exports = class extends Plugin {
  async onload() {
    this.options = { folder: this.app.workspace.getActiveFile()?.parent?.path || "", start: "", order: "created", compact: true, noteBreaks: false, ...await this.loadData() };
    this.addCommand({ id: "create-print-preview", name: "Create combined print preview", callback: () => new ExportModal(this).open() });
    this.registerEvent(this.app.workspace.on("files-menu", (menu, files) => {
      const notes = [...new Set(files.filter((file) => file.extension === "md").map((file) => file.path))];
      if (!notes.length) return;
      menu.addItem((item) => item.setTitle("Create print preview of selected notes")
        .setIcon("printer").onClick(() => new ExportModal(this, notes).open()));
    }));
    this.addRibbonIcon("printer", "Clear Math Print", () => new ExportModal(this).open());
  }
};

