// The catalogue of the dev dataset (v2): one JSON file per creator under creators/, plus fans.json, challenges.json and auctions.json.
// Pure — no network, no file writes. scripts/dev-dataset-catalogue.test.mjs runs it. The media it describes is never committed:
// scripts/dev-dataset/orazaka-batch.mjs makes it through Orazaka's Studios into a scratch folder, seed-catalogue.mjs sends it through Orochia's API.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const STYLE = {
  image: "Photorealistic photograph, natural colours, sharp, high detail, no text, no lettering, no watermark, no logo. Every person shown is a fictional adult.",
  clip: "Photographic, stable composition, the subject keeps its shape, one continuous shot, no cut, no text.",
};
export const SIZES = { avatar: "1024x1024", banner: "1360x768", vertical: "768x1360", horizontal: "1360x768" };
/** What the video Studio renders from a still: Wan 2.2 TI2V 5B, 5 s, 24 fps. */
export const CLIP = { vertical: { aspect: "9:16", width: 704, height: 1280 }, horizontal: { aspect: "16:9", width: 1280, height: 704 }, seconds: 5, model: "wan2.2-ti2v-5b" };
/** The hero clips (the party showcase): Wan 2.2 A14B at 720p on the pod, text to video, 16 fps. */
export const HERO = { model: "wan2.2-t2v-a14b", horizontal: { aspect: "16:9", width: 1280, height: 720 }, vertical: { aspect: "9:16", width: 720, height: 1280 } };
export const IMAGE_MODEL = "flux-2-klein-4b";
export const RATINGS = ["MATURE", "ADULT"];

export const slug = (text) => text.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);

/** A stable seed from an asset id, so a rebuild makes the same picture and `variant` asks for another take. */
export function seedOf(id, variant = 0) {
  const h = crypto.createHash("sha256").update(`${id}#${variant}`).digest();
  return String(h.readUInt32BE(0) % 1_000_000_000);
}

export function loadCatalogue(dir) {
  const read = (file, fallback) => (fs.existsSync(path.join(dir, file)) ? JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")) : fallback);
  const creators = fs
    .readdirSync(path.join(dir, "creators"))
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, "creators", f), "utf8")));
  return { creators, groups: read("groups.json", { groups: {} }).groups, fans: read("fans.json", { fans: [] }).fans, challenges: read("challenges.json", { challenges: [] }).challenges, auctions: read("auctions.json", { auctions: [] }).auctions };
}

/** Everything that must hold for the dataset to look curated. Returns the problems found. */
export function validateCatalogue(cat, existingTitles = {}) {
  const problems = [];
  const keys = new Set();
  const usernames = new Set();
  const titles = new Set();
  for (const c of cat.creators) {
    const at = `creator ${c.key}`;
    if (keys.has(c.key)) problems.push(`${at}: twice`);
    keys.add(c.key);
    if (usernames.has(c.username)) problems.push(`${at}: username ${c.username} twice`);
    usernames.add(c.username);
    if (!/^[a-z0-9_]{3,30}$/.test(c.username ?? "")) problems.push(`${at}: username 3-30 of a-z 0-9 _`);
    if (!c.displayName || /^qa\b|test|demo/i.test(c.displayName)) problems.push(`${at}: the display name must read as a person`);
    if (!c.existing) {
      if (!c.bio || c.bio.length < 30 || c.bio.length > 400) problems.push(`${at}: a bio of one or two sentences`);
      if (!Array.isArray(c.tags) || c.tags.length < 3) problems.push(`${at}: three tags at least`);
    }
    if (c.rating && !RATINGS.includes(c.rating)) problems.push(`${at}: rating ${c.rating}`);
    if (!c.avatar || !c.banner) problems.push(`${at}: an avatar and a banner prompt`);
    if (!c.existing && (c.videos ?? []).length < 4) problems.push(`${at}: ${(c.videos ?? []).length} videos, 4 at least`);
    if ((c.stories ?? []).length < 2 || c.stories.length > 5) problems.push(`${at}: 2 to 5 stories`);
    const own = new Set((c.videos ?? []).map((v) => v.title));
    for (const v of c.videos ?? []) {
      const vat = `${at}, video "${v.title}"`;
      if (!v.title || v.title.length < 3 || v.title.length > 120) problems.push(`${vat}: title length`);
      if (titles.has(v.title.toLowerCase())) problems.push(`${vat}: duplicate title`);
      titles.add(v.title.toLowerCase());
      if (!["vertical", "horizontal"].includes(v.orientation)) problems.push(`${vat}: orientation`);
      if (!v.description || v.description.length < 30) problems.push(`${vat}: a description of a sentence`);
      if (!Array.isArray(v.tags) || v.tags.length < 2 || v.tags.some((t) => t !== t.toLowerCase() || t.length > 40)) problems.push(`${vat}: two lower-case tags at least`);
      if (!v.still || !v.motion) problems.push(`${vat}: a still prompt and a motion prompt`);
      for (const p of [v.still, v.motion]) if (p && /\bnud(e|es|ity)\b|\bnaked\b|\btopless\b|erotic|sexual|\bporn|\bexplicit\b|lingerie|underwear/i.test(p.replace(/\bno (nudity|nude)\b/gi, ""))) problems.push(`${vat}: stays non-explicit`);
      if (v.visibility === "TIPPED_UNLOCKED" && !(v.minTipCents >= 100)) problems.push(`${vat}: a paid unlock costs 100 cents at least`);
    }
    if ((c.videos ?? []).length && !c.videos.some((v) => v.orientation === "vertical") && !c.existing) problems.push(`${at}: at least one vertical clip`);
    for (const col of c.collections ?? []) {
      if (!col.title) problems.push(`${at}: a collection needs a title`);
      for (const t of col.videos ?? []) if (!own.has(t) && !(existingTitles[c.key] ?? []).includes(t)) problems.push(`${at}, collection "${col.title}": unknown video "${t}"`);
    }
    for (const s of c.stories ?? []) {
      if (!s.caption || s.caption.length > 280) problems.push(`${at}: story caption 1-280`);
      if (!["image", "clip"].includes(s.kind)) problems.push(`${at}: story kind`);
      if (s.kind === "clip" && !s.motion) problems.push(`${at}: story clip "${s.caption}" needs a motion prompt`);
      if (!s.still) problems.push(`${at}: story "${s.caption}" needs a still prompt`);
    }
  }
  const fanNames = new Set();
  for (const f of cat.fans) {
    if (fanNames.has(f.username) || usernames.has(f.username)) problems.push(`fan ${f.username}: twice`);
    fanNames.add(f.username);
    if (!/^[a-z0-9_]{3,30}$/.test(f.username)) problems.push(`fan ${f.username}: username`);
    if (!f.interests?.length) problems.push(`fan ${f.username}: interests`);
    for (const k of f.interests ?? []) if (!keys.has(k) && !cat.groups?.[k]) problems.push(`fan ${f.username}: unknown interest ${k}`);
  }
  const fanSet = new Set(cat.fans.map((f) => f.username));
  const titleOf = new Map(cat.creators.flatMap((c) => (c.videos ?? []).map((v) => [`${c.key}:${v.title}`, v])));
  for (const ch of cat.challenges) {
    const at = `challenge "${ch.title}"`;
    if (!["GOAL", "REQUEST", "OPEN_CALL"].includes(ch.kind)) problems.push(`${at}: kind`);
    if (!ch.title || !ch.description) problems.push(`${at}: title and description`);
    if (ch.kind !== "OPEN_CALL" && !keys.has(ch.creator)) problems.push(`${at}: unknown creator ${ch.creator}`);
    if (ch.kind !== "GOAL" && !fanSet.has(ch.from)) problems.push(`${at}: unknown fan ${ch.from}`);
    for (const [fan] of ch.pledges ?? []) if (!fanSet.has(fan)) problems.push(`${at}: unknown backer ${fan}`);
    for (const k of ch.applicants ?? []) if (!keys.has(k)) problems.push(`${at}: unknown applicant ${k}`);
  }
  for (const a of cat.auctions) {
    const at = `auction "${a.video}"`;
    if (!titleOf.has(`${a.creator}:${a.video}`)) problems.push(`${at}: not a video of ${a.creator}`);
    for (const [fan] of a.bids ?? []) if (!fanSet.has(fan)) problems.push(`${at}: unknown bidder ${fan}`);
    if (!(a.hours >= 1)) problems.push(`${at}: an auction lasts one hour at least`);
  }
  return problems;
}

/** The generation jobs of a catalogue, in the order the pipeline needs them: every still first, then the clips made from them. */
export function buildJobs(cat) {
  const jobs = [];
  const still = (id, prompt, size, role) => jobs.push({ id, kind: "image", role, prompt: `${prompt}. ${STYLE.image}`, size, seed: seedOf(id), model: IMAGE_MODEL });
  const clip = (id, from, orientation, motion, role, hero = false, scene = "") =>
    jobs.push({ id, kind: "clip", role, from, orientation, hero, prompt: hero ? `${scene}. ${motion} ${STYLE.clip}` : `${motion} ${STYLE.clip}`, seed: seedOf(id), seconds: CLIP.seconds, model: hero ? HERO.model : CLIP.model, aspect: (hero ? HERO : CLIP)[orientation].aspect });
  for (const c of cat.creators) {
    still(`${c.key}/avatar`, c.avatar, SIZES.avatar, "avatar");
    still(`${c.key}/banner`, c.banner, SIZES.banner, "banner");
    for (const v of c.videos ?? []) still(`${c.key}/v/${slug(v.title)}`, v.still, SIZES[v.orientation], "video-still");
    c.stories.forEach((s, i) => still(`${c.key}/s/${i + 1}`, s.still, SIZES.vertical, "story-still"));
  }
  for (const c of cat.creators) {
    for (const v of c.videos ?? []) clip(`${c.key}/v/${slug(v.title)}`, `${c.key}/v/${slug(v.title)}`, v.orientation, v.motion, "video", Boolean(v.hero), v.still);
    c.stories.forEach((s, i) => {
      if (s.kind === "clip") clip(`${c.key}/s/${i + 1}`, `${c.key}/s/${i + 1}`, "vertical", s.motion, "story");
    });
  }
  // Two different jobs may share an id (a still and its clip): the id is namespaced by kind in the ledger.
  return jobs;
}

/** The password of a dataset account is derived from one secret and the username: nothing per account is stored. */
export function derivePassword(secret, username) {
  return crypto.createHmac("sha256", secret).update(`orochia-dev-dataset:${username}`).digest("base64url").slice(0, 32);
}

export const emailOf = (username) => `qa+${username}@orochia.com`;
