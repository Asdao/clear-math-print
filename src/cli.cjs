const fs = require("fs"), path = require("path"), { render } = require("./core.cjs");
const args = process.argv.slice(2);
if (args.includes("--help") || !args.includes("--vault")) {
  console.log('node convert.cjs --vault PATH --folder PATH [--start "Boolean Algebra.md"] [--order created|name] [--comfortable] [--note-breaks] [--out notes.html]');
  process.exit(args.includes("--help") ? 0 : 1);
}
function arg(k, fallback) {
  const i = args.indexOf(k);
  if (i < 0) return fallback;
  if (!args[i + 1] || args[i + 1].startsWith("--")) throw Error("Missing value for " + k);
  return args[i + 1];
}
try {
  const result = render({ vault: arg("--vault"), folder: arg("--folder", ""), start: arg("--start", ""), order: arg("--order", "created"), compact: !args.includes("--comfortable"), noteBreaks: args.includes("--note-breaks"), title: "Print Notes" });
  const out = path.resolve(arg("--out", "notes.html"));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, result.html);
  fs.writeFileSync(out + ".json", JSON.stringify({ notes: result.notes, warnings: result.warnings }, null, 2));
  console.log(JSON.stringify({ out, notes: result.notes.length, warnings: result.warnings }, null, 2));
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
