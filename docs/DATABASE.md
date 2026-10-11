---
title: Database Reference
description: Every table, column, index, foreign key and enum of the Orochia PostgreSQL schema — generated from the Drizzle schema.
---

# Database Reference

> Generated from `packages/db/src/schema` by `scripts/generate-docs.mjs` — do not hand-edit.
> To change the schema: edit it, `npm run db:generate`, review the SQL, `npm run db:migrate` — see the Development guide.

PostgreSQL 16 · 46 tables · 26 enums · 6 migrations (`packages/db/drizzle`).

## Relationships

Every foreign key, read from the schema: what each table points to (through which columns) and which tables point to it.

| Table | References (columns) | Referenced by |
| :--- | :--- | :--- |
| `auction_bids` | `auctions` (`auction_id`) · `users` (`bidder_id`) | — |
| `auctions` | `videos` (`video_id`) · `users` (`creator_id`) · `users` (`leader_id`) | `auction_bids` |
| `audience_list_members` | `audience_lists` (`list_id`) · `users` (`user_id`) | — |
| `audience_lists` | `users` (`owner_id`) | `audience_list_members` · `playlist_audience_lists` · `stories` · `video_audience_lists` |
| `auth_identities` | `users` (`user_id`) | — |
| `auth_tokens` | `users` (`user_id`) | — |
| `blocked_users` | `users` (`blocker_id`) · `users` (`blocked_id`) | — |
| `challenge_applications` | `challenges` (`challenge_id`) · `users` (`creator_id`) | — |
| `challenge_pledges` | `challenges` (`challenge_id`) · `users` (`backer_id`) | — |
| `challenges` | `users` (`author_id`) · `users` (`creator_id`) · `videos` (`delivered_video_id`) · `stories` (`delivered_story_id`) | `challenge_applications` · `challenge_pledges` |
| `compliance_reports` | `videos` (`video_id`) · `stories` (`story_id`) · `users` (`reporter_id`) | — |
| `contacts` | `users` (`requester_id`) · `users` (`addressee_id`) | — |
| `content_ratings` | — | `stories` · `videos` |
| `conversations` | `users` (`participant1_id`) · `users` (`participant2_id`) | `direct_messages` |
| `credit_topups` | `users` (`user_id`) | — |
| `direct_messages` | `conversations` (`conversation_id`) · `users` (`sender_id`) · `users` (`recipient_id`) · `stories` (`story_id`) | — |
| `follows` | `users` (`follower_id`) · `users` (`creator_id`) | — |
| `notifications` | `users` (`user_id`) · `users` (`actor_id`) | — |
| `payment_intents` | `users` (`sender_id`) · `users` (`creator_id`) · `videos` (`video_id`) · `stories` (`story_id`) | — |
| `payout_accounts` | `users` (`user_id`) | — |
| `payout_requests` | `users` (`creator_id`) | — |
| `playlist_audience_lists` | `playlists` (`playlist_id`) · `audience_lists` (`list_id`) | — |
| `playlist_items` | `playlists` (`playlist_id`) · `videos` (`video_id`) | — |
| `playlist_members` | `playlists` (`playlist_id`) · `users` (`user_id`) | — |
| `playlists` | `users` (`creator_id`) | `playlist_audience_lists` · `playlist_items` · `playlist_members` |
| `profiles` | `users` (`user_id`) | — |
| `push_devices` | `users` (`user_id`) | — |
| `stories` | `users` (`creator_id`) · `audience_lists` (`audience_list_id`) · `content_ratings` (`content_rating_id`) | `challenges` · `compliance_reports` · `direct_messages` · `payment_intents` · `story_likes` · `story_views` · `tips_ledger` |
| `story_likes` | `stories` (`story_id`) · `users` (`user_id`) | — |
| `story_views` | `stories` (`story_id`) · `users` (`viewer_id`) | — |
| `tips_ledger` | `users` (`sender_id`) · `users` (`creator_id`) · `videos` (`video_id`) · `stories` (`story_id`) | — |
| `user_invitations` | `users` (`inviter_id`) | — |
| `users` | — | `auction_bids` · `auctions` · `audience_list_members` · `audience_lists` · `auth_identities` · `auth_tokens` · `blocked_users` · `challenge_applications` · `challenge_pledges` · `challenges` · `compliance_reports` · `contacts` · `conversations` · `credit_topups` · `direct_messages` · `follows` · `notifications` · `payment_intents` · `payout_accounts` · `payout_requests` · `playlist_members` · `playlists` · `profiles` · `push_devices` · `stories` · `story_likes` · `story_views` · `tips_ledger` · `user_invitations` · `video_access_grants` · `video_comments` · `video_drafts` · `video_likes` · `video_shares` · `video_viewers` · `video_views` · `videos` · `wallet_ledger` |
| `video_access_grants` | `videos` (`video_id`) · `users` (`user_id`) | — |
| `video_audience_lists` | `videos` (`video_id`) · `audience_lists` (`list_id`) | — |
| `video_comments` | `videos` (`video_id`) · `users` (`author_id`) · `video_comments` (`parent_id`) · `users` (`removed_by`) | `video_comments` |
| `video_drafts` | `users` (`owner_id`) | — |
| `video_likes` | `videos` (`video_id`) · `users` (`user_id`) | — |
| `video_shares` | `videos` (`video_id`) · `users` (`user_id`) | — |
| `video_viewers` | `videos` (`video_id`) · `users` (`user_id`) | — |
| `video_views` | `videos` (`video_id`) · `users` (`viewer_id`) | — |
| `videos` | `users` (`creator_id`) · `content_ratings` (`content_rating_id`) | `auctions` · `challenges` · `compliance_reports` · `payment_intents` · `playlist_items` · `tips_ledger` · `video_access_grants` · `video_audience_lists` · `video_comments` · `video_likes` · `video_shares` · `video_viewers` · `video_views` |
| `wallet_ledger` | `users` (`user_id`) | — |

## Tables

### `auction_bids`

| Column | Type | Null | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | uuid | no | `gen_random_uuid()` | primary key |
| `auction_id` | uuid | no |  | → `auctions.id` (on delete cascade) |
| `bidder_id` | uuid | no |  | → `users.id` (on delete cascade) |
| `amount_cents` | integer | no |  |  |
| `status` | auction_bid_status | no | `"LEADING"` |  |
| `released_at` | timestamp with time zone | yes |  |  |
| `created_at` | timestamp with time zone | no | `now()` |  |

**Indexes:** `auction_bids_auction_idx` (auction_id, created_at) · `auction_bids_bidder_idx` (bidder_id, created_at) · `auction_bids_one_leader_idx` (unique, auction_id, partial)

### `auctions`

| Column | Type | Null | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | uuid | no | `gen_random_uuid()` | primary key |
| `video_id` | uuid | no |  | → `videos.id` (on delete cascade) |
| `creator_id` | uuid | no |  | → `users.id` (on delete cascade) |
| `status` | auction_status | no | `"OPEN"` |  |
| `rights` | auction_rights | no | `"WATCH"` |  |
| `settlement` | auction_settlement | no | `"CREATOR_DECIDES"` |  |
| `starting_price_cents` | integer | no |  |  |
| `starts_at` | timestamp with time zone | no |  |  |
| `ends_at` | timestamp with time zone | no |  |  |
| `scheduled_ends_at` | timestamp with time zone | no |  |  |
| `decision_deadline` | timestamp with time zone | yes |  |  |
| `highest_bid_cents` | integer | no | `0` |  |
| `bids_count` | integer | no | `0` |  |
| `leading_bid_id` | uuid | yes |  |  |
| `leader_id` | uuid | yes |  | → `users.id` (on delete set null) |
| `previous_visibility` | video_visibility | no |  |  |
| `closed_at` | timestamp with time zone | yes |  |  |
| `settled_at` | timestamp with time zone | yes |  |  |
| `cancel_reason` | text | yes |  |  |
| `created_at` | timestamp with time zone | no | `now()` |  |
| `updated_at` | timestamp with time zone | no | `now()` |  |

**Indexes:** `auctions_one_active_per_video_idx` (unique, video_id, partial) · `auctions_status_ends_idx` (status, ends_at) · `auctions_decision_deadline_idx` (decision_deadline, partial) · `auctions_creator_idx` (creator_id, created_at)

### `audience_list_members`

| Column | Type | Null | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | uuid | no | `gen_random_uuid()` | primary key |
| `list_id` | uuid | no |  | → `audience_lists.id` (on delete cascade) |
| `user_id` | uuid | no |  | → `users.id` (on delete cascade) |
| `created_at` | timestamp with time zone | no | `now()` |  |

**Indexes:** `audience_list_members_unique_idx` (unique, list_id, user_id) · `audience_list_members_user_idx` (user_id)

### `audience_lists`

| Column | Type | Null | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | uuid | no | `gen_random_uuid()` | primary key |
| `owner_id` | uuid | no |  | → `users.id` (on delete cascade) |
| `name` | varchar(80) | no |  |  |
| `created_at` | timestamp with time zone | no | `now()` |  |
| `updated_at` | timestamp with time zone | no | `now()` |  |

**Indexes:** `audience_lists_owner_name_idx` (unique, owner_id, name)

### `auth_identities`

| Column | Type | Null | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | uuid | no | `gen_random_uuid()` | primary key |
| `user_id` | uuid | no |  | → `users.id` (on delete cascade) |
| `provider` | auth_provider | no |  |  |
| `provider_user_id` | varchar(191) | no |  |  |
| `email` | varchar(255) | yes |  |  |
| `created_at` | timestamp with time zone | no | `now()` |  |
| `last_used_at` | timestamp with time zone | no | `now()` |  |

**Indexes:** `auth_identities_provider_user_idx` (unique, provider, provider_user_id) · `auth_identities_user_idx` (user_id)

### `auth_tokens`

| Column | Type | Null | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | uuid | no | `gen_random_uuid()` | primary key |
| `user_id` | uuid | no |  | → `users.id` (on delete cascade) |
| `purpose` | auth_token_purpose | no |  |  |
| `token_hash` | varchar(64) | no |  |  |
| `expires_at` | timestamp with time zone | no |  |  |
| `used_at` | timestamp with time zone | yes |  |  |
| `created_at` | timestamp with time zone | no | `now()` |  |

**Indexes:** `auth_tokens_hash_idx` (unique, token_hash) · `auth_tokens_user_purpose_idx` (user_id, purpose)

### `blocked_users`

| Column | Type | Null | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | uuid | no | `gen_random_uuid()` | primary key |
| `blocker_id` | uuid | no |  | → `users.id` (on delete cascade) |
| `blocked_id` | uuid | no |  | → `users.id` (on delete cascade) |
| `reason` | text | yes |  |  |
| `created_at` | timestamp with time zone | no | `now()` |  |

**Indexes:** `blocked_users_pair_idx` (unique, blocker_id, blocked_id) · `blocked_users_blocker_idx` (blocker_id) · `blocked_users_blocked_idx` (blocked_id)

### `challenge_applications`

| Column | Type | Null | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | uuid | no | `gen_random_uuid()` | primary key |
| `challenge_id` | uuid | no |  | → `challenges.id` (on delete cascade) |
| `creator_id` | uuid | no |  | → `users.id` (on delete cascade) |
| `note` | varchar(280) | yes |  |  |
| `status` | challenge_application_status | no | `"PENDING"` |  |
| `created_at` | timestamp with time zone | no | `now()` |  |

**Indexes:** `challenge_applications_once_idx` (unique, challenge_id, creator_id)

### `challenge_pledges`

| Column | Type | Null | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | uuid | no | `gen_random_uuid()` | primary key |
| `challenge_id` | uuid | no |  | → `challenges.id` (on delete cascade) |
| `backer_id` | uuid | no |  | → `users.id` (on delete cascade) |
| `amount_cents` | integer | no |  |  |
| `status` | challenge_pledge_status | no | `"HELD"` |  |
| `released_at` | timestamp with time zone | yes |  |  |
| `created_at` | timestamp with time zone | no | `now()` |  |

**Indexes:** `challenge_pledges_challenge_idx` (challenge_id, created_at) · `challenge_pledges_backer_idx` (backer_id, created_at)

### `challenges`

| Column | Type | Null | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | uuid | no | `gen_random_uuid()` | primary key |
| `kind` | challenge_kind | no |  |  |
| `status` | challenge_status | no | `"OPEN"` |  |
| `author_id` | uuid | no |  | → `users.id` (on delete cascade) |
| `creator_id` | uuid | yes |  | → `users.id` (on delete cascade) |
| `title` | varchar(120) | no |  |  |
| `description` | text | no |  |  |
| `deliverable` | challenge_deliverable | no | `"VIDEO"` |  |
| `reward` | challenge_reward | no | `"BACKERS"` |  |
| `goal_cents` | integer | yes |  |  |
| `pledged_cents` | integer | no | `0` |  |
| `backers_count` | integer | no | `0` |  |
| `deadline` | timestamp with time zone | no |  |  |
| `delivery_days` | integer | no |  |  |
| `delivery_deadline` | timestamp with time zone | yes |  |  |
| `delivered_video_id` | uuid | yes |  | → `videos.id` (on delete set null) |
| `delivered_story_id` | uuid | yes |  | → `stories.id` (on delete set null) |
| `previous_visibility` | video_visibility | yes |  |  |
| `accepted_at` | timestamp with time zone | yes |  |  |
| `delivered_at` | timestamp with time zone | yes |  |  |
| `closed_at` | timestamp with time zone | yes |  |  |
| `cancel_reason` | text | yes |  |  |
| `created_at` | timestamp with time zone | no | `now()` |  |
| `updated_at` | timestamp with time zone | no | `now()` |  |

**Indexes:** `challenges_status_deadline_idx` (status, deadline) · `challenges_delivery_deadline_idx` (delivery_deadline, partial) · `challenges_author_idx` (author_id, created_at) · `challenges_creator_idx` (creator_id, created_at) · `challenges_delivered_video_idx` (unique, delivered_video_id, partial) · `challenges_delivered_story_idx` (unique, delivered_story_id, partial)

### `compliance_reports`

| Column | Type | Null | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | uuid | no | `gen_random_uuid()` | primary key |
| `video_id` | uuid | yes |  | → `videos.id` (on delete set null) |
| `story_id` | uuid | yes |  | → `stories.id` (on delete set null) |
| `video_title` | varchar(255) | no |  |  |
| `reason` | report_reason | no |  |  |
| `details` | text | no |  |  |
| `reporter_email` | varchar(255) | no |  |  |
| `reporter_id` | uuid | yes |  | → `users.id` (on delete set null) |
| `status` | report_status | no | `"OPEN"` |  |
| `created_at` | timestamp with time zone | no | `now()` |  |
| `resolved_at` | timestamp with time zone | yes |  |  |

**Indexes:** `compliance_reports_status_idx` (status, created_at)

### `contacts`

| Column | Type | Null | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | uuid | no | `gen_random_uuid()` | primary key |
| `requester_id` | uuid | no |  | → `users.id` (on delete cascade) |
| `addressee_id` | uuid | no |  | → `users.id` (on delete cascade) |
| `status` | contact_status | no | `"PENDING"` |  |
| `created_at` | timestamp with time zone | no | `now()` |  |
| `updated_at` | timestamp with time zone | no | `now()` |  |

**Indexes:** `contacts_pair_idx` (unique, requester_id, addressee_id)

### `content_ratings`

| Column | Type | Null | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | varchar(30) | no |  | primary key |
| `label` | varchar(50) | no |  |  |
| `description` | text | yes |  |  |
| `is_adult` | boolean | no | `false` |  |
| `requires_blur` | boolean | no | `false` |  |
| `default_tags` | text[] | no | `'{}'::text[]` |  |
| `min_age` | integer | no | `0` |  |
| `display_order` | integer | no | `0` |  |
| `icon_name` | varchar(50) | no | `"shield"` |  |
| `created_at` | timestamp with time zone | no | `now()` |  |

### `conversations`

| Column | Type | Null | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | uuid | no | `gen_random_uuid()` | primary key |
| `participant1_id` | uuid | no |  | → `users.id` (on delete cascade) |
| `participant2_id` | uuid | no |  | → `users.id` (on delete cascade) |
| `last_message_at` | timestamp with time zone | no | `now()` |  |
| `created_at` | timestamp with time zone | no | `now()` |  |
| `updated_at` | timestamp with time zone | no | `now()` |  |

**Indexes:** `conversations_participant1_idx` (participant1_id) · `conversations_participant2_idx` (participant2_id) · `conversations_last_message_at_idx` (last_message_at)

### `credit_topups`

| Column | Type | Null | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | uuid | no | `gen_random_uuid()` | primary key |
| `user_id` | uuid | no |  | → `users.id` (on delete cascade) |
| `credits_cents` | integer | no |  |  |
| `price_cents` | integer | no |  |  |
| `gateway` | payment_gateway | no |  |  |
| `status` | payment_intent_status | no | `"PENDING"` |  |
| `gateway_transaction_ref` | varchar(255) | yes |  |  |
| `created_at` | timestamp with time zone | no | `now()` |  |
| `settled_at` | timestamp with time zone | yes |  |  |

**Indexes:** `credit_topups_user_idx` (user_id, created_at)

### `direct_messages`

| Column | Type | Null | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | uuid | no | `gen_random_uuid()` | primary key |
| `conversation_id` | uuid | no |  | → `conversations.id` (on delete cascade) |
| `sender_id` | uuid | no |  | → `users.id` (on delete cascade) |
| `recipient_id` | uuid | no |  | → `users.id` (on delete cascade) |
| `content` | text | no |  |  |
| `story_id` | uuid | yes |  | → `stories.id` (on delete set null) |
| `is_read` | boolean | no | `false` |  |
| `read_at` | timestamp with time zone | yes |  |  |
| `created_at` | timestamp with time zone | no | `now()` |  |

**Indexes:** `direct_messages_conversation_idx` (conversation_id) · `direct_messages_sender_idx` (sender_id) · `direct_messages_recipient_idx` (recipient_id) · `direct_messages_created_at_idx` (created_at)

### `follows`

| Column | Type | Null | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | uuid | no | `gen_random_uuid()` | primary key |
| `follower_id` | uuid | no |  | → `users.id` (on delete cascade) |
| `creator_id` | uuid | no |  | → `users.id` (on delete cascade) |
| `status` | follow_status | no | `"PENDING"` |  |
| `created_at` | timestamp with time zone | no | `now()` |  |
| `decided_at` | timestamp with time zone | yes |  |  |

**Indexes:** `follows_pair_idx` (unique, follower_id, creator_id) · `follows_creator_status_idx` (creator_id, status)

### `notifications`

| Column | Type | Null | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | uuid | no | `gen_random_uuid()` | primary key |
| `user_id` | uuid | no |  | → `users.id` (on delete cascade) |
| `event` | varchar(40) | no |  |  |
| `actor_id` | uuid | yes |  | → `users.id` (on delete set null) |
| `vars` | jsonb | no | `'{}'::jsonb` |  |
| `path` | text | no |  |  |
| `read_at` | timestamp with time zone | yes |  |  |
| `created_at` | timestamp with time zone | no | `now()` |  |

**Indexes:** `notifications_user_created_idx` (user_id, created_at) · `notifications_unread_idx` (user_id, partial)

### `payment_intents`

| Column | Type | Null | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | uuid | no | `gen_random_uuid()` | primary key |
| `gateway` | payment_gateway | no |  |  |
| `gateway_session_id` | varchar(255) | yes |  |  |
| `sender_id` | uuid | yes |  | → `users.id` (on delete set null) |
| `creator_id` | uuid | no |  | → `users.id` (on delete cascade) |
| `video_id` | uuid | yes |  | → `videos.id` (on delete set null) |
| `story_id` | uuid | yes |  | → `stories.id` (on delete set null) |
| `amount_cents` | integer | no |  |  |
| `currency` | varchar(3) | no | `"USD"` |  |
| `status` | payment_intent_status | no | `"PENDING"` |  |
| `gateway_transaction_ref` | varchar(255) | yes |  |  |
| `ledger_id` | uuid | yes |  |  |
| `created_at` | timestamp with time zone | no | `now()` |  |
| `updated_at` | timestamp with time zone | no | `now()` |  |

**Indexes:** `payment_intents_sender_idx` (sender_id) · `payment_intents_status_idx` (status)

### `payout_accounts`

| Column | Type | Null | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `user_id` | uuid | no |  | primary key · → `users.id` (on delete cascade) |
| `method` | varchar(30) | no |  |  |
| `holder_name` | varchar(120) | no |  |  |
| `country` | varchar(2) | no |  |  |
| `details_encrypted` | text | no |  |  |
| `display_hint` | varchar(80) | no |  |  |
| `created_at` | timestamp with time zone | no | `now()` |  |
| `updated_at` | timestamp with time zone | no | `now()` |  |

### `payout_requests`

| Column | Type | Null | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | uuid | no | `gen_random_uuid()` | primary key |
| `creator_id` | uuid | no |  | → `users.id` (on delete cascade) |
| `amount_cents` | integer | no |  |  |
| `status` | payout_status | no | `"REQUESTED"` |  |
| `payout_method` | varchar(50) | no |  |  |
| `payout_destination` | text | no |  |  |
| `tx_hash_or_reference` | text | yes |  |  |
| `failure_reason` | text | yes |  |  |
| `reviewed_at` | timestamp with time zone | yes |  |  |
| `settled_at` | timestamp with time zone | yes |  |  |
| `created_at` | timestamp with time zone | no | `now()` |  |
| `updated_at` | timestamp with time zone | no | `now()` |  |

**Indexes:** `payout_requests_creator_status_idx` (creator_id, status)

### `playlist_audience_lists`

| Column | Type | Null | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | uuid | no | `gen_random_uuid()` | primary key |
| `playlist_id` | uuid | no |  | → `playlists.id` (on delete cascade) |
| `list_id` | uuid | no |  | → `audience_lists.id` (on delete cascade) |
| `created_at` | timestamp with time zone | no | `now()` |  |

**Indexes:** `playlist_audience_lists_unique_idx` (unique, playlist_id, list_id) · `playlist_audience_lists_list_idx` (list_id)

### `playlist_items`

| Column | Type | Null | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | uuid | no | `gen_random_uuid()` | primary key |
| `playlist_id` | uuid | no |  | → `playlists.id` (on delete cascade) |
| `video_id` | uuid | no |  | → `videos.id` (on delete cascade) |
| `position` | integer | no | `0` |  |
| `created_at` | timestamp with time zone | no | `now()` |  |

**Indexes:** `playlist_items_position_idx` (playlist_id, position) · `playlist_video_unique_idx` (unique, playlist_id, video_id)

### `playlist_members`

| Column | Type | Null | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | uuid | no | `gen_random_uuid()` | primary key |
| `playlist_id` | uuid | no |  | → `playlists.id` (on delete cascade) |
| `user_id` | uuid | no |  | → `users.id` (on delete cascade) |
| `created_at` | timestamp with time zone | no | `now()` |  |

**Indexes:** `playlist_members_unique_idx` (unique, playlist_id, user_id) · `playlist_members_user_idx` (user_id)

### `playlists`

| Column | Type | Null | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | uuid | no | `gen_random_uuid()` | primary key |
| `creator_id` | uuid | no |  | → `users.id` (on delete cascade) |
| `title` | varchar(255) | no |  |  |
| `description` | text | yes |  |  |
| `visibility` | collection_visibility | no | `"PRIVATE"` |  |
| `created_at` | timestamp with time zone | no | `now()` |  |
| `updated_at` | timestamp with time zone | no | `now()` |  |

**Indexes:** `playlists_creator_idx` (creator_id)

### `profiles`

| Column | Type | Null | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | uuid | no | `gen_random_uuid()` | primary key |
| `user_id` | uuid | no |  | unique · → `users.id` (on delete cascade) |
| `display_name` | varchar(100) | yes |  |  |
| `bio` | text | yes |  |  |
| `avatar_url` | text | yes |  |  |
| `banner_url` | text | yes |  |  |
| `website_url` | text | yes |  |  |
| `social_links` | jsonb | no | `'{}'::jsonb` |  |
| `notifications_off` | jsonb | no | `'[]'::jsonb` |  |
| `in_app_off` | jsonb | no | `'[]'::jsonb` |  |
| `email_frequency` | varchar(10) | no | `"INSTANT"` |  |
| `last_activity_email_at` | timestamp with time zone | yes |  |  |
| `direct_message_privacy` | varchar(20) | no | `"EVERYONE"` |  |
| `min_tip_amount_cents` | integer | no | `500` |  |
| `challenge_requests_off` | boolean | no | `false` |  |
| `challenge_min_cents` | integer | no | `1000` |  |
| `payout_address_crypto` | text | yes |  |  |
| `payout_account_ccbill` | varchar(100) | yes |  |  |
| `total_views` | integer | no | `0` |  |
| `total_tips_earned_cents` | integer | no | `0` |  |
| `search_vector` | tsvector | yes |  |  |
| `updated_at` | timestamp with time zone | no | `now()` |  |

**Indexes:** `profiles_search_idx` (search_vector)

### `push_devices`

| Column | Type | Null | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | uuid | no | `gen_random_uuid()` | primary key |
| `user_id` | uuid | no |  | → `users.id` (on delete cascade) |
| `token` | varchar(255) | no |  |  |
| `platform` | varchar(10) | no |  |  |
| `created_at` | timestamp with time zone | no | `now()` |  |
| `last_seen_at` | timestamp with time zone | no | `now()` |  |

**Indexes:** `push_devices_token_idx` (unique, token) · `push_devices_user_idx` (user_id)

### `rate_limit_buckets`

| Column | Type | Null | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `key` | varchar(200) | no |  | primary key |
| `count` | integer | no | `0` |  |
| `reset_at` | timestamp with time zone | no |  |  |

**Indexes:** `rate_limit_buckets_reset_at_idx` (reset_at)

### `storage_alerts`

| Column | Type | Null | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `threshold` | integer | no |  | primary key |
| `alerted_at` | timestamp with time zone | no | `now()` |  |
| `used_bytes` | bigint | no |  |  |
| `limit_bytes` | bigint | no |  |  |

### `storage_snapshots`

| Column | Type | Null | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | uuid | no | `gen_random_uuid()` | primary key |
| `taken_at` | timestamp with time zone | no | `now()` |  |
| `library_bytes` | bigint | no |  |  |
| `library_videos` | integer | no |  |  |
| `library_seconds` | integer | no | `0` |  |
| `zone_bytes` | bigint | yes |  |  |
| `zone_files` | integer | yes |  |  |
| `app_bytes` | bigint | no |  |  |
| `orphan_bytes` | bigint | no | `0` |  |
| `orphan_videos` | integer | no | `0` |  |
| `missing_videos` | integer | no | `0` |  |
| `updated_rows` | integer | no | `0` |  |
| `details` | jsonb | no | `'{}'::jsonb` |  |

**Indexes:** `storage_snapshots_taken_at_idx` (taken_at)

### `stories`

| Column | Type | Null | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | uuid | no | `gen_random_uuid()` | primary key |
| `creator_id` | uuid | no |  | → `users.id` (on delete cascade) |
| `media_type` | varchar(20) | no | `"IMAGE"` |  |
| `bunny_video_id` | varchar(120) | yes |  |  |
| `media_url` | text | yes |  |  |
| `thumbnail_url` | text | yes |  |  |
| `caption` | varchar(280) | yes |  |  |
| `visibility` | video_visibility | no | `"PUBLIC"` |  |
| `audience_list_id` | uuid | yes |  | → `audience_lists.id` (on delete set null) |
| `content_rating_id` | varchar(30) | yes |  | → `content_ratings.id` (on delete set null) |
| `is_blurred` | boolean | no | `false` |  |
| `status` | video_status | no | `"READY"` |  |
| `duration_seconds` | integer | no | `0` |  |
| `storage_bytes` | bigint | no | `0` |  |
| `views_count` | integer | no | `0` |  |
| `likes_count` | integer | no | `0` |  |
| `tips_count` | integer | no | `0` |  |
| `expires_at` | timestamp with time zone | no |  |  |
| `removed_at` | timestamp with time zone | yes |  |  |
| `search_vector` | tsvector | yes |  |  |
| `created_at` | timestamp with time zone | no | `now()` |  |
| `updated_at` | timestamp with time zone | no | `now()` |  |

**Indexes:** `stories_creator_idx` (creator_id) · `stories_expires_at_idx` (expires_at) · `stories_created_at_idx` (created_at) · `stories_search_idx` (search_vector) · `stories_bunny_video_idx` (unique, bunny_video_id, partial)

### `story_likes`

| Column | Type | Null | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | uuid | no | `gen_random_uuid()` | primary key |
| `story_id` | uuid | no |  | → `stories.id` (on delete cascade) |
| `user_id` | uuid | no |  | → `users.id` (on delete cascade) |
| `created_at` | timestamp with time zone | no | `now()` |  |

**Indexes:** `story_likes_unique_idx` (unique, story_id, user_id)

### `story_views`

| Column | Type | Null | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | uuid | no | `gen_random_uuid()` | primary key |
| `story_id` | uuid | no |  | → `stories.id` (on delete cascade) |
| `viewer_id` | uuid | yes |  | → `users.id` (on delete cascade) |
| `viewer_key` | varchar(80) | no |  |  |
| `viewed_at` | timestamp with time zone | no | `now()` |  |

**Indexes:** `story_views_story_viewer_idx` (story_id, viewer_id) · `story_views_once_idx` (unique, story_id, viewer_key)

### `tips_ledger`

| Column | Type | Null | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | uuid | no | `gen_random_uuid()` | primary key |
| `entry_type` | ledger_entry_type | no |  |  |
| `sender_id` | uuid | yes |  | → `users.id` (on delete set null) |
| `creator_id` | uuid | no |  | → `users.id` (on delete cascade) |
| `video_id` | uuid | yes |  | → `videos.id` (on delete set null) |
| `story_id` | uuid | yes |  | → `stories.id` (on delete set null) |
| `gross_amount_cents` | integer | no |  |  |
| `platform_fee_cents` | integer | no | `0` |  |
| `net_amount_cents` | integer | no |  |  |
| `gateway` | payment_gateway | no |  |  |
| `gateway_transaction_ref` | varchar(255) | no |  |  |
| `note` | text | yes |  |  |
| `created_at` | timestamp with time zone | no | `now()` |  |

**Indexes:** `tips_ledger_creator_idx` (creator_id) · `tips_ledger_sender_idx` (sender_id) · `tips_ledger_video_idx` (video_id) · `tips_ledger_story_idx` (story_id) · `tips_ledger_created_at_idx` (created_at) · `tips_ledger_credit_once_idx` (unique, gateway, gateway_transaction_ref, partial)

### `user_invitations`

| Column | Type | Null | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | uuid | no | `gen_random_uuid()` | primary key |
| `inviter_id` | uuid | no |  | → `users.id` (on delete cascade) |
| `email` | varchar(255) | no |  |  |
| `code` | varchar(64) | no |  | unique |
| `status` | varchar(20) | no | `"PENDING"` |  |
| `expires_at` | timestamp with time zone | no |  |  |
| `accepted_at` | timestamp with time zone | yes |  |  |
| `created_at` | timestamp with time zone | no | `now()` |  |

**Indexes:** `user_invitations_inviter_idx` (inviter_id) · `user_invitations_email_idx` (email) · `user_invitations_code_idx` (code)

### `users`

| Column | Type | Null | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | uuid | no | `gen_random_uuid()` | primary key |
| `email` | varchar(255) | no |  | unique |
| `username` | varchar(50) | no |  | unique |
| `password_hash` | text | no |  |  |
| `role` | user_role | no | `"MEMBER"` |  |
| `is_verified` | boolean | no | `false` |  |
| `is_age_verified` | boolean | no | `false` |  |
| `date_of_birth` | date | yes |  |  |
| `email_verified_at` | timestamp with time zone | yes |  |  |
| `suspended_at` | timestamp with time zone | yes |  |  |
| `suspension_reason` | text | yes |  |  |
| `storage_plan` | varchar(40) | yes |  |  |
| `created_at` | timestamp with time zone | no | `now()` |  |
| `updated_at` | timestamp with time zone | no | `now()` |  |

### `video_access_grants`

| Column | Type | Null | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | uuid | no | `gen_random_uuid()` | primary key |
| `video_id` | uuid | no |  | → `videos.id` (on delete cascade) |
| `user_id` | uuid | no |  | → `users.id` (on delete cascade) |
| `granted_via` | varchar(50) | no | `"TIP_PAYMENT"` |  |
| `can_download` | boolean | no | `false` |  |
| `amount_paid_cents` | integer | no |  |  |
| `transaction_ref` | text | no |  |  |
| `created_at` | timestamp with time zone | no | `now()` |  |

**Indexes:** `video_access_user_idx` (unique, video_id, user_id)

### `video_audience_lists`

| Column | Type | Null | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | uuid | no | `gen_random_uuid()` | primary key |
| `video_id` | uuid | no |  | → `videos.id` (on delete cascade) |
| `list_id` | uuid | no |  | → `audience_lists.id` (on delete cascade) |
| `created_at` | timestamp with time zone | no | `now()` |  |

**Indexes:** `video_audience_lists_unique_idx` (unique, video_id, list_id) · `video_audience_lists_list_idx` (list_id)

### `video_comments`

| Column | Type | Null | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | uuid | no | `gen_random_uuid()` | primary key |
| `video_id` | uuid | no |  | → `videos.id` (on delete cascade) |
| `author_id` | uuid | no |  | → `users.id` (on delete cascade) |
| `parent_id` | uuid | yes |  | → `video_comments.id` (on delete cascade) |
| `body` | text | no |  |  |
| `created_at` | timestamp with time zone | no | `now()` |  |
| `edited_at` | timestamp with time zone | yes |  |  |
| `removed_at` | timestamp with time zone | yes |  |  |
| `removed_by` | uuid | yes |  | → `users.id` (on delete set null) |

**Indexes:** `video_comments_video_created_idx` (video_id, created_at) · `video_comments_parent_idx` (parent_id)

### `video_drafts`

| Column | Type | Null | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | uuid | no | `gen_random_uuid()` | primary key |
| `owner_id` | uuid | no |  | → `users.id` (on delete cascade) |
| `kind` | varchar(10) | no |  |  |
| `bunny_video_id` | varchar(120) | no |  |  |
| `status` | video_status | no | `"PENDING_UPLOAD"` |  |
| `file_name` | varchar(255) | no |  |  |
| `content_type` | varchar(100) | no |  |  |
| `size_bytes` | bigint | no |  |  |
| `duration_seconds` | integer | no | `0` |  |
| `storage_bytes` | bigint | no | `0` |  |
| `edit` | jsonb | no |  |  |
| `details` | jsonb | no | `'{}'::jsonb` |  |
| `music_ref` | text | yes |  |  |
| `music_name` | varchar(255) | yes |  |  |
| `expires_at` | timestamp with time zone | no |  |  |
| `created_at` | timestamp with time zone | no | `now()` |  |
| `updated_at` | timestamp with time zone | no | `now()` |  |

**Indexes:** `video_drafts_owner_idx` (owner_id, updated_at) · `video_drafts_expires_at_idx` (expires_at) · `video_drafts_bunny_video_idx` (unique, bunny_video_id)

### `video_likes`

| Column | Type | Null | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | uuid | no | `gen_random_uuid()` | primary key |
| `video_id` | uuid | no |  | → `videos.id` (on delete cascade) |
| `user_id` | uuid | no |  | → `users.id` (on delete cascade) |
| `created_at` | timestamp with time zone | no | `now()` |  |

**Indexes:** `video_likes_once_idx` (unique, video_id, user_id) · `video_likes_user_idx` (user_id)

### `video_shares`

| Column | Type | Null | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | uuid | no | `gen_random_uuid()` | primary key |
| `video_id` | uuid | no |  | → `videos.id` (on delete cascade) |
| `user_id` | uuid | yes |  | → `users.id` (on delete set null) |
| `channel` | share_channel | no | `"LINK"` |  |
| `created_at` | timestamp with time zone | no | `now()` |  |

**Indexes:** `video_shares_video_idx` (video_id)

### `video_viewers`

| Column | Type | Null | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | uuid | no | `gen_random_uuid()` | primary key |
| `video_id` | uuid | no |  | → `videos.id` (on delete cascade) |
| `user_id` | uuid | no |  | → `users.id` (on delete cascade) |
| `created_at` | timestamp with time zone | no | `now()` |  |

**Indexes:** `video_viewers_unique_idx` (unique, video_id, user_id) · `video_viewers_user_idx` (user_id)

### `video_views`

| Column | Type | Null | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | uuid | no | `gen_random_uuid()` | primary key |
| `video_id` | uuid | no |  | → `videos.id` (on delete cascade) |
| `viewer_id` | uuid | yes |  | → `users.id` (on delete set null) |
| `viewer_key` | varchar(80) | no |  |  |
| `viewed_on` | date | no | `now()` |  |
| `created_at` | timestamp with time zone | no | `now()` |  |

**Indexes:** `video_views_once_per_day_idx` (unique, video_id, viewer_key, viewed_on) · `video_views_video_day_idx` (video_id, viewed_on)

### `videos`

| Column | Type | Null | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | uuid | no | `gen_random_uuid()` | primary key |
| `creator_id` | uuid | no |  | → `users.id` (on delete cascade) |
| `bunny_video_id` | varchar(120) | no |  | unique |
| `title` | varchar(255) | no |  |  |
| `description` | text | yes |  |  |
| `visibility` | video_visibility | no | `"PUBLIC"` |  |
| `status` | video_status | no | `"PENDING_UPLOAD"` |  |
| `min_tip_amount_cents` | integer | no | `0` |  |
| `duration_seconds` | integer | no | `0` |  |
| `storage_bytes` | bigint | no | `0` |  |
| `thumbnail_url` | text | yes |  |  |
| `preview_animation_url` | text | yes |  |  |
| `views_count` | integer | no | `0` |  |
| `tips_count` | integer | no | `0` |  |
| `likes_count` | integer | no | `0` |  |
| `comments_count` | integer | no | `0` |  |
| `shares_count` | integer | no | `0` |  |
| `comments_enabled` | boolean | no | `true` |  |
| `content_rating_id` | varchar(30) | yes |  | → `content_ratings.id` (on delete set null) |
| `is_blurred` | boolean | no | `false` |  |
| `resolutions` | text[] | yes |  |  |
| `tags` | text[] | yes |  |  |
| `removed_at` | timestamp with time zone | yes |  |  |
| `removal_reason` | text | yes |  |  |
| `search_vector` | tsvector | yes |  |  |
| `created_at` | timestamp with time zone | no | `now()` |  |
| `updated_at` | timestamp with time zone | no | `now()` |  |

**Indexes:** `videos_creator_idx` (creator_id) · `videos_visibility_idx` (visibility) · `videos_status_idx` (status) · `videos_created_at_idx` (created_at) · `videos_search_idx` (search_vector) · `videos_tags_idx` (tags)

### `wallet_ledger`

| Column | Type | Null | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | uuid | no | `gen_random_uuid()` | primary key |
| `user_id` | uuid | no |  | → `users.id` (on delete cascade) |
| `entry_type` | wallet_entry_type | no |  |  |
| `amount_cents` | integer | no |  |  |
| `reference` | varchar(120) | no |  |  |
| `note` | text | yes |  |  |
| `created_at` | timestamp with time zone | no | `now()` |  |

**Indexes:** `wallet_ledger_user_idx` (user_id, created_at) · `wallet_ledger_reference_idx` (unique, reference)

## Enums

| Enum | Values |
| :--- | :--- |
| `auction_bid_status` | `LEADING`, `OUTBID`, `WON`, `RELEASED` |
| `auction_rights` | `WATCH`, `DOWNLOAD` |
| `auction_settlement` | `CREATOR_DECIDES`, `HIGHEST_BID` |
| `auction_status` | `OPEN`, `AWAITING_DECISION`, `SOLD`, `DECLINED`, `UNSOLD`, `CANCELLED` |
| `auth_provider` | `GOOGLE`, `FACEBOOK` |
| `auth_token_purpose` | `VERIFY_EMAIL`, `RESET_PASSWORD` |
| `challenge_application_status` | `PENDING`, `CHOSEN`, `NOT_CHOSEN`, `WITHDRAWN` |
| `challenge_deliverable` | `VIDEO`, `STORY` |
| `challenge_kind` | `GOAL`, `REQUEST`, `OPEN_CALL` |
| `challenge_pledge_status` | `HELD`, `PAID`, `RELEASED` |
| `challenge_reward` | `BACKERS`, `EVERYONE` |
| `challenge_status` | `OPEN`, `ACCEPTED`, `DELIVERED`, `DECLINED`, `EXPIRED`, `FAILED`, `CANCELLED` |
| `collection_visibility` | `PUBLIC`, `APPROVED_FOLLOWERS_ONLY`, `CONTACTS_ONLY`, `INVITED_ONLY`, `PRIVATE` |
| `contact_status` | `PENDING`, `ACCEPTED`, `REJECTED`, `BLOCKED` |
| `follow_status` | `PENDING`, `APPROVED` |
| `ledger_entry_type` | `TIP_RECEIVED`, `PLATFORM_FEE`, `CREATOR_CREDIT`, `PAYOUT_REQUESTED`, `PAYOUT_COMPLETED`, `REFUND` |
| `payment_gateway` | `CCBILL`, `SEGPAY`, `CRYPTO`, `STRIPE`, `CREDITS` |
| `payment_intent_status` | `PENDING`, `SUCCEEDED`, `FAILED` |
| `payout_status` | `REQUESTED`, `UNDER_REVIEW`, `PROCESSING`, `SETTLED`, `FAILED` |
| `report_reason` | `NON_CONSENSUAL`, `UNDERAGE`, `DMCA_COPYRIGHT`, `TERMS_VIOLATION`, `FRAUD_SCAM` |
| `report_status` | `OPEN`, `IN_REVIEW`, `RESOLVED` |
| `share_channel` | `LINK`, `X`, `WHATSAPP`, `TELEGRAM`, `EMAIL`, `OTHER` |
| `user_role` | `ADMIN`, `CREATOR`, `MEMBER` |
| `video_status` | `PENDING_UPLOAD`, `PROCESSING`, `READY`, `FAILED`, `HELD` |
| `video_visibility` | `PUBLIC`, `CONTACTS_ONLY`, `APPROVED_FOLLOWERS_ONLY`, `TIPPED_UNLOCKED`, `INVITED_ONLY`, `AUCTION`, `CHALLENGE` |
| `wallet_entry_type` | `TOPUP`, `SPEND`, `REFUND`, `ADJUSTMENT`, `HOLD`, `RELEASE` |

## Migrations

- `0000_initial_schema.sql`
- `0001_challenges.sql`
- `0002_push_devices.sql`
- `0003_story_engagement.sql`
- `0004_explore_search.sql`
- `0005_storage_quotas_abuse.sql`
