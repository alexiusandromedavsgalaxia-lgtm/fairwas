import test from "node:test";
import assert from "node:assert/strict";
import { load } from "../src/storage.js";

test("load removes malformed saved tabs, history and bookmarks", () => {
  const previous = globalThis.localStorage;
  const stored = JSON.stringify({
    tabs: [null, { url: 42 }, { url: " httc://good.fair ", back: [null, "httc://old"] }],
    history: [null, { url: 12 }, { url: "httc://history.fair" }],
    bookmarks: [{ url: "" }, { url: "httc://saved.fair" }],
    settings: { home: 42, dark: "false", compactChrome: 1 }
  });
  globalThis.localStorage = { getItem: () => stored };
  try {
    const state = load();
    assert.deepEqual(state.tabs.map(tab => tab.url), ["httc://good.fair"]);
    assert.deepEqual(state.tabs[0].back, ["httc://old"]);
    assert.deepEqual(state.history.map(item => item.url), ["httc://history.fair"]);
    assert.deepEqual(state.bookmarks.map(item => item.url), ["httc://saved.fair"]);
    assert.equal(state.settings.home, "httc://home");
    assert.equal(state.settings.dark, true);
    assert.equal(state.settings.compactChrome, false);
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  }
});
