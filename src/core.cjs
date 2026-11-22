const fs = require("fs"), path = require("path"), crypto = require("crypto");
const MarkdownIt = require("markdown-it"), texmath = require("markdown-it-texmath"), katex = require("katex");
const mathCss = require("./math-css.json");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function inside(root, file) {
  const rel = path.relative(root, file);
  return rel === "" || !rel.startsWith(".." + path.sep) && rel !== ".." && !path.isAbsolute(rel);
}
function list(vault, folder = "", start = "", order = "created") {
  vault = fs.realpathSync(vault);
  const base = path.resolve(vault, folder);
  if (!inside(vault, base)) throw Error("Folder must be inside the vault.");
  const all = [];
  function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name.startsWith(".") || e.isSymbolicLink()) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else all.push(p);
    }
  }
  walk(vault);
  let cutoff = 0;
  if (start) {
    const p = path.resolve(base, start.endsWith(".md") ? start : start + ".md");
    if (!inside(base, p) || !fs.existsSync(p)) throw Error("Starting note not found in this folder.");
    cutoff = fs.statSync(p).birthtimeMs;
  }
  const notes = all.filter((p) => inside(base, p) && p.endsWith(".md") && fs.statSync(p).birthtimeMs >= cutoff).sort((a, b) => order === "name" ? a.localeCompare(b) : fs.statSync(a).birthtimeMs - fs.statSync(b).birthtimeMs || a.localeCompare(b));
  return { vault, all, notes };
}
function render(config) {
  const { vault, all, notes } = list(config.vault, config.folder, config.start, config.order);
  if (!notes.length) throw Error("No notes matched.");
  const warnings = [], warning = (s) => {
    if (!warnings.includes(s)) warnings.push(s);
  };
  const ids = new Map(notes.map((p, i) => [p, "note-" + i]));
  const md = new MarkdownIt({ html: true, breaks: true }).use(texmath, { engine: katex, delimiters: "dollars", katexOptions: { throwOnError: false, strict: false, trust: false } });
  function resolve(ref, source) {
    let name;
    try {
      name = decodeURIComponent(ref);
    } catch {
      name = ref;
    }
    if (/^[a-z][a-z0-9+.-]*:/i.test(name)) return null;
    const candidates = [path.resolve(path.dirname(source), name), path.resolve(vault, name)];
    for (const p of candidates) {
      for (const candidate of [p, p + ".md"]) if (inside(vault, candidate) && fs.existsSync(candidate) && fs.statSync(candidate).isFile() && inside(vault, fs.realpathSync(candidate))) return candidate;
    }
    return all.find((p) => path.relative(vault, p).replaceAll("\\", "/") === name) || all.find((p) => path.basename(p) === name || path.basename(p) === name + ".md");
  }
  const cache = /* @__PURE__ */ new Map();
  function image(p) {
    if (cache.has(p)) return cache.get(p);
    const mime = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml" }[path.extname(p).toLowerCase()];
    if (!mime) {
      warning("Unsupported attachment: " + path.relative(vault, p));
      return "";
    }
    const value = "data:" + mime + ";base64," + fs.readFileSync(p).toString("base64");
    cache.set(p, value);
    return value;
  }
  function splitRef(ref) {
    const i = ref.indexOf("#");
    return i < 0 ? [ref, ""] : [ref.slice(0, i), ref.slice(i + 1)];
  }
  function section(text, heading) {
    if (!heading) return text;
    if (heading.startsWith("^")) {
      warning("Block embed requires review: " + heading);
      return "> [Block embed not supported: " + heading + "]";
    }
    const lines = text.split("\n");
    let a = -1, level = 0, b = lines.length;
    for (let i = 0; i < lines.length; i++) {
      const m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(lines[i]);
      if (!m) continue;
      if (a < 0 && m[2].toLowerCase() === heading.toLowerCase()) {
        a = i;
        level = m[1].length;
      } else if (a >= 0 && m[1].length <= level) {
        b = i;
        break;
      }
    }
    if (a < 0) {
      warning("Missing embedded heading: " + heading);
      return "> [Missing heading: " + heading + "]";
    }
    return lines.slice(a, b).join("\n");
  }
  const defaultImage = md.renderer.rules.image;
  md.renderer.rules.image = (tokens, i, opts, env, self) => {
    const t = tokens[i], src = t.attrGet("src");
    if (src && !src.startsWith("data:")) {
      const p = resolve(src, env.source);
      const data = p && image(p);
      if (data) t.attrSet("src", data);
      else {
        warning("Missing or remote image: " + src);
        return '<span class="warning">' + esc("[Image unavailable: " + src + "]") + "</span>";
      }
    }
    return defaultImage(tokens, i, opts, env, self);
  };
  const defaultLink = md.renderer.rules.link_open || ((tokens, i, o, e, self) => self.renderToken(tokens, i, o));
  md.renderer.rules.link_open = (tokens, i, o, e, self) => {
    const href = tokens[i].attrGet("href") || "";
    const [name] = splitRef(href);
    const p = resolve(name, e.source);
    if (p && ids.has(p)) tokens[i].attrSet("href", "#" + ids.get(p));
    return defaultLink(tokens, i, o, e, self);
  };
  function note(p, stack = [], heading = "") {
    if (stack.includes(p) || stack.length >= 8) {
      warning("Circular or deep embed: " + path.relative(vault, p));
      return '<p class="warning">[Circular/deep note embed]</p>';
    }
    let text = section(fs.readFileSync(p, "utf8").replace(/^\uFEFF/, "").replace(/^---\r?\n[\s\S]*?\r?\n---\s*\r?\n/, ""), heading);
    const replacements = [];
    function hold(html3) {
      const key = "PRINTPLACEHOLDER" + replacements.length + "END";
      replacements.push(html3);
      return key;
    }
    text = text.replace(/^([ \t]*)>\s*\[!([^\]]+)\][+-]?\s*(.*)$/gm, (_, ws, type, title2) => ws + "> **" + (title2 || type.toUpperCase()) + "**");
    text = text.replace(/!\[\[([^\]]+)\]\]/g, (_, ref) => {
      const [target, size] = ref.split("|");
      const [name, head] = splitRef(target);
      const dest = name ? resolve(name, p) : p;
      if (!dest) {
        warning("Missing embed: " + ref);
        return hold('<p class="warning">' + esc("[Missing embed: " + ref + "]") + "</p>");
      }
      if (dest.endsWith(".md")) return "\n\n" + hold('<div class="embedded">' + note(dest, [...stack, p], head) + "</div>") + "\n\n";
      const src = image(dest);
      return hold(src ? '<img src="' + src + '" alt="' + esc(name) + '" ' + (/^\d+(x\d+)?$/.test(size || "") ? 'style="width:' + Number(size.split("x")[0]) + 'px"' : "") + ">" : "<p>[Unsupported attachment]</p>");
    });
    text = text.replace(/\[\[([^\]]+)\]\]/g, (_, ref) => {
      const [target, alias] = ref.split("|");
      const [name, head] = splitRef(target);
      const dest = name ? resolve(name, p) : p;
      return hold(dest && ids.has(dest) ? '<a href="#' + ids.get(dest) + '">' + esc(alias || head || name) + "</a>" : esc(alias || head || name));
    });
    let html2 = md.render(text, { source: p }).replace(/<section>/g, '<div class="equation">').replace(/<\/section>/g, "</div>");
    html2 = html2.replace(/PRINTPLACEHOLDER(\d+)END/g, (_, i) => replacements[Number(i)]);
    return html2;
  }
  const compact = config.compact !== false;
  const width = compact ? 155 : 182;
  const title = config.title || "Print Notes";
  const body = notes.map((p, i) => '<article class="note" id="note-' + i + '"><h1>' + esc(path.basename(p, ".md")) + "</h1>" + note(p) + "</article>").join("\n");
  const script = `function fit(){for(const e of document.querySelectorAll('.katex-display')){e.style.fontSize='';const k=e.querySelector('.katex');if(k&&k.scrollWidth>e.clientWidth)e.style.fontSize=(e.clientWidth/k.scrollWidth*100)+'%';}}async function ready(){await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));fit();document.body.dataset.ready='true';}ready();window.addEventListener('beforeprint',fit);document.getElementById('print').onclick=async()=>{await ready();window.print();};`;
  const hash = crypto.createHash("sha256").update(script).digest("base64");
  const css = `@page{size:A4;margin:12mm 12mm 14mm}*{box-sizing:border-box}body{font:${compact ? "10" : "11"}pt/1.4 Georgia,serif;color:#17202a;margin:0}.note+.note{${config.noteBreaks ? "break-before:page;" : "margin-top:28px;"}}h1{font-size:21pt;border-bottom:2px solid #34495e;padding-bottom:6px;margin:0 0 12px}h2{font-size:15pt}h3{font-size:12pt}h1,h2,h3,h4{break-after:avoid;line-height:1.25}p{margin:6px 0}img{display:block;max-width:100%;max-height:${compact ? "95" : "230"}mm;width:auto;height:auto;object-fit:contain;margin:7px auto;break-inside:avoid}table{width:100%;border-collapse:collapse;font-size:8.5pt;margin:9px 0}th,td{border:1px solid #bdc7d1;padding:4px;overflow-wrap:anywhere}th{background:#edf1f5}tr{break-inside:avoid}thead{display:table-header-group}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f1f3f5;padding:8px;font-size:8.5pt}blockquote{background:#f3f5f7;border-left:3px solid #9aa8b6;margin:8px 0;padding:5px 12px}.katex-display{overflow:visible!important;padding:5px 0;break-inside:avoid;margin:9px 0}.equation{break-inside:avoid}.katex{line-height:normal}a{color:inherit;text-decoration:none}.warning{color:#943600}.embedded{border-left:2px solid #b8c4d0;padding-left:10px}code{font-size:.9em}.toc{columns:2;font:10pt/1.7 sans-serif;margin-bottom:22px}.toolbar{font:14px sans-serif;background:#edf1f5;padding:16px;margin-bottom:24px}.toolbar button{padding:8px 16px;cursor:pointer}@media screen{body{max-width:${width}mm;margin:24px auto;padding:12px}}@media print{.toolbar{display:none}body{max-width:none}.note img{max-width:${width}mm}}`;
  const toc = notes.map((p, i) => '<div><a href="#note-' + i + '">' + (i + 1) + ". " + esc(path.basename(p, ".md")) + "</a></div>").join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'; script-src 'sha256-` + hash + `'; base-uri 'none'; form-action 'none'"><title>` + esc(title) + "</title><style>" + mathCss + "\n" + css + '</style></head><body><div class="toolbar"><button id="print">Print / Save as PDF</button><p>' + notes.length + " notes \xB7 " + (compact ? "Compact" : "Comfortable") + ' layout. Choose A4, scale 100%, and enable background graphics.</p></div><nav class="toc">' + toc + "</nav>" + body + "<script>" + script + "<\/script></body></html>";
  return { html, notes: notes.map((p) => path.relative(vault, p).replaceAll("\\", "/")), warnings };
}
module.exports = { render, list };
