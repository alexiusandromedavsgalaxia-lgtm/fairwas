import test from "node:test";
import assert from "node:assert/strict";
import { assetEndpoint, moduleAssetUrl, rewriteModuleImports } from "../functions/api/resolve.js";

test("assetEndpoint routes stored files through the HTTC resolver", () => {
  const url = assetEndpoint("site.fair", "/images/hero image.png");
  assert.match(url, /^\/api\/resolve\?url=/);
  assert.match(url, /asset=%2Fimages%2Fhero%20image\.png/);
});

test("moduleAssetUrl resolves relative imports against the module path", () => {
  const url = moduleAssetUrl("site.fair", "../shared/util.js", "/scripts/app.js");
  assert.equal(url, "/api/resolve?url=httc%3A%2F%2Fsite.fair%2Fshared%2Futil.js&asset=%2Fshared%2Futil.js");
});

test("rewriteModuleImports rewrites static and dynamic local imports", () => {
  const source = 'import { x } from "./util.js"; export { y } from "../shared/y.js"; const lazy = import("/chunks/lazy.js");';
  const result = rewriteModuleImports(source, "site.fair", "/scripts/app.js");
  assert.match(result, /url=httc%3A%2F%2Fsite\.fair%2Fshared%2Futil\.js/);
  assert.match(result, /url=httc%3A%2F%2Fsite\.fair%2Fshared%2Fy\.js/);
  assert.match(result, /url=httc%3A%2F%2Fsite\.fair%2Fchunks%2Flazy\.js/);
});
