/**
 * Applies the SQL migrations in packages/db/drizzle to DATABASE_URL, then the owner account
 * (OROCHIA_OWNER_*, see src/owner.ts) when it is configured, and exits.
 * Bundled into the production image as /app/migrate.cjs (see deploy/docker/Dockerfile) and run as
 * the DigitalOcean PRE_DEPLOY job, so a release never starts against an older schema.
 */
import path from "node:path";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { connectionConfig } from "./connection";
import { ensureOwner, ownerFromEnv } from "./owner";

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");
  const migrationsFolder = process.env.MIGRATIONS_DIR ?? path.resolve(__dirname, "drizzle");
  const pool = new Pool({ ...connectionConfig(connectionString), max: 1 });
  try {
    const db = drizzle(pool);
    await migrate(db, { migrationsFolder });
    console.log(`Migrations applied from ${migrationsFolder}`);
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
