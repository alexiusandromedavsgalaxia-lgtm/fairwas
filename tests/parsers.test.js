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
