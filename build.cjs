const fs = require("fs"), path = require("path"), esbuild = require("esbuild");
const cssPath = require.resolve("katex/dist/katex.min.css");
const css = fs.readFileSync(cssPath, "utf8").replace(/url\((fonts\/[^)]+)\)/g, (_, p) => {
  const f = path.join(path.dirname(cssPath), p);
  return "url(data:font/" + path.extname(f).slice(1) + ";base64," + fs.readFileSync(f).toString("base64") + ")";
});
fs.writeFileSync(path.join(__dirname, "src/math-css.json"), JSON.stringify(css));
let fontCss = "", fontNotices = "\n\n=== Bundled print fonts ===\n";
for (const name of ["source-serif-4", "source-sans-3", "inter"]) {
  const root = path.dirname(require.resolve("@fontsource-variable/" + name + "/package.json"));
  const license = fs.readFileSync(path.join(root, "LICENSE"), "utf8");
  const version = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version;
  // Retain font licenses in every self-contained HTML export as CSS comments.
  fontCss += "\n/* @fontsource-variable/" + name + " " + version + "\n" + license + "\n*/\n";
  fontNotices += "\n=== @fontsource-variable/" + name + " " + version + " (OFL-1.1) ===\n" + license;
  for (const sheet of ["wght.css", "wght-italic.css"]) {
    fontCss += fs.readFileSync(path.join(root, sheet), "utf8").replace(/url\((\.\/files\/[^)]+)\)/g, (_, file) => "url(data:font/woff2;base64," + fs.readFileSync(path.join(root, file)).toString("base64") + ")").replaceAll("font-display: swap", "font-display: block");
  }
}
fs.writeFileSync(path.join(__dirname, "src/font-css.json"), JSON.stringify(fontCss));
const noticesPath = path.join(__dirname, "THIRD-PARTY-NOTICES.txt");
fs.writeFileSync(noticesPath, fs.readFileSync(noticesPath, "utf8").split("\n\n=== Bundled print fonts ===")[0] + fontNotices);
const browser = esbuild.buildSync({ absWorkingDir: __dirname, entryPoints: ["src/browser-entry.cjs"], bundle: true, platform: "browser", format: "iife", target: "chrome100", minify: true, write: false });
fs.writeFileSync(path.join(__dirname, "src/browser-script.json"), JSON.stringify(browser.outputFiles[0].text));
for (const [entry, out, external] of [["plugin.cjs", "main.js", ["obsidian", "electron"]], ["cli.cjs", "convert.cjs", []]]) esbuild.buildSync({ absWorkingDir: __dirname, entryPoints: [path.join(__dirname, "src", entry)], outfile: path.join(__dirname, out), bundle: true, platform: "node", format: "cjs", external, minify: true });
