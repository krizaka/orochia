#!/usr/bin/env node
/**
 * End-to-end feature scenarios against a running Orochia on a freshly seeded database:
 * approved followers, contacts, invited-only videos and audience lists, collections and their permissions, views, likes, comments, shares, search, creator edits, takedowns, suspensions and
 * role changes — each checked through the HTTP API with real sessions.
 *
 *   npm run db:reset -- --yes && npm run dev      # in another terminal
 *   npm run test:e2e                              # OROCHIA_URL defaults to http://localhost:3000
 *
 * The scenarios change data (they approve, accept, take down…): reset the database before re-running.
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
  const reg = await call("/api/auth/register", "POST", { username: `new_${stamp}`, email, displayName: "New Member", password: "first-password-1", isAgeVerified: true, acceptTerms: true });
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
  const complete = await fetch(`${B}/api/auth/oauth/complete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "x_y_z", displayName: "X", isAgeVerified: true, acceptTerms: true }) });
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

// Orochia credits: the in-house method settles at once through intent → ledger → access grant
{
  const paid = feed.find((v) => v.visibility === "TIPPED_UNLOCKED");
  const gateways = (await mia.call("/api/payments/gateways")).json.gateways;
  if (!gateways?.includes("CREDITS")) {
    check("credits offered when PAYMENTS_CREDITS_MODE=always-approve", false, JSON.stringify(gateways));
  } else {
    check("mia cannot watch the paid video yet", (await mia.call(`/api/videos/${paid.id}/stream`)).json.reason === "PAYWALL_REQUIRED");
    check("below the minimum is refused", (await mia.call("/api/videos/unlock-video", "POST", { videoId: paid.id, amountCents: 100, gateway: "CREDITS" })).status === 400);
    const unlock = await mia.call("/api/videos/unlock-video", "POST", { videoId: paid.id, amountCents: paid.minTipAmountCents, gateway: "CREDITS" });
    check("unlock with credits settles at once", unlock.json.settled === true, JSON.stringify(unlock.json));
    check("…and opens the video", (await mia.call(`/api/videos/${paid.id}/stream`)).json.allowed === true);
    check("nobody can post a credits webhook", (await fetch(`${B}/api/webhooks/payments/credits`, { method: "POST", body: "{}" })).status === 404);
  }
}

// Reference Data & Presets
{
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

// Search and AI discovery: public pages only
const sitemapXml = await (await fetch(`${B}/sitemap.xml`)).text();
check("sitemap lists public videos and creators", sitemapXml.includes(`/watch/${noir.id}`) && sitemapXml.includes("/creators/elenavox"));
check("sitemap never lists an invited-only video", !sitemapXml.includes(roughCut.id));
check("invited-only watch page is noindex", /<meta name="robots" content="noindex/.test(await (await fetch(`${B}/watch/${roughCut.id}`)).text()));
check("public watch page carries a VideoObject", (await (await fetch(`${B}/watch/${noir.id}`)).text()).includes('"@type":"VideoObject"'));
check("robots.txt keeps accounts out", (await (await fetch(`${B}/robots.txt`)).text()).includes("Disallow: /dashboard"));
check("llms.txt served", (await fetch(`${B}/llms.txt`)).status === 200);

console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
