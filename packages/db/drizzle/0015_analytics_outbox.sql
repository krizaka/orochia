-- Product analytics on Orazaka (ADR-081): the outbox also carries analytics events (watch), sent to /api/v1/analytics/events.
ALTER TYPE "public"."reco_outbox_kind" ADD VALUE IF NOT EXISTS 'ANALYTICS';
