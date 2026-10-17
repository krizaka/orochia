// The local QA store (mode 0600, outside every repository): KEY=value lines read into memory, never printed.
import fs from "node:fs";

/** KEY=value (or KEY: value) lines. */
export function readEnv(file) {
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*[=:]\s*(.*?)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

/** Sets the given keys, keeps every other line, keeps the mode at 0600. */
export function setQaEnv(file, pairs) {
  const lines = fs.existsSync(file) ? fs.readFileSync(file, "utf8").split("\n") : [];
  const done = new Set();
  const next = lines.map((line) => {
    const m = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=/);
    if (m && m[1] in pairs) {
      done.add(m[1]);
      return `${m[1]}=${pairs[m[1]]}`;
    }
    return line;
  });
  while (next.length && next[next.length - 1] === "") next.pop();
  for (const [k, v] of Object.entries(pairs)) if (!done.has(k)) next.push(`${k}=${v}`);
  fs.writeFileSync(file, `${next.join("\n")}\n`, { mode: 0o600 });
  fs.chmodSync(file, 0o600);
}
