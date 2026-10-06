import { sql } from "drizzle-orm";
import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

let pool: Pool | null = null;
let dbInstance: NodePgDatabase<typeof schema> | null = null;

export function getDb(): NodePgDatabase<typeof schema> {
  if (!dbInstance) {
    const connectionString =
      process.env.DATABASE_URL ||
      "postgresql://orochia_user:orochia_secret@localhost:5432/orochia_db?sslmode=disable";

    pool = new Pool({
      connectionString,
      max: parseInt(process.env.DATABASE_MAX_CONNECTIONS || "20", 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    dbInstance = drizzle(pool, { schema });
  }

  return dbInstance;
}

export const db = getDb();

export async function checkDbHealth(): Promise<boolean> {
  try {
    const client = getDb();
    await client.execute(sql`SELECT 1`);
    return true;
  } catch (error) {
    console.error("Database health check failed:", error);
    return false;
  }
}
