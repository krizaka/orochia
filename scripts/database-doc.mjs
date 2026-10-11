/**
 * docs/DATABASE.md — the database reference, built from the Drizzle schema objects themselves
 * (packages/db/scripts/schema-json.ts), so it cannot drift from the code.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const code = (s) => "`" + s + "`";
const cell = (s) => String(s).replace(/\|/g, "\\|");

/** The schema as data (tables, columns, foreign keys, enums), read from the Drizzle objects. */
export function readSchema(root) {
  return JSON.parse(
    execFileSync(path.join(root, "node_modules/.bin/tsx"), [path.join(root, "packages/db/scripts/schema-json.ts")], {
      cwd: path.join(root, "packages/db"),
      encoding: "utf8",
    }),
  );
}

export function buildDatabaseMarkdown(root, schema = readSchema(root)) {
  const { tables, enums } = schema;
  const migrations = fs.readdirSync(path.join(root, "packages/db/drizzle")).filter((f) => f.endsWith(".sql")).sort();

  // Relationships as a table (one row per table that has any): what it points to, what points to it.
  const refs = (t) => t.foreignKeys.map((fk) => `${code(fk.table)} (${fk.columns.map(code).join(", ")})`);
  const referencedBy = (name) =>
    [...new Set(tables.filter((o) => o.foreignKeys.some((fk) => fk.table === name)).map((o) => code(o.name)))];
  const relations = tables
    .filter((t) => t.foreignKeys.length || referencedBy(t.name).length)
    .map((t) => `| ${code(t.name)} | ${refs(t).join(" · ") || "—"} | ${referencedBy(t.name).join(" · ") || "—"} |`);

  const tableSection = (t) => {
    const rows = t.columns.map((col) => {
      const fk = t.foreignKeys.find((f) => f.columns.includes(col.name));
      const notes = [
        col.primary ? "primary key" : "",
        col.unique ? "unique" : "",
        fk ? `→ ${code(`${fk.table}.${fk.foreignColumns[0]}`)} (on delete ${fk.onDelete})` : "",
      ]
        .filter(Boolean)
        .join(" · ");
      const def = col.default === null ? "" : code(cell(col.default));
      return `| ${code(col.name)} | ${cell(col.type)} | ${col.notNull ? "no" : "yes"} | ${def} | ${notes} |`;
    });
    const indexes = t.indexes.length
      ? `\n**Indexes:** ${t.indexes
          .map((i) => `${code(i.name)} (${i.unique ? "unique, " : ""}${i.columns.join(", ")}${i.where ? ", partial" : ""})`)
          .join(" · ")}\n`
      : "";
    return [`### ${code(t.name)}`, "", "| Column | Type | Null | Default | Notes |", "| :--- | :--- | :--- | :--- | :--- |", ...rows, indexes].join("\n");
  };

  return [
    "---",
    "title: Database Reference",
    "description: Every table, column, index, foreign key and enum of the Orochia PostgreSQL schema — generated from the Drizzle schema.",
    "---",
    "",
    "# Database Reference",
    "",
    `> Generated from ${code("packages/db/src/schema")} by ${code("scripts/generate-docs.mjs")} — do not hand-edit.`,
    `> To change the schema: edit it, ${code("npm run db:generate")}, review the SQL, ${code("npm run db:migrate")} — see the Development guide.`,
    "",
    `PostgreSQL 16 · ${tables.length} tables · ${enums.length} enums · ${migrations.length} migrations (${code("packages/db/drizzle")}).`,
    "",
    "## Relationships",
    "",
    "Every foreign key, read from the schema: what each table points to (through which columns) and which tables point to it.",
    "",
    "| Table | References (columns) | Referenced by |",
    "| :--- | :--- | :--- |",
    ...relations,
    "",
    "## Tables",
    "",
    ...tables.map(tableSection),
    "## Enums",
    "",
    "| Enum | Values |",
    "| :--- | :--- |",
    ...enums.map((e) => `| ${code(e.name)} | ${e.values.map(code).join(", ")} |`),
    "",
    "## Migrations",
    "",
    ...migrations.map((m) => `- ${code(m)}`),
    "",
  ].join("\n");
}
