import type { PoolConfig } from "pg";

/**
 * Connection settings for DATABASE_URL. Managed PostgreSQL (DigitalOcean) signs its certificate
 * with its own CA: pg treats `sslmode=require` as `verify-full`, so without that CA every
 * connection fails with SELF_SIGNED_CERT_IN_CHAIN. When DATABASE_CA_CERT holds the CA (on
 * App Platform: `${<db>.CA_CERT}`), the server certificate is verified against it. The URL's
 * own `sslmode` is dropped then, because pg lets a parsed connection string override `ssl`.
 */
export function connectionConfig(connectionString: string): PoolConfig {
  const ca = process.env.DATABASE_CA_CERT?.trim();
  if (!ca) return { connectionString };
  const url = new URL(connectionString);
  for (const key of ["sslmode", "sslrootcert", "sslcert", "sslkey", "uselibpqcompat"]) {
    url.searchParams.delete(key);
  }
  return { connectionString: url.toString(), ssl: { ca, rejectUnauthorized: true } };
}
