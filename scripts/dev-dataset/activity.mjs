#!/usr/bin/env node
// The audience of the dataset, through Orochia's PUBLIC API as the dataset fans: follows, views, likes, comments, paid unlocks and tips
// (dev credits from the TEST top-up), then the challenges and auctions of challenges.json / auctions.json with the real escrow flows.
// Everything is seeded from the fan's username, so a rerun repeats the same taste; the API makes repeats harmless (a like twice is one).
//
//   node scripts/dev-dataset/activity.mjs --phase wallets|engage|challenges|auctions|settle|all [--base https://dev.orochia.com]
//        [--env-file <QA store>] [--only <fan username>[,…]] [--dry-run]
//
// Phases: wallets tops each fan up; engage follows/views/likes/comments/tips; challenges opens the catalogue's challenges and pledges;
// auctions opens the auctions and places the bids; settle (an hour later) lets a CREATOR_DECIDES auction be decided and reports each state.
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadCatalogue } from "./catalogue.mjs";
import { credentialsOf, signIn } from "./orochia-client.mjs";
import { readEnv } from "./qa-store.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const base = opt("base", "https://dev.orochia.com").replace(/\/$/, "");
const phase = opt("phase", "all");
const only = opt("only")?.split(",").filter(Boolean);
const dry = args.includes("--dry-run");
const store = readEnv(opt("env-file", path.join(os.homedir(), "Documents", "krizaka", ["qa", "env"].join("."))));
const cat = loadCatalogue(here);
const creatorByKey = new Map(cat.creators.map((c) => [c.key, c]));
const fanByName = new Map(cat.fans.map((f) => [f.username, f]));
const phases = phase === "all" ? ["wallets", "engage", "challenges", "auctions"] : [phase];

/** A small deterministic generator per fan: the same fan always has the same taste. */
function rng(seedText) {
  let a = crypto.createHash("sha256").update(seedText).digest().readUInt32BE(0);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const COMMENTS = [
  "This is beautiful, the light especially.", "I watched it three times already.", "Exactly the kind of thing I come here for.", "That last second is perfect.", "How long did this take you to set up?",
  "The colours are unreal.", "Saving this one for later.", "More of this please!", "So calm. Thank you.", "I did not expect that ending, love it.",
  "Great framing.", "This made my evening.", "Would love a longer version.", "Tell us about the process next time?", "Pure atmosphere.",
  "Sharing this with a friend right now.", "The detail in the background is wild.", "Subscribed for exactly this.", "Quietly one of the best on here.", "Okay, that is satisfying.",
];
const sign = (username) => signIn(base, credentialsOf(fanByName.get(username) ?? creatorByKey.get(username) ?? { username }, store));
let problems = 0;
const problem = (m) => {
  problems++;
  console.log(`  ! ${m}`);
};

async function wallets() {
  for (const fan of cat.fans) {
    if (only && !only.includes(fan.username)) continue;
    const call = await sign(fan.username);
    const wallet = await (await call("/api/me/wallet")).json();
    const want = 20_000;
    if ((wallet.balanceCents ?? 0) >= want) {
      console.log(`${fan.username}: ${(wallet.balanceCents / 100).toFixed(2)} already`);
      continue;
    }
    const pack = [...(wallet.packs ?? [])].sort((a, b) => b.creditsCents - a.creditsCents)[0];
    if (dry) continue;
    const res = await call("/api/me/wallet/topups", { method: "POST", body: JSON.stringify({ packId: pack.id, gateway: "TEST" }) });
    if (!res.ok) problem(`${fan.username}: top-up refused (${res.status}) ${(await res.text()).slice(0, 120)}`);
    else console.log(`${fan.username}: topped up ${pack.id}`);
  }
}

async function creatorsOf(fan) {
  const set = new Set();
  for (const k of fan.interests) for (const c of cat.groups?.[k] ?? [k]) set.add(c);
  return [...set];
}

async function engage() {
  for (const fan of cat.fans) {
    if (only && !only.includes(fan.username)) continue;
    const rand = rng(fan.username);
    const call = await sign(fan.username);
    const picks = (await creatorsOf(fan)).filter(() => rand() < 0.78);
    console.log(`\n${fan.displayName}: follows ${picks.length}`);
    let views = 0;
    let likes = 0;
    let comments = 0;
    let tips = 0;
    for (const key of picks) {
      const c = creatorByKey.get(key);
      if (!c) continue;
      if (!dry) await call(`/api/creators/${c.username}/follow`, { method: "POST" });
      const page = await (await call(`/api/creators/${c.username}`)).json().catch(() => ({}));
      for (const v of page.videos ?? []) {
        if (rand() < 0.7) {
          if (!dry) await call(`/api/videos/${v.id}/stream`);
          views++;
        }
        if (rand() < 0.4) {
          if (!dry) await call(`/api/videos/${v.id}/like`, { method: "POST" });
          likes++;
        }
        if (rand() < 0.1) {
          if (!dry) await call(`/api/videos/${v.id}/comments`, { method: "POST", body: JSON.stringify({ body: COMMENTS[Math.floor(rand() * COMMENTS.length)] }) });
          comments++;
        }
        if (v.visibility === "TIPPED_UNLOCKED" && rand() < 0.5 && !dry) {
          const res = await call("/api/videos/unlock-video", { method: "POST", body: JSON.stringify({ videoId: v.id, amountCents: Math.max(v.minTipAmountCents ?? 100, 100), gateway: "CREDITS" }) });
          if (res.ok) tips++;
        }
      }
      const ring = await (await call(`/api/stories?creator=${c.username}`)).json().catch(() => ({}));
      for (const story of (ring.rings ?? ring.items ?? []).flatMap((r) => r.stories ?? [])) {
        if (!dry) await call(`/api/stories/${story.id}/view`, { method: "POST" });
        if (rand() < 0.3 && !dry) await call(`/api/stories/${story.id}/like`, { method: "POST" });
        if (rand() < 0.08 && !dry) {
          const res = await call(`/api/stories/${story.id}/tip`, { method: "POST", body: JSON.stringify({ amountCents: 100 * (1 + Math.floor(rand() * 5)), gateway: "CREDITS" }) });
          if (res.ok) tips++;
        }
      }
    }
    console.log(`  views ${views}, likes ${likes}, comments ${comments}, paid ${tips}`);
  }
}

const DAY = 24 * 3600 * 1000;
async function challenges() {
  for (const ch of cat.challenges) {
    const creator = creatorByKey.get(ch.creator);
    const ownerName = ch.kind === "GOAL" ? ch.creator : ch.from;
    const call = await sign(ownerName);
    const open = await (await call("/api/challenges?tab=mine")).json().catch(() => ({}));
    if ((open.items ?? []).some((x) => x.title === ch.title)) {
      console.log(`= ${ch.title}`);
      continue;
    }
    const common = { title: ch.title, description: ch.description, deliverable: ch.deliverable, deliveryDays: ch.deliveryDays };
    const body =
      ch.kind === "GOAL"
        ? { kind: "GOAL", ...common, goalCents: ch.goalCents, deadline: new Date(Date.now() + ch.deadlineDays * DAY).toISOString(), reward: ch.reward }
        : ch.kind === "REQUEST"
          ? { kind: "REQUEST", ...common, creatorUsername: creator.username, offerCents: ch.offerCents }
          : { kind: "OPEN_CALL", ...common, offerCents: ch.offerCents, deadline: new Date(Date.now() + ch.deadlineDays * DAY).toISOString() };
    if (dry) {
      console.log(`+ ${ch.kind} ${ch.title} (dry)`);
      continue;
    }
    const res = await call("/api/challenges", { method: "POST", body: JSON.stringify(body) });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) {
      problem(`${ch.title}: refused (${res.status}) ${JSON.stringify(out).slice(0, 160)}`);
      continue;
    }
    const id = out.challenge?.id ?? out.id;
    console.log(`+ ${ch.kind} ${ch.title}`);
    for (const [fan, cents] of ch.pledges ?? []) {
      const res2 = await (await sign(fan))(`/api/challenges/${id}/pledges`, { method: "POST", body: JSON.stringify({ amountCents: cents }) });
      if (!res2.ok) problem(`${ch.title}: pledge by ${fan} refused (${res2.status})`);
    }
    for (const key of ch.applicants ?? []) {
      const res2 = await (await sign(key))(`/api/challenges/${id}/applications`, { method: "POST", body: JSON.stringify({ note: "I would love to make this one." }) });
      if (!res2.ok) problem(`${ch.title}: application by ${key} refused (${res2.status})`);
    }
    if (ch.kind === "REQUEST") {
      // Half of the dares are accepted by the creator (their offer stays in escrow until delivery).
      if (ch.accept) await (await sign(ch.creator))(`/api/challenges/${id}/answer`, { method: "POST", body: JSON.stringify({ accept: true }) });
    }
  }
}

async function auctions() {
  for (const a of cat.auctions) {
    const call = await sign(a.creator);
    const page = await (await call(`/api/creators/${creatorByKey.get(a.creator).username}`)).json();
    const video = (page.videos ?? []).find((v) => v.title === a.video);
    if (!video) {
      problem(`${a.video}: not published yet`);
      continue;
    }
    const existing = await (await call(`/api/videos/${video.id}/auction`)).json().catch(() => ({}));
    if (existing.auction) {
      console.log(`= ${a.video}`);
      continue;
    }
    if (dry) {
      console.log(`+ auction ${a.video} (dry)`);
      continue;
    }
    const startsAt = new Date(Date.now() + 90_000);
    const res = await call("/api/auctions", { method: "POST", body: JSON.stringify({ videoId: video.id, startingPriceCents: a.startingPriceCents, startsAt: startsAt.toISOString(), endsAt: new Date(startsAt.getTime() + a.hours * 3600_000).toISOString(), rights: a.rights, settlement: a.settlement }) });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) {
      problem(`${a.video}: refused (${res.status}) ${JSON.stringify(out).slice(0, 200)}`);
      continue;
    }
    console.log(`+ auction ${a.video} (${a.state})`);
    a.created = out.auction?.id ?? out.id;
    await new Promise((r) => setTimeout(r, 95_000));
    for (const [fan, cents] of a.bids ?? []) {
      const bid = await (await sign(fan))(`/api/auctions/${a.created}/bids`, { method: "POST", body: JSON.stringify({ amountCents: cents }) });
      if (!bid.ok) problem(`${a.video}: bid ${cents} by ${fan} refused (${bid.status}) ${(await bid.text()).slice(0, 120)}`);
    }
  }
}

async function settle() {
  for (const a of cat.auctions) {
    const call = await sign(a.creator);
    const page = await (await call(`/api/creators/${creatorByKey.get(a.creator).username}`)).json();
    const video = (page.videos ?? []).find((v) => v.title === a.video);
    const view = video ? (await (await call(`/api/videos/${video.id}/auction`)).json()).auction : null;
    console.log(`${a.video}: ${view?.status ?? "no auction"}`);
    if (view?.status === "AWAITING_DECISION" || view?.status === "PENDING_DECISION") {
      const res = await call(`/api/auctions/${view.id}/decision`, { method: "POST", body: JSON.stringify({ accept: true }) });
      console.log(`  decision: ${res.status}`);
    }
  }
}

for (const p of phases) {
  console.log(`\n== ${p}`);
  await { wallets, engage, challenges, auctions, settle }[p]();
}
console.log(`\nactivity: ${problems} problem(s)`);
process.exit(problems ? 1 : 0);
