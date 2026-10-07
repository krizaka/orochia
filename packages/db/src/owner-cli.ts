/**
 * npm run db:owner [-- --email … --username … --name "…"] [--reset-password]
 *
 * Applies the owner account (src/owner.ts) to DATABASE_URL — local or production. Flags override
 * the OROCHIA_OWNER_* variables. Without OROCHIA_OWNER_PASSWORD a password is generated and
 * printed once (only when one has to be set).
 */
import crypto from "node:crypto";
import { parseArgs } from "node:util";
import { loadRootEnv } from "./load-env";

loadRootEnv(__dirname);

async function main(): Promise<void> {
  const { db } = await import("./client");
  const { ensureOwner, ownerFromEnv } = await import("./owner");
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      username: { type: "string" },
      name: { type: "string" },
      "reset-password": { type: "boolean", default: false },
    },
  });
  const env = ownerFromEnv() ?? { email: "", username: "", name: "" };
  const generated = env.password ? undefined : crypto.randomBytes(18).toString("base64url");
  const outcome = await ensureOwner(
    db,
    {
      email: values.email ?? env.email,
      username: values.username ?? env.username,
      name: values.name ?? env.name,
      password: env.password ?? generated,
    },
    { resetPassword: values["reset-password"] },
  );
  console.log(`✓ Owner account ${outcome.created ? "created" : "up to date"} (ADMIN, verified, active) — ${outcome.id}`);
  if (outcome.passwordSet && generated) console.log(`  Password (shown once, change it after signing in): ${generated}`);
  else if (!outcome.passwordSet) console.log("  Password unchanged (--reset-password sets OROCHIA_OWNER_PASSWORD or a generated one).");
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error("✗", error instanceof Error ? error.message : error);
    process.exit(1);
  });
