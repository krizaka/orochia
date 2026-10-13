#!/usr/bin/env node
/**
 * A light load test of the live stream: N Server-Sent Events connections held open, then messages sent and timed
 * until every stream has them. Prints the latency (p50 / p95 / max), the connection time and — with --pid — the
 * server's memory before and after. Development data only (the seeded accounts); never against production.
 *
 *   node scripts/realtime-load.mjs [--url http://localhost:3000] [--streams 500] [--messages 10] [--pid <server pid>]
 *                                  [--send-url http://localhost:3001]   (two instances: streams on one, sends on the other)
 */
import { execFileSync } from "node:child_process";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, i, all) => (arg.startsWith("--") ? [...pairs, [arg.slice(2), all[i + 1]]] : pairs), []),
);
const B = (args.url ?? process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const STREAMS = Number(args.streams ?? 500);
const MESSAGES = Number(args.messages ?? 10);
const SEND = (args["send-url"] ?? B).replace(/\/$/, "");
const pid = args.pid ? Number(args.pid) : null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rssMb = () => (pid ? Math.round(Number(execFileSync("ps", ["-o", "rss=", "-p", String(pid)]).toString().trim()) / 1024) : null);
const pct = (values, p) => values.slice().sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor((p / 100) * values.length))];

async function login(identifier, password) {
  const r = await fetch(`${B}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier, password }) });
  if (r.status !== 200) throw new Error(`sign-in ${identifier}: ${r.status}`);
  return (r.headers.get("set-cookie") ?? "").split(";")[0];
}

const sender = await login("elena@orochia.org", "elena1234");
const receiver = await login("mia@orochia.org", "mia1234");
const conversationId = (await (await fetch(`${B}/api/conversations`, { method: "POST", headers: { Cookie: sender, "Content-Type": "application/json" }, body: JSON.stringify({ recipientUsername: "miasterling" }) })).json()).conversationId;

const before = rssMb();
const arrivals = new Map(); // message id → arrival times
const controllers = [];
let open = 0;
const t0 = Date.now();
const openOne = async () => {
  const ctrl = new AbortController();
  controllers.push(ctrl);
    const res = await fetch(`${B}/api/conversations/stream`, { headers: { Cookie: receiver }, signal: ctrl.signal });
    if (res.status !== 200) throw new Error(`stream: ${res.status}`);
    open++;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    (async () => {
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) return;
          buffer += decoder.decode(value, { stream: true });
          let cut;
          while ((cut = buffer.indexOf("\n\n")) >= 0) {
            const frame = buffer.slice(0, cut);
            buffer = buffer.slice(cut + 2);
            const data = frame.split("\n").find((l) => l.startsWith("data: "));
            if (!data) continue;
            const event = JSON.parse(data.slice(6));
            if (event.type === "new_message") {
              const list = arrivals.get(event.message.id) ?? [];
              list.push(Date.now());
              arrivals.set(event.message.id, list);
            }
          }
        }
      } catch {
        /* aborted */
      }
    })();
};
// Opened in waves of 100 (a laptop's listen backlog refuses thousands of simultaneous connects).
for (let i = 0; i < STREAMS; i += 100) await Promise.all(Array.from({ length: Math.min(100, STREAMS - i) }, openOne));
const connectMs = Date.now() - t0;
await sleep(2000);
const held = rssMb();

const latencies = [];
const complete = [];
for (let i = 0; i < MESSAGES; i++) {
  const sentAt = Date.now();
  const res = await fetch(`${SEND}/api/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: { Cookie: sender, "Content-Type": "application/json" },
    body: JSON.stringify({ content: `load ${i}`, clientId: crypto.randomUUID() }),
  });
  const { message } = await res.json();
  while ((arrivals.get(message.id)?.length ?? 0) < STREAMS && Date.now() - sentAt < 10_000) await sleep(5);
  const times = arrivals.get(message.id) ?? [];
  for (const at of times) latencies.push(at - sentAt);
  complete.push(times.length);
  await sleep(250);
}
const after = rssMb();
controllers.forEach((c) => c.abort());

const report = {
  url: B,
  sendUrl: SEND,
  streams: STREAMS,
  opened: open,
  connectAllMs: connectMs,
  messages: MESSAGES,
  deliveredToEveryStream: complete.every((n) => n === STREAMS),
  latencyMs: { p50: pct(latencies, 50), p95: pct(latencies, 95), max: Math.max(...latencies) },
  serverRssMb: pid ? { before, withStreams: held, afterMessages: after, perStreamKb: Math.round(((held - before) * 1024) / STREAMS) } : "pass --pid",
};
console.log(JSON.stringify(report, null, 2));
process.exit(report.deliveredToEveryStream ? 0 : 1);
