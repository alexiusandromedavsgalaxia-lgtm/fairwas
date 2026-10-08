import * as parse5 from "parse5";
import postcss from "postcss";
import { parse as parseJavaScript } from "acorn";

function walkHtml(node, visit) {
  if (!node || typeof node !== "object") return;
  if (node.tagName) visit(node);
  for (const child of node.childNodes || []) walkHtml(child, visit);
  if (node.content) walkHtml(node.content, visit);
}
function visitJavaScript(node, visit) {
  if (!node || typeof node !== "object") return;
  if (typeof node.type === "string") visit(node);
  for (const [key, value] of Object.entries(node)) {
    if (["start", "end", "loc", "range"].includes(key)) continue;
    if (Array.isArray(value)) value.forEach(child => visitJavaScript(child, visit));
    else if (value && typeof value === "object") visitJavaScript(value, visit);
  }
}
function parseJs(source) {
  const text = String(source ?? "");
  try { return parseJavaScript(text, { ecmaVersion: "latest", sourceType: "module", allowHashBang: true }); }
  catch {
    try { return parseJavaScript(text, { ecmaVersion: "latest", sourceType: "script", allowHashBang: true, allowReturnOutsideFunction: true }); }
    catch { return null; }
  }
}
export function parseHtmlDocument(source) { return parse5.parse(String(source ?? "")); }
export function serializeHtmlDocument(document) { return parse5.serialize(document); }

export function rewriteCssUrls(source, rewrite) {
  const original = String(source ?? "");
  let root;
  try { root = postcss.parse(original, { from: undefined }); } catch { return original; }
  const rewriteValue = value => String(value).replace(/url\(\s*(["']?)(.*?)\1\s*\)/gi, (all, quote, raw) => {
    const next = typeof rewrite === "function" ? rewrite(raw.trim()) : null;
    return next ? "url(" + quote + next + quote + ")" : all;
  });
  root.walkDecls(decl => { decl.value = rewriteValue(decl.value); });
  root.walkAtRules("import", rule => {
    const match = rule.params.match(/^(\s*)(["'])(.*?)\2(.*)$/s);
    if (match) {
      const next = typeof rewrite === "function" ? rewrite(match[3].trim()) : null;
      if (next) rule.params = match[1] + match[2] + next + match[2] + match[4];
    } else rule.params = rewriteValue(rule.params);
  });
  return root.toResult({ map: false }).css;
}

export function rewriteJavaScriptImports(source, resolveImport) {
  const text = String(source ?? "");
  const ast = parseJs(text);
  if (!ast) return text;
  const edits = [];
  visitJavaScript(ast, node => {
    let literal = null;
    if (["ImportDeclaration", "ExportNamedDeclaration", "ExportAllDeclaration"].includes(node.type) && node.source?.type === "Literal") literal = node.source;
    if (node.type === "ImportExpression" && node.source?.type === "Literal") literal = node.source;
    if (!literal || typeof literal.value !== "string") return;
    const next = typeof resolveImport === "function" ? resolveImport(literal.value, node) : null;
    if (next && next !== literal.value) edits.push({ start: literal.start, end: literal.end, value: JSON.stringify(next) });
  });
  edits.sort((a, b) => b.start - a.start);
  let output = text;
  for (const edit of edits) output = output.slice(0, edit.start) + edit.value + output.slice(edit.end);
  return output;
}
function isLocation(node) {
  if (!node) return false;
  if (node.type === "Identifier" && node.name === "location") return true;
  return node.type === "MemberExpression" && !node.computed &&
    node.property?.type === "Identifier" && node.property.name === "location" &&
    node.object?.type === "Identifier" && node.object.name === "window";
}
export function rewriteJavaScriptLocationRedirects(source) {
  const text = String(source ?? "");
  const ast = parseJs(text);
  if (!ast) return text;
  const edits = [];
  visitJavaScript(ast, node => {
    if (node.type === "CallExpression" && node.callee?.type === "MemberExpression" && !node.callee.computed &&
        ["assign", "replace"].includes(node.callee.property?.name) && isLocation(node.callee.object) && node.arguments.length === 1) {
      const arg = node.arguments[0];
      edits.push({ start: node.start, end: node.end, value: "window.__fairwasNavigate(" + text.slice(arg.start, arg.end) + ")" });
    } else if (node.type === "AssignmentExpression" && node.operator === "=") {
      const left = node.left;
      const redirect = isLocation(left) || (left?.type === "MemberExpression" && !left.computed &&
        left.property?.type === "Identifier" && left.property.name === "href" && isLocation(left.object));
      if (redirect) edits.push({ start: node.start, end: node.end, value: "window.__fairwasNavigate(" + text.slice(node.right.start, node.right.end) + ")" });
    }
  });
  edits.sort((a, b) => a.start - b.start || b.end - a.end);
  const filtered = [];
  for (const edit of edits) {
    if (filtered.some(parent => edit.start >= parent.start && edit.end <= parent.end)) continue;
    filtered.push(edit);
  }
  filtered.sort((a, b) => b.start - a.start);
  let output = text;
  for (const edit of filtered) output = output.slice(0, edit.start) + edit.value + output.slice(edit.end);
  return output;
}
export function transformHtmlDocument(source, { rewriteCss, rewriteJavaScript } = {}) {
  const document = parseHtmlDocument(source);
  walkHtml(document, element => {
    const tag = String(element.tagName || "").toLowerCase();
    for (const attr of element.attrs || []) {
      if (attr.name.toLowerCase() === "style" && typeof rewriteCss === "function") attr.value = rewriteCss(attr.value);
    }
    if (tag !== "style" && tag !== "script") return;
    const type = (element.attrs || []).find(attr => attr.name.toLowerCase() === "type")?.value || "";
    if (tag === "script" && type && !/(?:javascript|ecmascript|x-javascript)/i.test(type) && type.toLowerCase() !== "module") return;
    for (const child of element.childNodes || []) {
      if (child.nodeName !== "#text" || typeof child.value !== "string") continue;
      if (tag === "style" && typeof rewriteCss === "function") child.value = rewriteCss(child.value);
      if (tag === "script" && typeof rewriteJavaScript === "function") child.value = rewriteJavaScript(child.value);
    }
  });
  return serializeHtmlDocument(document);
}
