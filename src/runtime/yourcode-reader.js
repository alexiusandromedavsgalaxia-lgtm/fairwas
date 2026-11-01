/**
 * YourCode's language-neutral reader.
 * It never assumes a language grammar and never modifies source text.
 * Delimiters are hints for structural grouping, not syntax validation.
 */
const OPEN = new Map([["(", ")"], ["[", "]"], ["{", "}"], ["<", ">"]]);
const CLOSE = new Set([...OPEN.values()]);
const isSpace = ch => /\s/u.test(ch);
const isWord = ch => /[\p{L}\p{N}_$]/u.test(ch);
export function inspectAnySource(input) {
  const source = String(input ?? "");
  const units = [];
  const stack = [];
  const roots = [];
  let i = 0;
  while (i < source.length) {
    const start = i;
    const ch = source[i];
    let kind;
    if (isSpace(ch)) {
      i++;
      while (i < source.length && isSpace(source[i])) i++;
      kind = "whitespace";
    } else if (ch === "\"" || ch === "'" || ch === "`") {
      const quote = ch; i++;
      while (i < source.length) {
        if (source[i] === "\\") { i += Math.min(2, source.length - i); continue; }
        if (source[i++] === quote) break;
      }
      kind = "quoted-span";
    } else if (isWord(ch)) {
      i++;
      while (i < source.length && isWord(source[i])) i++;
      kind = "word-like";
    } else if (OPEN.has(ch) || CLOSE.has(ch)) {
      i++; kind = OPEN.has(ch) ? "opening-delimiter" : "closing-delimiter";
    } else {
      i++;
      while (i < source.length && !isSpace(source[i]) && !isWord(source[i]) && !OPEN.has(source[i]) && !CLOSE.has(source[i]) && !["\"", "'", "`"].includes(source[i])) i++;
      kind = "symbol-span";
    }
    const unit = { kind, start, end: i, raw: source.slice(start, i), children: [] };
    const parent = stack[stack.length - 1];
    (parent ? parent.children : roots).push(unit);
    units.push(unit);
    if (kind === "opening-delimiter") stack.push(unit);
    else if (kind === "closing-delimiter") {
      const expected = stack.length ? OPEN.get(stack[stack.length - 1].raw) : null;
      unit.match = expected === unit.raw;
      if (unit.match) { unit.pairsWith = stack.pop().start; }
    }
  }
  const unmatchedOpen = stack.map(item => ({ offset: item.start, delimiter: item.raw }));
  const unmatchedClose = units.filter(item => item.kind === "closing-delimiter" && !item.match).map(item => ({ offset: item.start, delimiter: item.raw }));
  const lines = source.length ? source.split(/\r\n|\r|\n/).length : 0;
  return {
    kind: "language-neutral-structure",
    source,
    sourceLength: source.length,
    lineCount: lines,
    unitCount: units.length,
    units,
    tree: roots,
    unmatchedOpen,
    unmatchedClose,
    lossless: units.map(item => item.raw).join("") === source
  };
}
