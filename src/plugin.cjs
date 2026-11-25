const { Plugin, Modal, Setting, Notice } = require("obsidian");
const fs = require("fs"), path = require("path"), { shell } = require("electron");
const { render, list } = require("./core.cjs");
const { ExportService } = require("./export-service.cjs");
function printablePaths(files) {
  const paths = new Set();
  function add(file) {
    if (Array.isArray(file?.children)) file.children.forEach(add);
    else if (file?.path?.endsWith(".md")) paths.add(file.path);
  }
  files.forEach(add);
  return [...paths];
}
class ExportModal extends Modal {
  constructor(plugin, files = []) {
    super(plugin.app);
    this.plugin = plugin;
    this.options = { ...plugin.options };
    this.files = [...files];
    this.selected = files.length > 0;
  }
  onOpen() {
    const el = this.contentEl;
    el.createEl("h2", { text: "Clear Math Print" });
    el.createEl("p", { text: "Choose notes, review the list, then open an offline print preview." });
    const o = this.options;
    const refresh = () => {
      clearTimeout(this.refreshTimer);
      try {
        const base = this.app.vault.adapter.getBasePath();
        const result = list(base, o.folder, o.start, o.order, this.selected ? this.files : undefined);
        preview.setText(result.notes.length + " notes\n" + result.notes.map((p, i) => i + 1 + ". " + path.relative(base, p)).join("\n"));
        button.setDisabled(result.notes.length === 0);
      } catch (e) {
        preview.setText(e.message);
        button.setDisabled(true);
      }
    };
    const scheduleRefresh = () => {
      clearTimeout(this.refreshTimer);
      button.setDisabled(true);
      preview.setText("Updating note list...");
      this.refreshTimer = setTimeout(refresh, 150);
    };
    if (this.files.length) {
      new Setting(el).setName("Print source").addDropdown((d) => d.addOption("selected", "Selected files (" + this.files.length + ")").addOption("folder", "Folder").setValue("selected").onChange((v) => {
        this.selected = v === "selected";
        refresh();
      }));
      el.createEl("p", { text: "Selected files are used by default. Folder and starting-note filters apply only when Print source is Folder." });
    }
    new Setting(el).setName("Folder").setDesc("Vault-relative folder; includes subfolders.").addText((t) => t.setValue(o.folder).onChange((v) => {
      o.folder = v.trim();
      scheduleRefresh();
    }));
    new Setting(el).setName("Starting note (optional)").setDesc("Filename relative to the folder. Includes notes created at or after it.").addText((t) => t.setValue(o.start).onChange((v) => {
      o.start = v.trim();
      scheduleRefresh();
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
          const folder = path.join(base, this.app.vault.configDir, "plugins", this.plugin.manifest.id, "exports");
          const result = this.plugin.exportService.createPreview({ ...o, files: this.selected ? this.files : undefined, vault: base, title: "Vault Print Notes" }, folder);
          this.plugin.options = { ...o };
          await this.plugin.saveData(o);
          await this.plugin.exportService.open(result.file);
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
    clearTimeout(this.refreshTimer);
    this.contentEl.empty();
  }
}
module.exports = class extends Plugin {
  explorerSelection() {
    const files = [];
    for (const leaf of this.app.workspace.getLeavesOfType?.("file-explorer") || []) {
      const view = leaf.view;
      // Explorer selection is not exposed by the public API; support its tree
      // selection and DOM representation, with context-menu events as fallback.
      const selection = view.tree?.getSelection?.();
      if (selection?.[Symbol.iterator]) {
        for (const item of selection) if (item.file) files.push(item.file);
      }
      if (!files.length) {
        for (const el of view.containerEl?.querySelectorAll(".nav-file-title.is-selected, .nav-folder-title.is-selected") || []) {
          const file = this.app.vault.getAbstractFileByPath(el.getAttribute("data-path"));
          if (file) files.push(file);
        }
      }
    }
    return printablePaths(files);
  }
  async onload() {
    this.exportService = new ExportService({ render, fs, openPath: (file) => shell.openPath(file) });
    this.options = { folder: this.app.workspace.getActiveFile()?.parent?.path || "", start: "", order: "created", compact: true, noteBreaks: false, ...await this.loadData() };
    if (this.options.folder === "/") this.options.folder = "";
    const open = () => new ExportModal(this, this.explorerSelection()).open();
    this.addCommand({ id: "create-print-preview", name: "Create combined print preview", callback: open });
    this.addRibbonIcon("printer", "Clear Math Print", open);
    const addPrintItem = (menu, files) => {
      const paths = printablePaths(files);
      if (!paths.length) return;
      menu.addItem((item) => item.setTitle("Print selected notes (" + paths.length + ")").setIcon("printer").onClick(() => new ExportModal(this, paths).open()));
    };
    this.registerEvent(this.app.workspace.on("files-menu", (menu, files) => addPrintItem(menu, files)));
    this.registerEvent(this.app.workspace.on("file-menu", (menu, file) => addPrintItem(menu, [file])));
  }
};
