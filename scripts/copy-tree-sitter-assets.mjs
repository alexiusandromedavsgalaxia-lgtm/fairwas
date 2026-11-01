import { cpSync, copyFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const publicDir = resolve(root, "public");
const grammarSource = resolve(root, "node_modules/tree-sitter-wasms/out");
const grammarTarget = resolve(publicDir, "tree-sitter-languages");
const runtimeWasm = resolve(root, "node_modules/web-tree-sitter/tree-sitter.wasm");

mkdirSync(publicDir, { recursive: true });
cpSync(grammarSource, grammarTarget, { recursive: true, force: true });
copyFileSync(runtimeWasm, resolve(publicDir, "tree-sitter.wasm"));
console.log("Tree-sitter runtime and language grammars copied to public assets.");
