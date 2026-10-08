import test from "node:test";
import assert from "node:assert/strict";
import { moduleAssetUrl, rewriteModuleImports } from "../functions/api/resolve.js";

test("runtime rewrites relative and root-relative ES module imports", () => {
  const source = 'import value from "./value.js"; export { value } from "../shared.js"; const lazy = import("/chunks/lazy.js");';
  const output = rewriteModuleImports(source, "demo.fair", "/src/main.js");
  assert.match(output, /\/api\/resolve\?url=/);
  assert.match(output, /asset=%2Fsrc%2Fvalue\.js/);
  assert.match(output, /asset=%2Fshared\.js/);
  assert.match(output, /asset=%2Fchunks%2Flazy\.js/);
});

test("runtime leaves external module imports unchanged", () => {
  const source = 'import React from "react"; import lib from "https://cdn.example/lib.js";';
  assert.equal(rewriteModuleImports(source, "demo.fair", "/index.js"), source);
});

test("module asset URL resolves paths relative to the importing module", () => {
  const url = moduleAssetUrl("demo.fair", "../lib/core.js?mode=dev", "/src/app/main.js");
  assert.ok(url);
  assert.match(url, /httc%3A%2F%2Fdemo\.fair%2Fsrc%2Flib%2Fcore\.js%3Fmode%3Ddev/);
  assert.match(url, /asset=%2Fsrc%2Flib%2Fcore\.js/);
});
