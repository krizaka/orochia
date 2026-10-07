/**
 * Prints the Drizzle schema as JSON (tables, columns, indexes, foreign keys, enums) for
 * scripts/generate-docs.mjs, which turns it into docs/DATABASE.md. Reading the schema objects
 * themselves keeps the database documentation exact: it cannot drift from the code.
 */
import { getTableConfig, PgTable, PgEnum } from "drizzle-orm/pg-core";
import { is, SQL } from "drizzle-orm";
import * as schema from "../src/schema";

const tables = [];
const enums: { name: string; values: string[] }[] = [];

for (const value of Object.values(schema)) {
  if (is(value, PgTable)) {
    const t = getTableConfig(value);
    tables.push({
      name: t.name,
      columns: t.columns.map((col) => ({
        name: col.name,
        type: col.getSQLType(),
        notNull: col.notNull,
        primary: col.primary,
        unique: col.isUnique,
        default: !col.hasDefault
          ? null
          : is(col.default, SQL)
            ? col.default.queryChunks.map((ch) => ((ch as { value?: string[] }).value ?? []).join("")).join("")
            : col.defaultFn
              ? "generated"
              : JSON.stringify(col.default),
      })),
      foreignKeys: t.foreignKeys.map((fk) => {
        const ref = fk.reference();
        return {
          columns: ref.columns.map((c) => c.name),
          table: getTableConfig(ref.foreignTable).name,
          foreignColumns: ref.foreignColumns.map((c) => c.name),
          onDelete: fk.onDelete ?? "no action",
        };
      }),
      indexes: t.indexes.map((i) => ({
        name: i.config.name,
        unique: i.config.unique,
        columns: i.config.columns.map((c) => ("name" in c ? (c as { name: string }).name : "expr")),
        where: i.config.where ? "partial" : null,
      })),
    });
  } else if (typeof value === "function" && (value as unknown as PgEnum<[string, ...string[]]>).enumName) {
    const e = value as unknown as PgEnum<[string, ...string[]]>;
    enums.push({ name: e.enumName, values: [...e.enumValues] });
  }
}

tables.sort((a, b) => a.name.localeCompare(b.name));
enums.sort((a, b) => a.name.localeCompare(b.name));
process.stdout.write(JSON.stringify({ tables, enums }));
