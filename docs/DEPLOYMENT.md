# 🚀 Orochia Deployment & Operations Guide

Orochia is designed for zero-friction deployment on **DigitalOcean App Platform** or self-hosted virtual machines (Droplets) via Docker Compose.

---

## 1. DigitalOcean App Platform (Recommended)

### 1-Click App Spec Deployment
1. Install and authenticate `doctl`:
   ```bash
   doctl auth init
   ```
2. Provision the cluster using our production app spec:
   ```bash
   doctl apps create --spec deploy/digitalocean/app-spec.yaml
   ```
3. Set your secret environment variables in the DigitalOcean console:
   - `BUNNY_STREAM_API_KEY`
   - `BUNNY_STREAM_TOKEN_AUTH_KEY`
   - `BUNNY_WEBHOOK_SECRET`
   - `SESSION_SECRET`
   - `CCBILL_SALT` / `SEGPAY_SECRET_KEY` / `NOWPAYMENTS_API_KEY`

---

## 2. Self-Hosted Docker Compose (Single Droplet)

### Production Stack with Automatic SSL (Caddy)
```bash
# 1. Clone repository
git clone https://github.com/krizaka/orochia.git
cd orochia

# 2. Configure production environment
cp .env.example .env
nano .env # Set DOMAIN, secrets, and database credentials

# 3. Launch stack
docker compose -f deploy/docker/docker-compose.prod.yml up -d --build

# 4. Run database migrations
docker compose -f deploy/docker/docker-compose.prod.yml exec web npm run db:migrate
```

---

## 3. Local Development Quickstart

```bash
# 1. Launch PostgreSQL and Redis containers
docker compose -f deploy/docker/docker-compose.dev.yml up -d

# 2. Install workspace dependencies
npm install

# 3. Push schema to local database
npm run db:generate
npm run db:migrate

# 4. Seed development creators and demo videos
npm run db:seed

# 5. Start development server
npm run dev
```

Navigate to `http://localhost:3000` to access the platform.
Navigate to `http://localhost:3000/api/health` to verify database and Redis connectivity.

---

## 4. Payment Gateway Verification

- **CCBill Sandbox**: Use client account `950000`, subaccount `0000`, test cards provided in CCBill Developer Portal.
- **Segpay Staging**: Point postbacks to `https://your-domain.com/api/webhooks/segpay`.
- **Crypto (NowPayments)**: Enable Instant Payment Notifications (IPN) pointing to your domain.
