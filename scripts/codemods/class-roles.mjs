// Tailwind class strings → the roles of @krizaka/tailwind (study §2.12, "Codemods"). Pure, no dependency: the
// jscodeshift transform (tokens.mjs) applies it to every string of a component, the unit test pins the table.
//
// Rules, per class string:
// - a neutral colour (white, black, zinc, slate…) becomes a role ONLY when the string also carries its `light:`
//   counterpart (same property, same other variants): that pair proves the colour follows the theme. The `light:`
//   token and a redundant `dark:` twin are dropped. A neutral colour alone (white text on a video) is left as it is,
//   except a mid-grey text (400…600), which reads on both themes: text-fg-secondary (400) or text-fg-muted.
// - an accent colour (violet, purple, fuchsia, pink → accent; in a gradient, fuchsia, pink and rose → accent-2) and a
//   status colour (emerald, green → success; rose, red → danger; amber, yellow → warning) read on both themes: it
//   always becomes its role, and its `light:` / `dark:` counterparts are dropped. Opacity (`/20`) and `!` are kept.
// - a black veil with no `light:` counterpart sits on a media: `bg-black/50…65` → `bg-scrim`, `/70…85` →
//   `bg-scrim-strong`, and the plain `text-white` beside it → `text-fg-on-media`.

const NEUTRAL = new Set(["white", "black", "zinc", "slate", "gray", "neutral", "stone"]);
const ACCENT = { violet: "accent", purple: "accent", fuchsia: "accent", pink: "accent" };
const GRADIENT_2 = new Set(["fuchsia", "pink", "rose", "red"]);
const STATUS = { emerald: "success", green: "success", rose: "danger", red: "danger", amber: "warning", yellow: "warning" };
const FAMILIES = [...NEUTRAL, ...Object.keys(ACCENT), ...Object.keys(STATUS), "sky", "blue", "cyan", "indigo"];

const PROPERTIES = ["bg", "text", "border-t", "border-b", "border-l", "border-r", "border-x", "border-y", "border", "divide", "from", "via", "to", "ring-offset", "ring", "shadow", "fill", "stroke", "outline", "decoration", "caret", "accent"];
const COLOR = new RegExp(`^(-?)(${PROPERTIES.join("|")})-(${FAMILIES.join("|")})(?:-(\\d{2,3}))?(?:/(\\d{1,3}|\\[[\\d.]+\\]))?$`);

/** "hover:light:text-slate-900!" → { variants: ["hover", "light"], util: "text-slate-900", important: true } */
function parseToken(token) {
  let important = false;
  let rest = token;
  if (rest.endsWith("!")) {
    important = true;
    rest = rest.slice(0, -1);
  } else if (rest.startsWith("!")) {
    important = true;
    rest = rest.slice(1);
  }
  // Split on ":" outside brackets.
  const parts = [];
  let depth = 0;
  let current = "";
  for (const ch of rest) {
    if (ch === "[") depth++;
    if (ch === "]") depth--;
    if (ch === ":" && depth === 0) {
      parts.push(current);
      current = "";
    } else current += ch;
  }
  parts.push(current);
  const util = parts.pop();
  const match = COLOR.exec(util);
  return {
    token,
    variants: parts,
    util,
    important,
    color: match ? { neg: match[1], property: match[2], family: match[3], shade: match[4] ? Number(match[4]) : null, opacity: match[5] ?? null } : null,
  };
}

const variantKey = (variants) => variants.filter((v) => v !== "light" && v !== "dark").sort().join(":");

/** The role of a neutral colour that follows the theme, or null. */
function neutralRole({ property, family, shade, opacity }) {
  const alpha = opacity === null ? null : opacity.startsWith("[") ? Number(opacity.slice(1, -1)) * 100 : Number(opacity);
  if (property === "text" || property === "fill" || property === "stroke" || property === "caret" || property === "decoration") {
    if (family === "white" || (shade !== null && shade <= 200)) return { role: "fg", opacity: null };
    if (shade !== null && shade <= 400) return { role: "fg-secondary", opacity: null };
    if (shade !== null) return { role: "fg-muted", opacity: null };
    return null;
  }
  if (property === "bg") {
    if (family === "white") return alpha !== null && alpha >= 10 ? { role: "surface-3", opacity: null } : { role: "surface-2", opacity: null };
    if (family === "black") return null;
    if (shade === null) return null;
    if (shade >= 950) return { role: "surface-1", opacity };
    if (shade >= 900) return { role: "surface-2", opacity };
    if (shade >= 700) return { role: "surface-3", opacity };
    return null;
  }
  if (property.startsWith("border") || property === "divide" || property === "ring" || property === "outline") {
    const prefix = property === "ring" || property === "outline" ? property : property;
    if (family === "white" || family === "black") {
      if (alpha === null) return null;
      if (alpha <= 6) return { role: "border-subtle", opacity: null, prefix };
      if (alpha <= 12) return { role: "border-default", opacity: null, prefix };
      return { role: "border-strong", opacity: null, prefix };
    }
    if (shade === null) return null;
    if (shade >= 900) return { role: "border-subtle", opacity: null, prefix };
    if (shade >= 800) return { role: "border-default", opacity: null, prefix };
    if (shade >= 600) return { role: "border-strong", opacity: null, prefix };
    return null;
  }
  return null;
}

/** The role of an accent or status colour (any theme), or null. */
function brandRole({ property, family, shade, opacity }, variants) {
  const gradient = property === "from" || property === "via" || property === "to";
  let role = gradient && GRADIENT_2.has(family) ? "accent-2" : ACCENT[family] ?? STATUS[family] ?? null;
  if (!role) return null;
  if (role === "accent" && property === "ring" && opacity === null) return { role: "ring", opacity: null };
  if (role === "accent" && property === "bg" && opacity === null && variants.includes("hover") && shade !== null && (shade === 500 || shade === 700))
    return { role: "accent-hover", opacity: null };
  if (role === "accent" && property === "bg" && opacity === null && shade !== null && shade <= 200) return { role: "accent-soft", opacity: null };
  // A near-black tint (violet-950/40, red-950/30) is a faint wash of the colour: a third of the opacity of the role.
  if ((property === "bg" || gradient) && shade !== null && shade >= 900) {
    const alpha = opacity === null ? 45 : opacity.startsWith("[") ? Number(opacity.slice(1, -1)) * 100 : Number(opacity);
    return { role, opacity: String(Math.max(5, Math.round(alpha / 15) * 5)) };
  }
  return { role, opacity };
}

function render(parsed, role) {
  const property = parsed.color.property;
  // Border-family utilities read the border roles as `border-border-default`, `divide-border-subtle`.
  const util = `${parsed.color.neg}${property}-${role.role}${role.opacity ? `/${role.opacity}` : ""}`;
  const variants = parsed.variants.filter((v) => v !== "light" && v !== "dark");
  return `${[...variants, util].join(":")}${parsed.important ? "!" : ""}`;
}

/** Rewrites one class string. Whitespace at both ends is kept (template literal pieces sit next to expressions). */
export function rewriteClasses(input) {
  const lead = input.match(/^\s*/)[0];
  const trail = input.slice(lead.length).match(/\s*$/)[0];
  const body = input.slice(lead.length, input.length - trail.length);
  if (!body) return input;
  const tokens = body.split(/\s+/).map(parseToken);
  if (!tokens.some((t) => t.color)) return input;

  const out = tokens.map((t) => t.token);
  const removed = new Set();
  const counterpart = (i, t) =>
    tokens.findIndex(
      (o, j) =>
        j !== i &&
        !removed.has(j) &&
        o.color &&
        o.color.property === t.color.property &&
        o.variants.includes("light") &&
        !o.variants.includes("dark") &&
        variantKey(o.variants) === variantKey(t.variants),
    );
  const darkTwin = (i, t) =>
    tokens.findIndex(
      (o, j) =>
        j !== i &&
        !removed.has(j) &&
        o.color &&
        o.color.property === t.color.property &&
        o.variants.includes("dark") &&
        !o.variants.includes("light") &&
        variantKey(o.variants) === variantKey(t.variants),
    );

  let veil = false;
  tokens.forEach((t, i) => {
    if (!t.color || removed.has(i) || t.variants.includes("light") || t.variants.includes("dark")) return;
    if (t.color.property === "bg" && t.color.family === "black" && t.variants.length === 0 && counterpart(i, t) < 0) {
      const alpha = Number(t.color.opacity ?? 100);
      if (alpha >= 50 && alpha <= 85) {
        out[i] = render(t, { role: alpha <= 65 ? "scrim" : "scrim-strong", opacity: null });
        veil = true;
      }
      return;
    }
    if (NEUTRAL.has(t.color.family)) {
      const light = counterpart(i, t);
      if (light < 0) {
        // A mid grey (400…600) reads on both themes: it is the secondary or muted text role, pair or not.
        const { property, family, shade } = t.color;
        if (property === "text" && family !== "white" && family !== "black" && shade !== null && shade >= 400 && shade <= 600) {
          out[i] = render(t, { role: shade === 400 ? "fg-secondary" : "fg-muted", opacity: null });
        }
        return;
      }
      const role = neutralRole(t.color);
      if (!role) return;
      out[i] = render(t, role);
      removed.add(light);
      const twin = darkTwin(i, t);
      if (twin >= 0) removed.add(twin);
      return;
    }
    const role = brandRole(t.color, t.variants);
    if (!role) return;
    out[i] = render(t, role);
    const light = counterpart(i, t);
    if (light >= 0 && !NEUTRAL.has(tokens[light].color.family)) removed.add(light);
    else if (light >= 0 && (t.color.property === "text" || t.color.property.startsWith("border"))) removed.add(light);
    const twin = darkTwin(i, t);
    if (twin >= 0 && !NEUTRAL.has(tokens[twin].color.family)) removed.add(twin);
  });

  if (veil) {
    tokens.forEach((t, i) => {
      if (t.token === "text-white" && counterpart(i, t) < 0) out[i] = "text-fg-on-media";
    });
  }
  const result = out.filter((_, i) => !removed.has(i));
  // Collapse duplicates the rewrite produced (two tokens becoming `text-fg`).
  const seen = new Set();
  const unique = result.filter((tok) => (seen.has(tok) ? false : (seen.add(tok), true)));
  return lead + unique.join(" ") + trail;
}
