/**
 * The Orochia module map — the same model as Orazaka's (krizaka.com draws both with one component):
 * modules in roles, build dependencies and runtime flows, every one read from the code of the
 * repositories of orochia.workspace.json (cloned side by side, ../<name>). Nothing here is a list of
 * facts kept by hand: a rule names where a fact comes from, and a module or a flow whose source is gone
 * disappears from the map instead of staying drawn.
 *
 *   roles      client · service · library · design · data · external
 *   modules    apps/web (two modules: its pages, run in the browser, and its API route handlers),
 *              packages/*, the sibling repositories, the @krizaka/* packages they install, the data
 *              stores they open and the third-party services their code calls
 *   flows      http · sql (request/response) and webhook · sse · notify · push (events), each with
 *              what carries it (`via`)
 */

import fs from "node:fs";
import path from "node:path";

const read = (p) => (fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "");
const json = (p) => (fs.existsSync(p) ? JSON.parse(read(p)) : null);
const SKIP = /(node_modules|\.next|dist|\.expo|coverage|__tests__|\.test\.|\.spec\.)/;
const sources = (dir) =>
  !fs.existsSync(dir)
    ? []
    : fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const p = path.join(dir, e.name);
        if (SKIP.test(p)) return [];
        return e.isDirectory() ? sources(p) : /\.(ts|tsx|js|mjs)$/.test(e.name) ? [p] : [];
      });
const textOf = (files) => files.map(read).join("\n");

export const ROLES = [
  { id: "client", title: "Clients", rule: "what a person uses: the pages of apps/web (in the browser), a sibling app repository (admin console, mobile app)" },
  { id: "service", title: "Application", rule: "the API route handlers of apps/web (app/api/**/route.ts): the one process that serves every client" },
  { id: "library", title: "Packages", rule: "a workspace package of this monorepo (packages/*), imported by the application" },
  { id: "design", title: "Design system", rule: "the Orochia design system and the @krizaka/* packages the apps install" },
  { id: "data", title: "Data stores", rule: "a database an app opens (pg / Drizzle and its DATABASE_URL)" },
  { id: "external", title: "External services", rule: "a third-party service the code calls (its API host appears in the sources)" },
];

/** Third-party services: present on the map only when their host appears in the code that calls them. */
const EXTERNALS = [
  { id: "bunny-stream", name: "Bunny Stream", host: /video\.bunnycdn\.com/, where: ["packages/media/src"], description: "Video storage, encoding and the HLS edge CDN: uploads go to it directly (Tus), playback comes from it with a signed URL." },
  { id: "ccbill", name: "CCBill", host: /bill\.ccbill\.com/, where: ["packages/payments/src/adapters"], description: "Card payment gateway: hosted checkout form, signed webhook." },
  { id: "segpay", name: "Segpay", host: /segpay\.com/, where: ["packages/payments/src/adapters"], description: "Card payment gateway: hosted checkout page, signed webhook." },
  { id: "nowpayments", name: "NowPayments", host: /api\.nowpayments\.io/, where: ["packages/payments/src/adapters"], description: "Crypto payment gateway: invoices over its API, signed IPN." },
  { id: "stripe", name: "Stripe", host: /api\.stripe\.com/, where: ["packages/payments/src/adapters"], description: "Card payment gateway: Checkout sessions over its API, signed webhook (timestamp tolerance)." },
  { id: "mailgun", name: "Mailgun", host: /api\.mailgun\.net/, where: ["apps/web/lib"], description: "Transactional e-mail (verification, password reset, notifications)." },
  { id: "resend", name: "Resend", host: /api\.resend\.com/, where: ["apps/web/lib"], description: "Transactional e-mail, the alternative provider." },
  { id: "expo-push", name: "Expo Push", host: /exp\.host\/--\/api\/v2\/push/, where: ["packages/push/src"], description: "Push notifications to the iOS and Android app." },
  { id: "google-oauth", name: "Google sign-in", host: /oauth2\.googleapis\.com/, where: ["apps/web/lib"], description: "OAuth 2 sign-in: consent screen, code exchange, user info." },
  { id: "facebook-oauth", name: "Facebook sign-in", host: /graph\.facebook\.com/, where: ["apps/web/lib"], description: "OAuth 2 sign-in: consent dialog, code exchange, profile." },
];
const GATEWAYS = ["ccbill", "segpay", "nowpayments", "stripe"];

/** The leading doc comment of a file, first sentence. */
function leadSentence(file) {
  const doc = read(file).match(/^\s*\/\*\*([\s\S]*?)\*\//);
  if (!doc) return null;
  const text = doc[1].split("\n").map((l) => l.replace(/^\s*\*\s?/, "").trim()).filter(Boolean).join(" ");
  return text.split(/(?<=[a-z0-9)`]\.)\s/)[0] || null;
}

/**
 * `previous` is the map generated last time: a sibling repository that is not cloned here (CI clones only this
 * one) keeps what it contributed then — its modules and every relation that touches them — instead of
 * disappearing from the map. The repositories carried over are named in `carried`.
 */
export function buildArchitectureMap(root, workspace, previous = null) {
  const sibling = (name) => (name === "orochia" ? root : path.resolve(root, "..", name));
  const repoUrl = (name) => `https://github.com/${workspace.org}/${name}`;
  const lock = json(path.join(root, "package-lock.json"));
  const modules = [];
  const dependencies = [];
  const flows = [];
  const has = (id) => modules.some((m) => m.id === id);
  const dep = (from, to, version) => {
    if (has(from) && has(to) && from !== to && !dependencies.some((d) => d.from === from && d.to === to)) dependencies.push({ from, to, ...(version ? { version } : {}) });
  };
  const flow = (from, to, kind, via) => {
    if (has(from) && has(to) && from !== to && !flows.some((f) => f.from === from && f.to === to && f.kind === kind && f.via === via)) flows.push({ from, to, kind, via });
  };

  // ── apps/web: its pages (client) and its API (service) ──────────────────────────────────────
  const web = json(path.join(root, "apps/web/package.json"));
  const apiDir = path.join(root, "apps/web/app/api");
  const routes = sources(apiDir).filter((p) => /route\.(ts|js)$/.test(p));
  const routeOf = (file) => "/api/" + path.relative(apiDir, path.dirname(file)).split(path.sep).join("/");
  modules.push({
    id: "orochia-web",
    name: web.name,
    role: "client",
    owner: "orochia",
    repository: "orochia",
    path: "apps/web/app",
    runtime: "browser",
    version: web.version,
    published: false,
    description: "The web app in the browser: viewer pages, creator studio, the HLS player and the Tus uploader (Next.js App Router).",
  });
  modules.push({
    id: "orochia-api",
    name: web.name,
    role: "service",
    owner: "orochia",
    repository: "orochia",
    path: "apps/web/app/api",
    runtime: "node",
    version: web.version,
    published: false,
    description: `The API: ${routes.length} route handlers — access control, signed media URLs, payments and the ledger, auctions, challenges, realtime. Deployed with the pages, one process.`,
  });

  // ── packages/* ──────────────────────────────────────────────────────────────────────────────
  const packageIds = new Map(); // npm name → module id
  for (const dir of fs.readdirSync(path.join(root, "packages")).sort()) {
    const pkg = json(path.join(root, "packages", dir, "package.json"));
    if (!pkg) continue;
    const id = `orochia-${dir}`;
    packageIds.set(pkg.name, id);
    modules.push({
      id,
      name: pkg.name,
      role: "library",
      owner: "orochia",
      repository: "orochia",
      path: `packages/${dir}`,
      runtime: "node",
      version: pkg.version,
      published: !pkg.private,
      description: pkg.description ?? leadSentence(path.join(root, "packages", dir, "src/index.ts")),
    });
  }

  // ── sibling repositories ────────────────────────────────────────────────────────────────────
  const siblings = workspace.repositories.filter((r) => r.name !== "orochia" && fs.existsSync(path.join(sibling(r.name), "package.json")));
  for (const r of siblings) {
    const pkg = json(path.join(sibling(r.name), "package.json"));
    const design = /design-system/.test(r.name);
    modules.push({
      id: r.name,
      name: pkg.name,
      role: design ? "design" : "client",
      owner: "orochia",
      repository: r.name,
      path: ".",
      runtime: pkg.dependencies?.expo ? "react-native" : design ? "library" : "node",
      version: pkg.version,
      published: !pkg.private && design,
      description: pkg.description ?? r.role,
    });
    if (design) packageIds.set(pkg.name, r.name);
  }

  // A sibling published under @krizaka/<its repository name> is that sibling, cloned or not.
  for (const r of workspace.repositories) if (r.name !== "orochia" && !packageIds.has(`@krizaka/${r.name}`)) packageIds.set(`@krizaka/${r.name}`, r.name);

  // ── @krizaka/* packages the apps install (versions: what each consumer's lockfile resolved) ─────
  const consumers = [
    { id: "orochia-web", pkg: web, lock },
    ...siblings.map((r) => ({ id: r.name, pkg: json(path.join(sibling(r.name), "package.json")), lock: json(path.join(sibling(r.name), "package-lock.json")) })),
  ];
  const resolved = (l, name) => l?.packages?.[`node_modules/${name}`]?.version ?? null;
  const krizaka = new Set(
    consumers.flatMap((c) => Object.keys({ ...c.pkg.dependencies, ...c.pkg.peerDependencies }).filter((n) => n.startsWith("@krizaka/") && !packageIds.has(n))),
  );
  for (const name of [...krizaka].sort()) {
    const id = name.replace("@krizaka/", "krizaka-");
    packageIds.set(name, id);
    const installed = json(path.join(root, "node_modules", name, "package.json"));
    modules.push({
      id,
      name,
      role: "design",
      owner: "krizaka",
      repository: name === "@krizaka/ui" || /^@krizaka\/(tokens|tailwind|i18n|icons|intl)$/.test(name) ? "krizaka-ui" : name.slice(9),
      path: `node_modules/${name}`,
      runtime: "library",
      version: resolved(lock, name) ?? installed?.version ?? null,
      published: true,
      description: installed?.description ?? null,
    });
  }

  // ── data stores ─────────────────────────────────────────────────────────────────────────────
  const dbPkg = json(path.join(root, "packages/db/package.json"));
  if (dbPkg?.dependencies?.pg) {
    modules.push({ id: "postgresql", name: "PostgreSQL", role: "data", owner: "external", repository: "orochia", path: "packages/db", runtime: "postgresql", version: null, published: false, description: "The Orochia database: accounts, videos, the ledger, auctions, challenges — and the realtime bus (LISTEN/NOTIFY). Schema and migrations in packages/db." });
  }
  const admin = siblings.find((r) => r.name === "orochia-admin");
  if (admin && json(path.join(sibling(admin.name), "package.json"))?.dependencies?.pg) {
    modules.push({ id: "admin-postgresql", name: "PostgreSQL (console)", role: "data", owner: "external", repository: "orochia-admin", path: "lib/db.ts", runtime: "postgresql", version: null, published: false, description: "The console's own database: its operator account and sessions — never the Orochia data, which it reaches through the admin API." });
  }

  // ── external services, when the code calls them ─────────────────────────────────────────────
  for (const x of EXTERNALS) {
    const code = textOf(x.where.flatMap((w) => sources(path.join(root, w))));
    if (!x.host.test(code)) continue;
    modules.push({ id: x.id, name: x.name, role: "external", owner: "external", repository: null, path: null, runtime: "saas", version: null, published: false, description: x.description });
  }

  // ── build dependencies ──────────────────────────────────────────────────────────────────────
  // apps/web: the workspace packages are the API's, the design packages the pages'.
  for (const [name, spec] of Object.entries(web.dependencies ?? {})) {
    const to = packageIds.get(name);
    if (!to) continue;
    dep(name.startsWith("@orochia/") ? "orochia-api" : "orochia-web", to, name.startsWith("@orochia/") ? null : resolved(lock, name) ?? spec);
  }
  for (const dir of fs.readdirSync(path.join(root, "packages")).sort()) {
    const pkg = json(path.join(root, "packages", dir, "package.json"));
    for (const name of Object.keys({ ...pkg?.dependencies, ...pkg?.peerDependencies })) if (packageIds.has(name)) dep(`orochia-${dir}`, packageIds.get(name));
  }
  for (const c of consumers.slice(1)) {
    for (const [name, spec] of Object.entries({ ...c.pkg.dependencies, ...c.pkg.peerDependencies })) {
      if (packageIds.has(name)) dep(c.id, packageIds.get(name), resolved(c.lock, name) ?? spec);
    }
  }

  // ── runtime flows ───────────────────────────────────────────────────────────────────────────
  const webClient = textOf([path.join(root, "apps/web/components"), path.join(root, "apps/web/app"), path.join(root, "apps/web/lib")].flatMap(sources).filter((p) => !p.startsWith(apiDir)));
  const apiCode = textOf([...routes, ...sources(path.join(root, "apps/web/lib"))]);
  const streams = routes.filter((p) => /text\/event-stream|sseResponse\(/.test(read(p))).map(routeOf).sort();
  // A stream route is used by a client whose code names its path, a [param] segment written as a template hole.
  const streamPattern = (route) =>
    new RegExp(route.split("/").map((seg) => (/^\[.+\]$/.test(seg) ? "(?:\\$\\{[^}]+\\}|[\\w-]+)" : seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))).join("/"));
  const streamUsedBy = (code) => streams.filter((s) => streamPattern(s).test(code));

  // Clients → the API.
  if (/fetch\(\s*[`"']\/api\//.test(webClient)) flow("orochia-web", "orochia-api", "http", "/api/* · session cookie");
  for (const r of siblings.filter((s) => !/design-system/.test(s.name))) {
    const code = textOf(["src", "app", "lib"].flatMap((d) => sources(path.join(sibling(r.name), d))));
    if (/OROCHIA_API_URL/.test(code) && /\/api\/admin\//.test(code)) flow(r.name, "orochia-api", "http", "/api/admin/* · service token");
    else if (/\/api\//.test(code)) flow(r.name, "orochia-api", "http", "/api/* · Bearer session");
    for (const s of streamUsedBy(code)) flow("orochia-api", r.name, "sse", s);
    if (/expo-video/.test(read(path.join(sibling(r.name), "package.json")))) flow(r.name, "bunny-stream", "http", "HLS playback · signed URL");
    if (/expo-notifications/.test(read(path.join(sibling(r.name), "package.json")))) flow("expo-push", r.name, "push", "notification");
    if (r.name === "orochia-admin" && has("admin-postgresql")) flow(r.name, "admin-postgresql", "sql", "operator accounts · sessions");
  }
  // The API → its clients, over Server-Sent Events.
  for (const s of streamUsedBy(webClient)) flow("orochia-api", "orochia-web", "sse", s);
  // The API ↔ PostgreSQL: queries through @orochia/db, events back through LISTEN/NOTIFY.
  flow("orochia-api", "postgresql", "sql", "@orochia/db · Drizzle");
  const channel = read(path.join(root, "apps/web/lib/realtime.ts")).match(/CHANNEL\s*=\s*["'](\w+)["']/)?.[1];
  if (channel && /LISTEN/.test(read(path.join(root, "packages/db/src/listen.ts")))) flow("postgresql", "orochia-api", "notify", `LISTEN/NOTIFY ${channel}`);
  // Media: the API registers and signs, the browser uploads and plays straight from Bunny, Bunny calls back.
  if (has("bunny-stream")) {
    flow("orochia-api", "bunny-stream", "http", "create video · Tus signature");
    if (/tus-js-client/.test(webClient)) flow("orochia-web", "bunny-stream", "http", "Tus upload (resumable)");
    if (/hls\.js/.test(webClient)) flow("orochia-web", "bunny-stream", "http", "HLS playback · signed URL");
    if (routes.some((p) => routeOf(p) === "/api/webhooks/bunny")) flow("bunny-stream", "orochia-api", "webhook", "/api/webhooks/bunny");
  }
  // Payments: the buyer pays on the gateway's page, the gateway proves it to the API.
  const paymentsCode = Object.fromEntries(sources(path.join(root, "packages/payments/src/adapters")).map((p) => [p, read(p)]));
  for (const g of GATEWAYS.filter(has)) {
    const adapter = Object.values(paymentsCode).find((src) => EXTERNALS.find((x) => x.id === g).host.test(src)) ?? "";
    if (/this\.http\(|fetch\(/.test(adapter)) flow("orochia-api", g, "http", "checkout session over its API");
    flow("orochia-web", g, "http", "hosted checkout page");
    if (routes.some((p) => routeOf(p) === "/api/webhooks/payments/[gateway]")) flow(g, "orochia-api", "webhook", `/api/webhooks/payments/${g === "nowpayments" ? "crypto" : g}`);
  }
  for (const id of ["mailgun", "resend"]) flow("orochia-api", id, "http", "send e-mail");
  flow("orochia-api", "expo-push", "http", "@orochia/push · send");
  for (const id of ["google-oauth", "facebook-oauth"]) {
    flow("orochia-web", id, "http", "consent screen (redirect)");
    if (/\/api\/auth\/oauth/.test(apiCode) || routes.some((p) => routeOf(p).startsWith("/api/auth/oauth"))) flow("orochia-api", id, "http", "code exchange · user info");
  }

  // ── siblings not cloned here: keep their part of the previous map ─────────────────────────────
  const carried = workspace.repositories.filter((r) => r.name !== "orochia" && !fs.existsSync(path.join(sibling(r.name), "package.json"))).map((r) => r.name);
  if (previous && carried.length) {
    const theirs = new Set(previous.modules.filter((m) => carried.includes(m.repository)).map((m) => m.id));
    const touches = (x) => theirs.has(x.from) || theirs.has(x.to);
    const needed = new Set([...theirs, ...previous.dependencies.filter(touches).flatMap((d) => [d.from, d.to]), ...previous.flows.filter(touches).flatMap((f) => [f.from, f.to])]);
    for (const m of previous.modules) if (needed.has(m.id) && !has(m.id)) modules.push(m);
    for (const d of previous.dependencies.filter(touches)) dep(d.from, d.to, d.version);
    for (const f of previous.flows.filter(touches)) flow(f.from, f.to, f.kind, f.via);
  }

  const order = new Map(ROLES.map((r, i) => [r.id, i]));
  modules.sort((a, b) => order.get(a.role) - order.get(b.role) || (a.owner === b.owner ? 0 : a.owner === "orochia" ? -1 : 1) || a.id.localeCompare(b.id));
  dependencies.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
  flows.sort((a, b) => a.kind.localeCompare(b.kind) || a.from.localeCompare(b.from) || a.to.localeCompare(b.to) || a.via.localeCompare(b.via));
  const repositories = workspace.repositories.map((r) => ({ name: r.name, url: repoUrl(r.name) }));
  return { roles: ROLES, repositories, modules, dependencies, flows };
}
