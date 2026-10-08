import test from "node:test";
import assert from "node:assert/strict";
import { assetEndpoint, moduleAssetUrl, rewriteModuleImports, rewriteSrcset, documentPathCandidates } from "../functions/api/resolve.js";

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


test("assetEndpoint preserves asset query strings without changing the stored path", () => {
  const url = assetEndpoint("site.fair", "/api/data.json", "?version=3&lang=es");
  assert.match(url, /url=httc%3A%2F%2Fsite.fair%2Fapi%2Fdata.json%3Fversion%3D3%26lang%3Des/);
  assert.match(url, /asset=%2Fapi%2Fdata.json/);
});

test("moduleAssetUrl preserves query strings for module imports", () => {
  const url = moduleAssetUrl("site.fair", "./chunk.js?v=2", "/scripts/app.js");
  assert.match(url, /url=httc%3A%2F%2Fsite.fair%2Fscripts%2Fchunk.js%3Fv%3D2/);
  assert.match(url, /asset=%2Fscripts%2Fchunk.js/);
});


test("rewriteSrcset preserves data URLs and image descriptors", () => {
  const source = "data:image/png;base64,AAAA 1x, /images/hero.png 2x";
  const result = rewriteSrcset(source, raw => raw.startsWith("/") ? "/local" + raw : null);
  assert.equal(result, "data:image/png;base64,AAAA 1x, /local/images/hero.png 2x");
});

test("rewriteSrcset rewrites ordinary candidates without descriptors", () => {
  const result = rewriteSrcset("/a.png, /b.png", raw => "/asset" + raw);
  assert.equal(result, "/asset/a.png, /asset/b.png");
});


test("documentPathCandidates prefers real nested pages for clean URLs", () => {
  assert.deepEqual(documentPathCandidates("/loqsea"), ["/loqsea", "/loqsea/index.html", "/loqsea/index.htm", "/loqsea/index.xhtml", "/loqsea.html", "/loqsea.htm"]);
});

test("documentPathCandidates handles directory URLs and keeps file extensions", () => {
  assert.deepEqual(documentPathCandidates("/loqsea/"), ["/loqsea/index.html", "/loqsea/index.htm", "/loqsea/index.xhtml", "/loqsea.html", "/loqsea.htm"]);
  assert.deepEqual(documentPathCandidates("/loqsea/page.html"), ["/loqsea/page.html"]);
});
