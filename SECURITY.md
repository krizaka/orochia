# Security Policy

## Reporting a vulnerability

Please report vulnerabilities privately through
[GitHub Security Advisories](https://github.com/krizaka/orochia/security/advisories/new) or by e-mail to
**security@krizaka.com**. Do not open a public issue. We acknowledge reports within 72 hours.

Content that may involve minors or non-consensual material must be reported through the in-app
**Report** button (persisted and reviewed with priority) or to the authorities — never through issues.

## Security model (summary)

- **Sessions**: HMAC-SHA256-signed httpOnly cookies, 7-day expiry, constant-time verification; the role is
  read from the account at login, never from the request.
- **Passwords**: scrypt with per-password salt; no alternative hash format is accepted.
- **Media**: never proxied; stream URLs are signed and expire after 300 seconds; access is decided server-side
  for every play.
- **Payments**: payment intents are recorded server-side; access is granted only on a gateway webhook whose
  signature is verified in constant time; settlement is idempotent.
- **Uploads**: authenticated, type- and size-restricted, server-generated names; videos go directly to Bunny.
- **Configuration**: production refuses to run on missing secrets (503) and has no demo mode.
- **HTTP**: HSTS, `nosniff`, `X-Frame-Options: DENY`, strict referrer and permissions policies.
