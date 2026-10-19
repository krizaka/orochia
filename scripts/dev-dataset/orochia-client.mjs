// A client for Orochia's PUBLIC API as one signed-in person: a session cookie jar, 429 back-off, Tus upload of a clip. No SQL, no secret printed.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { derivePassword, emailOf } from "./catalogue.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, "../../apps/web/package.json"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Where an account's password comes from: a creator of the first dataset has its own entry in the QA store, the others are derived. */
export function credentialsOf(entry, store) {
  if (entry.credentials) return { identifier: store[`${entry.credentials}_EMAIL`], password: store[`${entry.credentials}_PASSWORD`] };
  return { identifier: emailOf(entry.username), password: derivePassword(store.OROCHIA_DATASET_SECRET, entry.username) };
}

/** Signs in and returns `call(url, init)`; JSON in, Response out. A 429 waits for `Retry-After` (at most `maxWaitS`) and tries again. */
export async function signIn(base, { identifier, password }, { maxWaitS = 3700 } = {}) {
  const jar = new Map();
  const call = async (url, init = {}) => {
    for (let attempt = 0; ; attempt++) {
      const cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
      const isForm = init.body instanceof FormData;
      const res = await fetch(base + url, { ...init, headers: { ...(isForm ? {} : { "content-type": "application/json" }), cookie, ...(init.headers ?? {}) }, redirect: "manual" });
      for (const c of res.headers.getSetCookie?.() ?? []) {
        const [pair] = c.split(";");
        const i = pair.indexOf("=");
        jar.set(pair.slice(0, i), pair.slice(i + 1));
      }
      if (res.status === 429 && attempt < 6) {
        const wait = Math.min(maxWaitS, Number(res.headers.get("retry-after") ?? 60)) + 2;
        console.log(`  … 429 on ${url}, waiting ${wait}s`);
        await sleep(wait * 1000);
        continue;
      }
      return res;
    }
  };
  if (!identifier || !password) throw new Error("missing credentials");
  const res = await call("/api/auth/login", { method: "POST", body: JSON.stringify({ identifier, password }) });
  if (!res.ok) throw new Error(`sign-in failed (${res.status})`);
  return call;
}

/** Sends a clip to Bunny over Tus with the session the API signed. */
export async function sendOriginal(file, info) {
  const tus = require("tus-js-client");
  const size = fs.statSync(file).size;
  await new Promise((resolve, reject) => {
    new tus.Upload(fs.createReadStream(file), {
      endpoint: info.tusEndpoint,
      uploadSize: size,
      chunkSize: 5 * 1024 * 1024,
      retryDelays: [0, 3000, 5000, 10000],
      headers: { AuthorizationSignature: info.headers.AuthorizationSignature, AuthorizationExpire: String(info.headers.AuthorizationExpire), VideoId: info.headers.VideoId, LibraryId: String(info.headers.LibraryId) },
      metadata: { filetype: "video/mp4", title: path.basename(file) },
      onError: reject,
      onSuccess: resolve,
    }).start();
  });
}

/** The creator's own videos, whatever their state. */
export async function listOwn(call) {
  const res = await (await call("/api/me/dashboard")).json();
  return (res.data?.uploads ?? []).filter((v) => !v.removedAt).map((v) => ({ id: v.id, title: v.title, width: v.width, height: v.height, status: v.status, visibility: v.visibility }));
}
