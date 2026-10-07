#!/usr/bin/env node
/**
 * End-to-end feature scenarios against a running Orochia on a freshly seeded database:
 * approved followers, contacts, collections and their permissions, views, likes, comments, shares, search, creator edits, takedowns, suspensions and
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
  return { status: r.status, call };
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
check("studio lists all of elena's videos with tags", studio.length === 3 && studio.some((v) => v.tags.includes("neon")));

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

console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
