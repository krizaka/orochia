/**
 * Applies the SQL migrations in packages/db/drizzle to DATABASE_URL, then the owner account
 * (OROCHIA_OWNER_*, see src/owner.ts) when it is configured, and exits.
 * Bundled into the production image as /app/migrate.cjs (see deploy/docker/Dockerfile) and run as
 * the DigitalOcean PRE_DEPLOY job, so a release never starts against an older schema.
 */
import path from "node:path";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { connectionConfig } from "./connection";
import { ensureOwner, ownerFromEnv } from "./owner";

/**
 * drizzle's migrator, minus its `CREATE SCHEMA IF NOT EXISTS`: PostgreSQL checks the CREATE privilege
 * on the database even when the schema exists, and a DigitalOcean dev database denies it. Same journal
 * (`public.__drizzle_migrations`, also read by drizzle-kit — drizzle.config.ts), same rule: every
 * migration newer than the last applied one runs, all of them in one transaction.
 */
async function applyMigrations(pool: Pool, migrationsFolder: string): Promise<number> {
  const migrations = readMigrationFiles({ migrationsFolder });
  const client = await pool.connect();
  try {
    await client.query(
      `CREATE TABLE IF NOT EXISTS public.__drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)`,
    );
    const { rows } = await client.query<{ created_at: string }>(
      `SELECT created_at FROM public.__drizzle_migrations ORDER BY created_at DESC LIMIT 1`,
    );
    const last = rows[0] ? Number(rows[0].created_at) : null;
    const pending = migrations.filter((m) => last === null || last < m.folderMillis);
    if (pending.length === 0) return 0;
    await client.query("BEGIN");
    try {
      for (const migration of pending) {
        for (const statement of migration.sql) await client.query(statement);
        await client.query(`INSERT INTO public.__drizzle_migrations ("hash", "created_at") VALUES ($1, $2)`, [
          migration.hash,
          migration.folderMillis,
        ]);
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
    return pending.length;
  } finally {
    client.release();
  }
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");
  const migrationsFolder = process.env.MIGRATIONS_DIR ?? path.resolve(__dirname, "drizzle");
  const pool = new Pool({ ...connectionConfig(connectionString), max: 1 });
  try {
    const applied = await applyMigrations(pool, migrationsFolder);
    console.log(`Migrations: ${applied} applied from ${migrationsFolder}`);
    const db = drizzle(pool);
    const owner = ownerFromEnv();
    if (owner) {
      const outcome = await ensureOwner(db, owner);
      console.log(`Owner account ${outcome.created ? "created" : "up to date"} (${owner.email})`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
