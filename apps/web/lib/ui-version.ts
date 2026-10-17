import { readFileSync } from "node:fs";
import path from "node:path";

/** The installed version of @krizaka/ui, read at build (server only): what this site runs on. Empty when it cannot be read. */
export function uiVersion(): string {
  for (const dir of [process.cwd(), path.join(process.cwd(), "..", ".."), path.join(process.cwd(), "..", "..", "..")]) {
    try {
      return (JSON.parse(readFileSync(path.join(dir, "node_modules", "@krizaka", "ui", "package.json"), "utf8")) as { version: string }).version;
    } catch {
      /* hoisted elsewhere: try the next */
    }
  }
  return "";
}
