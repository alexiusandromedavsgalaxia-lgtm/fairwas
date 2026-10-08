import test from "node:test";
import assert from "node:assert/strict";
import { resolveAddressInput } from "../src/protocols.js";

test("absolute slash routes resolve against the current HTTC host", () => {
  assert.equal(resolveAddressInput("/", "httc://site.fair/loqsea"), "httc://site.fair/");
  assert.equal(resolveAddressInput("/()", "httc://site.fair/loqsea"), "httc://site.fair/()");
  assert.equal(resolveAddressInput("/loqsea?x=1", "httc://site.fair/other"), "httc://site.fair/loqsea?x=1");
});

test("relative paths, query strings and fragments keep the current host", () => {
  assert.equal(resolveAddressInput("../loqsea", "httc://site.fair/a/b"), "httc://site.fair/loqsea");
  assert.equal(resolveAddressInput("?page=2", "httc://site.fair/loqsea"), "httc://site.fair/loqsea?page=2");
  assert.equal(resolveAddressInput("#section", "httc://site.fair/loqsea"), "httc://site.fair/loqsea#section");
});

test("full HTTC URLs and search input keep their existing behavior", () => {
  assert.equal(resolveAddressInput("httc://site.fair/()"), "httc://site.fair/()");
  assert.equal(resolveAddressInput("hello world"), "httc://search?q=hello%20world");
});
