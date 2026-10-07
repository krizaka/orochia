import { sql } from "drizzle-orm";
import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { connectionConfig } from "./connection";
import * as schema from "./schema";

const DEV_DATABASE_URL =
  "postgresql://orochia_user:orochia_secret@localhost:5432/orochia_db?sslmode=disable";

let pool: Pool | null = null;
let dbInstance: NodePgDatabase<typeof schema> | null = null;

/** DATABASE_URL is mandatory in production; the local default exists for development only. */
function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (url && url.trim()) return url;
  if (process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL is required in production");
  }
  return DEV_DATABASE_URL;
}

export function getDb(): NodePgDatabase<typeof schema> {
  if (!dbInstance) {
    pool = new Pool({
      ...connectionConfig(connectionString()),
      max: parseInt(process.env.DATABASE_MAX_CONNECTIONS || "20", 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    dbInstance = drizzle(pool, { schema });
  }
  return dbInstance;
}

/**
 * Lazily connected client: importing this module never opens a connection (so `next build`
 * and unit tests run without a database); the first query does.
 */
export const db: NodePgDatabase<typeof schema> = new Proxy({} as NodePgDatabase<typeof schema>, {
  get(_target, property, receiver) {
    const instance = getDb();
    const value = Reflect.get(instance as object, property, receiver);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

export async function checkDbHealth(): Promise<boolean> {
  try {
    await getDb().execute(sql`SELECT 1`);
    return true;
  } catch (error) {
    console.error("Database health check failed:", error);
    return false;
  }
}
