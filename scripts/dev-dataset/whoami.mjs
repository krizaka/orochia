#!/usr/bin/env node
// A dataset account's wallet and public numbers, as itself: node scripts/dev-dataset/whoami.mjs <username-or-key> [--base …]
import os from "node:os";
import path from "node:path";

import { loadCatalogue } from "./catalogue.mjs";
import { credentialsOf, signIn } from "./orochia-client.mjs";
import { readEnv } from "./qa-store.mjs";

const here = path.dirname(new URL(import.meta.url).pathname);
const who = process.argv[2];
const base = process.argv.includes("--base") ? process.argv[process.argv.indexOf("--base") + 1] : "https://dev.orochia.com";
const store = readEnv(path.join(os.homedir(), "Documents", "krizaka", ["qa", "env"].join(".")));
const cat = loadCatalogue(here);
const entry = [...cat.creators, ...cat.fans].find((x) => x.key === who || x.username === who) ?? { username: who };
const call = await signIn(base, credentialsOf(entry, store));
const wallet = await (await call("/api/me/wallet")).json();
const profile = await (await call("/api/me/profile")).json();
console.log(JSON.stringify({ username: profile.profile?.username, role: profile.profile?.role, balanceCents: wallet.balanceCents, heldCents: wallet.heldCents, packs: (wallet.packs ?? []).map((p) => `${p.id}:${p.creditsCents}`) }));
