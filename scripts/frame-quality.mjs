// A take must never show a loading state: a skeleton frame (grey placeholder blocks) or a blank one. The check reads
// frames as gray pixels and measures how much detail they hold: the mean absolute gradient (edges) over the screen below
// the status line. Skeleton placeholders (flat blocks on a dark ground) measure about 2, a loaded screen 6 and more
// (the darkest, the earnings page, 6.3), a black frame 0.
import { execFileSync } from "node:child_process";

const W = 78;
const H = 169;
/** Below this mean gradient a frame is a placeholder or blank, not content. */
export const SKELETON_GRADIENT = 4;

/** `{ gradient, std, mean }` of the raw gray bytes `raw` (W × H). */
export function frameStats(raw) {
  let grad = 0;
  let n = 0;
  let sum = 0;
  let sq = 0;
  for (let y = 12; y < H - 12; y++) {
    for (let x = 0; x < W - 1; x++) {
      const v = raw[y * W + x];
      grad += Math.abs(v - raw[y * W + x + 1]) + Math.abs(v - raw[(y + 1) * W + x]);
      sum += v;
      sq += v * v;
      n++;
    }
  }
  const mean = sum / n;
  return { gradient: +(grad / n).toFixed(2), std: +Math.sqrt(sq / n - mean * mean).toFixed(2), mean: +mean.toFixed(1) };
}

/** The same for an image file (sharp: no ffmpeg needed, so a test can read a poster anywhere). */
export async function stillStats(file) {
  const { default: sharp } = await import("sharp");
  const raw = await sharp(file).resize(W, H, { fit: "fill", kernel: "lanczos3" }).grayscale().raw().toBuffer();
  return frameStats(raw);
}

export const isSkeleton = (stats) => stats.gradient < SKELETON_GRADIENT;

/** Every `1/fps` s of a video as raw gray frames: `[{ t, stats }]`. */
export function scanVideo(file, fps = 4) {
  const raw = execFileSync("ffmpeg", ["-v", "error", "-i", file, "-vf", `fps=${fps},scale=${W}:${H}:flags=area,format=gray`, "-f", "rawvideo", "-"], { maxBuffer: 1e9 });
  const frames = [];
  for (let i = 0; i + W * H <= raw.length; i += W * H) frames.push({ t: frames.length / fps, stats: frameStats(raw.subarray(i, i + W * H)) });
  return frames;
}

/** The moments of a take that show a loading state or nothing; the first and last `edge` seconds (the fades) are left out. */
export function badMoments(file, { fps = 4, edge = 0.6 } = {}) {
  const frames = scanVideo(file, fps);
  const end = frames.length / fps;
  return frames.filter((f) => f.t >= edge && f.t <= end - edge && isSkeleton(f.stats)).map((f) => ({ t: f.t, gradient: f.stats.gradient }));
}

/** The time (s) of the best still in `[from, to]`: rich in detail and settled (the next tenth of a second looks the same), never mid-swipe. */
export function settledTime(file, from, to, fps = 10) {
  const raw = execFileSync("ffmpeg", ["-v", "error", "-i", file, "-vf", `fps=${fps},scale=${W}:${H}:flags=area,format=gray`, "-f", "rawvideo", "-"], { maxBuffer: 1e9 });
  const frame = (i) => raw.subarray(i * W * H, (i + 1) * W * H);
  const count = Math.floor(raw.length / (W * H));
  let best = { score: -1, t: from };
  for (let i = Math.floor(from * fps); i < Math.min(count - 1, Math.ceil(to * fps)); i++) {
    const { gradient } = frameStats(frame(i));
    let diff = 0;
    for (let k = 0; k < W * H; k += 7) diff += Math.abs(frame(i)[k] - frame(i + 1)[k]);
    const motion = diff / (W * H / 7);
    const score = gradient - motion * 4;
    if (score > best.score && !isSkeleton({ gradient })) best = { score, t: i / fps };
  }
  return best.score < 0 ? null : best.t;
}
