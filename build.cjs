const fs = require("fs"), path = require("path"), esbuild = require("esbuild");
const cssPath = require.resolve("katex/dist/katex.min.css");
const css = fs.readFileSync(cssPath, "utf8").replace(/url\((fonts\/[^)]+)\)/g, (_, p) => {
  const f = path.join(path.dirname(cssPath), p);
  return "url(data:font/" + path.extname(f).slice(1) + ";base64," + fs.readFileSync(f).toString("base64") + ")";
});
fs.writeFileSync(path.join(__dirname, "src/math-css.json"), JSON.stringify(css));
const browser = esbuild.buildSync({ absWorkingDir: __dirname, entryPoints: ["src/browser-entry.cjs"], bundle: true, platform: "browser", format: "iife", target: "chrome100", minify: true, write: false });
fs.writeFileSync(path.join(__dirname, "src/browser-script.json"), JSON.stringify(browser.outputFiles[0].text));
for (const [entry, out, external] of [["plugin.cjs", "main.js", ["obsidian", "electron"]], ["cli.cjs", "convert.cjs", []]]) esbuild.buildSync({ absWorkingDir: __dirname, entryPoints: [path.join(__dirname, "src", entry)], outfile: path.join(__dirname, out), bundle: true, platform: "node", format: "cjs", external, minify: true });

