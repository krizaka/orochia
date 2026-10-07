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
  verbose: true,
  strict: true,
});
