const fs = require("fs"), path = require("path");
function inside(root, file) {
  const rel = path.relative(root, file);
  return rel === "" || !rel.startsWith(".." + path.sep) && rel !== ".." && !path.isAbsolute(rel);
}
function selectNotes({ vault, folder = "", start = "", order = "created", files }) {
  vault = fs.realpathSync(vault);
  const all = [];
  const creationTimes = new Map();
  const createdAt = (file) => {
    if (!creationTimes.has(file)) creationTimes.set(file, fs.statSync(file).birthtimeMs);
    return creationTimes.get(file);
  };
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
    const available = new Set(all);
    for (const file of selected) {
      if (!inside(vault, file) || !available.has(file) || !file.endsWith(".md")) {
        throw Error("Selected note not found inside the vault: " + path.relative(vault, file));
      }
    }
    return { vault, all, notes: sortNotes(selected, order, createdAt) };
  }
  const base = path.resolve(vault, folder);
  if (!inside(vault, base)) throw Error("Folder must be inside the vault.");
  let cutoff = 0;
  if (start) {
    const p = path.resolve(base, start.endsWith(".md") ? start : start + ".md");
    if (!inside(base, p) || !fs.existsSync(p)) throw Error("Starting note not found in this folder.");
    cutoff = createdAt(p);
  }
  const notes = sortNotes(all.filter((p) => inside(base, p) && p.endsWith(".md") && createdAt(p) >= cutoff), order, createdAt);
  return { vault, all, notes };
}
function sortNotes(notes, order, createdAt) {
  return notes.sort((a, b) => order === "name" ? a.localeCompare(b) : createdAt(a) - createdAt(b) || a.localeCompare(b));
}
function list(vault, folder, start, order, files) {
  return selectNotes({ vault, folder, start, order, files });
}
module.exports = { inside, selectNotes, list };
