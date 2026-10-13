# Security Policy

## Reporting a vulnerability

Please report vulnerabilities privately through
[GitHub Security Advisories](https://github.com/krizaka/orochia/security/advisories/new) or by e-mail to
**security@krizaka.com**. Do not open a public issue. We acknowledge reports within 72 hours.

Content that may involve minors or non-consensual material must be reported through the in-app
**Report** button (persisted and reviewed with priority) or to the authorities — never through issues.

## Security model (summary)

- **Sessions**: HMAC-SHA256-signed tokens, 7-day expiry, constant-time verification, a random id per session; the
  role is read from the account, never from the request. The browser keeps its session in an httpOnly cookie; a native
  app sends it as `Authorization: Bearer` and **a bearer always decides** — a cookie that comes along is ignored, and no
  route sets a session cookie for a native client (#127: a native cookie jar outlives the app's sign-out). Signing out
  revokes the token on the server (`revoked_sessions`, kept until the token would have expired).
- **Passwords**: scrypt with per-password salt; no alternative hash format is accepted.
- **Media**: never proxied; stream URLs are signed and expire after 300 seconds; access is decided server-side
  for every play.
- **Payments**: payment intents are recorded server-side; access is granted only on a gateway webhook whose
  signature is verified in constant time; settlement is idempotent.
- **Uploads**: authenticated, type- and size-restricted, server-generated names; videos go directly to Bunny. Every
  upload must fit the storage quotas (the creator's plan and the platform's cap) before it is signed; a file whose real
  size exceeds them after encoding is held, never published (docs/MEDIA_PIPELINE.md §6).
- **Abuse**: rate limits per account and per IP with `Retry-After`, counted on the address the trusted proxy saw (never
  the client's `X-Forwarded-For`); sign-up behind a signed form token with a minimal fill time, a honeypot, a
  disposable-domain block list, a scripted-client refusal and Cloudflare Turnstile (fail closed); sign-in with
  progressive back-off and temporary lock-out per identifier. Multi-instance deployments use `ABUSE_RATE_LIMIT_STORE=postgres`.
- **Configuration**: production refuses to run on missing secrets (503) and has no demo mode.
- **HTTP**: Content-Security-Policy (`object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`, scripts from
  this origin, Turnstile and the ffmpeg core CDN), HSTS, `nosniff`, `X-Frame-Options: DENY`, COOP `same-origin`, strict
  referrer and permissions policies. Scripts still allow `'unsafe-inline'` (Next.js bootstrap without nonces).
