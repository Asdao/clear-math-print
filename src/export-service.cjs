const path = require('path');

// Platform adapters are supplied by the Obsidian entry point or CLI.
class ExportService {
  constructor({ render, fs, openPath, now = Date.now }) {
    this.render = render;
    this.fs = fs;
    this.openPath = openPath;
    this.now = now;
  }

  write(config, file) {
    const result = this.render(config);
    this.fs.mkdirSync(path.dirname(file), { recursive: true });
    this.fs.writeFileSync(file, result.html);
    this.fs.writeFileSync(file + '.json', JSON.stringify({ notes: result.notes, warnings: result.warnings }, null, 2));
    return { ...result, file };
  }

  createPreview(config, folder) {
    return this.write(config, path.join(folder, 'notes-' + this.now() + '.html'));
  }

  async open(file) {
    const error = await this.openPath(file);
    if (error) throw Error(error);
  }
}
module.exports = { ExportService };
