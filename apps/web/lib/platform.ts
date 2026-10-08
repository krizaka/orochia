import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import {
  applyMigrations,
  connectionConfig,
  databaseResetAllowed,
  db,
  dropPublicObjects,
  ensureOwner,
  historyState,
  loadMigrations,
  ownerFromEnv,
  profiles,
  users,
} from "@orochia/db";
import { eq } from "drizzle-orm";
import { appUrl } from "./env";
import { HttpError } from "./http";
import { createBackup } from "./backups";

/**
 * The platform as operators see it: environment, database, migration history — and, on a development deployment only,
 * rebuilding the database from the migrations (packages/db/src/migrations.ts, the same code as the release job).
 */

/** The migrations shipped with this build: MIGRATIONS_DIR, the image's ./drizzle, or the workspace's packages/db/drizzle. */
function migrationsFolder(): string {
  const candidates = [
    process.env.MIGRATIONS_DIR,
    path.resolve(process.cwd(), "drizzle"),
    path.resolve(process.cwd(), "../../drizzle"),
    path.resolve(process.cwd(), "../../packages/db/drizzle"),
    path.resolve(process.cwd(), "packages/db/drizzle"),
  ].filter((c): c is string => Boolean(c));
  const found = candidates.find((c) => fs.existsSync(path.join(c, "meta", "_journal.json")));
  if (!found) throw new HttpError(503, "The migrations are not part of this build");
  return found;
}

function databaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (url) return url;
  if (process.env.NODE_ENV === "production") throw new HttpError(503, "DATABASE_URL is not configured");
  return "postgresql://orochia_user:orochia_secret@localhost:5432/orochia_db?sslmode=disable";
}

export interface PlatformStatus {
  environment: { appUrl: string; indexed: boolean; nodeEnv: string };
  database: { name: string; host: string; sizeBytes: number; serverVersion: string };
  history: Awaited<ReturnType<typeof historyState>>;
  tables: { name: string; rows: number }[];
  reset: { allowed: boolean; confirmPhrase: string; ownerConfigured: boolean };
}

export async function platformStatus(): Promise<PlatformStatus> {
  const pool = new Pool({ ...connectionConfig(databaseUrl()), max: 1 });
  try {
    const [{ rows: info }, history, { rows: tableRows }] = await Promise.all([
      pool.query<{ name: string; size: string; version: string }>(`SELECT current_database() AS name, pg_database_size(current_database()) AS size, current_setting('server_version') AS version`),
      historyState(pool, loadMigrations(migrationsFolder())),
      pool.query<{ tablename: string }>(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '__drizzle_migrations' ORDER BY tablename`),
    ]);
    const tables: { name: string; rows: number }[] = [];
    for (const { tablename } of tableRows) {
      const { rows } = await pool.query<{ n: string }>(`SELECT count(*) AS n FROM public."${tablename.replace(/"/g, '""')}"`);
      tables.push({ name: tablename, rows: Number(rows[0].n) });
    }
    const name = info[0].name;
    return {
      environment: { appUrl: appUrl(), indexed: process.env.NODE_ENV === "production" && process.env.SEARCH_INDEXING !== "off", nodeEnv: process.env.NODE_ENV ?? "development" },
      database: { name, host: new URL(databaseUrl()).hostname, sizeBytes: Number(info[0].size), serverVersion: info[0].version },
      history,
      tables,
      reset: { allowed: databaseResetAllowed(), confirmPhrase: `reset ${name}`, ownerConfigured: ownerFromEnv() !== null },
    };
  } finally {
    await pool.end();
  }
}

/** A backup of the database now (any deployment: it changes nothing). */
export async function backupDatabase(operator: string) {
  const pool = new Pool({ ...connectionConfig(databaseUrl()), max: 1 });
  try {
    return await createBackup(pool, `asked by @${operator}`);
  } finally {
    await pool.end();
  }
}

/**
 * Factory reset: optionally backs the database up (a failed backup stops everything), then wipes it and rebuilds it
 * from the migrations. Refused unless databaseResetAllowed() (never on the public
 * production deployment) and unless the operator typed the confirmation phrase. The operator who asked keeps their
 * account — same id, e-mail, username and password, so their session goes on — and the configured owner is restored.
 */
export async function resetDatabase(input: { operatorId: string; confirm: string; backup: boolean }) {
  if (!databaseResetAllowed()) throw new HttpError(403, "Resetting the database is disabled on this deployment");
  const folder = migrationsFolder();
  const migrations = loadMigrations(folder);
  const pool = new Pool({ ...connectionConfig(databaseUrl()), max: 1 });
  try {
    const { rows } = await pool.query<{ name: string }>(`SELECT current_database() AS name`);
    if (input.confirm.trim() !== `reset ${rows[0].name}`) throw new HttpError(400, `Type “reset ${rows[0].name}” to confirm`);

    const [operator] = await db
      .select({ id: users.id, email: users.email, username: users.username, passwordHash: users.passwordHash, displayName: profiles.displayName })
      .from(users)
      .leftJoin(profiles, eq(profiles.userId, users.id))
      .where(eq(users.id, input.operatorId))
      .limit(1);

    const backup = input.backup ? await createBackup(pool, `before the factory reset by @${operator?.username ?? input.operatorId}`) : null;
    console.warn(`[platform] database ${rows[0].name} reset by @${operator?.username ?? input.operatorId}`);
    await dropPublicObjects(pool);
    const applied = await applyMigrations(pool, migrations);

    const fresh = drizzle(pool);
    if (operator) {
      await fresh.insert(users).values({
        id: operator.id,
        email: operator.email,
        username: operator.username,
        passwordHash: operator.passwordHash,
        role: "ADMIN",
        isVerified: true,
        isAgeVerified: true,
        emailVerifiedAt: new Date(),
      });
      await fresh.insert(profiles).values({ userId: operator.id, displayName: operator.displayName ?? operator.username });
    }
    const owner = ownerFromEnv();
    const ownerOutcome = owner ? await ensureOwner(fresh as never, owner) : null;
    return { migrationsApplied: applied, operatorKept: Boolean(operator), ownerRestored: Boolean(ownerOutcome), backup };
  } finally {
    await pool.end();
  }
}
