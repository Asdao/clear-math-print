const path = require("path"), crypto = require("crypto");
const mathCss = require("./math-css.json");
const { createStyles } = require("./styles.cjs");
const { esc } = require("./html.cjs");
const { browserRuntime } = require("./browser-runtime.cjs");
function assembleDocument({ config, notes, body }) {
  const compact = config.compact !== false;
  const title = config.title || "Print Notes";
  const script = "(" + browserRuntime.toString() + ")(document, window);";
  const hash = crypto.createHash("sha256").update(script).digest("base64");
  const css = createStyles(config);
  const toc = notes.map((p, i) => '<div><a href="#note-' + i + '">' + (i + 1) + ". " + esc(path.basename(p, ".md")) + "</a></div>").join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'; script-src 'sha256-` + hash + `'; base-uri 'none'; form-action 'none'"><title>` + esc(title) + "</title><style>" + mathCss + "\n" + css + '</style></head><body><div class="toolbar"><button id="print">Print / Save as PDF</button><p>' + notes.length + " notes \xB7 " + (compact ? "Compact" : "Comfortable") + ' layout. Choose A4, scale 100%, and enable background graphics.</p></div><nav class="toc">' + toc + "</nav>" + body + "<script>" + script + "<\/script></body></html>";
  return html;
}
module.exports = { assembleDocument };
