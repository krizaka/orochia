# 🪶 Creator onboarding

There is **one kind of account** on Orochia. Everyone joins as a member (a fan): watch, follow, tip, unlock, bid, back
challenges, message. Publishing is a **change of role of that same account** — "Open your creator space" — followed by
the identity and age review that 18 U.S.C. § 2257 requires before anything is published. Nobody is asked to sign up
twice, and a signed-in person is never sent to the sign-up form.

This page describes the journey **as the code implements it** (`apps/web/lib/creator-journey.ts`,
`apps/web/app/creator/apply/page.tsx`, `apps/web/app/api/me/become-creator/route.ts`, the operator console's
`/compliance`), including what is not built yet.

---

## 1. The states of an account

```states
state VISITOR: not signed in
state UNCONFIRMED: account created, e-mail not confirmed yet
state MEMBER: a fan (role MEMBER)
state CREATOR_PENDING: creator space opened, 2257 review pending (CREATOR, is_verified = false)
state CREATOR: verified creator (CREATOR, is_verified = true)
state SUSPENDED: suspended by an operator (suspended_at set)
start -> VISITOR: opens orochia.com
VISITOR -> UNCONFIRMED: signs up (date of birth checked 18+, certification, terms)
UNCONFIRMED -> MEMBER: follows the link e-mailed to them
MEMBER -> CREATOR_PENDING: opens a creator space (POST /api/me/become-creator)
CREATOR_PENDING -> CREATOR: an operator approves the records (console → 2257 verification)
CREATOR -> CREATOR_PENDING: an operator withdraws the verification (console → creator registry)
MEMBER -> SUSPENDED: an operator suspends the account
CREATOR_PENDING -> SUSPENDED: an operator suspends the account
CREATOR -> SUSPENDED: an operator suspends the account
SUSPENDED -> MEMBER: an operator reinstates a member
SUSPENDED -> CREATOR_PENDING: an operator reinstates a pending creator (role and review kept)
SUSPENDED -> CREATOR: an operator reinstates a verified creator (role and verification kept)
MEMBER -> CREATOR_PENDING: an operator sets the role directly (console → users) — the review still applies
```

The state is read from the database on every page that shows a next step (`lib/viewer.ts` → `viewerStateOf`): the
session cookie only says who is signed in. A member who opens a creator space, or a creator an operator has just
approved, sees the right next step on the next page they open. The platform owner (`ADMIN`) is created verified and
counts as a verified creator.

An operator can also make a member a creator directly (console → Users, `PATCH /api/admin/users/:id` `set-role`): the
account then waits for the 2257 review like everyone else (`is_verified` is set to `false` — an account created by
sign-up starts with `true`, which means "no review pending", so without this it would publish at once).

| State | Database | What the person can do |
| :--- | :--- | :--- |
| Visitor | — | Watch what is public, explore, read profiles; sign up or sign in |
| Unconfirmed | `users.email_verified_at` null | Only confirm the e-mail (or ask for the link again) and sign out; the API refuses everything else |
| Member | `role = MEMBER` | Watch, follow, contacts, messages, tip, unlock, buy credits, bid, pledge, dare, collections, lists |
| Creator, pending | `role = CREATOR`, `is_verified = false` | Everything a member does, **plus** edit the profile as a creator page and save a payout account. **No** uploads: videos, stories and editor drafts are refused (`403 … pending`); no goals, no dares received, no open-call applications; not listed in Explore |
| Creator, verified | `role = CREATOR`, `is_verified = true` | Everything above, **plus** upload videos and stories, auctions, goals, dares, open calls, earnings and payouts; listed in Explore once something public is ready |
| Suspended | `users.suspended_at` set | Cannot sign in; an open session is refused by every API call; their videos are not listed, open auctions and challenges are cancelled |

## 2. "Become a creator" — what it does

`POST /api/me/become-creator` (signed in, e-mail confirmed):

1. **Same account.** No new account, no new password, nothing to fill in again. The role goes `MEMBER → CREATOR` and
   `is_verified` is set to `false` — the 2257 review is now pending. Followers, contacts, credits, purchases and
   messages stay where they are.
2. **18+ again, on record.** It is refused (`403`, code `BIRTH_DATE_REQUIRED`) when the account has no recorded date of
   birth (an account completed before the date was asked for adds it in Settings — `/api/me/birth-date` fills a
   missing one, never rewrites it).
3. **Nothing is published, nothing is charged.** It only opens the door to the review.
4. Idempotent: a creator or the owner calling it again gets their current role back.

## 3. The checks, and why

| Check | When | Why | Where it lives |
| :--- | :--- | :--- | :--- |
| **Date of birth, 18+** | Sign-up (and Google / Facebook completion); required again before opening a creator space | Orochia is adults-only; a ticked box is not enough, the server computes the age | `checkDateOfBirth` (`lib/profile.ts`) → `users.date_of_birth` — private, never shown |
| **18+ certification and terms** | Sign-up | The person states they are an adult and accepts the terms | Validated by the API (`isAgeVerified`, `acceptTerms` must be `true`) → `users.is_age_verified`. The acceptance itself is **not** stored as a dated record yet |
| **E-mail confirmed** | Before anything but the confirmation page | One reachable person per account; reviews and payouts write to it | `users.email_verified_at` |
| **Identity and age records (18 U.S.C. § 2257)** | Between opening the creator space and the first upload | US law requires the producer of sexually explicit content to verify and keep proof that every performer is an adult, before publishing | Operator console → **2257 Creator Verification** (`/compliance`) → `PATCH /api/admin/creators/:id` → `users.is_verified`. Checked by `create-upload-session`, `stories` and `video-drafts` on every upload |
| **Per-upload declarations** | Every upload | The creator confirms the people shown are adults, consented, and that the records are kept | A required step of the upload form (client side); not stored per video yet |
| **Payout account** | Before the first payout (minimum $20) | Earnings go to a verified destination only | `payout_accounts`, validated like a bank would (IBAN mod-97, ABA) and **encrypted at rest** (AES-256-GCM, `PAYMENTS_PAYOUT_ENCRYPTION_KEY`); the creator only sees a masked hint |

### What is not built yet

- **No in-app document submission.** The upload API accepts a private `documents` category (stored under
  `private/documents/…`, readable only by operators through `/api/admin/documents`), but no screen sends it: today
  the operator reviews the records by hand and writes to the creator's address. The application page says exactly
  that. An identity-verification provider (ID + liveness: Veriff, Yoti, Onfido…) wired to this flow and to the
  operator queue is [issue #34](https://github.com/krizaka/orochia/issues/34).
- **No co-performer consent records.** Records cover the account holder; releases for other people in a video are
  not modelled.
- **The legal pack** — custodian of records, legal entity on the 2257 statement, age-assurance per jurisdiction — is
  [issue #33](https://github.com/krizaka/orochia/issues/33). Tax forms for payouts: [issue #42](https://github.com/krizaka/orochia/issues/42).
- **No notification on approval** yet: the creator finds the studio open on their next visit.

## 4. Who sees what

| Who | Sees |
| :--- | :--- |
| **The person** | Their state on `/creator/apply` (the steps, the review, what they can do meanwhile), a banner on the dashboard while they are a member or pending, the next step under every empty list |
| **Everyone** | A creator's profile, with "Verified creator" or "Verification in progress" in its About tab. A pending creator is never in Explore (`lib/discoverable.ts`: verified, active, with something public) |
| **Operators** | The verification queue and the creator registry in the console, the 18+ flag and 2257 state per account, private documents when there are some, a payout request's decrypted destination |
| **Nobody** | The date of birth, the e-mail address, a payout account in full (outside the operator's payout review) |

## 5. Where each viewer is sent

One rule for every call to action (`creatorSpaceCta`, `feedEmptyActions` in `lib/creator-journey.ts`, unit-tested and
checked end to end in `e2e/scenarios.mjs`): **a signed-in person never meets the sign-up form**.

| Viewer | "Publish" leads to | The empty home feed offers | An empty Contacts tab offers |
| :--- | :--- | :--- | :--- |
| Visitor | Sign up → back to the creator application (`/auth/register?next=/creator/apply`, kept through the e-mail confirmation) | Create a free account · Become a creator | Sign in to see them |
| Member | **Open your creator space** → `/creator/apply` (this account) | Explore creators · Open your creator space | Find people · Your network |
| Creator, pending | **See your verification status** → `/creator/apply` | Explore creators · See your verification status | Find people · Your network |
| Creator, verified | **Upload a video** → `/creator/upload` | Upload a video · Explore creators | Find people · Your network |
| Suspended | — | Nothing to do: contact the operator | — |

- `/creator/apply`: a visitor is sent to sign up first; a member sees the steps and the button; a pending creator the
  status of the review; a verified creator goes straight to the studio (`/dashboard?tab=uploads`).
- `/creator/upload`: verified creators only; a member or a pending creator lands on `/creator/apply`.
- `/auth/register` and `/auth/login` send a signed-in person on to `next` at once, and pass `next` to each other.
- The top bar shows nothing in place of the account while the session is read — never "Join" for a second.
- When the feed cannot be read (the database does not answer), the home says so ("The feed could not load") instead of
  "no video yet".

### Why a feed can be empty

The home feed lists videos that are encoded (`READY`), not taken down, not invited-only, from accounts that are not
suspended (`listFeed`, `lib/queries.ts`). A database rebuilt from the migrations (the dev deployment was on
2026-10-08) has none until a verified creator publishes one — the empty state then speaks to whoever is looking.
