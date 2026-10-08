import { gunzipSync, gzipSync } from "node:zlib";
import type { Pool } from "pg";
import { deletePrivateObject, getPrivateObject, listPrivateObjects, putPrivateObject } from "./storage";
import { HttpError } from "./http";

/**
 * Database backups for operators: every table of the `public` schema, row by row, as gzipped JSON, kept in private
 * storage (`private/backups/`, Bunny Edge Storage in production, never publicly served) and downloadable from the admin
 * console. They hold personal data (e-mails, password hashes, encrypted payout details): admins only.
 * A backup records the migrations it was taken at, so a restore can refuse a mismatched schema.
 */

const FOLDER = "private/backups";
const NAME = /^orochia-[a-z0-9_]+-\d{8}T\d{6}Z\.json\.gz$/;

export interface BackupFile {
  format: "orochia-backup";
  version: 1;
  createdAt: string;
  database: string;
  migrations: string[];
  tables: Record<string, unknown[]>;
}

export async function createBackup(pool: Pool, reason: string): Promise<{ name: string; sizeBytes: number; tables: number; rows: number }> {
  const [{ rows: info }, { rows: tables }] = await Promise.all([
    pool.query<{ name: string }>(`SELECT current_database() AS name`),
    pool.query<{ tablename: string }>(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`),
  ]);
  const file: BackupFile = { format: "orochia-backup", version: 1, createdAt: new Date().toISOString(), database: info[0].name, migrations: [], tables: {} };
  let rows = 0;
  for (const { tablename } of tables) {
    const { rows: data } = await pool.query(`SELECT * FROM public."${tablename.replace(/"/g, '""')}"`);
    if (tablename === "__drizzle_migrations") file.migrations = data.map((r) => String((r as { hash: string }).hash));
    else {
      file.tables[tablename] = data;
      rows += data.length;
    }
  }
  const body = gzipSync(Buffer.from(JSON.stringify(file)));
  const stamp = file.createdAt.replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const name = `orochia-${file.database.toLowerCase().replace(/[^a-z0-9_]/g, "_")}-${stamp}.json.gz`;
  await putPrivateObject(`${FOLDER}/${name}`, body);
  console.warn(`[backups] ${name} written (${rows} rows) — ${reason}`);
  return { name, sizeBytes: body.length, tables: Object.keys(file.tables).length, rows };
}

export async function listBackups() {
  return (await listPrivateObjects(FOLDER)).filter((b) => NAME.test(b.name)).sort((a, b) => b.name.localeCompare(a.name));
}

function checkName(name: string) {
  if (!NAME.test(name)) throw new HttpError(404, "Backup not found");
}

export async function readBackup(name: string): Promise<Buffer> {
  checkName(name);
  const body = await getPrivateObject(`${FOLDER}/${name}`);
  if (!body) throw new HttpError(404, "Backup not found");
  return body;
}

/** A backup's summary (tables and rows), read from the file itself. */
export async function describeBackup(name: string) {
  const file = JSON.parse(gunzipSync(await readBackup(name)).toString("utf8")) as BackupFile;
  return { name, createdAt: file.createdAt, database: file.database, migrations: file.migrations.length, tables: Object.entries(file.tables).map(([t, r]) => ({ name: t, rows: r.length })) };
}

export async function deleteBackup(name: string) {
  checkName(name);
  await deletePrivateObject(`${FOLDER}/${name}`);
}
