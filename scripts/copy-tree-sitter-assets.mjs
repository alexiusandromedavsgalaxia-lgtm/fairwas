import { cpSync, copyFileSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { supportedParserLanguages } from "../src/runtime/polyglot-parser.js";

const root = process.cwd();
const publicDir = resolve(root, "public");
const grammarSource = resolve(root, "node_modules/tree-sitter-wasms/out");
const grammarTarget = resolve(publicDir, "tree-sitter-languages");
const runtimeWasm = resolve(root, "node_modules/web-tree-sitter/tree-sitter.wasm");

mkdirSync(publicDir, { recursive: true });
const files = readdirSync(grammarSource);
const available = files
  .filter(file => /^tree-sitter-.+\.wasm$/.test(file))
  .map(file => file.slice("tree-sitter-".length, -".wasm".length))
  .sort();

const required = supportedParserLanguages().filter(language => language !== "yaml");
const missing = required.filter(language => !available.includes(language));
if (missing.length) {
  throw new Error("Tree-sitter grammars declared by YourCode are missing from tree-sitter-wasms: " + missing.join(", "));
}

cpSync(grammarSource, grammarTarget, { recursive: true, force: true });
copyFileSync(runtimeWasm, resolve(publicDir, "tree-sitter.wasm"));
writeFileSync(resolve(grammarTarget, "manifest.json"), JSON.stringify({
  runtime: "web-tree-sitter",
  runtimeVersion: "0.25.10",
  grammarPackage: "tree-sitter-wasms@0.1.13",
  languages: available.filter(language => required.includes(language)),
  dedicatedParsers: ["yaml"]
}, null, 2) + "\n");

console.log("Tree-sitter assets installed: " + required.length + " mapped grammars; " + available.length + " available grammars.");
