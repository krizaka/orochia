/**
 * A stand-in for Orazaka's `POST /api/v1/embeddings`, for the scenarios: the same contract (OpenAI-shaped `data`, a `runId`,
 * a bearer `oz_` key), vectors made of the words of a text hashed into 1024 dimensions — with a few synonyms, so "japan
 * capital" lands next to "Tokyo" although the words differ. The real model is proven by the live check on dev, not here.
 * `down()` makes it answer 503 (Orazaka out of reach), `up()` brings it back.
 */
import { createHash, randomUUID } from "node:crypto";
import http from "node:http";

const DIM = 1024;
const SYNONYMS = { japan: "tokyo", japanese: "tokyo", capital: "tokyo", evening: "midnight", jazz: "acoustic", unplugged: "acoustic", songs: "acoustic" };

export function vectorOf(text) {
  const v = new Array(DIM).fill(0);
  for (const raw of text.toLowerCase().match(/[a-z]{3,}/g) ?? []) {
    const word = SYNONYMS[raw] ?? raw;
    v[createHash("sha256").update(word).digest().readUInt16BE(0) % DIM] += 1;
  }
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}

export function startOrazakaStub(port = 4599) {
  let isDown = false;
  const runs = [];
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      const reply = (status, json) => {
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify(json));
      };
      if (isDown) return reply(503, { error: "down" });
      if (req.method !== "POST" || req.url !== "/api/v1/embeddings") return reply(404, {});
      if (!/^Bearer oz_/.test(req.headers.authorization ?? "")) return reply(401, {});
      const { input } = JSON.parse(body || "{}");
      if (!Array.isArray(input) || input.length === 0) return reply(400, {});
      const runId = randomUUID();
      runs.push({ runId, inputs: input.length });
      reply(200, {
        runId,
        model: "bge-m3",
        dimensions: DIM,
        data: input.map((text, index) => ({ index, embedding: vectorOf(String(text)) })),
        usage: { promptTokens: input.length * 6 },
      });
    });
  });
  return new Promise((resolve) =>
    server.listen(port, "127.0.0.1", () =>
      resolve({ runs, down: () => (isDown = true), up: () => (isDown = false), close: () => new Promise((r) => server.close(r)) }),
    ),
  );
}
