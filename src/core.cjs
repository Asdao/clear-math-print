const fs = require("fs"), path = require("path");
const { inside, selectNotes, list } = require("./selection.cjs");
const { assembleDocument } = require("./document.cjs");
const MarkdownIt = require("markdown-it"), texmath = require("markdown-it-texmath"), katex = require("katex");
const { esc } = require("./html.cjs");
function render(config) {
  const { vault, all, notes } = selectNotes(config);
  if (!notes.length) throw Error("No notes matched.");
  const warnings = [], warning = (s) => {
    if (!warnings.includes(s)) warnings.push(s);
  };
  const ids = new Map(notes.map((p, i) => [p, "note-" + i]));
  const md = new MarkdownIt({ html: true, breaks: true }).use(texmath, { engine: katex, delimiters: "dollars", katexOptions: { throwOnError: false, strict: false, trust: false } });
  const resolutions = new Map(), texts = new Map();
  let relativePaths, basenames;
  function findIndexed(name) {
    if (!relativePaths) {
      // Build only on fallback; preserve traversal order for duplicate basenames.
      relativePaths = new Map();
      basenames = new Map();
      for (const file of all) {
        relativePaths.set(path.relative(vault, file).replaceAll("\\", "/"), file);
        const base = path.basename(file);
        for (const key of [base, ...(base.endsWith(".md") ? [base.slice(0, -3)] : [])]) {
          if (!basenames.has(key)) basenames.set(key, file);
        }
      }
    }
    return relativePaths.get(name) || basenames.get(name);
  }
  function resolve(ref, source) {
    let cache = resolutions.get(path.dirname(source));
    if (!cache) resolutions.set(path.dirname(source), cache = new Map());
    if (!cache.has(ref)) cache.set(ref, resolveUncached(ref, source));
    return cache.get(ref);
  }
  function resolveUncached(ref, source) {
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
    return findIndexed(name);
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
    if (!texts.has(p)) texts.set(p, fs.readFileSync(p, "utf8").replace(/^\uFEFF/, "").replace(/^---\r?\n[\s\S]*?\r?\n---\s*\r?\n/, ""));
    let text = section(texts.get(p), heading);
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
  const body = notes.map((p, i) => '<article class="note" id="note-' + i + '"><h1>' + esc(path.basename(p, ".md")) + "</h1>" + note(p) + "</article>").join("\n");
  const html = assembleDocument({ config, notes, body });
  return { html, notes: notes.map((p) => path.relative(vault, p).replaceAll("\\", "/")), warnings };
}
module.exports = { render, list };

