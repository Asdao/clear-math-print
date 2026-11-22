var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
const fs = require("fs"), path = require("path"), esbuild = require("esbuild");
const cssPath = require.resolve("katex/dist/katex.min.css");
const css = fs.readFileSync(cssPath, "utf8").replace(/url\((fonts\/[^)]+)\)/g, (_, p) => {
  const f = path.join(path.dirname(cssPath), p);
  return "url(data:font/" + path.extname(f).slice(1) + ";base64," + fs.readFileSync(f).toString("base64") + ")";
});
fs.writeFileSync(path.join(__dirname, "src/math-css.json"), JSON.stringify(css));
for (const [entry, out, external] of [["plugin.cjs", "main.js", ["obsidian", "electron"]], ["cli.cjs", "convert.cjs", []]]) esbuild.buildSync({ absWorkingDir: __dirname, entryPoints: [path.join(__dirname, "src", entry)], outfile: path.join(__dirname, out), bundle: true, platform: "node", format: "cjs", external, minify: true });
