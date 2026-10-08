#!/usr/bin/env node
/**
 * Every user-facing string lives in apps/web/messages/en.json (AGENTS.md §6). This check parses the web app's pages and
 * components (TypeScript compiler API) and fails on text written in the code: JSX text, user-facing attributes
 * (placeholder, title, aria-label, alt, label) given as literals, messages handed to state setters (`setError("…")`),
 * words in data (`{ label: "…" }`, `{ hint: "…" }`) and browser dialogs (alert, confirm, prompt).
 *
 *   node scripts/check-i18n.mjs            → lists offenders, exit 1 if any
 *   node scripts/check-i18n.mjs --summary  → counts per file
 *
 * Brand names are allowed. A deliberate exception carries `i18n-ignore` in a comment on the same line or the line above.
 */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "apps", "web");
const DIRS = ["app", "components"];
const SKIP = [/\/app\/api\//, /\.test\.tsx?$/, /\/opengraph-image\.tsx$/];
const ATTRS = new Set(["placeholder", "title", "aria-label", "alt", "label"]);
const SETTER = /^set\w*(Error|Message|Notice|Hint|Status|Feedback|Toast)$/;
const PROPS = new Set(["label", "hint", "title", "placeholder", "description", "message", "text", "caption"]);
const BRANDS = new Set(["Orochia", "OROCHIA", "Krizaka", "KRIZAKA", "Bunny", "PayPal", "USDT", "BTC", "IBAN", "BIC"]);
const words = (text) => (text.match(/[A-Za-zÀ-ÿ]{3,}/g) ?? []).filter((w) => !BRANDS.has(w));

function* files(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) yield* files(full);
    else if (/\.tsx$/.test(name) && !SKIP.some((re) => re.test(full))) yield full;
  }
}

/** The string literals an expression can display: itself, or the branches of conditionals and logical operators. */
function shownStrings(expr) {
  if (ts.isParenthesizedExpression(expr)) return shownStrings(expr.expression);
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) return words(expr.text).length ? [expr] : [];
  if (ts.isTemplateExpression(expr)) {
    const parts = [expr.head, ...expr.templateSpans.map((s) => s.literal)];
    return words(parts.map((p) => p.text).join(" ")).length ? [{ text: parts.map((p) => p.text).join("…"), getStart: () => expr.getStart() }] : [];
  }
  if (ts.isConditionalExpression(expr)) return [...shownStrings(expr.whenTrue), ...shownStrings(expr.whenFalse)];
  if (ts.isBinaryExpression(expr) && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(expr.operatorToken.kind)) {
    return [...shownStrings(expr.right), ...(expr.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ? [] : shownStrings(expr.left))];
  }
  return [];
}

/** Next.js `metadata` / `generateMetadata` objects are read by crawlers, not shown in the UI: they are checked by SEO, not here. */
const isMetadata = (node) => {
  for (let n = node.parent; n; n = n.parent) {
    if (ts.isVariableDeclaration(n) && n.name.getText() === "metadata") return true;
    if (ts.isFunctionDeclaration(n) && n.name?.getText() === "generateMetadata") return true;
  }
  return false;
};

const offenders = [];
for (const dir of DIRS) {
  for (const file of files(path.join(ROOT, dir))) {
    const source = fs.readFileSync(file, "utf8");
    const lines = source.split("\n");
    const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const report = (node, kind, text) => {
      const line = sf.getLineAndCharacterOfPosition(node.getStart()).line;
      if (/i18n-ignore/.test(lines[line] ?? "") || /i18n-ignore/.test(lines[line - 1] ?? "")) return;
      offenders.push({ file: path.relative(ROOT, file), line: line + 1, kind, text: text.replace(/\s+/g, " ").trim().slice(0, 80) });
    };
    const visit = (node) => {
      if (ts.isJsxText(node) && words(node.text).length) report(node, "text", node.text);
      else if (ts.isJsxAttribute(node) && ATTRS.has(node.name.getText()) && node.initializer && ts.isStringLiteral(node.initializer) && words(node.initializer.text).length) {
        report(node, `attr ${node.name.getText()}`, node.initializer.text);
      } else if (ts.isJsxExpression(node) && node.expression && (!ts.isJsxAttribute(node.parent) || ATTRS.has(node.parent.name.getText()))) {
        // A string shown as is, or as a branch of `cond ? "a" : "b"`, `x && "a"`, `x ?? "a"`, or a template's text.
        for (const lit of shownStrings(node.expression)) report(lit, "text", lit.text);
      } else if (ts.isCallExpression(node)) {
        const callee = node.expression.getText();
        if (/^(window\.)?(alert|confirm|prompt)$/.test(callee)) report(node, "dialog", callee);
        else if (SETTER.test(callee)) for (const arg of node.arguments) for (const lit of shownStrings(arg)) report(lit, `set ${callee}`, lit.text);
      } else if (ts.isPropertyAssignment(node) && PROPS.has(node.name.getText()) && !isMetadata(node)) {
        for (const lit of shownStrings(node.initializer)) report(lit, `prop ${node.name.getText()}`, lit.text);
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
}

if (process.argv.includes("--summary")) {
  const byFile = new Map();
  for (const o of offenders) byFile.set(o.file, (byFile.get(o.file) ?? 0) + 1);
  for (const [f, n] of [...byFile].sort((a, b) => b[1] - a[1])) console.log(String(n).padStart(4), f);
}
if (offenders.length) {
  if (!process.argv.includes("--summary")) for (const o of offenders) console.log(`${o.file}:${o.line}  [${o.kind}]  ${o.text}`);
  console.error(`\n✗ ${offenders.length} hard-coded user-facing string(s): move them to apps/web/messages/en.json (AGENTS.md §6).`);
  process.exit(1);
}
console.log("✓ no hard-coded user-facing string in pages and components.");
