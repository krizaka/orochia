// Copies @ffmpeg/ffmpeg's browser files to public/ffmpeg/ so the video editor loads them from this origin:
// Next's bundler cannot follow the worker that ffmpeg.wasm creates at runtime, and a module worker must
// come from the page's own origin. Run before `next dev` and `next build` (package.json pre-scripts).
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
// The package exports no package.json: walk up from its entry point to its dist/ folder.
const entry = require.resolve("@ffmpeg/ffmpeg");
const esm = path.join(entry.slice(0, entry.lastIndexOf(`${path.sep}dist${path.sep}`)), "dist", "esm");
const target = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "public", "ffmpeg");
if (!existsSync(esm)) throw new Error(`@ffmpeg/ffmpeg not installed (${esm})`);
mkdirSync(target, { recursive: true });
cpSync(esm, target, { recursive: true, filter: (file) => !file.endsWith(".d.ts") && !file.endsWith(".d.mts") });
console.log("ffmpeg.wasm browser files → public/ffmpeg/");
