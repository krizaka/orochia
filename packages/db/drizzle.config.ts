import { defineConfig } from "drizzle-kit";
import { loadRootEnv } from "./src/load-env";

loadRootEnv(__dirname);

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgresql://orochia_user:orochia_secret@localhost:5432/orochia_db?sslmode=disable",
  },
  // The migrations log lives in `public`: a DigitalOcean dev database lets its user create objects
  // there only (CREATE SCHEMA is denied). Same place in every environment (see src/migrate.ts).
  migrations: { schema: "public" },
  verbose: true,
  strict: true,
});
