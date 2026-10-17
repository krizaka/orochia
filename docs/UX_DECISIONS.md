# UX decisions — why it is built like this

Each notable choice of experience in Orochia: the decision, the problem, the principle behind it (with its source),
what was refused, what it costs, and the signal that would tell us we are wrong. Only choices that exist in the code are
written here, each with the place that carries it. Disagree, or saw that signal? Say it in
[the UX feedback discussion](https://github.com/krizaka/orochia/discussions/134) (live updates, notifications and push:
[#122](https://github.com/krizaka/orochia/discussions/122)). How Orochia is made usable by everyone is in
[ACCESSIBILITY.md](ACCESSIBILITY.md).

---

## The 18+ gate comes first, and leaving is one tap

- **Decision** — On a first visit (web) or a fresh install (app), nothing of Orochia shows before a full-screen question:
  *I am 18 or older — enter* or, on the web, *leave* (in the app, closing it is the way out). It cannot be dismissed (no
  Escape, no click outside, no close button); the answer is remembered on the device. The terms are one link away.
  (`apps/web/components/AgeVerificationModal.tsx`; the app's `AgeGate`.)
- **Problem** — Adult content must not reach a minor or someone who did not choose it; a banner that can be closed, or a
  gate after the first thumbnails, is a gate in name only.
- **Principle** — An explicit, informed choice before exposure, and user control: the way out is as visible as the way in
  ("user control and freedom", Nielsen's heuristic #3, 1994). Defaults decide for people who do not decide (Johnson &
  Goldstein, *Science* 2003): here nothing is shown by default.
- **Refused** — A dismissible banner; showing blurred content behind the gate; asking a date of birth at the door (it
  adds typing, not truth — the date is asked once, at sign-up, and checked by the server).
- **Cost** — One more screen before anything, on every new device.
- **Signal we are wrong** — A high share of first visits that leave at the gate *and* come back from the same source,
  or feedback that the gate reads as a trap rather than a question.
- **Feedback** — wrong for you? [Discussion #134](https://github.com/krizaka/orochia/discussions/134).

## Create an account in the app, not "on orochia.com"

- **Decision** — *Create an account* on the phone's sign-in screen opens the sign-up form in the app — the same API and
  rules as the web (username checked as it is typed, a free one offered, 18+ date checked by the server, terms) — then
  *Check your inbox*: the account exists and is signed in, waiting for the confirmed address. (`docs/MOBILE.md`
  "Create an account"; orochia-mobile `src/app/auth/sign-up.tsx`.)
- **Problem** — "Create one on orochia.com" sent people to a browser, then asked them to come back and sign in: two
  contexts, two passwords typed, and many never came back.
- **Principle** — Interrupting a task to switch context costs time to resume, and part of the tasks are never resumed
  (Iqbal & Horvitz, CHI 2007; Mark, Gudith & Klocke, CHI 2008). Errors shown on the field where they happen, as you type,
  rather than after submitting (Nielsen's heuristic #5, error prevention).
- **Refused** — A web view of the site's form (cookies, keyboard and autofill break); a shorter form on the phone with
  rules of its own.
- **Cost** — Two forms to keep in step (the server holds the rules, both forms show its refusals on their fields).
- **Signal we are wrong** — Sign-ups started in the app that stop at *Check your inbox* far more often than on the web.
- **Feedback** — wrong for you? [Discussion #134](https://github.com/krizaka/orochia/discussions/134).

## Never "live", never a profile that does not exist

- **Decision** — Orochia has no live streaming, so no screen says "live": an auction is *open* or *ending*, a status
  pulses as *active* (`StatusBadge`, never "live"), the auctions tab is `?tab=open`. The home shows only what the database
  or the platform's rules produce — no invented creator, count or earnings; the phone on the home replays real app flows
  on licensed stock clips with no name on them. (`AGENTS.md` §6; `components/home/GetPaid.tsx`: "nothing pretends to be
  someone's earnings".)
- **Problem** — Adult platforms are full of "LIVE" badges and fake activity; a visitor who finds one false claim stops
  believing the rest — including the 90 % share and the escrow.
- **Principle** — Credibility: a single detected exaggeration or unverifiable claim lowers trust in the whole site
  (Fogg et al., "What makes Web sites credible?", CHI 2001); people weigh losses — here, the risk of being fooled — more
  than equal gains (Kahneman & Tversky, *Econometrica* 1979).
- **Refused** — "LIVE" badges on auctions; seeded "top creators" or fake counters on the home.
- **Cost** — An early home looks quieter than the competition's.
- **Signal we are wrong** — Feedback that people expected live streaming from what they saw, or a home judged "empty"
  by visitors who then leave without opening a video.
- **Feedback** — wrong for you? [Discussion #134](https://github.com/krizaka/orochia/discussions/134).

## The creator's share is written before anything else

- **Decision** — The split is stated up front, before any sign-up: "Creators keep 90 %" in the home's first screens,
  "Of every payment, the creator keeps 90 % and Orochia 10 %" with a worked example per way of being paid (tip, unlock,
  winning bid, pledge) computed from the platform's own rule. The number is never typed: it comes from
  `PAYMENTS_PLATFORM_FEE_PERCENTAGE` (10 by default) through `splitPlatformFee`. (`components/home/GetPaid.tsx`.)
- **Problem** — Creators compare platforms on what they keep, and fans give more when they know where the money goes;
  a fee found at payout reads as a hidden charge.
- **Principle** — Price transparency: fees revealed late (drip pricing) are felt as a loss and lower trust and
  satisfaction (Blake, Moshary, Sweeney & Tadelis, "Price Salience and Product Choice", *Marketing Science* 2021);
  a concrete worked example is understood where a percentage alone is not (Gigerenzer & Hoffrage, *Psychological
  Review* 1995, on natural frequencies).
- **Refused** — The fee in the terms only; a "from 80 %" headline with conditions.
- **Cost** — The fee is public and easy to compare; changing it means changing every page that shows it (they read the
  same variable).
- **Signal we are wrong** — Creator applications or support questions that still ask "how much do you take?", or fans
  surprised by the split after paying.
- **Feedback** — wrong for you? [Discussion #134](https://github.com/krizaka/orochia/discussions/134).

## A tip or an unlock is one dialog, with the creator's price already chosen

- **Decision** — *Send a tip* or *Unlock* opens one dialog where the amount starts at the creator's own price, selected
  (an $8 unlock offers $8 first, then the usual steps), credits are the first way to pay, and only the ways this
  deployment really offers are listed. Short of credits, the dialog says the balance and offers to add some; a card goes
  to the provider's checkout, so card details never reach Orochia ("Discreet billing"). The phone never takes a card: it
  opens the web wallet. (`components/TipModal.tsx`, `lib/money.ts` `amountChoices`; orochia-mobile `me.tsx`.)
- **Problem** — A free amount field makes people stop and think about a number; an empty or wrong default makes them
  under-pay an unlock and hit a refusal; a card form inside an adult app is a trust and compliance risk.
- **Principle** — Defaults and anchors: a preselected, sensible amount is accepted far more often and sets the reference
  for the others (Johnson & Goldstein, *Science* 2003; Tversky & Kahneman, *Science* 1974); fewer, relevant choices are
  decided faster (Hick 1952; Hyman 1953).
- **Refused** — A free amount first; listing gateways that are not configured; a card form in the app.
- **Cost** — A first payment leaves Orochia for the provider's page; on the phone, for the browser.
- **Signal we are wrong** — Dialogs opened and closed without a payment far more often than they are paid, or many
  people leaving the preselected amount for a lower one.
- **Feedback** — wrong for you? [Discussion #134](https://github.com/krizaka/orochia/discussions/134).

## Bids and pledges are held, never taken for nothing

- **Decision** — A bid or a pledge does not pay: it **holds** credits (`wallet_ledger HOLD`). An outbid bidder is released
  at once; an auction's winner pays only when it is sold; a challenge's backers pay only when the video or story is
  delivered — below its goal at the deadline, or a dare unanswered within 72 hours, everything comes back without a
  ticket. (`docs/AUCTIONS.md`, `docs/CHALLENGES.md`; `packages/payments` auction and challenge rules.)
- **Problem** — Custom requests paid up front are the first complaint on other platforms (paid, not delivered, refund
  by support); a tip goal that keeps the money whatever happens is a goal in name only.
- **Principle** — Loss aversion: the fear of paying for nothing weighs more than the wish for the content (Kahneman &
  Tversky 1979); an all-or-nothing threshold with a refund makes contributing safe and raises contributions (the
  provision point with money-back guarantee — Bagnoli & Lipman, *Review of Economic Studies* 1989; Cadsby & Maynes,
  *Journal of Public Economics* 1999).
- **Refused** — Prepaid custom requests; tip goals that keep the money; refunds decided by support.
- **Cost** — Credits sit held while an auction or a challenge runs; a creator waits for delivery to be paid.
- **Signal we are wrong** — Many pledges withdrawn before the deadline, or backers asking "where did my credits go?"
  while they are held.
- **Feedback** — wrong for you? [Discussion #134](https://github.com/krizaka/orochia/discussions/134).

## A bid in the last two minutes gives everyone two more minutes

- **Decision** — Soft close: a bid in the last 2 minutes moves the end to 2 minutes after it (`endAfterBid`,
  `AUCTION_SOFT_CLOSE_MS`), shown at once to everyone watching.
- **Problem** — With a hard end, the winner is whoever bids last, not whoever values the video most; watchers learn to
  wait, and the creator gets a lower price.
- **Principle** — Last-minute bidding ("sniping") is a response to hard closes and nearly disappears with a soft close
  (Roth & Ockenfels, *American Economic Review* 2002, eBay vs Amazon auctions).
- **Refused** — A hard end.
- **Cost** — An auction's end is not fixed in advance; a contested one runs longer.
- **Signal we are wrong** — Auctions extended many times in a row with tiny steps, or bidders saying they could not
  tell when it would really end.
- **Feedback** — wrong for you? [Discussion #134](https://github.com/krizaka/orochia/discussions/134).

## Act where the thing is, and every view has its address

- **Decision** — Quick actions live where the thing is shown: change the profile picture or the cover on the profile
  itself (a camera button, saved at once — `PictureQuickEdit`), edit a video in its row, follow or tip from the card.
  And every navigable state is in the URL: dashboard tabs (`/dashboard?tab=…`), feed filters, sorts in tables, `/@username`
  profiles — so a view can be shared, bookmarked, and the back button goes back. (`app/dashboard/page.tsx`,
  `components/FeedFilterTabs.tsx`, `components/profile/PictureQuickEdit.tsx`; `AGENTS.md` §6.)
- **Problem** — Settings pages separate the action from its result ("where do I change my photo?"); views kept only in
  memory are lost on reload and cannot be sent to someone.
- **Principle** — Direct manipulation: act on the visible object, see the result at once (Shneiderman, *IEEE Computer*
  1983); recognition rather than recall (Nielsen's heuristic #6); the URL is part of the interface and the back button
  is the most used navigation control (Nielsen, "URL as UI", 1999; Catledge & Pitkow, 1995).
- **Refused** — A settings page for every edit; tabs and filters kept in component state only.
- **Cost** — More states to handle in each page (every view must load from its address alone).
- **Signal we are wrong** — Support questions asking where a setting is, or shared links that open on a different view
  than the one sent.
- **Feedback** — wrong for you? [Discussion #134](https://github.com/krizaka/orochia/discussions/134).

## Live screens move at once, then settle

- **Decision** — An auction or a challenge on screen follows its live feed; a bid moves the price and a pledge fills
  the pot **the instant the event arrives**, then a silent reload brings what is the viewer's ("you lead", their share).
  No polling. Numbers never go back down on a late or repeated event.
- **Problem** — Polling every 4–5 s made the price jump late and in steps; in the last minutes of an auction a bidder
  bid on a price that was already gone.
- **Principle** — Response time: under ~0.1 s a change feels caused by the event itself, past ~1 s the flow of thought
  breaks (Card, Robertson & Mackinlay 1991; Nielsen, *Usability Engineering*, 1993, ch. 5). Showing system status as it
  changes (Nielsen's heuristic #1, 1994).
- **Refused** — Waiting for the reload before showing anything (one round-trip late); computing the leader on the device
  (the feed is public and carries aliases only — the server decides who leads).
- **Cost** — Two sources of truth for a second (the event, then the reload); a rule that numbers only grow to keep them
  from flickering.
- **Signal we are wrong** — Reports of a price shown that the server refuses (`409` "the minimum moved") more often
  than before, or of a pot that jumps backwards.
- **Feedback** — wrong for you? [Discussion #122](https://github.com/krizaka/orochia/discussions/122).

## Notification preferences by kind on the phone, by event on the web

- **Decision** — The app shows **eight switches**, one per kind (messages, followers, comments, tips, videos, auctions,
  challenges, storage); the web keeps one switch per event and channel. Both write the same list, so a kind reads as
  off as soon as one of its events is off.
- **Problem** — Thirty switches on a phone screen are scrolled past, not read; people turn everything off instead of
  the one thing that annoys them.
- **Principle** — Hick–Hyman law: decision time grows with the number of choices (Hick 1952; Hyman 1953); chunking a
  long list into a few meaningful groups (Miller 1956).
- **Refused** — The 30 events on the phone; a single "all notifications" switch (it pushes people to silence
  everything, including the bid they are winning).
- **Cost** — A finer choice ("outbid yes, new auctions no") needs the web.
- **Signal we are wrong** — Many accounts with whole kinds off on the phone that then turn single events back on on the
  web, or feedback asking for one specific event on the phone.
- **Feedback** — wrong for you? [Discussion #122](https://github.com/krizaka/orochia/discussions/122).

## In front, a toast; in the background, a push — never both

- **Decision** — While the app is in front, notifications arrive as the live stream's toasts and a push goes to the list
  silently; a message to someone with an Orochia screen open is not pushed at all.
- **Problem** — A banner and a toast for the same tip, or a phone buzzing for a message already on screen, read as noise
  and teach people to mute the app.
- **Principle** — Alert fatigue: repeated, redundant alerts lower attention to all alerts (Ancker et al., 2017, *BMC
  Medical Informatics and Decision Making*); interruptions cost recovery time (Mark, Gudith & Klocke, CHI 2008).
- **Refused** — The system banner in front (shows twice); pushing every message whatever the presence.
- **Cost** — A person with a tab open on another computer does not get the phone buzz for a message.
- **Signal we are wrong** — Feedback of messages "missed" while a forgotten tab was open elsewhere.
- **Feedback** — wrong for you? [Discussion #122](https://github.com/krizaka/orochia/discussions/122).

## A tapped notification opens its screen, even from a closed app

- **Decision** — Tapping a push opens what it is about (the conversation, the auction, the challenge), whether the app
  was running or the tap launched it; anything the app has no screen for opens on orochia.com.
- **Problem** — A cold start landed on Home: the person had to find the auction they were just told about.
- **Principle** — Information scent: people follow the cue that promises their goal and give up when it leads elsewhere
  (Pirolli & Card, *Information Foraging*, 1999).
- **Refused** — Opening Home with a toast pointing to the item.
- **Cost** — Each new kind of path needs its route in the app (or falls back to the web).
- **Signal we are wrong** — Taps followed by an immediate back and a search for the same item.
- **Feedback** — wrong for you? [Discussion #122](https://github.com/krizaka/orochia/discussions/122).

## "For you" can be switched to chronological, and says when it is only trending

- **Decision** — Signed-in viewers get a "For you" shelf first in Explore, ranked from what they watch, like, save and
  follow; a two-choice switch (Personalised · Chronological, kept in the address) turns it into the newest public videos.
  Without signals yet, or when the engine is out of reach, the shelf shows trending and its subtitle says so.
- **Problem** — A personalised feed nobody can turn off feels manipulative, and a "For you" that is secretly the same for
  everyone erodes trust once noticed.
- **Principle** — Perceived control and transparency raise trust in recommenders and their acceptance (Pu, Chen & Hu,
  "A user-centric evaluation framework for recommender systems", RecSys 2011; Konstan & Riedl, *UMUAI*, 2012).
- **Refused** — A feed with no off switch; a hidden fallback; reasons on every card (noise at this size — they are kept
  in the data for later).
- **Cost** — One more control on Explore; the chronological list is the same as "New" further down.
- **Signal we are wrong** — Most people switching to Chronological and staying there, or feedback that the picks feel
  unrelated to what they did.
- **Feedback** — wrong for you? [Discussion #122](https://github.com/krizaka/orochia/discussions/122).

## Notifications as a matrix (krizaka/orochia#261)

- **Decision**: five categories × two channels (the app, e-mail), three presets (everything · the essentials · nothing but security), the security category shown and locked, and a one-click « unsubscribe from this kind of e-mail » link (and `List-Unsubscribe` header) in every notification e-mail.
- **Problem**: 27 events × 2 switches was a wall of options; people could not tell what they would stop receiving, and e-mail felt like spam.
- **Principle**: fewer, meaningful choices with good defaults beat exhaustive controls (Hick's law, Hick 1952; defaults decide most outcomes, Johnson & Goldstein 2003, "Do defaults save lives?"). One-click unsubscribe is the mail ecosystem's rule (RFC 8058) and protects the sender's reputation.
- **Refused**: a per-event matrix as the main screen (kept in the data, not on the screen); turning security e-mails off; a login to unsubscribe (the signed link is the authorisation).
- **Cost**: a person cannot silence one event of a category from the screen (the stored lists still can).
- **Signal we are wrong**: many people on « Custom », or complaints about missing a specific event.
