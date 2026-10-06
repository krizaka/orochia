# 🏛️ Orochia Architecture Specification

Orochia is an adult-friendly, high-performance open-source video streaming and creator community platform designed by **Krizaka**. It decouples media transcoding and delivery to **Bunny.net Stream Edge CDN** while maintaining strict zero-trust access control, tokenized HMAC authorization, and an atomic financial ledger across adult-compliant payment processors.

---

## 1. System Topology Overview

```mermaid
graph TD
    subgraph Client Tier
        UserBrowser[Viewer Browser / HLS Player]
        CreatorBrowser[Creator Studio / Tus Uploader]
    end

    subgraph Orochia Core Engine [apps/web on DigitalOcean]
        NextApp[Next.js App Router Core]
        AuthGuard[RBAC & Session Guard]
        AccessResolver[Granular Access Matrix]
        StreamSigner[Bunny HMAC Token Generator]
        LedgerService[Atomic Tips Ledger]
        WebhookReceiver[Bunny Webhook Ingestion]
    end

    subgraph Data & Cache Tier
        Postgres[(Managed PostgreSQL 16)]
        RedisCache[(Managed Redis 7)]
    end

    subgraph Media & Edge Tier
        BunnyTus[Bunny.net Direct Tus Ingest]
        BunnyTranscoder[Bunny Encoding Pipeline]
        BunnyEdge[Bunny Global HLS Edge CDN]
    end

    subgraph Payment Rails
        CCBill[CCBill Dynamic Pricing]
        Segpay[Segpay Merchant Gateway]
        CryptoGW[Crypto Gateway / NowPayments]
    end

    CreatorBrowser -->|1. Direct Resumable Tus Upload| BunnyTus
    CreatorBrowser -->|Request Upload Credentials| NextApp
    BunnyTranscoder -->|2. Webhook: Transcoding Complete| WebhookReceiver
    WebhookReceiver --> Postgres

    UserBrowser -->|3. Request Stream Auth| NextApp
    NextApp --> AuthGuard
    AuthGuard --> AccessResolver
    AccessResolver --> Postgres
    AccessResolver -->|Allowed| StreamSigner
    StreamSigner -->|Signed m3u8 URL with HMAC Token| UserBrowser

    UserBrowser -->|4. Pull 4K HLS Segments with Token| BunnyEdge

    UserBrowser -->|5. Tip / Unlock Video| NextApp
    NextApp --> CCBill
    NextApp --> Segpay
    NextApp --> CryptoGW
    CCBill -.->|Webhook Postback| NextApp
    NextApp --> LedgerService
    LedgerService --> Postgres
```

---

## 2. Monorepo Package Boundaries

The repository is organized as an enterprise-grade TypeScript monorepo:

| Path | Name | Responsibilities |
| :--- | :--- | :--- |
| `apps/web` | `@orochia/web` | Next.js 14 App Router, Server Actions, HLS player UI, creator studio, health & Prometheus metrics. |
| `packages/db` | `@orochia/db` | PostgreSQL schema, Drizzle ORM relations, migrations, connection pool, and development seed factory. |
| `packages/media` | `@orochia/media` | Bunny.net Stream SDK wrapper, direct Tus signing, HMAC-SHA256 playlist token generator, and webhook verification. |
| `packages/payments` | `@orochia/payments` | Unified adapter interfaces for CCBill, Segpay, Crypto, and Stripe; atomic double-entry tips ledger. |
| `packages/config` | `@orochia/config` | Shared TypeScript, ESLint, and Tailwind presets. |
| `deploy/` | Infrastructure | Multi-stage Dockerfiles, Docker Compose dev/prod environments, and DigitalOcean App Platform spec. |

---

## 3. Access Control State Machine & IDOR Defense

Orochia implements strict zero-trust permission checks before ever signing a media playback token:

```mermaid
stateDiagram-v2
    [*] --> CheckAuthor: Video Playback Requested
    CheckAuthor --> StreamGranted: Viewer is Video Author
    CheckAuthor --> CheckVisibility: Viewer != Author

    CheckVisibility --> StreamGranted: Visibility == PUBLIC
    CheckVisibility --> CheckContacts: Visibility == CONTACTS_ONLY
    CheckVisibility --> CheckAccessGrant: Visibility == TIPPED_UNLOCKED

    CheckContacts --> StreamGranted: Relationship == ACCEPTED
    CheckContacts --> AccessDenied: No mutual accepted connection

    CheckAccessGrant --> StreamGranted: Valid VideoAccessGrant Exists
    CheckAccessGrant --> PaywallPrompt: No Grant (Prompt Tip to Unlock)

    StreamGranted --> GenerateHMACToken: Issue signed Bunny HLS URL
    AccessDenied --> [*]: Return HTTP 403 Forbidden
    PaywallPrompt --> [*]: Return Paywall Overlay State
```

---

## 4. Financial Ledger Invariants

The tips engine operates on double-entry principles:
1. **Gross Invariance**: For every tip of amount $G$, `PlatformFee = round(G * FeePct)` and `CreatorCredit = G - PlatformFee`.
2. **Transaction Atomicity**: The tip debit, credit, profile stats update, video counter update, and `VideoAccessGrant` issuance are enclosed within a single PostgreSQL transaction (`db.transaction`).
3. **Escrow Solvency**: Payout disbursements cannot exceed `sum(net_amount_cents) - sum(payout_requests.amount_cents)`. Concurrency locks prevent double-spend during simultaneous payout requests.
