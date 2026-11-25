const path = require("path"), crypto = require("crypto");
const mathCss = require("./math-css.json");
const fontCss = require("./font-css.json");
const { createStyles, panelStyles } = require("./styles.cjs");
const { esc } = require("./html.cjs");
const browserScript = require("./browser-script.json");
const { initialSettings } = require("./formatting.cjs");
const { createFormattingPanel } = require("./formatting-panel.cjs");
function assembleDocument({ config, notes, body }) {
  const settings = initialSettings(config);
  const title = config.title || "Print Notes";
  const script = browserScript;
  const hash = crypto.createHash("sha256").update(script).digest("base64");
  const css = createStyles(settings);
  const toc = notes.map((p, i) => '<div><a href="#note-' + i + '">' + (i + 1) + ". " + esc(path.basename(p, ".md")) + "</a></div>").join("");
  const initial = esc(JSON.stringify(settings));
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data:; font-src data:; style-src \'unsafe-inline\'; script-src \'sha256-' + hash + '\'; base-uri \'none\'; form-action \'none\'"><title>' + esc(title) + '</title><style>' + mathCss + fontCss + panelStyles + '</style><style id="document-styles">' + css + '</style></head><body><div id="initial-formatting" hidden>' + initial + '</div>' + createFormattingPanel(settings, notes.length) + '<main class="print-document"><nav class="toc" aria-label="Contents">' + toc + '</nav>' + body + '</main><script>' + script + '</script></body></html>';
}
module.exports = { assembleDocument };
