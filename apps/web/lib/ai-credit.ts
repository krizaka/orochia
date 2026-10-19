/**
 * The provenance line Orazaka-made clips carry in their description:
 * "Made with Orazaka — run <id> (<model> on <hardware>)." Read here, never guessed.
 */
export interface AiCredit {
  /** The whole line, as written. */
  line: string;
  runId: string | null;
  model: string | null;
  hardware: string | null;
}

const LINE = /Made with Orazaka[^\n]*/;

export function parseAiCredit(description?: string | null): AiCredit | null {
  const m = description?.match(LINE);
  if (!m) return null;
  const line = m[0];
  const runId = line.match(/run\s+([0-9a-f]{6,}(?:-[0-9a-f]+)*)/i)?.[1] ?? null;
  const inner = line.match(/\(([^)]*)\)/)?.[1] ?? null;
  const [model, hardware] = inner ? inner.split(/\s+on\s+/i).map((s) => s.trim()) : [null, null];
  return { line, runId, model: model || null, hardware: hardware || null };
}

/** The structured provenance a video stores (`videos.ai_provenance`, orochia#268). */
export interface StoredAiProvenance {
  generator: "orazaka";
  runId: string;
  model?: string | null;
  hardware?: string | null;
}

/**
 * The credit of a video: the stored provenance first, the description's line only for clips made before the field
 * existed. The line is built from the data, so both read the same.
 */
export function aiCreditOf(video: { aiProvenance?: StoredAiProvenance | null; description?: string | null }): AiCredit | null {
  const p = video.aiProvenance;
  if (p?.runId) {
    const inner = [p.model, p.hardware].filter(Boolean).join(" on ");
    return { line: `Made with Orazaka — run ${p.runId}${inner ? ` (${inner})` : ""}.`, runId: p.runId, model: p.model ?? null, hardware: p.hardware ?? null };
  }
  return parseAiCredit(video.description);
}

/** `6351addc-…`: the first group of the id, the rest elided. */
export function shortRunId(runId: string): string {
  const head = runId.split("-")[0] ?? runId;
  return head.length < runId.length ? `${head}…` : head;
}

/** The description without its credit line (the badge carries it). */
export function withoutCredit(description?: string | null): string {
  return (description ?? "").replace(LINE, "").trim();
}
