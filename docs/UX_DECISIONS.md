# UX decisions — why it is built like this

Each notable choice of experience in Orochia: the decision, the problem, the principle behind it (with its source),
what was refused, what it costs, and the signal that would tell us we are wrong. Disagree, or saw that signal?
Say it in [the feedback discussion](https://github.com/krizaka/orochia/discussions/122).

---

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

## A tapped notification opens its screen, even from a closed app

- **Decision** — Tapping a push opens what it is about (the conversation, the auction, the challenge), whether the app
  was running or the tap launched it; anything the app has no screen for opens on orochia.com.
- **Problem** — A cold start landed on Home: the person had to find the auction they were just told about.
- **Principle** — Information scent: people follow the cue that promises their goal and give up when it leads elsewhere
  (Pirolli & Card, *Information Foraging*, 1999).
- **Refused** — Opening Home with a toast pointing to the item.
- **Cost** — Each new kind of path needs its route in the app (or falls back to the web).
- **Signal we are wrong** — Taps followed by an immediate back and a search for the same item.
