// jscodeshift transform — Orochia web onto the Krizaka platform (study §2.12, "Codemods"). Run once per file set:
//
//   npx jscodeshift@17 --parser=tsx --extensions=tsx -t scripts/codemods/tokens.mjs apps/web/app apps/web/components
//
// 1. Every class string (string literals, template literal pieces) → the roles of @krizaka/tailwind (class-roles.mjs).
// 2. `buttonClass({ variant, size, round, className })` → `buttonVariants({ variant, size, shape, className })`, the
//    gradient `primary` → `orochiaButton({ variant: "sensual", … })`; `round` (default true) → `shape: "pill" | "rounded"`.
// 3. `cx(` → `cn(`.
// 4. `<Button>` of the app's door: `round={false}` → `shape="rounded"` (pill is the door's default), `icon={…}` → first
//    child (@krizaka/ui has no icon prop), `variant="primary"` (the 2.x gradient) → `variant="sensual"`.
// The rest of the migration (hand-rolled buttons, fields, pills, avatars) is done by hand.
import { rewriteClasses } from "./class-roles.mjs";

const DOOR = "@/components/ui";

export const parser = "tsx";

export default function transform(file, api) {
  const j = api.jscodeshift;
  const root = j(file.source);
  let changed = false;

  // 1. Class strings.
  root.find(j.StringLiteral).forEach((path) => {
    if (path.parent.node.type === "ImportDeclaration" || path.parent.node.type === "ExportNamedDeclaration") return;
    const next = rewriteClasses(path.node.value);
    if (next !== path.node.value) {
      path.node.value = next;
      if (path.node.extra) path.node.extra = { ...path.node.extra, raw: JSON.stringify(next), rawValue: next };
      changed = true;
    }
  });
  root.find(j.TemplateElement).forEach((path) => {
    const next = rewriteClasses(path.node.value.raw);
    if (next !== path.node.value.raw) {
      path.node.value = { raw: next, cooked: next };
      changed = true;
    }
  });

  // Which door names this file imports.
  const doorImports = root.find(j.ImportDeclaration, { source: { value: DOOR } });
  const imported = new Set();
  doorImports.forEach((path) => path.node.specifiers.forEach((s) => s.imported && imported.add(s.imported.name)));
  const need = new Set();

  // 2. buttonClass(…) → buttonVariants(…) / orochiaButton(…).
  if (imported.has("buttonClass")) {
    root.find(j.CallExpression, { callee: { type: "Identifier", name: "buttonClass" } }).forEach((path) => {
      const [arg] = path.node.arguments;
      const props = arg && arg.type === "ObjectExpression" ? arg.properties : [];
      const get = (name) => props.find((p) => (p.type === "ObjectProperty" || p.type === "Property") && p.key.name === name);
      const variant = get("variant");
      const round = get("round");
      const sensual = variant && variant.value.type === "StringLiteral" && variant.value.value === "primary";
      if (sensual) variant.value = j.stringLiteral("sensual");
      const shape = round && round.value.type === "BooleanLiteral" && round.value.value === false ? "rounded" : "pill";
      const rest = props.filter((p) => p !== round);
      const shapeProp = j.objectProperty(j.identifier("shape"), j.stringLiteral(shape));
      const classNameAt = rest.findIndex((p) => p.key && p.key.name === "className");
      if (classNameAt >= 0) rest.splice(classNameAt, 0, shapeProp);
      else rest.push(shapeProp);
      const callee = sensual ? "orochiaButton" : "buttonVariants";
      need.add(callee);
      path.node.callee = j.identifier(callee);
      path.node.arguments = [j.objectExpression(rest)];
      changed = true;
    });
  }

  // 3. cx( → cn(.
  if (imported.has("cx")) {
    root.find(j.CallExpression, { callee: { type: "Identifier", name: "cx" } }).forEach((path) => {
      path.node.callee = j.identifier("cn");
      need.add("cn");
      changed = true;
    });
  }

  // 4. <Button> of the door.
  if (imported.has("Button")) {
    root.findJSXElements("Button").forEach((path) => {
      const opening = path.node.openingElement;
      let icon = null;
      opening.attributes = opening.attributes.flatMap((attr) => {
        if (attr.type !== "JSXAttribute") return [attr];
        const name = attr.name.name;
        if (name === "round") {
          changed = true;
          const off =
            attr.value &&
            attr.value.type === "JSXExpressionContainer" &&
            attr.value.expression.type === "BooleanLiteral" &&
            attr.value.expression.value === false;
          return off ? [j.jsxAttribute(j.jsxIdentifier("shape"), j.stringLiteral("rounded"))] : [];
        }
        if (name === "icon" && attr.value && attr.value.type === "JSXExpressionContainer") {
          icon = attr.value.expression;
          changed = true;
          return [];
        }
        if (name === "variant" && attr.value && attr.value.type === "StringLiteral" && attr.value.value === "primary") {
          changed = true;
          return [j.jsxAttribute(j.jsxIdentifier("variant"), j.stringLiteral("sensual"))];
        }
        return [attr];
      });
      if (icon) {
        const child = icon.type === "JSXElement" ? icon : j.jsxExpressionContainer(icon);
        path.node.children = [child, ...(path.node.children ?? [])];
      }
    });
  }

  // Imports from the door: drop what is no longer used, add what the rewrite needs.
  if (need.size > 0) {
    doorImports.forEach((path) => {
      const names = new Set(path.node.specifiers.map((s) => s.imported && s.imported.name));
      path.node.specifiers = path.node.specifiers.filter((s) => {
        const name = s.imported && s.imported.name;
        if (name !== "buttonClass" && name !== "cx") return true;
        return root.find(j.Identifier, { name }).filter((p) => p.parent.node.type !== "ImportSpecifier").size() > 0;
      });
      for (const name of need) if (!names.has(name)) path.node.specifiers.push(j.importSpecifier(j.identifier(name)));
    });
  }

  return changed ? root.toSource({ quote: "double" }) : file.source;
}
