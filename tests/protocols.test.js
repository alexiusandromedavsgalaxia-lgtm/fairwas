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


import { wwwCounterpart } from "../src/protocols.js";

test("domain correspondence toggles only the leading www and preserves the route", () => {
  assert.equal(wwwCounterpart("httc://roblox.com/games/123?x=1#top"), "httc://www.roblox.com/games/123?x=1#top");
  assert.equal(wwwCounterpart("httc://www.roblox.com/games/123?x=1#top"), "httc://roblox.com/games/123?x=1#top");
});

test("domain correspondence ignores internal hosts, IP addresses and non-HTTC URLs", () => {
  assert.equal(wwwCounterpart("httc://home"), null);
  assert.equal(wwwCounterpart("httc://createpage.fair"), null);
  assert.equal(wwwCounterpart("httc://127.0.0.1"), null);
  assert.equal(wwwCounterpart("https://roblox.com"), null);
});
