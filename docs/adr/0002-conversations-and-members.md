# ADR 0002 — Conversations and members (1:1 and groups)

**Status**: proposed (2026-10-17) · **Scope**: Orochia web + mobile · **Issue**: krizaka/orochia#260 · **Builds on**: ADR 0001 (SSE, one stream per user)

## Context

Messaging is strictly 1:1. `conversations` holds `participant1_id` / `participant2_id`; `direct_messages` holds one
`recipient_id` and the receipts (`delivered_at`, `is_read`, `read_at`) on the message row. A group (≤ 50 people, roles,
invites, mute, leave, report, moderation) cannot be expressed: a message has many recipients, and a receipt is per member.

## Decision

**A conversation has members; a message has a sender; receipts are cursors on the member.**

| Table | Columns (new or changed) |
| :--- | :--- |
| `conversations` | `kind` (`direct` \| `group`), `title`, `avatar_url`, `created_by`, `direct_key` (sorted `idA:idB`, unique, only for `direct`), `archived_at`. `participant1_id` / `participant2_id` are dropped. |
| `conversation_members` | `conversation_id`, `user_id` (unique pair), `role` (`owner` \| `member`), `muted_until`, `joined_at`, `left_at`, `last_delivered_seq`, `last_read_seq`. A row with `left_at` stays (history, reports). |
| `messages` (was `direct_messages`) | `recipient_id`, `delivered_at`, `is_read`, `read_at` are dropped. `origin` (`human` \| `ai_assisted`, migration 0013) and `story_id` stay. Later: `kind` (`text` \| `reaction` \| `image` \| `video_link`). |
| `conversation_invites` | `conversation_id`, `token_hash`, `created_by`, `expires_at` (7 days), `max_uses`, `uses`, `revoked_at`. Only the hash is stored. |

Receipts: *delivered* = the member's `last_delivered_seq >= seq`; *read* = `last_read_seq >= seq`. In a 1:1 the sender
sees the other member's cursors (today's ticks, unchanged); in a group the sender sees "read by n". The unread count is
`count(messages where seq > last_read_seq and sender <> me)`, kept by the `unread` event.

### Rules

- **Create**: any verified account may create a private group with people it may already message (accepted contacts), up
  to **50 members**; a verified creator may open a **fan group** whose joiners must have an *approved follow*. Adding or
  joining never bypasses blocks (a blocked pair cannot share a new group; an existing share is flagged to the owner).
- **Roles**: `owner` (rename, invite, remove, close, transfer) and `member`. A group always has one owner; the owner
  leaving must transfer first, or the group is archived when alone.
- **Invites**: a link `/messages/join/<token>`, 7 days, revocable, `max_uses` ≤ remaining seats; joining runs the same
  rules as adding.
- **Mute** is per member (`muted_until`): no push, no badge increment toward the tab, messages still arrive.
- **Leave** sets `left_at`; the stream stops delivering the conversation; a rejoin needs a new invite.
- **Report / moderation**: reports reference `message_id` + `conversation_id`; the admin console lists group reports and
  can remove a message, remove a member, or archive a group. Moderation reads only reported messages and their
  neighbours (±10), never a whole group.
- **Presence stays 1:1**: a group never widens the presence circle (`lib/presence-rules.ts`: contact, exchange or
  approved follow). 50 strangers in a group do not see each other online.

### Realtime (one SSE per user, issue #158)

Unchanged transport: a user holds **one** stream; events carry `conversationId`. Fan-out of a group message is one
publish with the member list (≤ 50 ids, ~2 KB, within PostgreSQL's 8 KB NOTIFY payload) instead of 50 notifies; each
instance filters by the users it holds. No per-conversation channel, no per-conversation listener connection.

### Migration (one forward migration, no compatibility layer)

1. Create `conversation_members`: two rows per existing conversation (`role member`, `joined_at = created_at`).
2. Backfill `last_read_seq` = highest `seq` of messages the member received that are `is_read`, else the lowest seq − 1;
   `last_delivered_seq` from `delivered_at`.
3. Set `kind = 'direct'`, `direct_key` from the two ids.
4. Drop the replaced columns. A rehearsal on a restored dump is part of the PR (counts of conversations, messages and
   unread per user must be equal before and after).

### Authorisation

Every conversation route resolves `member(conversation, user, left_at is null)` first; a non-member gets **404**, never
403 (a group's existence is not disclosed). Sending requires membership and the block rules for 1:1.
Rate limits: messages per member per minute (existing), group creations per day, invite creations per hour, joins per
hour per IP.

## Consequences

- One query shape for list, unread and receipts; groups cost one row per member, not per message.
- A bigger migration than adding columns, but no dual model to keep.
- Receipts cost nothing extra per message (cursors), where per-message-per-member would grow with group size.
- Risk: the 1:1 receipts code (`lib/messaging.ts`, `chat-state.ts`, mobile `chat.ts`) is rewritten around cursors —
  covered by the existing e2e scenarios (kept green) plus new ones for groups.

## Slices

1. Schema + migration + 1:1 on members (no visible change; e2e unchanged).
2. Groups API (create, add, invite, join, leave, mute, remove) with authz and rate-limit tests.
3. Web + mobile UI (members, mute, leave, invite, report).
4. Admin console: group reports and actions.
