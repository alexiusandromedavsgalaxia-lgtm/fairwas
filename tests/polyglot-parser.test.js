import test from "node:test";
import assert from "node:assert/strict";
import { inferSourceLanguage, parseSource, supportedParserLanguages } from "../src/runtime/polyglot-parser.js";

test("every advertised language has a working parser", async () => {
  const languages = supportedParserLanguages();
  assert.ok(languages.length >= 30, "the grammar registry unexpectedly shrank");
  const failures = [];
  for (const language of languages) {
    const result = await parseSource("", { language });
    if (result.status === "grammar-unavailable") failures.push({ language, message: result.message });
  }
  assert.deepEqual(failures, [], "Some advertised grammars could not be loaded");
});

test("custom extensions are detected from source syntax and parsed into a real tree", async () => {
  const source = "def greet(name):\n    return f\"Hello {name}\"\n";
  assert.equal(inferSourceLanguage("/src/main.faircode", source), "python");
  const result = await parseSource(source, { path: "/src/main.faircode" });
  assert.equal(result.status, "valid");
  assert.equal(result.language, "python");
  assert.match(result.tree, /function_definition/);
  assert.ok(result.nodeCount > 3);
});

test("JavaScript, Rust and Zig are parsed into syntax trees", async () => {
  const examples = [
    ["javascript", "const answer = (value) => value + 42;", /lexical_declaration/],
    ["rust", "fn main() { let answer: i32 = 42; }", /function_item/],
    ["zig", "pub fn main() void {}", /function_declaration/]
  ];
  for (const [language, source, expectedNode] of examples) {
    const result = await parseSource(source, { language });
    assert.equal(result.status, "valid", language + ": " + (result.message || JSON.stringify(result.problems)));
    assert.match(result.tree, expectedNode, language + " did not produce the expected syntax tree");
  }
});

test("syntax errors produce source positions instead of parser Expected-token messages", async () => {
  const result = await parseSource("def broken(:\n    return 1\n", { path: "/broken.py" });
  assert.equal(result.status, "syntax-errors");
  assert.ok(result.problems.length > 0);
  assert.ok(result.problems[0].line >= 1);
  assert.doesNotMatch(JSON.stringify(result.problems), /expected token/i);
});

test("invented languages use the universal structural parser", async () => {
  const source = `MAKE WINDOW WITH BLUE SKY

set⟡value := 42 |> render["violet"]
invoke<thing>(x %% y)`;
  const result = await parseSource(source, { path: "/page.xyz" });
  assert.equal(result.status, "valid");
  assert.equal(result.language, "universal");
  assert.match(result.tree, /"type": "Group"/);
  assert.match(result.tree, /"value": "⟡"/);
  assert.match(result.tree, /"value": "%%"/);
  assert.ok(result.nodeCount > 12);
});
test("universal parser reports broken grouping without rejecting unknown operators", async () => {
  const result = await parseSource("DO strange!! [a %% b", { path: "/made-up.syntax" });
  assert.equal(result.language, "universal");
  assert.equal(result.status, "syntax-errors");
  assert.equal(result.problems[0].type, "unclosed-group");
  assert.doesNotMatch(JSON.stringify(result.problems), /Expected token/i);
});

test("YAML uses a real document parser and reports malformed input", async () => {
  const valid = await parseSource("site:\n  title: Fairwas\n  enabled: true\n", { path: "/config.yaml" });
  assert.equal(valid.status, "valid");
  assert.match(valid.tree, /YAMLMap/);
  assert.ok(valid.nodeCount > 1);
  const invalid = await parseSource("site: [one, two\n", { path: "/config.yaml" });
  assert.equal(invalid.status, "syntax-errors");
  assert.ok(invalid.problems.length > 0);
  assert.ok(invalid.problems[0].line >= 1);
});
