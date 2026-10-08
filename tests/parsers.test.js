import test from "node:test";
import assert from "node:assert/strict";
import { rewriteCssUrls, rewriteJavaScriptImports, rewriteJavaScriptLocationRedirects, transformHtmlDocument } from "../src/runtime/parsers.js";

test("CSS parser rewrites url() and @import without touching comments or strings", () => {
  const source = '/* url(/ignore.png) */ @import "/css/base.css"; .hero { background: url("/img/a b.png"); content: "url(/text.png)"; }';
  const result = rewriteCssUrls(source, value => value.startsWith("/") ? "/asset" + value : null);
  assert.match(result, /@import "\/asset\/css\/base\.css"/);
  assert.match(result, /url\("\/asset\/img\/a b\.png"\)/);
  assert.match(result, /\/\* url\(\/ignore\.png\) \*\//);
  assert.match(result, /content: "url\(\/text\.png\)"/);
});

test("JavaScript AST parser rewrites static, re-export and dynamic local imports", () => {
  const source = 'import x from "./x.js"; export { y } from "../y.js"; const z = import("/lazy.js"); // import "./untouched.js"';
  const result = rewriteJavaScriptImports(source, value => "/resolved" + value);
  assert.match(result, /from "\/resolved\.\/x\.js"/);
  assert.match(result, /from "\/resolved\.\.\/y\.js"/);
  assert.match(result, /import\("\/resolved\/lazy\.js"\)/);
  assert.match(result, /\/\/ import "\.\/untouched\.js"/);
});

test("JavaScript AST redirects do not rewrite strings or comments", () => {
  const source = 'const text = "location.href = fake"; // location.replace("/no")\nlocation.href = destination; window.location.replace(nextUrl);';
  const result = rewriteJavaScriptLocationRedirects(source);
  assert.match(result, /const text = "location\.href = fake"/);
  assert.match(result, /\/\/ location\.replace\("\/no"\)/);
  assert.match(result, /window\.__fairwasNavigate\(destination\);/);
  assert.match(result, /window\.__fairwasNavigate\(nextUrl\);/);
});

test("HTML5 parser repairs malformed markup and transforms inline CSS/JS", () => {
  const result = transformHtmlDocument('<!doctype html><title>Test</title><p style="background:url(/a.png)">hello<script>location.href = next;</script>', {
    rewriteCss: value => value.replace("/a.png", "/asset/a.png"),
    rewriteJavaScript: value => value.replace("location.href = next", "window.__fairwasNavigate(next)")
  });
  assert.match(result, /<html>/i);
  assert.match(result, /\/asset\/a\.png/);
  assert.match(result, /window\.__fairwasNavigate\(next\)/);
  assert.match(result, /<\/p>/i);
});

test("HTML5 parser rewrites resource attributes while preserving navigation links and script flags", () => {
  const result = transformHtmlDocument('<img src=/image.png srcset="/small.png 1x, /large.png 2x"><a href="/next">next</a><script src="/app.js" defer></script>', {
    rewriteResource: value => "/asset" + value,
    rewriteSrcset: value => value.replace("/small.png", "/asset/small.png").replace("/large.png", "/asset/large.png")
  });
  assert.match(result, /src="\/asset\/image\.png"/);
  assert.match(result, /srcset="\/asset\/small\.png 1x, \/asset\/large\.png 2x"/);
  assert.match(result, /<a href="\/next">next<\/a>/);
  assert.match(result, /<script src="\/asset\/app\.js" defer><\/script>/);
});
