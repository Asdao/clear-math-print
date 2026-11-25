const fs = require("fs"), path = require("path");
const MarkdownIt = require("markdown-it"), texmath = require("markdown-it-texmath"), katex = require("katex");
const { inside, selectNotes, list } = require("./selection.cjs");
const { assembleDocument } = require("./document.cjs");
const { esc } = require("./html.cjs");
function render(config) {
  const { vault, all, notes } = selectNotes(config);
  if (!notes.length) throw Error("No notes matched.");
  const warnings = [], warning = (s) => {
    if (!warnings.includes(s)) warnings.push(s);
  };
  const ids = new Map(notes.map((p, i) => [p, "note-" + i]));
  const md = new MarkdownIt({ html: false, breaks: true }).use(texmath, { engine: katex, delimiters: "dollars", katexOptions: { throwOnError: false, strict: false, trust: false } });
  // Transform only parsed prose, so fenced/indented code and math stay literal.
  md.core.ruler.before("inline", "callouts", (state) => {
    let depth = 0;
    for (const token of state.tokens) {
      if (token.type === "blockquote_open") depth++;
      if (token.type === "blockquote_close") depth--;
      if (depth && token.type === "inline") {
        token.content = token.content.replace(/^\[!([^\]]+)\][+-]?[ \t]*(.*)/, (_, type, title) => "**" + (title || type.toUpperCase()) + "**");
      }
    }
  });
  md.inline.ruler.before("image", "wiki", (state, silent) => {
    const match = /^(!?)\[\[([^\]\n]+)\]\]/.exec(state.src.slice(state.pos));
    if (!match) return false;
    if (!silent) {
      const [, embed, ref] = match;
      const [target, label] = ref.split("|");
      const [name, head] = splitRef(target);
      const { source, stack } = state.env;
      const dest = name ? resolve(name, source) : source;
      let html;
      if (!embed) {
        html = dest && ids.has(dest) ? '<a href="#' + ids.get(dest) + '">' + esc(label || head || name) + "</a>" : esc(label || head || name);
      } else if (!dest) {
        warning("Missing embed: " + ref);
        html = '<span class="warning">' + esc("[Missing embed: " + ref + "]") + "</span>";
      } else if (dest.endsWith(".md")) {
        html = '<div class="embedded">' + note(dest, [...stack, source], head) + "</div>";
      } else {
        const src = image(dest);
        html = src ? '<img src="' + src + '" alt="' + esc(name) + '" ' + (/^\d+(x\d+)?$/.test(label || "") ? 'style="width:' + Number(label.split("x")[0]) + 'px"' : "") + ">" : "<span>[Unsupported attachment]</span>";
      }
      state.push("wiki", "", 0).content = html;
    }
    state.pos += match[0].length;
    return true;
  });
  md.renderer.rules.wiki = (tokens, i) => tokens[i].content;
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
    const text = section(texts.get(p), heading);
    return md.render(text, { source: p, stack }).replace(/<section>/g, '<div class="equation">').replace(/<\/section>/g, "</div>");
  }
  const body = notes.map((p, i) => {
    let content = note(p);
    const name = esc(path.basename(p, ".md"));
    const firstHeading = /^\s*<h1>([\s\S]*?)<\/h1>/.exec(content);
    let heading = '<h1 class="note-title">' + name + '</h1>';
    if (firstHeading && firstHeading[1].replace(/<[^>]*>/g, "").trim().toLowerCase() === name.toLowerCase()) {
      content = content.replace(/^\s*<h1>/, '<h1 class="note-title">');
      heading = "";
    }
    return '<article class="note" id="note-' + i + '">' + heading + content + '</article>';
  }).join("\n");
  const html = assembleDocument({ config, notes, body });
  return { html, notes: notes.map((p) => path.relative(vault, p).replaceAll("\\", "/")), warnings };
}
module.exports = { render, list };
