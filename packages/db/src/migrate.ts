/**
 * Applies the SQL migrations in packages/db/drizzle to DATABASE_URL (rebuilding a development database whose history
 * was squashed — src/migrations.ts), then the owner account
 * (OROCHIA_OWNER_*, see src/owner.ts) when it is configured, and exits.
 * Bundled into the production image as /app/migrate.cjs (see deploy/docker/Dockerfile) and run as
 * the DigitalOcean PRE_DEPLOY job, so a release never starts against an older schema.
 */
import path from "node:path";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { connectionConfig } from "./connection";
import { ensureOwner, ownerFromEnv } from "./owner";
import { applyMigrations, databaseResetAllowed, dropPublicObjects, historyState, loadMigrations } from "./migrations";

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");
  const migrationsFolder = process.env.MIGRATIONS_DIR ?? path.resolve(__dirname, "drizzle");
  const pool = new Pool({ ...connectionConfig(connectionString), max: 1 });
  try {
    const migrations = loadMigrations(migrationsFolder);
    const state = await historyState(pool, migrations);
    if (state.kind === "rewritten") {
      // The migration history was squashed into a new baseline: this database applied migrations we no longer ship.
      if (!databaseResetAllowed()) {
        throw new Error(
          "This database's migration history was rewritten (new baseline). It cannot migrate forward. On a development " +
            "deployment set OROCHIA_ALLOW_DATABASE_RESET=true to rebuild it; production data is never dropped.",
        );
      }
      console.warn(`Migration history rewritten (${state.applied} applied, not all shipped by this release): rebuilding the database.`);
      await dropPublicObjects(pool);
    }
    const applied = await applyMigrations(pool, migrations);
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
