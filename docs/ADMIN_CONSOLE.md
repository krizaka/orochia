# 🛡️ Admin Console

The operator console (`apps/web/app/console`; it was the repository `krizaka/orochia-admin`, now archived) is served by
the platform's app **on its own host, `admin.<domain>`** — one App Platform app, one process — with its own database,
its own single account and its own network gate. `proxy.ts` rewrites that host into `/console` only for the addresses of
`AUTH_ALLOWED_IPS` (403 for the others, sign-in included; only `/api/health` and `/robots.txt` are open), and `/console`
answers 404 on every other host. It never touches Orochia's database: every
decision goes through Orochia's admin API (`/api/admin/*`, listed in the [API reference](API_CONTRACTS.md)), server
side, with a service token the browser never sees. What an operator decides is recorded in the console's own log.

```architecture
product: orochia
focus: orochia-admin
mode: runtime
```

The operator reaches the console from an allowed IP only, with its one account; the console keeps its account, sessions and operator log in its own PostgreSQL, and calls Orochia server-side on `/api/admin/*` with the service token — never the Orochia database.

## What you control

| Screen | What an operator sees and decides | Orochia API |
| :--- | :--- | :--- |
| **Overview** | Ledger totals, catalogue state and the three queues that need a human | `GET /api/admin/overview` |
| **2257 Creator Verification** | The review queue; open a creator's identity and age document, approve the creator — only verified creators can upload | `GET/PATCH /api/admin/creators`, `GET /api/admin/documents` |
| **Content Reports** | Triage: start a review, reopen, resolve with a recorded reason; suspected minors and non-consensual content first | `GET/PATCH /api/admin/reports` |
| **Treasury & Payouts** | Revenue from the ledger; put a payout under review, settle it with the transfer reference, or fail it with a reason (the balance is refunded) | `GET /api/platform/treasury`, `GET/PATCH /api/admin/payouts` |
| **Catalogue** | Every video by state with its open reports; take one down with a recorded reason (DMCA, terms, a confirmed report — its auction is cancelled) or restore it | `GET/PATCH /api/admin/videos` |
| **Auctions** | Open, awaiting and sold auctions and the credits held; cancel one with a reason — the leading bid's credits go back to its bidder | `GET/DELETE /api/admin/auctions` |
| **Creator Registry** | Every creator and their activity; suspend or restore their uploads | `GET/PATCH /api/admin/creators` |
| **Accounts** | Every account, filtered by role, suspension or search; suspend (sign-in blocked, open sessions refused on their next request, open auctions cancelled) with a reason shown to the account, reinstate, or change the role (member, creator, administrator) | `GET/PATCH /api/admin/users` |
| **Platform & Database** | Environment, database size and rows per table, migration history, backups (create, download, delete), the operator log and the factory reset | `/api/admin/platform*` |

## Screens

Captured on a local development stack (e-mail addresses and the operator's name redacted).

![Overview: the three queues that need a human, and the ledger](https://krizaka-assets.b-cdn.net/pr-assets/orochia/admin-console/01-overview.png)

*Overview — the three queues that need a human, and the ledger.*

![Accounts: role changes and suspensions, each behind a confirmation](https://krizaka-assets.b-cdn.net/pr-assets/orochia/admin-console/08-accounts.png)

*Accounts — every account, its role, its checks and its state.*

![Platform and database: deployment, migrations, backups and tables](https://krizaka-assets.b-cdn.net/pr-assets/orochia/admin-console/09-platform.png)

*Platform & Database — deployment, migrations, backups and rows per table.*

![The factory reset, armed by a typed phrase](https://krizaka-assets.b-cdn.net/pr-assets/orochia/admin-console/10-factory-reset-armed.png)

*The factory reset — backup first by default, locked until the phrase is typed.*

## How it is secured

Four gates, each enforced in code:

1. **The network.** Every request — the sign-in page included — is refused with `403` unless the client address is in
   `ADMIN_ALLOWED_IPS` (comma-separated). On DigitalOcean the address is `do-connecting-ip`, set by the platform's edge,
   never by the client. In production the list is **mandatory**: empty, the console answers `403` to everyone. Only the
   liveness route `/api/health` (no data) is outside it.
2. **One account.** Nobody signs up. The single operator is defined by environment — `ADMIN_EMAIL`, `ADMIN_NAME`,
   `ADMIN_PASSWORD` (12 characters or more) — and written to the console's database on first use. The password is
   stored as a salted scrypt hash and compared in constant time. Sessions are random tokens stored hashed, valid
   8 hours, in an `httpOnly`, `SameSite=Strict` cookie. Changing the password in the environment revokes every open
   session.
3. **A service token.** The console calls Orochia as a service: `Authorization: Bearer OPERATOR_API_TOKEN`
   (32 characters or more, shared by the two deployments only), compared in constant time. Orochia accepts it on its
   ADMIN routes only, and acts as the platform owner (`AUTH_OWNER_EMAIL`), who must exist, be an administrator and
   not be suspended — otherwise every call is refused. Without the variable, no token is accepted.
4. **Armed confirmations.** Every decision opens a dialog that says what will happen before it does. A decision that
   affects someone requires a **recorded reason** (a takedown, a suspension, a failed payout, a cancelled auction) or
   the **transfer reference** (a settled payout). Irreversible operations are **armed by a phrase**: the operator types
   it before the button works. Benign, reversible steps (start a review, reopen a report) are one click.

Every decision — done or refused, with its target and detail — is written to the operator log, shown on
**Platform & Database**.

## Backups and factory reset

- **Backup now** writes the whole database (gzipped JSON of every table) to private storage; backups can be
  described, downloaded and deleted from the console.
- **Factory reset** deletes every account, video, payment, auction and setting and rebuilds the schema from the
  release's migrations — the state of a fresh install. Orochia's owner account is kept; the console, its account
  and its log live in their own database and are not affected; media files at Bunny are not deleted. It is
  available **only** where `DATABASE_ALLOW_RESET=true` and **never** on the public, indexed production,
  whatever the flag says. The operator must type `reset <database name>`; "back up first" is on by default, and if
  that backup fails nothing is deleted.

## Run it locally

Start Orochia first, with the same `OPERATOR_API_TOKEN` in its `.env`, then:

```bash
git clone https://github.com/krizaka/orochia-admin.git && cd orochia-admin
cp .env.example .env.local      # its database, the operator account, the token shared with Orochia
docker exec orochia-postgres-dev psql -U orochia_user -d orochia_db -c "CREATE DATABASE orochia_admin"
npm install
npm run dev                     # http://localhost:3001 — sign in with ADMIN_EMAIL / ADMIN_PASSWORD
```

Locally (outside production) an empty `ADMIN_ALLOWED_IPS` lets every address in. On a deployment, `deploy/Dockerfile`
builds a standalone image (port 3001); `ADMIN_PASSWORD` and `OPERATOR_API_TOKEN` are app secrets, never in git.
