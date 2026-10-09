#!/usr/bin/env node
/**
 * End-to-end feature scenarios against a running Orochia on a freshly seeded database:
 * approved followers, contacts, invited-only videos and audience lists, collections and their permissions, views, likes, comments, shares, search, creator edits, takedowns, suspensions,
 * role changes, the wallet, auctions and challenges — each checked through the HTTP API with real sessions.
 *
 *   npm run db:reset -- --yes && npm run dev      # in another terminal
 *   npm run test:e2e                              # OROCHIA_URL defaults to http://localhost:3000
 *
 * The scenarios change data (they approve, accept, take down…) and end with a factory reset of the database (when the
 * deployment allows it): reset the database before re-running.
 */
const B = (process.env.OROCHIA_URL || "http://localhost:3000").replace(/\/$/, "");
let failures = 0;
const check = (name, cond, extra = "") => { console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : "  " + extra}`); if (!cond) failures++; };
async function session(identifier, password) {
  const r = await fetch(B + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier, password }) });
  const cookie = (r.headers.get("set-cookie") || "").split(";")[0];
  const call = async (path, method = "GET", body) => {
    const res = await fetch(B + path, { method, headers: { Cookie: cookie, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
    let json = {}; try { json = await res.json(); } catch {}
    return { status: res.status, json };
  };
  return { status: r.status, call, cookie };
}
const anon = { call: async (path) => { const r = await fetch(B + path); return { status: r.status, json: await r.json().catch(() => ({})) }; } };

const alex = await session("alex@sanctuary.io", "alex1234");
const sam = await session("sam@sanctuary.io", "sam1234");
const elena = await session("elena@orochia.org", "elena1234");
const mia = await session("mia@orochia.org", "mia1234");
const admin = await session("admin@orochia.org", "admin1234");
check("five sessions", [alex, sam, elena, mia, admin].every((s) => s.status === 200));
// Native apps: the same session as a bearer token, never as a cookie.
{
  const r = await fetch(B + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier: "alex@sanctuary.io", password: "alex1234", client: "native" }) });
  const body = await r.json();
  check("a native sign-in answers a token and sets no cookie", r.status === 200 && typeof body.token === "string" && !r.headers.get("set-cookie"));
  const me = await fetch(B + "/api/me/wallet", { headers: { Authorization: `Bearer ${body.token}` } });
  check("…which opens the account as a bearer token", me.status === 200);
  check("a forged bearer token is refused", (await fetch(B + "/api/me/wallet", { headers: { Authorization: `Bearer ${body.token}x` } })).status === 401);
}

const feed = (await anon.call("/api/feed?limit=60")).json.videos;
const byTitle = (t) => feed.find((v) => v.title.startsWith(t));
const diaries = byTitle("Studio Diaries"), rehearsal = byTitle("Rehearsal Tapes"), noir = byTitle("Midnight Noir"), neon = byTitle("Tokyo Neon");
check("feed lists ready videos only (processing hidden)", feed.length === 5 && !byTitle("Afterhours"), `got ${feed.length}`);

// Followers-only
check("anonymous → followers-only refused", (await anon.call(`/api/videos/${diaries.id}/stream`)).json.reason === "FOLLOWERS_ONLY");
check("approved follower (alex) → allowed", (await alex.call(`/api/videos/${diaries.id}/stream`)).json.allowed === true);
check("pending follower (sam) → refused", (await sam.call(`/api/videos/${diaries.id}/stream`)).json.reason === "FOLLOWERS_ONLY");
const net = (await elena.call("/api/me/network")).json.data;
const samFollow = net.followers.find((p) => p.username === "sam_rivers");
check("creator sees sam's pending follow", samFollow?.status === "PENDING");
check("creator approves sam", (await elena.call(`/api/me/followers/${samFollow.id}`, "PATCH", { action: "approve" })).status === 200);
check("sam now allowed", (await sam.call(`/api/videos/${diaries.id}/stream`)).json.allowed === true);
check("a member cannot approve followers", (await alex.call(`/api/me/followers/${samFollow.id}`, "PATCH", { action: "approve" })).status === 403);

// Contacts
check("contact (alex) → contacts-only allowed", (await alex.call(`/api/videos/${rehearsal.id}/stream`)).json.allowed === true);
check("non-contact (sam) → refused", (await sam.call(`/api/videos/${rehearsal.id}/stream`)).json.reason === "CONTACTS_ONLY");
const req = (await mia.call("/api/me/network")).json.data.incoming.find((p) => p.username === "sam_rivers");
check("sam's contact request reaches mia", !!req);
check("requester cannot accept own request", (await sam.call(`/api/contacts/${req.id}`, "PATCH", { action: "accept" })).status === 403);
check("mia accepts", (await mia.call(`/api/contacts/${req.id}`, "PATCH", { action: "accept" })).status === 200);
check("sam now allowed", (await sam.call(`/api/videos/${rehearsal.id}/stream`)).json.allowed === true);
const meet = await alex.call("/api/contacts", "POST", { username: "elenavox" });
check("alex requests elena", meet.status === 201 && meet.json.contact.status === "PENDING");
const back = await elena.call("/api/contacts", "POST", { username: "alex_vance" });
check("mutual requests meet → accepted", back.json.contact?.status === "ACCEPTED", JSON.stringify(back.json));
check("cannot add yourself", (await alex.call("/api/contacts", "POST", { username: "alex_vance" })).status === 400);

// Follow flow + relationship
check("follow a member is refused", (await sam.call("/api/creators/alex_vance/follow", "POST")).status === 400);
const f = await sam.call("/api/creators/miasterling/follow", "POST");
check("follow mia → PENDING", f.json.follow === "PENDING");
check("relationship visible on creator page", (await sam.call("/api/creators/miasterling")).json.relationship?.follow === "PENDING");
check("unfollow", (await sam.call("/api/creators/miasterling/follow", "DELETE")).json.follow === null);

// Invited-only videos and reusable audience lists
const elenaUploads = (await elena.call("/api/me/dashboard")).json.data.uploads;
const roughCut = elenaUploads.find((v) => v.title.startsWith("Inner Circle"));
check("invited-only video not listed in the feed", !(await anon.call("/api/feed?limit=60")).json.videos.some((v) => v.id === roughCut.id));
check("…nor on the creator's page", !(await anon.call("/api/creators/elenavox")).json.videos.some((v) => v.id === roughCut.id));
check("its details → 404 for a stranger", (await sam.call(`/api/videos/${roughCut.id}/details`)).status === 404);
check("list member (alex) watches it", (await alex.call(`/api/videos/${roughCut.id}/stream`)).json.allowed === true);
check("…and sees its details", (await alex.call(`/api/videos/${roughCut.id}/details`)).status === 200);
check("stranger (sam) → INVITED_ONLY", (await sam.call(`/api/videos/${roughCut.id}/stream`)).json.reason === "INVITED_ONLY");
check("author watches it", (await elena.call(`/api/videos/${roughCut.id}/stream`)).json.allowed === true);
const lists = (await elena.call("/api/me/lists")).json.lists;
const inner = lists.find((l) => l.name === "Inner circle");
check("elena's lists, with size", inner?.membersCount === 1);
check("lists are private", (await alex.call(`/api/me/lists/${inner.id}/members`)).status === 404);
check("duplicate list name → 409", (await elena.call("/api/me/lists", "POST", { name: "Inner circle" })).status === 409);
check("add sam to the list", (await elena.call(`/api/me/lists/${inner.id}/members`, "POST", { username: "sam_rivers" })).status === 201);
check("sam now watches it (live membership)", (await sam.call(`/api/videos/${roughCut.id}/stream`)).json.allowed === true);
const samId = (await elena.call(`/api/me/lists/${inner.id}/members`)).json.members.find((m) => m.username === "sam_rivers").userId;
check("remove sam from the list", (await elena.call(`/api/me/lists/${inner.id}/members?userId=${samId}`, "DELETE")).status === 200);
check("sam shut out again", (await sam.call(`/api/videos/${roughCut.id}/stream`)).json.reason === "INVITED_ONLY");
check("invite mia directly", (await elena.call(`/api/videos/${roughCut.id}/audience`, "POST", { username: "miasterling" })).status === 201);
check("mia watches it", (await mia.call(`/api/videos/${roughCut.id}/stream`)).json.allowed === true);
const audience = (await elena.call(`/api/videos/${roughCut.id}/audience`)).json;
check("audience: 1 person + 1 list", audience.members?.length === 1 && audience.lists?.length === 1);
check("another creator cannot read it", (await mia.call(`/api/videos/${roughCut.id}/audience`)).status === 404);
check("cannot attach someone else's list", (await mia.call(`/api/videos/${noir.id}/audience`, "POST", { listId: inner.id })).status === 404);
check("detach the list", (await elena.call(`/api/videos/${roughCut.id}/audience?listId=${inner.id}`, "DELETE")).status === 200);
check("alex shut out", (await alex.call(`/api/videos/${roughCut.id}/stream`)).json.reason === "INVITED_ONLY");
check("…and cannot comment", (await alex.call(`/api/videos/${roughCut.id}/comments`, "POST", { body: "hi" })).status === 403);
const temp = await elena.call("/api/me/lists", "POST", { name: "Temp" });
await elena.call(`/api/me/lists/${temp.json.list.id}/members`, "POST", { username: "alex_vance" });
await elena.call(`/api/videos/${roughCut.id}/audience`, "POST", { listId: temp.json.list.id });
check("a new list opens it to alex", (await alex.call(`/api/videos/${roughCut.id}/stream`)).json.allowed === true);
check("delete the list", (await elena.call(`/api/me/lists/${temp.json.list.id}`, "DELETE")).status === 200);
check("deleting it closes what it opened", (await alex.call(`/api/videos/${roughCut.id}/stream`)).json.reason === "INVITED_ONLY");

// Collections and their permissions
const pl = await alex.call("/api/playlists", "POST", { title: "Test list", visibility: "PRIVATE" });
check("create playlist", pl.status === 201);
check("add video", (await alex.call(`/api/playlists/${pl.json.playlist.id}/items`, "POST", { videoId: noir.id })).status === 201);
check("add again is idempotent", (await alex.call(`/api/playlists/${pl.json.playlist.id}/items`, "POST", { videoId: noir.id })).status === 201);
const mine = (await alex.call(`/api/playlists/${pl.json.playlist.id}`)).json.playlist;
check("owner reads private playlist with 1 item", mine?.items?.length === 1);
check("others get 404 on a private playlist", (await sam.call(`/api/playlists/${pl.json.playlist.id}`)).status === 404);
check("others cannot edit it", (await sam.call(`/api/playlists/${pl.json.playlist.id}`, "PATCH", { title: "x" })).status === 404);
check("unknown audience refused", (await alex.call(`/api/playlists/${pl.json.playlist.id}`, "PATCH", { visibility: "FRIENDS" })).status === 400);
check("invited-only", (await alex.call(`/api/playlists/${pl.json.playlist.id}`, "PATCH", { visibility: "INVITED_ONLY" })).status === 200);
check("not invited yet → 404", (await elena.call(`/api/playlists/${pl.json.playlist.id}`)).status === 404);
check("others cannot invite", (await sam.call(`/api/playlists/${pl.json.playlist.id}/members`, "POST", { username: "elenavox" })).status === 404);
check("invite unknown account → 404", (await alex.call(`/api/playlists/${pl.json.playlist.id}/members`, "POST", { username: "nobody_here" })).status === 404);
check("invite elena", (await alex.call(`/api/playlists/${pl.json.playlist.id}/members`, "POST", { username: "@ElenaVox".replace("@", "") })).status === 201);
check("invited elena opens it", (await elena.call(`/api/playlists/${pl.json.playlist.id}`)).status === 200);
check("listed in elena's shared collections", (await elena.call("/api/playlists/shared")).json.playlists?.some((p) => p.id === pl.json.playlist.id));
check("anonymous still 404", (await anon.call(`/api/playlists/${pl.json.playlist.id}`)).status === 404);
const members = (await alex.call(`/api/playlists/${pl.json.playlist.id}/members`)).json.members;
check("owner lists members", members?.length === 1 && members[0].username === "elenavox");
check("withdraw elena", (await alex.call(`/api/playlists/${pl.json.playlist.id}/members?userId=${members[0].userId}`, "DELETE")).status === 200);
check("withdrawn → 404", (await elena.call(`/api/playlists/${pl.json.playlist.id}`)).status === 404);
const alexList = await alex.call("/api/me/lists", "POST", { name: "Night owls" });
await alex.call(`/api/me/lists/${alexList.json.list.id}/members`, "POST", { username: "elenavox" });
check("attach a list to the collection", (await alex.call(`/api/playlists/${pl.json.playlist.id}/members`, "POST", { listId: alexList.json.list.id })).status === 201);
check("list member elena opens it", (await elena.call(`/api/playlists/${pl.json.playlist.id}`)).status === 200);
check("…and finds it under shared", (await elena.call("/api/playlists/shared")).json.playlists?.some((p) => p.id === pl.json.playlist.id));
await alex.call(`/api/playlists/${pl.json.playlist.id}/members?listId=${alexList.json.list.id}`, "DELETE");
check("contacts-only", (await alex.call(`/api/playlists/${pl.json.playlist.id}`, "PATCH", { visibility: "CONTACTS_ONLY" })).status === 200);
check("contact (mia) opens it", (await mia.call(`/api/playlists/${pl.json.playlist.id}`)).status === 200);
check("non-contact (sam) → 404", (await sam.call(`/api/playlists/${pl.json.playlist.id}`)).status === 404);
check("contacts-only hidden from anonymous profile", !(await anon.call("/api/creators/alex_vance")).json.playlists?.some((p) => p.id === pl.json.playlist.id));
check("make public", (await alex.call(`/api/playlists/${pl.json.playlist.id}`, "PATCH", { visibility: "PUBLIC" })).status === 200);
check("now readable by others", (await anon.call(`/api/playlists/${pl.json.playlist.id}`)).status === 200);
check("public playlists on profile", (await anon.call("/api/creators/elenavox")).json.playlists?.length === 1);
check("delete playlist", (await alex.call(`/api/playlists/${pl.json.playlist.id}`, "DELETE")).status === 200);
check("seeded invited collection: sam opens it", (await sam.call("/api/playlists/shared")).json.playlists?.some((p) => p.title === "For Sam"));
const forSam = (await sam.call("/api/playlists/shared")).json.playlists.find((p) => p.title === "For Sam");
check("…mia does not", (await mia.call(`/api/playlists/${forSam.id}`)).status === 404);
check("a collection never opens a locked video", (await anon.call(`/api/videos/${diaries.id}/stream`)).json.allowed === false);

// Views: once per viewer and day; the author's plays never count
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const viewsOf = async (v) => (await anon.call(`/api/videos/${v.id}/details`)).json.video.viewsCount;
const before = await viewsOf(noir);
await sam.call(`/api/videos/${noir.id}/stream`);
await sam.call(`/api/videos/${noir.id}/stream`);
await mia.call(`/api/videos/${noir.id}/stream`);
await sleep(400);
check("two plays by sam + author's play → +1 view", (await viewsOf(noir)) === before + 1, `${before} → ${await viewsOf(noir)}`);

// Likes
const like = await elena.call(`/api/videos/${noir.id}/like`, "POST");
check("like", like.status === 200 && like.json.liked === true);
check("like again is idempotent", (await elena.call(`/api/videos/${noir.id}/like`, "POST")).json.likesCount === like.json.likesCount);
check("details report the like", (await elena.call(`/api/videos/${noir.id}/details`)).json.liked === true);
check("unlike", (await elena.call(`/api/videos/${noir.id}/like`, "DELETE")).json.likesCount === like.json.likesCount - 1);
check("cannot like a video you cannot watch", (await mia.call(`/api/videos/${diaries.id}/like`, "POST")).status === 403);

// Comments
const seeded = (await anon.call(`/api/videos/${noir.id}/comments`)).json.comments;
check("public discussion readable, with a reply", seeded?.length === 2 && seeded.some((c) => c.parentId));
check("comments of a locked video → 403", (await anon.call(`/api/videos/${diaries.id}/comments`)).status === 403);
const c1 = await elena.call(`/api/videos/${noir.id}/comments`, "POST", { body: "Gorgeous session." });
check("comment", c1.status === 201);
check("empty comment refused", (await elena.call(`/api/videos/${noir.id}/comments`, "POST", { body: "   " })).status === 400);
check("reply", (await alex.call(`/api/videos/${noir.id}/comments`, "POST", { body: "Agreed!", parentId: c1.json.comment.id })).status === 201);
check("comment counter follows", (await anon.call(`/api/videos/${noir.id}/details`)).json.video.commentsCount === 4);
check("a third party cannot remove it", (await sam.call(`/api/videos/${noir.id}/comments/${c1.json.comment.id}`, "DELETE")).status === 404);
check("the video's creator can", (await mia.call(`/api/videos/${noir.id}/comments/${c1.json.comment.id}`, "DELETE")).status === 200);
check("removed comment keeps its place without text", (await anon.call(`/api/videos/${noir.id}/comments`)).json.comments.find((c) => c.id === c1.json.comment.id)?.body === null);
check("creator closes comments", (await mia.call(`/api/videos/${noir.id}`, "PATCH", { commentsEnabled: false })).status === 200);
check("closed → new comment refused", (await alex.call(`/api/videos/${noir.id}/comments`, "POST", { body: "Late" })).status === 403);
await mia.call(`/api/videos/${noir.id}`, "PATCH", { commentsEnabled: true });

// Shares
const sh = await (await fetch(`${B}/api/videos/${noir.id}/shares`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel: "WHATSAPP" }) })).json();
check("anonymous share of a public video counted", sh.sharesCount === 1, JSON.stringify(sh));
check("unknown channel refused", (await alex.call(`/api/videos/${noir.id}/shares`, "POST", { channel: "FAX" })).status === 400);
check("sharing a video you cannot watch → 403", (await mia.call(`/api/videos/${diaries.id}/shares`, "POST", {})).status === 403);

// Search
check("search by title", (await anon.call("/api/feed?q=tokyo")).json.videos.length === 1);
check("search by creator", (await anon.call("/api/feed?q=mia")).json.videos.length >= 1);
check("filter by tag", (await anon.call("/api/feed?tag=acoustic")).json.videos.every((v) => v.title.match(/Noir|Rehearsal/)));
check("popular tags", (await anon.call("/api/feed")).json.tags.length > 3);
check("LIKE wildcards are literal", (await anon.call("/api/feed?q=%25")).json.videos.length === 0);

// Creator edits / deletes
check("other creator cannot edit", (await mia.call(`/api/videos/${neon.id}`, "PATCH", { title: "Hijack" })).status === 404);
check("paid unlock below $1 refused", (await elena.call(`/api/videos/${neon.id}`, "PATCH", { visibility: "TIPPED_UNLOCKED", minTipAmountCents: 50 })).status === 400);
check("creator edits title and tags", (await elena.call(`/api/videos/${neon.id}`, "PATCH", { title: "Tokyo Neon Horizons — Ep. 01", tags: ["tokyo", "neon"] })).status === 200);
const studio = (await elena.call("/api/me/dashboard")).json.data.uploads;
check("studio lists all of elena's videos with tags", studio.length === 4 && studio.some((v) => v.tags.includes("neon")));

// Admin moderation
check("member cannot list admin videos", (await alex.call("/api/admin/videos")).status === 403);
check("takedown needs a reason", (await admin.call(`/api/admin/videos/${noir.id}`, "PATCH", { action: "remove" })).status === 400);
check("admin takes Midnight Noir down", (await admin.call(`/api/admin/videos/${noir.id}`, "PATCH", { action: "remove", reason: "DMCA claim upheld" })).status === 200);
check("removed video gone from feed", !(await anon.call("/api/feed?limit=60")).json.videos.some((v) => v.id === noir.id));
check("removed video stream → 404 even for its author", (await mia.call(`/api/videos/${noir.id}/stream`)).status === 404);
check("details → 404", (await anon.call(`/api/videos/${noir.id}/details`)).status === 404);
check("catalogue lists takedown with reason", (await admin.call("/api/admin/videos?state=removed")).json.videos.some((v) => v.removalReason === "DMCA claim upheld"));
check("creator studio shows takedown reason", (await mia.call("/api/me/dashboard")).json.data.uploads.some((v) => v.removalReason === "DMCA claim upheld"));
check("restore", (await admin.call(`/api/admin/videos/${noir.id}`, "PATCH", { action: "restore" })).status === 200);
check("restored video back in feed", (await anon.call("/api/feed?limit=60")).json.videos.some((v) => v.id === noir.id));

// Accounts
const users = (await admin.call("/api/admin/users")).json.users;
const samUser = users.find((u) => u.username === "sam_rivers");
const adminUser = users.find((u) => u.username === "orochia_admin");
check("admin cannot suspend themselves", (await admin.call(`/api/admin/users/${adminUser.id}`, "PATCH", { action: "suspend", reason: "test" })).status === 400);
check("suspend sam", (await admin.call(`/api/admin/users/${samUser.id}`, "PATCH", { action: "suspend", reason: "Chargeback fraud" })).status === 200);
check("sam's open session refused at once", (await sam.call("/api/me/network")).json.error === "Account suspended");
check("sam cannot sign in", (await session("sam@sanctuary.io", "sam1234")).status === 403);
check("suspended filter", (await admin.call("/api/admin/users?suspended=true")).json.users.length === 1);
check("reinstate", (await admin.call(`/api/admin/users/${samUser.id}`, "PATCH", { action: "reinstate" })).status === 200);
check("sam's session works again", (await sam.call("/api/me/network")).status === 200);
check("promote sam to creator", (await admin.call(`/api/admin/users/${samUser.id}`, "PATCH", { action: "set-role", role: "CREATOR" })).status === 200);
check("new role effective without re-login", (await sam.call("/api/creator/payouts")).status === 200);
await admin.call(`/api/admin/users/${samUser.id}`, "PATCH", { action: "set-role", role: "MEMBER" });
check("demotion effective too", (await sam.call("/api/creator/payouts")).status === 403);

// Pages render
for (const p of ["/", "/explore", "/explore?q=tokyo", "/explore?tag=acoustic", "/creators/elenavox", "/dashboard", "/watch/" + diaries.id]) {
  const r = await fetch(B + p);
  check(`page ${p} → 200`, r.status === 200, r.status);
}
const plid = (await anon.call("/api/creators/elenavox")).json.playlists[0].id;
check("playlist page → 200", (await fetch(`${B}/playlists/${plid}`)).status === 200);

// Bunny Stream webhook (signature v1, keyed with the library's read-only API key)
{
  const { createHmac } = await import("node:crypto");
  const { existsSync, readFileSync } = await import("node:fs");
  // The environment first (CI), the local .env otherwise — the same values the running app reads.
  const envFile = new URL("../.env", import.meta.url);
  const fromFile = (name) =>
    existsSync(envFile) ? readFileSync(envFile, "utf8").match(new RegExp(`^${name}=(.*)$`, "m"))?.[1]?.trim() : undefined;
  const key = process.env.BUNNY_WEBHOOK_SECRET || fromFile("BUNNY_WEBHOOK_SECRET");
  const library = Number(process.env.BUNNY_STREAM_LIBRARY_ID || fromFile("BUNNY_STREAM_LIBRARY_ID") || 1);
  const guid = "9b4d3eaa-6f5a-4c8b-0d1e-2f3a4b5c6d7e"; // "Afterhours", seeded PROCESSING
  const send = (status, { lib = library, signWith = key, version = "v1" } = {}) => {
    const body = JSON.stringify({ VideoLibraryId: lib, VideoGuid: guid, Status: status });
    return fetch(`${B}/api/webhooks/bunny`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-BunnyStream-Signature-Version": version,
        "X-BunnyStream-Signature-Algorithm": "hmac-sha256",
        "X-BunnyStream-Signature": createHmac("sha256", signWith).update(body).digest("hex"),
      },
      body,
    });
  };
  if (!key) {
    check("bunny webhook scenarios need BUNNY_WEBHOOK_SECRET", false);
  } else {
    const listed = async () => (await anon.call("/api/feed?limit=60")).json.videos.some((v) => v.title.startsWith("Afterhours"));
    check("webhook signed with another key → 401", (await send(3, { signWith: "not-the-key" })).status === 401);
    check("webhook with another signature version → 401", (await send(3, { version: "v2" })).status === 401);
    check("another library's event is ignored", (await (await send(3, { lib: library + 1 })).json()).ignored === "library" && !(await listed()));
    check("'one resolution finished' (4) does not publish", (await (await send(4)).json()).status === "PROCESSING" && !(await listed()));
    check("captions generated (9) change nothing", (await (await send(9)).json()).ignored === "status");
    check("'finished' (3) makes the video READY and listed", (await (await send(3)).json()).status === "READY" && (await listed()));
    check("a late 'encoding' (2) never un-publishes it", (await (await send(2)).json()).status === "READY" && (await listed()));
  }
}

// Accounts: an unverified e-mail can only sign in and ask for the link; links point to this origin
{
  const stamp = Date.now().toString(36);
  const email = `new_${stamp}@example.com`;
  const jar = { cookie: "" };
  const call = async (path, method = "GET", body) => {
    const res = await fetch(B + path, { method, headers: { Cookie: jar.cookie, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const set = res.headers.get("set-cookie");
    if (set) jar.cookie = set.split(";")[0];
    let json = {}; try { json = await res.json(); } catch {}
    return { status: res.status, json };
  };
  const reg = await call("/api/auth/register", "POST", { username: `new_${stamp}`, email, displayName: "New Member", password: "first-password-1", dateOfBirth: "1990-01-01", isAgeVerified: true, acceptTerms: true });
  check("register → verification required", reg.status === 201 && reg.json.verificationRequired === true);
  const firstLink = reg.json.devVerificationUrl ?? "";
  check("verification link on this origin", firstLink.startsWith(`${B}/auth/verify?token=`), firstLink);
  check("signed in but unverified", (await call("/api/auth/me")).json.user?.emailVerified === false);
  check("unverified → every action refused", (await call("/api/playlists", "POST", { title: "x" })).json.error === "Email not verified");
  check("unverified → dashboard API refused", (await call("/api/me/dashboard")).status === 403);
  const again = await call("/api/auth/resend-verification", "POST");
  check("resend the link", again.status === 200 && again.json.devVerificationUrl?.startsWith(`${B}/auth/verify?token=`));
  const tokenOf = (link) => new URL(link).searchParams.get("token");
  check("the previous link stops working", (await call("/api/auth/verify-email", "POST", { token: tokenOf(firstLink) })).status === 400);
  check("verify with the new link", (await call("/api/auth/verify-email", "POST", { token: tokenOf(again.json.devVerificationUrl) })).status === 200);
  check("a link works once", (await call("/api/auth/verify-email", "POST", { token: tokenOf(again.json.devVerificationUrl) })).status === 400);
  check("verified → session refreshed", (await call("/api/auth/me")).json.user?.emailVerified === true);
  check("verified → actions allowed", (await call("/api/playlists", "POST", { title: "Mine" })).status === 201);
  const unknown = await call("/api/auth/forgot-password", "POST", { email: `nobody_${stamp}@example.com` });
  check("forgot password never reveals an address", unknown.status === 200 && !unknown.json.devResetUrl);
  const forgot = await call("/api/auth/forgot-password", "POST", { email });
  check("reset link on this origin", forgot.json.devResetUrl?.startsWith(`${B}/auth/reset-password?token=`), JSON.stringify(forgot.json));
  check("short password refused", (await call("/api/auth/reset-password", "POST", { token: tokenOf(forgot.json.devResetUrl), password: "short" })).status === 400);
  check("reset the password", (await call("/api/auth/reset-password", "POST", { token: tokenOf(forgot.json.devResetUrl), password: "second-password-2" })).status === 200);
  check("reset link works once", (await call("/api/auth/reset-password", "POST", { token: tokenOf(forgot.json.devResetUrl), password: "third-password-3" })).status === 400);
  check("old password refused", (await session(email, "first-password-1")).status === 401);
  const me = await session(email, "second-password-2");
  check("new password accepted", me.status === 200);
  check("a new account is a member", (await me.call("/api/auth/me")).json.user?.role === "MEMBER");
  check("a member cannot publish stories", (await me.call("/api/stories/upload-session", "POST", { sizeBytes: 1000 })).status === 403);
  check("a member has no editor drafts", (await me.call("/api/me/drafts")).status === 403);
  const become = await me.call("/api/me/become-creator", "POST");
  check("become a creator → pending 2257 review", become.json.role === "CREATOR" && become.json.verificationPending === true);
  check("…still cannot publish until verified", (await me.call("/api/stories/upload-session", "POST", { sizeBytes: 1000 })).json.error?.includes("pending"));
  check("…nor keep editor drafts", (await me.call("/api/me/drafts", "POST", { kind: "STORY", fileName: "a.mp4", contentType: "video/mp4", sizeBytes: 1000, edit: {} })).status === 403);
  check("…and still unlocks like a member", (await me.call("/api/videos/unlock-video", "POST", { videoId: feed[0].id, amountCents: 100, gateway: "CREDITS" })).status !== 403);
}

// Profile: links, pictures, date of birth, notifications, public pages
{
  const tooYoung = new Date(Date.now() - 17 * 365.25 * 86400000).toISOString().slice(0, 10);
  const minor = await fetch(`${B}/api/auth/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: `minor_${Date.now()}`, email: `minor${Date.now()}@example.com`, displayName: "Minor", password: "a-long-password-1", dateOfBirth: tooYoung, isAgeVerified: true, acceptTerms: true }) });
  check("under 18 cannot register, whatever is ticked", minor.status === 403);
  const noBirth = await fetch(`${B}/api/auth/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: `nob_${Date.now()}`, email: `nob${Date.now()}@example.com`, displayName: "N", password: "a-long-password-1", isAgeVerified: true, acceptTerms: true }) });
  check("a date of birth is required", noBirth.status === 400);

  const put = (who, body) => who.call("/api/me/profile", "PUT", body);
  check("links saved as handles", (await put(alex, { socialLinks: { instagram: "https://instagram.com/alex.dev/", x: "@alexdev" }, websiteUrl: "alex.dev" })).status === 200);
  const mine = (await alex.call("/api/me/profile")).json.profile;
  check("…and built into URLs by the server", mine.links.some((l) => l.url === "https://instagram.com/alex.dev") && mine.websiteUrl === "https://alex.dev/");
  check("a link to another site is refused", (await put(alex, { socialLinks: { instagram: "https://evil.example/x" } })).status === 400);
  check("a javascript: website is refused", (await put(alex, { websiteUrl: "javascript:alert(1)" })).status === 400);
  check("a picture URL chosen by the client is refused", (await put(alex, { avatar: "https://tracker.example/p.gif" })).status === 400);
  check("a preset picture is accepted", (await put(alex, { avatar: "avatar-02" })).status === 200 && (await alex.call("/api/me/profile")).json.profile.avatarUrl === "/defaults/avatars/avatar-02.svg");
  check("notification choices are kept", (await put(alex, { emailsOff: ["newMessage", "bogus"] })).status === 200 && JSON.stringify((await alex.call("/api/me/profile")).json.profile.emailsOff) === '["newMessage"]');
  check("a recorded date of birth cannot be rewritten", (await alex.call("/api/me/birth-date", "POST", { dateOfBirth: "1980-01-01" })).status === 409);
  check("a member has a public page", (await fetch(`${B}/creators/alex_vance`)).status === 200);
  check("the operator account has a public page", (await fetch(`${B}/creators/orochia_admin`)).status === 200);
  check("the e-mail never appears on a public page", !(await (await fetch(`${B}/creators/alex_vance`)).text()).includes("alex@sanctuary.io"));
}

// Usernames, profile addresses, notifications
{
  const taken = (await anon.call("/api/auth/username?username=alex_vance")).json;
  check("a taken username offers a free one", taken.available === false && taken.reason === "taken" && taken.suggestion === "alex_vance2");
  check("a reserved username is refused", (await anon.call("/api/auth/username?username=admin")).json.reason === "reserved");
  check("a free username is available", (await anon.call(`/api/auth/username?username=free_${Date.now().toString(36)}`)).json.available === true);
  check("profiles live at /@username", (await fetch(`${B}/@alex_vance`)).status === 200);
  const old = await fetch(`${B}/creators/alex_vance`, { redirect: "manual" });
  check("the old address redirects there", old.status === 308 && (old.headers.get("location") ?? "").endsWith("/@alex_vance"));

  await elena.call("/api/me/notifications", "POST", { all: true });
  const target = feed.find((v) => v.creatorUsername === "elenavox" && v.visibility === "PUBLIC");
  check("elena has a public video to comment on", Boolean(target));
  await alex.call(`/api/videos/${target.id}/comments`, "POST", { body: "Love this one" });
  let inbox = { items: [], unread: 0 };
  for (let i = 0; i < 20 && !inbox.items.some((n) => n.event === "newComment" && !n.readAt); i++) {
    await new Promise((r) => setTimeout(r, 150));
    inbox = (await elena.call("/api/me/notifications")).json;
  }
  check("a comment notifies the creator in the app", inbox.items.some((n) => n.event === "newComment" && n.text.includes("commented")));
  check("…unread until read", inbox.unread >= 1);
  check("someone else's notification cannot be marked read", (await alex.call("/api/me/notifications", "POST", { ids: [inbox.items[0].id] })).status === 200 && (await elena.call("/api/me/notifications")).json.unread >= 1);
  await elena.call("/api/me/notifications", "POST", { all: true });
  check("mark all as read", (await elena.call("/api/me/notifications")).json.unread === 0);
  check("e-mail pace is a setting", (await alex.call("/api/me/profile", "PUT", { emailFrequency: "HOURLY" })).status === 200 && (await alex.call("/api/me/profile")).json.profile.emailFrequency === "HOURLY");
}

// Upload limits and editor drafts (no Bunny call: every request below is refused before it)
{
  const edit = { startSeconds: 0, endSeconds: 10, speed: 1, filter: "none", brightness: 0, contrast: 0, saturation: 0, format: "vertical", focusX: 0.5, focusY: 0.5, volume: 1, fadeIn: false, fadeOut: false, denoise: false, musicVolume: 0.6 };
  const draft = (over) => elena.call("/api/me/drafts", "POST", { kind: "VIDEO", fileName: "clip.mp4", contentType: "video/mp4", sizeBytes: 1000, edit, ...over });
  check("a video above 4 GB is refused before any upload", (await elena.call("/api/videos/create-upload-session", "POST", { title: "Too big", visibility: "PUBLIC", sizeBytes: 5 * 1024 ** 3 })).status === 400);
  check("a story clip above 250 MB is refused", (await elena.call("/api/stories/upload-session", "POST", { sizeBytes: 300 * 1024 ** 2 })).status === 400);
  check("a draft above 400 MB is refused", (await draft({ sizeBytes: 500 * 1024 ** 2 })).status === 400);
  check("a draft with impossible settings is refused", (await draft({ edit: { ...edit, speed: 7 } })).status === 400);
  check("a draft must be a video", (await draft({ contentType: "text/html" })).status === 400);
  check("creator lists own drafts", Array.isArray((await elena.call("/api/me/drafts?kind=VIDEO")).json.drafts));
  check("someone else's draft is 404", (await elena.call("/api/me/drafts/00000000-0000-4000-8000-000000000000")).status === 404);
  check("an invalid draft id is 404", (await elena.call("/api/me/drafts/not-a-uuid", "DELETE")).status === 404);
}

// Sign in with Google / Facebook: offered only when configured; a forged callback goes nowhere
{
  const providers = (await anon.call("/api/auth/providers")).json.providers ?? [];
  for (const p of ["google", "facebook"].filter((x) => !providers.includes(x))) {
    check(`${p} not configured → its sign-in answers 404`, (await fetch(`${B}/api/auth/oauth/${p}/start`, { redirect: "manual" })).status === 404);
  }
  const forged = await fetch(`${B}/api/auth/oauth/google/callback?code=x&state=y`, { redirect: "manual" });
  check("a callback without its state cookie is refused", forged.status >= 300 && forged.status < 400 && (forged.headers.get("location") ?? "").includes("/auth/login?error="));
  check("unknown provider callback is refused", ((await fetch(`${B}/api/auth/oauth/myspace/callback`, { redirect: "manual" })).headers.get("location") ?? "").includes("error="));
  check("nothing to complete without a provider sign-in", (await anon.call("/api/auth/oauth/pending")).status === 404);
  const complete = await fetch(`${B}/api/auth/oauth/complete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "x_y_z", displayName: "X", dateOfBirth: "1990-01-01", isAgeVerified: true, acceptTerms: true }) });
  check("…and no account created from nothing", complete.status === 410);
}

// Stories: audience on the server, one view per viewer, likes, removal
{
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  const upload = async (who) => {
    const form = new FormData();
    form.append("category", "stories");
    form.append("file", new Blob([png], { type: "image/png" }), "story.png");
    const r = await fetch(`${B}/api/uploads`, { method: "POST", headers: { Cookie: who.cookie }, body: form });
    return (await r.json()).data;
  };
  const stored = await upload(elena);
  check("story image stored", /^stories\/[0-9a-f-]{36}\.png$/.test(stored?.ref ?? ""), JSON.stringify(stored));
  check("a client-chosen media URL is not accepted", (await elena.call("/api/stories", "POST", { imageRef: "stories/../../etc.png" })).status === 400);
  const contactsOnly = await elena.call("/api/stories", "POST", { imageRef: stored.ref, caption: "For my contacts", audience: "CONTACTS_ONLY" });
  check("creator posts a contacts-only story", contactsOnly.status === 201);
  const storyId = contactsOnly.json.story.id;
  const ringOf = async (who, username) => (await who.call("/api/stories")).json.rings?.find((r) => r.username === username);
  check("a contact (alex) sees it", (await ringOf(alex, "elenavox"))?.stories.some((s) => s.id === storyId));
  check("a stranger (mia) does not", !(await ringOf(mia, "elenavox"))?.stories.some((s) => s.id === storyId));
  check("anonymous does not", !(await anon.call("/api/stories")).json.rings?.some((r) => r.stories.some((s) => s.id === storyId)));
  check("a stranger cannot count a view", (await mia.call(`/api/stories/${storyId}/view`, "POST")).status === 404);
  await alex.call(`/api/stories/${storyId}/view`, "POST");
  await alex.call(`/api/stories/${storyId}/view`, "POST");
  check("a view counts once", (await ringOf(elena, "elenavox")).stories.find((s) => s.id === storyId).viewsCount === 1);
  check("seen by the viewer", (await ringOf(alex, "elenavox")).stories.find((s) => s.id === storyId).seen === true);
  check("like", (await alex.call(`/api/stories/${storyId}/like`, "POST")).json.likesCount === 1);
  check("own ring comes first", (await elena.call("/api/stories")).json.rings[0]?.isOwn === true);
  check("another creator cannot remove it", (await mia.call(`/api/stories/${storyId}`, "DELETE")).status === 404);
  check("its creator removes it", (await elena.call(`/api/stories/${storyId}`, "DELETE")).status === 200);
  check("removed → gone from the rail", !(await ringOf(alex, "elenavox"))?.stories.some((s) => s.id === storyId));
}

// Orochia credits: a wallet — top up (test top-up here), spend on unlocks; not enough credits → 402 with the balance
{
  const paid = feed.find((v) => v.visibility === "TIPPED_UNLOCKED");
  check("credits are always a way to pay", ((await mia.call("/api/payments/gateways")).json.gateways ?? [])[0] === "CREDITS");
  const empty = (await mia.call("/api/me/wallet")).json;
  check("a wallet starts with its balance and the packs", typeof empty.balanceCents === "number" && empty.packs.length === 4);
  check("mia cannot watch the paid video yet", (await mia.call(`/api/videos/${paid.id}/stream`)).json.reason === "PAYWALL_REQUIRED");
  check("below the minimum is refused", (await mia.call("/api/videos/unlock-video", "POST", { videoId: paid.id, amountCents: 100, gateway: "CREDITS" })).status === 400);
  if (empty.balanceCents < paid.minTipAmountCents) {
    const short = await mia.call("/api/videos/unlock-video", "POST", { videoId: paid.id, amountCents: paid.minTipAmountCents, gateway: "CREDITS" });
    check("not enough credits → 402 with the balance", short.status === 402 && short.json.balanceCents === empty.balanceCents);
  }
  check("an unknown pack is refused", (await mia.call("/api/me/wallet/topups", "POST", { packId: "free", gateway: "TEST" })).status === 400);
  check("a test top-up adds the credits (test environments only)", (await mia.call("/api/me/wallet/topups", "POST", { packId: "plus", gateway: "TEST" })).json.settled === true);
  const topped = (await mia.call("/api/me/wallet")).json;
  check("…with the pack's bonus", topped.balanceCents === empty.balanceCents + 2600 && topped.history[0].type === "TOPUP");
  const unlock = await mia.call("/api/videos/unlock-video", "POST", { videoId: paid.id, amountCents: paid.minTipAmountCents, gateway: "CREDITS" });
  check("unlock with credits settles at once", unlock.json.settled === true, JSON.stringify(unlock.json));
  check("…spends exactly the price", (await mia.call("/api/me/wallet")).json.balanceCents === topped.balanceCents - paid.minTipAmountCents);
  check("…and opens the video", (await mia.call(`/api/videos/${paid.id}/stream`)).json.allowed === true);
  check("nobody can post a credits webhook", (await fetch(`${B}/api/webhooks/payments/credits`, { method: "POST", body: "{}" })).status === 404);
}

// Earnings, exports, payout account
{
  const e = (await elena.call("/api/creator/earnings?period=all")).json;
  check("earnings: totals from the ledger", e.summary.netCents > 0 && e.summary.payments > 0 && e.summary.totalViews > 0);
  check("earnings: every video with what it brings in", e.videos.length > 0 && e.videos[0].netCents >= e.videos[e.videos.length - 1].netCents);
  check("earnings: 12 months of trend", e.monthly.length === 12);
  check("a member has no earnings page data", (await alex.call("/api/creator/earnings")).status === 403);
  const csv = await fetch(`${B}/api/creator/earnings/export?kind=transactions&period=all`, { headers: { Cookie: elena.cookie } });
  const body = await csv.text();
  check("transactions export as CSV", csv.status === 200 && (csv.headers.get("content-type") ?? "").startsWith("text/csv") && body.includes("date_utc,type,video"));
  check("a bad IBAN is refused", (await elena.call("/api/me/payout-account", "PUT", { method: "BANK_IBAN", holderName: "Elena Vox", country: "FR", details: { iban: "FR7630006000011234567890188" } })).status === 400);
  const saved = await elena.call("/api/me/payout-account", "PUT", { method: "BANK_IBAN", holderName: "Elena Vox", country: "FR", details: { iban: "FR76 3000 6000 0112 3456 7890 189" } });
  check("a valid IBAN is saved and shown masked", saved.status === 200 && saved.json.account.hint === "IBAN FR •••• 0189" && !JSON.stringify(saved.json).includes("30006000011234567890189"));
  check("a US routing number is checked", (await elena.call("/api/me/payout-account", "PUT", { method: "BANK_US", holderName: "Elena Vox", country: "US", details: { routingNumber: "123456789", accountNumber: "000123456789" } })).status === 400);
  check("below the payout minimum is refused", (await elena.call("/api/creator/payouts", "POST", { amountCents: 500 })).status === 400);
}

// Reference Data & Presets
{
  const reference = (await anon.call("/api/reference/content-ratings")).json.ratings ?? [];
  check("content ratings exist in every environment (baseline migration), in English", reference.length === 5 && reference.some((r) => r.id === "GENERAL" && r.label === "General audience"));
  const ratings = (await anon.call("/api/reference/content-ratings")).json.ratings;
  check("content ratings served", Array.isArray(ratings) && ratings.some((r) => r.id === "GENERAL"));
  const presets = (await anon.call("/api/reference/presets")).json;
  check("preset assets served", Array.isArray(presets.avatars) && Array.isArray(presets.banners) && presets.avatars.length >= 8);
}

// User Invitations
{
  const invite = await alex.call("/api/me/invitations", "POST", { email: "newfriend@test.org" });
  check("generate invite code", invite.status === 201 && typeof invite.json.invitation?.code === "string");
  const myInvites = (await alex.call("/api/me/invitations")).json.invitations;
  check("list sent invitations", Array.isArray(myInvites) && myInvites.some((i) => i.code === invite.json.invitation.code));
}

// Direct Messaging & Realtime
{
  const conv = await elena.call("/api/conversations", "POST", { recipientUsername: "miasterling" });
  check("create or get conversation", conv.status === 200 || conv.status === 201);
  const convId = conv.json.conversationId;
  const sentMsg = await elena.call(`/api/conversations/${convId}/messages`, "POST", { content: "Hey Mia, let's collab!" });
  check("post direct message", sentMsg.status === 201 && sentMsg.json.message?.content === "Hey Mia, let's collab!");
  const miaConvs = (await mia.call("/api/conversations")).json.conversations;
  check("recipient sees conversation", Array.isArray(miaConvs) && miaConvs.some((c) => c.id === convId));
}

// User Blocking & Privacy
{
  const blockRes = await sam.call("/api/users/alex_vance/block", "POST");
  check("block user", blockRes.status === 200 && blockRes.json.blocked === true);
  const myBlocks = (await sam.call("/api/me/blocks")).json.blocked;
  check("list blocked users", Array.isArray(myBlocks) && myBlocks.some((b) => b.blockedUsername === "alex_vance"));
  const unblockRes = await sam.call("/api/users/alex_vance/block", "POST");
  check("unblock user", unblockRes.status === 200 && unblockRes.json.blocked === false);
}

// Auctions: bids in credits held while they lead and released when outbid, a soft close, aliases for bidders,
// the creator's decision or an automatic sale, exclusive access and downloads for the winner, cancellations.
// Time is moved forward in the database (the only SQL here): closing is then checked through the API.
{
  const { default: pg } = await import("pg");
  const sqlClient = new pg.Client({ connectionString: process.env.DATABASE_URL || "postgresql://orochia_user:orochia_secret@localhost:5432/orochia_db?sslmode=disable" });
  await sqlClient.connect();
  const endIn = (id, interval) => sqlClient.query(`update auctions set ends_at = now() + $2::interval where id = $1`, [id, interval]);
  const hour = 3600_000;
  const auctionBody = (videoId, extra = {}) => ({ videoId, startingPriceCents: 1000, startsAt: new Date(), endsAt: new Date(Date.now() + 2 * hour), rights: "WATCH", settlement: "CREATOR_DECIDES", ...extra });
  const wallet = async (s) => (await s.call("/api/me/wallet")).json;
  const bid = (s, id, amountCents) => s.call(`/api/auctions/${id}/bids`, "POST", { amountCents });

  check("a member cannot start an auction", (await alex.call("/api/auctions", "POST", auctionBody(neon.id))).status === 403);
  check("another creator's video → 404", (await mia.call("/api/auctions", "POST", auctionBody(neon.id))).status === 404);
  const short = await elena.call("/api/auctions", "POST", auctionBody(neon.id, { endsAt: new Date(Date.now() + 10 * 60_000) }));
  check("an auction shorter than an hour is refused", short.status === 400 && short.json.problem === "TOO_SHORT");
  const created = await elena.call("/api/auctions", "POST", auctionBody(neon.id, { rights: "DOWNLOAD" }));
  check("the creator puts a video up for auction", created.status === 201, JSON.stringify(created.json));
  const id = created.json.auctionId;
  check("…nobody else plays it any more", (await alex.call(`/api/videos/${neon.id}/stream`)).json.reason === "AUCTION");
  check("…its author still does", (await elena.call(`/api/videos/${neon.id}/stream`)).json.allowed === true);
  check("…its audience is locked during the auction", (await elena.call(`/api/videos/${neon.id}`, "PATCH", { visibility: "PUBLIC" })).status === 409);
  check("…it cannot be deleted during the auction", (await elena.call(`/api/videos/${neon.id}`, "DELETE")).status === 409);
  check("a second auction of the same video → 409", (await elena.call("/api/auctions", "POST", auctionBody(neon.id))).status === 409);
  check("listed among open auctions", (await anon.call("/api/auctions?tab=open")).json.items.some((a) => a.id === id));
  check("the watch page finds it", (await anon.call(`/api/videos/${neon.id}/auction`)).json.auction?.id === id);
  check("the creator cannot bid", (await bid(elena, id, 1000)).status === 403);
  check("a visitor cannot bid", (await fetch(`${B}/api/auctions/${id}/bids`, { method: "POST", headers: { "Content-Type": "application/json" }, body: '{"amountCents":1000}' })).status === 401);

  await alex.call("/api/me/wallet/topups", "POST", { packId: "plus", gateway: "TEST" });
  await sam.call("/api/me/wallet/topups", "POST", { packId: "plus", gateway: "TEST" });
  const alexBefore = (await wallet(alex)).balanceCents;
  const samBefore = (await wallet(sam)).balanceCents;
  const low = await bid(alex, id, 900);
  check("below the starting price → 409 with the minimum", low.status === 409 && low.json.minimum === 1000);
  const tooMuch = await bid(alex, id, alexBefore + 100);
  check("more than the wallet → 402 with the balance", tooMuch.status === 402 && tooMuch.json.balance === alexBefore);

  // The live feed: a bid reaches an open stream.
  const controller = new AbortController();
  const stream = await fetch(`${B}/api/auctions/${id}/stream`, { signal: controller.signal });
  const reader = stream.body.getReader();
  const firstBid = (async () => {
    let text = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return null;
      text += new TextDecoder().decode(value);
      const line = text.split("\n").find((l) => l.startsWith("data: ") && l.includes('"type":"bid"'));
      if (line) return JSON.parse(line.slice(6));
    }
  })();
  const b1 = await bid(alex, id, 1000);
  check("alex bids $10 and becomes Bidder 1", b1.status === 200 && b1.json.alias === 1, JSON.stringify(b1.json));
  const pushed = await Promise.race([firstBid, sleep(5000).then(() => null)]);
  controller.abort();
  check("…every viewer receives the bid live, without names", pushed?.highestBidCents === 1000 && pushed.bid.alias === 1 && !JSON.stringify(pushed).includes("alex"));
  const held = await wallet(alex);
  check("…his credits are held", held.balanceCents === alexBefore - 1000 && held.heldCents === 1000 && held.history[0].type === "HOLD");
  check("the next minimum is one step up", (await anon.call(`/api/auctions/${id}`)).json.auction.minimumNextBidCents === 1100);
  check("sam outbids at $12 (Bidder 2)", (await bid(sam, id, 1200)).json.alias === 2);
  const released = await wallet(alex);
  check("alex's credits come back at once", released.balanceCents === alexBefore && released.heldCents === 0 && released.history[0].type === "RELEASE");
  const seen = (await alex.call(`/api/auctions/${id}`)).json.auction;
  check("alex sees he is outbid; bidders are aliases", !seen.viewer.isLeader && seen.viewer.alias === 1 && seen.recentBids[0].alias === 2 && !JSON.stringify(seen).includes("sam_rivers"));
  check("the creator sees who leads", (await elena.call(`/api/auctions/${id}`)).json.auction.leaderUsername === "sam_rivers");
  await sleep(500);
  check("the outbid bidder is notified", (await alex.call("/api/me/notifications")).json.items.some((n) => n.event === "auctionOutbid"));
  check("the creator is notified of bids", (await elena.call("/api/me/notifications")).json.items.some((n) => n.event === "auctionNewBid"));
  check("an auction with bids cannot be cancelled by its creator", (await elena.call(`/api/auctions/${id}`, "DELETE")).status === 409);

  await endIn(id, "30 seconds");
  const late = await bid(alex, id, 1300);
  check("a bid in the last 2 minutes pushes the end back", late.json.extended === true && new Date(late.json.endsAt).getTime() - Date.now() > 100_000, JSON.stringify(late.json));

  await endIn(id, "-1 second");
  const ended = (await elena.call(`/api/auctions/${id}`)).json.auction;
  check("past its end, it waits for the creator's decision", ended.status === "AWAITING_DECISION" && Boolean(ended.decisionDeadline));
  check("bidding is closed", (await bid(sam, id, 5000)).status === 409);
  check("only its creator decides", (await mia.call(`/api/auctions/${id}/decision`, "POST", { accept: true })).status === 404);
  check("the creator declines", (await elena.call(`/api/auctions/${id}/decision`, "POST", { accept: false })).json.status === "DECLINED");
  const afterDecline = await wallet(alex);
  check("…the best bidder's credits come back", afterDecline.balanceCents === alexBefore && afterDecline.heldCents === 0);
  check("…the video has its audience back", (await alex.call(`/api/videos/${neon.id}/stream`)).json.allowed === true);

  const auto = await elena.call("/api/auctions", "POST", auctionBody(neon.id, { rights: "DOWNLOAD", settlement: "HIGHEST_BID" }));
  const id2 = auto.json.auctionId;
  check("the video goes up again, to sell to the highest bid", auto.status === 201);
  const earningsBefore = (await elena.call("/api/creator/earnings?period=all")).json.summary.netCents;
  check("sam bids $10", (await bid(sam, id2, 1000)).status === 200);
  check("others cannot download it", (await alex.call(`/api/videos/${neon.id}/download`)).status === 403);
  await endIn(id2, "-1 second");
  const sold = (await sam.call(`/api/auctions/${id2}`)).json.auction;
  check("it sells itself to the highest bid", sold.status === "SOLD" && sold.viewer.won && sold.viewer.canDownload);
  check("the winner watches it", (await sam.call(`/api/videos/${neon.id}/stream`)).json.allowed === true);
  check("…and only the winner", (await alex.call(`/api/videos/${neon.id}/stream`)).json.reason === "AUCTION");
  const download = await sam.call(`/api/videos/${neon.id}/download`);
  check("the winner downloads it (a short-lived signed MP4)", download.status === 200 && /play_\d+p\.mp4\?token=/.test(download.json.url ?? ""), JSON.stringify(download.json));
  const samAfter = await wallet(sam);
  check("the winner paid exactly the bid, nothing held", samAfter.balanceCents === samBefore - 1000 && samAfter.heldCents === 0 && samAfter.history.some((h) => h.type === "SPEND"));
  check("the creator is credited through the ledger", (await elena.call("/api/creator/earnings?period=all")).json.summary.netCents > earningsBefore);
  check("a sold video is never auctioned again", (await elena.call("/api/auctions", "POST", auctionBody(neon.id))).status === 409);
  check("listed among sold auctions", (await anon.call("/api/auctions?tab=ended")).json.items.some((a) => a.id === id2));
  check("the winner finds it in their bids", (await sam.call("/api/auctions?tab=bidding")).json.items.some((a) => a.id === id2 && a.leading));
  check("the creator finds both in their auctions", (await elena.call("/api/auctions?tab=selling")).json.items.filter((a) => a.videoId === neon.id).length === 2);
  await sleep(500);
  check("the winner is notified", (await sam.call("/api/me/notifications")).json.items.some((n) => n.event === "auctionWon"));

  const later = await elena.call("/api/auctions", "POST", auctionBody(diaries.id, { startsAt: new Date(Date.now() + hour), endsAt: new Date(Date.now() + 3 * hour) }));
  const id3 = later.json.auctionId;
  check("an auction can be scheduled", later.status === 201 && (await anon.call("/api/auctions?tab=upcoming")).json.items.some((a) => a.id === id3));
  check("bidding opens only at its start", (await bid(alex, id3, 1000)).status === 409);
  check("without bids, its creator cancels it", (await elena.call(`/api/auctions/${id3}`, "DELETE")).status === 200);
  check("…and the video has its audience back", (await sam.call(`/api/videos/${diaries.id}/stream`)).json.allowed === true);

  const id4 = (await elena.call("/api/auctions", "POST", auctionBody(diaries.id))).json.auctionId;
  await bid(alex, id4, 1000);
  check("an operator cancels an auction with bids", (await admin.call(`/api/admin/auctions/${id4}`, "DELETE", { reason: "Reported content under review" })).status === 200);
  check("…the bid's credits come back", (await wallet(alex)).heldCents === 0);
  check("operators list every auction", ((await admin.call("/api/admin/auctions")).json.auctions ?? []).length >= 4);
  check("members cannot", (await alex.call("/api/admin/auctions")).status === 403);
  await sqlClient.end();
}

// Challenges: a creator's all-or-nothing goal, a dare to one creator (accept or decline), an open call creators apply
// to; pledges in credits held until delivery, paid then, given back when it does not happen. Deadlines are moved in
// the database (the only SQL here); everything else goes through the API.
{
  const { default: pg } = await import("pg");
  const sqlClient = new pg.Client({ connectionString: process.env.DATABASE_URL || "postgresql://orochia_user:orochia_secret@localhost:5432/orochia_db?sslmode=disable" });
  await sqlClient.connect();
  const shift = (id, column, interval) => sqlClient.query(`update challenges set ${column} = now() + $2::interval where id = $1`, [id, interval]);
  const wallet = async (s) => (await s.call("/api/me/wallet")).json;
  const view = async (s, id) => (await s.call(`/api/challenges/${id}`)).json.challenge;
  const pledge = (s, id, amountCents) => s.call(`/api/challenges/${id}/pledges`, "POST", { amountCents });
  const text = { description: "One take, golden hour, the rooftop of the studio.", deliverable: "VIDEO", deliveryDays: 7 };
  const inDays = (d) => new Date(Date.now() + d * 86400_000);
  for (const s of [alex, sam]) await s.call("/api/me/wallet/topups", "POST", { packId: "pro", gateway: "TEST" });
  const velvet = feed.find((v) => v.title.startsWith("Velvet Lounge"));

  // A goal
  check("a member cannot set a goal", (await alex.call("/api/challenges", "POST", { kind: "GOAL", title: "Rooftop session", ...text, goalCents: 2000, deadline: inDays(2), reward: "BACKERS" })).status === 403);
  const goal = await elena.call("/api/challenges", "POST", { kind: "GOAL", title: "Rooftop session", ...text, goalCents: 2000, deadline: inDays(2), reward: "BACKERS" });
  check("a creator sets a goal", goal.status === 201, JSON.stringify(goal.json));
  const g = goal.json.challengeId;
  check("…listed among open challenges", (await anon.call("/api/challenges")).json.items.some((c) => c.id === g && c.stage === "FUNDING"));
  check("the creator cannot back their own goal", (await pledge(elena, g, 500)).status === 403);
  const alexBefore = (await wallet(alex)).balanceCents;
  check("a pledge under $1 is refused", (await pledge(alex, g, 50)).status === 400);
  const p1 = await pledge(alex, g, 500);
  check("alex backs it with $5 (Backer 1)", p1.status === 200 && p1.json.alias === 1, JSON.stringify(p1.json));
  check("…his credits are held", (await wallet(alex)).heldCents >= 500);
  const p2 = await pledge(sam, g, 1500);
  check("sam's $15 reaches the goal", p2.json.reachedGoal === true);
  const seen = await view(alex, g);
  check("backers are aliases, the stage says the goal is reached", seen.stage === "GOAL_REACHED" && seen.recentPledges[0].alias === 2 && !JSON.stringify(seen).includes("sam_rivers"));
  check("only its creator starts it", (await alex.call(`/api/challenges/${g}/start`, "POST")).status === 403);
  check("the creator starts it", (await elena.call(`/api/challenges/${g}/start`, "POST")).json.status === "ACCEPTED");
  check("…pledging is over", (await pledge(alex, g, 500)).status === 409);
  const options = (await elena.call(`/api/challenges/${g}/delivery`)).json.items ?? [];
  check("the creator sees what they can deliver", options.some((o) => o.id === velvet.id));
  check("a video already sold at auction cannot be delivered", !options.some((o) => o.id === neon.id));
  const earningsBefore = (await elena.call("/api/creator/earnings?period=all")).json.summary.netCents;
  const delivered = await elena.call(`/api/challenges/${g}/delivery`, "POST", { videoId: velvet.id });
  check("the creator delivers", delivered.json.status === "DELIVERED", JSON.stringify(delivered.json));
  check("…the backers watch it", (await alex.call(`/api/videos/${velvet.id}/stream`)).json.allowed === true && (await sam.call(`/api/videos/${velvet.id}/stream`)).json.allowed === true);
  check("…nobody else does", (await mia.call(`/api/videos/${velvet.id}/stream`)).json.reason === "CHALLENGE");
  check("…its audience is locked", (await elena.call(`/api/videos/${velvet.id}`, "PATCH", { visibility: "PUBLIC" })).status === 409);
  check("…it cannot be deleted", (await elena.call(`/api/videos/${velvet.id}`, "DELETE")).status === 409);
  const alexAfter = await wallet(alex);
  check("…alex paid exactly his pledge", alexAfter.balanceCents === alexBefore - 500 && alexAfter.heldCents === 0);
  check("…the creator is credited through the ledger", (await elena.call("/api/creator/earnings?period=all")).json.summary.netCents > earningsBefore);
  check("listed among delivered challenges", (await anon.call("/api/challenges?tab=done")).json.items.some((c) => c.id === g));
  await sleep(500);
  check("the backers are notified", (await alex.call("/api/me/notifications")).json.items.some((n) => n.event === "challengeDelivered"));

  // A dare
  check("a member cannot be dared", (await alex.call("/api/challenges", "POST", { kind: "REQUEST", title: "Duet", ...text, creatorUsername: "sam_rivers", offerCents: 2000 })).status === 404);
  const low = await alex.call("/api/challenges", "POST", { kind: "REQUEST", title: "Duet", ...text, creatorUsername: "miasterling", offerCents: 500 });
  check("an offer below the creator's minimum → 409 with it", low.status === 409 && low.json.minimum === 1000, JSON.stringify(low.json));
  const dare = await alex.call("/api/challenges", "POST", { kind: "REQUEST", title: "Duet in the rain", ...text, creatorUsername: "miasterling", offerCents: 1200 });
  check("alex dares mia with $12", dare.status === 201, JSON.stringify(dare.json));
  const d = dare.json.challengeId;
  check("…the dare is held from his credits", (await wallet(alex)).heldCents === 1200);
  check("sam adds $3 to it", (await pledge(sam, d, 300)).status === 200);
  check("the creator sees who dared her", (await view(mia, d)).requestedBy?.username === "alex_vance");
  check("…nobody else does", (await view(sam, d)).requestedBy === null);
  check("mia finds it in her inbox", (await mia.call("/api/challenges?tab=inbox")).json.items.some((c) => c.id === d));
  check("only she answers", (await elena.call(`/api/challenges/${d}/answer`, "POST", { accept: true })).status === 404);
  check("mia declines", (await mia.call(`/api/challenges/${d}/answer`, "POST", { accept: false })).json.status === "DECLINED");
  check("…every pledge comes back", (await wallet(alex)).heldCents === 0 && (await wallet(sam)).heldCents === 0);
  check("mia turns dares off", (await mia.call("/api/me/profile", "PUT", { challengeRequestsOff: true })).status === 200);
  check("…and cannot be dared any more", (await alex.call("/api/challenges", "POST", { kind: "REQUEST", title: "Duet again", ...text, creatorUsername: "miasterling", offerCents: 2000 })).status === 403);
  await mia.call("/api/me/profile", "PUT", { challengeRequestsOff: false });

  // An open call
  const call = await sam.call("/api/challenges", "POST", { kind: "OPEN_CALL", title: "Neon city walk", ...text, deliverable: "STORY", offerCents: 1000, deadline: inDays(1) });
  check("sam posts an open call with a $10 pot", call.status === 201, JSON.stringify(call.json));
  const o = call.json.challengeId;
  check("…listed among open calls", (await anon.call("/api/challenges?tab=calls")).json.items.some((c) => c.id === o && c.creator === null));
  check("a member cannot apply", (await alex.call(`/api/challenges/${o}/applications`, "POST", { note: "me!" })).status === 403);
  check("elena applies", (await elena.call(`/api/challenges/${o}/applications`, "POST", { note: "I know the spot." })).status === 201);
  check("…once", (await elena.call(`/api/challenges/${o}/applications`, "POST", {})).status === 409);
  check("mia applies", (await mia.call(`/api/challenges/${o}/applications`, "POST", {})).status === 201);
  check("an applicant cannot pledge on it", (await pledge(elena, o, 500)).status === 403);
  const forAuthor = await view(sam, o);
  check("its author sees the applicants", forAuthor.applications.length === 2 && forAuthor.viewer.canAssign);
  check("…others only count them", (await view(alex, o)).applications.length === 0 && (await view(alex, o)).applicationsCount === 2);
  const elenaApp = forAuthor.applications.find((a) => a.creator.username === "elenavox");
  check("sam picks elena", (await sam.call(`/api/challenges/${o}/assign`, "POST", { applicationId: elenaApp.id })).json.status === "ACCEPTED");
  check("…she now makes it", (await view(anon, o)).creator?.username === "elenavox");
  await shift(o, "delivery_deadline", "-1 second");
  check("not delivered in time, it fails", (await view(sam, o)).stage === "FAILED");
  check("…and sam's pot comes back", (await wallet(sam)).heldCents === 0);

  // A goal that is not reached, and a withdrawn call
  const big = (await elena.call("/api/challenges", "POST", { kind: "GOAL", title: "Feature film", ...text, goalCents: 100000, deadline: inDays(7), reward: "EVERYONE" })).json.challengeId;
  await pledge(alex, big, 500);
  await shift(big, "deadline", "-1 second");
  check("a goal not reached by its deadline expires", (await view(alex, big)).stage === "EXPIRED");
  check("…and its pledges come back", (await wallet(alex)).heldCents === 0);
  const withdrawn = (await alex.call("/api/challenges", "POST", { kind: "OPEN_CALL", title: "Changed my mind", ...text, offerCents: 500, deadline: inDays(1) })).json.challengeId;
  check("only its author withdraws it", (await sam.call(`/api/challenges/${withdrawn}/cancel`, "POST")).status === 404);
  check("its author withdraws it", (await alex.call(`/api/challenges/${withdrawn}/cancel`, "POST")).json.status === "CANCELLED");
  check("alex finds his challenges and the ones he backs", (await alex.call("/api/challenges?tab=mine")).json.items.length >= 2 && (await alex.call("/api/challenges?tab=backing")).json.items.some((c) => c.id === g));
  check("personal tabs need a session", (await anon.call("/api/challenges?tab=mine")).status === 401);
  await sqlClient.end();
}

// Search and AI discovery: public pages only
const sitemapXml = await (await fetch(`${B}/sitemap.xml`)).text();
check("sitemap lists public videos and creators", sitemapXml.includes(`/watch/${noir.id}`) && sitemapXml.includes("/@elenavox"));
check("sitemap never lists an invited-only video", !sitemapXml.includes(roughCut.id));
check("invited-only watch page is noindex", /<meta name="robots" content="noindex/.test(await (await fetch(`${B}/watch/${roughCut.id}`)).text()));
check("public watch page carries a VideoObject", (await (await fetch(`${B}/watch/${noir.id}`)).text()).includes('"@type":"VideoObject"'));
check("robots.txt keeps accounts out", (await (await fetch(`${B}/robots.txt`)).text()).includes("Disallow: /dashboard"));
check("llms.txt served", (await fetch(`${B}/llms.txt`)).status === 200);

// The operator console's service token: ADMIN routes only, never a member's.
if (process.env.OROCHIA_ADMIN_API_TOKEN) {
  const bearer = (token) => ({ headers: { Authorization: `Bearer ${token}` } });
  check("the console's token opens the admin API", (await fetch(`${B}/api/admin/auctions`, bearer(process.env.OROCHIA_ADMIN_API_TOKEN))).status === 200);
  check("…a wrong token is refused", (await fetch(`${B}/api/admin/auctions`, bearer("x".repeat(48)))).status === 401);
  check("…and it opens no member route", (await fetch(`${B}/api/me/wallet`, bearer(process.env.OROCHIA_ADMIN_API_TOKEN))).status === 401);
}

// Platform & database, for operators: status, backups, and — last, it wipes everything — the factory reset.
{
  const status = (await admin.call("/api/admin/platform")).json.platform;
  check("operators see the platform: database, migrations up to date, rows per table", status?.history.kind === "current" && status.tables.some((t) => t.name === "users" && t.rows > 0));
  check("members cannot", (await alex.call("/api/admin/platform")).status === 403);
  const backup = await admin.call("/api/admin/platform/backups", "POST");
  check("a backup is written to private storage", backup.status === 201 && /^orochia-.*\.json\.gz$/.test(backup.json.backup?.name ?? ""), JSON.stringify(backup.json));
  const listed = (await admin.call("/api/admin/platform/backups")).json.backups ?? [];
  check("…and listed", listed.some((b) => b.name === backup.json.backup.name));
  const described = (await admin.call(`/api/admin/platform/backups/${backup.json.backup.name}`)).json.backup;
  check("…holding every table", described?.tables.some((t) => t.name === "auctions" && t.rows > 0));
  const file = await fetch(`${B}/api/admin/platform/backups/${backup.json.backup.name}?download=1`, { headers: { Cookie: admin.cookie } });
  check("…downloadable by operators only", file.status === 200 && (file.headers.get("content-type") ?? "").includes("gzip") && (await alex.call(`/api/admin/platform/backups/${backup.json.backup.name}?download=1`)).status === 403);
  check("a path in a backup name is refused", (await admin.call("/api/admin/platform/backups/..%2F..%2Fetc%2Fpasswd")).status === 404);
  if (!status.reset.allowed) {
    check("factory reset refused on this deployment", (await admin.call("/api/admin/platform/reset", "POST", { confirm: status.reset.confirmPhrase })).status === 403);
  } else {
    check("factory reset needs the typed phrase", (await admin.call("/api/admin/platform/reset", "POST", { confirm: "reset", backup: false })).status === 400);
    check("members cannot reset", (await alex.call("/api/admin/platform/reset", "POST", { confirm: status.reset.confirmPhrase })).status === 403);
    const reset = await admin.call("/api/admin/platform/reset", "POST", { confirm: status.reset.confirmPhrase, backup: true });
    check("factory reset: backup first, then the database is rebuilt", reset.status === 200 && reset.json.migrationsApplied >= 1 && Boolean(reset.json.backup?.name), JSON.stringify(reset.json));
    const after = (await admin.call("/api/admin/platform")).json.platform;
    check("…the operator keeps their account and session", after?.history.kind === "current");
    check("…everything else is gone", after.tables.find((t) => t.name === "videos").rows === 0 && after.tables.find((t) => t.name === "users").rows <= 2);
    check("…other accounts can no longer sign in", (await alex.call("/api/me/wallet")).status === 401);
    check("…the backup taken before is kept", ((await admin.call("/api/admin/platform/backups")).json.backups ?? []).some((b) => b.name === reset.json.backup.name));
  }
}

console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
