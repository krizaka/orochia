/**
 * Applies the SQL migrations in packages/db/drizzle to DATABASE_URL, then exits.
 * Bundled into the production image as /app/migrate.cjs (see deploy/docker/Dockerfile) and run as
 * the DigitalOcean PRE_DEPLOY job, so a release never starts against an older schema.
 */
import path from "node:path";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");
  const migrationsFolder = process.env.MIGRATIONS_DIR ?? path.resolve(__dirname, "drizzle");
  const pool = new Pool({ connectionString, max: 1 });
  try {
    await migrate(drizzle(pool), { migrationsFolder });
    console.log(`Migrations applied from ${migrationsFolder}`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
