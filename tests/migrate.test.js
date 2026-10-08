import test from "node:test";
import assert from "node:assert/strict";
import { cleanPath, unsafeHost, refs, localize } from "../functions/api/migrate.js";

test("cleanPath normalizes relative paths and defaults root to index.html", () => {
  assert.equal(cleanPath(""), "/index.html");
  assert.equal(cleanPath("/"), "/index.html");
  assert.equal(cleanPath("assets\\logo.svg?x=1"), "/assets/logo.svg");
});

test("unsafeHost blocks loopback, private and special-use addresses", () => {
  for (const host of ["localhost", "printer.local", "127.0.0.1", "10.0.0.2", "192.168.1.5", "169.254.1.2", "::1", "[::1]", "fd12::1", "::ffff:127.0.0.1"]) {
    assert.equal(unsafeHost(host), true, host);
  }
  for (const host of ["example.com", "8.8.8.8", "2606:4700:4700::1111"]) {
    assert.equal(unsafeHost(host), false, host);
  }
});

test("refs discovers HTML, CSS and JavaScript module assets", () => {
  const html = '<link rel="stylesheet" href="/styles.css"><script src="/app.js"></script><img src="/image.png">';
  const found = refs(html, "https://example.test/index.html");
  assert.deepEqual(new Set(found), new Set([
    "https://example.test/styles.css",
    "https://example.test/app.js",
    "https://example.test/image.png"
  ]));
  assert.deepEqual(refs('import "./module.js";', "https://example.test/app.js"), ["https://example.test/module.js"]);
});

test("localize rewrites same-origin asset references and keeps query/hash", () => {
  const map = new Map([
    ["/styles.css", "/styles.css"],
    ["/image.png", "/image.png"]
  ]);
  const html = '<link href="/styles.css"><img src="/image.png?v=2#hero">';
  const result = localize(html, new URL("https://example.test/index.html"), map);
  assert.match(result, /href="\/styles\.css"/);
  assert.match(result, /src="\/image\.png\?v=2#hero"/);
});
