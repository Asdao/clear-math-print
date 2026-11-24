const fs = require("fs"), path = require("path");
function inside(root, file) {
  const rel = path.relative(root, file);
  return rel === "" || !rel.startsWith(".." + path.sep) && rel !== ".." && !path.isAbsolute(rel);
}
function selectNotes({ vault, folder = "", start = "", order = "created", files }) {
  vault = fs.realpathSync(vault);
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
  if (files !== undefined) {
    if (!Array.isArray(files)) throw Error("Selected notes must be a list.");
    if (files.some((file) => typeof file !== "string")) throw Error("Selected notes must be paths.");
    const selected = [...new Set(files.map((file) => path.resolve(vault, file)))];
    for (const file of selected) {
      if (!inside(vault, file) || !all.includes(file) || !file.endsWith(".md")) {
        throw Error("Selected note not found inside the vault: " + path.relative(vault, file));
      }
    }
    return { vault, all, notes: sortNotes(selected, order) };
  }
  const base = path.resolve(vault, folder);
  if (!inside(vault, base)) throw Error("Folder must be inside the vault.");
  let cutoff = 0;
  if (start) {
    const p = path.resolve(base, start.endsWith(".md") ? start : start + ".md");
    if (!inside(base, p) || !fs.existsSync(p)) throw Error("Starting note not found in this folder.");
    cutoff = fs.statSync(p).birthtimeMs;
  }
  const notes = sortNotes(all.filter((p) => inside(base, p) && p.endsWith(".md") && fs.statSync(p).birthtimeMs >= cutoff), order);
  return { vault, all, notes };
}
function sortNotes(notes, order) {
  return notes.sort((a, b) => order === "name" ? a.localeCompare(b) : fs.statSync(a).birthtimeMs - fs.statSync(b).birthtimeMs || a.localeCompare(b));
}
function list(vault, folder, start, order, files) {
  return selectNotes({ vault, folder, start, order, files });
}
module.exports = { inside, selectNotes, list };
